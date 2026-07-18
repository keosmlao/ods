"use server";
import { logChange } from "@/lib/chatter-log";
import { getSession, type Session } from "@/lib/auth";
import { query } from "@/lib/db";
import { acceptRepair, finishRepairFlow, startRepairFlow } from "@/lib/job-flow";
import { requireRole } from "@/lib/guard";
import { pushToUser } from "@/lib/push";
import { roleOf, SERVICE_SIDE, TECH_SIDE } from "@/lib/roles";
import { TRANS } from "@/lib/stock-constants";
import { STAGE_SQL } from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/** ຖອດແບບຈາກ ods/repair.py: start_repair, show_repar, save_rp */

/** ods ໃຊ້ເວລາ Asia/Bangkok (UTC+7) */
const NOW = "timezone('Asia/Bangkok', now())::timestamp(0)";

/**
 * **ອອກໄປຮັບ** (PS) — CS/ຝ່າຍບໍລິການ ໝາຍວ່າຂົນສົ່ງອອກເດີນທາງໄປຮັບເຄື່ອງບ້ານລູກຄ້າແລ້ວ.
 * ວຽກຍ້າຍຈາກ "ລໍໄປຮັບເຄື່ອງ" (pickup_start null) → "ກຳລັງໄປຮັບ" (pickup_start ໝາຍ) — ຍັງຢູ່ຂັ້ນ 0.
 */
export async function dispatchPickup(code: string): Promise<{ ok?: string; error?: string }> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດໝາຍອອກໄປຮັບ");
  if (!guard.ok) return { error: guard.error };

  const res = await query(
    `update tb_product set pickup_start = ${NOW}
      where code = $1 and coalesce(service_type,'') = 'PS'
        and pickup_at is null and pickup_start is null`,
    [code],
  );
  if (!res.rowCount) return { error: "ບໍ່ພົບວຽກ PS ທີ່ລໍໄປຮັບ (ອາດອອກໄປຮັບ ຫຼື ຮັບເຂົ້າສູນແລ້ວ)" };

  await logChange("tb_product", code, "ອອກໄປຮັບເຄື່ອງ (PS) — ຂົນສົ່ງເດີນທາງໄປບ້ານລູກຄ້າ");
  revalidatePath("/dashboard/status/repair/wait-pickup");
  revalidatePath("/dashboard/status/repair/picking-up");
  revalidatePath("/dashboard");
  revalidatePath(`/service/${code}`);
  return { ok: "ໝາຍອອກໄປຮັບແລ້ວ — ວຽກຍ້າຍໄປ ກຳລັງໄປຮັບ" };
}

/**
 * **ຍົກເລີກອອກໄປຮັບ** (PS) — ໝາຍຜິດໃບ ໃຫ້ຖອນຄືນ. ວຽກກັບໄປ "ລໍໄປຮັບເຄື່ອງ".
 */
export async function undoDispatchPickup(code: string): Promise<{ ok?: string; error?: string }> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດຍົກເລີກອອກໄປຮັບ");
  if (!guard.ok) return { error: guard.error };

  const res = await query(
    `update tb_product set pickup_start = null
      where code = $1 and coalesce(service_type,'') = 'PS' and pickup_at is null`,
    [code],
  );
  if (!res.rowCount) return { error: "ຍົກເລີກບໍ່ໄດ້ — ວຽກຮັບເຂົ້າສູນແລ້ວ ຫຼື ບໍ່ແມ່ນ PS" };

  await logChange("tb_product", code, 'ຍົກເລີກ "ອອກໄປຮັບ" (PS) — ວຽກກັບໄປ ລໍໄປຮັບເຄື່ອງ');
  revalidatePath("/dashboard/status/repair/wait-pickup");
  revalidatePath("/dashboard/status/repair/picking-up");
  revalidatePath("/dashboard");
  revalidatePath(`/service/${code}`);
  return { ok: "ຍົກເລີກອອກໄປຮັບແລ້ວ" };
}

/**
 * **ຮັບເຄື່ອງເຂົ້າສູນ** (PS) — ຂົນສົ່ງໄປຮັບເຄື່ອງບ້ານລູກຄ້າມາຮອດສູນ, CS ກົດຢືນຢັນ.
 *
 * PS (service_type='PS') ຢູ່ຂັ້ນ 0 "ລໍໄປຮັບເຄື່ອງ" ຈົນກວ່າ pickup_at ຖືກໝາຍ ⇒ ຈາກນັ້ນ
 * ເຂົ້າຂັ້ນ 1 "ລໍຖ້າກວດເຊັກ" ຄືວຽກສ້ອມທົ່ວໄປ ແລະ ເລີ່ມນັບໃນສະຕ໋ອກສູນ. ສິດ = ຝ່າຍ CS/ບໍລິການ.
 */
