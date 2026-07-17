import { employeeCode } from "@/lib/erp-employee";
import { odgDb, queryOdg } from "@/lib/db";
import { ERP_PURCHASE } from "@/lib/stock-constants";
import type { PoolClient } from "pg";

/**
 * **ອະນຸມັດ PR (WPRA) · ອອກໃບສັ່ງຊື້ (PO) · ອະນຸມັດ PO (WPOA) — ຂຽນລົງ ERP ບ່ອນດຽວ.**
 *
 * ── ຕ່ອງໂສ້ ──
 *   SPR (ໃບຂໍຊື້, erp-spr.ts) → WPRA (ອະນຸມັດ) → POT/POH (ໃບສັ່ງຊື້) → WPOA (ອະນຸມັດ PO)
 *   → PUIT/PUIH (ຮັບເຂົ້າສາງ ຢູ່ ERP) — ຜູກກັນຜ່ານ ref_doc_no + item_code.
 *
 * ── ຜູ້ສະໜອງ ──
 * ຕັດສິນ **ຕອນອະນຸມັດ PR** (WPRA.cust_code) — ຈັດຊື້ເລືອກຈາກ ap_supplier (erp-supplier.ts).
 * ໃບຈິງ WPRA2026070029 = SPR26060017 · cust_code 02-0016 · price 35,000 · sum 105,000.
 *
 * ── ⚠️ ຢ່າກ໋ອບໂຄ້ດເກົ່າ ──
 * ໂຄ້ດ SPR ເກົ່າຂຽນ ERP ບໍ່ຄົບ (line_number=0, price ຫວ່າງ — 83% ຂອງແຖວ).
 * ບ່ອນນີ້ໃສ່ຖັນຄົບຕາມແມ່ແບບ WPRA/WPOA ຈິງ: line_number · price · price_exclude_vat ·
 * sum_amount · sum_amount_exclude_vat · vat_rate · currency · is_get_price.
 * ບໍ່ຄິດ VAT ໃນລາຄາ (vat_type=2 = ລວມ VAT ແລ້ວ, ຄື WPRA/WPOA ຈິງທີ່ vat_value=0).
 */

const D = {
  TRANS_TYPE: 1,
  /** ລວມ VAT ໃນລາຄາແລ້ວ (ບໍ່ຄິດແຍກ) — ຄ່າຕັ້ງຕົ້ນຂອງໃບພາຍໃນ (WPRA/WPOA) */
  VAT_TYPE: 2,
  VAT_RATE: 10,
  /** **01 = ບາດ** (ບໍ່ແມ່ນກີບ! erp_currency: 01 ບາດ · 02 ກີບ · 03 ໂດລາ · 04 ຢວນ) */
  CURRENCY: "01",
  EXCHANGE_RATE: 1,
  CALC_FLAG: 1,
  STAND_VALUE: 1,
  DIVIDE_VALUE: 1,
  IS_GET_PRICE: 1,
  /** ຈ່າຍສົດ — ຄ່າຕັ້ງຕົ້ນຂອງໃບພາຍໃນ (WPRA ຈິງ 3,774/3,774 ໃບ credit_day ວ່າງ = ສົດ) */
  CREDIT_DAY: 0,
} as const;

