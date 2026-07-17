import { queryOdg } from "@/lib/db";

/**
 * ຍອດຄົງເຫຼືອຂອງອາໄຫຼ່ ແຍກຕາມສາງ.
 *
 * ── ເປັນຫຍັງບໍ່ໃຊ້ odg_stock_balance_location() ຂອງ ODS ──
 * ຟັງຊັນນັ້ນຢູ່ຖານ ODS ແຕ່ພາຍໃນມັນ **ຍິງ dblink ຂ້າມໄປຖານ ERP ໃໝ່ທຸກຄັ້ງທີ່ເອີ້ນ**
 * (ວັດຈິງ: 63ms ຕໍ່ 1 ລາຍການ). ໜ້າ "ເບີກອາໄຫຼ່" ເອີ້ນມັນແຖວລະຄັ້ງ ⇒ 20 ແຖວ = 1.2 ວິນາທີ
 * ພຽງແຕ່ຄິດຍອດ. ບ່ອນນີ້ຖາມ ERP ໂດຍກົງ **ຄັ້ງດຽວສຳລັບທຸກລາຍການໃນໜ້ານັ້ນ**
 * (20 ລາຍການ = ~400ms) ແລ້ວຈັບຄູ່ຢູ່ຝັ່ງ Node.
 */

export type Balance = {
  /** ຍອດລວມທຸກສາງ */
  total: number;
  /** ຍອດໃນສາງທີ່ຖາມ (ຕໍ່ລະຫັດສາງ) */
  byWarehouse: Map<string, number>;
  /** ຍອດຕາມສາງ + ບ່ອນເກັບ (`warehouse:location`) */
  byLocation: Map<string, number>;
};

export async function getBalances(itemCodes: string[]): Promise<Map<string, Balance>> {
  const codes = [...new Set(itemCodes.filter(Boolean))];
  const result = new Map<string, Balance>();
  if (!codes.length) return result;

  try {
    const rows = (
      await queryOdg<{ code: string; warehouse: string | null; location: string | null; balance_qty: string | null }>(
        `select i.code, b.warehouse, b.location, b.balance_qty
           from unnest($1::text[]) i(code)
           left join lateral sml_ic_function_stock_balance_warehouse_location('2099-12-31', i.code, '', '') b on true`,
        [codes],
      )
    ).rows;

    for (const row of rows) {
      const entry = result.get(row.code) ?? { total: 0, byWarehouse: new Map(), byLocation: new Map() };
      const qty = Number(row.balance_qty ?? 0);
      if (qty && row.warehouse) {
        entry.total += qty;
        entry.byWarehouse.set(row.warehouse, (entry.byWarehouse.get(row.warehouse) ?? 0) + qty);
        if (row.location) {
          const key = `${row.warehouse}:${row.location}`;
          entry.byLocation.set(key, (entry.byLocation.get(key) ?? 0) + qty);
        }
      }
      result.set(row.code, entry);
    }
  } catch (error) {
    // ຖານ ERP ບໍ່ພ້ອມ → ຢ່າໃຫ້ໜ້າລົ້ມ, ສະແດງຍອດເປັນ 0 ໄປກ່ອນ
    console.error("getBalances failed", error);
  }

  for (const code of codes) {
    if (!result.has(code)) result.set(code, { total: 0, byWarehouse: new Map(), byLocation: new Map() });
  }
  return result;
}

/** ຍອດເປັນຂໍ້ຄວາມ 2 ຕຳແໜ່ງ — ໃຫ້ຕົງກັບຮູບແບບເກົ່າຂອງໜ້າເບີກອາໄຫຼ່ */
export function fmtQty(value: number) {
  return (Math.round(value * 100) / 100).toString();
}

/**
 * ຍອດທີ່ **ຂໍເບີກໄດ້** — ນະໂຍບາຍ (16-07-2026): **ທຸກສາງທີ່ມີ stock ເບີກໄດ້ໝົດ**
 * (ບໍ່ຈຳກັດ 4 ສາງຄົງທີ່ອີກ — ຜູ້ຈັດການສັ່ງ) ⇒ ຍອດເບີກໄດ້ = total ທຸກສາງ.
 *
 * ໜ້າທີ່ຂອງ helper ນີ້ຄືເປັນ **ຈຸດວັດດຽວ** ຂອງກົດ "ຕ້ອງຊື້ບໍ": ຂໍເບີກ · ຂໍຊື້ ·
 * ຄິວຂໍຊື້ · ຟອມ RQ ທັງໝົດເອີ້ນອັນນີ້ ⇒ ຄຳຕອບບໍ່ມີວັນຂັດກັນເອງອີກ
 * ("ຕອນຂໍເບີກບອກວ່າບໍ່ມີ ຕອນຂໍຊື້ບອກວ່າມີ" ມາຈາກສາມຈຸດວັດຄົນລະຂອບເຂດ).
 */
export function withdrawableQty(balance: Balance | undefined): number {
  return Math.max(0, balance?.total ?? 0);
}

/** ບອກວ່າຂອງຢູ່ສາງໃດແດ່ — ໃຊ້ໃນຂໍ້ຄວາມແຈ້ງເຕືອນ ໃຫ້ຄົນໄປເບີກຈາກສາງນັ້ນຖືກ */
export function withdrawableWhere(balance: Balance | undefined): string {
  if (!balance) return "";
  return [...balance.byWarehouse.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([wh, qty]) => `ສາງ ${wh}×${fmtQty(qty)}`)
    .join(", ");
}