export async function receivePickup(code: string): Promise<{ ok?: string; error?: string }> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດຮັບເຄື່ອງເຂົ້າສູນ");
  if (!guard.ok) return { error: guard.error };

  // ໝາຍສະເພາະ PS ທີ່ຍັງບໍ່ຮັບ (pickup_at null) — ກັນກົດຊ້ຳ/ກົດຜິດປະເພດ
  const res = await query(
    `update tb_product set pickup_at = ${NOW}
      where code = $1 and coalesce(service_type,'') = 'PS' and pickup_at is null`,
    [code],
  );
  if (!res.rowCount) return { error: "ບໍ່ພົບວຽກ PS ທີ່ລໍໄປຮັບ (ອາດຮັບເຂົ້າສູນແລ້ວ)" };

  await logChange("tb_product", code, "ຮັບເຄື່ອງເຂົ້າສູນ (PS) — ໄປຮັບບ້ານລູກຄ້າມາຮອດສູນ");
  revalidatePath("/dashboard/status/repair/wait-pickup");
  revalidatePath("/dashboard/status/repair/picking-up");
  revalidatePath("/dashboard/status/repair/wait-check");
  revalidatePath("/dashboard");
  revalidatePath(`/service/${code}`);
  revalidatePath("/service");
  return { ok: "ຮັບເຄື່ອງເຂົ້າສູນແລ້ວ — ວຽກຍ້າຍໄປ ລໍຖ້າກວດເຊັກ" };
}

export type RepairState = { error?: string; ok?: string };
export type UndoState = { error?: string };

/* ── ການແກ້ໄຂຂໍ້ຜິດພາດ (undo) — ກົດເກນດຽວກັນກັບ actions/checking.ts ──
 *
 * ໃບສະເໜີລາຄາ = ic_trans 17 · ໃບຮັບເງິນ = ic_trans 44
 * (ໃບຂໍເບີກ 122 / ໃບເບີກ 56 ຢູ່ໃນ TRANS ຂອງ lib/stock-constants ແລ້ວ)
 */
const QUOTE = 17;
const INVOICE = 44;

type JobSnapshot = {
  code: string;
  status: number | null;
  emp_code: string | null;
  warrunty: string | null;
  used_spare: number;
  time_repair: Date | null;
  time_finish_repair: Date | null;
  qc_finish: Date | null;
  return_complete: Date | null;
  quote_doc: string | null;
  invoice_doc: string | null;
  dispatch_doc: string | null;
  stage: number;
};

const JOB_SQL = `select a.code, a.status, a.emp_code, a.warrunty, coalesce(a.used_spare,0)::int used_spare,
    a.time_repair, a.time_finish_repair, a.qc_finish, a.return_complete,
    (${STAGE_SQL})::int stage,
    (select t.doc_no from ic_trans t where t.trans_flag=${QUOTE} and t.product_code=a.code order by t.doc_no limit 1) quote_doc,
    (select t.doc_no from ic_trans t where t.trans_flag=${INVOICE} and t.product_code=a.code order by t.doc_no limit 1) invoice_doc,
    (select d.doc_no from ic_trans_detail d where d.trans_flag=${TRANS.DISPATCH} and d.product_code=a.code order by d.doc_no limit 1) dispatch_doc
  from tb_product a where a.code=$1 limit 1`;

/**
 * ສະຖານະທີ່ຄວນເປັນຫຼັງ "ຈົບການກວດເຊັກ" — ສູດດຽວກັນກັບ saveCheck() ຂອງ actions/checking.ts.
 * ໃຊ້ຕອນຖອນຄືນ "ຈົບການສ້ອມແປງ" (saveRepair ຕັ້ງ status=5 = ລໍຖ້າສົ່ງຄືນ) ໃຫ້ກັບຄືນທີ່ເກົ່າ.
 */
const POST_CHECK_STATUS = `case
  when coalesce(used_spare,0)=1 then (case when warrunty='ຮັບປະກັນ' then 3 else 2 end)
  else (case when warrunty='ຮັບປະກັນ' then 4 else 2 end)
end`;

/** ດຶງພາບລວມ + ກວດສິດ — ຊ່າງຖອນຄືນໄດ້ສະເພາະວຽກຂອງຕົນເອງ */
async function loadJob(
  code: string,
): Promise<{ ok: true; job: JobSnapshot; session: Session } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session ໝົດອາຍຸ" };
  const role = roleOf(session);
  if (!TECH_SIDE.includes(role)) return { ok: false, error: "ບໍ່ມີສິດແກ້ໄຂຂັ້ນຕອນຂອງຊ່າງ" };

  const job = (await query<JobSnapshot>(JOB_SQL, [code])).rows[0];
  if (!job) return { ok: false, error: "ບໍ່ພົບໃບຮັບເຄື່ອງ" };
  if (role === "technical" && (job.emp_code ?? "") !== session.username) {
    return { ok: false, error: "ວຽກນີ້ບໍ່ແມ່ນຂອງທ່ານ — ຖອນຄືນບໍ່ໄດ້" };
  }
  return { ok: true, job, session };
}

/** ຂັ້ນທີ່ຍ້ອນກັບບໍ່ໄດ້ — ເອກະສານເງິນ ຫຼື ເຄື່ອງອອກຈາກມືໄປແລ້ວ */
function blockedBy(job: JobSnapshot): string | null {
  if (job.return_complete) return "ສົ່ງເຄື່ອງຄືນລູກຄ້າໄປແລ້ວ — ຖອນຄືນບໍ່ໄດ້";
  if (job.invoice_doc) return `ອອກໃບຮັບເງິນ ${job.invoice_doc} ໄປແລ້ວ — ຖອນຄືນບໍ່ໄດ້`;
  if (job.status === 6) return "ໃບນີ້ຢູ່ໃນຂັ້ນຕອນຍົກເລີກ — ໃຫ້ຖອນຄຳຂໍຍົກເລີກກ່ອນ";
  return null;
}