/**
 * ເງື່ອນໄຂເງິນຂອງໃບ PO — ສະກຸນເງິນ · ອັດຕາແລກປ່ຽນ · VAT.
 *
 * ── ວິທີທີ່ ERP ຄິດ (ຢືນຢັນຈາກໃບຈິງ 17-07-2026) ──
 *   vat_type 0 = **VAT ແຍກນອກ** → total_before_vat = ຍອດ · total_vat_value = ຍອດ×rate%
 *                                  · total_after_vat = total_amount = ຍອດ+VAT
 *                                  (ສາຂາ 05 ໄທ ໃຊ້ແບບນີ້ 954 ໃບ · VAT 7%)
 *   vat_type 2 = **ລວມ VAT ໃນລາຄາແລ້ວ** → before/vat/after = 0 · total_amount = ຍອດ
 *                                  (ສາຂາ 00 ລາວ ໃຊ້ແບບນີ້ 739 ໃບ · VAT 10%)
 * ອັດຕາແລກປ່ຽນ = **ບາດຕໍ່ 1 ໜ່ວຍ** (ບາດ 1 · ໂດລາ 33 · ກີບ 0.0014598).
 *
 * ── ສົດ ຫຼື ຕິດໜີ້ (ຢືນຢັນຈາກໃບຈິງ 17-07-2026) ──
 * ERP **ບໍ່ມີ**ຖັນ "ສົດ/ຕິດໜີ້" ແຍກ — ມັນບອກດ້ວຍ `credit_day`:
 *   credit_day = 0 → **ສົດ** · credit_day > 0 → **ຕິດໜີ້ N ວັນ**
 * ແລ້ວ `credit_date` = ວັນຄົບກຳນົດ = doc_date + credit_day — **ຖືກທຸກໃບ**
 * (PO 5,398/5,398 · PUI 5,478/5,478 ບໍ່ມີ null ເລີຍ ⇒ ຖັນນີ້ບັງຄັບ ບໍ່ແມ່ນທາງເລືອກ).
 * ⚠️ ຢ່າໃຊ້ `inquiry_type` (PO 84% ເປັນ 0 ໝົດ — ບໍ່ແມ່ນຕົວບອກການຈ່າຍ)
 * ແລະ ຢ່າໃຊ້ `due_date` (0/10,876 ໃບ — ERP ບໍ່ເຄີຍໃສ່).
 */
export type PoTerms = {
  currency_code: string;
  exchange_rate: number;
  /** 0 = ແຍກນອກ · 2 = ລວມແລ້ວ */
  vat_type: number;
  vat_rate: number;
  /** **0 = ຈ່າຍສົດ** · >0 = ຕິດໜີ້ຈຳນວນວັນນີ້ (ວັນຄົບກຳນົດຄິດເອງ = doc_date + ຄ່ານີ້) */
  credit_day: number;
};

/** ຍອດຂອງໃບຕາມກົດ VAT ຂອງ ERP — ນິຍາມບ່ອນດຽວ ໃຊ້ທັງຕອນຂຽນ ແລະ ຕອນສະແດງ */
export function poTotals(value: number, terms: Pick<PoTerms, "vat_type" | "vat_rate">) {
  if (terms.vat_type === 0) {
    const vat = (value * terms.vat_rate) / 100;
    return { value, before_vat: value, vat_value: vat, after_vat: value + vat, amount: value + vat };
  }
  return { value, before_vat: 0, vat_value: 0, after_vat: 0, amount: value };
}


/** ຫົວເລກ = ຄຳນຳໜ້າ + ປີ 2 ຕົວ + ເດືອນ 2 ຕົວ (ຕົວຢ່າງຈິງ: POT2607 + 0037) */
const stemOf = (prefix: string, doc_date: string) => `${prefix}${doc_date.slice(2, 4)}${doc_date.slice(5, 7)}`;

/** ນິຍາມ "ເລກຖັດໄປ" ມີບ່ອນດຽວ — ທັງຕອນອອກຈິງ ແລະ ຕອນສະແດງລ່ວງໜ້າ ໃຊ້ອັນນີ້ */
const nextNoSql = (stem: string) =>
  `select coalesce(max(substring(doc_no from ${stem.length + 1})::int), 0) + 1 seq
     from ic_trans where trans_flag = $1 and doc_no like $2
       and substring(doc_no from ${stem.length + 1}) ~ '^[0-9]+$'`;

/** ເລກເອກະສານ ERP ຖັດໄປ — ອອກຈາກ ERP (ບໍ່ຊ້ຳ). ຕ້ອງເອີ້ນໃນ transaction ທີ່ລັອກແລ້ວ. */
async function nextErpNo(odg: PoolClient, prefix: string, transFlag: number, doc_date: string): Promise<string> {
  const stem = stemOf(prefix, doc_date);
  const row = (await odg.query<{ seq: number }>(nextNoSql(stem), [transFlag, `${stem}%`])).rows[0];
  return `${stem}${String(row?.seq ?? 1).padStart(4, "0")}`;
}

/**
 * ເລກ PO ທີ່**ຈະ**ໄດ້ — ສະແດງໃນຟອມກ່ອນບັນທຶກ (ຄື Odoo ທີ່ບອກເລກລ່ວງໜ້າ).
 *
 * ⚠️ ເປັນພຽງການສະແດງ: ເລກຈິງອອກຕອນບັນທຶກ ພາຍໃນ txn ທີ່ລັອກແລ້ວ ⇒ ຖ້າມີຄົນອື່ນ
 * ອອກໃບແຊກກ່ອນ ເລກຈິງຈະຂະຫຍັບ. ຢ່າເອົາເລກນີ້ໄປຂຽນລົງໃສ.
 */
