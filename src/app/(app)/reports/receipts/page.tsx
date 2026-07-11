import { countBy, defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import {
  columns,
  fetchReceiptTurnaround,
  one,
  safeDate,
  toTableColumns,
  todayIso,
  type Row,
  type SearchParams,
} from "@/lib/report-sql";

/* ods: /report_rcpro (+ excel /report_rcprodate) — home.py */
export default async function ReceiptsReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let error: string | null = null;
  try {
    rows = await fetchReceiptTurnaround(from, to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  return (
    <ReportShell
      title="ລາຍງານການຮັບເຄື່ອງ / ໄລຍະເວລາສ້ອມ"
      subtitle={`ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/receipts"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={toTableColumns(columns.receipts)}
      rows={rows}
      error={error}
      /* ສະຫຼຸບຕາມສະຖານະ — ນັບຈາກແຖວຊຸດດຽວກັນກັບຕາຕະລາງ ຈຶ່ງລວມກັນໄດ້ເທົ່າ "ລວມທັງໝົດ" ພໍດີ */
      summary={countBy(rows, "status_name")}
      exportHref={`/api/reports/export/receipts?from=${from}&to=${to}`}
      minWidth={2900}
      searchPlaceholder="ຄົ້ນຫາ ລະຫັດ, ລູກຄ້າ, ເຄື່ອງ, SN, ຊ່າງ..."
    />
  );
}
