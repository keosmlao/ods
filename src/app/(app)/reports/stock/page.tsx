import { countBy, ReportShell, reportState, type ReportTab, type SummaryItem } from "@/components/report-shell";
import {
  columns,
  fetchSpareRequests,
  fetchStockAll,
  one,
  safeDate,
  safeFlag,
  spareFlags,
  toTableColumns,
  todayIso,
  type Row,
  type SearchParams,
} from "@/lib/report-sql";

const TABS = [
  { key: "stock", label: "ສິນຄ້າໃນສາງສ້ອມທັງໝົດ" },
  { key: "122", label: spareFlags["122"] },
  { key: "56", label: spareFlags["56"] },
] as const;

/* ods: /stockall + /stock_dp_rp (122) + /stock_dp1_rp (56) + /home_rq_print (122) + /home_rq1_print (56) — stock_print.py */
export default async function StockReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = one(params.tab);
  const tab = raw === "122" || raw === "56" ? raw : "stock";
  const from = safeDate(one(params.from), todayIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let summary: Row[] = [];
  let error: string | null = null;
  try {
    if (tab === "stock") {
      ({ rows, summary } = await fetchStockAll());
    } else {
      rows = await fetchSpareRequests(from, to, safeFlag(tab));
    }
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const active = TABS.find((item) => item.key === tab)!;
  const tabs: ReportTab[] = TABS.map((item) => ({
    key: item.key,
    label: item.label,
    href: `/reports/stock?${new URLSearchParams({ tab: item.key, from, to })}`,
    active: item.key === tab,
  }));

  // ແທັບ "ສາງ": ສະຫຼຸບຕາມສະຖານະຈາກ SQL (ນັບຊຸດແຖວດຽວກັນກັບຕາຕະລາງ — ເບິ່ງ FIX ⑤ ໃນ report-sql.ts)
  // ແທັບໃບຂໍເບີກ/ໃບເບີກ: ສະຫຼຸບຕາມການຮັບປະກັນ ຈາກແຖວທີ່ດຶງມາ
  const stockTiles: SummaryItem[] = summary.map((row) => ({
    label: String(row.name_1 ?? "-"),
    value: Number(row.qty ?? 0).toLocaleString(),
  }));

  return (
    <ReportShell
      title={active.label}
      subtitle={tab === "stock" ? "ເຄື່ອງທີ່ຍັງບໍ່ທັນສົ່ງລູກຄ້າ" : `ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/stock"
      query={tab === "stock" ? { tab } : { tab, from, to }}
      state={state}
      tabs={tabs}
      dateRange={tab === "stock" ? undefined : { from, to }}
      columns={toTableColumns(tab === "stock" ? columns.stock : columns.spareRequests)}
      rows={rows}
      error={error}
      summary={tab === "stock" ? stockTiles : countBy(rows, "warrunty")}
      /* Excel: ສົ່ງຕົວກອງຊຸດດຽວກັນກັບຕາຕະລາງ (ແທັບ ສາງ ບໍ່ໃຊ້ຊ່ວງວັນທີ) */
      exportHref={`/api/reports/export/stock?${new URLSearchParams({
        ...(tab === "stock" ? { tab } : { tab, from, to }),
        ...(state.q && { q: state.q }),
      })}`}
      minWidth={tab === "stock" ? 1200 : 1700}
      searchPlaceholder={
        tab === "stock" ? "ຄົ້ນຫາ ລະຫັດ, ລາຍການ, SN, ລູກຄ້າ, ສະຖານະ..." : "ຄົ້ນຫາ ເລກບີນ, ໃບຮັບເຄື່ອງ, ລູກຄ້າ, ຜູ້ສ້າງ..."
      }
    />
  );
}
