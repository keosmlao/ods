import { query } from "@/lib/db";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";

/**
 * ອາໄຫຼ່ຂອງ "ງານຕິດຕັ້ງ" ທີ່ຍັງຄ້າງຢູ່ນອກສາງ (B5) — ຄູ່ກັບ
 * src/app/(app)/approvals/cancellations/outstanding.ts ຂອງຝັ່ງສ້ອມ.
 *
 * ນິຍາມ "ຍັງບໍ່ຄືນສາງ" = ແຖວຂອງໃບເບີກ (ic_trans trans_flag 56 = SWC) ທີ່ status ຍັງເປັນ
 *   0 (ສາງຈ່າຍອອກແລ້ວ ຊ່າງຍັງບໍ່ທັນມາຮັບ)  ຫຼື
 *   1 (ຊ່າງຮັບອອກໄປແລ້ວ — PISP)
 * ທັງສອງກໍລະນີສະຕັອກຖືກຕັດອອກໄປແລ້ວຕອນສາງເບີກ (56) ⇒ ຂອງຢູ່ນອກສາງທັງຄູ່.
 * ພໍສ້າງໃບຂໍສົ່ງຄືນ (59) ແຖວຈະກາຍເປັນ status 3 ຈຶ່ງຫຼຸດອອກຈາກ "ຄ້າງ" ເອງ.
 *
 * ບໍ່ມີການເຄື່ອນໄຫວສະຕັອກຢູ່ບ່ອນນີ້ — ພຽງແຕ່ "ບອກ" ແລະ "ພາໄປ" ຂັ້ນຕອນເກົ່າ:
 *   startInstallReturnRequest(ໃບເບີກ) → /installations/spare-returns/<ໃບເບີກ>
 *   → ໃບຂໍສົ່ງຄືນ SRI (59) → ສາງຮັບຄືນ SRT (58) ບວກສະຕັອກຄືນ (ODS + ERP).
 *
 * ຂໍ້ມູນຈິງ: ຕະຫຼອດ 3 ປີ **ບໍ່ເຄີຍມີ** ໃບ 58/59 ຂອງງານ INST- ຈັກໃບ ⇒ ເສັ້ນທາງສົ່ງຄືນ
 * ຂອງງານຕິດຕັ້ງຍັງບໍ່ເຄີຍຖືກໃຊ້ ແລະ ນີ້ຄືການໃຊ້ຄັ້ງທຳອິດ.
 */

const OUT_STATUSES = [LINE_STATUS.PENDING, LINE_STATUS.ISSUED];

/** ສະຫຼຸບ (ໃບເບີກ/ແຖວ/ຈຳນວນ) ຂອງແຕ່ລະງານ — ໃຊ້ເປັນຖັນຂອງລາຍການ. ຕ້ອງ alias ods_tb_install ເປັນ a */
export const OUTSTANDING_SUMMARY_SQL = `(
  select json_build_object(
      'docs', count(distinct t.doc_no)::int,
      'lines', count(*)::int,
      'units', coalesce(sum(d.qty),0)::float)
  from ic_trans t
  join ic_trans_detail d on d.doc_no = t.doc_no
  where t.trans_flag = ${TRANS.DISPATCH} and t.product_code = a.code
    and d.status in (${LINE_STATUS.PENDING}, ${LINE_STATUS.ISSUED}))`;

export type OutstandingSummary = { docs: number; lines: number; units: number };

export type OutstandingSpare = {
  doc_no: string;
  doc_date: string | null;
  item_code: string | null;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
};

export type SpareDoc = { doc_no: string; doc_date: string | null; lines: OutstandingSpare[] };

/** ລາຍການອາໄຫຼ່ທີ່ຍັງຄ້າງ ຂອງງານຕິດຕັ້ງນຶ່ງງານ (ຮຽງຕາມໃບເບີກ) */
export async function getInstallOutstandingSpares(code: string): Promise<OutstandingSpare[]> {
  const result = await query<OutstandingSpare>(
    `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
        d.item_code, d.item_name, coalesce(d.qty,0)::text qty, d.unit_code
      from ic_trans t
      join ic_trans_detail d on d.doc_no = t.doc_no
      where t.trans_flag = $1 and t.product_code = $2 and d.status = any($3::int[])
      order by t.doc_no, d.roworder`,
    [TRANS.DISPATCH, code, OUT_STATUSES],
  );
  return result.rows;
}

/** ຫຼາຍງານພ້ອມກັນ (ໜ້າລາຍການ "ຍົກເລີກແລ້ວ") — ຈັດກຸ່ມເປັນ ງານ → ໃບເບີກ → ແຖວ */
export async function getInstallOutstandingByJob(codes: string[]): Promise<Map<string, SpareDoc[]>> {
  const grouped = new Map<string, SpareDoc[]>();
  if (codes.length === 0) return grouped;

  const result = await query<OutstandingSpare & { code: string }>(
    `select t.product_code code, t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
        d.item_code, d.item_name, coalesce(d.qty,0)::text qty, d.unit_code
      from ic_trans t
      join ic_trans_detail d on d.doc_no = t.doc_no
      where t.trans_flag = $1 and t.product_code = any($2::varchar[]) and d.status = any($3::int[])
      order by t.product_code, t.doc_no, d.roworder`,
    [TRANS.DISPATCH, codes, OUT_STATUSES],
  );

  for (const row of result.rows) {
    const docs = grouped.get(row.code) ?? [];
    const doc = docs.find((item) => item.doc_no === row.doc_no);
    if (doc) doc.lines.push(row);
    else docs.push({ doc_no: row.doc_no, doc_date: row.doc_date, lines: [row] });
    grouped.set(row.code, docs);
  }
  return grouped;
}
