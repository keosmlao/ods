import { getSession } from "@/lib/auth";
import { columns, fetchDailyReceipts, safeDate, searchRows } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ods: /pdrc_daily_rp + /printpdrcd/<from>/<to> — pdrcreport.py (ods ບໍ່ມີປຸ່ມ Excel ຂອງລາຍງານນີ້) */
export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const { rows } = await fetchDailyReceipts(
    safeDate(search.get("from") ?? undefined),
    safeDate(search.get("to") ?? undefined),
  );
  // ຄົ້ນຫາຄືກັນກັບໜ້າຈໍ — ຖ້າບໍ່ໄດ້ຄົ້ນຫາ ຈະໄດ້ແຖວຄົບຕາມຊ່ວງວັນທີ
  const list = searchRows(rows, columns.dailyReceipts.map((column) => column.key), search.get("q") ?? "");
  return respondXlsx("Daily Receipt", columns.dailyReceipts, list, "report_receipt_daily.xlsx");
}
