import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { installStatuses, repairStatuses } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * ລາຍລະອຽດຂອງແຕ່ລະຂັ້ນ (ກົດມາຈາກໜ້າລວມ).
 *
 * ຕ່າງຈາກເກົ່າ: ເກົ່າດຶງ 1,000 ແຖວມາທັງໝົດ ແລ້ວໃຫ້ browser ກອງ/ແບ່ງໜ້າ
 * → ດຽວນີ້ ຄົ້ນຫາ · ຈັດຮຽງ · ແບ່ງໜ້າ ຢູ່ຝັ່ງ server (20 ແຖວ/ໜ້າ) ຈຶ່ງບໍ່ມີເພດານ 1,000 ອີກ.
 */
const PAGE_SIZE = 20;

type Props = {
  params: Promise<{ workflow: string; status: string }>;
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
};

type RepairRow = {
  code: string; customer: string | null; phone: string | null; product: string | null; sn: string | null;
  model: string | null; brand: string | null; warranty: string | null; service_type: string | null;
  issue: string | null; accessory: string | null; reference: string | null; receiver: string | null;
  technician: string | null; registered: string | null; elapsed_seconds: number | null;
};

type InstallRow = {
  code: string; customer: string | null; product: string | null; brand: string | null; model: string | null;
  product_type: string | null; product_size: string | null; appointment: string | null; sale_bill: string | null;
  technician: string | null; creator: string | null; registered: string | null; elapsed_seconds: number | null;
};

const REPAIR_SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.issue ilike $Q or a.emp_code ilike $Q or c.name_1 ilike $Q or c.tel ilike $Q)`;
const INSTALL_SEARCH = `(a.code ilike $Q or a.item_name ilike $Q or a.pro_brand ilike $Q or a.pro_model ilike $Q
  or a.pro_sn ilike $Q or a.doc_ref_1 ilike $Q or a.tech_code ilike $Q or c.name_1 ilike $Q or c.tel ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const REPAIR_SORT: Record<string, string> = {
  code: "a.code", elapsed: "a.time_register", customer: "c.name_1", product: "a.name_1",
  brand: "a.p_brand", warranty: "a.warrunty", technician: "a.emp_code", receiver: "a.user_regis",
};
const INSTALL_SORT: Record<string, string> = {
  code: "a.code", elapsed: "a.time_register", customer: "c.name_1", product: "a.item_name",
  brand: "a.pro_brand", appointment: "a.appoint_date", technician: "a.tech_code", creator: "a.user_created",
};

const REPAIR_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ສິນຄ້າ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "receiver", label: "ຜູ້ຮັບ", defaultDir: "asc" },
];

const INSTALL_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ", defaultDir: "asc" },
  { key: "brand", label: "ຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "appointment", label: "ວັນນັດ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "creator", label: "ຜູ້ສ້າງ", defaultDir: "asc" },
];

