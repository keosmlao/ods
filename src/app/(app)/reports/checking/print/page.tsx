import { defaultFromIso } from "@/components/report-shell";
import { PrintLayout, PrintTable } from "@/components/report/print-layout";
import { checkingFlags, columns, fetchChecking, one, safeDate, safeFlag, todayIso, type SearchParams } from "@/lib/report-sql";

/* ods: /checking_reportprint (122) + /checking_reportprint1 (56) — check_report.py */
export default async function CheckingPrint({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const flag = safeFlag(one(params.flag));
  const rows = await fetchChecking(from, to, flag);

  return (
    <PrintLayout title={`ລາຍງານການກວດເຊັກປະຈຳວັນ (${checkingFlags[flag]})`} from={from} to={to}>
      <PrintTable
        head={columns.checking.map((column) => column.header)}
        rows={rows.map((row) => columns.checking.map((column) => row[column.key]))}
      />
      <p className="mt-4 text-right text-xs">ລວມ {rows.length} ລາຍການ</p>
    </PrintLayout>
  );
}
