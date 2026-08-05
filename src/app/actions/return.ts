"use server";
import { logChange } from "@/lib/chatter-log";
import { recordPayout } from "@/lib/commission-record";
import { getSession } from "@/lib/auth";
import { requireRole, requireRoleOrRedirect } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { db, odgDb, queryOdg } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { writeErpReceipt } from "@/lib/erp-receipt";
import { linkErpDoc } from "@/lib/erp-doc-link";
import { loanerBlock } from "@/lib/loaner";
import { centerBlock } from "@/lib/job-center";
import { warrantyBlock } from "@/lib/warranty-request";
import { HAS_OUTSTANDING_SPARES } from "@/lib/outstanding-spares";
import { openReimburseClaim } from "@/lib/claim";
import { serviceChargeForJob } from "@/lib/service-charge";
import { UPLOADS_DIR, uploadsWriteDir } from "@/lib/uploads";
import { unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * ໃບສົ່ງເຄື່ອງ/ໃບຮັບເງິນ — ຖອດແບບຈາກ ods/returnproduct.py
 *
 * ຕະກ້າ (cart) ຂອງໃບຮັບເງິນ:
 *   ods ເກັບໄວ້ໃນ SQLite ໄຟລ໌ທ້ອງຖິ່ນ (service.db ຕາຕະລາງ dispatch) ທີ່ share ກັນທັງ process
 *   → ໃຊ້ຫຼາຍ worker ບໍ່ໄດ້. ບ່ອນນີ້ຍ້າຍມາໃສ່ຕາຕະລາງ scratch ໃນ Postgres ທີ່ມີຢູ່ແລ້ວ
 *   `ic_trans_detail_draft` ໂດຍໃຊ້ trans_flag=44 (ຍັງບໍ່ມີໃຜໃຊ້ເລກນີ້ໃນຕາຕະລາງນັ້ນ)
 *   → ບໍ່ຕ້ອງສ້າງຕາຕະລາງໃໝ່, ບໍ່ຕ້ອງ run DDL.
 *
 * ຂອບເຂດຕະກ້າ = (trans_flag=44, product_code, user_created) → ຂອງໃຜຂອງມັນ.
 * ods ໃສ່ຂໍ້ມູນແບບບໍ່ເບິ່ງ user ແຕ່ອ່ານຄືນແບບເບິ່ງ user → ຄົນທີສອງເປີດແລ້ວເຫັນຫວ່າງ (bug).
 */

const CART_FLAG = 44;

export type CartRow = {
  roworder: number;
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string;
  price: string;
  sum_amount: string;
  /** ic_trans_detail.roworder ຂອງແຖວໃບສະເໜີລາຄາທີ່ແຖວນີ້ມາຈາກ (ຄື flag ອື່ນຂອງຕາຕະລາງຮ່າງ) */
  row_ref: number | null;
  /** ລາຄາທີ່ລູກຄ້າຕົກລົງໄວ້ໃນໃບສະເໜີລາຄາ — null = ແຖວນີ້ບໍ່ໄດ້ມາຈາກໃບສະເໜີລາຄາ */
  quoted_price: string | null;
  quoted_qty: string | null;
  quote_no: string | null;
};

/**
 * ຕະກ້າ 1 ແຖວ ພ້ອມລາຄາທີ່ສະເໜີໄວ້ (join ຜ່ານ row_ref → ic_trans_detail ຂອງໃບສະເໜີລາຄາ)
 * ໃຊ້ຮ່ວມກັນລະຫວ່າງ getCart() ແລະ saveInvoice() ຈຶ່ງບໍ່ຕ່າງກັນ.
 */
const CART_SQL = `select d.roworder, d.item_code, d.item_name, coalesce(d.qty,0) qty, d.unit_code,
        coalesce(d.price,0) price, coalesce(d.sum_amount,0) sum_amount, d.row_ref,
        q.price quoted_price, coalesce(q.qty,0)::text quoted_qty, q.doc_no quote_no
   from ic_trans_detail_draft d
   left join ic_trans_detail q on q.roworder = d.row_ref and q.trans_flag = 17
  where d.trans_flag=$1 and d.product_code=$2 and d.user_created=$3
  order by d.roworder`;

/* ------------------------------------------------- ໃບສະເໜີລາຄາທີ່ຕົກລົງແລ້ວ */

export type ApprovedQuote = {
  doc_no: string;
  doc_date: string | null;
  total_value: string;
  total_discount: string;
  total_amount: string;
};

export type QuoteLine = {
  roworder: number;
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string;
  price: string;
  sum_amount: string;
};

/**
 * ໃບສະເໜີລາຄາ (trans_flag 17) ທີ່ **ອະນຸມັດພາຍໃນແລ້ວ (aprove_status=1) ແລະ ລູກຄ້າຕົກລົງແລ້ວ
 * (aprove_status_2=1 → tb_product.qt_finish)** ຂອງວຽກນີ້.
 *
 * ວຽກ 'ຮັບປະກັນ' ບໍ່ມີໃບສະເໜີລາຄາ (ບໍ່ເກັບຄ່າອາໄຫຼ່) → ຄືນ null ສະເໝີ ເຖິງວ່າຈະມີໃບຄ້າງຢູ່ກໍ່ຕາມ
 * ⇒ ເສັ້ນທາງ 'ຮັບປະກັນ' ຢູ່ຂ້າງລຸ່ມບໍ່ປ່ຽນເລີຍ (ອາໄຫຼ່ລາຄາ 0 ຄືເກົ່າ).
 */
/**
 * ── ⚠️ ຟັງຊັນອ່ານໃນໄຟລ໌ `"use server"` ກໍ່ເປັນ endpoint ສາທາລະນະ ──
 * ບໍ່ໄດ້ກວດ session = ຄົນນອກດຶງໄດ້ໂດຍບໍ່ຕ້ອງ login. ຈຶ່ງກວດ session ທຸກຕົວ
 * (ບໍ່ຕ້ອງກວດ role — ເປັນລາຍການໃຫ້ເລືອກທຳມະດາ ແຕ່ຕ້ອງເປັນຄົນໃນອົງກອນ).
 */
export async function getApprovedQuote(productCode: string): Promise<ApprovedQuote | null> {
  // ລາຄາ/ຍອດເງິນຂອງໃບສະເໜີ + ເລກງານເປັນເລກລຽງ ⇒ ໄລ່ດຶງໄດ້ເປັນຊຸດ ຖ້າບໍ່ກວດ
  if (!(await getSession())) return null;
  if (!db) return null;
  const result = await db.query<ApprovedQuote>(
    `select q.doc_no, to_char(q.doc_date,'DD-MM-YYYY') doc_date,
        coalesce(q.total_value,0)::text total_value, coalesce(q.total_discount,0)::text total_discount,
        coalesce(q.total_amount,0)::text total_amount
     from ic_trans q
     join tb_product p on p.code = q.product_code
     where q.trans_flag=17 and q.product_code=$1
       and coalesce(q.aprove_status,0)=1 and coalesce(q.aprove_status_2,0)=1
       and p.qt_finish is not null and coalesce(p.warrunty,'') <> 'ຮັບປະກັນ'
     order by q.doc_no desc
     limit 1`,
    [productCode],
  );
  return result.rows[0] ?? null;
}

/** ລາຍການໃນໃບສະເໜີລາຄາ — ໃຊ້ປຽບທຽບກັບຕະກ້າຢູ່ໜ້າຈໍ */
export async function getQuoteLines(docNo: string): Promise<QuoteLine[]> {
  if (!(await getSession())) return [];
  if (!db) return [];
  const result = await db.query<QuoteLine>(
    `select roworder, item_code, item_name, coalesce(qty,0)::text qty, unit_code,
        coalesce(price,0)::text price, coalesce(sum_amount,0)::text sum_amount
     from ic_trans_detail where doc_no=$1 and trans_flag=17 and item_code is not null
     order by roworder`,
    [docNo],
  );
  return result.rows;
}

/** ອັດຕາເເລກປ່ຽນ — tb_bill_rate ຢູ່ຖານ ERP (ods ໃຊ້ getcursor2) */
export type Rates = { "01": number; "02": number; "03": number };

export async function getRates(): Promise<Rates> {
  if (!(await getSession())) return { "01": 1, "02": 0, "03": 0 };
  const result = await queryOdg<{ kip: string | null; dola: string | null }>(
    `select (select exchange_rate from tb_bill_rate where code='02') as kip,
            (select exchange_rate from tb_bill_rate where code='03') as dola`,
  );
  const row = result.rows[0];
  return { "01": 1, "02": Number(row?.kip ?? 0), "03": Number(row?.dola ?? 0) };
}

/**
 * ປ່ຽນຄ່າເງິນສະກຸນໃດໜຶ່ງເປັນບາດ — ຄືກັບ count_cash()/count_trans() ໃນ showDetail.html
 * (ບໍ່ export: ໄຟລ໌ "use server" export ໄດ້ແຕ່ async function)
 */
function toBaht(value: number, currency: string, rates: Rates) {
  if (currency === "02") return rates["02"] ? value / rates["02"] : 0; // ກີບ → ບາດ
  if (currency === "03") return value * rates["03"]; // ໂດລາ → ບາດ
  return value; // ບາດ
}

/* ---------------------------------------------------------------- ຕະກ້າ */

/**
 * ຕື່ມລາຍການເຂົ້າຕະກ້າຄັ້ງທຳອິດ (ຄື showreturn() ຂອງ ods).
 *
 * ── ຊ່ອງຫວ່າງເລື່ອງເງິນທີ່ແກ້ຢູ່ນີ້ ──
 * ods ດຶງອາໄຫຼ່ມາໃສ່ຕະກ້າດ້ວຍ price=0, sum_amount=0 **ທຸກແຖວ** (ເຖິງວ່າຈະ SELECT price ມາກໍ່ຕາມ)
 * ⇒ ພະນັກງານເກັບເງິນຕ້ອງພິມລາຄາຄືນເອງທຸກແຖວ ທັງທີ່ລູກຄ້າຕົກລົງ **ໃບສະເໜີລາຄາທີ່ມີລາຄາຢູ່ແລ້ວ**
 * (ໃນຂໍ້ມູນຈິງ: ໃບຮັບເງິນ 4,437 ໃບ ຍອດເປັນ 0 ໝົດ — ເງິນບໍ່ເຄີຍລົງລະບົບ).
 *
 * ດຽວນີ້:
 *   ມີໃບສະເໜີລາຄາທີ່ອະນຸມັດ + ລູກຄ້າຕົກລົງແລ້ວ → ດຶງ ລາຍການ/ຈຳນວນ/ຫົວໜ່ວຍ/**ລາຄາ** ຈາກໃບນັ້ນ
 *       ພ້ອມຜູກ row_ref ໄວ້ກັບແຖວຂອງໃບສະເໜີລາຄາ ⇒ ໜ້າຈໍປຽບທຽບໄດ້ວ່າພະນັກງານແກ້ລາຄາໃດແດ່
 *   'ຮັບປະກັນ' + used_spare=1 → ເອົາຈາກ tb_used_spare ລາຄາ 0 (ບໍ່ເກັບເງິນຄ່າອາໄຫຼ່) — ຄືເກົ່າ
 *   ບໍ່ມີໃບສະເໜີລາຄາ         → ເອົາຈາກ ic_trans_detail ລາຄາ 0 — ຄືເກົ່າ
 *
 * ໃຊ້ INSERT..SELECT..WHERE NOT EXISTS → ເອີ້ນຊ້ຳກໍ່ບໍ່ຊ້ຳແຖວ.
 */
export async function seedCart(productCode: string, warranty: string | null, usedSpare: number | null) {
  const session = await requireRoleOrRedirect(SERVICE_SIDE);
  if (!db) return;

  const quote = await getApprovedQuote(productCode);
  if (quote) {
    // ລາຄາທີ່ລູກຄ້າຕົກລົງ = ລາຄາທີ່ຕ້ອງເກັບ. row_ref ຜູກແຖວຕະກ້າກັບແຖວໃບສະເໜີລາຄາ
    // (ຮູບແບບດຽວກັນກັບ trans_flag ອື່ນຂອງ ic_trans_detail_draft — ບໍ່ຕ້ອງເພີ່ມຖັນໃໝ່)
    // ເງື່ອນໄຂ not exists ກວດທັງ row_ref ແລະ item_code ⇒ ຕະກ້າເກົ່າ (ຮ່າງກ່ອນແກ້ໄຂ, row_ref ຫວ່າງ)
    // ກໍ່ບໍ່ຖືກຕື່ມຊ້ຳ.
    await db.query(
      `insert into ic_trans_detail_draft(trans_flag, product_code, item_code, item_name, qty, unit_code, price, sum_amount, row_ref, user_created)
       select $1, $2::varchar, t.item_code, t.item_name, coalesce(t.qty,0), t.unit_code,
              coalesce(t.price,0), coalesce(t.sum_amount, coalesce(t.price,0)*coalesce(t.qty,0)),
              t.roworder, $4::varchar
       from ic_trans_detail t
       where t.doc_no = $3 and t.trans_flag = 17 and t.item_code is not null
         and not exists (
           select 1 from ic_trans_detail_draft d
           where d.trans_flag = $1 and d.product_code = $2::varchar and d.user_created = $4::varchar
             and (d.row_ref = t.roworder or (d.row_ref is null and d.item_code = t.item_code)))
       order by t.roworder`,
      [CART_FLAG, productCode, quote.doc_no, session.username],
    );
    return;
  }

  if (warranty === "ຮັບປະກັນ" && usedSpare === 1) {
    await db.query(
      `insert into ic_trans_detail_draft(trans_flag, product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created)
       select distinct on (s.item_code) $1, s.product_code, s.item_code, s.item_name, s.qty, s.unit_code, 0, 0, $3::varchar
       from tb_used_spare s
       where s.product_code = $2
         and not exists (
           select 1 from ic_trans_detail_draft d
           where d.trans_flag = $1 and d.product_code = s.product_code
             and d.item_code = s.item_code and d.user_created = $3::varchar)`,
      [CART_FLAG, productCode, session.username],
    );
  } else if (warranty === "ໝົດຮັບປະກັນ") {
    await db.query(
      `insert into ic_trans_detail_draft(trans_flag, product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created)
       select distinct on (t.item_code) $1, t.product_code, t.item_code, t.item_name, t.qty, t.unit_code, 0, 0, $3::varchar
       from ic_trans_detail t
       where t.product_code = $2 and t.item_code is not null
         and not exists (
           select 1 from ic_trans_detail_draft d
           where d.trans_flag = $1 and d.product_code = t.product_code
             and d.item_code = t.item_code and d.user_created = $3::varchar)`,
      [CART_FLAG, productCode, session.username],
    );
  }

  await seedServiceCharge(productCode, warranty, session.username);
}

/**
 * ຕື່ມ **ຄ່າບໍລິການສ້ອມແປງ** ໃສ່ຕະກ້າໃຫ້ອັດຕະໂນມັດ (ລະຫັດ 9702xx ຈາກການຕັ້ງຄ່າ
 * ຕາມປະເພດເຄື່ອງ — ເບິ່ງ lib/service-charge).
 *
 * ── ກົດ 2 ຂໍ້ ──
 * ① **ໃນປະກັນ ⇒ ລາຄາ 0** (ບໍ່ເກັບລູກຄ້າ ແຕ່ຍັງຕ້ອງມີແຖວ ⇒ ຮູ້ວ່າໄດ້ໃຫ້ບໍລິການຫຍັງ
 *   ແລະ ເປັນຖານໃຫ້ CLM-C ໄປເກັບເງິນນຳ supplier ຕໍ່).
 * ② ຕື່ມ**ເທື່ອດຽວ** — ມີແຖວ 9702 ຢູ່ໃນຕະກ້າແລ້ວບໍ່ຕື່ມຊ້ຳ ແລະ ຄົນລຶບອອກເອງໄດ້
 *   (ບໍ່ດັ່ງນັ້ນລຶບແລ້ວມັນເດັ້ງກັບມາທຸກເທື່ອທີ່ໂຫຼດໜ້າ).
 *
 * ບໍ່ພົບການຕັ້ງຄ່າ ⇒ ບໍ່ເຮັດຫຍັງ (ຄົນເລືອກເອງຄືເກົ່າ) — ການອອກບິນຫ້າມພັງເພາະການຕັ້ງຄ່າ.
 */
async function seedServiceCharge(productCode: string, warranty: string | null, username: string) {
  if (!db) return;
  const already = await db.query(
    `select 1 from ic_trans_detail_draft
      where trans_flag=$1 and product_code=$2 and user_created=$3::varchar and item_code like '9702%' limit 1`,
    [CART_FLAG, productCode, username],
  );
  if (already.rowCount) return;

  const charge = await serviceChargeForJob(productCode);
  if (!charge) return;
  const price = warranty === "ຮັບປະກັນ" ? 0 : charge.price_thb;
  await db.query(
    `insert into ic_trans_detail_draft(trans_flag, product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created)
     values ($1, $2, $3, $4, 1, $5, $6, $6, $7::varchar)`,
    [CART_FLAG, productCode, charge.service_code, charge.service_name ?? "ຄ່າບໍລິການສ້ອມແປງ", charge.unit_code ?? "", price, username],
  );
}

export async function getCart(productCode: string): Promise<CartRow[]> {
  const session = await getSession();
  if (!session || !db) return [];
  const result = await db.query<CartRow>(CART_SQL, [CART_FLAG, productCode, session.username]);
  return result.rows;
}

export type CartState = { error?: string };

/** ຄື /additeminvioce */
export async function addInvoiceItem(_: CartState, formData: FormData): Promise<CartState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດແກ້ໄຂໃບຮັບເງິນ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z
    .object({
      product_code: z.string().min(1),
      item_code: z.string().min(1),
      item_name: z.string(),
      unit_code: z.string(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;

  await db.query(
    `insert into ic_trans_detail_draft(trans_flag, product_code, item_code, item_name, unit_code, qty, price, sum_amount, user_created)
     values($1,$2,$3,$4,$5,1,0,0,$6)`,
    [CART_FLAG, d.product_code, d.item_code, d.item_name, d.unit_code, session.username],
  );
  revalidatePath(`/returns/${d.product_code}`);
  return {};
}

/** ຄື /deleteiteminvoice */
export async function deleteInvoiceItem(_: CartState, formData: FormData): Promise<CartState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດແກ້ໄຂໃບຮັບເງິນ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z
    .object({ roworder: z.coerce.number().int(), product_code: z.string().min(1) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  await db.query(
    `delete from ic_trans_detail_draft where roworder=$1 and trans_flag=$2 and product_code=$3 and user_created=$4`,
    [parsed.data.roworder, CART_FLAG, parsed.data.product_code, session.username],
  );
  revalidatePath(`/returns/${parsed.data.product_code}`);
  return {};
}

/** ຄື /deletealliteminvoice — ລຶບຕະກ້າທັງໝົດແລ້ວອອກ */
export async function deleteAllInvoiceItems(formData: FormData) {
  const session = await requireRoleOrRedirect(SERVICE_SIDE);
  const productCode = String(formData.get("product_code") ?? "");
  if (db && productCode) {
    await db.query(
      `delete from ic_trans_detail_draft where trans_flag=$1 and product_code=$2 and user_created=$3`,
      [CART_FLAG, productCode, session.username],
    );
  }
  // ໜ້າລາຍການ /returns ຖືກລົບ (ຊ້ຳກັບຄິວ) ⇒ ກັບໄປຄິວ "ລໍຖ້າສົ່ງຄືນ" ແທນ
  redirect("/work/repair/wait-return");
}

/**
 * ຄື /updatinvoiceqty + /updateinvoiceprice — ods ແຍກເປັນ 2 route (2 ປຸ່ມ),
 * ບ່ອນນີ້ລວມເປັນແຖວລະ 1 ຟອມ ບັນທຶກທັງ ຈຳນວນ ແລະ ລາຄາ ພ້ອມກັນ.
 */
export async function updateInvoiceLine(_: CartState, formData: FormData): Promise<CartState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດແກ້ໄຂໃບຮັບເງິນ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z
    .object({
      roworder: z.coerce.number().int(),
      product_code: z.string().min(1),
      qty: z.string(),
      price: z.string(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const qty = Number(parsed.data.qty.replace(/,/g, ""));
  const price = Number(parsed.data.price.replace(/,/g, ""));
  if (![qty, price].every((value) => Number.isFinite(value) && value >= 0)) {
    return { error: "ຄ່າທີ່ປ້ອນບໍ່ຖືກຕ້ອງ" };
  }

  await db.query(
    `update ic_trans_detail_draft
     set qty=$1, price=$2, sum_amount=$1::numeric*$2::numeric
     where roworder=$3 and trans_flag=$4 and product_code=$5 and user_created=$6`,
    [qty, price, parsed.data.roworder, CART_FLAG, parsed.data.product_code, session.username],
  );
  revalidatePath(`/returns/${parsed.data.product_code}`);
  return {};
}

/* ------------------------------------------------------------ ບັນທຶກບິນ */

// ບ່ອນຂຽນຮູບ — ເອົາຈາກ lib/uploads ບ່ອນດຽວ (ຢ່າອ່ານ env ເອງ: ຂຽນຄົນລະບ່ອນກັບ /api/uploads = ຮູບ 404)
const uploadsDir = UPLOADS_DIR;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MAX_BYTES = 16 * 1024 * 1024;

/** ຄື secure_filename() ຂອງ Werkzeug */
function secureFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120);
  return cleaned || "image";
}

const saveSchema = z.object({
  doc_date: z.string().min(1),
  remark: z.string().optional().default(""),
  cust_code: z.string().min(1),
  pro_code: z.string().min(1),
  cash_type: z.string().default("01"),
  cash_value: z.string().default("0"),
  account_name: z.string().optional().default(""),
  bexch: z.string().optional().default(""),
  bank_value: z.string().default("0"),
  /** ໝາຍວ່າ "ບິນນີ້ໄປເກັບເງິນນຳ supplier" — ຫວ່າງ = ບໍ່ໝາຍ (ເບິ່ງ openReimburseClaim) */
  claim_supplier: z.string().optional().default(""),
});

export type SaveInvoiceState = { error?: string };

/**
 * ຄື /save_invoicedata — ຂຽນ ic_trans(44) + ic_trans_detail + cb_trans + cb_trans_detail,
 * ຕັ້ງ tb_used_spare.status=1 ແລະ ປະທັບ tb_product.return_complete.
 *
 * ຕ່າງຈາກ ods:
 *  - ອອກເລກ doc_no ໃໝ່ພາຍໃນ transaction ທີ່ລັອກແລ້ວ (ods ໃຊ້ max()+1 ຕອນ render → ຊ້ຳກັນໄດ້)
 *  - ຄິດຍອດເງິນຢູ່ server ຄືນ (ods ເຊື່ອຄ່າທີ່ browser ສົ່ງມາ)
 *  - ຜິດພາດແລ້ວ rollback ຈິງ (ods ຈັບ exception ແລ້ວປ່ອຍຜ່ານ → ຂໍ້ມູນຄ້າງເຄິ່ງທາງ)
 */
export async function saveInvoice(_: SaveInvoiceState, formData: FormData): Promise<SaveInvoiceState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດອອກໃບຮັບເງິນ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = saveSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: "ກະລຸນາປ້ອນຊ່ອງທີ່ຈຳເປັນໃຫ້ຄົບ" };
  const d = parsed.data;

  const num = (value: string) => {
    const parsedValue = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  };
  const cashValue = num(d.cash_value);
  const bankValue = num(d.bank_value);

  // ຮູບໃບໂອນ
  let upload: { filename: string; bytes: Buffer } | null = null;
  const image = formData.get("payment_image");
  if (image instanceof File && image.size > 0) {
    if (!uploadsDir) return { error: "ບໍ່ໄດ້ຕັ້ງຄ່າ ODS_UPLOADS_DIR — ອັບໂຫລດຮູບບໍ່ໄດ້" };
    if (image.size > MAX_BYTES) return { error: "ຮູບໃຫຍ່ເກີນ 16MB" };
    const filename = secureFilename(image.name);
    if (!ALLOWED.has(extname(filename).toLowerCase())) return { error: "ໄຟລ໌ທີ່ເລືອກບໍ່ແມ່ນຮູບ" };
    upload = { filename, bytes: Buffer.from(await image.arrayBuffer()) };
  }

  // ໃບຮັບເງິນຕ້ອງໄປລົງ SML ນຳ (cb_trans) — SML ບໍ່ຕັ້ງຄ່າ = ອອກໃບບໍ່ໄດ້ (ບໍ່ໃຫ້ເກີດໃບ ODS-ຢ່າງດຽວ ອີກ)
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL — ອອກໃບຮັບເງິນບໍ່ໄດ້" };

  /**
   * ໃບຮັບເງິນນີ້ປະທັບ return_complete ນຳ (ລູກຄ້າມາຮັບເຄື່ອງ ແລະ ຈ່າຍເງິນເທື່ອດຽວ)
   * ⇒ ຕ້ອງໄດ້ເຄື່ອງສຳຮອງຄືນຢູ່ຈຸດນີ້ຄືກັນ ບໍ່ດັ່ງນັ້ນເຄື່ອງສູນຈະຄ້າງຢູ່ບ້ານລູກຄ້າຕະຫຼອດ.
   */
  const loanerHold = await loanerBlock(d.pro_code);
  // ເຄື່ອງຍັງຢູ່ອີກສູນ / ກຳລັງໂອນ ⇒ ສົ່ງຄືນລູກຄ້າບໍ່ໄດ້ (lib/job-center)
  const centerHold = await centerBlock(d.pro_code);
  // ຍັງລໍອະນຸມັດປ່ຽນປະກັນ ⇒ ຍັງບໍ່ຮູ້ວ່າລູກຄ້າຕ້ອງຈ່າຍ ຫຼື ບໍ່ (lib/warranty-request)
  const warrantyHold = await warrantyBlock(d.pro_code);
  if (loanerHold) return { error: loanerHold };
  if (centerHold) return { error: centerHold };
  if (warrantyHold) return { error: warrantyHold };

  // ເຊື່ອມຕໍ່ຖານຂໍ້ມູນ — ລົ້ມເຫຼວກໍ່ຄືນເປັນ error ທຳມະດາ ບໍ່ໃຫ້ throw ຫຼຸດອອກໄປພັງໜ້າ
  const client = await db.connect().catch(() => null);
  if (!client) return { error: "ເຊື່ອມຕໍ່ຖານຂໍ້ມູນບໍ່ໄດ້ ກະລຸນາລອງໃໝ່" };
  const odg = await odgDb.connect().catch(() => null);
  if (!odg) {
    client.release();
    return { error: "ເຊື່ອມຕໍ່ SML ບໍ່ໄດ້ ກະລຸນາລອງໃໝ່" };
  }
  const written: string[] = [];
  let docNo = "";
  let billTotal = 0;
  let quoteNo: string | null = null;
  let editedLines = 0;
  /** ລາຍການໃນບິນ — ເກັບໄວ້ໃຊ້ຕໍ່ຫຼັງ commit (ໃບເຄມ CLM-C) */
  let billLines: CartRow[] = [];

  try {
    await client.query("begin");
    await odg.query("begin"); // SML — ຄຸມຄູ່ກັບ ODS: SML ຜ່ານ = ສຳເລັດ (ບໍ່ໃຫ້ໃບຄ້າງເຄິ່ງທາງ)
    await client.query("select pg_advisory_xact_lock(734244)"); // ກັນເລກບິນຊ້ຳ

    // ອັດຕາແລກປ່ຽນຢູ່ຖານ ERP — ດຶງໃນ try ⇒ ຖ້າ ERP ຂັດຂ້ອງ (timeout) ຄືນເປັນ error ທຳມະດາ
    // ບໍ່ throw ຫຼຸດອອກໄປ (ບໍ່ດັ່ງນັ້ນ action ພັງເປັນ "This page couldn't load")
    const rates = await getRates();
    const amountCash = toBaht(cashValue, d.cash_type, rates);
    const bankAmount = bankValue > 0 && d.bexch ? toBaht(bankValue, d.bexch, rates) : 0;
    const exValue = rates[d.cash_type as keyof Rates] ?? 1;
    const exBank = (d.bexch && rates[d.bexch as keyof Rates]) || 1;

    docNo = await nextDocNo(client, "SIN");

    const cart = await client.query<CartRow>(CART_SQL, [CART_FLAG, d.pro_code, session.username]);

    // ຍອດລວມ ຄິດຈາກຕະກ້າຢູ່ server — ບໍ່ເຊື່ອຄ່າຈາກ browser
    const total = cart.rows.reduce((sum, row) => sum + Number(row.sum_amount), 0);
    billTotal = total;
    billLines = cart.rows;

    // ອອກບິນດ້ວຍລາຄາທີ່ຕ່າງຈາກໃບສະເໜີລາຄາ = ເລື່ອງທີ່ຕ້ອງມີຫຼັກຖານ → ລົງ chatter ໄວ້
    quoteNo = cart.rows.find((row) => row.quote_no)?.quote_no ?? null;
    editedLines = cart.rows.filter(
      (row) => row.quoted_price !== null && Number(row.quoted_price) !== Number(row.price),
    ).length;

    /**
     * ສ່ວນຫຼຸດຈາກໃບສະເໜີລາຄາທີ່ລູກຄ້າຕົກລົງ ຕ້ອງຕິດມານຳ.
     *
     * ເມື່ອກ່ອນຂຽນ total_amount = ຍອດລວມແຖວເສີຍໆ ⇒ ສ່ວນຫຼຸດຫາຍ ⇒ ເກັບເງິນ
     * ເກີນກວ່າທີ່ຕົກລົງກັບລູກຄ້າ (12 ໃບສະເໜີລາຄາມີສ່ວນຫຼຸດ, 11 ໃບອອກບິນໄປແລ້ວ).
     * ຫຼຸດບໍ່ເກີນຍອດແຖວ ແລະ ຫຼຸດສະເພາະຕອນແຄັດເຊຍບໍ່ໄດ້ແກ້ລາຄາເອງ
     * (ແກ້ລາຄາ = ຕົກລົງກັນໃໝ່ ⇒ ບໍ່ຫຼຸດຊ້ຳ).
     */
    const quoteForBill = await getApprovedQuote(d.pro_code);
    const discount =
      quoteForBill && editedLines === 0
        ? Math.min(Math.max(Number(quoteForBill.total_discount) || 0, 0), total)
        : 0;
    billTotal = total - discount;

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, cust_code, product_code, remark, user_created,
         total_value, total_discount, total_amount)
       values(44,$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [d.doc_date, docNo, d.cust_code, d.pro_code, d.remark, session.username, total, discount, total - discount],
    );

    for (const row of cart.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag, doc_date, doc_no, cust_code, product_code, item_code, item_name,
           qty, unit_code, price, sum_amount, calc_flag, user_created)
         values(44,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,-1,$11)`,
        [d.doc_date, docNo, d.cust_code, d.pro_code, row.item_code, row.item_name, row.qty, row.unit_code,
          row.price, row.sum_amount, session.username],
      );
      await client.query(`update tb_used_spare set status=1 where item_code=$1 and product_code=$2`, [
        row.item_code,
        d.pro_code,
      ]);
    }

    await client.query(
      `insert into cb_trans(trans_flag, doc_no, doc_date, cust_code, pro_code, currency_code, exchange_rate,
         total_value, total_pay_amount, total_cash_amount, total_transfer_amount, user_created)
       values(44,$1,$2,$3,$4,'01',1,$5,$5,$6,$7,$8)`,
      [docNo, d.doc_date, d.cust_code, d.pro_code, total, amountCash, bankAmount, session.username],
    );

    if (amountCash > 0) {
      await client.query(
        `insert into cb_trans_detail(trans_flag, doc_no, doc_date, cust_code, pro_code, item_code, item_name,
           total_value, exchange_rate, total_value_2, user_created)
         values(44,$1,$2,$3,$4,$5,'',$6,$7,$8,$9)`,
        [docNo, d.doc_date, d.cust_code, d.pro_code, d.cash_type, cashValue, exValue, amountCash, session.username],
      );
    }

    if (bankAmount > 0) {
      let storedName: string | null = null;
      if (upload && uploadsDir) {
        storedName = `${docNo}_pay_${upload.filename}`;
        // ບ່ອນຂຽນຈິງ (ຫຼົບໄປ var/uploads ຖ້າ env ຜິດ) — ຢ່າໃຫ້ຮູບໃບໂອນພາໃບຮັບເງິນລົ້ມ
        const dir = (await uploadsWriteDir()) ?? uploadsDir;
        const path = join(/*turbopackIgnore: true*/ dir, storedName);
        await writeFile(path, upload.bytes);
        written.push(path);
      }
      await client.query(
        `insert into cb_trans_detail(trans_flag, doc_no, doc_date, cust_code, pro_code, item_code, item_name,
           total_value, exchange_rate, total_value_2, user_created, image_url)
         values(44,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [docNo, d.doc_date, d.cust_code, d.pro_code, d.bexch, d.account_name, bankValue, exBank, bankAmount,
          session.username, storedName],
      );
    }

    /**
     * ດ່ານກວດຮັບຄຸນນະພາບ — ງານທີ່ **ຍັງບໍ່ຜ່ານ QC** ອອກໃບຮັບເງິນ/ສົ່ງຄືນບໍ່ໄດ້.
     * ເງື່ອນໄຂຢູ່ໃນ WHERE ⇒ ກັນການແຂ່ງກັນ (ບໍ່ແມ່ນກວດແລ້ວຄ່ອຍຂຽນ).
     */
    const returned = await client.query(
      `update tb_product set return_complete=localtimestamp(0)
        where code=$1 and qc_finish is not null and return_complete is null`,
      [d.pro_code],
    );
    if (!returned.rowCount) {
      await client.query("rollback");
      await odg.query("rollback").catch(() => {});
      return { error: "ສົ່ງຄືນບໍ່ໄດ້ — ງານນີ້ຍັງບໍ່ຜ່ານການກວດຮັບຄຸນນະພາບ ຫຼື ສົ່ງຄືນໄປແລ້ວ" };
    }

    await client.query(
      `delete from ic_trans_detail_draft where trans_flag=$1 and product_code=$2 and user_created=$3`,
      [CART_FLAG, d.pro_code, session.username],
    );

    // ໃບເຄມ (ເສັ້ນທາງ "ສ້ອມ") ທີ່ຜູກ ref_job ນີ້ → ປິດ job = ປິດເຄມ ນຳ
    await client.query(
      `update ods_claim set status='closed', closed_at=coalesce(closed_at,now())
        where ref_job=$1 and resolution='repair' and status not in ('closed','rejected')`,
      [d.pro_code],
    );

    /**
     * ── ສົ່ງໃບຮັບເງິນເຂົ້າ SML (cb_trans) — "SML ຜ່ານ = ສຳເລັດ" ──
     * ລູກຄ້າ**ດຶງຈາກ job** (ar_customer ຂອງ cust_code) ໄປໃສ່ຊື່/ເບີໃນ SML.
     * ຍອດເປັນບາດແລ້ວ (amountCash / bankAmount). ຍອດ 0 (ຮັບປະກັນ) ⇒ ບໍ່ຂຽນ SML.
     */
    const cust = await client.query<{ name: string | null; tel: string | null }>(
      `select name_1 as name, tel from ar_customer where code=$1 limit 1`,
      [d.cust_code],
    );
    const now = new Date();
    const pushed = await writeErpReceipt(odg, {
      doc_no: docNo,
      doc_date: d.doc_date,
      doc_time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      job_code: d.pro_code,
      cust_name: cust.rows[0]?.name ?? "",
      cust_phone: cust.rows[0]?.tel ?? "",
      cash_amount: amountCash,
      transfer_amount: bankAmount,
      cashier: session.username,
    });
    // ຜູກໃບ↔ວຽກຢູ່ ODS (ໃນ transaction ດຽວກັນ — SML ລົ້ມ ⇒ ຜູກກໍ່ຫາຍນຳ)
    if (pushed) {
      await linkErpDoc(client, { docNo, transFlag: 44, jobCode: d.pro_code, by: session.username });
    }

    // ຄຸມສອງຖານພ້ອມ: SML ກ່ອນ (ຖ້າ trigger SML ລົ້ມ ⇒ throw ⇒ catch rollback ODS ນຳ), ແລ້ວ ODS
    await odg.query("commit");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odg.query("rollback").catch(() => {});
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("save_invoicedata failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
    odg.release();
  }

  await logChange(
    "tb_product",
    d.pro_code,
    `ສົ່ງຄືນລູກຄ້າ · ໃບຮັບເງິນ ${docNo} · ຍອດ ${billTotal.toLocaleString("en-US")} ບາດ` +
      (quoteNo ? ` · ລາຄາອີງໃບສະເໜີລາຄາ ${quoteNo}` : "") +
      (editedLines > 0 ? ` · ມີ ${editedLines} ລາຍການທີ່ລາຄາຕ່າງຈາກໃບສະເໜີລາຄາ` : ""),
  );
  await logChange("ar_customer", d.cust_code, `ຮັບເຄື່ອງຄືນ #${d.pro_code} · ໃບຮັບເງິນ ${docNo}`);

  /**
   * ຄິດ ແລະ **ແຊ່** ຄ່າຄອມຂອງຊ່າງ — ງານສ້ອມຈົບເມື່ອສົ່ງເຄື່ອງຄືນລູກຄ້າ.
   * ບໍ່ໃສ່ໃນ returnWithoutInvoice: ນັ້ນແມ່ນງານທີ່ **ຍົກເລີກ** (status=6) ບໍ່ໄດ້ສ້ອມຫຍັງ
   * ⇒ ບໍ່ຄວນມີຄ່າບໍລິການ. ກືນ error ໄວ້ — ການສົ່ງຄືນຫ້າມພັງເພາະເລື່ອງເງິນ.
   */
  await recordPayout("repair", d.pro_code);

  /**
   * ── ໝາຍວ່າ "ບິນນີ້ເກັບເງິນນຳ supplier" ⇒ **ເປີດໃບ CLM-C ໃຫ້ເລີຍ** ──
   * ຈຸດນີ້ງານ **ສົ່ງຄືນສຳເລັດແລ້ວ** (return_complete ຫາກໍ່ຖືກປະທັບຂ້າງເທິງ) ⇒ ຄົບເງື່ອນໄຂ
   * ຂອງ CLM-C ພໍດີ. ລາຄາທີ່ຮຽກຈາກ supplier ≠ ລາຄາທີ່ເກັບລູກຄ້າ: ງານໃນປະກັນລູກຄ້າຈ່າຍ 0
   * ແຕ່ **ຄ່າບໍລິການຕ້ອງເກັບເຕັມ** ⇒ ແຖວຄ່າບໍລິການ (9702xx) ທີ່ເປັນ 0 ຖືກຕື່ມລາຄາຈາກ
   * ການຕັ້ງຄ່າ (lib/service-charge) ຄືນໃຫ້. ລົ້ມເຫຼວ ⇒ ບິນຍັງສຳເລັດ (ຄືນ null ງຽບໆ).
   */
  if (d.claim_supplier.trim()) {
    const charge = await serviceChargeForJob(d.pro_code);
    const job = (
      await db.query<{ brand: string | null; product: string | null; model: string | null; sn: string | null; issue: string | null; warranty: string | null }>(
        `select p_brand brand, name_1 product, p_model model, nullif(sn,'') sn, nullif(issue,'') issue,
            nullif(warrunty,'') warranty
           from tb_product where code=$1 limit 1`,
        [d.pro_code],
      )
    ).rows[0];
    const claimNo = await openReimburseClaim({
      jobCode: d.pro_code,
      supplierCode: d.claim_supplier,
      brandCode: job?.brand ?? null,
      customerCode: d.cust_code,
      reason: job?.issue ?? null,
      product: job?.product ?? null,
      model: job?.model ?? null,
      sn: job?.sn ?? null,
      warranty: job?.warranty === "ຮັບປະກັນ" ? "in" : job?.warranty ? "out" : null,
      createdBy: session.username,
      lines: billLines.map((row) => ({
        item_code: row.item_code,
        item_name: row.item_name,
        qty: Number(row.qty) || 1,
        unit: row.unit_code,
        amount:
          Number(row.sum_amount) ||
          (charge && row.item_code === charge.service_code ? charge.price_thb : 0),
      })),
    });
    if (claimNo) {
      await logChange("tb_product", d.pro_code, `ເປີດໃບເຄມເກັບເງິນນຳ supplier ${claimNo} (ຈາກໃບຮັບເງິນ ${docNo})`, {
        roles: ["manager", "stock"],
      });
    }
  }

  revalidatePath("/returns", "layout");
  revalidatePath("/approvals/cancellations", "layout");
  revalidatePath("/service/cancel");
  redirect(`/returns/${docNo}/print`);
}

/* ─────────────────────── ສົ່ງຄືນໂດຍບໍ່ສ້ອມ (GAP A) ─────────────────────── */

/**
 * ວຽກທີ່ຖືກຍົກເລີກ (status=6, ອະນຸມັດຍົກເລີກແລ້ວ) ກໍ່ຕ້ອງໄດ້ສົ່ງເຄື່ອງຄືນລູກຄ້າຄືກັນ
 * ແຕ່ ods (ແລະ ໜ້າ /returns ເກົ່າ) ບໍ່ມີທາງໃຫ້ເລີຍ — ວຽກຄ້າງເປີດຕະຫຼອດໄປ.
 *
 * ມີ 2 ທາງອອກ ແລະ ທັງສອງປະທັບ tb_product.return_complete:
 *   1. ອອກໃບຮັບເງິນ (ຄ່າກວດເຊັກ/ວິນິດໄສ) → saveInvoice() ຂ້າງເທິງ — ໄດ້ ic_trans trans_flag 44
 *   2. ບໍ່ເກັບເງິນ → returnWithoutInvoice() ຂ້າງລຸ່ມນີ້ — ບໍ່ອອກເອກະສານເງິນເລີຍ
 *
 * status ຍັງເປັນ 6 (ຍົກເລີກ) ຄືເກົ່າ — ຄວາມໝາຍຂອງ "ຍົກເລີກ" ບໍ່ປ່ຽນ.
 */
export type ReturnState = { error?: string };

export async function returnWithoutInvoice(_: ReturnState, formData: FormData): Promise<ReturnState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດສົ່ງເຄື່ອງຄືນ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z.object({ pro_code: z.string().trim().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ບໍ່ພົບລະຫັດເຄື່ອງ" };
  const productCode = parsed.data.pro_code;

  // ── ບັງຄັບ "ຄືນ ຫຼື ເກັບເງິນ" ອາໄຫຼ່ ກ່ອນປິດງານຍົກເລີກ (ບໍ່ໃຫ້ປິດຟຣີໂດຍອາໄຫຼ່ຄ້າງ) ──
  // ຍັງມີອາໄຫຼ່ເບີກອອກແຕ່ບໍ່ຄືນ ⇒ ຕ້ອງ (ກ) ສົ່ງຄືນອາໄຫຼ່ (ໜ້າກູ້ອາໄຫຼ່) ຫຼື (ຂ) ອອກໃບຮັບເງິນ
  // ເກັບຄ່າອາໄຫຼ່ (saveInvoice). ນີ້ອຸດຮູທີ່ເຮັດໃຫ້ 570 ໃບຍົກເລີກປິດໄປໂດຍອາໄຫຼ່ບໍ່ເຄີຍຄືນ.
  const outstanding = await db.query<{ n: number }>(
    `select count(*)::int n from tb_product a where a.code=$1 and ${HAS_OUTSTANDING_SPARES}`,
    [productCode],
  );
  if (outstanding.rows[0]?.n) {
    return {
      error:
        "ຍັງມີອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງ ຍັງບໍ່ໄດ້ຄືນ — ຕ້ອງສົ່ງຄືນອາໄຫຼ່ (ໜ້າກູ້ອາໄຫຼ່) ຫຼື ອອກໃບຮັບເງິນເກັບຄ່າອາໄຫຼ່ ກ່ອນປິດງານ",
    };
  }
  // ເຄື່ອງສຳຮອງທີ່ໃຫ້ລູກຄ້າໃຊ້ກ່ອນ ຕ້ອງໄດ້ຄືນມາພ້ອມກັນ (lib/loaner)
  const loanerHold = await loanerBlock(productCode);
  // ເຄື່ອງຍັງຢູ່ອີກສູນ / ກຳລັງໂອນ ⇒ ສົ່ງຄືນລູກຄ້າບໍ່ໄດ້ (lib/job-center)
  const centerHold = await centerBlock(productCode);
  // ຍັງລໍອະນຸມັດປ່ຽນປະກັນ ⇒ ຍັງບໍ່ຮູ້ວ່າລູກຄ້າຕ້ອງຈ່າຍ ຫຼື ບໍ່ (lib/warranty-request)
  const warrantyHold = await warrantyBlock(productCode);
  if (loanerHold) return { error: loanerHold };
  if (centerHold) return { error: centerHold };
  if (warrantyHold) return { error: warrantyHold };

  let custCode = "";
  try {
    // ເງື່ອນໄຂດຽວກັນກັບແທັບ "ສົ່ງຄືນໂດຍບໍ່ສ້ອມ" — ກັນການປະທັບຊ້ຳ ແລະ ກັນວຽກທີ່ຍັງບໍ່ອະນຸມັດຍົກເລີກ
    const done = await db.query<{ cust_code: string | null }>(
      `update tb_product set return_complete=localtimestamp(0)
       where code=$1 and status=6 and cancel_finish is not null and return_complete is null
       returning cust_code`,
      [productCode],
    );
    if (!done.rowCount) return { error: "ວຽກນີ້ສົ່ງຄືນແລ້ວ ຫຼື ຍັງບໍ່ໄດ້ອະນຸມັດການຍົກເລີກ" };
    custCode = done.rows[0]?.cust_code ?? "";

    // ຕະກ້າຮ່າງທີ່ຄ້າງໄວ້ (ຖ້າມີ) ບໍ່ຕ້ອງການແລ້ວ
    await db.query(
      `delete from ic_trans_detail_draft where trans_flag=$1 and product_code=$2 and user_created=$3`,
      [CART_FLAG, productCode, session.username],
    );

    // ໃບເຄມ (ເສັ້ນທາງ "ສ້ອມ") ທີ່ຜູກ ref_job ນີ້ → ປິດ job = ປິດເຄມ ນຳ
    await db.query(
      `update ods_claim set status='closed', closed_at=coalesce(closed_at,now())
        where ref_job=$1 and resolution='repair' and status not in ('closed','rejected')`,
      [productCode],
    );
  } catch (error) {
    console.error("returnWithoutInvoice failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  await logChange("tb_product", productCode, "ສົ່ງຄືນລູກຄ້າໂດຍບໍ່ສ້ອມ (ວຽກຍົກເລີກ) · ບໍ່ໄດ້ອອກໃບຮັບເງິນ");
  if (custCode) await logChange("ar_customer", custCode, `ຮັບເຄື່ອງຄືນ #${productCode} · ຍົກເລີກ ບໍ່ໄດ້ສ້ອມ`);

  revalidatePath("/returns", "layout");
  revalidatePath("/approvals/cancellations", "layout");
  revalidatePath("/service/cancel");
  /**
   * ເດີມກັບໄປແທັບ "ສົ່ງຄືນໂດຍບໍ່ສ້ອມ" ຂອງ /returns ແຕ່ໜ້ານັ້ນຖືກລົບ (ຊ້ຳ).
   * ຂັ້ນ 11 **ລວມງານຍົກເລີກທີ່ເຄື່ອງຍັງຢູ່** ຢູ່ແລ້ວ ⇒ ຄິວນີ້ຮັບແທນໄດ້ຄົບ.
   */
  redirect("/work/repair/wait-return");
}

/**
 * **ສົ່ງຄືນບໍ່ເກັບເງິນ — ວຽກທີ່ສ້ອມຈົບແລ້ວ ແຕ່ລູກຄ້າບໍ່ເອົາ/ບໍ່ແປງ.**
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * `returnWithoutInvoice` ຂ້າງເທິງໃຊ້ໄດ້ສະເພາະວຽກ **ຍົກເລີກ** (status=6 + ອະນຸມັດແລ້ວ).
 * ວຽກທີ່ຜ່ານ QC ແລ້ວ (ຂັ້ນ 11) ແຕ່ລູກຄ້າປະຕິເສດ ບໍ່ມີທາງປິດນອກຈາກອອກໃບຮັບເງິນ
 * ⇒ ຄົນເລີ່ຍບໍ່ປິດ ແລ້ວມັນຄ້າງຢູ່ຄິວຕະຫຼອດ (ໃບ 5682 "ລູກຄ້າບໍ່ແປງ" ຄ້າງ 304 ມື້ ·
 * 6590 "ບໍ່ແປງ" 136 ມື້) ດຶງຕົວເລກ "ຄ້າງດົນສຸດ" ໃຫ້ເບິ່ງແຍ່ກວ່າຄວາມຈິງ.
 *
 * ── ກັນການໃຊ້ຜິດ ──
 * ນີ້ຄືທາງປິດງານ **ໂດຍບໍ່ເກັບເງິນ** ⇒ ບັງຄັບ 3 ຢ່າງ:
 *   ① ຕ້ອງໃສ່ເຫດຜົນ (ບັນທຶກລົງ chatter — ຮູ້ວ່າໃຜປິດ ແລະ ຍ້ອນຫຍັງ)
 *   ② ອາໄຫຼ່ທີ່ເບີກອອກຕ້ອງຄືນໝົດກ່ອນ (ດ່ານດຽວກັບ returnWithoutInvoice)
 *   ③ ສະເພາະວຽກທີ່ **ຜ່ານ QC ແລ້ວ ແລະ ຍັງບໍ່ສົ່ງຄືນ** — ບໍ່ແມ່ນປິດວຽກກາງທາງ
 */
export async function returnWithoutCharge(_: ReturnState, formData: FormData): Promise<ReturnState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດສົ່ງເຄື່ອງຄືນ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z
    .object({ pro_code: z.string().trim().min(1), reason: z.string().trim().min(3) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຕ້ອງລະບຸເຫດຜົນ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)" };
  const { pro_code: productCode, reason } = parsed.data;

  const outstanding = await db.query<{ n: number }>(
    `select count(*)::int n from tb_product a where a.code=$1 and ${HAS_OUTSTANDING_SPARES}`,
    [productCode],
  );
  if (outstanding.rows[0]?.n) {
    return {
      error:
        "ຍັງມີອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງ ຍັງບໍ່ໄດ້ຄືນ — ຕ້ອງສົ່ງຄືນອາໄຫຼ່ ຫຼື ອອກໃບຮັບເງິນເກັບຄ່າອາໄຫຼ່ ກ່ອນປິດງານ",
    };
  }
  const loanerHold = await loanerBlock(productCode);
  // ເຄື່ອງຍັງຢູ່ອີກສູນ / ກຳລັງໂອນ ⇒ ສົ່ງຄືນລູກຄ້າບໍ່ໄດ້ (lib/job-center)
  const centerHold = await centerBlock(productCode);
  // ຍັງລໍອະນຸມັດປ່ຽນປະກັນ ⇒ ຍັງບໍ່ຮູ້ວ່າລູກຄ້າຕ້ອງຈ່າຍ ຫຼື ບໍ່ (lib/warranty-request)
  const warrantyHold = await warrantyBlock(productCode);
  if (loanerHold) return { error: loanerHold };
  if (centerHold) return { error: centerHold };
  if (warrantyHold) return { error: warrantyHold };

  let custCode = "";
  try {
    /**
     * ເງື່ອນໄຂດຽວກັບແທັບ "ລໍຖ້າສົ່ງຄືນ" ຂອງ /returns (time_finish_repair + qc_finish
     * + ຍັງບໍ່ສົ່ງຄືນ + ບໍ່ແມ່ນວຽກຍົກເລີກ) ⇒ ປຸ່ມກັບ action ເຫັນວຽກຊຸດດຽວກັນ.
     */
    const done = await db.query<{ cust_code: string | null }>(
      `update tb_product set return_complete=localtimestamp(0)
       where code=$1 and time_finish_repair is not null and qc_finish is not null
         and return_complete is null and status <> 6
       returning cust_code`,
      [productCode],
    );
    if (!done.rowCount) return { error: "ວຽກນີ້ສົ່ງຄືນແລ້ວ ຫຼື ຍັງບໍ່ຜ່ານການກວດ QC" };
    custCode = done.rows[0]?.cust_code ?? "";
  } catch (error) {
    console.error("returnWithoutCharge failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  await logChange("tb_product", productCode, `ສົ່ງຄືນລູກຄ້າ ບໍ່ເກັບເງິນ · ເຫດຜົນ: ${reason}`);
  if (custCode) await logChange("ar_customer", custCode, `ຮັບເຄື່ອງຄືນ #${productCode} · ບໍ່ເກັບເງິນ (${reason})`);

  revalidatePath("/returns", "layout");
  revalidatePath("/dashboard");
  return {};
}
