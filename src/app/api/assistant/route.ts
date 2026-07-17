import { ApiError, GoogleGenAI, type Content, type Part } from "@google/genai";
import { assistantReady, ASSISTANT_TOOLS, executeAssistantTool } from "@/lib/ai-assistant-tools";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { STAGE_LABEL } from "@/lib/stage";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * **AI ຜູ້ຊ່ວຍວຽກ — ອ່ານຢ່າງດຽວ, ຕອບຈາກຂໍ້ມູນຈິງເທົ່ານັ້ນ.**
 *
 * ── ໃຊ້ Google Gemini (17-07-2026) ──
 * ຄຳສັບຂອງ Gemini ທີ່ຕ່າງຈາກເຈົ້າອື່ນ:
 *   `system` → `config.systemInstruction` · ບົດສົນທະນາເອີ້ນວ່າ `contents`
 *   · role ຂອງ AI ຄື **"model"** (ບໍ່ແມ່ນ "assistant") · ເຄື່ອງມືຢູ່ໃນ
 *   `config.tools[].functionDeclarations` · ຜົນຂອງເຄື່ອງມືສົ່ງກັບເປັນ part
 *   `functionResponse` ໃນ role "user".
 *
 * ── ເປັນຫຍັງໃຊ້ `parametersJsonSchema` ບໍ່ແມ່ນ `parameters` ──
 * `parameters` ຮັບແຕ່ schema ແບບ OpenAPI ຂອງ Google (type ເປັນ OBJECT/STRING ແລະ
 * **ບໍ່ຮັບ type ຫຼາຍຢ່າງພ້ອມກັນ** ເຊັ່ນ `["integer","null"]` ທີ່ schema ຂອງເຮົາໃຊ້ຢູ່)
 * ⇒ ຕ້ອງແປງ schema ທັງໝົດ = ນິຍາມຊ້ຳສອງບ່ອນ. `parametersJsonSchema` ຮັບ JSON Schema
 * ມາດຕະຖານກົງໆ ⇒ **ນິຍາມເຄື່ອງມືຍັງຢູ່ບ່ອນດຽວ** (lib/ai-assistant-tools).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ຮຸ່ນທີ່ໃຊ້ — ຕັ້ງ GEMINI_MODEL ເພື່ອປ່ຽນໂດຍບໍ່ຕ້ອງແກ້ໂຄ້ດ */
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
/** ຄຳຖາມຕໍ່ຄົນຕໍ່ນາທີ — ກັນຄ່າໃຊ້ຈ່າຍ/ໂຄຕ້າບານປາຍ */
const ASK_PER_MINUTE = 20;
/** ຖ້າ Gemini ບໍ່ຕອບພາຍໃນເວລານີ້ ⇒ ຕັດ (ບໍ່ດັ່ງນັ້ນຄຳຖາມດຽວຄ້າງ connection ໄວ້ຕະຫຼອດ) */
const TIMEOUT_MS = 60_000;
/** ດຶງຂໍ້ມູນໄດ້ສູງສຸດຈັກຮອບຕໍ່ 1 ຄຳຖາມ — ກັນ loop ບໍ່ຮູ້ຈົບ */
const MAX_TURNS = 4;

export const NO_KEY = "ຍັງບໍ່ໄດ້ຕັ້ງ GEMINI_API_KEY ໃຫ້ຖືກຕ້ອງ — ຕິດຕໍ່ຜູ້ດູແລລະບົບ (ລອງໃໝ່ກໍ່ບໍ່ຊ່ວຍ)";

/**
 * ລາຍການຂັ້ນຕອນທີ່ບອກ AI — **ສ້າງຈາກ STAGE_LABEL ບ່ອນດຽວ**.
 * ແຕ່ກ່ອນພິມໄວ້ໃນ prompt ເອງ ⇒ ພໍປ່ຽນເລກຂັ້ນ (ເຊັ່ນ ຕອນເພີ່ມຂັ້ນ QC) prompt ຈະ
 * ຄ້າງຢູ່ເລກເກົ່າ ແລ້ວ **AI ຈະຕອບຊື່ຂັ້ນຜິດຢ່າງໝັ້ນໃຈ** ໂດຍບໍ່ມີ error ໃຫ້ເຫັນ.
 */
const STAGE_LIST = Object.entries(STAGE_LABEL)
  .filter(([stage]) => Number(stage) > 0)
  .map(([stage, label]) => `${stage} ${label}`)
  .join(", ");

