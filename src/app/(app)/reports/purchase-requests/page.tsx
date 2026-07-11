import { LinkPending } from "@/components/link-pending";
import { countBy, ReportShell, reportState } from "@/components/report-shell";
import { SelectField } from "@/components/select-field";
import {
  columns,
  fetchPurchaseRequests,
  one,
  safeDate,
  safeReportType,
  toTableColumns,
  todayIso,
  type Row,
  type SearchParams,
} from "@/lib/report-sql";
import Link from "next/link";

/* ods: /report_request_order (+ /report_request_order/all) — home.py, ຖານຂໍ້ມູນ ERP */
export default async function PurchaseRequestsReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const all = one(params.all) === "1";
  const from = safeDate(one(params.from), todayIso());
  const to = safeDate(one(params.to), todayIso());
  const reportType = safeReportType(one(params.report_type));
  const state = reportState(params);

  let rows: Row[] = [];
  let error: string | null = null;
  try {
    rows = await fetchPurchaseRequests(all ? null : from, all ? null : to, reportType);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const detailed = reportType === "product";
  return (
    <ReportShell
      title="ລາຍງານການສະເໜີຊື້ (ERP)"
      subtitle={all ? "ທັງໝົດ" : `ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/purchase-requests"
      query={all ? { all: "1", report_type: reportType } : { from, to, report_type: reportType }}
      omitFromForm={["all", "report_type"]}
      state={state}
      dateRange={{ from, to }}
      filters={
        <label className="block w-48">
          <span className="mb-1 block text-[11px] text-slate-500">ລາຍລະອຽດ</span>
          <SelectField
            name="report_type"
            defaultValue={reportType}
            options={[
              { value: "no_product", label: "ບໍ່ສະແດງລາຍລະອຽດ" },
              { value: "product", label: "ສະແດງລາຍລະອຽດ" },
            ]}
          />
        </label>
      }
      columns={toTableColumns(columns.purchaseRequests)}
      rows={rows}
      error={error}
      /* ສະຫຼຸບຕາມສະຖານະໃບສະເໜີຊື້ — ແຖວລາຍລະອຽດສິນຄ້າບໍ່ມີສະຖານະ ຈຶ່ງບໍ່ຖືກນັບຊ້ຳ */
      summary={countBy(rows, "pr_status")}
      /* ໂໝດ "ສະແດງລາຍລະອຽດ" ແຊກແຖວສິນຄ້າໄວ້ໃຕ້ແຕ່ລະໃບ — ຈັດຮຽງໃໝ່ຈະເຮັດໃຫ້ແຖວຍ່ອຍຫຼຸດຈາກຫົວຂອງມັນ */
      sortable={!detailed}
      exportHref={
        all
          ? `/api/reports/export/purchase-requests?all=1&type=${reportType}`
          : `/api/reports/export/purchase-requests?from=${from}&to=${to}&type=${reportType}`
      }
      minWidth={2000}
      searchPlaceholder="ຄົ້ນຫາ ເລກທີສະເໜີຊື້, ເລກທີສັ່ງຊື້, ສະຖານະ..."
      actions={
        <Link
          href={
            all
              ? `/reports/purchase-requests?${new URLSearchParams({ from, to, report_type: reportType })}`
              : `/reports/purchase-requests?${new URLSearchParams({ all: "1", report_type: reportType })}`
          }
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
