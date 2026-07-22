import { employeeCode } from "@/lib/erp-employee";
import type { PoolClient } from "pg";

/**
 * **ສົ່ງໃບຮັບເງິນ (ໃບຮັບເງິນ SIN…, trans_flag 44) ເຂົ້າ SML** — ບ່ອນດຽວຂອງລະບົບ.
 *
 * ── ບັນຫາ (22-07-2026) ──
 * ໃບຮັບເງິນ SIN… ຂຽນລົງ **ODS ຢ່າງດຽວ** (ic_trans/cb_trans trans_flag 44) — ບໍ່ເຄີຍໄປຮອດ
 * SML ຈັກໃບ (4,456 ໃບເກົ່າ 0.00 ໝົດ) ⇒ ຝ່າຍບັນຊີເປີດ SML ບໍ່ເຫັນເງິນຄ່າບໍລິການເຂົ້າ.
 *
 * ── ກົດເກນທີ່ຜູ້ຈັດການເລືອກ (22-07-2026) ──
 * ① **ຮັບເງິນຢ່າງດຽວ (cb_trans)** — ບໍ່ຂຽນ ic_trans (ຝ່າຍຂາຍ) ຄືນ ເພາະ**ອາໄຫຼ່ຖືກຕັດ
 *    ອອກຈາກສາງ SML ໄປແລ້ວ**ຕອນເບີກ (SIO→SWC/56) ⇒ ຂຽນຂາຍຄືນ = ຕັດສະຕັອກຊ້ຳສອງເທື່ອ.
 * ② ໃຊ້ **ເລກ SIN… ຂອງເຮົາ** ເປັນ doc_no ໃນ SML ນຳ (PK = doc_no+trans_flag ⇒ ບໍ່ຊົນ
 *    ກັບເລກ CAK…/RCH… ທີ່ຄົນ SML ອອກເອງ) ⇒ ໃບດຽວກັນມີເລກດຽວທັງສອງລະບົບ.
 * ③ **ລູກຄ້າດຶງຈາກ job** — SML ບໍ່ມີລູກຄ້າສູນບໍລິການໃນທະບຽນ (ar_customer.ref_code ຫວ່າງ)
 *    ⇒ ລົງບັນຊີໃສ່ **ລູກຄ້າສູນບໍລິການ ໂຕດຽວ** (AR_CODE) ແຕ່**ຊື່/ເບີ ຂອງລູກຄ້າຈິງ**
 *    ໄປຢູ່ `description`/`remark` ⇒ ເປີດ SML ເຫັນວ່າໃບນີ້ຂອງໃຜ ໂດຍບໍ່ຕ້ອງສ້າງລູກຄ້າຮ້ອຍພັນໂຕ.
 * ④ **SML ຜ່ານ = ສຳເລັດ** — SML ປະຕິເສດ ⇒ ຜູ້ເອີ້ນ rollback ທັງສອງຖານ (ບໍ່ໃຫ້ມີໃບຄ້າງເຄິ່ງທາງ).
 * ⑤ ເລີ່ມ **ສະເພາະໃບໃໝ່** — 4,456 ໃບເກົ່າບໍ່ backfill.
 *
 * ⚠️ SML ເກັບການແບ່ງເງິນ (ສົດ/ໂອນ) ຢູ່ **ຫົວໃບ** (cash_amount / tranfer_amount) ບໍ່ແມ່ນລາຍລະອຽດ
 * ⇒ ຂຽນແຕ່ cb_trans ຫົວໃບ ກໍ່ພຽງພໍ (ບໍ່ຕ້ອງ cb_trans_detail).
 * ⚠️ ຖັນ `tranfer_amount` ຂຽນຜິດຮູບໃນ SML (ຂາດ 's') — ຕ້ອງໃຊ້ຕາມນັ້ນ.
 */