export async function peekPoNo(branch: string, doc_date: string): Promise<string> {
  const stem = stemOf(poFormatOf(branch), doc_date);
  const row = (await queryOdg<{ seq: number }>(nextNoSql(stem), [ERP_PURCHASE.ORDER, `${stem}%`])).rows[0];
  return `${stem}${String(row?.seq ?? 1).padStart(4, "0")}`;
}

/** ແຖວຂອງໃບ (ອ່ານຈາກ SPR/PO ຕົ້ນທາງ) — ດຶງມາທັງ item ແລະ ລາຄາ */
export type ChainLine = {
  item_code: string;
  item_name: string | null;
  unit_code: string | null;
  qty: string;
  price: string;
};

export async function linesOf(odg: PoolClient, docNo: string, transFlag: number): Promise<ChainLine[]> {
  return (
    await odg.query<ChainLine>(
      `select item_code, item_name, unit_code, qty::text, coalesce(price,0)::text price
         from ic_trans_detail where doc_no = $1 and trans_flag = $2 order by line_number`,
      [docNo, transFlag],
    )
  ).rows;
}

/** ຊື່ຊັ້ນວາງ "ຂອງດີ" ໃນ ic_shelf — ມີສາງລະ**ອັນດຽວ** (23 ສາງ · ບໍ່ມີສາງໃດຊ້ຳ) */
const GOOD_SHELF_NAME = "ສະພາບດີ";

/**
 * **ທີ່ເກັບຕັ້ງຕົ້ນ = "ສະພາບດີ" ຂອງສາງນັ້ນ** (ic_trans_detail.shelf_code).
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ແຖວ PO ຈິງ **34,667/34,676 (99.97%) ມີ shelf_code** ⇒ ຖັນນີ້ບໍ່ແມ່ນທາງເລືອກ,
 * ແລະ 99.9% ຂອງມັນເປັນຊັ້ນວາງ**ຂອງສາງຕົນເອງ** (s.whcode = d.wh_code).
 * ຂອງທີ່ຫາກໍສັ່ງຊື້ເຂົ້າມາຄື**ຂອງໃໝ່** ⇒ ຕົກໃສ່ "ສະພາບດີ" ບໍ່ແມ່ນຊັ້ນຕຳນິ/ເພ.
 *
 * ── ຖາມ ERP ບໍ່ແມ່ນເດົາ ──
 * ລະຫັດຊັ້ນວາງເບິ່ງຄືສູດ (ສາງ 1203 → 120301) ແຕ່**ຢ່າປະກອບເອົາເອງ**:
 * ສາງ 990101 → 99010101 (ບໍ່ຕາມສູດ). ອ່ານຈາກ ic_shelf ສະເໝີ.
 *
 * ຄືນ "" ຖ້າສາງນັ້ນ**ບໍ່ມີ**ຊັ້ນ "ສະພາບດີ" — ມີແທ້ 11/34 ສາງ (ຕົວຢ່າງ 9904 ສາງເຄື່ອງໃຊ້
 * ຫ້ອງການ ໃຊ້ "ສາງໄອທີ" ແທນ). ກໍລະນີນັ້ນປະຫວ່າງໄວ້ ໃຫ້ຈັດຊື້ໄປແກ້ຢູ່ ERP —
 * ດີກວ່າຍັດຊັ້ນຜິດໃສ່ ຫຼື ລົ້ມການອອກໃບ.
 */
async function goodShelfOf(odg: PoolClient, whCode: string): Promise<string> {
  if (!whCode) return "";
  const row = (
    await odg.query<{ code: string }>(
      `select code from ic_shelf where whcode=$1 and name_1=$2 and is_active=1 order by code limit 1`,
      [whCode, GOOD_SHELF_NAME],
    )
  ).rows[0];
  return row?.code ?? "";
}

