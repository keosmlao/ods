"use server";
import { logChange } from "@/lib/chatter-log";
import type { Session } from "@/lib/auth";
import { ROLE_APPROVER } from "@/lib/chatter";
import { db, query } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { requirePermission, requireRole } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * ຖອດແບບຈາກ ods/qt.py — ໃບສະເໜີລາຄາ (ic_trans trans_flag=17)
 * ການແກ້ໄຂລາຍການທັງໝົດເກີດຢູ່ຕາຕະລາງຮ່າງ ic_trans_detail_draft
 *  - ຕອນສ້າງ:  ຮ່າງຜູກກັບ product_code (doc_no ຫວ່າງ)
 *  - ຕອນແກ້ໄຂ: ຮ່າງຜູກກັບ doc_no
 *
 * ⚠ ຕາຕະລາງຮ່າງນີ້ **ໃຊ້ຮ່ວມກັບຂັ້ນຕອນອື່ນ** (ຕະກ້າໃບຮັບເງິນ trans_flag=44 ຂອງ actions/return.ts,
 * ແລະ trans_flag=12/33 ຂອງຂັ້ນຕອນສາງ). ຮ່າງຂອງໃບສະເໜີລາຄາ = trans_flag **ຫວ່າງ (null)** ເທົ່ານັ້ນ.
 * ທຸກ query ຂອງໄຟລ໌ນີ້ຈຶ່ງຕ້ອງໃສ່ QUOTE_DRAFT — ບໍ່ດັ່ງນັ້ນ ລຶບ/ແກ້ລາຄາ ຈະໄປໂດນຕະກ້າຂອງຄົນອື່ນ.
 *
 * ── ວົງຈອນສະຖານະ (ic_trans.aprove_status / aprove_status_2) ──
 *   0/0 ລໍຖ້າອະນຸມັດພາຍໃນ   → ແກ້ໄຂໄດ້ · ລຶບໄດ້
 *   2/0 ບໍ່ອະນຸມັດພາຍໃນ     → ແກ້ໄຂແລ້ວສົ່ງອະນຸມັດຄືນໄດ້ (ກັບເປັນ 0/0) · ຫຼື ລຶບຖິ້ມແລ້ວອອກໃບໃໝ່
 *                            · ຜູ້ອະນຸມັດຖອນຄືນໄດ້ (undoQuoteApproval → 0/0)
 *   1/0 ອະນຸມັດພາຍໃນແລ້ວ    → ແກ້ໄຂໄດ້ ແຕ່ **ຕ້ອງອະນຸມັດຄືນໃໝ່** (ຕັດກັບເປັນ 0/0) · ລຶບບໍ່ໄດ້
 *                            · ຜູ້ອະນຸມັດຖອນຄືນໄດ້ (undoQuoteApproval → 0/0)
 *   1/1, 1/2 ລູກຄ້າຕອບແລ້ວ  → ແກ້ໄຂ/ລຶບບໍ່ໄດ້ · ແຕ່ **ຖອນຄຳຕອບຂອງລູກຄ້າໄດ້**
 *                            (undoCustomerDecision → 1/0) ຕາບໃດທີ່ຍັງບໍ່ມີໃບຮັບເງິນ
 * ກົດເກນນີ້ບັງຄັບຢູ່ຝັ່ງ server (ຂ້າງລຸ່ມ) ບໍ່ແມ່ນແຕ່ຢູ່ປຸ່ມ — ເອີ້ນ action ໂດຍກົງກໍ່ຜ່ານບໍ່ໄດ້.
 */

export type QuoteState = { error?: string };

/** ຮ່າງຂອງໃບສະເໜີລາຄາເທົ່ານັ້ນ (ບໍ່ແມ່ນຕະກ້າໃບຮັບເງິນ 44 / ຮ່າງສາງ 12,33) */
const QUOTE_DRAFT = "trans_flag is null";

/** ລ້າງເຄື່ອງໝາຍ , ອອກ ແລ້ວປ່ຽນເປັນຕົວເລກ (ຄື .replace(',','') ຂອງ ods) */
function toNumber(value: FormDataEntryValue | null) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function revalidateAll() {
  revalidatePath("/quotations", "layout");
  revalidatePath("/approvals", "layout");
}

/* ───────────────────────── ສິດ ───────────────────────── */

