import { db, query, queryOdg } from "@/lib/db";
import { REPAIR_WAREHOUSES } from "@/lib/stock-constants";

/**
 * **Cache ຄົງເຫຼືອ ສາງສ້ອມ (1104/1206)** — ERP ຄິດຍອດຕໍ່ສາງຊ້າ (~25ວິ ສຳລັບ ~1338 ລາຍການ)
 * ⇒ ເກັບ snapshot ໄວ້ໃນ ODS ໃຫ້ browse ໄວ. ຜູ້ໃຊ້ກົດ "ດຶງໃໝ່" ເພື່ອ refresh.
 */
export const REPAIR_WH_LABEL: Record<string, string> = { "1104": "ຂົວຫຼວງ", "1206": "ດອນຕີ້ວ" };

/** ດຶງຍອດຈາກ ERP (ຊ້າ ~25ວິ) → ຂຽນທັບ cache ໃນ ODS. ຄືນຈຳນວນແຖວ + ເວລາ. */
export async function refreshRepairStock(): Promise<{ count: number }> {
  if (!db) throw new Error("ບໍ່ພົບ DATABASE_URL");

  // ຄິດຍອດສະເພາະລາຍການທີ່ເຄີຍເຄື່ອນໄຫວຜ່ານ 2 ສາງນັ້ນ (ຫຼຸດການ scan ທັງ catalog)
  const rows = (
    await queryOdg<{ item_code: string; item_name: string | null; unit_code: string | null; wh_code: string; location: string; qty: number }>(
      `with cand as (
         select distinct item_code from ic_trans_detail
          where wh_code = any($1::text[]) or wh_code_2 = any($1::text[])
       )
       select cand.item_code, max(i.name_1) as item_name, max(i.unit_standard) as unit_code,
              b.warehouse as wh_code, coalesce(b.location,'') as "location", round(sum(b.balance_qty), 2)::float8 as qty
         from cand
         join ic_inventory i on i.code = cand.item_code
         left join lateral sml_ic_function_stock_balance_warehouse_location('2099-12-31', cand.item_code, '', '') b on true
        where b.warehouse = any($1::text[]) and coalesce(b.balance_qty, 0) > 0
        group by cand.item_code, b.warehouse, b.location`,
      [[...REPAIR_WAREHOUSES]],
    )
  ).rows;

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("delete from ods_repair_stock_cache");
    if (rows.length) {
      await client.query(
        `insert into ods_repair_stock_cache(wh_code, item_code, item_name, unit_code, qty, location)
         select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[], $6::text[])`,
        [
          rows.map((r) => r.wh_code),
          rows.map((r) => r.item_code),
          rows.map((r) => r.item_name ?? ""),
          rows.map((r) => r.unit_code ?? ""),
          rows.map((r) => r.qty),
          rows.map((r) => r.location ?? ""),
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return { count: rows.length };
}

export type RepairStockItem = {
  code: string;
  name: string;
  unit_code: string | null;
  total: number;
  warehouses: { code: string; name: string; qty: number }[];
  /** ແຍກຕາມ **ທີ່ຈັດເກັບ** (shelf/location) ພາຍໃນສາງ */
  locations: { wh_code: string; wh_name: string; location: string; qty: number }[];
};

/** ອ່ານ cache (ໄວ) — ກອງດ້ວຍ q (ຊື່/ລະຫັດ). ຄືນລາຍການ + ເວລາທີ່ດຶງລ່າສຸດ. */
export async function repairStockCache(q = ""): Promise<{ items: RepairStockItem[]; refreshedAt: string | null }> {
  const args: string[] = [];
  let where = "";
  if (q.trim()) {
    args.push(`%${q.trim()}%`);
    where = `where item_code ilike $1 or item_name ilike $1`;
  }
  const rows = (
    await query<{ item_code: string; item_name: string | null; unit_code: string | null; wh_code: string; location: string | null; qty: string }>(
      `select item_code, item_name, unit_code, wh_code, coalesce(location,'') as "location", qty from ods_repair_stock_cache
       ${where} order by item_name nulls last, item_code, wh_code, location`,
      args,
    )
  ).rows;

  const meta = (
    await query<{ reftime: string | null }>(
      `select to_char(max(refreshed_at),'DD-MM-YYYY HH24:MI') as reftime from ods_repair_stock_cache`,
    )
  ).rows[0];

  const byItem = new Map<string, RepairStockItem>();
  for (const row of rows) {
    const item = byItem.get(row.item_code) ?? {
      code: row.item_code,
      name: row.item_name ?? row.item_code,
      unit_code: row.unit_code,
      total: 0,
      warehouses: [],
      locations: [],
    };
    const qty = Number(row.qty);
    const whName = REPAIR_WH_LABEL[row.wh_code] ?? row.wh_code;
    item.total += qty;
    // ແຍກຕາມທີ່ຈັດເກັບ (1 ແຖວ cache = 1 wh+location)
    item.locations.push({ wh_code: row.wh_code, wh_name: whName, location: row.location ?? "", qty });
    // ລວມຕໍ່ສາງ (ໃຫ້ tab/ຖັນສາງ)
    const wh = item.warehouses.find((w) => w.code === row.wh_code);
    if (wh) wh.qty += qty;
    else item.warehouses.push({ code: row.wh_code, name: whName, qty });
    byItem.set(row.item_code, item);
  }
  const items = [...byItem.values()];
  for (const item of items) item.warehouses.sort((a, b) => a.code.localeCompare(b.code));
  return { items, refreshedAt: meta?.reftime ?? null };
}