/**
 * ອາໄຫຼ່ແຖວນີ້ຍັງ "ບໍ່ທັນເຂົ້າເອກະສານ" ບໍ — ຄືຍັງບໍ່ມີໃບຂໍເບີກ (122) ຫຼື ໃບເບີກ (56) ອ້າງເຖິງ.
 *
 * ແຕ່ກ່ອນກັນດ້ວຍ pick_finish ຢ່າງດຽວ ແຕ່ວຽກສ້ອມບໍ່ເຄີຍມີໃຜ stamp pick_finish ເລີຍ
 * (0/3,384 ແຖວ) ⇒ ການປ້ອງກັນບໍ່ເຄີຍເຮັດວຽກ ແລະ ຊ່າງລຶບ/ແກ້ອາໄຫຼ່ທີ່ສາງເບີກອອກໄປແລ້ວໄດ້
 * ເຊິ່ງເຮັດໃຫ້ກະຕ່າກັບເອກະສານສາງບໍ່ຕົງກັນ. ດຽວນີ້ອີງໃສ່ບັນຊີເອກະສານໂດຍກົງ
 * ຈຶ່ງກັນໄດ້ຈິງ ລວມທັງຂໍ້ມູນເກົ່າ.
 */
const NOT_ON_DOC = `pick_finish is null and not exists (
    select 1 from ic_trans_detail d
    where d.product_code = tb_used_spare.product_code and d.item_code = tb_used_spare.item_code
      and d.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}))`;

/* ── ເລີ່ມສ້ອມແປງ (start_repair) ────────────────────────────────── */

/**
 * ເລີ່ມສ້ອມແປງ — ຕ້ອງຢູ່ຂັ້ນ 8 (ລໍຖ້າສ້ອມແປງ) ຈິງໆ.
 *
 * ແຕ່ກ່ອນກວດແຕ່ "login ຢູ່ບໍ" ແລ້ວຂຽນ time_repair ລົງໄປເລີຍ. ອັນຕະລາຍເພາະ
 * STAGE_SQL (lib/stage) ອ່ານ **time_repair ກ່ອນ** spare_reg/spare_finish ⇒ ຍິງ action ນີ້
 * ໃສ່ວຽກຂັ້ນ 5 (ລໍຖ້າຂໍເບີກອາໄຫຼ່) ວຽກຈະ **ໂດດໄປຂັ້ນ 9 ທັນທີ ຂ້າມການເບີກອາໄຫຼ່ທັງໝົດ**
 * ໂດຍບໍ່ມີ error ຈັກຂໍ້ — ອາໄຫຼ່ບໍ່ເຄີຍຖືກເບີກ ແຕ່ວຽກຂຶ້ນວ່າ "ກຳລັງສ້ອມແປງ".
 *
 * ດຽວນີ້ເງື່ອນໄຂຂັ້ນຢູ່ໃນ WHERE ເອງ (ໃຊ້ STAGE_SQL ອັນດຽວກັບທັງລະບົບ) ⇒ ນອກຂັ້ນ 8
 * ບໍ່ມີຫຍັງເກີດຂຶ້ນ, ກົດຊ້ຳກໍ່ບໍ່ຂຽນທັບ (ບໍ່ຣີເຊັດໂມງ) ແລະ ສອງຄົນກົດພ້ອມກັນກໍ່ບໍ່ຊ້ຳ.
 */
export async function startRepair(code: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const loaded = await loadJob(code); // ສິດຝ່າຍຊ່າງ + ຕ້ອງເປັນວຽກຂອງຕົນ
  if (!loaded.ok) redirect("/forbidden");

  // ຕົວປ່ຽນຂັ້ນຢູ່ lib/job-flow ບ່ອນດຽວ — ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ (ເງື່ອນໄຂຂັ້ນ 8 ຢູ່ໃນ WHERE)
  await startRepairFlow(session, code);
  revalidatePath("/repair");
  redirect("/repair");
}

/**
 * ເລີ່ມສ້ອມແປງ **ຈາກໜ້າລາຍລະອຽດ** — ຄື startRepair ແຕ່ບໍ່ redirect ອອກຈາກໜ້າ
 * ແລະ ສົ່ງ error ກັບໄປສະແດງ (startRepair ຖິ້ມຜົນຂອງ flow ແລ້ວ redirect ໄປ list
 * ⇒ ໃຊ້ຢູ່ໜ້າລາຍລະອຽດບໍ່ໄດ້: ກົດແລ້ວເດັ້ງໜີ ແລະ ຜິດພາດກໍ່ບໍ່ມີໃຜເຫັນ).
 */
