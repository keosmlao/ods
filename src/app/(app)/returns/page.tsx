import { OUTSTANDING_SUMMARY_SQL, type OutstandingSummary } from "@/lib/outstanding-spares";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { MobileCardList } from "@/components/mobile-card-list";
import { RowLink } from "@/components/row-link";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, PackageCheck, Printer, Receipt, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** ຖອດແບບຈາກ ods: returnproduct.py homereturn() + templates/returnProduct/HomeReturn.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "waiting" | "cancelled" | "bills";
type JobTab = "waiting" | "cancelled";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type WaitRow = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  finished: string | null;
  elapsed_seconds: number | null;
  issue: string | null;
  issue_2: string | null;
  emp_code: string | null;
  product_url: string | null;
  spares: OutstandingSummary | null;
};

type BillRow = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  remark: string | null;
  total_amount: string | null;
};

/**
 * ເຄື່ອງທີ່ສ້ອມແລ້ວ ລໍຖ້າສົ່ງຄືນລູກຄ້າ.
 *
 * ods ອີງໃສ່ view tracking_tb_product (status_real = 10) ເຊິ່ງເງື່ອນໄຂຊັບຊ້ອນຫຼາຍ:
 * ນອກຈາກ "ສ້ອມຈົບ" ແລ້ວ ຍັງບັງຄັບໃຫ້ຂໍ້ມູນອາໄຫຼ່ຄົບຊຸດ (used_spare=1 ຕ້ອງມີທັງ
 * spare_reg ແລະ spare_finish). ວຽກທີ່ສ້ອມຈົບແຕ່ຂໍ້ມູນອາໄຫຼ່ບໍ່ຄົບ ຈຶ່ງ "ຫາຍ"
 * ອອກຈາກໜ້ານີ້ ທັງທີ່ເຄື່ອງນອນລໍລູກຄ້າມາຮັບຢູ່ (ຕົວຢ່າງ: ໃບ 7477).
 *
 * ບ່ອນນີ້ໃຊ້ເງື່ອນໄຂຕາມຄວາມຈິງ: ສ້ອມຈົບແລ້ວ + ຍັງບໍ່ໄດ້ສົ່ງຄືນ + ບໍ່ຖືກຍົກເລີກ.
 */
/**
 * ລໍສົ່ງຄືນ = **ຜ່ານ QC ແລ້ວ** (ຂັ້ນ 11). ງານທີ່ສ້ອມແລ້ວແຕ່ QC ຍັງບໍ່ຜ່ານ
 * ຄ້າງຢູ່ຂັ້ນ 10 (ລໍກວດ QC) ⇒ ອອກໃບຮັບເງິນ/ສົ່ງຄືນບໍ່ໄດ້.
 */
const WAITING =
  "a.time_finish_repair is not null and a.qc_finish is not null and a.return_complete is null and a.status <> 6";

/**
 * ສົ່ງຄືນໂດຍບໍ່ສ້ອມ (GAP A) — ວຽກທີ່ຍົກເລີກແລ້ວ (status=6) ແລະ ອະນຸມັດການຍົກເລີກແລ້ວ
 * ແຕ່ເຄື່ອງຍັງບໍ່ໄດ້ສົ່ງຄືນລູກຄ້າ.
 *
 * ກ່ອນນີ້ວຽກກຸ່ມນີ້ບໍ່ມີໜ້າໃດຮັບເລີຍ: ໜ້າ "ລໍຖ້າສົ່ງຄືນ" ຂ້າງເທິງກັນ status=6 ອອກ
 * ແລະ ບໍ່ມີບ່ອນອື່ນປະທັບ return_complete → ເຄື່ອງກັບບ້ານລູກຄ້າໄປແລ້ວ ແຕ່ລະບົບຍັງເປີດຄ້າງຕະຫຼອດ
 * ແລະ ຄ່າກວດເຊັກກໍ່ເກັບບໍ່ໄດ້. ແທັບນີ້ພາໄປໜ້າ /returns/<code> ອັນເກົ່າ (ໃບຮັບເງິນ trans_flag 44)
 * ໂດຍບໍ່ປ່ຽນຄວາມໝາຍຂອງ "ຍົກເລີກ" (status ຍັງເປັນ 6 ຄືເກົ່າ).
 */
const CANCELLED = "a.status = 6 and a.cancel_finish is not null and a.return_complete is null";

