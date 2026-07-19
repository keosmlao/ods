import { guardApi } from "@/lib/api-guard";
import { query } from "@/lib/db";
import { respondXlsx, type XlsxRow } from "@/lib/xlsx";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Excel ຂອງ "ຄົງເຫຼືອ ສາງສ້ອມ" — ອ່ານ cache (ods_repair_stock_cache), pivot 1104/1206
 * ເປັນຖັນ. ໃຊ້ຕົວກອງອັນດຽວກັບໜ້າຈໍ (?q=). ຍອດເປັນ snapshot ຄັ້ງດຶງລ່າສຸດ.
 */
export async function GET(request: NextRequest) {
  const denied = await guardApi("/stock/balance");
  if (denied) return denied;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const args: string[] = [];
  let where = "";
  if (q) {
    args.push(`%${q}%`);
    where = "where item_code ilike $1 or item_name ilike $1";
  }

  const rows = await query<XlsxRow>(
    `select max(item_name) as "ອາໄຫຼ່", item_code as "ລະຫັດ", max(unit_code) as "ໜ່ວຍ",
        coalesce(sum(qty) filter (where wh_code='1104'), 0)::float as "ຂົວຫຼວງ (1104)",
        coalesce(sum(qty) filter (where wh_code='1206'), 0)::float as "ດອນຕີ້ວ (1206)",
        coalesce(sum(qty), 0)::float as "ລວມ"
      from ods_repair_stock_cache
     ${where}
     group by item_code
     order by max(item_name) nulls last, item_code`,
    args,
  );

  const columns = [
    { header: "ອາໄຫຼ່", key: "ອາໄຫຼ່", width: 40 },
    { header: "ລະຫັດ", key: "ລະຫັດ", width: 16 },
    { header: "ໜ່ວຍ", key: "ໜ່ວຍ", width: 10 },
    { header: "ຂົວຫຼວງ (1104)", key: "ຂົວຫຼວງ (1104)", width: 14 },
    { header: "ດອນຕີ້ວ (1206)", key: "ດອນຕີ້ວ (1206)", width: 14 },
    { header: "ລວມ", key: "ລວມ", width: 12 },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return respondXlsx("ຄົງເຫຼືອສາງສ້ອມ", columns, rows.rows, `repair-stock-${stamp}.xlsx`);
}