export async function startRepairStay(code: string): Promise<RepairState> {
  const session = await getSession();
  if (!session) return { error: "ກະລຸນາເຂົ້າສູ່ລະບົບ" };
  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };

  const result = await startRepairFlow(session, code);
  if (!result.ok) return { error: result.error };
  revalidatePath("/repair");
  revalidatePath(`/repair/${code}`);
  return { ok: result.message };
}

/**
 * ຊ່າງ **ຮັບງານສ້ອມ** (repair_confirm) — ຂັ້ນ "ລໍຖ້າຊ່າງຮັບ" → ຮັບແລ້ວ.
 * ເງື່ອນໄຂ (ຕ້ອງເປັນວຽກຂອງຕົນ · ຢູ່ຂັ້ນ 1) ຢູ່ໃນ acceptRepair ຂອງ lib/job-flow ບ່ອນດຽວ
 * (ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ). ບໍ່ redirect — ໃຫ້ໜ້າສະຖານະ refresh ຢູ່ບ່ອນເກົ່າ.
 */
export async function acceptRepairJob(code: string): Promise<RepairState> {
  const session = await getSession();
  if (!session) return { error: "ກະລຸນາເຂົ້າສູ່ລະບົບ" };
  const result = await acceptRepair(session, code);
  if (!result.ok) return { error: result.error };
  revalidatePath("/repair");
  revalidatePath("/dashboard");
  return { ok: result.message };
}

/**
 * ຍົກເລີກຂັ້ນ "ຈັດຊ່າງ / ຊ່າງຮັບງານ" ກ່ອນເລີ່ມກວດເຊັກ.
 * ຮັບງານແລ້ວ -> ລ້າງ repair_confirm; ຍັງບໍ່ຮັບ -> ຖອນຊ່າງອອກຈາກງານ.
 */
export async function undoRepairAssignment(code: string): Promise<RepairState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົඔອາຍຸ" };
  const role = roleOf(session);

  const row = (
    await query<{ emp_code: string | null; accepted: boolean; started: boolean }>(
      `select nullif(emp_code,'') emp_code, repair_confirm is not null accepted, time_check is not null started
         from tb_product where code=$1`,
      [code],
    )
  ).rows[0];
  if (!row?.emp_code) return { error: "ງານນີ້ຍັງບໍ່ມີຊ່າງໃຫ້ຍົກເລີກ" };
  if (row.started) return { error: 'ເລີ່ມກວດເຊັກແລ້ວ — ໃຫ້ຍົກເລີກ "ເລີ່ມກວດເຊັກ" ກ່ອນ' };

  if (row.accepted) {
    if (!TECH_SIDE.includes(role)) return { error: "ບໍ່ມີສິດຍົກເລີກຊ່າງຮັບງານ" };
    if (role === "technical" && row.emp_code !== session.username) {
      return { error: "ວຽກນີ້ບໍ່ແມ່ນຂອງທ່ານ" };
    }
  } else if (!SERVICE_SIDE.includes(role)) {
    return { error: "ບໍ່ມີສິດຍົກເລີກການຈັດຊ່າງ" };
  }

  const updated = row.accepted
    ? await query("update tb_product set repair_confirm=null where code=$1 and time_check is null", [code])
    : await query("update tb_product set emp_code='', repair_confirm=null where code=$1 and time_check is null", [code]);
  if (!updated.rowCount) return { error: "ຍົກເລີກບໍ່ສຳເລັດ — ງານຖືກປ່ຽນໄປແລ້ວ" };

  await logChange(
    "tb_product",
    code,
    row.accepted
      ? "ຍົກເລີກຊ່າງຮັບງານ — ກັບໄປລໍຖ້າຊ່າງຮັບ"
      : "ຍົກເລີກການຈັດຊ່າງ — ກັບໄປລໍຖ້າຈັດຊ່າງ",
  );
  revalidatePath("/repair/assign");
  revalidatePath("/checking");
  revalidatePath("/dashboard");
  revalidatePath(`/service/${code}`);
  return {};
}

/* ── ຍົກເລີກ "ເລີ່ມສ້ອມແປງ" (ບໍ່ມີໃນ ods) ───────────────────────
 *
 * ລ້າງແຕ່ time_repair → ວຽກກັບໄປ "ລໍຖ້າສ້ອມແປງ" (ຂັ້ນ 8). ບໍ່ແຕະສະຕັອກເລີຍ:
 * ອາໄຫຼ່ທີ່ເບີກອອກສາງມາແລ້ວຍັງຜູກກັບວຽກຄືເກົ່າ (ຂັ້ນ 8 ກໍ່ຄືຂັ້ນທີ່ອາໄຫຼ່ພ້ອມແລ້ວ
 * ແຕ່ຍັງບໍ່ລົງມືສ້ອມ) ⇒ ບໍ່ມີການເຄື່ອນໄຫວສະຕັອກໃດຖືກກັບຄືນ ຈຶ່ງບໍ່ຕ້ອງກັນເລື່ອງອາໄຫຼ່.
 *
 * ປະຕິເສດເມື່ອ: ສ້ອມແປງຈົບໄປແລ້ວ (ໃຫ້ຖອນ "ຈົບການສ້ອມແປງ" ກ່ອນ) ຫຼື ຕິດເງື່ອນໄຂກາງ.
 */
