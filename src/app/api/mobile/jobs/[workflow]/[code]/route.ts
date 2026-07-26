import type { Workflow } from "@/lib/commission";
import {
  acceptInstall,
  acceptRepair,
  bringRepairToCenter,
  checkIn,
  checkOut,
  finishInstallFlow,
  finishRepairFlow,
  jobPhotoSets,
  ownMobileJob,
  rejectJob,
  startInstallFlow,
  startRepairFlow,
  type FlowResult,
} from "@/lib/job-flow";
import { undoLastStep } from "@/lib/mobile-undo";
import {
  acceptMaintenance,
  finishMaintenance,
  ownMaintenanceJob,
  startMaintenance,
} from "@/lib/maintenance-flow";
import { MAX_PHOTO_CHARS, requireMobile } from "@/lib/mobile-auth";
import { repairTimeline } from "@/lib/repair-timeline";
import { TECH_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * ຄຳສັ່ງທັງໝົດຂອງຊ່າງຈາກແອັບ — ຜ່ານ route ດຽວ ດ້ວຍ `action` ໃນ body.
 *
 * ⚠️ ຕົວປ່ຽນຂັ້ນຢູ່ lib/job-flow ບ່ອນດຽວ (ໃຊ້ຮ່ວມກັບເວັບ) — route ນີ້ເປັນພຽງທາງເຂົ້າ.
 * ຢ່າຂຽນ SQL ປ່ຽນຂັ້ນຢູ່ນີ້ ບໍ່ດັ່ງນັ້ນແອັບຈະຂ້າມເງື່ອນໄຂຂັ້ນທີ່ເວັບກວດໄວ້.
 */
type Body = {
  action: "accept" | "reject" | "start" | "finish" | "checkin" | "checkout" | "bring-in" | "undo";
  /** bring-in: ວິທີເອົາເຄື່ອງເຂົ້າສູນ — carry=ຊ່າງເອົາກັບພ້ອມ · pickup=ຂົນສົ່ງມາຮັບ (ຄ່າເລີ່ມ) */
  mode?: "carry" | "pickup";
  reason?: string;
  note?: string;
  lat?: number;
  lng?: number;
  photo?: string;
  /** ຮູບຜົນງານຕອນຈົບງານ — ບັງຄັບຝັ່ງຕິດຕັ້ງ (ເບິ່ງ lib/job-flow) */
  photos?: string[];
};

/**
 * ຮູບຂອງງານ (ຕອນຮັບເຄື່ອງ · ຕອນກວດເຊັກ · ຕອນສ້ອມ/ຕິດຕັ້ງສຳເລັດ) — ໃຫ້ໜ້າລາຍລະອຽດແອັບສະແດງ.
 * ຮູບເປັນ data-URI base64 ທັງໝົດ (ຮັບເຄື່ອງອ່ານຈາກໄຟລ໌ແປງໃຫ້) ⇒ ແອັບ render ດ້ວຍ Image.memory ທາງດຽວ.
 */
export async function GET(request: Request, context: { params: Promise<{ workflow: string; code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { workflow: raw, code } = await context.params;
  if (raw !== "install" && raw !== "repair") {
    return NextResponse.json({ error: "ສາຍງານບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }
  const workflow = raw as Workflow;

  const ownership = await ownMobileJob(guard.user, workflow, code);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: 403 });

  try {
    // ເສັ້ນເວລາ (ໄລຍະແຕ່ລະຂັ້ນ) — ສະເພາະສາຍງານສ້ອມ (ຄືກັບ web /service/[code])
    const [photos, timeline] = await Promise.all([
      jobPhotoSets(workflow, code),
      workflow === "repair" ? repairTimeline(code) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      photos,
      timeline: timeline
        ? {
            cancelled_at: timeline.cancelledAt,
            steps: timeline.steps.map((s) => ({
              stage: s.stage,
              label: s.label,
              at: s.at,
              duration_seconds: s.durationSeconds,
              state: s.state,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error("Mobile job detail failed", error);
    return NextResponse.json({ error: "ໂຫຼດລາຍລະອຽດບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ workflow: string; code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { workflow: raw, code } = await context.params;

  /**
   * ── ບຳລຸງຮັກສາ (ລ້າງແອ) ──
   * ຂັ້ນຕອນຕ່າງຈາກ ສ້ອມ/ຕິດຕັ້ງ (ບໍ່ມີອາໄຫຼ່ · ບໍ່ມີ check-in) ⇒ ແຍກ flow ຂອງມັນເອງ
   * (lib/maintenance-flow) ແທນການຍັດເງື່ອນໄຂເພີ່ມເຂົ້າ lib/job-flow.
   */
  if (raw === "maintenance") {
    let action = "";
    try {
      action = String(((await request.json()) as { action?: string }).action ?? "");
    } catch {
      return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
    }
    const own = await ownMaintenanceJob(guard.user, code);
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });

    const result =
      action === "accept"
        ? await acceptMaintenance(guard.user, code)
        : action === "start"
          ? await startMaintenance(guard.user, code)
          : action === "finish"
            ? await finishMaintenance(guard.user, code)
            : ({ ok: false, error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" } as const);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    for (const path of ["/maintenance", "/dashboard"]) revalidatePath(path);
    return NextResponse.json({ ok: true, message: result.message });
  }

  if (raw !== "install" && raw !== "repair") {
    return NextResponse.json({ error: "ສາຍງານບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }
  const workflow = raw as Workflow;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  const photos = (body.photos ?? []).filter(Boolean);
  const tooBig = [body.photo ?? "", ...photos].some((photo) => photo.length > MAX_PHOTO_CHARS);
  if (tooBig) {
    return NextResponse.json({ error: "ຮູບໃຫຍ່ເກີນໄປ — ກະລຸນາຖ່າຍໃໝ່" }, { status: 413 });
  }
  if (photos.length > 6) {
    return NextResponse.json({ error: "ແນບຮູບໄດ້ສູງສຸດ 6 ຮູບ" }, { status: 413 });
  }

  const user = guard.user;
  let result: FlowResult;

  try {
    const ownership = await ownMobileJob(user, workflow, code);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: 403 });
    }

    switch (body.action) {
      case "accept":
        result =
          workflow === "install"
            ? await acceptInstall(user, code)
            : await acceptRepair(user, code);
        break;
      case "reject":
        result = await rejectJob(user, workflow, code, String(body.reason ?? ""));
        break;
      case "start":
        // ແອັບ = ຊ່າງຢູ່ໜ້າງານ ⇒ **ບັງຄັບ check-in** (ຝັ່ງເວັບບໍ່ບັງຄັບ — ເບິ່ງ lib/job-flow)
        result =
          workflow === "install"
            ? await startInstallFlow(user, code, { requireCheckin: true })
            : await startRepairFlow(user, code, { requireCheckin: true });
        break;
      case "finish":
        result =
          workflow === "install"
            ? await finishInstallFlow(user, code, photos)
            : await finishRepairFlow(user, code, String(body.note ?? ""), photos);
        break;
      case "checkin":
        result = await checkIn(user, workflow, code, {
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          photo: body.photo ?? null,
          note: body.note ?? "",
        });
        break;
      case "checkout":
        result = await checkOut(user, workflow, code, {
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          note: body.note ?? "",
        });
        break;
      case "bring-in":
        // IH ສ້ອມໜ້າງານບໍ່ໄດ້ ⇒ ນຳເຂົ້າສູນ (ແປງ IH→PS). ສະເພາະສາຍງານສ້ອມ.
        if (workflow !== "repair") {
          return NextResponse.json({ error: "ຄຳສັ່ງນີ້ໃຊ້ໄດ້ແຕ່ງານສ້ອມ" }, { status: 400 });
        }
        result = await bringRepairToCenter(
          user,
          code,
          String(body.reason ?? ""),
          body.mode === "carry" ? "carry" : "pickup",
        );
        break;
      case "undo":
        // ຖອຍຫຼັງ 1 ຂັ້ນ — ສະເພາະສາຍງານສ້ອມ (ຝັ່ງຕິດຕັ້ງ/ບຳລຸງ ຍັງບໍ່ຮອງຮັບ)
        if (workflow !== "repair") {
          return NextResponse.json({ error: "ຄຳສັ່ງນີ້ໃຊ້ໄດ້ແຕ່ງານສ້ອມ" }, { status: 400 });
        }
        result = await undoLastStep(user, code);
        break;
      default:
        return NextResponse.json({ error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" }, { status: 400 });
    }
  } catch (error) {
    console.error("Mobile job action failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // ໜ້າເວັບຕ້ອງເຫັນຜົນຂອງແອັບທັນທີ (ຄິວຂອງ CS · ສາງ · QC ອ່ານຈາກຖັນດຽວກັນ)
  for (const path of [
    "/dashboard",
    "/installations",
    "/installations/accept",
    "/installations/work",
    "/repair",
    "/qc",
    "/dashboard/status/repair/picking-up",
    "/dashboard/status/repair/wait-schedule",
  ]) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, message: result.message });
}
