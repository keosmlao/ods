"use server";
import { logChange } from "@/lib/chatter-log";
import { getSession, type Session } from "@/lib/auth";
import { db, query } from "@/lib/db";
import { roleOf, TECH_SIDE } from "@/lib/roles";
import {
  addDraftSpare,
  removeDraftSpare,
  saveCheckFlow,
  searchSpares,
  startCheckFlow,
} from "@/lib/tech-flow";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * ຖອດແບບຈາກ ods/check.py:
 *   start_check, pro_ch_detail, search_item_spare, additem, updateqty, delete_item,
 *   save_check, cancelchecking
 *
 * ods ໃຊ້ tb_product.roworder ເປັນ id ໃນ URL ແຕ່ໃຊ້ tb_product.code ຕອນບັນທຶກ (save_check).
 * ບ່ອນນີ້ໃຊ້ code ໝົດທຸກບ່ອນ ໃຫ້ຄືກັບ /service/[code].
 */

/** ods ໃຊ້ເວລາ Asia/Bangkok (UTC+7) ຄືກັນກັບລາວ */

export type CheckState = { error?: string };
export type UndoState = { error?: string };

/* ── ການແກ້ໄຂຂໍ້ຜິດພາດ (undo) — ກົດເກນກາງ ─────────────────────────
 *
 * ods ບໍ່ມີທາງຖອນຄືນເລີຍ: ກົດຜິດເທື່ອດຽວ = ຜິດຕະຫຼອດ. ບ່ອນນີ້ໃຫ້ຖອນຄືນໄດ້
 * ແຕ່ **ຫ້າມຖອນຄືນຂ້າມຂັ້ນທີ່ຍ້ອນກັບບໍ່ໄດ້**: ຖ້າມີເອກະສານສາງ ຫຼື ເອກະສານເງິນ
 * ອອກໄປແລ້ວ ການຖອນຄືນຈະໄປເຮັດໃຫ້ບັນຊີບໍ່ຕົງກັນຢ່າງງຽບໆ ⇒ ປະຕິເສດ ພ້ອມບອກ
 * ເລກທີເອກະສານທີ່ກີດຂວາງຢູ່ ໃຫ້ຜູ້ໃຊ້ຮູ້ວ່າຕ້ອງໄປຈັດການໃບໃດກ່ອນ.
 *
 * ເລກ trans_flag (ic_trans / ic_trans_detail) — ຄືກັບ lib/stock-constants + qt.py:
 *   17 = ໃບສະເໜີລາຄາ · 44 = ໃບຮັບເງິນ · 122 = ໃບຂໍເບີກ · 56 = ໃບເບີກ (ຂອງອອກສາງແລ້ວ)
 */
const QUOTE = 17;
const INVOICE = 44;
const REQUEST = 122;
const DISPATCH = 56;

type JobSnapshot = {
  code: string;
  status: number | null;
  emp_code: string | null;
  warrunty: string | null;
  used_spare: number;
  time_check: Date | null;
  time_finish_check: Date | null;
  time_repair: Date | null;
  time_finish_repair: Date | null;
  return_complete: Date | null;
  qt_start: Date | null;
  quote_doc: string | null;
  invoice_doc: string | null;
  request_doc: string | null;
  dispatch_doc: string | null;
};

const JOB_SQL = `select a.code, a.status, a.emp_code, a.warrunty, coalesce(a.used_spare,0)::int used_spare,
    a.time_check, a.time_finish_check, a.time_repair, a.time_finish_repair, a.return_complete, a.qt_start,
    (select t.doc_no from ic_trans t where t.trans_flag=${QUOTE} and t.product_code=a.code order by t.doc_no limit 1) quote_doc,
    (select t.doc_no from ic_trans t where t.trans_flag=${INVOICE} and t.product_code=a.code order by t.doc_no limit 1) invoice_doc,
    (select d.doc_no from ic_trans_detail d where d.trans_flag=${REQUEST} and d.product_code=a.code order by d.doc_no limit 1) request_doc,
    (select d.doc_no from ic_trans_detail d where d.trans_flag=${DISPATCH} and d.product_code=a.code order by d.doc_no limit 1) dispatch_doc
  from tb_product a where a.code=$1 limit 1`;