export async function undoStartRepair(code: string): Promise<UndoState> {
  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };
  const job = loaded.job;

  if (!job.time_repair) return { error: "ໃບນີ້ຍັງບໍ່ໄດ້ເລີ່ມສ້ອມແປງ" };
  const blocker = blockedBy(job);
  if (blocker) return { error: `ຍົກເລີກ "ເລີ່ມສ້ອມແປງ" ບໍ່ໄດ້: ${blocker}` };
  if (job.time_finish_repair) {
    return { error: 'ຍົກເລີກ "ເລີ່ມສ້ອມແປງ" ບໍ່ໄດ້: ສ້ອມແປງຈົບໄປແລ້ວ — ໃຫ້ກົດ "ຍົກເລີກ ຈົບການສ້ອມແປງ" ກ່ອນ' };
  }

  const undone = await query(
    `update tb_product set time_repair=null
      where code=$1 and time_repair is not null and time_finish_repair is null
        and return_complete is null and status<>6`,
    [code],
  );
  if (!undone.rowCount) return { error: "ຖອນຄືນບໍ່ສຳເລັດ — ວຽກຖືກປ່ຽນໄປແລ້ວ" };

  await logChange("tb_product", code, 'ຍົກເລີກ "ເລີ່ມສ້ອມແປງ" — ວຽກກັບໄປ "ລໍຖ້າສ້ອມແປງ"');
  revalidatePath("/repair");
  revalidatePath(`/repair/${code}`);
  revalidatePath(`/service/${code}`);
  return {};
}

/* ── ອາໄຫຼ່ທີ່ປ່ຽນຈິງຕອນສ້ອມ (tb_used_spare) ─────────────────────
 *
 * ods ໃຫ້ຊ່າງປະກາດອາໄຫຼ່ຕັ້ງແຕ່ຂັ້ນກວດເຊັກເທົ່ານັ້ນ ແລ້ວໜ້າສ້ອມແປງເປັນແຕ່ "ອ່ານ".
 * ຄວາມຈິງແລ້ວ ພໍລົງມືສ້ອມ ອາໄຫຼ່ທີ່ຕ້ອງປ່ຽນມັກປ່ຽນໄປ ຈຶ່ງໃຫ້ແກ້ໄຂໄດ້ຢູ່ຂັ້ນນີ້ນຳ.
 * ── ໝາຍເຫດ: ແຖວທີ່ເບີກອອກສາງແລ້ວ (pick_finish) ຫ້າມແກ້ ຫຼື ລຶບ.
 */

export async function addUsedSpare(
  code: string,
  item: { code: string; name_1: string; unit_code: string | null },
  qty = 1,
) {
  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };
  if (loaded.job.stage !== 9) return { error: "ແກ້ອາໄຫຼ່ໄດ້ສະເພາະຕອນກຳລັງສ້ອມແປງ" };
  if (!Number.isFinite(qty) || qty <= 0 || qty > 9999) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  // Never trust name/unit supplied by the browser; re-read the canonical master row.
  const canonical = (
    await query<{ code: string; name_1: string; unit_code: string | null }>(
      "select code, name_1, unit_code from ic_inventory where code=$1 limit 1",
      [item.code],
    )
  ).rows[0];
  if (!canonical) return { error: "ບໍ່ພົບອາໄຫຼ່ໃນລາຍການສິນຄ້າ" };

  // ອາໄຫຼ່ຕົວດຽວກັນ ແລະ ຍັງບໍ່ໄດ້ເຂົ້າໃບຂໍເບີກ/ໃບເບີກ → ບວກຈຳນວນເຂົ້າແຖວເກົ່າ.
  // ຖ້າແຖວເກົ່າເຂົ້າເອກະສານໄປແລ້ວ ຕ້ອງແຍກເປັນແຖວໃໝ່ ບໍ່ດັ່ງນັ້ນຈຳນວນໃນກະຕ່າ
  // ຈະບໍ່ຕົງກັບໃບຂໍເບີກທີ່ອອກໄປແລ້ວ.
  // ຂັ້ນ 9 ກວດຢູ່ JS ຂ້າງເທິງແລ້ວ (loaded.job.stage) ⇒ SQL ບໍ່ຕ້ອງ guard ຊ້ຳ (ຫຼີກ INSERT..SELECT type clash)
  const merged = await query(
    `update tb_used_spare set qty = coalesce(qty,0) + $1
      where product_code=$2 and item_code=$3 and ${NOT_ON_DOC}`,
    [qty, code, canonical.code],
  );
  if (!merged.rowCount) {
    await query(
      `insert into tb_used_spare(product_code, item_code, item_name, qty, unit_code, status, create_date_time_now)
       values($1, $2, $3, $4, $5, '0', ${NOW})`,
      [code, canonical.code, canonical.name_1, qty, canonical.unit_code],
    );
  }

  // ມີອາໄຫຼ່ແລ້ວ → ໝາຍໃບນີ້ວ່າ "ໃຊ້ອາໄຫຼ່"
  await query("update tb_product set used_spare=1 where code=$1", [code]);
  await logChange("tb_product", code, `ເພີ່ມອາໄຫຼ່ທີ່ໃຊ້ສ້ອມ: ${canonical.name_1} × ${qty}`);
  revalidatePath(`/repair/${code}`);
  revalidatePath(`/service/${code}`);
  return {};
}