export default async function StatusPage({ params, searchParams }: Props) {
  const { workflow, status } = await params;
  const isRepair = workflow === "repair";
  const config = isRepair ? repairStatuses[status] : workflow === "install" ? installStatuses[status] : null;
  if (!config) notFound();

  const search = await searchParams;
  const q = (search.q ?? "").trim();
  const page = Math.max(1, Number(search.page) || 1);
  const dir: SortDir = search.dir === "asc" ? "asc" : "desc";
  const sort = (search.sort ?? "elapsed").trim();

  const sortMap = isRepair ? REPAIR_SORT : INSTALL_SORT;
  const columns = isRepair ? REPAIR_COLUMNS : INSTALL_COLUMNS;

  // "ຄ້າງມາ" = ຄ້າງດົນສຸດກ່ອນ → ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const column = sortMap[sort] ?? sortMap.elapsed;
  const isElapsed = column === sortMap.elapsed;
  const orderBy = isElapsed
    ? `${column} ${dir === "desc" ? "asc" : "desc"} nulls last`
    : `${column} ${dir} nulls last`;

  const where = [
    isRepair ? config.condition : `a.cancel_date is null and a.job_finish is null and ${config.condition}`,
  ];
  const args: (string | number)[] = [];
  if (q) {
    args.push(`%${q}%`);
    where.push((isRepair ? REPAIR_SEARCH : INSTALL_SEARCH).replaceAll("$Q", `$${args.length}`));
  }
  const filter = where.join(" and ");

  const from = isRepair
    ? "from tb_product a left join ar_customer c on c.code = a.cust_code"
    : "from ods_tb_install a left join ar_customer c on c.code = a.cust_code";

  const elapsed = "greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds";

  const rowsSql = isRepair
    ? `select a.code, c.name_1 customer, c.tel phone, a.name_1 product, a.sn, a.p_model model, a.p_brand brand,
         a.warrunty warranty, a.service_type, a.issue, a.p_access accessory, a.doc_def reference,
         a.user_regis receiver, a.emp_code technician,
         to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered, ${elapsed}
       ${from} where ${filter} order by ${orderBy} limit $${args.length + 1} offset $${args.length + 2}`
    : `select a.code, c.name_1 customer, a.item_name product, a.pro_brand brand, a.pro_model model,
         a.pro_type product_type, a.pro_size product_size, to_char(a.appoint_date,'DD-MM-YYYY') appointment,
         a.doc_ref_1 sale_bill, a.tech_code technician, a.user_created creator,
         to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered, ${elapsed}
       ${from} where ${filter} order by ${orderBy} limit $${args.length + 1} offset $${args.length + 2}`;

  const [list, count] = await Promise.all([
    query<RepairRow & InstallRow>(rowsSql, [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(`select count(*)::int total ${from} where ${filter}`, args),
  ]);

  const total = count.rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: SortDir) =>
    `/dashboard/status/${workflow}/${status}?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/dashboard/status/${workflow}/${status}?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
            <ArrowLeft className="size-3.5" />
            ກັບໜ້າລວມ
            <LinkPending className="size-3" />
          </Link>
          <h1 className="text-xl font-bold text-slate-700">{config.label}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {isRepair ? "ວຽກສ້ອມແປງ" : "ວຽກຕິດຕັ້ງ"} · {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
        <a
          href={`/api/dashboard/export?workflow=${workflow}&status=${status}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
        >
          <Download className="size-4" />
          Export CSV
        </a>
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ຊ່າງ..."
            className="w-full text-xs outline-none"
          />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns.map((col) => (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    sortKey={col.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={col.defaultDir}
                    className="py-2.5"
                  />
                ))}
                {isRepair ? (
                  <>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອຸປະກອນ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອ້າງອີງ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການເສຍ</th>
                  </>
                ) : (
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເລກບິນຂາຍ</th>
                )}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                const inWarranty = row.warranty === "ຮັບປະກັນ";
                return (
                  <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      {isRepair ? (
                        <Link href={`/service/${row.code}`} className="hover:underline">{row.code}</Link>
                      ) : (
                        row.code
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed seconds={row.elapsed_seconds} className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`} />
                      <span className="mt-0.5 block text-[10px] text-slate-400">{row.registered || "-"}</span>
                    </td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {isRepair
                          ? row.sn || "-"
                          : [row.product_type, row.product_size].filter(Boolean).join(" · ") || "-"}
                        {isRepair && row.service_type && (
                          <span className="ml-1">· {SERVICE_TYPE_LABEL[row.service_type] ?? row.service_type}</span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.brand || "-"}</td>
                    <td className="max-w-44 px-3 py-2.5">
                      <span className="block truncate text-slate-700" title={row.customer ?? ""}>{row.customer || "-"}</span>
                      {isRepair && <span className="block truncate text-[10px] text-slate-400">{row.phone || "-"}</span>}
                    </td>
                    {isRepair ? (
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {row.warranty || "-"}
                        </span>
                      </td>
                    ) : (
                      <td className="whitespace-nowrap px-3 py-2.5">{row.appointment || "-"}</td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2.5">{row.technician || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{isRepair ? row.receiver || "-" : row.creator || "-"}</td>
                    {isRepair ? (
                      <>
                        <td className="max-w-40 truncate px-3 py-2.5 text-slate-600" title={row.accessory ?? ""}>
                          {row.accessory || "-"}
                        </td>
                        <td className="max-w-32 truncate px-3 py-2.5 text-slate-600" title={row.reference ?? ""}>
                          {row.reference || "-"}
                        </td>
                        <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
                          {row.issue || "-"}
                        </td>
                      </>
                    ) : (
                      <td className="max-w-40 truncate px-3 py-2.5 text-slate-600" title={row.sale_bill ?? ""}>
                        {row.sale_bill || "-"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} ຈາກ {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              ກ່ອນໜ້າ
            </Link>
            <span className="px-3 font-medium text-slate-700">{page} / {pages}</span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ຕໍ່ໄປ
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
