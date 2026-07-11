import { getSession } from "@/lib/auth";
import { columns, fetchPurchaseRequests, safeDate, safeReportType } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /report_request_order_excel/<fd>/<td>/<type> — home.py (spr_report_purchase.xls) */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const all = search.get("all") === "1" || search.get("from") === "no" || search.get("to") === "no";
  const type = safeReportType(search.get("type") ?? undefined);
  const from = all ? null : safeDate(search.get("from") ?? undefined);
  const to = all ? null : safeDate(search.get("to") ?? undefined);
  const rows = await fetchPurchaseRequests(from, to, type);
  return respondXlsx("SPR Purchase Order", columns.purchaseRequests, rows, "spr_report_purchase.xlsx");
}
