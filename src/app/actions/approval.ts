"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import { db, query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

/* ───────── ອະນຸມັດພາຍໃນ (ຊັ້ນ 1) ───────── */

/** ຄື /approveqtbill */
export async function approveQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  const docNo = String(formData.get("doc_no") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  let productCode = "";
  try {
    // returning → ໄດ້ລະຫັດເຄື່ອງມາຂຽນ log ໂດຍບໍ່ຕ້ອງ query ຊ້ຳ (ຟອມບໍ່ໄດ້ສົ່ງມາ)
    const approved = await query<{ product_code: string | null }>(
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), aprove_status=1
       where doc_no=$3 and trans_flag=17 and aprove_status=0
       returning product_code`,
      [remark, session.username, docNo],
    );
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

/** ຄື /not_approveqtbill — ບໍ່ອະນຸມັດ ແລ້ວປ່ອຍເຄື່ອງກັບຄືນຄິວສະເໜີລາຄາ */
export async function rejectQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  const productCode = String(formData.get("pro_id") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), aprove_status=2
       where doc_no=$3 and trans_flag=17 and aprove_status=0`,
      [remark, session.username, docNo],
    );
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
    await logChange(
      "tb_product",
      productCode,
      `ບໍ່ອະນຸມັດໃບສະເໜີລາຄາ ${docNo} (ພາຍໃນ)${remark.trim() ? ` · ${remark.trim()}` : ""}`,
    );
  }

  revalidateAll();
  redirect("/approvals/quotations");
}

/* ───────── ລູກຄ້າອະນຸມັດ (ຊັ້ນ 2) ───────── */

/** ຄື /approveqt_bycust */
export async function customerApproveQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  const productCode = String(formData.get("pro_id") ?? "");
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      `update ic_trans set aprove_date2=localtime(0), aprove_status_2=1
       where doc_no=$1 and trans_flag=17 and aprove_status=1 and aprove_status_2=0`,
      [docNo],
    );
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

/** ຄື /not_approveqt_bycust — ລູກຄ້າບໍ່ອະນຸມັດ → ເຄື່ອງເຂົ້າຂັ້ນຕອນຂໍຍົກເລີກ (status=6) */
export async function customerRejectQuote(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const docNo = String(formData.get("doc_no") ?? "");
  const productCode = String(formData.get("pro_id") ?? "");
  if (!docNo) return { error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      `update ic_trans set aprove_date2=localtime(0), aprove_status_2=2
       where doc_no=$1 and trans_flag=17 and aprove_status=1 and aprove_status_2=0`,
      [docNo],
    );
    if (productCode) {
      await client.query(
        `update tb_product set qt_finish=localtimestamp(0), status=6,
           cancel_start=localtimestamp(0), request_cancel=$1 where code=$2`,
        [session.username, productCode],
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
    await logChange("tb_product", productCode, `ລູກຄ້າບໍ່ຕົກລົງໃບສະເໜີລາຄາ ${docNo} — ເຂົ້າຂັ້ນຕອນຂໍຍົກເລີກ`);
  }

  revalidateAll();
  redirect("/quotations/customer-approval");
}

/* ───────── ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ ───────── */

/** ຄື /save_apfinish */
export async function approveCancellation(_: ApprovalState, formData: FormData): Promise<ApprovalState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  const productCode = String(formData.get("pro_code") ?? "");
  if (!productCode) return { error: "ບໍ່ພົບລະຫັດເຄື່ອງ" };

  let approved = false;
  try {
    const done = await query(
      `update tb_product set cancel_finish=localtimestamp(0), approve_cancel=$1
       where code=$2 and status=6 and cancel_start is not null and cancel_finish is null`,
      [session.username, productCode],
    );
    approved = Boolean(done.rowCount);
  } catch (error) {
    console.error("approveCancellation failed", error);
    return { error: "ອະນຸມັດບໍ່ສຳເລັດ" };
  }

  if (approved) await logChange("tb_product", productCode, "ອະນຸມັດການຍົກເລີກໃບຮັບເຄື່ອງ");

  revalidateAll();
  redirect("/approvals/cancellations");
}
