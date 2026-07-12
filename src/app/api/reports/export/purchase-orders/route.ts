import { guardApi } from "@/lib/api-guard";
import { columns, fetchPurchaseOrders, safeDate, searchRows } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /purchase_order_rp — orderspare.py (trans_flag = 2) */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/purchase-orders — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/purchase-orders");
  if (denied) return denied;
  const search = request.nextUrl.searchParams;
  const rows = await fetchPurchaseOrders(
    safeDate(search.get("from") ?? undefined),
    safeDate(search.get("to") ?? undefined),
  );
  const list = searchRows(rows, columns.purchaseOrders.map((column) => column.key), search.get("q") ?? "");
  return respondXlsx("Purchase Order", columns.purchaseOrders, list, "report_purchase_order.xlsx");
}
