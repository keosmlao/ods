import { LinkPending } from "@/components/link-pending";
import { countBy, defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { columns, fetchPending, one, safeDate, toTableColumns, todayIso, type Row, type SearchParams } from "@/lib/report-sql";
import Link from "next/link";

/* ods: /report_pending (POST) + /report_allpd — home.py */
export default async function PendingReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const all = one(params.all) === "1";
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let error: string | null = null;
  try {
    rows = await fetchPending(from, to, all);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  return (
    <ReportShell
      title="ລາຍງານເຄື່ອງສ້ອມຄ້າງ"
      subtitle={all ? "ທັງໝົດ" : `ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/pending"
      query={all ? { all: "1" } : { from, to }}
      omitFromForm={["all"]}
      state={state}
      dateRange={{ from, to }}
      columns={toTableColumns(columns.pending)}
      rows={rows}
      error={error}
      /* ສະຫຼຸບຕາມສະຖານະ — ນັບຈາກແຖວຊຸດດຽວກັນກັບຕາຕະລາງ ຈຶ່ງລວມກັນໄດ້ເທົ່າ "ລວມທັງໝົດ" ພໍດີ */
      summary={countBy(rows, "status_name")}
      exportHref={all ? "/api/reports/export/open" : `/api/reports/export/pending?from=${from}&to=${to}`}
      minWidth={2800}
      searchPlaceholder="ຄົ້ນຫາ ລະຫັດ, ລູກຄ້າ, ເຄື່ອງ, SN, ຊ່າງ..."
      actions={
        <Link
          href={all ? `/reports/pending?from=${from}&to=${to}` : "/reports/pending?all=1"}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium ${
            all ? "bg-sky-500 text-white hover:bg-sky-600" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          ສະແດງທັງໝົດ
          <LinkPending className="size-3" />
        </Link>
      }
    />
  );
}
