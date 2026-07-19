import { defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { one, safeDate, todayIso, type SearchParams } from "@/lib/report-sql";
import { CUST_KIND_LABEL, serviceByCustomerKind, UNSET_KIND_LABEL, type CustKind } from "@/lib/service-money";

type Dict = Record<string, string>;

/**
 * **ງານສ້ອມ: ລູກຄ້າທົ່ວໄປ ແລະ ຮ້ານຄ້າ** — ນັບຕາມວັນທີຮັບເຄື່ອງ.
 *
 * ປະເພດມາຈາກ `ar_customer.cust_kind` ທີ່ **ຄົນລະບຸເອງ** (ໜ້າລູກຄ້າ) — ບໍ່ເດົາຈາກຊື່
 * ເພາະຊື່ບອກບໍ່ໄດ້ຈິງ ("ນ້ອຍ" 13 ງານ ອາດເປັນຮ້ານ · "LTH" ອາດເປັນບໍລິສັດ).
 * ລູກຄ້າທີ່ຍັງບໍ່ລະບຸຂຶ້ນແຖວ "ຍັງບໍ່ລະບຸ" ⇒ ເຫັນວ່າຍັງເຫຼືອເທົ່າໃດຕ້ອງໄປລະບຸ.
 */
export const dynamic = "force-dynamic";

const columnsFor = (t: Dict) => [
  { key: "kind_label", label: t.colKindLabel },
  { key: "jobs", label: t.colJobs },
  { key: "customers", label: t.colCustomers },
  { key: "in_warranty", label: t.colInWarranty },
  { key: "out_warranty", label: t.colOutWarranty },
  { key: "quoted", label: t.colQuoted },
  { key: "paid", label: t.colPaid },
];

export default async function ServiceByKindReport({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary(await getLocale())).serviceByKind;
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Awaited<ReturnType<typeof serviceByCustomerKind>> = [];
  let error: string | null = null;
  try {
    rows = await serviceByCustomerKind(from, to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : t.fetchError;
  }

  const labelled = rows.map((row) => ({
    ...row,
    kind_label: row.kind === "unset" ? UNSET_KIND_LABEL : CUST_KIND_LABEL[row.kind as CustKind],
  }));
  const unset = rows.find((row) => row.kind === "unset");

  return (
    <ReportShell
      title={t.title}
      subtitle={
        `${t.subtitleByReceivedDate} ${from} ${t.subtitleTo} ${to}` +
        (unset ? ` ${t.subtitleUnsetPrefix} ${unset.jobs.toLocaleString()} ${t.subtitleUnsetSuffix}` : "")
      }
      basePath="/reports/service-by-kind"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={columnsFor(t)}
      rows={labelled}
      error={error}
      summary={[
        { label: t.statTotalJobs, value: rows.reduce((total, row) => total + row.jobs, 0).toLocaleString() },
        { label: t.statShop, value: (rows.find((row) => row.kind === "shop")?.jobs ?? 0).toLocaleString() },
        { label: t.statGeneral, value: (rows.find((row) => row.kind === "general")?.jobs ?? 0).toLocaleString() },
        { label: t.statUnset, value: (unset?.jobs ?? 0).toLocaleString() },
      ]}
      minWidth={800}
      searchPlaceholder={t.searchPlaceholder}
    />
  );
}
