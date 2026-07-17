import { defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
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

const columns = [
  { key: "month", label: "ເດືອນ" },
  { key: "jobs", label: "ຈຳນວນງານ" },
  { key: "quoted", label: "ຕົກລົງ (ບາດ)" },
  { key: "paid", label: "ຮັບແລ້ວ (ບາດ)" },
  { key: "due", label: "ຄ້າງ (ບາດ)" },
];

export default async function ServiceRevenueReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Awaited<ReturnType<typeof serviceRevenueByMonth>> = [];
  let error: string | null = null;
  try {
    rows = await serviceRevenueByMonth(from, to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const sum = (key: "quoted" | "paid" | "due") =>
    rows.reduce((total, row) => total + (Number(row[key].replace(/,/g, "")) || 0), 0);

  return (
    <ReportShell
      title="ສະຫຼຸບລາຍຮັບຈາກງານສ້ອມ"
      subtitle={`ຕາມວັນທີໃບສະເໜີລາຄາ ${from} ຫາ ${to} · ບັນທຶກການຊຳລະເລີ່ມ 17-07-2026`}
      basePath="/reports/service-revenue"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={columns}
      rows={rows}
      error={error}
      summary={[
        { label: "ງານ", value: rows.reduce((total, row) => total + row.jobs, 0).toLocaleString() },
        { label: "ຕົກລົງ", value: sum("quoted").toLocaleString() },
        { label: "ຮັບແລ້ວ", value: sum("paid").toLocaleString() },
        { label: "ຄ້າງ", value: sum("due").toLocaleString() },
      ]}
      minWidth={700}
      searchPlaceholder="ຄົ້ນຫາເດືອນ..."
    />
  );
}
