import { getSession } from "@/lib/auth";
import { columns, fetchPurchaseOrders, safeDate, searchRows } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /purchase_order_rp — orderspare.py (trans_flag = 2) */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const rows = await fetchPurchaseOrders(
    safeDate(search.get("from") ?? undefined),
    safeDate(search.get("to") ?? undefined),
  );
  const list = searchRows(rows, columns.purchaseOrders.map((column) => column.key), search.get("q") ?? "");
  return respondXlsx("Purchase Order", columns.purchaseOrders, list, "report_purchase_order.xlsx");
}