export async function updateUsedSpareQty(code: string, rowOrder: number, qty: number) {
  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };
  if (loaded.job.stage !== 9) return { error: "ແກ້ອາໄຫຼ່ໄດ້ສະເພາະຕອນກຳລັງສ້ອມແປງ" };
  if (!Number.isFinite(qty) || qty <= 0 || qty > 9999) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };
  const updated = await query<{ item_name: string | null }>(
    `update tb_used_spare set qty=$1 where roworder=$2 and product_code=$3 and ${NOT_ON_DOC}
       and exists (select 1 from tb_product a where a.code=$3 and (${STAGE_SQL})=9)
     returning item_name`,
    [qty, rowOrder, code],
  );
  const name = updated.rows[0]?.item_name;
  if (!name) return { error: "ອາໄຫຼ່ນີ້ເຂົ້າໃບຂໍເບີກແລ້ວ — ແກ້ຈຳນວນບໍ່ໄດ້" };
  await logChange("tb_product", code, `ແກ້ຈຳນວນອາໄຫຼ່ທີ່ໃຊ້ສ້ອມ: ${name} = ${qty}`);
  revalidatePath(`/repair/${code}`);
  revalidatePath(`/service/${code}`);
  return {};
}

export async function deleteUsedSpare(code: string, rowOrder: number) {
  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };
  if (loaded.job.stage !== 9) return { error: "ແກ້ອາໄຫຼ່ໄດ້ສະເພາະຕອນກຳລັງສ້ອມແປງ" };
  const removed = await query<{ item_name: string | null }>(
    `delete from tb_used_spare where roworder=$1 and product_code=$2 and ${NOT_ON_DOC}
       and exists (select 1 from tb_product a where a.code=$2 and (${STAGE_SQL})=9)
     returning item_name`,
    [rowOrder, code],
  );
  const name = removed.rows[0]?.item_name;
  if (!name) return { error: "ອາໄຫຼ່ນີ້ເຂົ້າໃບຂໍເບີກແລ້ວ — ລຶບບໍ່ໄດ້" };
  // ບໍ່ເຫຼືອອາໄຫຼ່ແລ້ວ → ຍົກທຸງ used_spare ລົງ
  await query(
    `update tb_product set used_spare=0
      where code=$1 and not exists (select 1 from tb_used_spare where product_code=$1)`,
    [code],
  );
  await logChange("tb_product", code, `ຖອດອາໄຫຼ່ອອກຈາກລາຍການສ້ອມ: ${name}`);
  revalidatePath(`/repair/${code}`);
  revalidatePath(`/service/${code}`);
  return {};
}

/* ── ບັນທຶກການສ້ອມແປງ (save_rp) ─────────────────────────────────── */

const saveSchema = z.object({
  pro_code: z.string().min(1),
  repair_note: z.string(),
});

export async function saveRepair(_: RepairState, formData: FormData): Promise<RepairState> {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  // ສິດຝ່າຍຊ່າງ + ຕ້ອງເປັນວຽກຂອງຕົນ (ແຕ່ກ່ອນກວດແຕ່ session)
  const loaded = await loadJob(parsed.data.pro_code);
  if (!loaded.ok) return { error: loaded.error };

  /**
   * save_rp ຂອງ ods ອັບເດດແຕ່ tb_product: status=5 (ລໍຖ້າສົ່ງຄືນ) + time_finish_repair
   * ແລະ ຖິ້ມ "ໝາຍເຫດ" ຂອງຊ່າງ (tb_product.remark ຖືກໃຊ້ເປັນເຫດຜົນຍົກເລີກໄປແລ້ວ).
   * ບ່ອນນີ້ບັນທຶກລົງຄໍລຳ repair_note ທີ່ເພີ່ມໃໝ່ — ວິທີແກ້ໄຂຂອງຊ່າງບໍ່ຫາຍອີກ.
   */
  const { pro_code: code, repair_note: note } = parsed.data;

  // ຕົວປ່ຽນຂັ້ນຢູ່ lib/job-flow ບ່ອນດຽວ (ເງື່ອນໄຂ "ຕ້ອງຢູ່ຂັ້ນ 9" ຢູ່ໃນ WHERE ຂອງມັນ)
  // — ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ ຈຶ່ງບໍ່ມີວັນປ່ຽນຂັ້ນຄົນລະແບບ.
  const result = await finishRepairFlow(loaded.session, code, note);
  if (!result.ok) return { error: result.error };

  revalidatePath("/repair");
  revalidatePath("/returns");
  redirect("/repair");
}