const JOB_BUCKET: Record<JobTab, { where: string; timeCol: string }> = {
  waiting: { where: WAITING, timeCol: "a.time_finish_repair" },
  cancelled: { where: CANCELLED, timeCol: "a.cancel_finish" },
};

/** ໃບຮັບເງິນທີ່ອອກແລ້ວ — ic_trans trans_flag 44 */
const BILLS = "a.trans_flag = 44";

const WAIT_SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.issue ilike $Q or a.issue_2 ilike $Q or a.emp_code ilike $Q
  or b.name_1 ilike $Q or b.tel ilike $Q)`;

const BILL_SEARCH = `(a.doc_no ilike $Q or a.remark ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q
  or c.name_1 ilike $Q or c.sn ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const WAIT_SORT: Record<string, string> = {
  code: "a.code",
  elapsed: "at_col",
  product: "a.name_1",
  brand: "a.p_brand",
  customer: "b.name_1",
  warranty: "a.warrunty",
  technician: "a.emp_code",
};

const BILL_SORT: Record<string, string> = {
  doc_no: "a.doc_no",
  doc_date: "a.doc_date",
  customer: "b.name_1",
  product: "c.name_1",
  amount: "a.total_amount",
};

/** ລໍຖ້າສົ່ງຄືນ / ສົ່ງຄືນໂດຍບໍ່ສ້ອມ — ນັບເວລາຈາກ "ສ້ອມຈົບ" ຫຼື "ອະນຸມັດຍົກເລີກ" ຕາມແທັບ */
async function getJobs(tab: JobTab, q: string, page: number, sort: string, dir: SortDir) {
  const { where: bucket, timeCol } = JOB_BUCKET[tab];
  const where = [bucket];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(WAIT_SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = WAIT_SORT[sort] ?? "at_col";
  // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col" ? `${timeCol} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const rowsSql = `select a.code,
      concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
      a.warrunty warranty, to_char(${timeCol},'DD-MM-YYYY HH24:MI') finished,
      greatest(0, round(extract(epoch from (localtimestamp - ${timeCol}))))::int elapsed_seconds,
      a.issue, a.issue_2, a.emp_code, c.product_url,
      ${OUTSTANDING_SUMMARY_SQL} spares
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    left join product_image c on c.iteme_code = a.code and c.line_number = 0
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${filter}`;

  const [rows, count] = await Promise.all([
    query<WaitRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

async function getBills(q: string, page: number, sort: string, dir: SortDir) {
  const where = [BILLS];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(BILL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");
  const orderBy = `${BILL_SORT[sort] ?? "a.roworder"} ${dir}`;

  const rowsSql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date,
      concat_ws('-', b.name_1, b.tel) customer, concat_ws('-', c.name_1, c.sn) product,
      a.remark, a.total_amount
    from ic_trans a
    left join ar_customer b on b.code = a.cust_code
    left join tb_product c on c.code = a.product_code
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total
    from ic_trans a
    left join ar_customer b on b.code = a.cust_code
    left join tb_product c on c.code = a.product_code
    where ${filter}`;

  const [rows, count] = await Promise.all([
    query<BillRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts() {
  const [jobs, bills] = await Promise.all([
    query<{ waiting: number; cancelled: number }>(
      `select count(*) filter (where ${WAITING})::int waiting,
          count(*) filter (where ${CANCELLED})::int cancelled
        from tb_product a`,
    ),
    query<{ n: number }>(`select count(*)::int n from ic_trans a where ${BILLS}`),
  ]);
  return {
    waiting: jobs.rows[0]?.waiting ?? 0,
    cancelled: jobs.rows[0]?.cancelled ?? 0,
    bills: bills.rows[0]?.n ?? 0,
  };
}

const WAIT_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ເວລາລໍຖ້າສົ່ງຄືນ", defaultDir: "desc" },
  { key: "product", label: "ຊື່ເຄື່ອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "technician", label: "ຜູ້ສ້ອມ", defaultDir: "asc" },
];

const BILL_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທີ", defaultDir: "desc" },
  { key: "doc_date", label: "ວັນທີ", defaultDir: "desc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "product", label: "ລາຍການສິນຄ້າ", defaultDir: "asc" },
  { key: "amount", label: "ມູນຄ່າ", defaultDir: "desc" },
];

const money = (value: string | null) =>
  Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ReturnsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "bills" ? "bills" : params.tab === "cancelled" ? "cancelled" : "waiting";
  const isJobTab = tab !== "bills";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (tab === "bills" ? "doc_no" : "elapsed")).trim();

  const [counts, jobs, bills] = await Promise.all([
    getCounts(),
    isJobTab ? getJobs(tab, q, page, sort, dir) : Promise.resolve({ rows: [] as WaitRow[], total: 0 }),
    tab === "bills" ? getBills(q, page, sort, dir) : Promise.resolve({ rows: [] as BillRow[], total: 0 }),
  ]);

  const total = isJobTab ? jobs.total : bills.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/returns?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/returns?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/returns?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof PackageCheck; count: number }[] = [
    { key: "waiting", label: "ລໍຖ້າສົ່ງຄືນ", icon: PackageCheck, count: counts.waiting },
    { key: "cancelled", label: "ສົ່ງຄືນໂດຍບໍ່ສ້ອມ", icon: Ban, count: counts.cancelled },
    { key: "bills", label: "ໃບຮັບເງິນ", icon: Receipt, count: counts.bills },
  ];

  const columns = isJobTab ? WAIT_COLUMNS : BILL_COLUMNS;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ລາຍການລໍຖ້າສົ່ງຄືນສິນຄ້າ/ອອກໃບຮັບເງິນ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
        </p>
      </div>

      {/* ແທັບ + ຄົ້ນຫາ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <Link
              key={key}
              href={tabHref(key)}
              className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              <span className={`rounded px-1 text-[10px] font-bold ${tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                {count}
              </span>
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>

        <form className="flex flex-1 items-center gap-2">
          {tab !== "waiting" && <input type="hidden" name="tab" value={tab} />}
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder={
                isJobTab ? "ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ຊ່າງ..." : "ຄົ້ນຫາ ເລກທີ, ລູກຄ້າ, ສິນຄ້າ, ໝາຍເຫດ..."
              }
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ (desktop) */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className={`w-full ${isJobTab ? "min-w-[1250px]" : "min-w-[1000px]"} border-collapse text-xs`}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={
                      column.key === "elapsed" && tab === "cancelled" ? "ອະນຸມັດຍົກເລີກມາແລ້ວ" : column.label
                    }
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className="py-2.5"
                  />
                ))}
                {isJobTab ? (
                  <>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການ</th>
                    {tab === "cancelled" && (
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາໄຫຼ່ຄ້າງນອກສາງ</th>
                    )}
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຮູບ</th>
                  </>
                ) : (
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໝາຍເຫດ</th>
                )}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isJobTab &&
                jobs.rows.map((row) => {
                  const tone = elapsedTone(row.elapsed_seconds);
                  const inWarranty = row.warranty === "ຮັບປະກັນ";
                  return (
                    <RowLink key={row.code} href={`/service/${row.code}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                        <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                        <Link href={`/service/${row.code}`} className="hover:underline">
                          {row.code}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Elapsed
                          seconds={row.elapsed_seconds}
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                        />
                        <span className="mt-0.5 block text-[10px] text-slate-400">{row.finished}</span>
                      </td>
                      <td className="max-w-64 px-3 py-2.5">
                        <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                          {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.brand || "-"}</td>
                      <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>
                        {row.customer || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {row.warranty || "-"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.emp_code || "-"}</td>
                      <td
                        className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600"
                        title={(tab === "cancelled" ? row.issue : row.issue_2) ?? ""}
                      >
                        {(tab === "cancelled" ? row.issue_2 || row.issue : row.issue_2) || "-"}
                      </td>
                      {tab === "cancelled" && (
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {row.spares && row.spares.lines > 0 ? (
                            <>
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                {row.spares.lines} ລາຍການ · {row.spares.units.toLocaleString()} ໜ່ວຍ
                              </span>
                              <span className="mt-0.5 block text-[10px] text-slate-400">
                                {row.spares.docs} ໃບເບີກ ຍັງບໍ່ຄືນສາງ
                              </span>
                            </>
                          ) : (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              ຄືນສາງຄົບ
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center">
                        {row.product_url ? (
                          <a
                            href={`/api/uploads/${encodeURIComponent(row.product_url)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block overflow-hidden rounded"
                          >
                            <Image
                              src={`/api/uploads/${encodeURIComponent(row.product_url)}`}
                              alt=""
                              width={32}
                              height={32}
                              unoptimized
                              className="size-8 object-cover transition hover:scale-125"
                            />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        <Link
                          href={`/returns/${encodeURIComponent(row.code)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <CheckCircle2 className="size-3.5" />
                          {tab === "cancelled" ? "ສົ່ງຄືນ" : "ເບີກ"}
                          <LinkPending className="size-3" />
                        </Link>
                      </td>
                    </RowLink>
                  );
                })}

              {tab === "bills" &&
                bills.rows.map((row) => (
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-emerald-700">{row.doc_no}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
                    <td className="max-w-52 truncate px-3 py-2.5" title={row.customer ?? ""}>
                      {row.customer || "-"}
                    </td>
                    <td className="max-w-64 truncate px-3 py-2.5" title={row.product ?? ""}>
                      {row.product || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{money(row.total_amount)}</td>
                    <td className="max-w-52 truncate px-3 py-2.5 text-slate-500" title={row.remark ?? ""}>
                      {row.remark || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {/* ods ປຸ່ມນີ້ຊີ້ໄປ '#' (ຍັງບໍ່ທັນເຮັດ) — ບ່ອນນີ້ໃຫ້ພິມໃບຮັບເງິນໄດ້ຈິງ */}
                      <Link
                        href={`/returns/${encodeURIComponent(row.doc_no)}/print`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="size-3.5" />
                        ເບີ່ງ
                        <LinkPending className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ບັດ (mobile) — ແຖວດຽວກັນກັບຕາຕະລາງ, ປຸ່ມ/ເງື່ອນໄຂອັນດຽວກັນ */}
        <div className="p-2 md:hidden">
          <MobileCardList className="space-y-2">
          {isJobTab &&
            jobs.rows.map((row) => {
              const tone = elapsedTone(row.elapsed_seconds);
              const inWarranty = row.warranty === "ຮັບປະກັນ";
              const issue = (tab === "cancelled" ? row.issue_2 || row.issue : row.issue_2) || null;
              return (
                <div key={row.code} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/service/${row.code}`} className="font-bold text-[#0536a9] hover:underline">
                      {row.code}
                    </Link>
                    <Elapsed
                      seconds={row.elapsed_seconds}
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {tab === "cancelled" ? "ອະນຸມັດຍົກເລີກ" : "ສ້ອມຈົບ"}: {row.finished || "-"}
                  </p>

                  <div className="mt-2 flex items-start gap-2">
                    {row.product_url ? (
                      <a
                        href={`/api/uploads/${encodeURIComponent(row.product_url)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 overflow-hidden rounded"
                      >
                        <Image
                          src={`/api/uploads/${encodeURIComponent(row.product_url)}`}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="size-11 object-cover"
                        />
                      </a>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">SN: {row.sn || "-"}</p>
                      <p className="truncate text-[11px] text-slate-500">ຫຍີ່ຫໍ້: {row.brand || "-"}</p>
                    </div>
                  </div>

                  <p className="mt-1.5 truncate text-xs text-slate-600" title={row.customer ?? ""}>
                    ລູກຄ້າ: {row.customer || "-"}
                  </p>
                  {issue && (
                    <p className="mt-0.5 truncate text-xs font-semibold text-red-600" title={issue}>
                      ອາການ: {issue}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.warranty || "-"}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      ຊ່າງ: {row.emp_code || "-"}
                    </span>
                    {tab === "cancelled" &&
                      (row.spares && row.spares.lines > 0 ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          ອາໄຫຼ່ຄ້າງ {row.spares.lines} ລາຍການ · {row.spares.docs} ໃບເບີກ
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          ຄືນສາງຄົບ
                        </span>
                      ))}
                  </div>

                  <Link
                    href={`/returns/${encodeURIComponent(row.code)}`}
                    className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <CheckCircle2 className="size-4" />
                    {tab === "cancelled" ? "ສົ່ງຄືນ" : "ເບີກ"}
                    <LinkPending className="size-3.5" />
                  </Link>
                </div>
              );
            })}

          {tab === "bills" &&
            bills.rows.map((row) => (
              <div key={row.doc_no} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-emerald-700">{row.doc_no}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{row.doc_date ?? "-"}</span>
                </div>
                <p className="mt-1.5 truncate text-xs text-slate-600" title={row.customer ?? ""}>
                  ລູກຄ້າ: {row.customer || "-"}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-800" title={row.product ?? ""}>
                  {row.product || "-"}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{money(row.total_amount)}</p>
                {row.remark && (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500" title={row.remark}>
                    ໝາຍເຫດ: {row.remark}
                  </p>
                )}
                <Link
                  href={`/returns/${encodeURIComponent(row.doc_no)}/print`}
                  className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="size-4" />
                  ເບີ່ງ
                  <LinkPending className="size-3.5" />
                </Link>
              </div>
            ))}
          </MobileCardList>
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
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
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
