import { guardApi } from "@/lib/api-guard";
import { columns, fetchJobDispatch } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /report_jdispatch/<type>/<job> — Services.py (Report Dispatch) */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/job-dispatch — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/job-dispatch");
  if (denied) return denied;
  const productCode = request.nextUrl.searchParams.get("product_code") ?? "";
  const rows = await fetchJobDispatch(productCode);
  return respondXlsx("Report Dispatch", columns.jobDispatch, rows, "report_dispatch.xlsx");
}