/* ── ຍົກເລີກ "ຈົບການສ້ອມແປງ" (ບໍ່ມີໃນ ods) ──────────────────────
 *
 * ຊ່າງກົດ "ບັນທຶກ ສ້ອມແປງສຳເລັດ" ໄວເກີນ (ຫຼື ຜິດໃບ) → ວຽກໄປໂຜ່ຢູ່ "ລໍຖ້າສົ່ງຄືນ"
 * ແລ້ວກັບມາສ້ອມຕໍ່ບໍ່ໄດ້ອີກເລີຍ. ບ່ອນນີ້ລ້າງ time_finish_repair ແລ້ວດຶງວຽກກັບມາ
 * "ກຳລັງສ້ອມແປງ" (ຂັ້ນ 9) ພ້ອມຕັ້ງ status ຄືນເປັນຄ່າຫຼັງກວດເຊັກ (saveRepair ຕັ້ງເປັນ 5).
 * ໝາຍເຫດຂອງຊ່າງ (repair_note) ຍັງຢູ່ ໃຫ້ແກ້ຕໍ່ໄດ້.
 *
 * ປະຕິເສດເມື່ອ — ໝາຍທີ່ໃຊ້ຈິງ:
 *   · ສົ່ງຄືນລູກຄ້າແລ້ວ — tb_product.return_complete (ທັງທາງອອກໃບຮັບເງິນ ແລະ ສົ່ງຄືນບໍ່ເກັບເງິນ)
 *   · ມີໃບຮັບເງິນ — ic_trans.trans_flag=44 (ເອກະສານເງິນ ຫ້າມກັບຄືນງຽບໆ)
 *   · ຢູ່ໃນຂັ້ນຕອນຍົກເລີກ — tb_product.status=6
 */
export async function undoFinishRepair(code: string): Promise<UndoState> {
  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };
  const job = loaded.job;

  if (!job.time_finish_repair) return { error: "ໃບນີ້ຍັງບໍ່ໄດ້ບັນທຶກ ສ້ອມແປງສຳເລັດ" };
  if (job.qc_finish) {
    return { error: 'ຍົກເລີກ "ສ້ອມແປງສຳເລັດ" ບໍ່ໄດ້: QC ຜ່ານແລ້ວ — ໃຫ້ຍົກເລີກ "QC ຜ່ານ" ກ່ອນ' };
  }
  const blocker = blockedBy(job);
  if (blocker) return { error: `ຍົກເລີກ "ຈົບການສ້ອມແປງ" ບໍ່ໄດ້: ${blocker}` };

  const undone = await query(
    `update tb_product set time_finish_repair=null, status=(${POST_CHECK_STATUS})
      where code=$1 and time_finish_repair is not null and qc_finish is null
        and return_complete is null and status<>6`,
    [code],
  );
  if (!undone.rowCount) return { error: "ຖອນຄືນບໍ່ສຳເລັດ — ວຽກຖືກປ່ຽນໄປແລ້ວ" };

  await logChange("tb_product", code, 'ຍົກເລີກ "ຈົບການສ້ອມແປງ" — ວຽກກັບໄປ "ກຳລັງສ້ອມແປງ"');
  revalidatePath("/repair");
  revalidatePath(`/repair/${code}`);
  revalidatePath("/returns");
  revalidatePath(`/service/${code}`);
  return {};
}

/* ── ຈັດຊ່າງງານສ້ອມ (ບໍ່ມີໃນ ods) ─────────────────────────────────
 *
 * ── ຮູຮົ່ວທີ່ອຸດຢູ່ນີ້ ──
 * ຊ່າງຂອງງານສ້ອມຖືກໃສ່ **ຕອນຮັບເຄື່ອງເທົ່ານັ້ນ** (tb_product.emp_code) ແລ້ວ
 * **ປ່ຽນພາຍຫຼັງບໍ່ໄດ້ເລີຍ** — ຊ່າງລາພັກ/ລາອອກ/ຕິດງານ ⇒ ໃບນັ້ນຄ້າງຢູ່ນຳລາວຕະຫຼອດ.
 * ແລະ ງານສ້ອມ **ບໍ່ມີວັນນັດຈັກໃບ** (101/101 ໃບຄ້າງ = 0 ວັນນັດ) ທັ້ງທີ່ 75% ຕ້ອງອອກໜ້າງານ
 * ⇒ ຈັດຄິວປະຈຳວັນບໍ່ໄດ້ ແລະ ລູກຄ້າບໍ່ຮູ້ວ່າຊ່າງຈະມາມື້ໃດ.
 *
 * ດຽວນີ້ຈັດ/ປ່ຽນຊ່າງ ພ້ອມວັນນັດ ແລະ ສະຖານທີ່ໄດ້ — ຄືຝັ່ງຕິດຕັ້ງ (assignTech).
 * ⚠️ ປ່ຽນຊ່າງບໍ່ໄດ້ຫຼັງ **ຂໍເບີກອາໄຫຼ່ແລ້ວ** — ໃບເບີກອອກໃນນາມຊ່າງຄົນເກົ່າແລ້ວ
 * (ກົດເກນດຽວກັບ chooseNewTech ຂອງຝັ່ງຕິດຕັ້ງ).
 */