const SYSTEM = `You are the read-only ODSS service assistant. Answer in Lao unless the user asks for another language.
Use tools for every claim about jobs, ERP stock, or SLA; never guess operational data.
You have no write capability. Never claim you created, changed, approved, cancelled, purchased, dispatched, or completed anything.
Technicians can only see their own jobs; tool results are already access-scoped and must not be bypassed.
Keep answers concise. Include job codes, exact stage names, stock warehouse/location, SLA hours and overdue status when relevant.
If no record is returned, say it was not found in the accessible data. Do not invent customer, stock, or status facts.
Repair stages: ${STAGE_LIST}`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});
const bodySchema = z.object({ messages: z.array(messageSchema).min(1).max(12) });

/** ນິຍາມເຄື່ອງມືກາງ → ຮູບແບບ Gemini (schema ສົ່ງດິບ — ເບິ່ງເຫດຜົນຢູ່ຫົວໄຟລ໌) */
const TOOLS = [
  {
    functionDeclarations: ASSISTANT_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.input_schema,
    })),
  },
];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Session ໝົດອາຍຸ" }, { status: 401 });
  if (!assistantReady()) return NextResponse.json({ error: NO_KEY }, { status: 503 });

  // ໃຊ້ຕົວຈຳກັດກາງ (lib/rate-limit) — ແຕ່ກ່ອນໄຟລ໌ນີ້ຂຽນ bucket ຂອງຕົນເອງຊ້ຳໄວ້
  if (!rateLimit(`assistant:${session.username}`, ASK_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "ຖາມຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ 1 ນາທີ" }, { status: 429 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "ຂໍ້ຄວາມບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // role ຂອງ AI ຢູ່ Gemini ຄື "model" — ສົ່ງ "assistant" ໄປຈະບໍ່ຜ່ານ
  const contents: Content[] = body.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  try {
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM,
          tools: TOOLS,
          maxOutputTokens: 4096,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });

      const calls = response.functionCalls ?? [];
      if (!calls.length) {
        return NextResponse.json({ answer: response.text?.trim() || "ບໍ່ສາມາດສະຫຼຸບຄຳຕອບໄດ້" });
      }

      // ສົ່ງ turn ຂອງ AI ຄືນທັງກ້ອນ ບໍ່ດັ່ງນັ້ນຮອບຕໍ່ໄປຈະບໍ່ຮູ້ວ່າມັນເອີ້ນເຄື່ອງມືຫຍັງໄປ
      const modelParts = response.candidates?.[0]?.content?.parts;
      if (modelParts?.length) contents.push({ role: "model", parts: modelParts });

      const results: Part[] = [];
      for (const call of calls) {
        const result = await executeAssistantTool(session, call.name ?? "", call.args ?? {});
        results.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            // ຕ້ອງເປັນ object — ຜົນຂອງເຄື່ອງມືທຸກຕົວຫໍ່ array ໄວ້ໃນ key ຢູ່ແລ້ວ
            response: result as Record<string, unknown>,
          },
        });
      }
      contents.push({ role: "user", parts: results });
    }
    return NextResponse.json({ error: "AI ເອີ້ນຂໍ້ມູນຫຼາຍຮອບເກີນກຳນົດ" }, { status: 422 });
  } catch (error) {
    console.error("ODSS assistant failed", error);
    /**
     * ບອກໄປຕາມເຫດ: ບັນຫາການຕັ້ງຄ່າ (401/403) ຫຼື ຮຸ່ນ AI ບໍ່ມີ (404) **ລອງໃໝ່ບໍ່ຊ່ວຍ**
     * ⇒ ຢ່າບອກໃຫ້ລອງໃໝ່. ສະເພາະຂັດຂ້ອງຊົ່ວຄາວ (429/5xx/ເນັດ) ຈຶ່ງບອກໃຫ້ລອງໃໝ່.
     */
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json({ error: NO_KEY }, { status: 503 });
      }
      if (error.status === 404) {
        return NextResponse.json(
          { error: `ບໍ່ພົບຮຸ່ນ AI "${MODEL}" — ກວດ GEMINI_MODEL (ລອງໃໝ່ກໍ່ບໍ່ຊ່ວຍ)` },
          { status: 503 },
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "ໂຄຕ້າ Gemini ເຕັມ — ລໍສັກໜ້ອຍແລ້ວລອງໃໝ່ (ແພັກຟຣີຈຳກັດຕໍ່ນາທີ ແລະ ຕໍ່ມື້)" },
          { status: 429 },
        );
      }
      if (error.status === 400) {
        return NextResponse.json(
          { error: "ຄຳຂໍໄປຫາ AI ບໍ່ຖືກຕ້ອງ — ຜູ້ດູແລລະບົບເບິ່ງ log ຂອງ server (ລອງໃໝ່ກໍ່ບໍ່ຊ່ວຍ)" },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ error: "AI ຕອບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" }, { status: 502 });
  }
}
