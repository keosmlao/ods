import type { Session } from "@/lib/auth";
import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import type { FlowResult } from "@/lib/job-flow";
import { MAINTENANCE_STAGE_SQL } from "@/lib/maintenance-stage";
import { roleOf } from "@/lib/roles";

/**
 * ຂັ້ນຕອນງານ **ບຳລຸງຮັກສາ (ລ້າງແອ)** ທີ່ຊ່າງລົງມືຈາກແອັບ.
 *
 * ຄູ່ກັບ lib/job-flow (ສ້ອມ/ຕິດຕັ້ງ) — ຫຼັກການດຽວກັນ:
 * **ເງື່ອນໄຂຂັ້ນຢູ່ໃນ WHERE ເອງ** ⇒ ຍິງຄຳສັ່ງໃສ່ວຽກທີ່ບໍ່ໄດ້ຢູ່ຂັ້ນນັ້ນ = ບໍ່ມີຫຍັງເກີດຂຶ້ນ
 * ແລະ ສອງເຄື່ອງກົດພ້ອມກັນກໍ່ບໍ່ຊ້ຳ. ຂັ້ນ: 1 ລໍຊ່າງຮັບ · 2 ລໍໄປລ້າງ · 3 ກຳລັງລ້າງ.
 */

const NOW = "localtimestamp(0)";
const MODEL = "ods_tb_maintenance";

/** ຊ່າງແຕະໄດ້ແຕ່ວຽກຂອງຕົນ (ຫົວໜ້າ/ຜູ້ຈັດການແຕະໄດ້ໝົດ) — ຄືກົດເກນຂອງສ້ອມ/ຕິດຕັ້ງ */
export async function ownMaintenanceJob(session: Session, code: string): Promise<FlowResult> {
  const row = (
    await query<{ tech: string | null; cancelled: boolean }>(
      `select nullif(emp_code,'') as tech, cancel_date is not null as cancelled
         from ${MODEL} where code = $1`,
      [code],
    )
  ).rows[0];
  if (!row) return { ok: false, error: "ບໍ່ພົບງານນີ້" };
  if (row.cancelled) return { ok: false, error: "ງານນີ້ຖືກຍົກເລີກແລ້ວ" };
  if (roleOf(session) === "technical" && (row.tech ?? "") !== session.username) {
    return { ok: false, error: "ງານນີ້ບໍ່ແມ່ນຂອງທ່ານ" };
  }
  return { ok: true, message: "" };
}

/** ຄຳສັ່ງດຽວ: stamp ຖັນເວລາ ຖ້າວຽກຢູ່ຂັ້ນທີ່ຖືກຕ້ອງ */
async function advance(
  session: Session,
  code: string,
  column: "tech_confirm" | "start_clean" | "finish_clean",
  stage: number,
  log: string,
  message: string,
): Promise<FlowResult> {
  const own = await ownMaintenanceJob(session, code);
  if (!own.ok) return own;

  const done = await query(
    `update ${MODEL} a set ${column} = ${NOW}
      where a.code = $1 and a.${column} is null and (${MAINTENANCE_STAGE_SQL}) = ${stage}`,
    [code],
  );
  if (!done.rowCount) {
    return { ok: false, error: `ບັນທຶກບໍ່ໄດ້ — ງານບໍ່ໄດ້ຢູ່ຂັ້ນທີ່ຄາດໄວ້ ຫຼື ເຮັດໄປແລ້ວ` };
  }

  // ຜູ້ຈັດການຕ້ອງເຫັນທຸກການເຄື່ອນໄຫວ — ສົ່ງຊື່ຊ່າງເປັນ author ເພາະຄຳສັ່ງມາຈາກແອັບ (ບໍ່ມີ cookie)
  await logChange(MODEL, code, log, { author: session.username, roles: ["admin", "manager"] });
  return { ok: true, message };
}