/**
 * ຂໍ້ມູນຈັດສົ່ງຂອງໃບ PO — ໃບຈິງ**ທຸກໃບ**ມີ (2,188/2,188 ໃນ 1 ປີ) ແຕ່ໂຄ້ດເກົ່າບໍ່ເຄີຍຂຽນ.
 * `wh_code` ໃສ່ທຸກແຖວ (ແຖວ PO ຈິງ 99.97% ມີ) — ສາງທີ່ຮັບເຂົ້າຕັດສິນຢູ່ຂັ້ນ PO.
 */
export type PoShipping = {
  /** ວັນທີຄາດວ່າຈະມາຮອດ (ic_trans.send_date) — YYYY-MM-DD */
  send_date: string;
  /** ຊ່ອງທາງການຈັດສົ່ງ (ic_trans.transport_code → transport_type) */
  transport_code: string;
  /** ສາງທີ່ຮັບເຂົ້າ (ic_trans_detail.wh_code) */
  wh_code: string;
};

/**
 * ຂຽນຫົວ + ແຖວຂອງເອກະສານໃນຕ່ອງໂສ້ (WPRA/PO/WPOA ໂຄງດຽວກັນ ຕ່າງແຕ່ flag/format/ref).
 *
 * `refDoc` ຫວ່າງ = **ໃບລອຍ** (ບໍ່ອ້າງອີງໃບກ່ອນໜ້າ) — ຮູບແບບຂອງໃບຈິງ (POT26070060):
 * ຫົວ `doc_ref` = null · ແຖວ `doc_ref` = '' ແລະ `ref_doc_no` = null.
 * ຂໍ້ມູນຈິງ: 1,305/2,187 ໃບ PO ໃນ 1 ປີ (60%) ອອກແບບລອຍ ⇒ ຮູບແບບນີ້ຖືກຕ້ອງຕາມ ERP.
 */
async function writeChainDoc(
  odg: PoolClient,
  opts: {
    docNo: string;
    transFlag: number;
    format: string;
    /** ໃບກ່ອນໜ້າ — ຫວ່າງ = ໃບລອຍ */
    refDoc: string;
    jobCode: string;
    branch: string;
    supplier: string;
    doc_date: string;
    doc_time: string;
    creator: string;
    lines: ChainLine[];
    /** ໝາຍເຫດ — ບໍ່ໃສ່ = ໃຊ້ລະຫັດວຽກ (ຮູບແບບຂອງໃບທີ່ຜູກວຽກສ້ອມ) */
    remark?: string;
    /** ຂໍ້ມູນຈັດສົ່ງ — ໃສ່ສະເພາະໃບ PO (WPRA/WPOA ຈິງບໍ່ມີ transport/wh_code) */
    shipping?: PoShipping;
    /** ສະກຸນເງິນ/VAT — ບໍ່ໃສ່ = ຄ່າຕັ້ງຕົ້ນຂອງໃບພາຍໃນ (ບາດ · ລວມ VAT 10%) */
    terms?: PoTerms;
  },
): Promise<number> {
  const value = opts.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.price), 0);
  const remark = opts.remark ?? opts.jobCode;
  const headRef = opts.refDoc || null;
  // ໃບຈິງ: send_date ມີທຸກຂັ້ນ (PO/WPRA/WPOA 100%) · transport_code ສະເພາະ PO
  const sendDate = opts.shipping?.send_date || opts.doc_date;
  const transport = opts.shipping?.transport_code ?? "";
  const whCode = opts.shipping?.wh_code ?? "";
  /**
   * ທີ່ເກັບ = "ສະພາບດີ" ຂອງສາງນັ້ນ — ຖາມ ERP ຕອນຂຽນ ບໍ່ໃຫ້ຟອມສົ່ງມາ (ຄືການຢືນຢັນ
   * ຜູ້ສະໜອງ/ສາງ). ໃບ WPRA/WPOA ບໍ່ມີສາງ ⇒ ໄດ້ "" ຄືໃບຈິງ (shelf_code 0/34,130 ແຖວ).
   */
  const shelfCode = await goodShelfOf(odg, whCode);
  const terms: PoTerms = opts.terms ?? {
    currency_code: D.CURRENCY,
    exchange_rate: D.EXCHANGE_RATE,
    vat_type: D.VAT_TYPE,
    vat_rate: D.VAT_RATE,
    credit_day: D.CREDIT_DAY,
  };
  const t = poTotals(value, terms);
  // ວັນຄົບກຳນົດ ຄິດຢູ່ຝັ່ງ ERP (doc_date + credit_day) — ສູດດຽວກັບໃບຈິງທຸກໃບ
  await odg.query(
    `insert into ic_trans(trans_type, trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, doc_time,
       branch_code, cust_code, remark, status, doc_format_code, vat_type, vat_rate, currency_code,
       exchange_rate, total_value, total_amount, total_before_vat, total_vat_value, total_after_vat,
       user_request, user_approve, creator_code, send_date, transport_code, credit_day, credit_date,
       create_date_time_now)
     values($1,$2,$3,$4,$5,$3,$6,$7,$8,$9,0,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20,$20,$21,$22,
       $23,$3::date + $23::int,localtimestamp)`,
    [
      D.TRANS_TYPE, opts.transFlag, opts.doc_date, opts.docNo, headRef, opts.doc_time,
      opts.branch, opts.supplier, remark, opts.format, terms.vat_type, terms.vat_rate, terms.currency_code,
      terms.exchange_rate, t.value, t.amount, t.before_vat, t.vat_value, t.after_vat,
      opts.creator, sendDate, transport, terms.credit_day,
    ],
  );

  let lineNumber = 0;
  for (const line of opts.lines) {
    lineNumber += 1;
    const qty = Number(line.qty);
    const price = Number(line.price);
    const amount = qty * price;
    await odg.query(
      `insert into ic_trans_detail(trans_type, trans_flag, doc_date, doc_no, doc_ref, ref_doc_no, cust_code,
         item_code, item_name, unit_code, qty, price, price_exclude_vat, sum_amount, sum_amount_exclude_vat,
         line_number, ref_line_number, branch_code, status, calc_flag, vat_type, stand_value, divide_value,
         is_get_price, wh_code, shelf_code, doc_date_calc, doc_time_calc, doc_time)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$13,$14,0,$15,0,$16,$17,$18,$19,$20,$21,$23,$3,$22,$22)`,
      [
        D.TRANS_TYPE, opts.transFlag, opts.doc_date, opts.docNo, opts.refDoc, headRef, opts.supplier,
        line.item_code, line.item_name ?? "", line.unit_code ?? "", qty, price, amount,
        lineNumber, opts.branch, D.CALC_FLAG, terms.vat_type, D.STAND_VALUE, D.DIVIDE_VALUE,
        D.IS_GET_PRICE, whCode, opts.doc_time, shelfCode,
      ],
    );
  }
  return t.amount;
}