type Guard = { ok: true; session: Session } | { ok: false; error: string };

/**
 * ອອກ / ແກ້ໄຂ / ລຶບ ໃບສະເໜີລາຄາ = ຝ່າຍບໍລິການ (ຜູ້ຈັດການ + CS) ຄືກັບສິດເຂົ້າໜ້າ /quotations.
 * middleware ກັນສະເພາະ "ໜ້າ" — server action ຖືກຍິງໂດຍກົງໄດ້ ຈຶ່ງຕ້ອງກວດສິດຢູ່ນີ້ອີກຊັ້ນ.
 */
async function requireService(): Promise<Guard> {
  return requireRole(SERVICE_SIDE, "ບໍ່ມີສິດອອກ ຫຼື ແກ້ໄຂໃບສະເໜີລາຄາ");
}

/** ສະຖານະປັດຈຸບັນຂອງໃບສະເໜີລາຄາ (ລັອກແຖວໄວ້ ກັນສອງຄົນລົງມືພ້ອມກັນ) */
type QuoteHead = { product_code: string | null; aprove_status: number; aprove_status_2: number };

const HEAD_COLS = `product_code, coalesce(aprove_status,0)::int aprove_status,
    coalesce(aprove_status_2,0)::int aprove_status_2`;

const HEAD_SQL = `select ${HEAD_COLS} from ic_trans where doc_no=$1 and trans_flag=17 for update`;

/** ອ່ານສະຖານະຢູ່ນອກ transaction (ບໍ່ລັອກ) — ໃຊ້ກວດກ່ອນແຕະຮ່າງ */
const HEAD_SQL_READ = `select ${HEAD_COLS} from ic_trans where doc_no=$1 and trans_flag=17 limit 1`;

/**
 * ແກ້ໄຂໄດ້ບໍ? — ຄືນຂໍ້ຄວາມຜິດພາດເປັນພາສາລາວ ຖ້າບໍ່ໄດ້.
 * ລູກຄ້າຕອບກັບແລ້ວ (1/1 ຫຼື 1/2) = ວຽກຜ່ານຂັ້ນສະເໜີລາຄາໄປແລ້ວ ⇒ ຫ້າມແຕະ.
 * ອະນຸມັດພາຍໃນແລ້ວ (1/0) = ແກ້ໄຂໄດ້ ແຕ່ saveQuoteEdit ຈະຕັດໃຫ້ອະນຸມັດຄືນໃໝ່.
 */
function blockEdit(head: QuoteHead | undefined): string | null {
  if (!head) return "ບໍ່ພົບໃບສະເໜີລາຄາ";
  if (head.aprove_status_2 !== 0) return "ລູກຄ້າຕອບກັບໃບສະເໜີລາຄານີ້ແລ້ວ — ແກ້ໄຂບໍ່ໄດ້";
  return null;
}