/**
 * ດຶງພາບລວມຂອງວຽກ + ກວດສິດ.
 * ຊ່າງ (technical) ຖອນຄືນໄດ້ສະເພາະວຽກຂອງຕົນເອງ · ຜູ້ຈັດການ ແລະ ຫົວໜ້າຊ່າງ ໄດ້ທຸກວຽກ
 * (ຄືກົດເກນ ownJobsOnly ຂອງໜ້າລາຍການ ແຕ່ບັງຄັບຢູ່ຝັ່ງ server).
 */
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

/**
 * ຂັ້ນທີ່ຍ້ອນກັບບໍ່ໄດ້ — ຖ້າຂໍ້ໃດຂໍ້ນຶ່ງຈິງ ໃຫ້ປະຕິເສດການຖອນຄືນ ພ້ອມເລກທີເອກະສານ.
 * ຮຽງຈາກ "ໜັກສຸດ" ລົງມາ ເພື່ອໃຫ້ຜູ້ໃຊ້ເຫັນສາເຫດທີ່ແທ້ຈິງກ່ອນ.
 */
function blockedBy(job: JobSnapshot): string | null {
  if (job.return_complete) return "ສົ່ງເຄື່ອງຄືນລູກຄ້າໄປແລ້ວ — ຖອນຄືນບໍ່ໄດ້";
  if (job.invoice_doc) return `ອອກໃບຮັບເງິນ ${job.invoice_doc} ໄປແລ້ວ — ຖອນຄືນບໍ່ໄດ້`;
  if (job.status === 6) return "ໃບນີ້ຢູ່ໃນຂັ້ນຕອນຍົກເລີກ — ໃຫ້ຖອນຄຳຂໍຍົກເລີກກ່ອນ";
  return null;
}

/* ── ຄົ້ນຫາອາໄຫຼ່ (search_item_spare) ───────────────────────────── */

export type SpareItem = {
  code: string;
  name_1: string;
  brand: string | null;
  unit_code: string | null;
  balance_qty: number;
};

/**
 * ຄົ້ນຫາອາໄຫຼ່ຈາກ ic_inventory.
 *
 * ບໍ່ພິມຫຍັງກໍ່ຄືນລາຍການໃຫ້ເລີຍ (ຮຽງຕາມຄົງເຫຼືອຫຼາຍສຸດ) — ods ບັງຄັບໃຫ້ພິມກ່ອນ
 * ຈຶ່ງເບິ່ງຄືວ່າ "ບໍ່ດຶງລາຍການອາໄຫຼ່".
 *
 * ໝາຍເຫດ: ຖັນ part_number ໃນ ic_inventory ຫວ່າງທຸກແຖວ ຈຶ່ງບໍ່ດຶງມາສະແດງ.
 */
export async function searchSpare(q: string, inStockOnly = false): Promise<SpareItem[]> {
  const session = await getSession();
  if (!session) return [];
  return searchSpares(q, inStockOnly); // lib/tech-flow — ອັນດຽວກັບທີ່ແອັບໃຊ້
}

/* ── ເລີ່ມກວດເຊັກ (start_check) ─────────────────────────────────── */