/** ຮູບແບບໃບສັ່ງຊື້ຕາມສາຂາ — POT (ໄທ 05) / POH (ລາວ 00), ຄືທີ່ໃບຈິງໃຊ້ */
const poFormatOf = (branch: string) => (branch === "05" ? "POT" : "POH");

/**
 * **ອອກໃບສັ່ງຊື້ໂດຍກົງ (ບໍ່ຜ່ານໃບຂໍຊື້)** — ຄືກົດ New ໃນ Odoo Purchase.
 *
 * ບໍ່ແມ່ນທາງລັດຜິດຂັ້ນຕອນ: ERP ເຮັດແບບນີ້ເປັນປົກກະຕິ (60% ຂອງ PO ບໍ່ອ້າງອີງໃບໃດ) —
 * ຊື້ຕຸນເຂົ້າສາງ/ຊື້ດ່ວນ ບໍ່ໄດ້ເກີດຈາກໃບຂໍຊື້ຂອງວຽກສ້ອມ. ຫຼັງອອກແລ້ວຍັງຕ້ອງ
 * **ອະນຸມັດ PO (WPOA)** ກ່ອນ ແລ້ວຈຶ່ງຮັບເຂົ້າສາງ — ດ່ານອະນຸມັດບໍ່ໄດ້ຫາຍໄປ.
 */
