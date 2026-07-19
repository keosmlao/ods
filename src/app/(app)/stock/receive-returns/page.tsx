import { syncErpReturns } from "@/lib/erp-dispatch";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { Todo } from "@/components/ui";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { ChevronLeft, ChevronRight, Eye, FileBarChart, PackageCheck, Undo2 } from "lucide-react";
import Link from "next/link";
import { ReceiveFilters } from "./filters";

/** ods: stock.py /home_stock_return + templates/stock/home_stock_return.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "pending" | "received";
type Props = {
  searchParams: Promise<{ tab?: string; q?: string; job?: string; page?: string; sort?: string; dir?: string }>;
};

type Doc = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  doc_ref_date: string | null;
  remark: string | null;
  product_code: string | null;
  job_type: string | null;
  elapsed_seconds: number | null;
};

/**
 * ໃບຂໍສົ່ງຄືນທີ່ຍັງບໍ່ທັນຮັບເຂົ້າສາງ.
 *
 * NOTE: ods ກັ່ນເອົາໃບທີ່ຮັບແລ້ວອອກດ້ວຍ `doc_no not in (select doc_ref ... where doc_no like 'SRT%')`
 * ແຕ່ເລກທີ່ອອກຈິງແມ່ນ 'SPRT...' → ເງື່ອນໄຂນັ້ນບໍ່ເຄີຍຈັບ, ໃບທີ່ຮັບແລ້ວຄ້າງຢູ່ໃນລາຍການຕະຫຼອດ.
 * ຢູ່ນີ້ກັ່ນດ້ວຍ trans_flag ແທນ ຈຶ່ງເຮັດວຽກຖືກຕ້ອງບໍ່ວ່າເລກຈະຂຶ້ນຕົ້ນດ້ວຍຫຍັງ.
 *
 * ນອກນັ້ນຂຽນເປັນ NOT EXISTS (ບໍ່ແມ່ນ NOT IN): ໃຊ້ index idx_ic_trans_doc_no ໄດ້
 * ແລະ ບໍ່ຕົກຫຼຸມ NULL ຂອງ NOT IN (ຖ້າ doc_ref ມີ NULL ແຖວດຽວ NOT IN ຄືນ 0 ແຖວທັງໝົດ).
 */
const PENDING_SQL = `(a.trans_flag = $1 and a.status = $2
  and not exists (select 1 from ic_trans t where t.trans_flag = $3 and t.doc_ref = a.doc_no))`;

/**
 * ໃບທີ່ຮັບຄືນເຂົ້າສາງແລ້ວ — ods ຕັດໄວ້ 50 ແຖວ, ຢູ່ນີ້ແບ່ງໜ້າຈຶ່ງເຫັນຄົບ.
 * ຮັບເລກ placeholder ເພາະໃຊ້ຮ່ວມກັບ query ນັບແທັບ (ຕ້ອງບໍ່ສົ່ງ param ທີ່ບໍ່ໄດ້ອ້າງອີງ).
 */
const receivedSql = (flagPlaceholder: string) => `(a.trans_flag = ${flagPlaceholder})`;

const SEARCH = "(a.doc_no ilike $Q or a.doc_ref ilike $Q or a.remark ilike $Q or a.product_code ilike $Q)";

/** ວັນ/ເວລາທີ່ອອກໃບ — ໃຊ້ນັບ "ຄ້າງມາ" */
const DOC_AT = "coalesce(a.create_date_time_now, a.doc_date::timestamp)";

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  doc_no: "a.doc_no",
  elapsed: "at_col",
  doc_ref: "a.doc_ref",
  product: "a.product_code",
  remark: "a.remark",
};

