import { guardApi } from "@/lib/api-guard";
import { checkingFlags, columns, fetchChecking, safeDate, safeFlag, searchRows } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /checking_report (+ /checking_reportprint 122, /checking_reportprint1 56) — check_report.py */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/checking — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/checking");
  if (denied) return denied;
  const search = request.nextUrl.searchParams;
  const flag = safeFlag(search.get("flag") ?? undefined);
  const rows = await fetchChecking(
    safeDate(search.get("from") ?? undefined),
    safeDate(search.get("to") ?? undefined),
    flag,
  );
  const list = searchRows(rows, columns.checking.map((column) => column.key), search.get("q") ?? "");
  // ຊື່ໄຟລ໌ແຍກຕາມປະເພດເອກະສານ (ໃບຂໍເບີກ 122 / ໃບເບີກ 56) ຈຶ່ງບໍ່ທັບກັນເມື່ອດາວໂຫຼດທັງສອງ
  return respondXlsx(checkingFlags[flag], columns.checking, list, `report_checking_${flag}.xlsx`);
}
