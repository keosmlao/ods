import { odgDb, query } from "@/lib/db";
import { branchOf, CALC_NONE, ERP, TRANS } from "@/lib/stock-constants";
import type { PoolClient } from "pg";

/**
 * **ສົ່ງໃບຂໍເບີກ (trans_flag 122) ເຂົ້າ ERP** — ບ່ອນດຽວຂອງລະບົບ.
 *
 * ── ບັນຫາ ──
 * ໃບ**ເບີກ** (56) ແລະ ໃບ**ຮັບຄືນ** (58) ຂຽນລົງ ERP ຢູ່ແລ້ວ (actions/stock)
 * ແຕ່ໃບ**ຂໍເບີກ** (122) ຂຽນລົງ **ODS ຢ່າງດຽວ** ⇒ ຝ່າຍສາງ/ບັນຊີທີ່ເຮັດວຽກໃນ ERP
 * ບໍ່ເຫັນວ່າມີໃຜຂໍອາໄຫຼ່ຫຍັງແດ່ (ຂໍ້ມູນຈິງ: SIO 4,723 ໃບ ບໍ່ມີໃນ ERP ຈັກໃບ).
 *
 * ── ກົດເກນທີ່ຜູ້ຈັດການເລືອກ (13-07-2026) ──
 * ① ໃຊ້ **ເລກ SIO… ຂອງເຮົາ** ເປັນ doc_no ໃນ ERP ນຳ (PK ຂອງ ERP = doc_no+trans_flag
 *    ⇒ ບໍ່ຊົນກັບເລກ RWH… ທີ່ຄົນ ERP ອອກເອງ) ⇒ ໃບດຽວກັນມີເລກດຽວທັງສອງລະບົບ.
 * ② **ERP ຜ່ານ = ສຳເລັດ** — ຖ້າ ERP ປະຕິເສດ (trigger/ຖານລົ້ມ) ⇒ **rollback ທັງສອງຖານ**
 *    ບໍ່ໃຫ້ບັນທຶກເລີຍ ⇒ ບໍ່ມີ "ໃບຄ້າງເຄິ່ງທາງ" ທີ່ຢູ່ ODS ແຕ່ບໍ່ຢູ່ ERP ອີກ.
 * ③ ເລີ່ມ **ສະເພາະໃບໃໝ່** — ໃບເກົ່າ 4,723 ໃບບໍ່ backfill.
 *
 * ⚠️ ERP ມີ trigger 11 ຕົວຢູ່ສອງຕາຕະລາງນີ້ (ລວມ create_odg_chatbot_line_noti ທີ່ຍິງ LINE)
 * ⇒ ທຸກໃບທີ່ສົ່ງເຂົ້າໄປ **ຄົນ ERP ຮູ້ທັນທີ** — ນີ້ຄືສິ່ງທີ່ຕ້ອງການ ແຕ່ຢ່າຍິງໃບທົດລອງໃສ່.
 *
 * ⚠️ ERP **ບໍ່ມີຖັນ product_code** (ODS ມີ) ⇒ ລະຫັດງານໄປຢູ່ `doc_ref` (ແລະ remark)
 * ນັ້ນຄືທາງດຽວທີ່ຈະຮູ້ວ່າໃບນີ້ຂອງງານໃດເມື່ອເປີດເບິ່ງໃນ ERP.
 */

export type ErpRequestLine = {
  item_code: string;
  item_name: string | null;
  unit_code: string | null;
  /** ຈຳນວນ — string ຈາກ pg (numeric) ກໍ່ໄດ້ */
  qty: string | number;
};

export type ErpRequestDoc = {
  doc_no: string;
  /** YYYY-MM-DD */
  doc_date: string;
  /** HH:MM */
  doc_time: string;
  /** ລະຫັດງານ (INST-xxxx ຫຼື ເລກໃບຮັບເຄື່ອງ) — ERP ບໍ່ມີຖັນນີ້ ຈຶ່ງໄປຢູ່ doc_ref */
  job_code: string;
  wh_code: string;
  shelf_code: string;
  remark: string;
  /** ຄົນຂໍ (session.username) — ຈະຖືກແປງເປັນລະຫັດພະນັກງານ ERP ຖ້າເຊື່ອມຕົວຕົນໄວ້ແລ້ວ */
  requester: string;
  lines: ErpRequestLine[];
};

