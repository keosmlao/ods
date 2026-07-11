"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession, type Session } from "@/lib/auth";
import { ROLE_APPROVER, ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, query } from "@/lib/db";
import { APPROVER_SIDE, roleOf, SERVICE_SIDE } from "@/lib/roles";
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
type Guard = { ok: true; session: Session } | { ok: false; error: string };

async function requireRole(allowed: readonly string[], denied: string): Promise<Guard> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session ໝົດອາຍຸ" };
  if (!allowed.includes(roleOf(session))) return { ok: false, error: denied };
  return { ok: true, session };
}

const requireApprover = () => requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດໃບສະເໜີລາຄາ");
const requireService = () => requireRole(SERVICE_SIDE, "ບໍ່ມີສິດບັນທຶກຄຳຕອບຂອງລູກຄ້າ");

/* ───────── ອະນຸມັດພາຍໃນ (ຊັ້ນ 1) ───────── */

/** ຄື /approveqtbill */
export async function approveQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireApprover();
  if (!guard.ok) return { error: guard.error };
  const docNo = String(formData.get("doc_no") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  let productCode = "";
  try {
    // returning → ໄດ້ລະຫັດເຄື່ອງມາຂຽນ log ໂດຍບໍ່ຕ້ອງ query ຊ້ຳ (ຟອມບໍ່ໄດ້ສົ່ງມາ)
    const approved = await query<{ product_code: string | null }>(
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), aprove_status=1
       where doc_no=$3 and trans_flag=17 and coalesce(aprove_status,0)=0 and coalesce(aprove_status_2,0)=0
       returning product_code`,
      [remark, guard.session.username, docNo],
    );
    if (!approved.rowCount) return { error: "ໃບສະເໜີລາຄານີ້ຖືກດຳເນີນການໄປແລ້ວ" };
    productCode = approved.rows[0]?.product_code ?? "";
  } catch (error) {
    console.error("approveQuote failed", error);
    return { error: "ອະນຸມັດບໍ່ສຳເລັດ" };
  }

  if (productCode) {
    await logChange(
      "tb_product",
      productCode,
      `ອະນຸມັດໃບສະເໜີລາຄາ ${docNo} (ພາຍໃນ)${remark.trim() ? ` · ${remark.trim()}` : ""}`,
    );
  }

  revalidateAll();
  redirect("/approvals/quotations");
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
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), aprove_status=2
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

/** ຄື /approveqt_bycust */
export async function customerApproveQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  let productCode = "";
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const client = await db.connect();
  try {
    await client.query("begin");
    const done = await client.query<{ product_code: string | null }>(
      `update ic_trans set aprove_date2=localtime(0), aprove_status_2=1
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

  if (productCode) await logChange("tb_product", productCode, `ລູກຄ້າຕົກລົງໃບສະເໜີລາຄາ ${docNo}`);

  revalidateAll();
  redirect("/quotations/customer-approval");
}

/**
 * ຄື /not_approveqt_bycust — ລູກຄ້າບໍ່ອະນຸມັດ → ເຄື່ອງເຂົ້າຂັ້ນຕອນຂໍຍົກເລີກ (status=6)
 *
 * tb_product.remark = "ເຫດຜົນການຍົກເລີກ" ທີ່ໜ້າ /approvals/cancellations ສະແດງ (ຊ່ອງ ໝາຍເຫດ).
 * ເສັ້ນທາງນີ້ບໍ່ເຄີຍຂຽນມັນເລີຍ ⇒ ຜູ້ອະນຸມັດເຫັນເຫດຜົນຫວ່າງພໍດີກັບເຄສທີ່ສຳຄັນທີ່ສຸດ.
 * ບ່ອນນີ້ຈຶ່ງບັນທຶກເຫດຜົນເປັນພາສາລາວໃຫ້ຄົບ (+ ໝາຍເຫດຂອງ CS ຖ້າມີ).
 */
export async function customerRejectQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  const note = String(formData.get("remark") ?? "").trim();
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const reason = `ລູກຄ້າບໍ່ຕົກລົງລາຄາ (ໃບສະເໜີລາຄາ ${docNo})${note ? ` · ${note}` : ""}`;

  const client = await db.connect();
  let productCode = "";
  try {
    await client.query("begin");
    const done = await client.query<{ product_code: string | null }>(
      `update ic_trans set aprove_date2=localtime(0), aprove_status_2=2
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
    await logChange("tb_product", productCode, `${reason} — ເຂົ້າຂັ້ນຕອນຂໍຍົກເລີກ`, { roles: ROLE_APPROVER });
  }

  revalidateAll();
  redirect("/quotations/customer-approval");
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
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
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
