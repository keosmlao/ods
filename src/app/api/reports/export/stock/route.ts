import { guardApi } from "@/lib/api-guard";
import {
  columns,
  fetchSpareRequests,
  fetchStockAll,
  safeDate,
  safeFlag,
  searchRows,
  spareFlags,
  type Row,
} from "@/lib/report-sql";
import { respondXlsx, type XlsxColumn } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /stockall (ສາງ) + /stock_dp_rp (122) + /stock_dp1_rp (56) — stock_print.py
 * ແທັບຄືກັນກັບໜ້າ /reports/stock: stock = ສິນຄ້າໃນສາງທັງໝົດ (ບໍ່ໃຊ້ຊ່ວງວັນທີ), 122/56 = ໃບຂໍເບີກ/ໃບເບີກ.
 */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/stock — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/stock");
  if (denied) return denied;
  const search = request.nextUrl.searchParams;
  const raw = search.get("tab");
  const tab = raw === "122" || raw === "56" ? raw : "stock";

  let rows: Row[];
  let list: XlsxColumn[] = columns.stock;
  let sheet = "Stock All";
  let filename = "report_stock_all.xlsx";

  if (tab === "stock") {
    ({ rows } = await fetchStockAll());
  } else {
    rows = await fetchSpareRequests(
      safeDate(search.get("from") ?? undefined),
      safeDate(search.get("to") ?? undefined),
      safeFlag(tab),
    );
    list = columns.spareRequests;
    sheet = spareFlags[tab];
    filename = `report_spare_${tab}.xlsx`;
  }

  const found = searchRows(rows, list.map((column) => column.key), search.get("q") ?? "");
  return respondXlsx(sheet, list, found, filename);
}
