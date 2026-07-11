import { query } from "@/lib/db";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";

/**
 * ອາໄຫຼ່ທີ່ຍັງຄ້າງຢູ່ນອກສາງຂອງໃບຮັບເຄື່ອງນຶ່ງໃບ (GAP B).
 *
 * ອາໄຫຼ່ຖືວ່າ "ຍັງບໍ່ຄືນສາງ" ເມື່ອແຖວຂອງໃບເບີກ (ic_trans trans_flag 56 = SWC) ຍັງມີ
 * status = 0 (ລໍຖ້າ). ຂັ້ນຕອນສົ່ງຄືນທີ່ມີຢູ່ແລ້ວເຮັດວຽກແບບນີ້:
 *   startReturnRequest(doc_no) → ກ໋ອບແຖວ status=0 ຂອງໃບເບີກໄປໃສ່ຮ່າງ (trans_flag 33)
 *   → ໃບຂໍສົ່ງອາໄຫຼ່ຄືນ (59) → ແຖວໃບເບີກກາຍເປັນ status=1 → ສາງຮັບຄືນ (58) ບວກສະຕັອກຄືນ
 * ດັ່ງນັ້ນ "ແຖວ status=0 ຂອງໃບເບີກ" ຈຶ່ງເປັນນິຍາມດຽວກັນກັບສິ່ງທີ່ຂັ້ນຕອນນັ້ນເອົາຄືນໄດ້ຈິງ
 * (ຄົບກວ່າການເບິ່ງແຕ່ວ່າ "ມີໃບ 58/59 ອ້າງອີງໃບເບີກນີ້ບໍ່" ເພາະການສົ່ງຄືນບາງສ່ວນກໍ່ນັບ).
 *
 * ບໍ່ມີການເຄື່ອນໄຫວສະຕັອກໃດໆຢູ່ບ່ອນນີ້ — ພຽງແຕ່ "ບອກ" ແລະ "ພາໄປ" ຂັ້ນຕອນເກົ່າເທົ່ານັ້ນ.
 */

/** ເງື່ອນໄຂ SQL — ຕ້ອງ alias ຕາຕະລາງ tb_product ເປັນ a */
export const HAS_OUTSTANDING_SPARES = `exists (
  select 1 from ic_trans t
  join ic_trans_detail d on d.doc_no = t.doc_no
  where t.trans_flag = ${TRANS.DISPATCH} and t.product_code = a.code and d.status = ${LINE_STATUS.PENDING})`;

/** ຈຳນວນໃບເບີກ / ແຖວ / ຈຳນວນອາໄຫຼ່ ທີ່ຍັງຄ້າງ — ໃຊ້ເປັນຖັນຂອງລາຍການ */
export const OUTSTANDING_SUMMARY_SQL = `(
  select json_build_object(
      'docs', count(distinct t.doc_no)::int,
      'lines', count(*)::int,
      'units', coalesce(sum(d.qty),0)::float)
  from ic_trans t
  join ic_trans_detail d on d.doc_no = t.doc_no
  where t.trans_flag = ${TRANS.DISPATCH} and t.product_code = a.code and d.status = ${LINE_STATUS.PENDING})`;

export type OutstandingSummary = { docs: number; lines: number; units: number };

export type OutstandingSpare = {
  doc_no: string;
  doc_date: string | null;
  item_code: string | null;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
};

/** ລາຍການອາໄຫຼ່ທີ່ຍັງຄ້າງ ຂອງໃບຮັບເຄື່ອງນຶ່ງໃບ (ຮຽງຕາມໃບເບີກ) */
export async function getOutstandingSpares(productCode: string): Promise<OutstandingSpare[]> {
  const result = await query<OutstandingSpare>(
    `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
        d.item_code, d.item_name, coalesce(d.qty,0)::text qty, d.unit_code
      from ic_trans t
      join ic_trans_detail d on d.doc_no = t.doc_no
      where t.trans_flag = $1 and t.product_code = $2 and d.status = $3
      order by t.doc_no, d.roworder`,
    [TRANS.DISPATCH, productCode, LINE_STATUS.PENDING],
  );
  return result.rows;
}

/** ຈັດກຸ່ມຕາມໃບເບີກ — ປຸ່ມ "ຂໍສົ່ງຄືນ" ເຮັດວຽກເປັນລາຍໃບເບີກ */
export function groupByDoc(rows: OutstandingSpare[]) {
  const docs = new Map<string, { doc_no: string; doc_date: string | null; lines: OutstandingSpare[] }>();
  for (const row of rows) {
    const doc = docs.get(row.doc_no) ?? { doc_no: row.doc_no, doc_date: row.doc_date, lines: [] };
    doc.lines.push(row);
    docs.set(row.doc_no, doc);
  }
  return [...docs.values()];
}
