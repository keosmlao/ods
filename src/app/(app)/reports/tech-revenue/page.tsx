import { defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { one, safeDate, todayIso, type SearchParams } from "@/lib/report-sql";
import { techRevenueByMonth } from "@/lib/service-money";

/**
 * **ສະຫຼຸບລາຍຮັບຊ່າງປະຈຳເດືອນ** — ໃຜເຮັດເງິນເຂົ້າໄດ້ເທົ່າໃດ ໃນເດືອນໃດ.
 *
 * ນັບຄືກັນກັບ /reports/service-revenue (ໃບສະເໜີລາຄາທີ່ລູກຄ້າຮັບແລ້ວ — ic_trans flag 17 · 1/1)
 * ແຕ່ **ແຍກຕາມຊ່າງເຈົ້າຂອງໃບງານ** (tb_product.emp_code).
 *
 * ⚠️ "ຮັບແລ້ວ" ອ່ານຈາກ ods_service_payment ເຊິ່ງຫາກໍ່ເລີ່ມບັນທຶກ 17-07-2026
 * ⇒ ເດືອນເກົ່າຈະເປັນ 0 ຈົນກວ່າຈະບັນທຶກຍ້ອນຫຼັງ. ໃບຮັບເງິນ SIN ຝັ່ງ ODS ຍອດ 0 ຈຶ່ງບໍ່ໄດ້ໃຊ້.
 */
export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "month", label: "ເດືອນ" },
  { key: "technician", label: "ຊ່າງ" },
  { key: "jobs", label: "ຈຳນວນວຽກ" },
  { key: "quoted", label: "ຕົກລົງ (ກີບ)" },
  { key: "paid", label: "ຮັບແລ້ວ (ກີບ)" },
  { key: "due", label: "ຄ້າງຮັບ (ກີບ)" },
];

export default async function TechRevenueReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Awaited<ReturnType<typeof techRevenueByMonth>> = [];
  let error: string | null = null;
  try {
    rows = await techRevenueByMonth(from, to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const sum = (key: "quoted" | "paid" | "due") =>
    rows.reduce((total, row) => total + (Number(row[key].replace(/,/g, "")) || 0), 0);

  return (
    <ReportShell
      title="ສະຫຼຸບລາຍຮັບຊ່າງປະຈຳເດືອນ"
      subtitle={`ຈາກ ${from} ຫາ ${to} — ນັບຈາກໃບສະເໜີລາຄາທີ່ລູກຄ້າຮັບແລ້ວ ແຍກຕາມຊ່າງ`}
      basePath="/reports/tech-revenue"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={COLUMNS}
      rows={rows}
      error={error}
      summary={[
        { label: "ວຽກທັງໝົດ", value: rows.reduce((total, row) => total + row.jobs, 0).toLocaleString() },
        { label: "ຕົກລົງ", value: sum("quoted").toLocaleString() },
        { label: "ຮັບແລ້ວ", value: sum("paid").toLocaleString() },
        { label: "ຄ້າງຮັບ", value: sum("due").toLocaleString() },
      ]}
      minWidth={760}
      searchPlaceholder="ຄົ້ນຫາ ຊ່າງ ຫຼື ເດືອນ…"
    />
  );
}
