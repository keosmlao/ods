"use server";
import { logChange } from "@/app/actions/chatter";
import { clearCancelRequest } from "@/app/actions/service";
import { ROLE_APPROVER, ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE, SERVICE_SIDE } from "@/lib/roles";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * ຖອດແບບຈາກ ods/qt.py (/approveqtbill, /not_approveqtbill, /approveqt_bycust, /not_approveqt_bycust)
 * ແລະ ods/Services.py (/save_apfinish)
 *
 * ອະນຸມັດ 2 ຊັ້ນ: aprove_status (ພາຍໃນ 0/1/2) → aprove_status_2 (ລູກຄ້າ 0/1/2)
 */

export type ApprovalState = { error?: string };

function revalidateAll() {
  revalidatePath("/quotations", "layout");
  revalidatePath("/approvals", "layout");
}

/* ───────── ສິດ ─────────
 * middleware ກັນສະເພາະ "ໜ້າ" — server action ຖືກຍິງໂດຍກົງໄດ້ (POST ໃສ່ URL ໃດກໍ່ໄດ້)
 * ຈຶ່ງຕ້ອງກວດສິດຢູ່ນີ້ອີກຊັ້ນ:
 *   ອະນຸມັດ / ບໍ່ອະນຸມັດ ພາຍໃນ = ຜູ້ອະນຸມັດ (ຜູ້ຈັດການ + ຫົວໜ້າຊ່າງ) ຄືສິດເຂົ້າ /approvals
 *   ບັນທຶກຄຳຕອບຂອງລູກຄ້າ      = ຝ່າຍບໍລິການ (ຜູ້ຈັດການ + CS) ຄືສິດເຂົ້າ /quotations
 */
const requireApprover = () => requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດໃບສະເໜີລາຄາ");
const requireService = () => requireRole(SERVICE_SIDE, "ບໍ່ມີສິດບັນທຶກຄຳຕອບຂອງລູກຄ້າ");

/* ───────── ເງິນ ແລະ ເອກະສານທີ່ຂວາງການຖອນຄືນ ───────── */

const fmt = (value: string | number | null) => {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
};

type QuoteMoney = {
  product_code: string | null;
  user_created: string | null;
  total_value: string;
  total_discount: string;
  total_amount: string;
  exchange_rate: string | null;
  total_amount_2: string | null;
};

const MONEY_SQL = `select product_code, user_created,
    coalesce(total_value,0)::text total_value, coalesce(total_discount,0)::text total_discount,
    coalesce(total_amount,0)::text total_amount, exchange_rate::text, total_amount_2::text
  from ic_trans where doc_no=$1 and trans_flag=17 limit 1`;

/** ຂໍ້ຄວາມເງິນມາດຕະຖານ — ຍອດສຸດທ້າຍ (ຫຼັງສ່ວນຫຼຸດ) + ຍອດກີບ ⇒ ຕົວເລກດຽວກັນທຸກບ່ອນ */
function moneyLine(m: QuoteMoney | undefined) {
  if (!m) return "";
  const discount = Number(m.total_discount);
  const kip = Number(m.total_amount_2 ?? 0);
  return (
    ` · ຍອດ ${fmt(m.total_amount)} ບາດ` +
    (discount > 0 ? ` (ລວມ ${fmt(m.total_value)} − ສ່ວນຫຼຸດ ${fmt(discount)})` : "") +
    (kip > 0 ? ` ≈ ${fmt(kip)} ກີບ` : "")
  );
}

/**
 * ເອກະສານທີ່ອອກໄປແລ້ວ ແລະ ຂວາງການຖອນຄືນ (ຖອນຄືນຂ້າມເອກະສານທີ່ອອກແລ້ວບໍ່ໄດ້).
 * ຄືນຂໍ້ຄວາມພາສາລາວທີ່ **ບອກຊື່ເອກະສານ** ໃຫ້ຜູ້ໃຊ້ຮູ້ວ່າຕິດຢູ່ໃສ.
 */
