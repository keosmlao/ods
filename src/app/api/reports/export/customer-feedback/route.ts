import { getSession } from "@/lib/auth";
import { columns, fetchCustomerFeedback, safeDate } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /report_cust_feedback_excel/<fd>/<td> — install_admin.py */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const all = search.get("all") === "1" || search.get("from") === "no" || search.get("to") === "no";
  const from = all ? null : safeDate(search.get("from") ?? undefined);
  const to = all ? null : safeDate(search.get("to") ?? undefined);
  const rows = await fetchCustomerFeedback(from, to);
  return respondXlsx("Customer Feedback", columns.feedback, rows, "report_cust_feedback.xlsx");
}
