import { defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { one, safeDate, todayIso, type SearchParams } from "@/lib/report-sql";
import { CUST_KIND_LABEL, serviceByCustomerKind, UNSET_KIND_LABEL, type CustKind } from "@/lib/service-money";

/**
 * **ງານສ້ອມ: ລູກຄ້າທົ່ວໄປ ແລະ ຮ້ານຄ້າ** — ນັບຕາມວັນທີຮັບເຄື່ອງ.
 *
 * ປະເພດມາຈາກ `ar_customer.cust_kind` ທີ່ **ຄົນລະບຸເອງ** (ໜ້າລູກຄ້າ) — ບໍ່ເດົາຈາກຊື່
 * ເພາະຊື່ບອກບໍ່ໄດ້ຈິງ ("ນ້ອຍ" 13 ງານ ອາດເປັນຮ້ານ · "LTH" ອາດເປັນບໍລິສັດ).
 * ລູກຄ້າທີ່ຍັງບໍ່ລະບຸຂຶ້ນແຖວ "ຍັງບໍ່ລະບຸ" ⇒ ເຫັນວ່າຍັງເຫຼືອເທົ່າໃດຕ້ອງໄປລະບຸ.
 */
export const dynamic = "force-dynamic";

const columns = [
  { key: "kind_label", label: "ປະເພດລູກຄ້າ" },
  { key: "jobs", label: "ຈຳນວນງານ" },
  { key: "customers", label: "ຈຳນວນລູກຄ້າ" },
  { key: "in_warranty", label: "ໃນປະກັນ" },
  { key: "out_warranty", label: "ນອກປະກັນ" },
  { key: "quoted", label: "ຄ່າສ້ອມທີ່ຕົກລົງ (ບາດ)" },
  { key: "paid", label: "ຮັບແລ້ວ (ບາດ)" },
];

export default async function ServiceByKindReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Awaited<ReturnType<typeof serviceByCustomerKind>> = [];
  let error: string | null = null;
  try {
    rows = await serviceByCustomerKind(from, to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const labelled = rows.map((row) => ({
    ...row,
    kind_label: row.kind === "unset" ? UNSET_KIND_LABEL : CUST_KIND_LABEL[row.kind as CustKind],
  }));
  const unset = rows.find((row) => row.kind === "unset");

  return (
    <ReportShell
      title="ງານສ້ອມ: ລູກຄ້າທົ່ວໄປ / ຮ້ານຄ້າ"
      subtitle={
        `ຕາມວັນທີຮັບເຄື່ອງ ${from} ຫາ ${to}` +
        (unset ? ` · ຍັງບໍ່ໄດ້ລະບຸປະເພດ ${unset.jobs.toLocaleString()} ງານ — ລະບຸໄດ້ທີ່ໜ້າລູກຄ້າ` : "")
      }
      basePath="/reports/service-by-kind"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={columns}
      rows={labelled}
      error={error}
      summary={[
        { label: "ງານທັງໝົດ", value: rows.reduce((total, row) => total + row.jobs, 0).toLocaleString() },
        { label: "ຮ້ານຄ້າ", value: (rows.find((row) => row.kind === "shop")?.jobs ?? 0).toLocaleString() },
        { label: "ທົ່ວໄປ", value: (rows.find((row) => row.kind === "general")?.jobs ?? 0).toLocaleString() },
        { label: "ຍັງບໍ່ລະບຸ", value: (unset?.jobs ?? 0).toLocaleString() },
      ]}
      minWidth={800}
      searchPlaceholder="ຄົ້ນຫາ..."
    />
  );
}
