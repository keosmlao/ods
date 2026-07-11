import { getSession } from "@/lib/auth";
import { columns, fetchInstallations, safeDate } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /report_pd_install/<from_date>/<to_date> — install_admin.py */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const all = search.get("all") === "1";
  const rows = await fetchInstallations(
    safeDate(search.get("from") ?? undefined),
    safeDate(search.get("to") ?? undefined),
    all,
  );
  return respondXlsx("Report Install", columns.installations, rows, "report_install.xlsx");
}
