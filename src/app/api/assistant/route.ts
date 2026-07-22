import { assistantReady, ASSISTANT_TOOLS, executeAssistantTool } from "@/lib/ai-assistant-tools";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { STAGE_LABEL } from "@/lib/stage";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * **AI ຜູ້ຊ່ວຍວຽກ — ອ່ານຢ່າງດຽວ, ຕອບຈາກຂໍ້ມູນຈິງເທົ່ານັ້ນ.**
 *
 * ── ໃຊ້ Groq (OpenAI-compatible, 22-07-2026) ──
 * ປ່ຽນຈາກ Gemini ມາໃຊ້ endpoint ແບບ **OpenAI chat/completions** (Groq ຟຣີ ໄວ):
 *   `LOCAL_AI_BASE_URL` (https://api.groq.com/openai/v1) · `LOCAL_AI_API_KEY` · `LOCAL_AI_MODEL`.
 * ຮັບ endpoint OpenAI-compatible ອື່ນກໍ່ໄດ້ (local llama.cpp, vLLM…) ໂດຍປ່ຽນແຕ່ env.
 *
 * ── ຄຳສັບ OpenAI ທີ່ຕ່າງຈາກ Gemini ──
 *   `system` ເປັນ message role "system" ໃນ array ນຳ · role ຂອງ AI ຄື **"assistant"**
 *   · ເຄື່ອງມືຢູ່ `tools[].function` · ການເອີ້ນເຄື່ອງມືຢູ່ `message.tool_calls[]`
 *   (`function.arguments` ເປັນ **string JSON** — ຕ້ອງ parse) · ຜົນສົ່ງກັບເປັນ message
 *   role "tool" ພ້ອມ `tool_call_id`.
 *
 * ນິຍາມເຄື່ອງມືຍັງຢູ່ບ່ອນດຽວ (lib/ai-assistant-tools) — route ເປັນຄົນແປງເປັນຮູບແບບ OpenAI.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** endpoint + ຮຸ່ນ — ຕັ້ງຜ່ານ env ເພື່ອປ່ຽນຜູ້ໃຫ້ບໍລິການ/ຮຸ່ນໂດຍບໍ່ຕ້ອງແກ້ໂຄ້ດ */
const BASE_URL = (process.env.LOCAL_AI_BASE_URL || "").replace(/\/+$/, "");
const MODEL = process.env.LOCAL_AI_MODEL || "llama-3.3-70b-versatile";
const API_KEY = process.env.LOCAL_AI_API_KEY || "";
/** ຄຳຖາມຕໍ່ຄົນຕໍ່ນາທີ — ກັນຄ່າໃຊ້ຈ່າຍ/ໂຄຕ້າບານປາຍ */
const ASK_PER_MINUTE = 20;
/** ຖ້າ AI ບໍ່ຕອບພາຍໃນເວລານີ້ ⇒ ຕັດ (ບໍ່ດັ່ງນັ້ນຄຳຖາມດຽວຄ້າງ connection ໄວ້ຕະຫຼອດ) */
const TIMEOUT_MS = 60_000;
/** ດຶງຂໍ້ມູນໄດ້ສູງສຸດຈັກຮອບຕໍ່ 1 ຄຳຖາມ — ກັນ loop ບໍ່ຮູ້ຈົບ */
const MAX_TURNS = 4;

export const NO_KEY = "ຍັງບໍ່ໄດ້ຕັ້ງ LOCAL_AI_API_KEY / LOCAL_AI_BASE_URL ໃຫ້ຖືກຕ້ອງ — ຕິດຕໍ່ຜູ້ດູແລລະບົບ (ລອງໃໝ່ກໍ່ບໍ່ຊ່ວຍ)";

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

/** ນິຍາມເຄື່ອງມືກາງ → ຮູບແບບ OpenAI (`function.parameters` = JSON Schema ດິບ) */
const TOOLS = ASSISTANT_TOOLS.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}));

