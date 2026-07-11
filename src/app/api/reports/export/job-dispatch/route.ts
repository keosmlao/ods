import { getSession } from "@/lib/auth";
import { columns, fetchJobDispatch } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /report_jdispatch/<type>/<job> — Services.py (Report Dispatch) */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const productCode = request.nextUrl.searchParams.get("product_code") ?? "";
  const rows = await fetchJobDispatch(productCode);
  return respondXlsx("Report Dispatch", columns.jobDispatch, rows, "report_dispatch.xlsx");
}