/** ລຶບໄດ້ບໍ? — ເຂັ້ມກວ່າແກ້ໄຂ: ໃບທີ່ອະນຸມັດແລ້ວ ລຶບຖິ້ມງຽບໆບໍ່ໄດ້ */
function blockDelete(head: QuoteHead | undefined): string | null {
  if (!head) return "ບໍ່ພົບໃບສະເໜີລາຄາ";
  if (head.aprove_status_2 !== 0) return "ລູກຄ້າຕອບກັບໃບສະເໜີລາຄານີ້ແລ້ວ — ລຶບບໍ່ໄດ້";
  if (head.aprove_status === 1) {
    return "ໃບສະເໜີລາຄານີ້ອະນຸມັດພາຍໃນແລ້ວ — ລຶບບໍ່ໄດ້ (ຖ້າຕ້ອງປ່ຽນລາຄາ ໃຫ້ແກ້ໄຂ ແລ້ວຂໍອະນຸມັດຄືນ)";
  }
  return null;
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

/**
 * ແຖວຮ່າງນີ້ແກ້ໄຂໄດ້ບໍ? — ຕ້ອງເປັນຮ່າງຂອງໃບສະເໜີລາຄາ (trans_flag ຫວ່າງ) ແລະ
 * ຖ້າຜູກກັບໃບແລ້ວ (doc_no) ໃບນັ້ນຕ້ອງຍັງແກ້ໄຂໄດ້ຢູ່.
 * ⇒ ຍິງ action ໂດຍກົງດ້ວຍ roworder ຂອງຕະກ້າໃບຮັບເງິນ (flag 44) ຫຼື ຮ່າງສາງ ບໍ່ໄດ້ອີກ.
 */
async function guardDraftRow(roworder: number): Promise<string | null> {
  const row = (
    await query<{ doc_no: string | null }>(
      `select doc_no from ic_trans_detail_draft where roworder=$1 and ${QUOTE_DRAFT}`,
      [roworder],
    )
  ).rows[0];
  if (!row) return "ບໍ່ພົບລາຍການໃນຮ່າງໃບສະເໜີລາຄາ";
  if (!row.doc_no) return null;

  const head = (await query<QuoteHead>(HEAD_SQL_READ, [row.doc_no])).rows[0];
  return blockEdit(head);
}

/** ຄື /choseitem ແລະ /choseitemeditqt */
export async function addDraftItem(input: z.input<typeof itemSchema>): Promise<QuoteState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { error: "ຂໍ້ມູນລາຍການບໍ່ຄົບ" };
  const d = parsed.data;

  // ຕື່ມລາຍການໃສ່ໃບທີ່ລູກຄ້າຕອບກັບແລ້ວບໍ່ໄດ້ (ບໍ່ດັ່ງນັ້ນຮ່າງຄ້າງໄວ້ ບັນທຶກກໍ່ບໍ່ໄດ້)
  if (d.docNo) {
    const head = (await query<QuoteHead>(HEAD_SQL_READ, [d.docNo])).rows[0];
    const blocked = blockEdit(head);
    if (blocked) return { error: blocked };
  }

  try {
    await query(
      `insert into ic_trans_detail_draft(trans_flag, product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created, doc_no)
       values(null,$1,$2,$3,1,$4,$5,$5,$6,$7)`,
      [d.productCode, d.itemCode, d.itemName, d.unitCode, d.price, guard.session.username, d.docNo],
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
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!Number.isInteger(roworder) || !Number.isFinite(price) || price < 0) return { error: "ລາຄາບໍ່ຖືກຕ້ອງ" };

  try {
    const blocked = await guardDraftRow(roworder);
    if (blocked) return { error: blocked };
    await query(
      `update ic_trans_detail_draft set price=$1, sum_amount=$1*qty where roworder=$2 and ${QUOTE_DRAFT}`,
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
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!Number.isInteger(roworder)) return { error: "ລາຍການບໍ່ຖືກຕ້ອງ" };

  try {
    const blocked = await guardDraftRow(roworder);
    if (blocked) return { error: blocked };
    await query(`delete from ic_trans_detail_draft where roworder=$1 and ${QUOTE_DRAFT}`, [roworder]);
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
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const productCode = String(formData.get("pro_code") ?? "");
  const custCode = String(formData.get("cust_code") ?? "");
  const docDate = String(formData.get("doc_date") ?? "");
  const remark = String(formData.get("remark") ?? "");
  const discount = toNumber(formData.get("total_discount_baht"));
  const rate = toNumber(formData.get("currency_rate"));
  if (!productCode || !custCode || !docDate) return { error: "ຂໍ້ມູນຫົວບິນບໍ່ຄົບ" };
  if (discount < 0) return { error: "ສ່ວນຫຼຸດບໍ່ຖືກຕ້ອງ" };
  // ອັດຕາ 0 = ຍອດກີບ (total_amount_2) ຖືກເກັບເປັນ 0 ⇒ ເງິນຄິດໄລ່ແລ້ວແຕ່ບໍ່ໄດ້ເກັບ. ບໍ່ຮັບ.
  if (rate <= 0) return { error: "ອັດຕາເເລກປ່ຽນຕ້ອງຫຼາຍກວ່າ 0" };

  const client = await db.connect();
  let docNo = "";
  let quoteTotal = 0;
  let supersedes = "";
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734217)");

    const lines = await client.query<{ total: string; count: string }>(
      `select coalesce(sum(sum_amount),0) total, count(*) count
       from ic_trans_detail_draft where product_code=$1 and doc_no is null and ${QUOTE_DRAFT}`,
      [productCode],
    );
    if (Number(lines.rows[0].count) === 0) {
      await client.query("rollback");
      return { error: "ຍັງບໍ່ມີລາຍການ — ກະລຸນາເລືອກລາຍການກ່ອນ" };
    }

    const totalValue = Number(lines.rows[0].total);
    const totalAmount = totalValue - discount;
    if (totalAmount < 0) {
      await client.query("rollback");
      return { error: "ສ່ວນຫຼຸດຫຼາຍກວ່າຍອດລວມ — ຍອດສຸດທ້າຍຕິດລົບບໍ່ໄດ້" };
    }

    /**
     * ເຄື່ອງ 1 ໜ່ວຍ = ໃບສະເໜີລາຄາທີ່ຍັງມີຜົນ 1 ໃບ. ຖ້າມີແລ້ວ ບອກເລກທີ ແລະ ທາງອອກໃຫ້ຊັດ
     * (ບໍ່ດັ່ງນັ້ນໃບທີ່ "ບໍ່ອະນຸມັດ" ຈະກາຍເປັນທາງຕັນ: ອອກໃໝ່ກໍ່ບໍ່ໄດ້ ຫາໃບເກົ່າກໍ່ບໍ່ພົບ).
     *
     * ⚠ ໃບທີ່ **ລູກຄ້າບໍ່ຕົກລົງ (1/2)** ບໍ່ນັບເປັນໃບທີ່ຍັງມີຜົນ — ແກ້ບໍ່ໄດ້ ລຶບບໍ່ໄດ້ ອອກໃໝ່ບໍ່ໄດ້
     * = ທາງຕັນ (ໃນ ods ເກົ່າ ເຄື່ອງ 4869 ອອກໃບໃໝ່ຫຼັງລູກຄ້າປະຕິເສດໄດ້). ດຽວນີ້ອອກໃບໃໝ່ທັບໄດ້
     * ໂດຍໃບເກົ່າຄ້າງໄວ້ເປັນປະຫວັດ.
     */
    const exists = await client.query<{ doc_no: string; aprove_status: number; aprove_status_2: number }>(
      `select doc_no, coalesce(aprove_status,0)::int aprove_status,
          coalesce(aprove_status_2,0)::int aprove_status_2
       from ic_trans where trans_flag=17 and product_code=$1 and coalesce(aprove_status_2,0) <> 2
       order by doc_no desc limit 1`,
      [productCode],
    );
    if (exists.rowCount) {
      await client.query("rollback");
      const found = exists.rows[0];
      return {
        error:
          found.aprove_status === 2
            ? `ເຄື່ອງນີ້ມີໃບສະເໜີລາຄາ ${found.doc_no} ທີ່ບໍ່ໄດ້ຮັບອະນຸມັດຢູ່ແລ້ວ — ໃຫ້ແກ້ໄຂແລ້ວສົ່ງອະນຸມັດຄືນ ຫຼື ລຶບໃບເກົ່າອອກກ່ອນ (ແທັບ "ລໍຖ້າອອກໃບສະເໜີລາຄາ")`
            : `ເຄື່ອງນີ້ມີໃບສະເໜີລາຄາ ${found.doc_no} ແລ້ວ`,
      };
    }

    // ໃບເກົ່າທີ່ລູກຄ້າປະຕິເສດ — ບອກໄວ້ໃນ chatter ວ່າໃບໃໝ່ອອກມາທັບ
    const rejected = await client.query<{ doc_no: string }>(
      `select doc_no from ic_trans where trans_flag=17 and product_code=$1
        and coalesce(aprove_status_2,0)=2 order by doc_no desc limit 1`,
      [productCode],
    );
    supersedes = rejected.rows[0]?.doc_no ?? "";

    const totalAmountKip = totalAmount * rate;
    quoteTotal = totalAmount;
    docNo = await nextDocNo(client, "QT");

    // vat_rate / total_vat_value ຂຽນເປັນ 0 ຢ່າງຈະແຈ້ງ (ບໍ່ປ່ອຍ null) — ໜ້າພິມເຄີຍ coalesce(vat_rate,10)
    // ⇒ ໃບໃໝ່ພິມອອກມາເປັນ "ອມພ 10% = 0.00" ທັງທີ່ບໍ່ໄດ້ຄິດ ອມພ ເລີຍ
    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, cust_code, product_code, remark, user_created,
         currency_code, exchange_rate, total_amount_2, total_value, total_discount, vat_rate, total_vat_value, total_amount)
       values(17,$1,$2,$3,$4,$5,$6,'01',$7,$8,$9,$10,0,0,$11)`,
      [docDate, docNo, custCode, productCode, remark, session.username, rate, totalAmountKip, totalValue, discount, totalAmount],
    );

    await client.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, cust_code, product_code, item_code, item_name,
         qty, unit_code, price, sum_amount, calc_flag, user_created)
       select 17,$1,$2,$3, product_code, item_code, item_name, qty, unit_code, price, sum_amount, 1, $4
       from ic_trans_detail_draft where product_code=$5 and doc_no is null and ${QUOTE_DRAFT}`,
      [docDate, docNo, custCode, session.username, productCode],
    );

    await client.query(
      `delete from ic_trans_detail_draft where product_code=$1 and doc_no is null and ${QUOTE_DRAFT}`,
      [productCode],
    );
    // qt_finish ລ້າງຖິ້ມ: ໃບເກົ່າທີ່ລູກຄ້າປະຕິເສດປະທັບ qt_finish ໄວ້ ⇒ ວຽກຈະຂ້າມຂັ້ນ "ກຳລັງສະເໜີລາຄາ"
    await client.query(
      "update tb_product set qt_start=localtimestamp(0), qt_finish=null where code=$1",
      [productCode],
    );
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
    `ສ້າງໃບສະເໜີລາຄາ ${docNo} · ${money(quoteTotal)} ບາດ${discount > 0 ? ` (ຫຼັງສ່ວນຫຼຸດ ${money(discount)} ບາດ)` : ""} — ລໍຖ້າອະນຸມັດ` +
      (supersedes ? ` · ອອກທັບໃບ ${supersedes} ທີ່ລູກຄ້າບໍ່ຕົກລົງ` : ""),
    { roles: ROLE_APPROVER },
  );

  revalidateAll();
  // ods ເປີດ browser ຢູ່ server (webbrowser.open) — ບ່ອນນີ້ພາຜູ້ໃຊ້ໄປໜ້າພິມແທນ
  redirect(`/quotations/${docNo}/print`);
}

