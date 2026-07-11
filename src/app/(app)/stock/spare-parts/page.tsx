import { LinkPending } from "@/components/link-pending";
import type { Option } from "@/components/select-field";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { Boxes, ChevronLeft, ChevronRight, PackageCheck, PackageX } from "lucide-react";
import Link from "next/link";
import { SpareFilters } from "./filters";
import { LoadSparePartsButton } from "./load-button";

/** ods: spare_part.py /home_spare + /loadspa + templates/sparepart/index.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "all" | "in" | "out";
type Props = { searchParams: Promise<{ tab?: string; q?: string; brand?: string; page?: string; sort?: string; dir?: string }> };

type Spare = {
  code: string;
  name_1: string | null;
  name_2: string | null;
  part_number: string | null;
  unit_code: string | null;
  item_brand: string | null;
  balance_qty: number;
  wh_qty: number;
};

/** ຄົ້ນຫາ — ລະຫັດ, ຊື່ (ລາວ/ອັງກິດ), Part-Number */
const SEARCH = "(code ilike $Q or name_1 ilike $Q or name_2 ilike $Q or part_number ilike $Q)";

/** ຖັງ: ມີໃນສາງ / ໝົດສາງ (balance_qty ວ່າງ = ບໍ່ມີ) */
const BUCKET: Record<Tab, string> = {
  all: "true",
  in: "coalesce(balance_qty,0) > 0",
  out: "coalesce(balance_qty,0) <= 0",
};

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "code",
  name: "name_1",
  part: "part_number",
  brand: "item_brand",
  balance: "coalesce(balance_qty,0)",
  unit: "unit_code",
};

async function getSpares(tab: Tab, q: string, brand: string, page: number, sort: string, dir: SortDir) {
  const where = [BUCKET[tab]];
  const params: (string | number)[] = [];
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$Q", `$${params.length}`)); }
  if (brand) { params.push(brand); where.push(`item_brand = $${params.length}`); }
  const filter = where.join(" and ");

  const orderBy = `${SORT_SQL[sort] ?? "code"} ${dir === "asc" ? "asc" : "desc"} nulls last`;

  // ods ດຶງແຕ່ 20 ແຖວທຳອິດໂດຍບໍ່ບອກຈຳນວນທັງໝົດ ແລະ ບໍ່ມີໜ້າຕໍ່ໄປ — ຢູ່ນີ້ແບ່ງໜ້າຢູ່ຝັ່ງ DB
  const rowsSql = `select code, name_1, name_2, part_number, unit_code, item_brand,
      coalesce(balance_qty,0)::float8 balance_qty, coalesce(wh_qty,0)::float8 wh_qty
    from ic_inventory where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;
  const countSql = `select count(*)::int total from ic_inventory where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Spare>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ນັບຢູ່ DB ຈຶ່ງນັບໄດ້ທັງໝົດ ບໍ່ແມ່ນແຕ່ໜ້າປັດຈຸບັນ */
async function getCounts(q: string, brand: string) {
  const where: string[] = [];
  const params: string[] = [];
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$Q", `$${params.length}`)); }
  if (brand) { params.push(brand); where.push(`item_brand = $${params.length}`); }
  const filter = where.length ? where.join(" and ") : "true";

  const sql = `select count(*)::int all_n,
      count(*) filter (where ${BUCKET.in})::int in_n,
      count(*) filter (where ${BUCKET.out})::int out_n
    from ic_inventory where ${filter}`;
  const row = (await query<{ all_n: number; in_n: number; out_n: number }>(sql, params)).rows[0];
  return { all: row?.all_n ?? 0, in: row?.in_n ?? 0, out: row?.out_n ?? 0 };
}

/** ຫຍີ່ຫໍ້ທັງໝົດ — ໃສ່ dropdown ຄົ້ນຫາ */
async function getBrands(): Promise<Option[]> {
  const sql = `select distinct item_brand from ic_inventory where item_brand is not null and item_brand <> '' order by item_brand`;
  return (await query<{ item_brand: string }>(sql)).rows.map((row) => ({ value: row.item_brand, label: row.item_brand }));
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ລະຫັດ", defaultDir: "asc" },
  { key: "name", label: "ລາຍການ", defaultDir: "asc" },
  { key: "part", label: "Part-Number", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "balance", label: "ຄົງເຫຼືອ", defaultDir: "desc" },
  { key: "unit", label: "ຫົວໜ່ວຍ", defaultDir: "asc" },
];

export default async function SparePartsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "in" ? "in" : params.tab === "out" ? "out" : "all";
  const q = (params.q ?? "").trim();
  const brand = (params.brand ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const sort = (params.sort ?? "code").trim();
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";

  const [counts, spares, brands] = await Promise.all([getCounts(q, brand), getSpares(tab, q, brand, page, sort, dir), getBrands()]);
  const pages = Math.max(1, Math.ceil(spares.total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "all" && { tab }), ...(q && { q }), ...(brand && { brand }) });
  const tabHref = (target: Tab) =>
    `/stock/spare-parts?${new URLSearchParams({ ...(target !== "all" && { tab: target }), ...(q && { q }), ...(brand && { brand }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/spare-parts?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/spare-parts?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Boxes; count: number }[] = [
    { key: "all", label: "ທັງໝົດ", icon: Boxes, count: counts.all },
    { key: "in", label: "ມີໃນສາງ", icon: PackageCheck, count: counts.in },
    { key: "out", label: "ໝົດສາງ", icon: PackageX, count: counts.out },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ລາຍການອາໄຫຼ່</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {spares.total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
        <LoadSparePartsButton />
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

        <SpareFilters q={q} brand={brand} brands={brands} tab={tab} sort={sort} dir={dir} />
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {COLUMNS.map((column) => (
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
              </tr>
            </thead>
            <tbody>
              {spares.rows.map((spare) => {
                const inStock = spare.balance_qty > 0;
                return (
                  <tr key={spare.code} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{spare.code}</td>
                    <td className="max-w-96 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={spare.name_1 ?? ""}>
                        {spare.name_1 || "-"}
                      </span>
                      {spare.name_2 && (
                        <span className="block truncate text-[10px] text-slate-400" title={spare.name_2}>
                          {spare.name_2}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{spare.part_number || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{spare.item_brand || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                          inStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {spare.balance_qty.toLocaleString()}
                      </span>
                      {/* wh_qty = ຄົງເຫຼືອຂອງສາງໃຫຍ່ (1103) — ບອກໄວ້ເມື່ອຕ່າງຈາກຍອດລວມ */}
                      {spare.wh_qty !== spare.balance_qty && (
                        <span className="ml-1 text-[10px] text-slate-400">ສາງໃຫຍ່ {spare.wh_qty.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{spare.unit_code || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {spares.total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, spares.total)} ຈາກ {spares.total.toLocaleString()}
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