export async function assignRepairTech(_: RepairState, formData: FormData): Promise<RepairState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດຈັດຊ່າງ");
  if (!guard.ok) return { error: guard.error };

  const code = String(formData.get("code") ?? "");
  const tech = String(formData.get("tech_code") ?? "").trim();
  const appoint = String(formData.get("appoint_date") ?? "").trim();
  const location = String(formData.get("location_inst") ?? "").trim();
  const remark = String(formData.get("remark") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!code || !tech) return { error: "ກະລຸນາເລືອກຊ່າງ" };

  const job = (
    await query<{
      emp_code: string | null;
      spare_reg: string | null;
      service_type: string | null;
      done: boolean;
      cancelled: boolean;
    }>(
      `select nullif(emp_code,'') as emp_code, spare_reg, service_type,
          (return_complete is not null) as done, (cancel_start is not null) as cancelled
        from tb_product where code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) return { error: "ບໍ່ພົບໃບຮັບເຄື່ອງນີ້" };
  if (job.cancelled) return { error: "ໃບນີ້ຖືກຍົກເລີກແລ້ວ" };
  if (job.done) return { error: "ໃບນີ້ສົ່ງຄືນລູກຄ້າແລ້ວ" };
  // IH ໄປສ້ອມບ້ານລູກຄ້າ = ຕ້ອງມີວັນນັດ (ຈຸດປະສົງຂອງ "ນັດ+ຈັດຊ່າງ") — ບໍ່ດັ່ງນັ້ນລູກຄ້າບໍ່ຮູ້ຊ່າງມາມື້ໃດ
  if (job.service_type === "IH" && !appoint) return { error: "ກະລຸນາໃສ່ວັນນັດໝາຍໄປສ້ອມ" };
  // ຂໍເບີກແລ້ວ = ເອກະສານອອກໃນນາມຊ່າງຄົນເກົ່າ ⇒ ປ່ຽນຄົນບໍ່ໄດ້ (ບໍ່ດັ່ງນັ້ນອາໄຫຼ່ບໍ່ມີເຈົ້າຂອງ)
  if (job.spare_reg && job.emp_code && job.emp_code !== tech) {
    return { error: "ປ່ຽນຊ່າງບໍ່ໄດ້ — ມີໃບຂໍເບີກອາໄຫຼ່ໃນນາມຊ່າງຄົນເກົ່າແລ້ວ" };
  }

  // ປ່ຽນຈາກຊ່າງຄົນເກົ່າ ⇒ ບັງຄັບໃສ່ເຫດຜົນ (ເກັບໄວ້ໃນປະຫວັດ)
  const previous = job.emp_code;
  const changed = Boolean(previous && previous !== tech);
  if (changed && !reason) return { error: "ກະລຸນາໃສ່ເຫດຜົນການປ່ຽນຊ່າງ" };

  try {
    await query(
      `update tb_product set emp_code = $1,
          -- ປ່ຽນຊ່າງ ⇒ ການຮັບງານຂອງຄົນເກົ່າໃຊ້ບໍ່ໄດ້ອີກ (ຊ່າງໃໝ່ຕ້ອງກົດຮັບເອງ)
          repair_confirm = case when nullif(emp_code,'') is distinct from $1::varchar then null else repair_confirm end,
          appoint_date = nullif($2,'')::date,
          location_repair = coalesce(nullif($3,''), location_repair),
          remark = coalesce(nullif($4,''), remark),
          user_edit = $5
        where code = $6`,
      [tech, appoint, location, remark, guard.session.username, code],
    );
  } catch (error) {
    console.error("assignRepairTech failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  // ເກັບປະຫວັດ "ປ່ຽນຊ່າງ" — ສະແດງ **ຊື່ ERP** (ບໍ່ແມ່ນລະຫັດ) ຈາກ ຄົນເກົ່າ → ຄົນໃໝ່
  const techs = await listTechnicians();
  const nameOf = (value: string | null) => (value ? techs.find((item) => item.code === value)?.name ?? value : value);
  const action = changed
    ? `ປ່ຽນຊ່າງສ້ອມ: ${nameOf(previous)} → ${nameOf(tech)} · ເຫດຜົນ: ${reason}`
    : `ຈັດຊ່າງສ້ອມ: ${nameOf(tech)}`;
  await logChange(
    "tb_product",
    code,
    `${action}${appoint ? ` · ນັດວັນທີ ${appoint}` : ""}${location ? ` · ${location}` : ""}`,
    { users: [tech] },
  );
  // ຊ່າງຢູ່ໜ້າງານ ບໍ່ໄດ້ເປີດເວັບຄ້າງໄວ້ ⇒ ຕ້ອງເຂົ້າມືຖື
  await pushToUser(tech, "ມີງານສ້ອມໃໝ່", `${code}${appoint ? ` · ນັດ ${appoint}` : ""}`, {
    workflow: "repair",
    code,
  });

  revalidatePath("/repair/assign");
  revalidatePath("/repair");
  revalidatePath("/installations/schedule");
  // IH: ຕັ້ງວັນນັດ ⇒ ວຽກຍ້າຍຈາກ "ລໍນັດໝາຍ/ຈັດຊ່າງໄປສ້ອມ" (ຂັ້ນ 0) ໄປ "ລໍຖ້າຊ່າງຮັບ" (ຂັ້ນ 1)
  revalidatePath("/dashboard/status/repair/wait-schedule");
  revalidatePath("/dashboard");
  return { ok: "ຈັດຊ່າງສຳເລັດ" };
}
