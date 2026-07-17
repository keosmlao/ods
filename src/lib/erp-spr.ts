import { employeeCode } from "@/lib/erp-employee";
import { odgDb } from "@/lib/db";
import { ERP_PURCHASE } from "@/lib/stock-constants";
import type { PoolClient } from "pg";

/**
 * **ອອກໃບຂໍສະເໜີຊື້ (SPR) ລົງ ERP** — ບ່ອນດຽວຂອງລະບົບ. ບໍ່ຂຽນ ODS ເລີຍ.
 *
 * ── ເປັນຫຍັງບໍ່ມີໃບ RQ ຢູ່ ODS ອີກ ──
 * ERP **ບໍ່ມີ `trans_flag=78` ຈັກແຖວ** — ມັນໃຊ້ `trans_flag=2` ເປັນ "ໃບຂໍຊື້" ທັງໝົດ
 * ແລ້ວແຍກປະເພດດ້ວຍ `doc_format_code` (PRTN 1,414 · PRHN 888 · SPR 549 · PRTM 304 …).
 * ⇒ `RQ` ຄືສິ່ງທີ່ ODS ຄິດຂຶ້ນເອງ ແລ້ວກ໋ອບເປັນ SPR ໄປ ERP ອີກໃບ = **ໃບດຽວກັນ ເກັບສອງບ່ອນ**
 * ເຊິ່ງເປັນຕົ້ນເຫດຂອງ SPR ຜີ (SPR25110002 ຢູ່ ODS ແຕ່ບໍ່ມີໃນ ERP — ວຽກ 5679 ຄ້າງ 8 ເດືອນ).
 * ດຽວນີ້ອອກໃບຢູ່ ERP ບ່ອນດຽວ.
 *
 * ── ⚠️ ໂຄ້ດເກົ່າຂຽນ ERP **ບໍ່ຄົບ** — ຢ່າກ໋ອບມັນ ──
 * ທຽບແຖວ SPR (ODSS ຂຽນ) ກັບ PRHN (ERP ຂຽນເອງ) ພົບວ່າ ODSS ຂາດ:
 *   `line_number` (556/667 ແຖວ = **83%** ເປັນ 0 · ຝັ່ງ ERP ພຽງ 4%)
 *   `price` · `sum_amount` · `sum_amount_exclude_vat` · `doc_time` · `doc_time_calc` · `is_get_price`
 * ⇒ ໃບອອກໄປດ້ວຍລາຄາ 0 ແລະ ບໍ່ມີເລກແຖວ. ບ່ອນນີ້ໃສ່ຄົບຕາມແມ່ແບບ PRHN.
 *
 * ── ຜູກກັບວຽກສ້ອມແນວໃດ ──
 * ERP **ບໍ່ມີຖັນ `product_code`** (ODS ມີ) ⇒ ລະຫັດງານໄປຢູ່ `doc_ref` ແລະ `remark`
 * — ຮູບແບບດຽວກັນກັບໃບຂໍເບີກ (lib/erp-request). ນັ້ນຄືທາງດຽວທີ່ຄົນ ERP ຈະຮູ້ວ່າໃບນີ້ຂອງງານໃດ
 * ແລະ ທາງດຽວທີ່ lib/erp-purchase ຈະຕິດຕາມກັບຄືນມາໄດ້.
 *
 * ── ຜູ້ສະໜອງ ──
 * **ບໍ່ຕ້ອງມີ** — 39/667 ແຖວ SPR ບໍ່ມີ `cust_code` ແລະ ໃບເຫຼົ່ານັ້ນຍັງໄຫຼຜ່ານ
 * WPRA → PO → ຮັບເຂົ້າສາງ ໄດ້ປົກກະຕິ. ຜູ້ສະໜອງຖືກຕື່ມຕອນອອກ **PO** ຢູ່ ERP
 * (PO ຕ້ອງມີຜູ້ສະໜອງ + ລາຄາຕໍ່ລອງ + VAT ທີ່ ODSS ບໍ່ມີ ⇒ PO ຢູ່ ERP ຕໍ່ໄປ).
 */

