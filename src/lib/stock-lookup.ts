import { warehouses } from "@/lib/erp-lookup";
import { getBalances } from "@/lib/stock-balance";
import { searchSpares } from "@/lib/tech-flow";

/**
 * **ຕິດຕາມສິນຄ້າຄົງເຫຼືອ** — ຄົ້ນອາໄຫຼ່ ແລ້ວສະແດງຍອດຄົງເຫຼືອ **ແຍກຕາມສາງ** (ຈາກ ERP).
 * ຊ່າງໃຊ້ກ່ອນຂໍເບີກ ເພື່ອຮູ້ວ່າຂອງມີບໍ ແລະ ຢູ່ສາງໃດ. ປະສົມ searchSpares (ລາຍການ) +
 * getBalances (ຍອດຕໍ່ສາງ) + warehouses (ຊື່ສາງ) ບ່ອນດຽວ.
 */
export type StockBalanceItem = {
  code: string;
  name: string;
  brand: string | null;
  unit_code: string | null;
  total: number;
  warehouses: { code: string; name: string; qty: number }[];
};

/**
 * @param onlyWarehouses ຖ້າກຳນົດ — ສະແດງ/ນັບສະເພາະສາງເຫຼົ່ານັ້ນ (ເຊັ່ນ ສາງສູນບໍລິການ 1104/1206)
 *   ⇒ `total` ກາຍເປັນຍອດລວມ**ໃນສາງທີ່ກອງ** (ບໍ່ແມ່ນຍອດທຸກສາງ).
 */
export async function stockBalanceLookup(
  query: string,
  onlyWarehouses?: readonly string[],
): Promise<StockBalanceItem[]> {
  const items = (await searchSpares(query, false)).slice(0, 25);
  if (items.length === 0) return [];

  const [balances, whs] = await Promise.all([getBalances(items.map((item) => item.code)), warehouses()]);
  const whName = new Map(whs.map((wh) => [wh.code, wh.name]));
  const scope = onlyWarehouses ? new Set(onlyWarehouses) : null;

  return items.map((item) => {
    const balance = balances.get(item.code);
    const perWh = balance
      ? [...balance.byWarehouse.entries()]
          .filter(([code, qty]) => qty > 0 && (!scope || scope.has(code)))
          .sort((a, b) => b[1] - a[1])
          .map(([code, qty]) => ({ code, name: whName.get(code) ?? code, qty }))
      : [];
    const total = scope
      ? perWh.reduce((sum, wh) => sum + wh.qty, 0)
      : balance?.total ?? item.balance_qty ?? 0;
    return {
      code: item.code,
      name: item.name_1,
      brand: item.brand,
      unit_code: item.unit_code,
      total,
      warehouses: perWh,
    };
  });
}
