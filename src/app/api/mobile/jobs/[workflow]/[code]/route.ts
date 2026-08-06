import type { Workflow } from "@/lib/commission";
import {
  acceptInstall,
  acceptRepair,
  bringRepairToCenter,
  checkIn,
  checkOut,
  finishInstallFlow,
  finishRepairFlow,
  handoverInstallFlow,
  jobPhotoSets,
  ownMobileJob,
  rejectJob,
  scheduleNextVisit,
  startInstallFlow,
  startRepairFlow,
  type FlowResult,
} from "@/lib/job-flow";
import { deliveryFor } from "@/lib/delivery";
import { undoLastStep } from "@/lib/mobile-undo";
import {
  acceptMaintenance,
  finishMaintenance,
  ownMaintenanceJob,
  startMaintenance,
} from "@/lib/maintenance-flow";
import { installTimeline } from "@/lib/install-timeline";
import { openLoaners } from "@/lib/loaner";
import { maintenanceTimeline } from "@/lib/maintenance-timeline";
import { MAX_PHOTO_CHARS, requireMobile } from "@/lib/mobile-auth";
import { nextActor } from "@/lib/repair-next-action";
import { repairTimeline, type TimelineStep } from "@/lib/repair-timeline";
import { TECH_SIDE } from "@/lib/roles";
import { STAGE_SQL } from "@/lib/stage";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * ຄຳສັ່ງທັງໝົດຂອງຊ່າງຈາກແອັບ — ຜ່ານ route ດຽວ ດ້ວຍ `action` ໃນ body.
 *
 * ⚠️ ຕົວປ່ຽນຂັ້ນຢູ່ lib/job-flow ບ່ອນດຽວ (ໃຊ້ຮ່ວມກັບເວັບ) — route ນີ້ເປັນພຽງທາງເຂົ້າ.
 * ຢ່າຂຽນ SQL ປ່ຽນຂັ້ນຢູ່ນີ້ ບໍ່ດັ່ງນັ້ນແອັບຈະຂ້າມເງື່ອນໄຂຂັ້ນທີ່ເວັບກວດໄວ້.
 */
type Body = {
  action:
    | "accept"
    | "reject"
    | "start"
    | "finish"
    | "checkin"
    | "checkout"
    | "bring-in"
    | "next-visit"
    | "handover"
    | "undo";
  /** bring-in: ວິທີເອົາເຄື່ອງເຂົ້າສູນ — carry=ຊ່າງເອົາກັບພ້ອມ · pickup=ຂົນສົ່ງມາຮັບ (ຄ່າເລີ່ມ) */
  mode?: "carry" | "pickup";
  reason?: string;
  note?: string;
  lat?: number;
  lng?: number;
  photo?: string;
  /** next-visit: ວັນນັດເຂົ້າຮອບຕໍ່ໄປ (YYYY-MM-DD) — ງານຕິດຕັ້ງທີ່ຮອບນີ້ຍັງບໍ່ຈົບ */
  next_date?: string;
  /** handover: ລະຫັດຊ່າງຄົນໃໝ່ທີ່ຈະຮັບຊ່ວງ */
  tech_code?: string;
  /** ຮູບຜົນງານຕອນຈົບງານ — ບັງຄັບຝັ່ງຕິດຕັ້ງ (ເບິ່ງ lib/job-flow) */
  photos?: string[];
  client_action_id?: string;
};

/**
 * ຮູບຂອງງານ (ຕອນຮັບເຄື່ອງ · ຕອນກວດເຊັກ · ຕອນສ້ອມ/ຕິດຕັ້ງສຳເລັດ) — ໃຫ້ໜ້າລາຍລະອຽດແອັບສະແດງ.
 * ຮູບເປັນ data-URI base64 ທັງໝົດ (ຮັບເຄື່ອງອ່ານຈາກໄຟລ໌ແປງໃຫ້) ⇒ ແອັບ render ດ້ວຍ Image.memory ທາງດຽວ.
 */
/** ແປງເສັ້ນເວລາ → payload snake_case ໃຫ້ແອັບ (ຮູບແບບດຽວກັນທຸກສາຍງານ) */
function timelinePayload(timeline: { steps: TimelineStep[]; cancelledAt: string | null }) {
  return {
    cancelled_at: timeline.cancelledAt,
    steps: timeline.steps.map((s) => ({
      stage: s.stage,
      label: s.label,
      at: s.at,
      duration_seconds: s.durationSeconds,
      state: s.state,
    })),
  };
}

