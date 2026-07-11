import { getSession } from "@/lib/auth";
import { columns, fetchCancelledReceipts, safeDate, searchRows } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /ccrcpd_daily_rp — pdrcreport.py (ods ບໍ່ມີປຸ່ມ Excel ຂອງລາຍງານນີ້) */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const { rows } = await fetchCancelledReceipts(
    safeDate(search.get("from") ?? undefined),
    safeDate(search.get("to") ?? undefined),
  );
  const list = searchRows(rows, columns.cancelled.map((column) => column.key), search.get("q") ?? "");
  return respondXlsx("Cancel Receipt", columns.cancelled, list, "report_cancel_receipt.xlsx");
}
