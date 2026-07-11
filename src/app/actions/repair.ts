"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { roleOf, TECH_SIDE } from "@/lib/roles";
import { TRANS } from "@/lib/stock-constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/** ຖອດແບບຈາກ ods/repair.py: start_repair, show_repar, save_rp */

/** ods ໃຊ້ເວລາ Asia/Bangkok (UTC+7) */
const NOW = "timezone('Asia/Bangkok', now())::timestamp(0)";

export type RepairState = { error?: string };
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
  return_complete: Date | null;
  quote_doc: string | null;
  invoice_doc: string | null;
  dispatch_doc: string | null;
};

const JOB_SQL = `select a.code, a.status, a.emp_code, a.warrunty, coalesce(a.used_spare,0)::int used_spare,
    a.time_repair, a.time_finish_repair, a.return_complete,
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
async function loadJob(code: string): Promise<{ ok: true; job: JobSnapshot } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session ໝົດອາຍຸ" };
  const role = roleOf(session);
  if (!TECH_SIDE.includes(role)) return { ok: false, error: "ບໍ່ມີສິດແກ້ໄຂຂັ້ນຕອນຂອງຊ່າງ" };

  const job = (await query<JobSnapshot>(JOB_SQL, [code])).rows[0];
  if (!job) return { ok: false, error: "ບໍ່ພົບໃບຮັບເຄື່ອງ" };
  if (role === "technical" && (job.emp_code ?? "") !== session.username) {
    return { ok: false, error: "ວຽກນີ້ບໍ່ແມ່ນຂອງທ່ານ — ຖອນຄືນບໍ່ໄດ້" };
  }
  return { ok: true, job };
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

export async function startRepair(code: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  await query(`update tb_product set time_repair=${NOW} where code=$1`, [code]);
  await logChange("tb_product", code, "ເລີ່ມສ້ອມແປງ");
  revalidatePath("/repair");
  redirect("/repair");
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
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  // ອາໄຫຼ່ຕົວດຽວກັນ ແລະ ຍັງບໍ່ໄດ້ເຂົ້າໃບຂໍເບີກ/ໃບເບີກ → ບວກຈຳນວນເຂົ້າແຖວເກົ່າ.
  // ຖ້າແຖວເກົ່າເຂົ້າເອກະສານໄປແລ້ວ ຕ້ອງແຍກເປັນແຖວໃໝ່ ບໍ່ດັ່ງນັ້ນຈຳນວນໃນກະຕ່າ
  // ຈະບໍ່ຕົງກັບໃບຂໍເບີກທີ່ອອກໄປແລ້ວ.
  const merged = await query(
    `update tb_used_spare set qty = coalesce(qty,0) + $1
      where product_code=$2 and item_code=$3 and ${NOT_ON_DOC}`,
    [qty, code, item.code],
  );
  if (!merged.rowCount) {
    await query(
      `insert into tb_used_spare(product_code, item_code, item_name, qty, unit_code, status, create_date_time_now)
       values($1, $2, $3, $4, $5, '0', ${NOW})`,
      [code, item.code, item.name_1, qty, item.unit_code],
    );
  }

  // ມີອາໄຫຼ່ແລ້ວ → ໝາຍໃບນີ້ວ່າ "ໃຊ້ອາໄຫຼ່"
  await query("update tb_product set used_spare=1 where code=$1", [code]);
  await logChange("tb_product", code, `ເພີ່ມອາໄຫຼ່ທີ່ໃຊ້ສ້ອມ: ${item.name_1} × ${qty}`);
  revalidatePath(`/repair/${code}`);
  return {};
}

export async function updateUsedSpareQty(code: string, rowOrder: number, qty: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };
  const updated = await query<{ item_name: string | null }>(
    `update tb_used_spare set qty=$1 where roworder=$2 and product_code=$3 and ${NOT_ON_DOC}
     returning item_name`,
    [qty, rowOrder, code],
  );
  const name = updated.rows[0]?.item_name;
  if (!name) return { error: "ອາໄຫຼ່ນີ້ເຂົ້າໃບຂໍເບີກແລ້ວ — ແກ້ຈຳນວນບໍ່ໄດ້" };
  await logChange("tb_product", code, `ແກ້ຈຳນວນອາໄຫຼ່ທີ່ໃຊ້ສ້ອມ: ${name} = ${qty}`);
  revalidatePath(`/repair/${code}`);
  return {};
}

export async function deleteUsedSpare(code: string, rowOrder: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  const removed = await query<{ item_name: string | null }>(
    `delete from tb_used_spare where roworder=$1 and product_code=$2 and ${NOT_ON_DOC}
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
  return {};
}

/* ── ບັນທຶກການສ້ອມແປງ (save_rp) ─────────────────────────────────── */

const saveSchema = z.object({
  pro_code: z.string().min(1),
  repair_note: z.string(),
});

export async function saveRepair(_: RepairState, formData: FormData): Promise<RepairState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  /**
   * save_rp ຂອງ ods ອັບເດດແຕ່ tb_product: status=5 (ລໍຖ້າສົ່ງຄືນ) + time_finish_repair
   * ແລະ ຖິ້ມ "ໝາຍເຫດ" ຂອງຊ່າງ (tb_product.remark ຖືກໃຊ້ເປັນເຫດຜົນຍົກເລີກໄປແລ້ວ).
   * ບ່ອນນີ້ບັນທຶກລົງຄໍລຳ repair_note ທີ່ເພີ່ມໃໝ່ — ວິທີແກ້ໄຂຂອງຊ່າງບໍ່ຫາຍອີກ.
   */
  const { pro_code: code, repair_note: note } = parsed.data;

  try {
    await query(`update tb_product set status=5, time_finish_repair=${NOW}, repair_note=nullif($2,'') where code=$1`, [
      code,
      note,
    ]);
  } catch (error) {
    console.error("save_rp failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  await logChange("tb_product", code, note.trim() ? `ສ້ອມແປງສຳເລັດ: ${note.trim()}` : "ສ້ອມແປງສຳເລັດ");

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
  const blocker = blockedBy(job);
  if (blocker) return { error: `ຍົກເລີກ "ຈົບການສ້ອມແປງ" ບໍ່ໄດ້: ${blocker}` };

  const undone = await query(
    `update tb_product set time_finish_repair=null, status=(${POST_CHECK_STATUS})
      where code=$1 and time_finish_repair is not null and return_complete is null and status<>6`,
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
