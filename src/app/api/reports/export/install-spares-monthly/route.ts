import { guardApi } from "@/lib/api-guard";
import {
  fetchMonthlyInstallSpares,
  filterInstallSpareItems,
  ISO_MONTH,
} from "@/lib/install-spare-report";
import { respondXlsx, type XlsxColumn } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const COLUMNS: XlsxColumn[] = [
  { header: "ລະຫັດອາໄຫຼ່", key: "item_code", width: 18 },
  { header: "ລາຍການອາໄຫຼ່", key: "item_name", width: 50 },
  { header: "ໜ່ວຍ", key: "unit_code", width: 12 },
  { header: "ຈຳນວນໃບເບີກ", key: "documents", width: 16 },
  { header: "ຈຳນວນງານ", key: "jobs", width: 14 },
  { header: "ຈຳນວນເບີກ", key: "issued_qty", width: 16 },
  { header: "ຈຳນວນຮັບຄືນ", key: "returned_qty", width: 18 },
  { header: "ຈຳນວນໃຊ້ສຸດທິ", key: "net_qty", width: 18 },
];

export async function GET(request: NextRequest) {
  const denied = await guardApi("/reports/install-spares-monthly");
  if (denied) return denied;

  const search = request.nextUrl.searchParams;
  const current = new Date().toISOString().slice(0, 7);
  const month = ISO_MONTH.test(search.get("month") ?? "") ? (search.get("month") as string) : current;
  const report = await fetchMonthlyInstallSpares(month);
  const rows = filterInstallSpareItems(report.items, search.get("q") ?? "").map((row) => ({
    ...row,
    issued_qty: Number(row.issued_qty),
    returned_qty: Number(row.returned_qty),
    net_qty: Number(row.net_qty),
  }));

  return respondXlsx(
    `Install spares ${month}`,
    COLUMNS,
    rows,
    `install_spares_${month}.xlsx`,
  );
}
