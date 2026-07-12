import { guardApi } from "@/lib/api-guard";
import { columns, fetchReturned } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";

export const runtime = "nodejs";

/* ods: /download/report/excel_pending — home.py (return_complete.xls) */
export async function GET() {
  // ສິດຕາມໜ້າ /reports/receipts — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/receipts");
  if (denied) return denied;
  const rows = await fetchReturned();
  return respondXlsx("Return Complete", columns.returned, rows, "return_complete.xlsx");
}