async function blockingDoc(productCode: string): Promise<string | null> {
  if (!productCode) return null;
  const row = (
    await query<{ receipt: string | null; returned: boolean; cancel_done: boolean }>(
      `select (select doc_no from ic_trans where trans_flag=44 and product_code=$1 order by doc_no desc limit 1) receipt,
          coalesce(p.return_complete is not null, false) returned,
          coalesce(p.cancel_finish is not null, false) cancel_done
        from tb_product p where p.code=$1`,
      [productCode],
    )
  ).rows[0];
  if (!row) return null;

  if (row.receipt) return `ອອກໃບຮັບເງິນ ${row.receipt} ໄປແລ້ວ — ຖອນຄືນບໍ່ໄດ້`;
  if (row.returned) return "ສົ່ງເຄື່ອງຄືນລູກຄ້າໄປແລ້ວ — ຖອນຄືນບໍ່ໄດ້";
  if (row.cancel_done) return "ອະນຸມັດການຍົກເລີກວຽກນີ້ໄປແລ້ວ — ຖອນຄືນບໍ່ໄດ້";
  return null;
}

/* ───────── ອະນຸມັດພາຍໃນ (ຊັ້ນ 1) ───────── */

/** ຄື /approveqtbill */
export async function approveQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireApprover();
  if (!guard.ok) return { error: guard.error };
  const docNo = String(formData.get("doc_no") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  let productCode = "";
  let owner = "";
  let amounts: QuoteMoney | undefined;
  try {
    // returning → ໄດ້ລະຫັດເຄື່ອງມາຂຽນ log ໂດຍບໍ່ຕ້ອງ query ຊ້ຳ (ຟອມບໍ່ໄດ້ສົ່ງມາ)
    const approved = await query<{ product_code: string | null; user_created: string | null }>(
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), approve_at=localtimestamp(0), aprove_status=1
       where doc_no=$3 and trans_flag=17 and coalesce(aprove_status,0)=0 and coalesce(aprove_status_2,0)=0
       returning product_code, user_created`,
      [remark, guard.session.username, docNo],
    );
    if (!approved.rowCount) return { error: "ໃບສະເໜີລາຄານີ້ຖືກດຳເນີນການໄປແລ້ວ" };
    productCode = approved.rows[0]?.product_code ?? "";
    owner = (approved.rows[0]?.user_created ?? "").trim();
    amounts = (await query<QuoteMoney>(MONEY_SQL, [docNo])).rows[0];
  } catch (error) {
    console.error("approveQuote failed", error);
    return { error: "ອະນຸມັດບໍ່ສຳເລັດ" };
  }

  if (productCode) {
    // ແຈ້ງຜູ້ອອກບິນໂດຍກົງ — ລາວແມ່ນຄົນທີ່ຕ້ອງໄປສະເໜີລາຄາໃຫ້ລູກຄ້າຕໍ່
    await logChange(
      "tb_product",
      productCode,
      `ອະນຸມັດໃບສະເໜີລາຄາ ${docNo} (ພາຍໃນ)${moneyLine(amounts)}${remark.trim() ? ` · ${remark.trim()}` : ""} — ລໍຖ້າລູກຄ້າຕອບ`,
      { users: owner ? [owner] : [] },
    );
  }

  revalidateAll();
  redirect("/approvals/quotations");
}

/**
 * ຖອນການອະນຸມັດ / ບໍ່ອະນຸມັດ ພາຍໃນ — ບໍ່ມີໃນ ods ເລີຍ (ກົດຜິດແລ້ວແກ້ບໍ່ໄດ້).
 *
 * 1/0 ຫຼື 2/0 → ກັບເປັນ 0/0 (ເຂົ້າຄິວລໍຖ້າອະນຸມັດຄືນ) ພ້ອມລ້າງ ຜູ້ອະນຸມັດ/ວັນທີ/ໝາຍເຫດ.
 * ຖອນ "ບໍ່ອະນຸມັດ" ຕ້ອງຕັ້ງ qt_start ຄືນ ເພາະ rejectQuote ລ້າງມັນຖິ້ມ (ວຽກກັບໄປຂັ້ນ 3).
 *
 * ກັນຖອຍຂ້າມເອກະສານທີ່ອອກແລ້ວ:
 *   ລູກຄ້າຕອບແລ້ວ (aprove_status_2 <> 0) → ຫ້າມ (ໃຫ້ຖອນຄຳຕອບຂອງລູກຄ້າກ່ອນ)
 *   ມີໃບຮັບເງິນ / ສົ່ງເຄື່ອງຄືນ / ອະນຸມັດຍົກເລີກແລ້ວ → ຫ້າມ ພ້ອມບອກຊື່ເອກະສານ
 */
export async function undoQuoteApproval(docNo: string): Promise<ApprovalState> {
  const guard = await requireApprover();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const client = await db.connect();
  let productCode = "";
  let owner = "";
  let wasStatus = 0;
  try {
    await client.query("begin");
    const head = await client.query<{ product_code: string | null; user_created: string | null; s1: number; s2: number }>(
      `select product_code, user_created, coalesce(aprove_status,0)::int s1, coalesce(aprove_status_2,0)::int s2
       from ic_trans where doc_no=$1 and trans_flag=17 for update`,
      [docNo],
    );
    const row = head.rows[0];
    if (!row) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບໃບສະເໜີລາຄາ" };
    }
    if (row.s1 === 0) {
      await client.query("rollback");
      return { error: "ໃບນີ້ຍັງລໍຖ້າອະນຸມັດຢູ່ແລ້ວ — ບໍ່ມີຫຍັງໃຫ້ຖອນ" };
    }
    if (row.s2 !== 0) {
      await client.query("rollback");
      return {
        error: `ລູກຄ້າຕອບກັບໃບສະເໜີລາຄາ ${docNo} ແລ້ວ — ຕ້ອງຖອນຄຳຕອບຂອງລູກຄ້າກ່ອນ (ໜ້າ "ລູກຄ້າອະນຸມັດ" ແທັບ "ຕອບແລ້ວ")`,
      };
    }

    productCode = row.product_code ?? "";
    owner = (row.user_created ?? "").trim();
    wasStatus = row.s1;

    const blocked = await blockingDoc(productCode);
    if (blocked) {
      await client.query("rollback");
      return { error: blocked };
    }

    await client.query(
      `update ic_trans set aprove_status=0, approver1=null, aprove_date1=null, approve_at=null, remark_2=null
       where doc_no=$1 and trans_flag=17`,
      [docNo],
    );
    // ຖອນ "ບໍ່ອະນຸມັດ" → ວຽກກັບຄືນຂັ້ນ "ກຳລັງສະເໜີລາຄາ" ຈຶ່ງຕ້ອງມີ qt_start ຄືນ
    if (productCode && wasStatus === 2) {
      await client.query(
        "update tb_product set qt_start=coalesce(qt_start, localtimestamp(0)), qt_finish=null where code=$1",
        [productCode],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("undoQuoteApproval failed", error);
    return { error: "ຖອນຄືນບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (productCode) {
    await logChange(
      "tb_product",
      productCode,
      `ຖອນ${wasStatus === 2 ? "ການບໍ່ອະນຸມັດ" : "ການອະນຸມັດ"}ໃບສະເໜີລາຄາ ${docNo} (ພາຍໃນ) — ກັບເຂົ້າຄິວລໍຖ້າອະນຸມັດ`,
      { roles: ROLE_APPROVER, users: owner ? [owner] : [] },
    );
  }

  revalidateAll();
  return {};
}

/**
 * ຄື /not_approveqtbill — ບໍ່ອະນຸມັດ ແລ້ວປ່ອຍເຄື່ອງກັບຄືນຄິວ "ລໍຖ້າສະເໜີລາຄາ" (ຂັ້ນ 3)
 *
 * ໃບເກົ່າ (aprove_status=2) ຍັງຢູ່ ແລະ ຜູ້ຮັບຜິດຊອບເອົາຄືນໄດ້ 2 ທາງ ຢູ່ແທັບ "ລໍຖ້າອອກໃບສະເໜີລາຄາ":
 *   ແກ້ໄຂແລ້ວສົ່ງອະນຸມັດຄືນ (saveQuoteEdit ຕັດ aprove_status ກັບເປັນ 0) ຫຼື ລຶບຖິ້ມແລ້ວອອກໃບໃໝ່ (cancelQuote).
 * ⇒ ເຫດຜົນຈຶ່ງ **ຈຳເປັນ**: ບໍ່ມີເຫດຜົນ = ຜູ້ຮັບຜິດຊອບບໍ່ຮູ້ວ່າຕ້ອງແກ້ຫຍັງ.
 */
export async function rejectQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireApprover();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  const remark = String(formData.get("remark") ?? "").trim();
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };
  if (!remark) return { error: "ກະລຸນາລະບຸເຫດຜົນທີ່ບໍ່ອະນຸມັດຢູ່ຊ່ອງ ໝາຍເຫດ ກ່ອນ" };

  const client = await db.connect();
  let productCode = "";
  let owner = "";
  try {
    await client.query("begin");
    // ລະຫັດເຄື່ອງ + ຜູ້ອອກບິນ ເອົາຈາກຖານຂໍ້ມູນ ບໍ່ແມ່ນຈາກຟອມ (ຟອມເຊື່ອບໍ່ໄດ້)
    const rejected = await client.query<{ product_code: string | null; user_created: string | null }>(
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), approve_at=localtimestamp(0), aprove_status=2
       where doc_no=$3 and trans_flag=17 and coalesce(aprove_status,0)=0 and coalesce(aprove_status_2,0)=0
       returning product_code, user_created`,
      [remark, guard.session.username, docNo],
    );
    if (!rejected.rowCount) {
      await client.query("rollback");
      return { error: "ໃບສະເໜີລາຄານີ້ຖືກດຳເນີນການໄປແລ້ວ" };
    }
    productCode = rejected.rows[0].product_code ?? "";
    owner = (rejected.rows[0].user_created ?? "").trim();

    if (productCode) {
      await client.query("update tb_product set qt_start=null, qt_finish=null where code=$1", [productCode]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("rejectQuote failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (productCode) {
    // ແຈ້ງຜູ້ອອກບິນໂດຍກົງ — ລາວແມ່ນຄົນທີ່ຕ້ອງລົງມືແກ້ໄຂ ຫຼື ອອກໃບໃໝ່
    await logChange(
      "tb_product",
      productCode,
      `ບໍ່ອະນຸມັດໃບສະເໜີລາຄາ ${docNo} (ພາຍໃນ) · ເຫດຜົນ: ${remark} — ໃຫ້ແກ້ໄຂແລ້ວສົ່ງອະນຸມັດຄືນ ຫຼື ລຶບແລ້ວອອກໃບໃໝ່`,
      { users: owner ? [owner] : [] },
    );
  }

  revalidateAll();
  redirect("/approvals/quotations");
}

/* ───────── ລູກຄ້າອະນຸມັດ (ຊັ້ນ 2) ───────── */

/**
 * ຄື /approveqt_bycust
 *
 * ຍອດທີ່ລູກຄ້າຕົກລົງ ຖືກຂຽນລົງ chatter ດ້ວຍ (ຍອດສຸດທ້າຍ + ສ່ວນຫຼຸດ + ຍອດກີບ) —
 * ນີ້ຄືຕົວເລກທີ່ຝ່າຍເກັບເງິນຕ້ອງເກັບ ຕອນອອກໃບຮັບເງິນ (actions/return.ts ດຶງລາຄາຈາກໃບນີ້).
 */
export async function customerApproveQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  const note = String(formData.get("remark") ?? "").trim();
  let productCode = "";
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const client = await db.connect();
  try {
    await client.query("begin");
    const done = await client.query<{ product_code: string | null }>(
      `update ic_trans set aprove_date2=localtime(0), approve_at_2=localtimestamp(0), aprove_status_2=1
       where doc_no=$1 and trans_flag=17 and aprove_status=1 and coalesce(aprove_status_2,0)=0
       returning product_code`,
      [docNo],
    );
    if (!done.rowCount) {
      await client.query("rollback");
      return { error: "ໃບສະເໜີລາຄານີ້ຖືກດຳເນີນການໄປແລ້ວ" };
    }
    productCode = done.rows[0].product_code ?? "";
    if (productCode) {
      await client.query("update tb_product set qt_finish=localtimestamp(0) where code=$1", [productCode]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("customerApproveQuote failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (productCode) {
    const amounts = (await query<QuoteMoney>(MONEY_SQL, [docNo])).rows[0];
    await logChange(
      "tb_product",
      productCode,
      `ລູກຄ້າຕົກລົງໃບສະເໜີລາຄາ ${docNo}${moneyLine(amounts)}${note ? ` · ${note}` : ""} — ຍອດນີ້ຄືຍອດທີ່ຕ້ອງເກັບຕອນອອກໃບຮັບເງິນ`,
    );
  }

  revalidateAll();
  redirect("/quotations/customer-approval");
}

/**
 * ຄື /not_approveqt_bycust — ລູກຄ້າບໍ່ອະນຸມັດ → ເຄື່ອງເຂົ້າຂັ້ນຕອນຂໍຍົກເລີກ (status=6)
 *
 * tb_product.remark = "ເຫດຜົນການຍົກເລີກ" ທີ່ໜ້າ /approvals/cancellations ສະແດງ (ຊ່ອງ ໝາຍເຫດ).
 * ເສັ້ນທາງນີ້ບໍ່ເຄີຍຂຽນມັນເລີຍ ⇒ ຜູ້ອະນຸມັດເຫັນເຫດຜົນຫວ່າງພໍດີກັບເຄສທີ່ສຳຄັນທີ່ສຸດ.
 * ບ່ອນນີ້ຈຶ່ງບັນທຶກເຫດຜົນເປັນພາສາລາວໃຫ້ຄົບ + ເຫດຜົນຂອງລູກຄ້າ (**ບັງຄັບ**).
 *
 * ເຫດຜົນບັງຄັບ: ຟອມເກົ່າບໍ່ມີຊ່ອງໃຫ້ພິມເລີຍ ທັງທີ່ action ອ່ານ remark ຢູ່ ⇒ ຂໍ້ມູນສຳຄັນທີ່ສຸດ
 * (ລູກຄ້າປະຕິເສດຍ້ອນຫຍັງ — ລາຄາແພງ? ບໍ່ຄຸ້ມສ້ອມ?) ຖືກຖິ້ມທຸກເທື່ອ. ຜູ້ອະນຸມັດການຍົກເລີກ
 * ຕ້ອງໃຊ້ຂໍ້ມູນນີ້ຕັດສິນ ແລະ ຝ່າຍບໍລິການຕ້ອງໃຊ້ມັນຕັດສິນວ່າຄວນສະເໜີລາຄາໃໝ່ບໍ.
 */
export async function customerRejectQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  const note = String(formData.get("remark") ?? "").trim();
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };
  if (!note) return { error: "ກະລຸນາລະບຸເຫດຜົນທີ່ລູກຄ້າບໍ່ຕົກລົງ — ຜູ້ອະນຸມັດການຍົກເລີກຕ້ອງໃຊ້ຂໍ້ມູນນີ້" };

  const reason = `ລູກຄ້າບໍ່ຕົກລົງລາຄາ (ໃບສະເໜີລາຄາ ${docNo})${note ? ` · ${note}` : ""}`;

  const client = await db.connect();
  let productCode = "";
  try {
    await client.query("begin");
    const done = await client.query<{ product_code: string | null }>(
      `update ic_trans set aprove_date2=localtime(0), approve_at_2=localtimestamp(0), aprove_status_2=2
       where doc_no=$1 and trans_flag=17 and aprove_status=1 and coalesce(aprove_status_2,0)=0
       returning product_code`,
      [docNo],
    );
    if (!done.rowCount) {
      await client.query("rollback");
      return { error: "ໃບສະເໜີລາຄານີ້ຖືກດຳເນີນການໄປແລ້ວ" };
    }
    productCode = done.rows[0].product_code ?? "";

    if (productCode) {
      await client.query(
        `update tb_product set qt_finish=localtimestamp(0), status=6,
           cancel_start=localtimestamp(0), request_cancel=$1, remark=$2
         where code=$3 and status <> 6`,
        [guard.session.username, reason, productCode],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("customerRejectQuote failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (productCode) {
    const amounts = (await query<QuoteMoney>(MONEY_SQL, [docNo])).rows[0];
    await logChange("tb_product", productCode, `${reason}${moneyLine(amounts)} — ເຂົ້າຂັ້ນຕອນຂໍຍົກເລີກ`, {
      roles: ROLE_APPROVER,
    });
  }

  revalidateAll();
  redirect("/quotations/customer-approval");
}

/**
 * ຖອນຄຳຕອບຂອງລູກຄ້າ — ບໍ່ມີໃນ ods ເລີຍ.
 *
 * ແກ້ 2 ບັນຫາພ້ອມກັນ:
 *  1. ກົດຜິດ (ລູກຄ້າຕົກລົງ/ບໍ່ຕົກລົງ) ແລ້ວແກ້ບໍ່ໄດ້ — ວຽກແລ່ນຕໍ່ດ້ວຍຄຳຕອບຜິດ
 *  2. **ທາງຕັນ**: ໃບ 1/2 (ລູກຄ້າບໍ່ຕົກລົງ) ແກ້ບໍ່ໄດ້ ລຶບບໍ່ໄດ້ ⇒ ຖ້າຜູ້ອະນຸມັດ "ບໍ່ອະນຸມັດການຍົກເລີກ"
 *     ວຽກກັບເຂົ້າສາຍງານປົກກະຕິພ້ອມໃບສະເໜີລາຄາທີ່ລູກຄ້າປະຕິເສດຄາຢູ່ ແລະ ອອກໃບໃໝ່ກໍ່ບໍ່ໄດ້
 *
 * ຜົນ: 1/1 ຫຼື 1/2 → ກັບເປັນ 1/0 (ລໍຖ້າລູກຄ້າຕອບ), ລ້າງ qt_finish.
 *   ຖ້າເປັນ 1/2 ແລະ ຄຳຂໍຍົກເລີກຍັງບໍ່ຖືກອະນຸມັດ → ຖອນຄຳຂໍຍົກເລີກໃຫ້ນຳ (clearCancelRequest)
 *   ⇒ ວຽກກັບຄືນສາຍງານປົກກະຕິຢ່າງສົມບູນ ແລ້ວແກ້ລາຄາ/ສະເໜີຄືນໄດ້.
 *
 * ກັນຖອຍຂ້າມເອກະສານທີ່ອອກແລ້ວ: ໃບຮັບເງິນ / ສົ່ງເຄື່ອງຄືນ / ອະນຸມັດຍົກເລີກແລ້ວ → ປະຕິເສດ ພ້ອມບອກຊື່ເອກະສານ.
 */
export async function undoCustomerDecision(docNo: string): Promise<ApprovalState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const client = await db.connect();
  let productCode = "";
  let owner = "";
  let wasStatus = 0;
  try {
    await client.query("begin");
    const head = await client.query<{ product_code: string | null; user_created: string | null; s2: number }>(
      `select product_code, user_created, coalesce(aprove_status_2,0)::int s2
       from ic_trans where doc_no=$1 and trans_flag=17 for update`,
      [docNo],
    );
    const row = head.rows[0];
    if (!row) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບໃບສະເໜີລາຄາ" };
    }
    if (row.s2 === 0) {
      await client.query("rollback");
      return { error: "ໃບນີ້ຍັງລໍຖ້າລູກຄ້າຕອບຢູ່ແລ້ວ — ບໍ່ມີຫຍັງໃຫ້ຖອນ" };
    }

    productCode = row.product_code ?? "";
    owner = (row.user_created ?? "").trim();
    wasStatus = row.s2;

    const blocked = await blockingDoc(productCode);
    if (blocked) {
      await client.query("rollback");
      return { error: blocked };
    }

    await client.query(
      `update ic_trans set aprove_status_2=0, aprove_date2=null, approve_at_2=null
       where doc_no=$1 and trans_flag=17 and aprove_status=1`,
      [docNo],
    );
    if (productCode) {
      await client.query("update tb_product set qt_finish=null where code=$1", [productCode]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("undoCustomerDecision failed", error);
    return { error: "ຖອນຄືນບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ລູກຄ້າເຄີຍປະຕິເສດ → ວຽກຖືກສົ່ງໄປຂໍຍົກເລີກ. ຖອນຄຳຕອບແລ້ວ ຄຳຂໍຍົກເລີກນັ້ນກໍ່ບໍ່ມີເຫດຜົນອີກ.
  let restored = "";
  if (wasStatus === 2 && productCode) {
    const cleared = await clearCancelRequest(productCode);
    restored = cleared.ok ? " · ຖອນຄຳຂໍຍົກເລີກໃຫ້ນຳ ⇒ ວຽກກັບຄືນສາຍງານປົກກະຕິ" : "";
  }

  if (productCode) {
    await logChange(
      "tb_product",
      productCode,
      `ຖອນຄຳຕອບຂອງລູກຄ້າ (${wasStatus === 1 ? "ຕົກລົງ" : "ບໍ່ຕົກລົງ"}) ໃບສະເໜີລາຄາ ${docNo}${restored} — ກັບເປັນ ລໍຖ້າລູກຄ້າອະນຸມັດ`,
      { roles: ROLE_APPROVER, users: owner ? [owner] : [] },
    );
  }

  revalidateAll();
  revalidatePath("/service/cancel");
  revalidatePath("/approvals/cancellations", "layout");
  return {};
}

/* ───────── ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ ───────── */

/**
 * ຄື /save_apfinish — ແຕ່ບວກເລື່ອງອາໄຫຼ່ (GAP B).
 *
 * ຍົກເລີກວຽກແລ້ວ ອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງໄປແລ້ວຍັງຄ້າງຢູ່ນອກສາງ. ບ່ອນນີ້ **ບໍ່** ຍ້າຍສະຕັອກເອງ
 * (ຫ້າມເຄື່ອນໄຫວສະຕັອກແບບງຽບໆ) — ພຽງແຕ່:
 *   1. ບັນທຶກເຕືອນໃນ chatter ແລະ ແຈ້ງສາງ ວ່າຍັງມີອາໄຫຼ່ຄ້າງ
 *   2. ພາຜູ້ໃຊ້ໄປໜ້າລາຍລະອຽດ ທີ່ມີປຸ່ມ "ຂໍສົ່ງຄືນອາໄຫຼ່" ຂອງຂັ້ນຕອນເກົ່າ (/stock/returns → ໃບ 59)
 */
export async function approveCancellation(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  // ແຕ່ກ່ອນກວດແຕ່ "login ຢູ່ບໍ" ⇒ ໃຜກໍ່ຍິງ action ນີ້ໄດ້. ດຽວນີ້ຕ້ອງເປັນຜູ້ອະນຸມັດ (ຄືສິດເຂົ້າ /approvals)
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດການຍົກເລີກ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  const parsed = z.object({ pro_code: z.string().trim().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ບໍ່ພົບລະຫັດເຄື່ອງ" };
  const productCode = parsed.data.pro_code;

  let approved = false;
  let outstanding = { lines: 0, units: 0 };
  try {
    const done = await query(
      `update tb_product set cancel_finish=localtimestamp(0), approve_cancel=$1
       where code=$2 and status=6 and cancel_start is not null and cancel_finish is null`,
      [session.username, productCode],
    );
    approved = Boolean(done.rowCount);

    const spares = await query<{ lines: number; units: number }>(
      `select count(*)::int lines, coalesce(sum(d.qty),0)::float units
       from ic_trans t
       join ic_trans_detail d on d.doc_no = t.doc_no
       where t.trans_flag=$1 and t.product_code=$2 and d.status=$3`,
      [TRANS.DISPATCH, productCode, LINE_STATUS.PENDING],
    );
    outstanding = spares.rows[0] ?? outstanding;
  } catch (error) {
    console.error("approveCancellation failed", error);
    return { error: "ອະນຸມັດບໍ່ສຳເລັດ" };
  }

  if (approved) {
    await logChange("tb_product", productCode, "ອະນຸມັດການຍົກເລີກໃບຮັບເຄື່ອງ");
    if (outstanding.lines > 0) {
      await logChange(
        "tb_product",
        productCode,
        `ເຕືອນ: ຍັງມີອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງແລ້ວ ${outstanding.lines} ລາຍການ (${outstanding.units} ໜ່ວຍ) ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ — ຕ້ອງສ້າງໃບຂໍສົ່ງອາໄຫຼ່ຄືນ`,
        { roles: ROLE_WAREHOUSE },
      );
    }
  }

  revalidateAll();
  revalidatePath("/returns", "layout");
  revalidatePath("/service/cancel");
  // ມີອາໄຫຼ່ຄ້າງ → ຢູ່ໜ້າລາຍລະອຽດ ເພື່ອໃຫ້ເຫັນຄຳເຕືອນ ແລະ ກົດຂໍສົ່ງຄືນໄດ້ທັນທີ
  redirect(outstanding.lines > 0 ? `/approvals/cancellations/${encodeURIComponent(productCode)}` : "/approvals/cancellations");
}

/**
 * ບໍ່ອະນຸມັດການຍົກເລີກ — ບໍ່ມີໃນ ods ເລີຍ (ຜູ້ອະນຸມັດມີແຕ່ປຸ່ມ "ອະນຸມັດ" ດຽວ
 * ⇒ ຄຳຂໍທີ່ບໍ່ຄວນຍົກເລີກ ຄ້າງຢູ່ຄິວຕະຫຼອດ ຫຼື ຖືກອະນຸມັດໄປທັງທີ່ບໍ່ຄວນ).
 *
 * ຜົນ: ລ້າງຄຳຂໍຍົກເລີກ (status ຄືນສູ່ຂັ້ນຈິງ, cancel_start / request_cancel / remark ຖືກລ້າງ)
 * ⇒ ວຽກກັບເຂົ້າສາຍງານປົກກະຕິ ຄືກັບບໍ່ເຄີຍຂໍຍົກເລີກ. ບໍ່ມີການເຄື່ອນໄຫວສະຕັອກ ຫຼື ເອກະສານເງິນ
 * ໃດຖືກແຕະ (ອາໄຫຼ່ທີ່ເບີກອອກໄປແລ້ວຍັງຢູ່ກັບວຽກຄືເກົ່າ ເພາະວຽກຍັງດຳເນີນຕໍ່).
 *
 * ກົດ: ຜູ້ອະນຸມັດ (ຜູ້ຈັດການ + ຫົວໜ້າຊ່າງ) ເທົ່ານັ້ນ · ຕ້ອງມີເຫດຜົນ ·
 *      ອະນຸມັດຍົກເລີກໄປແລ້ວ (cancel_finish) ຫ້າມກັບຄືນ — ເພາະຂັ້ນຕໍ່ໄປ (ສົ່ງຄືນ/ໃບຮັບເງິນ)
 *      ອາດເລີ່ມແລ້ວ. ⇒ ໃຊ້ clearCancelRequest() ຂອງ actions/service.ts ທີ່ກັນເງື່ອນໄຂນີ້ຢູ່ SQL.
 */
export async function rejectCancellation(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດການຍົກເລີກ");
  if (!guard.ok) return { error: guard.error };

  const parsed = z
    .object({ pro_code: z.string().trim().min(1), reason: z.string().trim().min(1) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "ກະລຸນາລະບຸເຫດຜົນທີ່ບໍ່ອະນຸມັດການຍົກເລີກ — ຜູ້ຂໍຕ້ອງຮູ້ວ່າຍ້ອນຫຍັງ" };
  }
  const { pro_code: productCode, reason } = parsed.data;

  const cleared = await clearCancelRequest(productCode);
  if (!cleared.ok) return { error: cleared.error ?? "ບໍ່ອະນຸມັດການຍົກເລີກບໍ່ສຳເລັດ" };

  // ແຈ້ງຜູ້ຂໍໂດຍກົງ — ລາວແມ່ນຄົນທີ່ຕ້ອງຮູ້ວ່າວຽກກັບເຂົ້າສາຍງານຄືນແລ້ວ
  const previous = cleared.reason ? ` · ຄຳຂໍເດີມ: ${cleared.reason}` : "";
  await logChange(
    "tb_product",
    productCode,
    `ບໍ່ອະນຸມັດການຍົກເລີກ · ເຫດຜົນ: ${reason}${previous} — ວຽກກັບຄືນສູ່ຂັ້ນຕອນປົກກະຕິ`,
    { users: cleared.requester ? [cleared.requester] : [] },
  );

  revalidateAll();
  revalidatePath("/service/cancel");
  revalidatePath("/service");
  revalidatePath(`/service/${productCode}`);
  redirect("/approvals/cancellations");
}