export async function createPo(
  odg: PoolClient,
  input: {
    branch: string;
    supplier: string;
    remark: string;
    doc_date: string;
    doc_time: string;
    issuer: string;
    lines: ChainLine[];
    shipping: PoShipping;
    terms: PoTerms;
  },
): Promise<string> {
  if (!odgDb) throw new Error("ບໍ່ພົບ ODG_DATABASE_URL");
  if (input.lines.length === 0) throw new Error("ໃບສັ່ງຊື້ຕ້ອງມີລາຍການ");
  const creator = await employeeCode(input.issuer);

  const format = poFormatOf(input.branch);
  const po = await nextErpNo(odg, format, ERP_PURCHASE.ORDER, input.doc_date);
  await writeChainDoc(odg, {
    docNo: po, transFlag: ERP_PURCHASE.ORDER, format, refDoc: "",
    jobCode: "", branch: input.branch, supplier: input.supplier,
    doc_date: input.doc_date, doc_time: input.doc_time, creator, lines: input.lines,
    remark: input.remark, shipping: input.shipping, terms: input.terms,
  });
  return po;
}

/**
 * ① ອະນຸມັດ PR → ຂຽນ **WPRA ຢ່າງດຽວ** (16-07-2026: ບໍ່ອອກ PO ພ້ອມອີກ).
 *
 * ຜູ້ສະໜອງ**ບໍ່ບັງຄັບ**ຢູ່ຂັ້ນນີ້ — ນະໂຍບາຍ: ເລືອກຕອນ**ອອກ PO** (issuePo)
 * ບໍ່ແມ່ນຕອນອະນຸມັດ. ຂໍ້ມູນຈິງຮອງຮັບ: 39/667 ແຖວ SPR ບໍ່ມີ cust_code
 * ແລະ ຍັງໄຫຼຄົບຕ່ອງໂສ້. ຄືນເລກ WPRA. ໂຍນ error ຖ້າ ERP ລົ້ມ (ຜູ້ເອີ້ນ rollback).
 */
export async function approvePr(
  odg: PoolClient,
  input: { sprNo: string; jobCode: string; branch: string; doc_date: string; doc_time: string; approver: string },
): Promise<string> {
  if (!odgDb) throw new Error("ບໍ່ພົບ ODG_DATABASE_URL");
  const creator = await employeeCode(input.approver);
  const lines = await linesOf(odg, input.sprNo, ERP_PURCHASE.PR_REQUEST);
  if (lines.length === 0) throw new Error(`ໃບຂໍຊື້ ${input.sprNo} ບໍ່ມີລາຍການ`);

  const wpra = await nextErpNo(odg, "WPRA", ERP_PURCHASE.PR_APPROVE, input.doc_date);
  await writeChainDoc(odg, {
    docNo: wpra, transFlag: ERP_PURCHASE.PR_APPROVE, format: "WPRA", refDoc: input.sprNo,
    jobCode: input.jobCode, branch: input.branch, supplier: "",
    doc_date: input.doc_date, doc_time: input.doc_time, creator, lines,
  });
  return wpra;
}

/**
 * ② ອອກໃບສັ່ງຊື້ (PO) ຈາກ WPRA ທີ່ອະນຸມັດແລ້ວ — **ຂັ້ນນີ້ແຫຼະທີ່ບັງຄັບຜູ້ສະໜອງ**
 * (ໃບ PO ຈິງທຸກໃບມີ cust_code — ການເລືອກຜູ້ສະໜອງຄືເນື້ອແທ້ຂອງການສັ່ງຊື້).
 *
 * PO ອອກໄດ້ສອງທາງ: ຈາກ ODSS ຜ່ານຟັງຊັນນີ້ ຫຼື **ອອກໃນ ERP ໂດຍກົງ** —
 * ທັງສອງທາງ tracking ຈັບໄດ້ຄືກັນ (ຕ່ອງໂສ້ອ່ານຈາກ ref_doc_no ຢູ່ ERP ຢູ່ແລ້ວ).
 */
