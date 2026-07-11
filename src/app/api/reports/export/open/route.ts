import { getSession } from "@/lib/auth";
import { columns, fetchPending } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /download/report/excel — home.py (pending_report_.xls) */
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await fetchPending("", "", true);
  return respondXlsx("Product Pending", columns.pending, rows, "pending_report.xlsx");
}
