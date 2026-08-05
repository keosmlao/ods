import { isCheckOutcome } from "@/lib/check-outcome";
import { MAX_PHOTO_CHARS, requireMobile } from "@/lib/mobile-auth";
import { TECH_SIDE } from "@/lib/roles";
import { ownMobileJob } from "@/lib/job-flow";
import {
  addDraftSpare,
  draftSpares,
  removeDraftSpare,
  saveCheckFlow,
  startCheckFlow,
} from "@/lib/tech-flow";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * ກວດເຊັກ (ຝັ່ງສ້ອມ) ຈາກແອັບ — ເລີ່ມກວດ · ກະຕ່າອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້ · ບັນທຶກຜົນ.
 *
 * ກົດເກນທັງໝົດຢູ່ lib/tech-flow ບ່ອນດຽວ (ອັນດຽວກັບໜ້າ /checking ຂອງເວັບ) —
 * ຢ່າຂຽນ SQL ຢູ່ນີ້ ບໍ່ດັ່ງນັ້ນແອັບຈະຂ້າມເງື່ອນໄຂຂັ້ນ ຫຼື ຍ້າຍກະຕ່າອາໄຫຼ່ຜິດ.
 */
type Body =
  | { action: "start" }
  | { action: "add_spare"; item: { code: string; name_1: string; unit_code: string | null }; qty: number }
  | { action: "remove_spare"; roworder: number }
  | {
      action: "save";
      diagnosis: string;
      warranty_void: boolean;
      warranty_reason: string;
      use_spare: boolean;
      /** ຈົບໂດຍບໍ່ສ້ອມ ⇒ ຄືນເຄື່ອງ (ຍື່ນຄຳຂໍໃຫ້ — ເບິ່ງ lib/tech-flow) */
      cannot_repair?: boolean;
      cannot_repair_reason?: string;
      /**
       * ຈົບໂດຍບໍ່ສ້ອມ **ຍ້ອນຫຍັງ** — 'cannot_repair' | 'replace_advice' (ເບິ່ງ lib/check-outcome).
       * ບໍ່ສົ່ງມາ = 'cannot_repair' ⇒ **ແອັບລຸ້ນເກົ່າເຮັດວຽກຄືເກົ່າທຸກປະການ**.
       */
      check_outcome?: string;
      /** ຮູບຕອນກວດເຊັກ (base64) — ບໍ່ບັງຄັບ */
      photos?: string[];
    };

/** ກະຕ່າອາໄຫຼ່ຂອງໃບນີ້ (ຂອງຊ່າງຄົນນີ້) */
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { code } = await context.params;
  const own = await ownMobileJob(guard.user, "repair", code);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });

  return NextResponse.json({ draft: await draftSpares(guard.user, code) });
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { code } = await context.params;
  // ຊ່າງແຕະໄດ້ແຕ່ວຽກຂອງຕົນ (ກົດເກນອັນດຽວກັບເວັບ)
  const own = await ownMobileJob(guard.user, "repair", code);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  try {
    const result =
      body.action === "start"
        ? await startCheckFlow(guard.user, code)
        : body.action === "add_spare"
          ? await addDraftSpare(guard.user, code, body.item, Number(body.qty) || 1)
          : body.action === "remove_spare"
            ? await removeDraftSpare(guard.user, code, Number(body.roworder))
            : body.action === "save"
              ? await (async () => {
                  const photos = (body.photos ?? []).filter(Boolean);
                  if (photos.some((p) => p.length > MAX_PHOTO_CHARS)) {
                    return { ok: false as const, error: "ຮູບໃຫຍ່ເກີນໄປ — ກະລຸນາຖ່າຍໃໝ່" };
                  }
                  if (photos.length > 6) {
                    return { ok: false as const, error: "ແນບຮູບໄດ້ສູງສຸດ 6 ຮູບ" };
                  }
                  return saveCheckFlow(guard.user, {
                    code,
                    diagnosis: String(body.diagnosis ?? ""),
                    warranty_void: Boolean(body.warranty_void),
                    warranty_reason: String(body.warranty_reason ?? ""),
                    use_spare: Boolean(body.use_spare),
                    // ສ້ອມບໍ່ໄດ້ ⇒ ຄືນເຄື່ອງ (ຍື່ນຄຳຂໍຍົກເລີກໃຫ້ — ເບິ່ງ lib/tech-flow)
                    cannot_repair: Boolean(body.cannot_repair),
                    cannot_repair_reason: String(body.cannot_repair_reason ?? ""),
                    outcome: isCheckOutcome(body.check_outcome) ? body.check_outcome : undefined,
                    photos,
                  });
                })()
              : { ok: false as const, error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" };

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    for (const path of ["/checking", `/checking/${code}`, "/repair", "/dashboard"]) revalidatePath(path);
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Mobile check action failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
