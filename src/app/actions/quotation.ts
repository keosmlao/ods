"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import { ROLE_APPROVER } from "@/lib/chatter";
import { db, query } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * ຖອດແບບຈາກ ods/qt.py — ໃບສະເໜີລາຄາ (ic_trans trans_flag=17)
 * ການແກ້ໄຂລາຍການທັງໝົດເກີດຢູ່ຕາຕະລາງຮ່າງ ic_trans_detail_draft
 *  - ຕອນສ້າງ:  ຮ່າງຜູກກັບ product_code (doc_no ຫວ່າງ)
 *  - ຕອນແກ້ໄຂ: ຮ່າງຜູກກັບ doc_no
 */

export type QuoteState = { error?: string };

/** ລ້າງເຄື່ອງໝາຍ , ອອກ ແລ້ວປ່ຽນເປັນຕົວເລກ (ຄື .replace(',','') ຂອງ ods) */
function toNumber(value: FormDataEntryValue | null) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function revalidateAll() {
  revalidatePath("/quotations", "layout");
  revalidatePath("/approvals", "layout");
}

/* ───────────────────────── ລາຍການໃນຮ່າງ ───────────────────────── */

const itemSchema = z.object({
  productCode: z.string().min(1),
  docNo: z.string().nullable(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  unitCode: z.string(),
  price: z.number(),
});

/** ຄື /choseitem ແລະ /choseitemeditqt */
export async function addDraftItem(input: z.input<typeof itemSchema>): Promise<QuoteState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { error: "ຂໍ້ມູນລາຍການບໍ່ຄົບ" };
  const d = parsed.data;

  try {
    await query(
      `insert into ic_trans_detail_draft(product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created, doc_no)
       values($1,$2,$3,1,$4,$5,$5,$6,$7)`,
      [d.productCode, d.itemCode, d.itemName, d.unitCode, d.price, session.username, d.docNo],
    );
  } catch (error) {
    console.error("addDraftItem failed", error);
    return { error: "ເພີ່ມລາຍການບໍ່ສຳເລັດ" };
  }
  revalidateAll();
  return {};
}

/** ຄື /addprice ແລະ /addprice_qt */
export async function setDraftPrice(roworder: number, price: number): Promise<QuoteState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isInteger(roworder) || !Number.isFinite(price) || price < 0) return { error: "ລາຄາບໍ່ຖືກຕ້ອງ" };

  try {
    await query(
      "update ic_trans_detail_draft set price=$1, sum_amount=$1*qty where roworder=$2",
      [price, roworder],
    );
  } catch (error) {
    console.error("setDraftPrice failed", error);
    return { error: "ບັນທຶກລາຄາບໍ່ສຳເລັດ" };
  }
  revalidateAll();
  return {};
}

/** ຄື /deleteitemqt ແລະ /deleteitemeditqt */
export async function deleteDraftItem(roworder: number): Promise<QuoteState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isInteger(roworder)) return { error: "ລາຍການບໍ່ຖືກຕ້ອງ" };

  try {
    await query("delete from ic_trans_detail_draft where roworder=$1", [roworder]);
  } catch (error) {
    console.error("deleteDraftItem failed", error);
    return { error: "ລຶບລາຍການບໍ່ສຳເລັດ" };
  }
  revalidateAll();
  return {};
}

/* ───────────────────────── ບັນທຶກໃບສະເໜີລາຄາ ───────────────────────── */

/**
 * ຄື /save_qt — ແຕ່ຄິດໄລ່ຍອດຢູ່ server (ods ຮັບຍອດທີ່ browser ສົ່ງມາ)
 * ແລະ ອອກເລກທີຄືນໃໝ່ພາຍໃນ transaction ທີ່ລັອກແລ້ວ ຈຶ່ງບໍ່ຊ້ຳ
 */
