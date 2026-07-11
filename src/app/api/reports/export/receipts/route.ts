import { getSession } from "@/lib/auth";
import { columns, fetchReceiptTurnaround, safeDate } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /report_rcprodate/<fd>/<td> — home.py (report_receipt_service.xls) */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const rows = await fetchReceiptTurnaround(safeDate(search.get("from") ?? undefined), safeDate(search.get("to") ?? undefined));
  return respondXlsx("Receipt Product", columns.receipts, rows, "report_receipt_service.xlsx");
}
