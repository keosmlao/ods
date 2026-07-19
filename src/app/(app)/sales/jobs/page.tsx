import { RowLink } from "@/components/row-link";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { DONE_JOBS, OPEN_JOBS, STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

/**
 * ຕິດຕາມງານສ້ອມ ຂອງພະນັກງານຂາຍ — ອ່ານຢ່າງດຽວ.
 */
export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

type Row = {
  code: string;
  name_1: string | null;
  sn: string | null;
  p_brand: string | null;
  custname: string;
  tel: string;
  province: string;
  city: string;
  opened: string;
  stage_label: string;
  stage: number;
};

type Props = { searchParams: Promise<{ q?: string; tab?: string; page?: string }> };

export default async function SalesJobsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = (await getDictionary(await getLocale())).salesJobs;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const done = params.tab === "done";
  const page = Math.max(1, Number(params.page) || 1);

  const where: string[] = [done ? DONE_JOBS : OPEN_JOBS];
  const args: (string | number)[] = [];
  if (q) {
    args.push(`%${q}%`);
    where.push(
      `(a.code ilike $${args.length} or a.name_1 ilike $${args.length} or a.sn ilike $${args.length} or b.name_1 ilike $${args.length})`,
    );
  }
  const filter = where.join(" and ");

  const [list, count] = await Promise.all([
    query<Row>(
      `select a.code, a.name_1, a.sn, a.p_brand,
         coalesce(b.name_1,'') custname, coalesce(b.tel,'') tel,
         coalesce(p.name_1,'') province, coalesce(c.name_1,'') city,
         coalesce(to_char(a.time_register,'dd-mm-yyyy'),'') opened,
         (${STAGE_LABEL_SQL}) stage_label, (${STAGE_SQL}) stage
       from tb_product a
       join ar_customer b on b.code = a.cust_code
       left join province p on p.code = b.provine
       left join city c on c.code = b.city and c.province = b.provine
       where ${filter}
       order by a.time_register desc nulls last, a.code desc
       limit $${args.length + 1} offset $${args.length + 2}`,
      [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total from tb_product a join ar_customer b on b.code = a.cust_code where ${filter}`, args),
  ]);

  const total = count.rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tabHref = (tab: string) => `/sales/jobs?${new URLSearchParams({ ...(q && { q }), ...(tab !== "open" && { tab }) })}`;
  const pageHref = (n: number) =>
    `/sales/jobs?${new URLSearchParams({ ...(q && { q }), ...(done && { tab: "done" }), ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.customerRepairs} · {total.toLocaleString()} {t.items} · {t.page} {page}/{pages}
        </p>
      </div>

      {/* ແທັບ + ຄົ້ນຫາ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          <Link
            href={tabHref("open")}
            className={`inline-flex h-9 items-center px-3 text-xs font-medium ${!done ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {t.tabOpen}
          </Link>
          <Link
            href={tabHref("done")}
            className={`inline-flex h-9 items-center border-l border-slate-300 px-3 text-xs font-medium ${done ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {t.tabDone}
          </Link>
        </div>

        <form className="flex flex-1 items-center gap-2" action="/sales/jobs">
          {done && <input type="hidden" name="tab" value="done" />}
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
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colCode}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colCustomer}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colTel}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colDevice}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colArea}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colReceivedAt}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colStatus}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <RowLink key={row.code} href={`/service/${row.code}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                    <Link href={`/service/${row.code}`} className="hover:underline">
                      {row.code}
                    </Link>
                  </td>
                  <td className="max-w-44 truncate px-3 py-2.5 text-slate-800" title={row.custname}>
                    {row.custname || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.tel || "-"}</td>
                  <td className="max-w-64 px-3 py-2.5">
                    <span className="block truncate">{[row.name_1, row.p_brand].filter(Boolean).join(" · ") || "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                    {[row.city, row.province].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.opened || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{row.stage_label}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Link
                      href={`/service/${row.code}`}
                      className="inline-flex h-8 items-center rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      {t.view}
                    </Link>
                  </td>
                </RowLink>
              ))}
            </tbody>
          </table>
        </div>

        {list.rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noResults}</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.of} {total.toLocaleString()}
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