/** doc_format_code ຂອງໃບຂໍຊື້ທີ່ອອກຈາກລະບົບນີ້ — ແຍກຈາກ PRHN/PRTN ທີ່ຄົນ ERP ອອກເອງ */
export const SPR_FORMAT = "SPR";

/** ຄ່າຄົງທີ່ຂອງ ERP ທີ່ແຖວ PRHN ໃຊ້ — ກ໋ອບມາຈາກໃບຈິງ ບໍ່ແມ່ນເດົາ */
const ERP_DEFAULTS = {
  TRANS_TYPE: 1,
  INQUIRY_TYPE: 0,
  /** ບໍ່ແຕະສະຕັອກ ແຕ່ນັບເປັນຂາເຂົ້າ (ຄືທີ່ PRHN ໃຊ້) */
  CALC_FLAG: 1,
  VAT_TYPE: 2,
  STAND_VALUE: 1,
  DIVIDE_VALUE: 1,
  /** ERP ໝາຍວ່າ "ລາຄາຖືກດຶງມາແລ້ວ" — PRHN = 1 · SPR ເກົ່າ = 0 */
  IS_GET_PRICE: 1,
} as const;

export type SprLine = {
  item_code: string;
  item_name: string | null;
  unit_code: string | null;
  qty: string | number;
  /** ລາຄາຕໍ່ໜ່ວຍ — ຟອມເກັບຢູ່ແລ້ວ. 0 = ຍັງບໍ່ຮູ້ລາຄາ (ຈັດຊື້ຕື່ມຕອນອອກ PO) */
  price: number;
};

export type SprDoc = {
  doc_no: string;
  /** YYYY-MM-DD */
  doc_date: string;
  /** HH:MM */
  doc_time: string;
  /** ລະຫັດວຽກສ້ອມ — ERP ບໍ່ມີຖັນ product_code ຈຶ່ງໄປຢູ່ doc_ref */
  job_code: string;
  /** ສາຂາ ERP: 00 = ສຳນັກງານໃຫ່ຍ · 05 = ໂອດ່ຽນໄທ */
  branch_code: string;
  remark: string;
  /** ຜູ້ຂໍ (session.username) — ແປງເປັນລະຫັດພະນັກງານ ERP */
  requester: string;
  lines: SprLine[];
};


/**
 * ເລກໃບ SPR ຖັດໄປ — **ອອກຈາກ ERP** (ບໍ່ແມ່ນ ODS) ເພາະ ERP ຄືເຈົ້າຂອງລຳດັບດຽວດຽວນີ້.
 * ຮູບແບບ `SPR` + ປີ 2 ຕົວ + ເດືອນ 2 ຕົວ + ລຳດັບ 4 ຕົວ (ຕົວຢ່າງຈິງ: SPR26070007).
 *
 * ⚠️ ຕ້ອງເອີ້ນ**ພາຍໃນ transaction ທີ່ລັອກແລ້ວ** — ບໍ່ດັ່ງນັ້ນສອງຄົນກົດພ້ອມກັນໄດ້ເລກຊ້ຳ.
 */
export async function nextSprNo(odg: PoolClient, doc_date: string): Promise<string> {
  const prefix = `${SPR_FORMAT}${doc_date.slice(2, 4)}${doc_date.slice(5, 7)}`;
  const row = (
    await odg.query<{ seq: number }>(
      `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 seq
         from ic_trans
        where trans_flag = $1 and doc_no like $2
          and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`,
      [ERP_PURCHASE.PR_REQUEST, `${prefix}%`],
    )
  ).rows[0];
  return `${prefix}${String(row?.seq ?? 1).padStart(4, "0")}`;
}

