import { query } from "@/lib/db";

/**
 * ── ຂໍ້ມູນສຳລັບ "ແກ້ໃບຂໍເບີກຕິດຕັ້ງ (SION 122)" ──
 *
 * ນິຍາມ **ຈຳນວນສູງສຸດທີ່ໃບນຶ່ງຖືໄດ້** ຢູ່ບ່ອນດຽວ ໃຫ້ໜ້າຈໍ (ຄ່າຕັ້ງຕົ້ນ/ຕົວກັນພິມເກີນ)
 * ກັບ action (ຕົວຕັດຈິງຢູ່ຝັ່ງ server) ໃຊ້ສູດອັນດຽວກັນ ຈຶ່ງບໍ່ມີວັນຂັດກັນ:
 *
 *   max = ກະຕ່າ (tb_used_spare) − ທີ່ຂໍໄວ້ໃນ **ໃບອື່ນ** (122 ລົບ 59, ບໍ່ນັບໃບນີ້)
 *
 * ⇒ ຖອດລາຍການອອກຈາກໃບ = ໃສ່ 0 · ເພີ່ມລາຍການທີ່ຍັງຄ້າງ = ໃສ່ຈຳນວນ > 0.
 */
export const EDITABLE_SPARE_LINES = `
  select s.item_code, max(s.item_name) as item_name, max(s.unit_code) as unit_code,
      sum(s.qty)::float8 as cart_qty,
      coalesce(max(o.qty), 0)::float8 as other_qty,
      coalesce(max(t.qty), 0)::float8 as doc_qty
    from tb_used_spare s
    left join (
      select item_code, sum(case when trans_flag = 122 then qty else -qty end) as qty
        from ic_trans_detail
       where product_code = $1 and trans_flag in (122, 59) and doc_no <> $2
       group by item_code
    ) o on o.item_code = s.item_code
    left join (
      select item_code, sum(qty) as qty
        from ic_trans_detail
       where doc_no = $2 and trans_flag = 122
       group by item_code
    ) t on t.item_code = s.item_code
   where s.product_code = $1
   group by s.item_code
   order by min(s.roworder)`;

export type EditableSpareRow = {
  item_code: string;
  item_name: string;
  unit_code: string | null;
  /** ຈຳນວນສູງສຸດທີ່ໃບນີ້ຖືໄດ້ */
  max_qty: number;
  /** ຈຳນວນທີ່ໃບນີ້ຖືຢູ່ດຽວນີ້ (0 = ຍັງບໍ່ຢູ່ໃນໃບ) */
  qty: number;
};

export async function getEditableSpareLines(
  productCode: string,
  docNo: string,
): Promise<EditableSpareRow[]> {
  const rows = (
    await query<{
      item_code: string;
      item_name: string;
      unit_code: string | null;
      cart_qty: number;
      other_qty: number;
      doc_qty: number;
    }>(EDITABLE_SPARE_LINES, [productCode, docNo])
  ).rows;
  return rows
    .map((row) => ({
      item_code: row.item_code,
      item_name: row.item_name,
      unit_code: row.unit_code,
      max_qty: Math.max(0, row.cart_qty - row.other_qty),
      qty: row.doc_qty,
    }))
    // ບໍ່ຢູ່ໃນໃບ ແລະ ຖືເພີ່ມກໍ່ບໍ່ໄດ້ ⇒ ບໍ່ຕ້ອງສະແດງໃຫ້ລົກຕາ
    .filter((row) => row.qty > 0 || row.max_qty > 0);
}
