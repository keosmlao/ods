import { query, queryOdg } from "@/lib/db";
// ດ່ານ "ນອກມາດຕະຖານ" ຢູ່ໄຟລ໌ -shared (ບໍ່ແຕະຖານ ⇒ ທົດສອບໄດ້) — ສົ່ງຕໍ່ໃຫ້ຜູ້ໃຊ້ເກົ່າ
export { outsideStandardCodes } from "@/lib/loaner-shared";

/**
 * ── ອາໄຫຼ່ "ຕາມມາດຕະຖານ" ຂອງງານຕິດຕັ້ງ ──
 *
 * ແຫຼ່ງດຽວ = **ic_inventory_set_detail ຂອງ ERP** (ຊຸດຂອງສິນຄ້າທີ່ຈະຕິດຕັ້ງ).
 *
 * ⚠️ ເຄີຍລອງເອົານິຍາມທີ່ຕັ້ງເອງຢູ່ ODS ມາໃຊ້ແທນ (31-07-2026) — **ຖອດອອກແລ້ວ**:
 * ໜ້າໃບຂໍເບີກຕ້ອງອີງ **ຊຸດຂອງ ERP ເທົ່ານັ້ນ** ເພື່ອໃຫ້ຕົງກັບເອກະສານຝັ່ງ ERP.
 * ຢ່າເອົາແຫຼ່ງອື່ນມາປົນອີກ.
 *
 * ບໍ່ໃຊ້ ods.tb_used_spare ເປັນມາດຕະຖານ ເພາະມັນເປັນ **ກະຕ່າຂອງງານ** (ຊ່າງເພີ່ມ/ລຶບໄດ້).
 * ຈຳນວນ "ຂໍແລ້ວ" ຄິດຈາກ **ບັນຊີເອກະສານ** (122 ລົບ 59) — ນິຍາມດຽວກັບ saveSpareRequest.
 */

export type StandardSpare = {
  item_code: string;
  item_name: string;
  unit_code: string | null;
  standard_qty: number;
  requested_qty: number;
  remaining_qty: number;
};

/**
 * ⚠️ **ຫົວໜ່ວຍເອົາຈາກ `sd.unit_code` (ຂອງຊຸດ) ເທົ່ານັ້ນ** — ບໍ່ຕົກໄປໃຊ້
 * `ic_inventory.unit_standard`. ເຫດຜົນ: ຫົວໜ່ວຍມາດຕະຖານຂອງສິນຄ້າມັກເປັນ
 * ຫົວໜ່ວຍຊື້/ຊັ່ງ (ເຊັ່ນ 140507-0336 = **ກິໂລ** ເພາະຂາຍເປັນເປົາ 50KG) ແຕ່
 * ຕອນຕິດຕັ້ງເບີກເປັນ **ຕົວ/ອັນ** ຕາມທີ່ຊຸດກຳນົດ ⇒ ໃຊ້ຫົວໜ່ວຍສິນຄ້າ = ຈຳນວນຜິດຄວາມໝາຍ
 * ທັງໃນໃບຂໍເບີກ ແລະ ໃນ ERP.
 */
const SET_LINES = `
  select sd.ic_code as item_code,
      coalesce(nullif(i.name_1, ''), sd.ic_code) as item_name,
      nullif(sd.unit_code, '') as unit_code,
      sum(sd.qty)::float8 as standard_qty,
      min(sd.line_number) as line_number
    from ic_inventory_set_detail sd
    left join ic_inventory i on i.code = sd.ic_code
   where sd.ic_set_code = $1
   group by 1, 2, 3
   order by line_number`;

/** ຂໍໄປແລ້ວເທົ່າໃດ = ໃບຂໍ (122) ລົບໃບສົ່ງຄືນ (59) — ຄືກັບ OUTSTANDING ຂອງກະຕ່າ */
const REQUESTED = `
  select item_code, sum(case when trans_flag = 122 then qty else -qty end)::float8 as qty
    from ic_trans_detail
   where product_code = $1 and trans_flag in (122, 59)
   group by item_code`;

/**
 * **ຈຳນວນ ແລະ ຫົວໜ່ວຍ ຕາມມາດຕະຖານ** — ໃຊ້ຕອນເພີ່ມລາຍການເຂົ້າກະຕ່າ ເພື່ອບໍ່ຕ້ອງເຊື່ອຄ່າ
 * ທີ່ browser ສົ່ງມາ ແລະ ບໍ່ຕ້ອງໄປຢືມຫົວໜ່ວຍຂອງ ic_inventory (ເບິ່ງເຫດຜົນຢູ່ SET_LINES).

 */
export async function getStandardSetLines(
  productCode: string | null | undefined,
): Promise<Map<string, { qty: number; unit_code: string | null }>> {
  if (!productCode) return new Map();
  try {
    const rows = (
      await queryOdg<{ item_code: string; unit_code: string | null; standard_qty: number }>(
        SET_LINES,
        [productCode],
      )
    ).rows;
    return new Map(
      rows.map((row) => [row.item_code, { qty: row.standard_qty, unit_code: row.unit_code }]),
    );
  } catch (error) {
    console.error("getStandardSetLines failed", error);
    return new Map();
  }
}

/**
 * ລາຍການມາດຕະຖານພ້ອມຄວາມຄືບໜ້າຂອງງານ.
 * @param jobCode     ເລກທີງານ (INST-xxxx) — ໃຊ້ຫານິຍາມ ODS ແລະ ນັບຈຳນວນທີ່ຂໍໄປແລ້ວ
 * @param productCode ລະຫັດສິນຄ້າຂອງງານ (ods_tb_install.item_code) = ລະຫັດຊຸດໃນ ERP
 */
export async function getStandardSpares(
  jobCode: string,
  productCode: string | null | undefined,
): Promise<StandardSpare[]> {
  if (!productCode) return [];
  let setLines: (StandardSpare & { line_number: number })[];
  try {
    setLines = (
      await queryOdg<StandardSpare & { line_number: number }>(SET_LINES, [productCode])
    ).rows;
  } catch (error) {
    // ERP ບໍ່ພ້ອມ → ຢ່າໃຫ້ໜ້າລົ້ມ, ສະແດງບໍ່ມີມາດຕະຖານໄປກ່ອນ
    console.error("getStandardSpares failed", error);
    return [];
  }
  if (!setLines.length) return [];

  const requested = new Map(
    (await query<{ item_code: string; qty: number }>(REQUESTED, [jobCode])).rows.map(
      (row) => [row.item_code, row.qty],
    ),
  );
  return setLines.map((row) => {
    const already = requested.get(row.item_code) ?? 0;
    return {
      item_code: row.item_code,
      item_name: row.item_name,
      unit_code: row.unit_code,
      standard_qty: row.standard_qty,
      requested_qty: already,
      remaining_qty: Math.max(0, row.standard_qty - already),
    };
  });
}
