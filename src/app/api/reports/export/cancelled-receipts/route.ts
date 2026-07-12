import { guardApi } from "@/lib/api-guard";
import { columns, fetchCancelledReceipts, safeDate, searchRows } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /ccrcpd_daily_rp — pdrcreport.py (ods ບໍ່ມີປຸ່ມ Excel ຂອງລາຍງານນີ້) */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/cancelled-receipts — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/cancelled-receipts");
  if (denied) return denied;
  const search = request.nextUrl.searchParams;
  const { rows } = await fetchCancelledReceipts(
    safeDate(search.get("from") ?? undefined),
    safeDate(search.get("to") ?? undefined),
  );
  const list = searchRows(rows, columns.cancelled.map((column) => column.key), search.get("q") ?? "");
  return respondXlsx("Cancel Receipt", columns.cancelled, list, "report_cancel_receipt.xlsx");
}
