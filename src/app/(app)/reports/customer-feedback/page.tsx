import { LinkPending } from "@/components/link-pending";
import { ReportShell, reportState, type SummaryItem } from "@/components/report-shell";
import { columns, fetchCustomerFeedback, one, safeDate, toTableColumns, todayIso, type Row, type SearchParams } from "@/lib/report-sql";
import Link from "next/link";

/* ods: /report_cust_feedback (+ /report_cust_feedback/all) — install_admin.py */
export default async function CustomerFeedbackReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const all = one(params.all) === "1";
  const from = safeDate(one(params.from), todayIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let error: string | null = null;
  try {
    rows = await fetchCustomerFeedback(all ? null : from, all ? null : to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  // ສະຫຼຸບ: ຈຳນວນລູກຄ້າທີ່ຝາກຄຳຕິຊົມໄວ້ — ນັບຈາກແຖວຊຸດດຽວກັນກັບຕາຕະລາງ
  const summary: SummaryItem[] = [
    {
      label: "ມີຄຳຕິຊົມ",
      value: rows.filter((row) => String(row.complain_cust ?? "").trim() !== "").length.toLocaleString(),
    },
  ];

  return (
    <ReportShell
      title="ລາຍງານຄວາມພໍໃຈຂອງລູກຄ້າ"
      subtitle={all ? "ທັງໝົດ" : `ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/customer-feedback"
      query={all ? { all: "1" } : { from, to }}
      omitFromForm={["all"]}
      state={state}
      dateRange={{ from, to }}
      columns={toTableColumns(columns.feedback)}
      rows={rows}
      error={error}
      summary={summary}
      exportHref={
        all ? "/api/reports/export/customer-feedback?all=1" : `/api/reports/export/customer-feedback?from=${from}&to=${to}`
      }
      minWidth={2200}
      searchPlaceholder="ຄົ້ນຫາ ລະຫັດຕິດຕັ້ງ, ລູກຄ້າ, ເລກບີນ, ຊ່າງ, ຄຳຕິຊົມ..."
      actions={
        <Link
          href={all ? `/reports/customer-feedback?${new URLSearchParams({ from, to })}` : "/reports/customer-feedback?all=1"}
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