/**
 * creator_code ຂອງ ERP ຕ້ອງເປັນ **ລະຫັດພະນັກງານ** ບໍ່ແມ່ນຊື່ຫຼິ້ນ.
 * ຄົນທີ່ເຊື່ອມຕົວຕົນແລ້ວ (ods_user_employee) session.username ເປັນລະຫັດຢູ່ແລ້ວ —
 * ຄົນທີ່ຍັງບໍ່ເຊື່ອມ ຫາລະຫັດຈາກຕາຕະລາງເຊື່ອມ; ຫາບໍ່ພົບ ⇒ ປະຫວ່າງ (ERP ຮັບໄດ້)
 * ດີກວ່າຂຽນຊື່ຫຼິ້ນລົງໄປໃຫ້ຂໍ້ມູນ ERP ເປື້ອນ.
 */
async function employeeCode(username: string): Promise<string> {
  if (/^\d+$/.test(username)) return username;
  const row = (
    await query<{ employee_code: string }>(
      "select employee_code from ods_user_employee where lower(user_code) = lower($1) limit 1",
      [username],
    )
  ).rows[0];
  return row?.employee_code ?? "";
}

/**
 * ຂຽນໃບຂໍເບີກລົງ ERP — **ໂຍນ error ຖ້າລົ້ມ** (ຜູ້ເອີ້ນຕ້ອງ rollback ຝັ່ງ ODS ນຳ).
 * ຮັບ client ຂອງ odg ມາຈາກຜູ້ເອີ້ນ ຖ້າຜູ້ເອີ້ນຄຸມ transaction ເອງ.
 */
export async function writeErpRequest(doc: ErpRequestDoc, client?: PoolClient): Promise<void> {
  if (!odgDb) throw new Error("ບໍ່ພົບ ODG_DATABASE_URL");

  const own = !client;
  const odg = client ?? (await odgDb.connect());
  const creator = await employeeCode(doc.requester);

  try {
    if (own) await odg.query("begin");

    await odg.query(
      `insert into ic_trans(trans_type, trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, doc_time,
         branch_code, remark, status, doc_format_code, wh_from, location_from, creator_code,
         side_code, department_code, create_datetime)
       values($1,$2,$3,$4,$5,$3,$6,$7,$8,0,$9,$10,$11,$12,$13,$14,localtimestamp)`,
      [
        ERP.TRANS_TYPE, TRANS.REQUEST, doc.doc_date, doc.doc_no,
        // ລະຫັດງານ — ທາງດຽວທີ່ຄົນ ERP ຈະຮູ້ວ່າໃບນີ້ຂອງງານໃດ (ERP ບໍ່ມີ product_code)
        doc.job_code, doc.doc_time, branchOf(doc.wh_code),
        doc.remark ? `${doc.job_code} · ${doc.remark}` : doc.job_code,
        ERP.FORMAT_REQUEST, doc.wh_code, doc.shelf_code, creator,
        ERP.SIDE_CODE, ERP.DEPARTMENT_CODE,
      ],
    );

    let lineNumber = 0;
    for (const line of doc.lines) {
      lineNumber += 1;
      await odg.query(
        `insert into ic_trans_detail(trans_type, trans_flag, doc_date, doc_no, doc_ref, item_code, item_name,
           unit_code, qty, line_number, branch_code, wh_code, shelf_code, status, calc_flag,
           stand_value, divide_value, doc_date_calc, doc_time_calc, doc_time)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,1,1,$3,$15,$15)`,
        [
          ERP.TRANS_TYPE, TRANS.REQUEST, doc.doc_date, doc.doc_no, doc.job_code,
          line.item_code, line.item_name ?? "", line.unit_code ?? "", Number(line.qty), lineNumber,
          branchOf(doc.wh_code), doc.wh_code, doc.shelf_code,
          // ໃບ**ຂໍ**ເບີກ ບໍ່ຕັດສະຕັອກ (ໃບເບີກ 56 ຂອງສາງເປັນຄົນຕັດ) ⇒ calc_flag 0
          CALC_NONE, doc.doc_time,
        ],
      );
    }

    if (own) await odg.query("commit");
  } catch (error) {
    if (own) await odg.query("rollback").catch(() => {});
    // ຜູ້ເອີ້ນຕ້ອງເຫັນ error ນີ້ ແລ້ວ rollback ODS — "ERP ຜ່ານ = ສຳເລັດ"
    throw error;
  } finally {
    if (own) odg.release();
  }
}
