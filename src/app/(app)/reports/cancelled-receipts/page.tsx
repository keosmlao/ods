import { ReportShell, reportState, type SummaryItem } from "@/components/report-shell";
import {
  columns,
  fetchCancelledReceipts,
  one,
  safeDate,
  toTableColumns,
  todayIso,
  type Row,
  type SearchParams,
} from "@/lib/report-sql";

/* ods: /ccrcpd_daily_rp — pdrcreport.py */
export default async function CancelledReceiptsReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), todayIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let summary: Row[] = [];
  let error: string | null = null;
  try {
    ({ rows, summary } = await fetchCancelledReceipts(from, to));
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  // ສະຫຼຸບຕາມປະເພດບໍລິການ (ຈາກ SQL ເດີມ) — ຄ່າຄືເກົ່າ ພຽງແຕ່ຍ້າຍມາເປັນແຖບສະຫຼຸບ
  const tiles: SummaryItem[] = summary.map((row) => ({
    label: `${row.name_1} (${row.code})`,
    value: Number(row.qty ?? 0).toLocaleString(),
  }));

  return (
    <ReportShell
      title="ລາຍງານການຍົກເລີກບິນສ້ອມ"
      subtitle={`ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/cancelled-receipts"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={toTableColumns(columns.cancelled)}
      rows={rows}
      error={error}
      summary={tiles}
      exportHref={`/api/reports/export/cancelled-receipts?${new URLSearchParams({ from, to, ...(state.q && { q: state.q }) })}`}
      minWidth={1500}
      searchPlaceholder="ຄົ້ນຫາ ເລກບີນ, ລູກຄ້າ, ເຄື່ອງ, ຜູ້ຂໍຍົກເລີກ..."
    />
  );
}
