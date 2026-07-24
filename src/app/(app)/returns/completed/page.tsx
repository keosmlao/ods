import { MobileCardList } from "@/components/mobile-card-list";
import { RowLink } from "@/components/row-link";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { CheckCircle2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";

/**
 * ລາຍการສົ່ງຄືນ **ສຳເລັດ** — ເຄື່ອງທີ່ສົ່ງຄືນລູກຄ້າແລ້ວ (tb_product.return_complete ≠ null).
 *
 * ຕາມທີ່ຂໍ: ຄັ້ງລະ 20 ແຖວ · ຄົ້ນຫາ = ສະແດງ 5 ແຖວ · ກອງດ້ວຍ **ວັນທີສຳເລັດ** (ຈາກ–ຫາ).
 */

type Props = { searchParams: Promise<{ q?: string; page?: string; from?: string; to?: string }> };

type Row = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  completed_at: string | null;
  emp_code: string | null;
};

const SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.emp_code ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q)`;

const isDate = (value: string | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

async function getRows(q: string, from: string | null, to: string | null, page: number, size: number) {
  const where = ["a.return_complete is not null"];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  if (from) {
    params.push(from);
    where.push(`a.return_complete >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    // ຮວມທັງມື້ "ຫາ" ⇒ ນ້ອຍກວ່າ ວັນຖັດໄປ
    where.push(`a.return_complete < ($${params.length}::date + 1)`);
  }
  const filter = where.join(" and ");

  const rowsSql = `select a.code,
      concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
      a.warrunty warranty, to_char(a.return_complete,'DD-MM-YYYY HH24:MI') completed_at, a.emp_code
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${filter}
    order by a.return_complete desc
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Row>(rowsSql, [...params, size, (page - 1) * size]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

export default async function CompletedReturnsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const from = isDate(params.from) ? params.from : null;
  const to = isDate(params.to) ? params.to : null;
  const page = Math.max(1, Number(params.page) || 1);
  const t = (await getDictionary(await getLocale())).returnsList;

  // ຄັ້ງລະ 20 · ຄົ້ນຫາ (ຫຼືກອງວັນທີ) = 5
  const size = q || from || to ? 5 : 20;

  const { rows, total } = await getRows(q, from, to, page, size);
  const pages = Math.max(1, Math.ceil(total / size));

  const base = () => ({ ...(q && { q }), ...(from && { from }), ...(to && { to }) });
  const pageHref = (n: number) =>
    `/returns/completed?${new URLSearchParams({ ...base(), ...(n > 1 && { page: String(n) }) })}`;

  const inWarranty = (w: string | null) => w === "ຮັບປະກັນ";

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ລາຍການສົ່ງຄືນສຳເລັດ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {total.toLocaleString()} {t.items} · {t.page} {page}/{pages}
        </p>
      </div>

      {/* ຄົ້ນຫາ + ກອງວັນທີສຳເລັດ (ຈາກ–ຫາ) */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex h-9 min-w-52 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholderJob}
            className="w-full text-xs outline-none"
          />
        </div>
        <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-500">
          <span className="whitespace-nowrap">ວັນທີສຳເລັດ</span>
          <input name="from" type="date" defaultValue={from ?? ""} className="text-xs outline-none" />
          <span className="text-slate-400">–</span>
          <input name="to" type="date" defaultValue={to ?? ""} className="text-xs outline-none" />
        </label>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">{t.search}</button>
        {(q || from || to) && (
          <Link
            href="/returns/completed"
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            ລ້າງ
          </Link>
        )}
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ຕາຕະລາງ (desktop) */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2.5 font-semibold">{t.colCode}</th>
                <th className="px-3 py-2.5 font-semibold">ວັນທີສຳເລັດ</th>
                <th className="px-3 py-2.5 font-semibold">{t.colItemSn}</th>
                <th className="px-3 py-2.5 font-semibold">{t.brand}</th>
                <th className="px-3 py-2.5 font-semibold">{t.customer}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colWarranty}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colTechnician}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RowLink key={row.code} href={`/service/${row.code}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                    <Link href={`/service/${row.code}`} className="hover:underline">{row.code}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      {row.completed_at || "-"}
                    </span>
                  </td>
                  <td className="max-w-64 px-3 py-2.5">
                    <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                      {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.brand || "-"}</td>
                  <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>{row.customer || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${inWarranty(row.warranty) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {row.warranty || "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.emp_code || "-"}</td>
                </RowLink>
              ))}
            </tbody>
          </table>
        </div>

        {/* ບັດ (mobile) */}
        <div className="p-2 md:hidden">
          <MobileCardList className="space-y-2">
            {rows.map((row) => (
              <div key={row.code} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/service/${row.code}`} className="font-bold text-[#0536a9] hover:underline">{row.code}</Link>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3" />
                    {row.completed_at || "-"}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-slate-800" title={row.product ?? ""}>
                  {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                </p>
                <p className="truncate text-[11px] text-slate-400">SN: {row.sn || "-"} · {t.brand}: {row.brand || "-"}</p>
                <p className="mt-0.5 truncate text-xs text-slate-600" title={row.customer ?? ""}>{t.customer}: {row.customer || "-"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${inWarranty(row.warranty) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {row.warranty || "-"}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{t.techShort}: {row.emp_code || "-"}</span>
                </div>
              </div>
            ))}
          </MobileCardList>
        </div>

        {total === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noResults}</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * size + 1}–{Math.min(page * size, total)} {t.of} {total.toLocaleString()}
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
            <span className="px-3 font-medium text-slate-700">{page} / {pages}</span>
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