export async function saveQuote(_: QuoteState, formData: FormData): Promise<QuoteState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const productCode = String(formData.get("pro_code") ?? "");
  const custCode = String(formData.get("cust_code") ?? "");
  const docDate = String(formData.get("doc_date") ?? "");
  const remark = String(formData.get("remark") ?? "");
  const discount = toNumber(formData.get("total_discount_baht"));
  const rate = toNumber(formData.get("currency_rate"));
  if (!productCode || !custCode || !docDate) return { error: "ຂໍ້ມູນຫົວບິນບໍ່ຄົບ" };
  if (discount < 0 || rate < 0) return { error: "ສ່ວນຫຼຸດ ຫຼື ອັດຕາເເລກປ່ຽນບໍ່ຖືກຕ້ອງ" };

  const client = await db.connect();
  let docNo = "";
  let quoteTotal = 0;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734217)");

    const lines = await client.query<{ total: string; count: string }>(
      `select coalesce(sum(sum_amount),0) total, count(*) count
       from ic_trans_detail_draft where product_code=$1 and doc_no is null`,
      [productCode],
    );
    if (Number(lines.rows[0].count) === 0) {
      await client.query("rollback");
      return { error: "ຍັງບໍ່ມີລາຍການ — ກະລຸນາເລືອກລາຍການກ່ອນ" };
    }

    const exists = await client.query("select 1 from ic_trans where trans_flag=17 and product_code=$1", [productCode]);
    if (exists.rowCount) {
      await client.query("rollback");
      return { error: "ເຄື່ອງນີ້ມີໃບສະເໜີລາຄາແລ້ວ" };
    }

    const totalValue = Number(lines.rows[0].total);
    const totalAmount = totalValue - discount;
    const totalAmountKip = totalAmount * rate;
    quoteTotal = totalAmount;
    docNo = await nextDocNo(client, "QT");

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, cust_code, product_code, remark, user_created,
         currency_code, exchange_rate, total_amount_2, total_value, total_discount, total_amount)
       values(17,$1,$2,$3,$4,$5,$6,'01',$7,$8,$9,$10,$11)`,
      [docDate, docNo, custCode, productCode, remark, session.username, rate, totalAmountKip, totalValue, discount, totalAmount],
    );

    await client.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, cust_code, product_code, item_code, item_name,
         qty, unit_code, price, sum_amount, calc_flag, user_created)
       select 17,$1,$2,$3, product_code, item_code, item_name, qty, unit_code, price, sum_amount, 1, $4
       from ic_trans_detail_draft where product_code=$5 and doc_no is null`,
      [docDate, docNo, custCode, session.username, productCode],
    );

    await client.query("delete from ic_trans_detail_draft where product_code=$1 and doc_no is null", [productCode]);
    await client.query("update tb_product set qt_start=localtimestamp(0) where code=$1", [productCode]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveQuote failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  // ໃບສະເໜີລາຄາລໍຖ້າອະນຸມັດ → ແຈ້ງຜູ້ອະນຸມັດ (ods ຍິງ LINE Notify ຢູ່ຈຸດນີ້)
  await logChange(
    "tb_product",
    productCode,
    `ສ້າງໃບສະເໜີລາຄາ ${docNo} · ຍອດ ${quoteTotal.toLocaleString("en-US")} ບາດ — ລໍຖ້າອະນຸມັດ`,
    { roles: ROLE_APPROVER },
  );

  revalidateAll();
  // ods ເປີດ browser ຢູ່ server (webbrowser.open) — ບ່ອນນີ້ພາຜູ້ໃຊ້ໄປໜ້າພິມແທນ
  redirect(`/quotations/${docNo}/print`);
}

/* ───────────────────────── ແກ້ໄຂ ───────────────────────── */

/** ຄື /before_edit_qt — ລ້າງຮ່າງເກົ່າ ແລ້ວ copy ຈາກ ic_trans_detail ມາໃສ່ຮ່າງ */
export async function beginEditQuote(docNo: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!db) throw new Error("DATABASE_URL is not configured");

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("delete from ic_trans_detail_draft where doc_no=$1", [docNo]);
    await client.query(
      `insert into ic_trans_detail_draft(product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created, doc_no)
       select product_code, item_code, item_name, qty, unit_code, price, sum_amount, $1, $2
       from ic_trans_detail where doc_no=$2`,
      [session.username, docNo],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("beginEditQuote failed", error);
    throw error;
  } finally {
    client.release();
  }

  revalidateAll();
  redirect(`/quotations/${encodeURIComponent(docNo)}/edit`);
}

/** ຄື /exit_edit_qt — ອອກໂດຍບໍ່ບັນທຶກ, ລຶບຮ່າງຖິ້ມ */
export async function exitEditQuote(docNo: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  await query("delete from ic_trans_detail_draft where doc_no=$1", [docNo]);
  revalidateAll();
  redirect("/quotations");
}

/**
 * ຄື /editsubmit_qt — ແຕ່ບັນທຶກລາຍການທັງໝົດຄືນ (ods ບັນທຶກສະເພາະ item_code ຂຶ້ນຕົ້ນ '9900'
 * ເຮັດໃຫ້ລາຍການບໍລິການທີ່ເພີ່ມໃໝ່ຫາຍໄປ)
 */