/** ຄ່າຄົງທີ່ຝັ່ງ SML ສຳລັບໃບຮັບເງິນ (cb_trans) */
const RECEIPT = {
  /** ເອກະສານຝ່າຍຂາຍ/ລູກໜີ້ = trans_type 2 (ໃບເບີກ/ໂອນສາງເປັນ 3 — ຄົນລະຊັ້ນ) */
  TRANS_TYPE: 2,
  TRANS_FLAG: 44,
  /** doc_format_code — ໃຊ້ຮູບແບບ SIN ຂອງເຮົາ (ຄືກັນກັບ erp-request ໃຊ້ SIO) */
  FORMAT: "SIN",
  /** ລູກຄ້າສູນບໍລິການໂຕດຽວໃນ SML — ສ້າງໄວ້ດ້ວຍ migrations/2026-07-22-sml-service-customer.sql */
  AR_CODE: "01-3435",
  /** ຈ່າຍສົດ/ໂອນ (ບໍ່ຕິດໜີ້) */
  PAY_TYPE: 1,
  /** ສາຂາ — ສຳນັກງານໃຫຍ່ (SML ຕັ້ງໄວ້ໃຫ້ຄ່າ '00' ໃນໃບຂາຍສ່ວນຫຼາຍ) */
  BRANCH: "00",
  CURRENCY: "01",
} as const;

export type ErpReceiptDoc = {
  /** ເລກໃບຮັບເງິນ SIN… ຂອງເຮົາ — ໃຊ້ເປັນ doc_no ໃນ SML ນຳ */
  doc_no: string;
  /** YYYY-MM-DD */
  doc_date: string;
  /** HH:MM */
  doc_time: string;
  /** ລະຫັດງານ/ເຄື່ອງ (product_code) — SML ບໍ່ມີຖັນນີ້ ຈຶ່ງໄປຢູ່ doc_ref */
  job_code: string;
  /** ຊື່ລູກຄ້າຈິງຈາກ job — ໄປຢູ່ description/remark ໃຫ້ເປີດ SML ຮູ້ວ່າໃບນີ້ຂອງໃຜ */
  cust_name: string;
  /** ເບີໂທລູກຄ້າ — ຕໍ່ທ້າຍຊື່ໃນ description */
  cust_phone: string;
  /** ຍອດຮັບເປັນ **ບາດ** ແລ້ວ (ຜູ້ເອີ້ນແປງຈາກ ກີບ/ໂດລາ ໃຫ້ແລ້ວ) */
  cash_amount: number;
  transfer_amount: number;
  /** ຄົນຮັບເງິນ (session.username) — ຈະຖືກແປງເປັນລະຫັດພະນັກງານ SML */
  cashier: string;
};

/**
 * ຂຽນໃບຮັບເງິນລົງ SML — **ໂຍນ error ຖ້າລົ້ມ** (ຜູ້ເອີ້ນຕ້ອງ rollback ຝັ່ງ ODS ນຳ).
 * ຮັບ client ຂອງ odg ມາຈາກຜູ້ເອີ້ນ (ຜູ້ເອີ້ນຄຸມ begin/commit ຂອງທັງສອງຖານເອງ).
 *
 * ບໍ່ຂຽນຫຍັງ ຖ້າຍອດຮັບ = 0 (ໃບຮັບປະກັນ/ບໍ່ເກັບເງິນ) — SML ບໍ່ຕ້ອງການໃບຮັບເງິນ 0 ບາດ.
 */
export async function writeErpReceipt(odg: PoolClient, doc: ErpReceiptDoc): Promise<boolean> {
  const total = doc.cash_amount + doc.transfer_amount;
  if (total <= 0) return false;

  const cashier = await employeeCode(doc.cashier);
  const who = doc.cust_name.trim() || "ລູກຄ້າສູນບໍລິການ";
  const description = doc.cust_phone.trim() ? `${who} · ${doc.cust_phone.trim()}` : who;

  await odg.query(
    `insert into cb_trans(trans_type, trans_flag, doc_date, doc_no, doc_ref, doc_format_code,
       currency_code, exchange_rate, total_amount, total_net_amount, total_amount_pay,
       cash_amount, tranfer_amount, ap_ar_code, pay_type, branch_code, status, doc_time,
       description, remark, cashier_code, create_date_time_now)
     values($1,$2,$3,$4,$5,$6,$7,1,$8,$8,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17,localtimestamp)`,
    [
      RECEIPT.TRANS_TYPE, RECEIPT.TRANS_FLAG, doc.doc_date, doc.doc_no,
      // ລະຫັດງານ — ທາງດຽວທີ່ຄົນ SML ຈະຮູ້ວ່າໃບນີ້ຂອງງານໃດ (SML ບໍ່ມີ product_code)
      doc.job_code, RECEIPT.FORMAT, RECEIPT.CURRENCY,
      total, doc.cash_amount, doc.transfer_amount,
      RECEIPT.AR_CODE, RECEIPT.PAY_TYPE, RECEIPT.BRANCH, doc.doc_time,
      description, `${doc.job_code} · ${who}`, cashier,
    ],
  );
  return true;
}