export async function issuePo(
  odg: PoolClient,
  input: {
    wpraNo: string;
    jobCode: string;
    branch: string;
    supplier: string;
    doc_date: string;
    doc_time: string;
    issuer: string;
    /** ຄາດວ່າຮອດ · ຊ່ອງທາງຈັດສົ່ງ · ສາງທີ່ຮັບເຂົ້າ — ຂັ້ນ PO ຄືຂັ້ນທີ່ ERP ຕື່ມສາມຢ່າງນີ້ */
    shipping: PoShipping;
    /** ສະກຸນເງິນ · ອັດຕາແລກປ່ຽນ · VAT — ຕັດສິນຢູ່ຂັ້ນ PO ຄືກັນ */
    terms: PoTerms;
    /**
     * ແຖວທີ່ຈັດຊື້**ແກ້ແລ້ວ** (ຈຳນວນ/ລາຄາ) — ບໍ່ໃສ່ = ກ໋ອບຈາກ WPRA ຕາມເດີມ.
     * ຈຳເປັນ ເພາະໃບຂໍຊື້ຂອງຊ່າງບໍ່ຮູ້ລາຄາ (ອອກມາ price=0) — **ລາຄາເກີດຢູ່ຂັ້ນ PO**
     * ຕອນຈັດຊື້ຕໍ່ລອງກັບຜູ້ສະໜອງແລ້ວ. ຜູ້ເອີ້ນຕ້ອງກວດວ່າ item ຢູ່ໃນ WPRA ແທ້.
     */
    lines?: ChainLine[];
  },
): Promise<string> {
  if (!odgDb) throw new Error("ບໍ່ພົບ ODG_DATABASE_URL");
  const creator = await employeeCode(input.issuer);
  const lines = input.lines ?? (await linesOf(odg, input.wpraNo, ERP_PURCHASE.PR_APPROVE));
  if (lines.length === 0) throw new Error(`ໃບອະນຸມັດ ${input.wpraNo} ບໍ່ມີລາຍການ`);

  const poFormat = poFormatOf(input.branch);
  const po = await nextErpNo(odg, poFormat, ERP_PURCHASE.ORDER, input.doc_date);
  await writeChainDoc(odg, {
    docNo: po, transFlag: ERP_PURCHASE.ORDER, format: poFormat, refDoc: input.wpraNo,
    jobCode: input.jobCode, branch: input.branch, supplier: input.supplier,
    doc_date: input.doc_date, doc_time: input.doc_time, creator, lines,
    shipping: input.shipping, terms: input.terms,
  });
  return po;
}

/**
 * ③ ອະນຸມັດ PO → ຂຽນ WPOA (ref = ໃບ PO). ຄືນເລກ WPOA.
 * ຫຼັງຈາກນີ້ວຽກລໍແຕ່ ERP ຮັບເຂົ້າສາງ (syncErpPurchase ຈັບເອງ).
 */
export async function approvePo(
  odg: PoolClient,
  input: { poNo: string; jobCode: string; branch: string; supplier: string; doc_date: string; doc_time: string; approver: string },
): Promise<string> {
  if (!odgDb) throw new Error("ບໍ່ພົບ ODG_DATABASE_URL");
  const creator = await employeeCode(input.approver);
  const lines = await linesOf(odg, input.poNo, ERP_PURCHASE.ORDER);
  if (lines.length === 0) throw new Error(`ໃບສັ່ງຊື້ ${input.poNo} ບໍ່ມີລາຍການ`);

  // ໃບອະນຸມັດຕ້ອງເວົ້າເລື່ອງເງິນຄືກັບໃບທີ່ມັນອະນຸມັດ ⇒ ສືບທອດສະກຸນເງິນ/VAT/ເງື່ອນໄຂຈ່າຍ ຈາກ PO
  const src = (
    await odg.query<{
      currency_code: string | null; exchange_rate: string | null;
      vat_type: number | null; vat_rate: string | null; credit_day: number | null;
    }>(
      `select currency_code, exchange_rate, vat_type, vat_rate, credit_day
         from ic_trans where doc_no=$1 and trans_flag=$2`,
      [input.poNo, ERP_PURCHASE.ORDER],
    )
  ).rows[0];
  const terms: PoTerms = {
    currency_code: src?.currency_code || D.CURRENCY,
    exchange_rate: Number(src?.exchange_rate ?? D.EXCHANGE_RATE) || D.EXCHANGE_RATE,
    vat_type: src?.vat_type ?? D.VAT_TYPE,
    vat_rate: Number(src?.vat_rate ?? D.VAT_RATE),
    credit_day: src?.credit_day ?? D.CREDIT_DAY,
  };

  const wpoa = await nextErpNo(odg, "WPOA", ERP_PURCHASE.ORDER_APPROVE, input.doc_date);
  await writeChainDoc(odg, {
    docNo: wpoa, transFlag: ERP_PURCHASE.ORDER_APPROVE, format: "WPOA", refDoc: input.poNo,
    jobCode: input.jobCode, branch: input.branch, supplier: input.supplier,
    doc_date: input.doc_date, doc_time: input.doc_time, creator, lines, terms,
  });
  return wpoa;
}