export const acceptMaintenance = (session: Session, code: string) =>
  advance(session, code, "tech_confirm", 1, "ຊ່າງຮັບງານບຳລຸງຮັກສາ", `ຮັບງານ ${code} ສຳເລັດ`);

export const startMaintenance = (session: Session, code: string) =>
  advance(session, code, "start_clean", 2, "ເລີ່ມລ້າງ", `ເລີ່ມລ້າງ ${code}`);

export const finishMaintenance = (session: Session, code: string) =>
  advance(session, code, "finish_clean", 3, "ລ້າງສຳເລັດ — ລໍຖ້າກວດ QC", `ລ້າງ ${code} ສຳເລັດ — ລໍ QC`);

/* ── check-in / check-out ໜ້າງານ (ບຳລຸງຮັກສາ) — 07-08-2026 ─────────────────
 *
 * ວຽກລ້າງແອ **ເປັນວຽກໜ້າງານ 100%** ແຕ່ເມື່ອກ່ອນບໍ່ມີການບັນທຶກວ່າຊ່າງໄປຮອດຈິງບໍ
 * (ຕ່າງຈາກຕິດຕັ້ງ/ສ້ອມ IH ທີ່ບັງຄັບຢູ່ແລ້ວ) ⇒ ກົດເກນ "ທຸກຄັ້ງທີ່ເຂົ້າໜ້າງານຕ້ອງມີ
 * check-in/check-out" ຍັງບໍ່ຄົບ. ໃຊ້ຕາຕະລາງ `ods_job_checkin` ອັນດຽວກັບສາຍງານອື່ນ
 * (workflow='maintenance') ⇒ ລາຍງານ /reports/site-visits ນັບໃຫ້ເອງ.
 *
 * ⚠️ ຂຽນຢູ່ໄຟລ໌ນີ້ (ບໍ່ແມ່ນ lib/job-flow) ເພາະ `Workflow` ຂອງ job-flow ຜູກກັບ
 * ຄ່າຄອມ (lib/commission) ທີ່ມີແຕ່ install|repair — ຢ່າຂະຫຍາຍ type ນັ້ນເພື່ອເລື່ອງນີ້.
 */

const CHECKIN_WF = "maintenance";

/** check-in ຮອບທຳອິດ = **ເລີ່ມລ້າງ** (ຫຼັກການດຽວກັບຕິດຕັ້ງ ແລະ ສ້ອມ IH) */
export async function checkInMaintenance(
  session: Session,
  code: string,
  input: { lat?: number | null; lng?: number | null; photo?: string | null; note?: string },
): Promise<FlowResult> {
  const own = await ownMaintenanceJob(session, code);
  if (!own.ok) return own;
  if (!input.photo) return { ok: false, error: "ຕ້ອງຖ່າຍຮູບໜ້າງານກ່ອນ check-in" };

  const stage = (
    await query<{ stage: number }>(
      `select (${MAINTENANCE_STAGE_SQL})::int stage from ${MODEL} where code = $1`,
      [code],
    )
  ).rows[0]?.stage;
  // ຂັ້ນ 2 ລໍໄປລ້າງ · 3 ກຳລັງລ້າງ (ຮອບຕໍ່ໄປ) — ນອກນັ້ນຍັງບໍ່ແມ່ນເວລາໄປໜ້າງານ
  if (stage !== 2 && stage !== 3) return { ok: false, error: "ຂັ້ນປັດຈຸບັນຍັງບໍ່ສາມາດ check-in ໄດ້" };

  const done = await query(
    `insert into ods_job_checkin(workflow, job_code, tech_code, checkin_lat, checkin_lng, checkin_photo, note)
     values($1,$2,$3,$4,$5,nullif($6,''),nullif($7,''))
     on conflict do nothing`,
    [CHECKIN_WF, code, session.username, input.lat ?? null, input.lng ?? null, input.photo ?? "", input.note ?? ""],
  );
  if (!done.rowCount) return { ok: false, error: "ທ່ານ check-in ງານນີ້ຢູ່ແລ້ວ" };

  // ໄປຮອດແລ້ວ = ລົງມືແລ້ວ ⇒ ບໍ່ຕ້ອງກົດ "ເລີ່ມລ້າງ" ອີກປຸ່ມ (ຮອບທຳອິດເທົ່ານັ້ນ)
  if (stage === 2) {
    await query(
      `update ${MODEL} a set start_clean = ${NOW}
        where a.code = $1 and a.start_clean is null and (${MAINTENANCE_STAGE_SQL}) = 2`,
      [code],
    );
  }

  await logChange(
    MODEL,
    code,
    `ຊ່າງ check-in ໜ້າງານ${input.lat != null && input.lng != null ? ` (${input.lat.toFixed(5)}, ${input.lng.toFixed(5)})` : ""}` +
      (stage === 2 ? " — ເລີ່ມລ້າງ" : ""),
    { author: session.username, roles: ["admin", "manager"] },
  );
  return { ok: true, message: stage === 2 ? "check-in ສຳເລັດ — ເລີ່ມລ້າງແລ້ວ" : "check-in ສຳເລັດ" };
}