/**
 * ເລີ່ມກວດເຊັກ — ຕ້ອງຢູ່ຂັ້ນ 1 (ລໍຖ້າກວດເຊັກ) ຈິງໆ.
 *
 * ແຕ່ກ່ອນກວດແຕ່ "login ຢູ່ບໍ": ໃຜກໍ່ໄດ້ (ລວມສາງ/CS) stamp ໃບໃດກໍ່ໄດ້ ແລະ **ກົດຊ້ຳໄດ້** —
 * ການກົດຊ້ຳຂຽນທັບ time_check ⇒ **ໂມງ SLA ຖືກຣີເຊັດງຽບໆ** (ໜ້າ /checking ແລະ ລາຍງານ
 * ນັບເວລາຈາກຖັນນີ້). ດຽວນີ້ເງື່ອນໄຂຂັ້ນຢູ່ໃນ WHERE ⇒ ກົດຊ້ຳບໍ່ຂຽນທັບ ແລະ ນອກຂັ້ນ 1 ບໍ່ເກີດຫຍັງ.
 */
export async function startCheck(code: string): Promise<CheckState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const loaded = await loadJob(code); // ສິດຝ່າຍຊ່າງ + ຕ້ອງເປັນວຽກຂອງຕົນ
  if (!loaded.ok) redirect("/forbidden");

  // ຕົວປ່ຽນຂັ້ນຢູ່ lib/tech-flow ບ່ອນດຽວ — ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ.
  // ຖ້າຂັ້ນຕອນຖືກກັນ (ຍັງບໍ່ຮັບງານ / ຍັງບໍ່ check-in / ບໍ່ຢູ່ຂັ້ນ "ລໍຖ້າກວດເຊັກ")
  // ຕ້ອງສົ່ງເຫດຜົນກັບຄືນ — ບໍ່ດັ່ງນັ້ນປຸ່ມກົດແລ້ວ "ບໍ່ໄປ" ໂດຍບໍ່ບອກຫຍັງ.
  const result = await startCheckFlow(session, code);
  if (!result.ok) return { error: result.error };
  revalidatePath("/checking");
  redirect("/checking");
}

/* ── ຍົກເລີກ "ເລີ່ມກວດເຊັກ" (ບໍ່ມີໃນ ods) ────────────────────────
 *
 * ກົດຜິດໃບ → ລ້າງ time_check ແລ້ວວຽກກັບໄປ "ລໍຖ້າກວດເຊັກ" (status=1).
 * ບໍ່ແຕະສະຕັອກ ຫຼື ເອກະສານໃດເລີຍ — ລ້າງແຕ່ຖັນເວລາ.
 *
 * ປະຕິເສດເມື່ອ:
 *   · ບັນທຶກຜົນກວດເຊັກໄປແລ້ວ (time_finish_check) → ໃຫ້ "ຍົກເລີກຜົນກວດເຊັກ" ກ່ອນ
 *   · ວຽກຍ້າຍໄປຂັ້ນຕໍ່ໄປແລ້ວ (ໃບສະເໜີລາຄາ / ໃບຂໍເບີກ / ໃບເບີກ / ສ້ອມແປງ)
 *   · ຫຼື ຕິດເງື່ອນໄຂກາງ (blockedBy)
 */
