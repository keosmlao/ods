import { getSession } from "@/lib/auth";
import { columns, fetchReturned } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /download/report/excel_pending — home.py (return_complete.xls) */
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await fetchReturned();
  return respondXlsx("Return Complete", columns.returned, rows, "return_complete.xlsx");
}