async function getDocs(tab: Tab, q: string, job: string, page: number, sort: string, dir: SortDir) {
  const params: (string | number)[] =
    tab === "pending"
      ? [TRANS.RETURN_REQUEST, LINE_STATUS.RETURN_REQUESTED, TRANS.RECEIVE_BACK]
      : [TRANS.RECEIVE_BACK];
  const where = [tab === "pending" ? PENDING_SQL : receivedSql("$1")];

  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$Q", `$${params.length}`)); }
  // ງານສ້ອມແປງ = job_type ວ່າງ · ງານຕິດຕັ້ງ = 'install'
  if (job === "install") where.push("a.job_type = 'install'");
  else if (job === "repair") where.push("coalesce(a.job_type,'') <> 'install'");
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "at_col";
  const orderBy = column === "at_col" ? `${DOC_AT} ${dir} nulls last` : `${column} ${dir} nulls last`;

  const rowsSql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.doc_ref,
      to_char(a.doc_ref_date::date,'DD-MM-YYYY') doc_ref_date, a.remark, a.product_code, a.job_type,
      greatest(0, round(extract(epoch from (localtimestamp - ${DOC_AT}))))::int elapsed_seconds
    from ic_trans a where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;
  const countSql = `select count(*)::int total from ic_trans a where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Doc>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts() {
  const sql = `select count(*) filter (where ${PENDING_SQL})::int pending,
      count(*) filter (where ${receivedSql("$3")})::int received
    from ic_trans a`;
  const row = (
    await query<{ pending: number; received: number }>(sql, [
      TRANS.RETURN_REQUEST,
      LINE_STATUS.RETURN_REQUESTED,
      TRANS.RECEIVE_BACK,
    ])
  ).rows[0];
  return { pending: row?.pending ?? 0, received: row?.received ?? 0 };
}

type Dict = Record<string, string>;

const columns = (t: Dict): { key: string; label: string; defaultDir: SortDir }[] => [
  { key: "doc_no", label: t.colDocNo, defaultDir: "desc" },
  { key: "elapsed", label: t.colWaited, defaultDir: "asc" },
  { key: "doc_ref", label: t.colRefNo, defaultDir: "desc" },
  { key: "product", label: t.colProductCode, defaultDir: "desc" },
  { key: "remark", label: t.colRemark, defaultDir: "asc" },
];

/** ປ້າຍປະເພດວຽກ */
function JobBadge({ jobType, t }: { jobType: string | null; t: Dict }) {
  const install = jobType === "install";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        install ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {install ? t.badgeInstall : t.badgeRepair}
    </span>
  );
}

export default async function ReceiveReturnsPage({ searchParams }: Props) {
  // ດຶງໃບຮັບຄືນທີ່ສາງຮັບໃນ ERP ກັບມາ ⇒ ໃບທີ່ຮັບແລ້ວຫຼຸດອອກຈາກຄິວເອງ (lib/erp-dispatch)
  await syncErpReturns();

  const t = (await getDictionary(await getLocale())).receiveReturns;

  const params = await searchParams;
  const tab: Tab = params.tab === "received" ? "received" : "pending";
  const q = (params.q ?? "").trim();
  const job = params.job === "install" || params.job === "repair" ? params.job : "";
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, docs] = await Promise.all([getCounts(), getDocs(tab, q, job, page, sort, dir)]);
  const pages = Math.max(1, Math.ceil(docs.total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "pending" && { tab }), ...(q && { q }), ...(job && { job }) });
  const tabHref = (target: Tab) =>
    `/stock/receive-returns?${new URLSearchParams({ ...(target !== "pending" && { tab: target }), ...(q && { q }), ...(job && { job }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/receive-returns?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/receive-returns?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Undo2; count: number }[] = [
    { key: "pending", label: t.tabPending, icon: Undo2, count: counts.pending },
    { key: "received", label: t.tabReceived, icon: PackageCheck, count: counts.received },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t.subtitle} · {docs.total.toLocaleString()} {t.items} · {t.page} {page}/{pages}
          </p>
        </div>
        <Todo className="h-9 px-3 text-xs">
          <FileBarChart className="size-4" />
          {t.report}
        </Todo>
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
                {count.toLocaleString()}
              </span>
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>

        <ReceiveFilters q={q} job={job} tab={tab} sort={sort} dir={dir} />
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns(t).map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.key === "doc_no" && tab === "pending" ? t.colReturnRequestNo : column.label}
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className="py-2.5"
                  />
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colStatus}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {docs.rows.map((doc) => {
                const install = doc.job_type === "install";
                const tone = elapsedTone(doc.elapsed_seconds);
                return (
                  <tr key={doc.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tab === "pending" ? tone.bar : ""}`} aria-hidden />
                      {doc.doc_no}
                      <span className="mt-0.5 block">
                        <JobBadge jobType={doc.job_type} t={t} />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed
                        seconds={doc.elapsed_seconds}
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                          tab === "pending" ? tone.chip : "bg-slate-100 text-slate-500"
                        }`}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-400">{doc.doc_date ?? "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {doc.doc_ref || "-"}
                      <span className="mt-0.5 block text-[10px] text-slate-400">{doc.doc_ref_date ?? "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{doc.product_code || "-"}</td>
                    <td className="max-w-72 truncate px-3 py-2.5" title={doc.remark ?? ""}>
                      {doc.remark || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          tab === "pending" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {tab === "pending" ? t.statusReturnRequest : t.statusReceived}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {tab === "pending" ? (
                        /* ງານຕິດຕັ້ງໄປໜ້າຂອງມັນເອງ (ods: /show_return_inst ຂອງ tech_install.py) */
                        <Link
                          href={
                            install
                              ? `/installations/spare-returns/receive/${encodeURIComponent(doc.doc_no)}`
                              : `/stock/receive-returns/${encodeURIComponent(doc.doc_no)}`
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <PackageCheck className="size-3.5" />
                          {t.receive}
                          <LinkPending className="size-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/stock/receive-returns/bill/${encodeURIComponent(doc.doc_no)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-white hover:bg-sky-600"
                        >
                          <Eye className="size-3.5" />
                          {t.view}
                          <LinkPending className="size-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {docs.total === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noResults}</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, docs.total)} {t.of} {docs.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              {t.prev}
            </Link>
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.next}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