/** ໜຶ່ງ message ໃນ array ຂອງ OpenAI (system/user/assistant/tool) */
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
};

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

  // OpenAI ໃຊ້ role "assistant"/"user" ກົງໆ (ບໍ່ຕ້ອງແປງເປັນ "model" ຄື Gemini) + system ນຳໜ້າ
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...body.messages.map((message) => ({ role: message.role, content: message.content })),
  ];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0,
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("ODSS assistant upstream failed", response.status, detail.slice(0, 500));
        /**
         * ບອກໄປຕາມເຫດ: ບັນຫາການຕັ້ງຄ່າ (401/403) ຫຼື ຮຸ່ນ AI ບໍ່ມີ (404) **ລອງໃໝ່ບໍ່ຊ່ວຍ**
         * ⇒ ຢ່າບອກໃຫ້ລອງໃໝ່. ສະເພາະຂັດຂ້ອງຊົ່ວຄາວ (429/5xx/ເນັດ) ຈຶ່ງບອກໃຫ້ລອງໃໝ່.
         */
        if (response.status === 401 || response.status === 403) {
          return NextResponse.json({ error: NO_KEY }, { status: 503 });
        }
        if (response.status === 404) {
          return NextResponse.json(
            { error: `ບໍ່ພົບຮຸ່ນ AI "${MODEL}" — ກວດ LOCAL_AI_MODEL (ລອງໃໝ່ກໍ່ບໍ່ຊ່ວຍ)` },
            { status: 503 },
          );
        }
        if (response.status === 429) {
          return NextResponse.json(
            { error: "ໂຄຕ້າ AI ເຕັມ — ລໍສັກໜ້ອຍແລ້ວລອງໃໝ່ (ແພັກຟຣີຈຳກັດຕໍ່ນາທີ ແລະ ຕໍ່ມື້)" },
            { status: 429 },
          );
        }
        if (response.status === 400 || response.status === 422) {
          return NextResponse.json(
            { error: "ຄຳຂໍໄປຫາ AI ບໍ່ຖືກຕ້ອງ — ຜູ້ດູແລລະບົບເບິ່ງ log ຂອງ server (ລອງໃໝ່ກໍ່ບໍ່ຊ່ວຍ)" },
            { status: 503 },
          );
        }
        return NextResponse.json({ error: "AI ຕອບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" }, { status: 502 });
      }

      const data = await response.json();
      const aiMessage = data?.choices?.[0]?.message as ChatMessage | undefined;
      const calls = aiMessage?.tool_calls ?? [];

      if (!calls.length) {
        return NextResponse.json({ answer: aiMessage?.content?.trim() || "ບໍ່ສາມາດສະຫຼຸບຄຳຕອບໄດ້" });
      }

      // ສົ່ງ turn ຂອງ AI ຄືນທັງກ້ອນ ບໍ່ດັ່ງນັ້ນຮອບຕໍ່ໄປຈະບໍ່ຮູ້ວ່າມັນເອີ້ນເຄື່ອງມືຫຍັງໄປ
      messages.push({ role: "assistant", content: aiMessage?.content ?? null, tool_calls: calls });

      for (const call of calls) {
        // `function.arguments` ຂອງ OpenAI ເປັນ string JSON — parse ກ່ອນສົ່ງໃຫ້ເຄື່ອງມື
        let args: unknown = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        const result = await executeAssistantTool(session, call.function.name, args);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    return NextResponse.json({ error: "AI ເອີ້ນຂໍ້ມູນຫຼາຍຮອບເກີນກຳນົດ" }, { status: 422 });
  } catch (error) {
    console.error("ODSS assistant failed", error);
    // timeout / ເນັດຂັດຂ້ອງ = ຊົ່ວຄາວ ⇒ ບອກໃຫ້ລອງໃໝ່
    return NextResponse.json({ error: "AI ຕອບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" }, { status: 502 });
  }
}
