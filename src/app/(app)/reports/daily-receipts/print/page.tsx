import { defaultFromIso } from "@/components/report-shell";
import { PrintLayout, PrintTable } from "@/components/report/print-layout";
import { columns, fetchDailyReceipts, one, safeDate, todayIso, type SearchParams } from "@/lib/report-sql";

/* ods: /printpdrcd/<id1>/<id2> — pdrcreport.py */
export default async function DailyReceiptsPrint({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const { rows, summary } = await fetchDailyReceipts(from, to);

  return (
    <PrintLayout title="ລາຍງານການຮັບເຄື່ອງສ້ອມປະຈຳວັນ" from={from} to={to}>
      <PrintTable
        head={columns.dailyReceipts.map((column) => column.header)}
        rows={rows.map((row) => columns.dailyReceipts.map((column) => row[column.key]))}
      />
      <h3 className="mt-6 mb-2 font-bold">ສະຫຼຸບ</h3>
      <div className="max-w-md">
        <PrintTable
          head={["ລະຫັດ", "ລາຍການ", "ຈຳນວນ"]}
          rows={summary.map((row) => [row.code, row.name_1, row.qty])}
        />
      </div>
    </PrintLayout>
  );
}
