import { guardApi } from "@/lib/api-guard";
import { columns, fetchReceiptTurnaround, safeDate } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /report_rcprodate/<fd>/<td> — home.py (report_receipt_service.xls) */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/receipts — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/receipts");
  if (denied) return denied;
  const search = request.nextUrl.searchParams;
  const rows = await fetchReceiptTurnaround(safeDate(search.get("from") ?? undefined), safeDate(search.get("to") ?? undefined));
  return respondXlsx("Receipt Product", columns.receipts, rows, "report_receipt_service.xlsx");
}