export async function undoStartCheck(code: string): Promise<UndoState> {
  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };
  const job = loaded.job;

  if (!job.time_check) return { error: "ໃບນີ້ຍັງບໍ່ໄດ້ເລີ່ມກວດເຊັກ" };
  const blocker = blockedBy(job);
  if (blocker) return { error: `ຍົກເລີກ "ເລີ່ມກວດເຊັກ" ບໍ່ໄດ້: ${blocker}` };
  if (job.time_finish_check) {
    return { error: 'ຍົກເລີກ "ເລີ່ມກວດເຊັກ" ບໍ່ໄດ້: ບັນທຶກຜົນກວດເຊັກໄປແລ້ວ — ໃຫ້ກົດ "ຍົກເລີກຜົນກວດເຊັກ" ກ່ອນ' };
  }
  if (job.time_repair) return { error: 'ຍົກເລີກ "ເລີ່ມກວດເຊັກ" ບໍ່ໄດ້: ເລີ່ມສ້ອມແປງໄປແລ້ວ' };
  if (job.quote_doc || job.qt_start) {
    return { error: `ຍົກເລີກ "ເລີ່ມກວດເຊັກ" ບໍ່ໄດ້: ມີໃບສະເໜີລາຄາ ${job.quote_doc ?? ""} ແລ້ວ`.trim() };
  }
  if (job.request_doc) return { error: `ຍົກເລີກ "ເລີ່ມກວດເຊັກ" ບໍ່ໄດ້: ມີໃບຂໍເບີກອາໄຫຼ່ ${job.request_doc} ແລ້ວ` };
  if (job.dispatch_doc) {
    return { error: `ຍົກເລີກ "ເລີ່ມກວດເຊັກ" ບໍ່ໄດ້: ອາໄຫຼ່ຖືກເບີກອອກຈາກສາງແລ້ວ (ໃບເບີກ ${job.dispatch_doc})` };
  }

  // ເງື່ອນໄຂຊ້ຳຢູ່ SQL — ກັນສອງຄົນກົດພ້ອມກັນ (ບັນທຶກຜົນກວດແລ້ວຖອນຄືນ)
  const undone = await query(
    "update tb_product set time_check=null, status=1 where code=$1 and time_check is not null and time_finish_check is null and status<>6",
    [code],
  );
  if (!undone.rowCount) return { error: "ຖອນຄືນບໍ່ສຳເລັດ — ວຽກຖືກປ່ຽນໄປແລ້ວ" };

  await logChange("tb_product", code, 'ຍົກເລີກ "ເລີ່ມກວດເຊັກ" — ວຽກກັບໄປ "ລໍຖ້າກວດເຊັກ"');
  revalidatePath("/checking");
  revalidatePath(`/checking/${code}`);
  revalidatePath(`/service/${code}`);
  return {};
}

/* ── ກະຕ່າອາໄຫຼ່ (additem / updateqty / delete_item) ─────────────── */

export async function addSpareItem(
  code: string,
  item: { code: string; name_1: string; unit_code: string | null },
  qty = 1,
) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const result = await addDraftSpare(session, code, item, qty);
  revalidatePath(`/checking/${code}`);
  return result.ok ? {} : { error: result.error };
}

export async function updateSpareQty(code: string, rowOrder: number, qty: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };
  await query("update ic_trans_detail_draft set qty=$1 where roworder=$2 and user_created=$3 and product_code=$4", [
    qty,
    rowOrder,
    session.username,
    code,
  ]);
  revalidatePath(`/checking/${code}`);
  return {};
}

export async function deleteSpareItem(code: string, rowOrder: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const result = await removeDraftSpare(session, code, rowOrder);
  revalidatePath(`/checking/${code}`);
  return result.ok ? {} : { error: result.error };
}

/* ── ບັນທຶກການກວດເຊັກ (save_check) ──────────────────────────────── */

const saveSchema = z.object({
  code: z.string().min(1),
  isue_bytech: z.string().min(1),
  war_by_t: z.enum(["0", "1"]),
  t_reason: z.string(),
  use_spare: z.enum(["0", "1"]),
  warrunty: z.string(),
});

