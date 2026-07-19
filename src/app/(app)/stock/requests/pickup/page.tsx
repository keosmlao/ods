import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { RowLink } from "@/components/row-link";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { ownJobsOnly } from "@/lib/scope";
import { TRANS } from "@/lib/stock-constants";
import { ChevronLeft, ChevronRight, PackageCheck, Search } from "lucide-react";
import Link from "next/link";

/**
 * ຊ່າງຮັບອາໄຫຼ່ (ວຽກສ້ອມ) — ຂັ້ນນີ້ມີແຕ່ໃນສາຍງານຕິດຕັ້ງ (/installations/spare-pickup)
 * ສ່ວນສາຍງານສ້ອມບໍ່ເຄີຍມີ ⇒ tb_used_spare.pick_finish ຂອງວຽກສ້ອມເປັນ null ທຸກແຖວ
 * ທັງທີ່ໜ້າ /repair ແລະ /repair/[code] ອ່ານມັນຢູ່ແລ້ວ. ບ່ອນນີ້ຄືຂັ້ນທີ່ຂາດໄປ.
 *
 * ວາງໄວ້ໃຕ້ /stock/requests ໂດຍເຈດຕະນາ — ກົດເກນສິດ (lib/roles) ຂອງ /stock/requests
 * ເປີດໃຫ້ ຊ່າງ + ສາງ + ຜູ້ຈັດການ ພໍດີກັບຄົນທີ່ຕ້ອງໃຊ້ໜ້ານີ້.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** trans_flag ຂອງໃບ "ຊ່າງຮັບອາໄຫຼ່" (PISP) — ຄືກັບ actions/stock.ts */
const TRANS_PICK = 166;

type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  doc_no: string;
  at_time: string | null;
  elapsed_seconds: number | null;
  code: string;
  customer: string | null;
  product: string | null;
  brand: string | null;
  issue: string | null;
  technician: string | null;
  lines: number;
};

const AT = "coalesce(ic.create_date_time_now, ic.doc_date)";

/**
 * ໃບເບີກ (SWC) ຂອງວຽກສ້ອມທີ່ຊ່າງຍັງບໍ່ທັນມາຮັບ.
 * job_type ເປັນ null = ວຽກສ້ອມ ('install' = ງານຕິດຕັ້ງ ເຊິ່ງມີໜ້າຂອງມັນເອງແລ້ວ).
 */
const WHERE = `ic.trans_flag = $1 and (ic.job_type is null or ic.job_type <> 'install')
  and p.status <> 6 and p.return_complete is null
  and not exists (select 1 from ic_trans t where t.trans_flag = $2 and t.doc_ref = ic.doc_no)
  and exists (select 1 from tb_used_spare s where s.product_code = ic.product_code and s.pick_finish is null)`;

const SEARCH = `(ic.doc_no ilike $Q or p.code ilike $Q or p.name_1 ilike $Q or p.sn ilike $Q
  or p.p_brand ilike $Q or p.emp_code ilike $Q or c.name_1 ilike $Q or c.tel ilike $Q
  or p.issue ilike $Q or p.issue_2 ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  doc_no: "ic.doc_no",
  elapsed: "at_col",
  code: "p.code",
  product: "p.name_1",
  brand: "p.p_brand",
  customer: "c.name_1",
  technician: "p.emp_code",
};

async function getWaiting(emp: string | null, q: string, page: number, sort: string, dir: SortDir) {
  const params: unknown[] = [TRANS.DISPATCH, TRANS_PICK];
  let where = WHERE;
  if (emp) {
    params.push(emp);
    where += ` and p.emp_code = $${params.length}`;
  }
  if (q) {
    params.push(`%${q}%`);
    where += ` and ${SEARCH.replaceAll("$Q", `$${params.length}`)}`;
  }

  const column = SORT_SQL[sort] ?? "at_col";
  // ຄ້າງດົນສຸດກ່ອນ = ໃບເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col" ? `${AT} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir} nulls last`;

  const from = `from ic_trans ic
    join tb_product p on p.code = ic.product_code
    left join ar_customer c on c.code = p.cust_code
    where ${where}`;

  const rowsSql = `select ic.doc_no,
      to_char(${AT},'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${AT}))))::int elapsed_seconds,
      p.code, concat_ws('-', c.name_1, c.tel) customer,
      concat_ws(' · ', p.name_1, p.sn) product, p.p_brand brand, coalesce(p.issue_2, p.issue) issue,
      p.emp_code technician,
      (select count(*) from ic_trans_detail d where d.doc_no = ic.doc_no and d.trans_flag = ic.trans_flag)::int lines
    ${from}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const [rows, count] = await Promise.all([
    query<Row>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(`select count(*)::int total ${from}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

type Dict = Record<string, string>;

const columns = (t: Dict): { key: string; label: string; defaultDir: SortDir }[] => [
  { key: "doc_no", label: t.colDocNo, defaultDir: "desc" },
  { key: "elapsed", label: t.colWaited, defaultDir: "desc" },
  { key: "code", label: t.colJobNo, defaultDir: "desc" },
  { key: "product", label: t.colProduct, defaultDir: "asc" },
  { key: "brand", label: t.colBrand, defaultDir: "asc" },
  { key: "customer", label: t.colCustomer, defaultDir: "asc" },
  { key: "technician", label: t.colTechnician, defaultDir: "asc" },
];

export default async function SparePickupPage({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).requestsPickup;

  const session = await getSession();
  // ຊ່າງເຫັນສະເພາະວຽກຂອງຕົນ — ຜູ້ຈັດການ/ສາງ ເຫັນທຸກໃບ
  const emp = ownJobsOnly(session);

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const list = await getWaiting(emp, q, page, sort, dir);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  const base = (): Record<string, string> => (q ? { q } : {});
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/requests/pickup?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/requests/pickup?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.subtitlePrefix} · {emp ? t.showOwnJobs : t.showAllJobs} ·{" "}
          {list.total.toLocaleString()} {t.bills} · {t.page} {page}/{pages}
        </p>
      </div>

      {/* ຄົ້ນຫາ */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="w-full text-xs outline-none"
          />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">{t.search}</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns(t).map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className="py-2.5"
                  />
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colIssue}</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">{t.colSpare}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                return (
                  <RowLink key={row.doc_no} href={`/service/${row.code}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      {row.doc_no}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed
                        seconds={row.elapsed_seconds}
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-400">{row.at_time ?? "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Link href={`/service/${row.code}`} className="font-medium text-[#0536a9] hover:underline">
                        {row.code}
                      </Link>
                    </td>
                    <td className="max-w-64 truncate px-3 py-2.5 font-medium text-slate-800" title={row.product ?? ""}>
                      {row.product ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.brand ?? "-"}</td>
                    <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>
                      {row.customer ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.technician ?? "-"}</td>
                    <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
                      {row.issue ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {row.lines}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <Link
                        href={`/stock/requests/pickup/${encodeURIComponent(row.doc_no)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                      >
                        <PackageCheck className="size-3.5" />
                        {t.receiveSpare}
                        <LinkPending className="size-3" />
                      </Link>
                    </td>
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        </div>

        {list.total === 0 && (
          <p className="py-12 text-center text-xs text-slate-400">{t.noResults}</p>
        )}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} {t.of}{" "}
            {list.total.toLocaleString()}
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