/* ───────────────────────── ແກ້ໄຂ ───────────────────────── */

/** ຄື /before_edit_qt — ລ້າງຮ່າງເກົ່າ ແລ້ວ copy ຈາກ ic_trans_detail ມາໃສ່ຮ່າງ */
export async function beginEditQuote(docNo: string): Promise<QuoteState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const client = await db.connect();
  try {
    await client.query("begin");
    const head = await client.query<QuoteHead>(HEAD_SQL, [docNo]);
    const blocked = blockEdit(head.rows[0]);
    if (blocked) {
      await client.query("rollback");
      return { error: blocked };
    }

    await client.query(`delete from ic_trans_detail_draft where doc_no=$1 and ${QUOTE_DRAFT}`, [docNo]);
    await client.query(
      `insert into ic_trans_detail_draft(trans_flag, product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created, doc_no)
       select null, product_code, item_code, item_name, qty, unit_code, price, sum_amount, $1, $2
       from ic_trans_detail where doc_no=$2 and trans_flag=17`,
      [guard.session.username, docNo],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("beginEditQuote failed", error);
    return { error: "ເປີດແກ້ໄຂບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  revalidateAll();
  redirect(`/quotations/${encodeURIComponent(docNo)}/edit`);
}

/** ຄື /exit_edit_qt — ອອກໂດຍບໍ່ບັນທຶກ, ລຶບຮ່າງຖິ້ມ (ປຸ່ມ "ອອກ" ⇒ ບໍ່ຄືນ state, ພາໄປໜ້າອື່ນເລີຍ) */
export async function exitEditQuote(docNo: string) {
  const guard = await requireService();
  if (!guard.ok) redirect("/forbidden");
  await query(`delete from ic_trans_detail_draft where doc_no=$1 and ${QUOTE_DRAFT}`, [docNo]);
  revalidateAll();
  redirect("/quotations");
}

/**
 * ຄື /editsubmit_qt — ແຕ່ບັນທຶກລາຍການທັງໝົດຄືນ (ods ບັນທຶກສະເພາະ item_code ຂຶ້ນຕົ້ນ '9900'
 * ເຮັດໃຫ້ລາຍການບໍລິການທີ່ເພີ່ມໃໝ່ຫາຍໄປ)
 *
 * ບ່ອນນີ້ຄື "ສົ່ງອະນຸມັດຄືນ" ນຳ: ທຸກຄັ້ງທີ່ລາຄາຖືກແກ້ ໃບນັ້ນຕັດກັບເປັນ ລໍຖ້າອະນຸມັດ (0/0)
 * ⇒ ໃບທີ່ "ບໍ່ອະນຸມັດ" ກັບເຂົ້າຄິວອະນຸມັດໄດ້ · ແລະ ລາຄາທີ່ອະນຸມັດແລ້ວ ຈະຖືກປ່ຽນລັບຫຼັງບໍ່ໄດ້.
 */
export async function saveQuoteEdit(_: QuoteState, formData: FormData): Promise<QuoteState> {
  const guard = await requireService();
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docNo = String(formData.get("doc_no") ?? "");
  const custCode = String(formData.get("cust_code") ?? "");
  const docDate = String(formData.get("doc_date") ?? "");
  const remark = String(formData.get("remark") ?? "");
  const discount = toNumber(formData.get("total_discount_baht"));
  const rate = toNumber(formData.get("currency_rate"));
  if (!docNo || !custCode || !docDate) return { error: "ຂໍ້ມູນຫົວບິນບໍ່ຄົບ" };
  if (discount < 0) return { error: "ສ່ວນຫຼຸດບໍ່ຖືກຕ້ອງ" };
  if (rate <= 0) return { error: "ອັດຕາເເລກປ່ຽນຕ້ອງຫຼາຍກວ່າ 0" };

  const client = await db.connect();
  let productCode = "";
  let quoteTotal = 0;
  let wasStatus = 0;
  try {
    await client.query("begin");

    // ເອົາລະຫັດເຄື່ອງ + ສະຖານະປັດຈຸບັນ (ຟອມບໍ່ໄດ້ສົ່ງມາ ແລະ ຟອມເຊື່ອບໍ່ໄດ້ຢູ່ແລ້ວ)
    const head = await client.query<QuoteHead>(HEAD_SQL, [docNo]);
    const blocked = blockEdit(head.rows[0]);
    if (blocked) {
      await client.query("rollback");
      return { error: blocked };
    }
    productCode = head.rows[0].product_code ?? "";
    wasStatus = head.rows[0].aprove_status;

    const lines = await client.query<{ total: string; count: string }>(
      `select coalesce(sum(sum_amount),0) total, count(*) count
       from ic_trans_detail_draft where doc_no=$1 and ${QUOTE_DRAFT}`,
      [docNo],
    );
    if (Number(lines.rows[0].count) === 0) {
      await client.query("rollback");
      return { error: "ຍັງບໍ່ມີລາຍການ — ກະລຸນາເລືອກລາຍການກ່ອນ" };
    }

    const totalValue = Number(lines.rows[0].total);
    const totalAmount = totalValue - discount;
    if (totalAmount < 0) {
      await client.query("rollback");
      return { error: "ສ່ວນຫຼຸດຫຼາຍກວ່າຍອດລວມ — ຍອດສຸດທ້າຍຕິດລົບບໍ່ໄດ້" };
    }
    quoteTotal = totalAmount;

    // ຕັດການອະນຸມັດເກົ່າຖິ້ມ → ໃບນີ້ກັບເຂົ້າຄິວ "ລໍຖ້າອະນຸມັດ" ສະເໝີ
    await client.query(
      `update ic_trans set doc_date=$1, remark=$2, user_created=$3, exchange_rate=$4,
         total_amount_2=$5, total_value=$6, total_discount=$7, total_amount=$8,
         currency_code='01', vat_rate=0, total_vat_value=0,
         aprove_status=0, approver1=null, aprove_date1=null, approve_at=null, remark_2=null
       where doc_no=$9 and trans_flag=17`,
      [docDate, remark, session.username, rate, totalAmount * rate, totalValue, discount, totalAmount, docNo],
    );

    await client.query("delete from ic_trans_detail where doc_no=$1 and trans_flag=17", [docNo]);
    await client.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, cust_code, product_code, item_code, item_name,
         qty, unit_code, price, sum_amount, calc_flag, user_created)
       select 17,$1,$2,$3, product_code, item_code, item_name, qty, unit_code, price, sum_amount, 1, $4
       from ic_trans_detail_draft where doc_no=$2 and ${QUOTE_DRAFT}`,
      [docDate, docNo, custCode, session.username],
    );
    await client.query(`delete from ic_trans_detail_draft where doc_no=$1 and ${QUOTE_DRAFT}`, [docNo]);

    // ຕອນບໍ່ອະນຸມັດ qt_start ຖືກລ້າງ (ວຽກກັບໄປຂັ້ນ "ລໍຖ້າສະເໜີລາຄາ") → ຕັ້ງຄືນຕອນສົ່ງອະນຸມັດຄືນ
    if (productCode) {
      await client.query(
        "update tb_product set qt_start=coalesce(qt_start, localtimestamp(0)) where code=$1",
        [productCode],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveQuoteEdit failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  if (productCode) {
    const total = `${money(quoteTotal)} ບາດ${discount > 0 ? ` (ຫຼັງສ່ວນຫຼຸດ ${money(discount)} ບາດ)` : ""}`;
    const body =
      wasStatus === 2
        ? `ແກ້ໄຂໃບສະເໜີລາຄາ ${docNo} ທີ່ບໍ່ອະນຸມັດ ແລ້ວສົ່ງອະນຸມັດຄືນ · ຍອດ ${total} — ລໍຖ້າອະນຸມັດ`
        : wasStatus === 1
          ? `ແກ້ໄຂໃບສະເໜີລາຄາ ${docNo} ທີ່ອະນຸມັດແລ້ວ · ຍອດ ${total} — ຕ້ອງອະນຸມັດຄືນໃໝ່`
          : `ແກ້ໄຂໃບສະເໜີລາຄາ ${docNo} · ຍອດ ${total} — ລໍຖ້າອະນຸມັດ`;
    await logChange("tb_product", productCode, body, { roles: ROLE_APPROVER });
  }

  revalidateAll();
  redirect(`/quotations/${encodeURIComponent(docNo)}/print`);
}

/* ───────────────────────── ຍົກເລີກໃບສະເໜີລາຄາ ───────────────────────── */

/**
 * ຄື /qtcancle — ລຶບໃບສະເໜີລາຄາ ແລ້ວປ່ອຍເຄື່ອງກັບຄືນຄິວ "ລໍຖ້າສະເໜີລາຄາ" (ອອກໃບໃໝ່ໄດ້)
 * ລຶບໄດ້ສະເພາະໃບທີ່ຍັງລໍຖ້າອະນຸມັດ (0/0) ຫຼື ບໍ່ອະນຸມັດ (2/0) — ເບິ່ງ blockDelete
 */
export async function cancelQuote(docNo: string): Promise<QuoteState> {
  const guard = await requirePermission("/quotations", "delete", SERVICE_SIDE, "ບໍ່ມີສິດລຶບໃບສະເໜີລາຄາ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const client = await db.connect();
  let cancelledFor = "";
  let wasStatus = 0;
  try {
    await client.query("begin");
    const head = await client.query<QuoteHead>(HEAD_SQL, [docNo]);
    const blocked = blockDelete(head.rows[0]);
    if (blocked) {
      await client.query("rollback");
      return { error: blocked };
    }
    const productCode = head.rows[0].product_code;
    wasStatus = head.rows[0].aprove_status;

    await client.query("delete from ic_trans where doc_no=$1 and trans_flag=17", [docNo]);
    await client.query("delete from ic_trans_detail where doc_no=$1 and trans_flag=17", [docNo]);
    await client.query(`delete from ic_trans_detail_draft where doc_no=$1 and ${QUOTE_DRAFT}`, [docNo]);
    if (productCode) {
      await client.query("update tb_product set qt_start=null, qt_finish=null where code=$1", [productCode]);
    }
    await client.query("commit");
    cancelledFor = productCode ?? "";
  } catch (error) {
    await client.query("rollback");
    console.error("cancelQuote failed", error);
    return { error: "ລຶບບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (cancelledFor) {
    await logChange(
      "tb_product",
      cancelledFor,
      `ລຶບໃບສະເໜີລາຄາ ${docNo}${wasStatus === 2 ? " (ບໍ່ອະນຸມັດ)" : ""} — ກັບໄປລໍຖ້າສະເໜີລາຄາໃໝ່`,
    );
  }

  revalidateAll();
  return {};
}
