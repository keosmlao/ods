import { guardApi } from "@/lib/api-guard";
import { columns, fetchPurchaseRequests, safeDate, safeReportType } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /report_request_order_excel/<fd>/<td>/<type> — home.py (spr_report_purchase.xls) */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/purchase-requests — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/purchase-requests");
  if (denied) return denied;
  const search = request.nextUrl.searchParams;
  const all = search.get("all") === "1" || search.get("from") === "no" || search.get("to") === "no";
  const type = safeReportType(search.get("type") ?? undefined);
  const from = all ? null : safeDate(search.get("from") ?? undefined);
  const to = all ? null : safeDate(search.get("to") ?? undefined);
  const rows = await fetchPurchaseRequests(from, to, type);
  return respondXlsx("SPR Purchase Order", columns.purchaseRequests, rows, "spr_report_purchase.xlsx");
}