/**
 * ຂຽນໃບ SPR ລົງ ERP — **ໂຍນ error ຖ້າລົ້ມ** (ຜູ້ເອີ້ນຕ້ອງ rollback).
 * ຮັບ client ຂອງ odg ມາຈາກຜູ້ເອີ້ນ ເພື່ອໃຫ້ອອກເລກ + ຂຽນ ຢູ່ transaction ດຽວກັນ.
 */
export async function writeErpSpr(doc: SprDoc, odg: PoolClient): Promise<void> {
  if (!odgDb) throw new Error("ບໍ່ພົບ ODG_DATABASE_URL");

  const creator = await employeeCode(doc.requester);
  // ລະຫັດງານຢູ່ໃນ remark ນຳ — ຄົນ ERP ເປີດເບິ່ງແລ້ວຮູ້ທັນທີ ບໍ່ຕ້ອງໄປໄລ່ doc_ref
  // (ໃບຊື້ເປົ່າທີ່ບໍ່ຜູກວຽກ job_code ຫວ່າງ ⇒ ເຫຼືອແຕ່ remark)
  const remark = [doc.job_code, doc.remark].filter(Boolean).join(" · ");

  /**
   * `send_date` = ວັນທີຄາດວ່າຈະໄດ້ຂອງ — ໃບຂໍຊື້ຂອງ ERP ເອງ **97% ມີ** (976/1,002)
   * ແຕ່ໂຄ້ດເກົ່າບໍ່ເຄີຍຂຽນ ⇒ ໃບ SPR ທຸກໃບອອກໄປດ້ວຍ null ແລ້ວ ERP ໄລ່ຄິວບໍ່ໄດ້.
   * ຂັ້ນຂໍຊື້ຍັງບໍ່ຮູ້ກຳນົດຈິງ (ຮູ້ຕອນອອກ PO ກັບຜູ້ສະໜອງ) ⇒ ໃສ່ວັນທີໃບໄວ້ກ່ອນ
   * ຄືທີ່ໃບ ERP ຈິງເຮັດ (907/2,188 ໃບ send_date = doc_date).
   */
  await odg.query(
    `insert into ic_trans(trans_type, trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, doc_time,
       branch_code, remark, status, doc_format_code, creator_code, user_request, send_date, create_datetime)
     values($1,$2,$3,$4,$5,$3,$6,$7,$8,0,$9,$10,$10,$3,localtimestamp)`,
    [
      ERP_DEFAULTS.TRANS_TYPE, ERP_PURCHASE.PR_REQUEST, doc.doc_date, doc.doc_no,
      doc.job_code, doc.doc_time, doc.branch_code, remark, SPR_FORMAT, creator,
    ],
  );

  let lineNumber = 0;
  for (const line of doc.lines) {
    lineNumber += 1;
    const qty = Number(line.qty);
    const amount = qty * line.price;
    await odg.query(
      `insert into ic_trans_detail(trans_type, trans_flag, doc_date, doc_no, doc_ref, inquiry_type,
         item_code, item_name, unit_code, qty, price, sum_amount, sum_amount_exclude_vat,
         line_number, ref_line_number, branch_code, status, calc_flag, vat_type,
         stand_value, divide_value, is_get_price, doc_date_calc, doc_time_calc, doc_time)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,0,$14,0,$15,$16,$17,$18,$19,$3,$20,$20)`,
      [
        ERP_DEFAULTS.TRANS_TYPE, ERP_PURCHASE.PR_REQUEST, doc.doc_date, doc.doc_no, doc.job_code,
        ERP_DEFAULTS.INQUIRY_TYPE, line.item_code, line.item_name ?? "", line.unit_code ?? "",
        qty, line.price, amount,
        lineNumber, doc.branch_code, ERP_DEFAULTS.CALC_FLAG, ERP_DEFAULTS.VAT_TYPE,
        ERP_DEFAULTS.STAND_VALUE, ERP_DEFAULTS.DIVIDE_VALUE, ERP_DEFAULTS.IS_GET_PRICE,
        doc.doc_time,
      ],
    );
  }
}
