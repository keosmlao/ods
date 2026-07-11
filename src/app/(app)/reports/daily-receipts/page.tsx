import { defaultFromIso, ReportShell, reportState, type SummaryItem } from "@/components/report-shell";
import { columns, fetchDailyReceipts, one, safeDate, toTableColumns, todayIso, type Row, type SearchParams } from "@/lib/report-sql";

/* ods: /pdrc_daily_rp + /printpdrcd/<from>/<to> — pdrcreport.py */
export default async function DailyReceiptsReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let summary: Row[] = [];
  let error: string | null = null;
  try {
    ({ rows, summary } = await fetchDailyReceipts(from, to));
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  // ສະຫຼຸບຕາມປະເພດບໍລິການ (ຈາກ SQL ເດີມ) — ຍ້າຍຈາກຕາຕະລາງ "ສະຫຼຸບ" ມາເປັນແຖບສະຫຼຸບ ຄ່າຄືເກົ່າທຸກປະການ
  const tiles: SummaryItem[] = summary.map((row) => ({
    label: `${row.name_1} (${row.code})`,
    value: Number(row.qty ?? 0).toLocaleString(),
  }));

  return (
    <ReportShell
      title="ລາຍງານການຮັບເຄື່ອງສ້ອມປະຈຳວັນ"
      subtitle={`ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/daily-receipts"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={toTableColumns(columns.dailyReceipts)}
      rows={rows}
      error={error}
      summary={tiles}
      exportHref={`/api/reports/export/daily-receipts?${new URLSearchParams({ from, to, ...(state.q && { q: state.q }) })}`}
      printHref={`/reports/daily-receipts/print?from=${from}&to=${to}`}
      minWidth={1400}
      searchPlaceholder="ຄົ້ນຫາ ລູກຄ້າ, ເຄື່ອງ, ຫຍີ່ຫໍ້, ອາການ..."
    />
  );
}