export async function checkOutMaintenance(
  session: Session,
  code: string,
  input: { lat?: number | null; lng?: number | null; note?: string },
): Promise<FlowResult> {
  const done = await query(
    `update ods_job_checkin
        set checkout_at=${NOW}, checkout_lat=$4, checkout_lng=$5, note = coalesce(nullif($6,''), note)
      where workflow=$1 and job_code=$2 and tech_code=$3 and checkout_at is null`,
    [CHECKIN_WF, code, session.username, input.lat ?? null, input.lng ?? null, input.note ?? ""],
  );
  if (!done.rowCount) return { ok: false, error: "ບໍ່ພົບການ check-in ທີ່ຄ້າງຢູ່" };

  await logChange(MODEL, code, "ຊ່າງ check-out ຈາກໜ້າງານ", {
    author: session.username,
    roles: ["admin", "manager"],
  });
  return { ok: true, message: "check-out ສຳເລັດ" };
}

/** ຈົບງານລ້າງ (ຈາກແອັບ) — ຕ້ອງມີ check-in ເປີດຢູ່ ແລ້ວປິດໃຫ້ອັດຕະໂນມັດ */
export async function finishMaintenanceOnsite(session: Session, code: string): Promise<FlowResult> {
  const open = (
    await query<{ n: number }>(
      `select count(*)::int n from ods_job_checkin
        where workflow=$1 and job_code=$2 and tech_code=$3 and checkout_at is null`,
      [CHECKIN_WF, code, session.username],
    )
  ).rows[0];
  if (!open?.n) return { ok: false, error: "ຕ້ອງ check-in ໜ້າງານກ່ອນ ຈຶ່ງບັນທຶກລ້າງສຳເລັດໄດ້" };

  const result = await finishMaintenance(session, code);
  if (!result.ok) return result;

  // ຈົບງານ ⇒ checkout ອັດຕະໂນມັດ (ຄືກັບ ຕິດຕັ້ງ/ສ້ອມ)
  await query(
    `update ods_job_checkin set checkout_at=${NOW}
      where workflow=$1 and job_code=$2 and tech_code=$3 and checkout_at is null`,
    [CHECKIN_WF, code, session.username],
  );
  return result;
}