export async function saveQuoteEdit(_: QuoteState, formData: FormData): Promise<QuoteState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docNo = String(formData.get("doc_no") ?? "");
  const custCode = String(formData.get("cust_code") ?? "");
  const docDate = String(formData.get("doc_date") ?? "");
  const remark = String(formData.get("remark") ?? "");
  const discount = toNumber(formData.get("total_discount_baht"));
  const rate = toNumber(formData.get("currency_rate"));
  if (!docNo || !custCode || !docDate) return { error: "ຂໍ້ມູນຫົວບິນບໍ່ຄົບ" };
  if (discount < 0 || rate < 0) return { error: "ສ່ວນຫຼຸດ ຫຼື ອັດຕາເເລກປ່ຽນບໍ່ຖືກຕ້ອງ" };

  const client = await db.connect();
  let productCode = "";
  let quoteTotal = 0;
  try {
    await client.query("begin");

    const lines = await client.query<{ total: string; count: string }>(
      "select coalesce(sum(sum_amount),0) total, count(*) count from ic_trans_detail_draft where doc_no=$1",
      [docNo],
    );
    if (Number(lines.rows[0].count) === 0) {
      await client.query("rollback");
      return { error: "ຍັງບໍ່ມີລາຍການ — ກະລຸນາເລືອກລາຍການກ່ອນ" };
    }

    // ເອົາລະຫັດເຄື່ອງໄວ້ຂຽນ log ໃສ່ໃບຮັບເຄື່ອງ (ຟອມບໍ່ໄດ້ສົ່ງມາ)
    const head = await client.query<{ product_code: string | null }>(
      "select product_code from ic_trans where doc_no=$1 and trans_flag=17 limit 1",
      [docNo],
    );
    productCode = head.rows[0]?.product_code ?? "";

    const totalValue = Number(lines.rows[0].total);
    const totalAmount = totalValue - discount;
    quoteTotal = totalAmount;

    await client.query(
      `update ic_trans set doc_date=$1, remark=$2, user_created=$3, exchange_rate=$4,
         total_amount_2=$5, total_value=$6, total_discount=$7, total_amount=$8
       where doc_no=$9 and trans_flag=17`,
      [docDate, remark, session.username, rate, totalAmount * rate, totalValue, discount, totalAmount, docNo],
    );

    await client.query("delete from ic_trans_detail where doc_no=$1", [docNo]);
    await client.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, cust_code, product_code, item_code, item_name,
         qty, unit_code, price, sum_amount, calc_flag, user_created)
       select 17,$1,$2,$3, product_code, item_code, item_name, qty, unit_code, price, sum_amount, 1, $4
       from ic_trans_detail_draft where doc_no=$2`,
      [docDate, docNo, custCode, session.username],
    );
    await client.query("delete from ic_trans_detail_draft where doc_no=$1", [docNo]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveQuoteEdit failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  if (productCode) {
    await logChange(
      "tb_product",
      productCode,
      `ແກ້ໄຂໃບສະເໜີລາຄາ ${docNo} · ຍອດ ${quoteTotal.toLocaleString("en-US")} ບາດ`,
    );
  }

  revalidateAll();
  redirect(`/quotations/${encodeURIComponent(docNo)}/print`);
}

/* ───────────────────────── ຍົກເລີກໃບສະເໜີລາຄາ ───────────────────────── */

/** ຄື /qtcancle — ລຶບໃບສະເໜີລາຄາ ແລ້ວປ່ອຍເຄື່ອງກັບຄືນຄິວ */
export async function cancelQuote(docNo: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!db) throw new Error("DATABASE_URL is not configured");

  const client = await db.connect();
  let cancelledFor = "";
  try {
    await client.query("begin");
    const head = await client.query<{ product_code: string | null }>(
      "select product_code from ic_trans where doc_no=$1 and trans_flag=17",
      [docNo],
    );
    const productCode = head.rows[0]?.product_code;
    await client.query("delete from ic_trans where doc_no=$1 and trans_flag=17", [docNo]);
    await client.query("delete from ic_trans_detail where doc_no=$1", [docNo]);
    await client.query("delete from ic_trans_detail_draft where doc_no=$1", [docNo]);
    if (productCode) await client.query("update tb_product set qt_start=null where code=$1", [productCode]);
    await client.query("commit");
    cancelledFor = productCode ?? "";
  } catch (error) {
    await client.query("rollback");
    console.error("cancelQuote failed", error);
    throw error;
  } finally {
    client.release();
  }

  if (cancelledFor) await logChange("tb_product", cancelledFor, `ຍົກເລີກໃບສະເໜີລາຄາ ${docNo}`);

  revalidateAll();
  redirect("/quotations");
}