export async function GET(request: Request, context: { params: Promise<{ workflow: string; code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { workflow: raw, code } = await context.params;

  try {
    // ── ບຳລຸງຮັກສາ (ລ້າງແອ): ownership + timeline ຂອງມັນເອງ · ຮູບໃຊ້ຄ່າວ່າງ (ບໍ່ຜູກ Workflow) ──
    if (raw === "maintenance") {
      const own = await ownMaintenanceJob(guard.user, code);
      if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });
      return NextResponse.json({
        photos: { receive: [], check: [], finish: [] },
        timeline: timelinePayload(await maintenanceTimeline(code)),
      });
    }

    if (raw !== "install" && raw !== "repair") {
      return NextResponse.json({ error: "ສາຍງານບໍ່ຖືກຕ້ອງ" }, { status: 400 });
    }
    const workflow = raw as Workflow;

    const ownership = await ownMobileJob(guard.user, workflow, code);
    if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: 403 });

    // ເສັ້ນເວລາ (ໄລຍະແຕ່ລະຂັ້ນ) — ສ້ອມ ແລະ ຕິດຕັ້ງ (ຄິດຈາກຖັນຂອງແຕ່ລະຕາຕະລາງ)
    const [photos, timeline] = await Promise.all([
      jobPhotoSets(workflow, code),
      workflow === "repair" ? repairTimeline(code) : installTimeline(code),
    ]);

    /**
     * **ຂໍ້ມູນການສົ່ງເຄື່ອງ** (ສະເພາະງານຕິດຕັ້ງ) — ຊ່າງຢູ່ໜ້າງານຕ້ອງການທີ່ສຸດ:
     * ພິກັດຈຸດທີ່ຂົນສົ່ງເອົາເຄື່ອງໄປວາງ (ນຳທາງໄປໄດ້ເລີຍ) ແລະ ເບີຄົນຮັບເຄື່ອງຈິງ.
     * ຄືນ **ຈຳນວນຮູບ** ບໍ່ແມ່ນຮູບ — ຮູບເປັນ base64 100-200KB ⇒ ໂຫຼດຜ່ານ
     * /api/installations/delivery ຕອນຊ່າງກົດເບິ່ງເທົ່ານັ້ນ (ຢູ່ໜ້າງານເນັດຊ້າ).
     */
    let delivery = null;
    if (workflow === "install") {
      const bill = (
        await query<{ doc_ref_1: string | null }>(
          "select doc_ref_1 from ods_tb_install where code=$1 limit 1",
          [code],
        )
      ).rows[0]?.doc_ref_1;
      delivery = await deliveryFor(bill);
    }

    /**
     * **ເຄື່ອງສຳຮອງທີ່ຍັງບໍ່ຄືນ** (ສະເພາະງານສ້ອມ) — ຊ່າງທີ່ໄປສົ່ງເຄື່ອງຄືນເຖິງບ້ານ
     * ຄືຄົນທີ່ຕ້ອງເອົາໜ່ວຍສຳຮອງກັບມາ. ບໍ່ບອກຢູ່ແອັບ = ໄປຮອດແລ້ວຈຶ່ງຮູ້ ຫຼື ລືມເລີຍ
     * (ດ່ານປິດງານຢູ່ເວັບຈະຫ້າມພາຍຫຼັງ — ຊ້າໄປແລ້ວ). ອ່ານຢ່າງດຽວ: ໃຫ້ຢືມ/ຮັບຄືນ
     * ຍັງເປັນວຽກຝັ່ງບໍລິການ (lib/loaner · actions/loaner).
     */
    const loaners =
      workflow === "repair"
        ? (await openLoaners(code)).map((row) => ({
            item_name: row.item_name,
            isn: row.isn,
            days: row.days,
          }))
        : [];

    /**
     * **"ຕອນນີ້ລໍໃຜເຮັດ" + ສະຖານະອາໄຫຼ່** (ສະເພາະງານສ້ອມ) — ຄິດດ້ວຍ lib/repair-next-action
     * ຕົວດຽວກັບເວັບ: ອາໄຫຼ່ນິຍາມລະດັບແຖວ (status=5 + arrive_at) ບໍ່ແມ່ນທຸງລະດັບວຽກ.
     * ຊ່າງເຫັນວ່າວຽກຂອງຕົນຄ້າງຢູ່ໃຜ — ບໍ່ຕ້ອງໂທຖາມ CS.
     */
    let nextAction: ReturnType<typeof nextActor> = null;
    let spares: { pending: number; on_order: number; arrived: number } | null = null;
    if (workflow === "repair") {
      const [jobRow, spareRow] = await Promise.all([
        query<{ stage: number; service_type: string | null }>(
          `select (${STAGE_SQL})::int stage, nullif(a.service_type,'') service_type
             from tb_product a where a.code = $1`,
          [code],
        ).then((result) => result.rows[0] ?? null),
        query<{ pending: number; on_order: number; arrived: number }>(
          `select count(*) filter (where coalesce(status,0) = ${LINE_STATUS.PENDING})::int pending,
              count(*) filter (where status = ${LINE_STATUS.ON_PURCHASE_ORDER} and arrive_at is null)::int on_order,
              count(*) filter (where status = ${LINE_STATUS.ON_PURCHASE_ORDER} and arrive_at is not null)::int arrived
            from ic_trans_detail where product_code = $1 and trans_flag = ${TRANS.REQUEST}`,
          [code],
        ).then((result) => result.rows[0] ?? { pending: 0, on_order: 0, arrived: 0 }),
      ]);
      spares = spareRow;
      if (jobRow) {
        nextAction = nextActor(
          jobRow.stage,
          { pending: spareRow.pending, onOrder: spareRow.on_order, arrived: spareRow.arrived },
          jobRow.service_type,
        );
      }
    }

    return NextResponse.json({
      photos,
      timeline: timelinePayload(timeline),
      delivery,
      loaners,
      next_actor: nextAction
        ? {
            actor: nextAction.actor,
            actor_label: nextAction.actorLabel,
            label: nextAction.label,
            action: nextAction.action,
          }
        : null,
      spares,
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

  const requestId = String(body.client_action_id ?? "").trim().slice(0, 100);
  const photos = (body.photos ?? []).filter(Boolean);
  const tooBig = [body.photo ?? "", ...photos].some((photo) => photo.length > MAX_PHOTO_CHARS);
  if (tooBig) {
    if (requestId) await query("delete from ods_mobile_action_request where request_id=$1", [requestId]);
    return NextResponse.json({ error: "ຮູບໃຫຍ່ເກີນໄປ — ກະລຸນາຖ່າຍໃໝ່" }, { status: 413 });
  }
  if (photos.length > 6) {
    if (requestId) await query("delete from ods_mobile_action_request where request_id=$1", [requestId]);
    return NextResponse.json({ error: "ແນບຮູບໄດ້ສູງສຸດ 6 ຮູບ" }, { status: 413 });
  }

  const user = guard.user;
  let result: FlowResult;

  try {
    const ownership = await ownMobileJob(user, workflow, code);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: 403 });
    }
    if (requestId) {
      const previous = await query<{ response: { message?: string } | null }>(
        `select response from ods_mobile_action_request where request_id=$1 and username=$2`,
        [requestId, guard.user.username],
      );
      if (previous.rows[0]?.response) {
        return NextResponse.json({ ok: true, ...previous.rows[0].response });
      }
      const claimed = await query(
        `insert into ods_mobile_action_request(request_id,username,workflow,job_code)
         values($1,$2,$3,$4) on conflict do nothing returning request_id`,
        [requestId, guard.user.username, raw, code],
      );
      if (!claimed.rowCount) {
        return NextResponse.json({ error: "ຄຳສັ່ງນີ້ກຳລັງດຳເນີນ — ກະລຸນາລອງໃໝ່" }, { status: 409 });
      }
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
      case "next-visit":
        // 1 ໃບງານ = ຫຼາຍຮອບເຂົ້າໜ້າງານ — ຮອບນີ້ຍັງບໍ່ຈົບ ⇒ ນັດວັນກັບໄປ (ສະເພາະຕິດຕັ້ງ)
        if (workflow !== "install") {
          return NextResponse.json({ error: "ຄຳສັ່ງນີ້ໃຊ້ໄດ້ແຕ່ງານຕິດຕັ້ງ" }, { status: 400 });
        }
        result = await scheduleNextVisit(user, code, {
          next_date: String(body.next_date ?? ""),
          reason: String(body.reason ?? ""),
        });
        break;
      case "handover":
        /*
          ຊ່າງທີ່ຢູ່ໜ້າງານຮູ້ດີທີ່ສຸດວ່າຕ້ອງສົ່ງໃຫ້ໃຜຕໍ່ (ຕົນລາພັກ · ຍ້າຍງານດ່ວນ).
          ດ່ານ ownMobileJob ຂ້າງເທິງບັງຄັບວ່າຕ້ອງເປັນງານຂອງຕົນຢູ່ແລ້ວ ⇒ ສົ່ງມອບໄດ້
          ສະເພາະງານທີ່ຕົນຖືຢູ່. ຝັ່ງເວັບເປັນຝ່າຍບໍລິການ/ຫົວໜ້າ (ຄົນລະດ່ານ ຈຸດປະສົງດຽວກັນ).
        */
        if (workflow !== "install") {
          return NextResponse.json({ error: "ຄຳສັ່ງນີ້ໃຊ້ໄດ້ແຕ່ງານຕິດຕັ້ງ" }, { status: 400 });
        }
        result = await handoverInstallFlow(user, code, String(body.tech_code ?? ""), String(body.reason ?? ""));
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
    if (requestId) await query("delete from ods_mobile_action_request where request_id=$1", [requestId]);
    console.error("Mobile job action failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }

  if (!result.ok) {
    if (requestId) await query("delete from ods_mobile_action_request where request_id=$1", [requestId]);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // ໜ້າເວັບຕ້ອງເຫັນຜົນຂອງແອັບທັນທີ (ຄິວຂອງ CS · ສາງ · QC ອ່ານຈາກຖັນດຽວກັນ)
  for (const path of [
    "/dashboard",
    "/installations",
    "/installations/accept",
    "/installations/work",
    "/repair",
    "/qc",
    "/work/repair/picking-up",
    "/work/repair/wait-schedule",
  ]) {
    revalidatePath(path);
  }

  if (requestId) {
    await query(
      `update ods_mobile_action_request
          set response=jsonb_build_object('message',$2::text), completed_at=localtimestamp(0)
        where request_id=$1`,
      [requestId, result.message],
    );
    await query(
      `delete from ods_mobile_action_request
        where completed_at < localtimestamp - interval '30 days'`,
    );
  }
  return NextResponse.json({ ok: true, message: result.message });
}