/**
 * **ຮອບນີ້ຍັງບໍ່ຈົບ — ນັດເຂົ້າຮອບຕໍ່ໄປ** (ບຳລຸງຮັກສາ) — ຄູ່ກັບ ຕິດຕັ້ງ/ສ້ອມ IH.
 *
 * ລ້າງແອບໍ່ຈົບໃນຮອບດຽວກໍ່ມີ (ນ້ຳບໍ່ມາ · ລູກຄ້າຂໍເລື່ອນ · ຕ້ອງລໍເຄື່ອງແຫ້ງ) ⇒ ຕ້ອງມີ
 * ທາງນັດກັບໄປ ໂດຍບໍ່ຕ້ອງກົດ "ລ້າງສຳເລັດ" ຫຼອກ. ກົດເກນດຽວກັບສາຍງານອື່ນ:
 *   ① ຕ້ອງມີຮອບຄົບຄູ່ຢ່າງໜ້ອຍ 1 (ໄປຮອດຈິງ) ② ຕ້ອງ check-out ອອກກ່ອນ
 * ງານຄາຢູ່ຂັ້ນເດີມ (ບໍ່ແຕະ finish_clean) ⇒ ບໍ່ນັບວ່າຈົບ ແລະ ບໍ່ໄປ QC.
 */
export async function scheduleNextVisitMaintenance(
  session: Session,
  code: string,
  input: { next_date: string; reason: string; closeOpenVisit?: boolean },
): Promise<FlowResult> {
  const own = await ownMaintenanceJob(session, code);
  if (!own.ok) return own;

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "ກະລຸນາໃສ່ເຫດຜົນ ວ່າຍັງບໍ່ຈົບຍ້ອນຫຍັງ" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.next_date)) return { ok: false, error: "ກະລຸນາເລືອກວັນນັດຮອບຕໍ່ໄປ" };

  const stage = (
    await query<{ stage: number }>(
      `select (${MAINTENANCE_STAGE_SQL})::int stage from ${MODEL} where code = $1`,
      [code],
    )
  ).rows[0]?.stage;
  if (stage !== 2 && stage !== 3) return { ok: false, error: "ຂັ້ນປັດຈຸບັນຂອງງານນີ້ ຍັງນັດຮອບຕໍ່ໄປບໍ່ໄດ້" };

  const visits = (
    await query<{ open: number; closed: number }>(
      `select count(*) filter (where checkout_at is null)::int open,
          count(*) filter (where checkout_at is not null)::int closed
         from ods_job_checkin where workflow=$1 and job_code=$2`,
      [CHECKIN_WF, code],
    )
  ).rows[0];
  if (!visits?.closed && !visits?.open) {
    return { ok: false, error: "ຮອບນີ້ຍັງບໍ່ມີ check-in — ຕ້ອງ check-in ໜ້າງານ ແລ້ວ check-out ອອກກ່ອນ" };
  }
  if (visits?.open) {
    // ຝັ່ງເວັບປິດໃຫ້ໄດ້ (ຊ່າງລືມກົດ) — ຝັ່ງແອັບ check-out ເອງກ່ອນຢູ່ແລ້ວ
    if (!input.closeOpenVisit) {
      return {
        ok: false,
        error: "ຊ່າງຍັງ check-in ຄ້າງຢູ່ໜ້າງານ — ໃຫ້ຊ່າງກົດ check-out ໃນແອັບ ຫຼື ໝາຍຊ່ອງ “ຊ່າງລືມກົດ check-out”",
      };
    }
    await query(
      `update ods_job_checkin set checkout_at=${NOW}
        where workflow=$1 and job_code=$2 and checkout_at is null`,
      [CHECKIN_WF, code],
    );
  }

  const done = await query(
    `update ${MODEL} a set appoint_date=$2::date
      where a.code=$1 and (${MAINTENANCE_STAGE_SQL}) in (2,3)`,
    [code, input.next_date],
  );
  if (!done.rowCount) return { ok: false, error: "ບັນທຶກບໍ່ໄດ້ — ຂັ້ນຂອງງານປ່ຽນໄປແລ້ວ" };

  await logChange(MODEL, code, `ຮອບນີ້ຍັງບໍ່ຈົບ — ນັດເຂົ້າຮອບຕໍ່ໄປ ${input.next_date} · ${reason}`, {
    author: session.username,
    roles: ["admin", "manager"],
  });
  return { ok: true, message: `ນັດເຂົ້າຮອບຕໍ່ໄປ ${input.next_date} ແລ້ວ` };
}
