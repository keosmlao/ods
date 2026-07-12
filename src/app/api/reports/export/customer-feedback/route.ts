import { guardApi } from "@/lib/api-guard";
import { columns, fetchCustomerFeedback, safeDate } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /report_cust_feedback_excel/<fd>/<td> — install_admin.py */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/customer-feedback — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/customer-feedback");
  if (denied) return denied;
  const search = request.nextUrl.searchParams;
  const all = search.get("all") === "1" || search.get("from") === "no" || search.get("to") === "no";
  const from = all ? null : safeDate(search.get("from") ?? undefined);
  const to = all ? null : safeDate(search.get("to") ?? undefined);
  const rows = await fetchCustomerFeedback(from, to);
  return respondXlsx("Customer Feedback", columns.feedback, rows, "report_cust_feedback.xlsx");
}
