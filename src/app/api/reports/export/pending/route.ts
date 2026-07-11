import { getSession } from "@/lib/auth";
import { columns, fetchPending, safeDate } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /report_pd/<fd>/<td> — home.py (pending_report_bydate.xls) */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const all = search.get("all") === "1" || search.get("from") === "no" || search.get("to") === "no";
  const from = safeDate(search.get("from") ?? undefined);
  const to = safeDate(search.get("to") ?? undefined);
  const rows = await fetchPending(from, to, all);
  return respondXlsx("Product Pending", columns.pending, rows, "pending_report_bydate.xlsx");
}
