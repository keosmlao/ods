import { query, queryOdg } from "@/lib/db";

/**
 * ── ອາໄຫຼ່ "ຕາມມາດຕະຖານ" ຂອງງານຕິດຕັ້ງ ──
 *
 * ແຫຼ່ງດຽວ = **ic_inventory_set_detail ຂອງ ERP** (ອົງປະກອບຊຸດຂອງສິນຄ້າທີ່ຈະຕິດຕັ້ງ,
 * ເຊັ່ນ 120101-2642 [SET] → [C] · [H] · ທໍ່ 3/8+5/8). ບໍ່ໃຊ້ ods.tb_used_spare ອີກ
 * ເພາະ tb_used_spare ເປັນ **ກະຕ່າຂອງງານ** (ຊ່າງເພີ່ມ/ລຶບໄດ້) ບໍ່ແມ່ນນິຍາມມາດຕະຖານ.
 *
 * ຈຳນວນ "ຂໍແລ້ວ" ຍັງຄິດຈາກ **ບັນຊີເອກະສານ** (122 ລົບ 59) ຄືເກົ່າ — ນິຍາມດຽວກັບ
 * saveSpareRequest ຈຶ່ງບໍ່ຂັດກັນເອງ.
 */

export type StandardSpare = {
  item_code: string;
  item_name: string;
  unit_code: string | null;
  standard_qty: number;
  requested_qty: number;
  remaining_qty: number;
};

const SET_LINES = `
  select sd.ic_code as item_code,
      coalesce(nullif(i.name_1, ''), sd.ic_code) as item_name,
      nullif(coalesce(nullif(sd.unit_code, ''), i.unit_standard, ''), '') as unit_code,
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

/** ຈຳນວນມາດຕະຖານຕໍ່ລາຍການ (ໃຊ້ຕອນເພີ່ມເຂົ້າກະຕ່າ — ບໍ່ເຊື່ອຈຳນວນທີ່ສົ່ງມາຈາກ browser) */
export async function getStandardQty(
  productCode: string | null | undefined,
): Promise<Map<string, number>> {
  if (!productCode) return new Map();
  try {
    const rows = (
      await queryOdg<{ item_code: string; standard_qty: number }>(SET_LINES, [productCode])
    ).rows;
    return new Map(rows.map((row) => [row.item_code, row.standard_qty]));
  } catch (error) {
    console.error("getStandardQty failed", error);
    return new Map();
  }
}

/**
 * ລາຍການມາດຕະຖານພ້ອມຄວາມຄືບໜ້າຂອງງານ.
 * @param jobCode     ເລກທີງານ (INST-xxxx) — ໃຊ້ນັບຈຳນວນທີ່ຂໍໄປແລ້ວ
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
