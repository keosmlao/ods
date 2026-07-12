import { guardApi } from "@/lib/api-guard";
import { columns, fetchPending } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";

export const runtime = "nodejs";

/* ods: /download/report/excel — home.py (pending_report_.xls) */
export async function GET() {
  // ສິດຕາມໜ້າ /reports/pending — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/pending");
  if (denied) return denied;
  const rows = await fetchPending("", "", true);
  return respondXlsx("Product Pending", columns.pending, rows, "pending_report.xlsx");
}