export async function saveCheck(_: CheckState, formData: FormData): Promise<CheckState> {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ກະລຸນາປ້ອນ ອາການຊ່າງວິເຄາະ" };

  // ສິດຝ່າຍຊ່າງ + ຕ້ອງເປັນວຽກຂອງຕົນ
  const loaded = await loadJob(parsed.data.code);
  if (!loaded.ok) return { error: loaded.error };

  /**
   * ກົດເກນທັງໝົດ (ຕ້ອງຢູ່ຂັ້ນ 2 · ຍ້າຍກະຕ່າຮ່າງ → tb_used_spare · status ໃໝ່ ·
   * ເຫດຜົນປະກັນເປັນຫຼັກຖານ) ຢູ່ lib/tech-flow ບ່ອນດຽວ — **ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ**.
   */
  const result = await saveCheckFlow(loaded.session, {
    code: parsed.data.code,
    diagnosis: parsed.data.isue_bytech,
    warranty_void: parsed.data.war_by_t === "1",
    warranty_reason: parsed.data.t_reason,
    use_spare: parsed.data.use_spare === "1",
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/checking");
  revalidatePath("/repair");
  redirect("/checking");
}

/* ── ຍົກເລີກຜົນກວດເຊັກ (cancelchecking) ──────────────────────────
 *
 * ຊ່າງບັນທຶກຜົນກວດຜິດ (ອາການຜິດ, ໃສ່/ບໍ່ໃສ່ອາໄຫຼ່ຜິດ) → ລ້າງຜົນກວດ ແລ້ວກັບໄປ
 * "ກຳລັງກວດເຊັກ" (status=2, time_check ຍັງຢູ່) ເພື່ອກວດ ແລະ ບັນທຶກໃໝ່.
 *
 * ປະຕິເສດເມື່ອວຽກຍ້າຍໄປຂັ້ນຕໍ່ໄປແລ້ວ — ໝາຍທີ່ໃຊ້ຈິງ (ບໍ່ແມ່ນຄາດເດົາ):
 *   · ໃບຂໍເບີກອາໄຫຼ່ — ic_trans_detail.trans_flag=122 ຫຼື tb_product.spare_reg
 *   · ໃບເບີກ (ຂອງອອກສາງແລ້ວ) — ic_trans_detail.trans_flag=56
 *   · ໃບສະເໜີລາຄາ — ic_trans.trans_flag=17 ຫຼື tb_product.qt_start
 *   · ເລີ່ມສ້ອມແປງ — tb_product.time_repair
 *   · ບວກເງື່ອນໄຂກາງ: ສົ່ງຄືນລູກຄ້າແລ້ວ / ມີໃບຮັບເງິນ / ຢູ່ໃນຂັ້ນຕອນຍົກເລີກ
 *
 * ເຫດຜົນທີ່ຕ້ອງກັນ: ບ່ອນນີ້ລຶບແຖວ tb_used_spare ຖິ້ມ — ຖ້າອາໄຫຼ່ພວກນັ້ນເຂົ້າໃບຂໍເບີກ
 * ຫຼື ຖືກເບີກອອກສາງໄປແລ້ວ ການລຶບຈະເຮັດໃຫ້ໃບຢູ່ສາງກັບວຽກບໍ່ຕົງກັນຢ່າງງຽບໆ.
 *
 * ອາໄຫຼ່ທີ່ຊ່າງເລືອກໄວ້ບໍ່ຫາຍ — ຖືກຍ້າຍກັບເຂົ້າກະຕ່າຮ່າງ (ic_trans_detail_draft)
 * ຂອງຊ່າງຄົນນັ້ນ ຈຶ່ງບໍ່ຕ້ອງພິມຄືນໃໝ່ໝົດ.
 *
 * ໝາຍເຫດ: **ບໍ່** ແຕະ warrunty / warranty_reason. ສະຖານະປະກັນ ແລະ ເຫດຜົນຂອງມັນ
 * ຢູ່ຄູ່ກັນສະເໝີ (ເຫດຜົນມີຄວາມໝາຍສະເພາະຕອນ 'ໝົດຮັບປະກັນ') ແລະ ເປັນຫຼັກຖານຕໍ່ລູກຄ້າ
 * ⇒ ບໍ່ລຶບຖິ້ມງຽບໆ. ບັນທຶກຜົນກວດຄືນໃໝ່ດ້ວຍ "ຂໍປ່ຽນປະກັນ" ຈະຂຽນເຫດຜົນທັບໃຫ້,
 * ຖ້າຕັດສິນປະກັນຜິດແທ້ ຝ່າຍບໍລິການແກ້ໄດ້ທີ່ /service/[code]/edit.
 */
export async function cancelChecking(code: string): Promise<UndoState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const loaded = await loadJob(code);
  if (!loaded.ok) return { error: loaded.error };
  const job = loaded.job;

  if (!job.time_finish_check) return { error: "ໃບນີ້ຍັງບໍ່ໄດ້ບັນທຶກຜົນກວດເຊັກ" };
  const blocker = blockedBy(job);
  if (blocker) return { error: `ຍົກເລີກຜົນກວດເຊັກບໍ່ໄດ້: ${blocker}` };
  if (job.dispatch_doc) {
    return {
      error: `ຍົກເລີກຜົນກວດເຊັກບໍ່ໄດ້: ອາໄຫຼ່ຖືກເບີກອອກຈາກສາງແລ້ວ (ໃບເບີກ ${job.dispatch_doc}) — ຕ້ອງສົ່ງອາໄຫຼ່ຄືນສາງກ່ອນ`,
    };
  }
  if (job.request_doc) {
    return { error: `ຍົກເລີກຜົນກວດເຊັກບໍ່ໄດ້: ມີໃບຂໍເບີກອາໄຫຼ່ ${job.request_doc} ແລ້ວ — ຕ້ອງຍົກເລີກໃບຂໍເບີກກ່ອນ` };
  }
  if (job.quote_doc) return { error: `ຍົກເລີກຜົນກວດເຊັກບໍ່ໄດ້: ມີໃບສະເໜີລາຄາ ${job.quote_doc} ແລ້ວ` };
  if (job.qt_start) return { error: "ຍົກເລີກຜົນກວດເຊັກບໍ່ໄດ້: ເລີ່ມສະເໜີລາຄາໄປແລ້ວ" };
  if (job.time_repair) return { error: 'ຍົກເລີກຜົນກວດເຊັກບໍ່ໄດ້: ເລີ່ມສ້ອມແປງໄປແລ້ວ — ໃຫ້ຍົກເລີກ "ເລີ່ມສ້ອມແປງ" ກ່ອນ' };

  const client = await db.connect();
  let spareCount = 0;
  try {
    await client.query("begin");

    // ເງື່ອນໄຂຊ້ຳຢູ່ SQL — ກັນສອງຄົນກົດພ້ອມກັນ (ຂໍເບີກ ແລະ ຖອນຄືນພ້ອມກັນ)
    const undone = await client.query(
      `update tb_product set time_finish_check=null, issue_2=null, used_spare=0, status=2
        where code=$1 and time_finish_check is not null and time_repair is null
          and qt_start is null and spare_reg is null and status<>6`,
      [code],
    );
    if (!undone.rowCount) {
      await client.query("rollback");
      return { error: "ຖອນຄືນບໍ່ສຳເລັດ — ວຽກຖືກປ່ຽນໄປແລ້ວ" };
    }

    // ອາໄຫຼ່ກັບເຂົ້າກະຕ່າຮ່າງຂອງຊ່າງ (trans_flag 12 ຄືກັບ addSpareItem) ແລ້ວຈຶ່ງລຶບຕົວຈິງ
    const moved = await client.query(
      `insert into ic_trans_detail_draft(trans_flag, cust_code, product_code, item_code, item_name, qty, unit_code, user_created)
       select 12, p.cust_code, s.product_code, s.item_code, s.item_name, s.qty, s.unit_code, $2
         from tb_used_spare s join tb_product p on p.code = s.product_code
        where s.product_code=$1`,
      [code, session.username],
    );
    spareCount = moved.rowCount ?? 0;
    await client.query("delete from tb_used_spare where product_code=$1", [code]);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("cancelchecking failed", error);
    return { error: "ຖອນຄືນບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  const spareNote = spareCount > 0 ? ` · ອາໄຫຼ່ ${spareCount} ລາຍການ ກັບເຂົ້າກະຕ່າ` : "";
  await logChange("tb_product", code, `ຍົກເລີກຜົນກວດເຊັກ — ກັບໄປກວດເຊັກຄືນໃໝ່${spareNote}`);

  revalidatePath("/checking");
  revalidatePath(`/checking/${code}`);
  revalidatePath("/repair");
  revalidatePath(`/service/${code}`);
  return {};
}
