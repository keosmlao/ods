import { defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { one, safeDate, todayIso, type SearchParams } from "@/lib/report-sql";
import { serviceRevenueByMonth } from "@/lib/service-money";

/**
 * **ສະຫຼຸບລາຍຮັບຈາກງານສ້ອມ** — ຕາມເດືອນ.
 *
 * "ຕົກລົງ" = ໃບສະເໜີລາຄາທີ່ລູກຄ້າຮັບແລ້ວ (ic_trans trans_flag=17 · 1/1) = ຍອດທີ່ຕ້ອງເກັບ.
 * "ຮັບແລ້ວ" = ods_service_payment. ໃບຮັບເງິນເກົ່າ (SIN) ຍອດ 0 ທຸກໃບ ຈຶ່ງບໍ່ໄດ້ໃຊ້.
 * ⚠️ ບັນທຶກການຊຳລະຫາກໍ່ເລີ່ມ 17-07-2026 ⇒ ເດືອນເກົ່າ "ຮັບແລ້ວ" ຈະເປັນ 0 ຈົນກວ່າຈະບັນທຶກຍ້ອນຫຼັງ.
 */
export const dynamic = "force-dynamic";

type Dict = Record<string, string>;

const columnsFor = (t: Dict) => [
  { key: "month", label: t.colMonth },
  { key: "jobs", label: t.colJobs },
  { key: "quoted", label: t.colQuoted },
  { key: "paid", label: t.colPaid },
  { key: "due", label: t.colDue },
];

export default async function ServiceRevenueReport({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary(await getLocale())).serviceRevenue;
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Awaited<ReturnType<typeof serviceRevenueByMonth>> = [];
  let error: string | null = null;
  try {
    rows = await serviceRevenueByMonth(from, to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : t.fetchFailed;
  }

  const sum = (key: "quoted" | "paid" | "due") =>
    rows.reduce((total, row) => total + (Number(row[key].replace(/,/g, "")) || 0), 0);

  return (
    <ReportShell
      title={t.title}
      subtitle={`${t.subtitlePrefix} ${from} ${t.subtitleTo} ${to} ${t.subtitleSuffix}`}
      basePath="/reports/service-revenue"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={columnsFor(t)}
      rows={rows}
      error={error}
      summary={[
        { label: t.statJobs, value: rows.reduce((total, row) => total + row.jobs, 0).toLocaleString() },
        { label: t.statQuoted, value: sum("quoted").toLocaleString() },
        { label: t.statPaid, value: sum("paid").toLocaleString() },
        { label: t.statDue, value: sum("due").toLocaleString() },
      ]}
      minWidth={700}
      searchPlaceholder={t.searchPlaceholder}
    />
  );
}
