import { LinkPending } from "@/components/link-pending";
import type { Option } from "@/components/select-field";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { queryOdg } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { Boxes, ChevronLeft, ChevronRight, PackageCheck, PackageX } from "lucide-react";
import Link from "next/link";
import { SpareFilters } from "./filters";

/**
 * ລາຍການອາໄຫຼ່ — ອ່ານ **ສົດຈາກ ERP (odg)** `ic_inventory where group_main='14'`.
 *
 * ແຕ່ກ່ອນອ່ານຈາກສຳເນົາໃນ ODS ທີ່ຕ້ອງກົດ "ດຶງລາຍການ" ຄືນເອງ (ຍອດ/ຊື່ຄ້າງ ແລະ ມີ
 * group_main=13 ປົນ ~5,500 ລາຍການ). ດຽວນີ້ດຶງກົງ ⇒ ຍອດ ແລະ ຊື່ກົງກັບ ERP ສະເໝີ.
 * ຍອດສາງໃຫຍ່ (1103) ດຶງຜ່ານ function sml_ic_function_stock_balance_warehouse_location.
 * ERP ອ່ານຢ່າງດຽວ (SCHEMA-CHANGES.md).
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** ກຸ່ມ "ອາໄຫຼ່" ໃນ ERP */
const GROUP_MAIN = "14";

/** ຍອດຄົງເຫຼືອສາງໃຫຍ່ 1103 — ບອກໄວ້ເມື່ອຕ່າງຈາກຍອດລວມ */
const WH_QTY_SQL = `coalesce((select round(balance_qty,2) from sml_ic_function_stock_balance_warehouse_location('2099-12-31', i.code, '1103', '') limit 1),0)::float8`;

type Tab = "all" | "in" | "out";
type Props = {
  searchParams: Promise<{ tab?: string; q?: string; brand?: string; product?: string; page?: string; sort?: string; dir?: string }>;
};

type Spare = {
  code: string;
  name_1: string | null;
  name_2: string | null;
  unit_code: string | null;
  item_brand: string | null;
  balance_qty: number;
  wh_qty: number;
};

/** ຄົ້ນຫາ — ລະຫັດ, ຊື່ (ລາວ/ໄທ) */
const SEARCH = "(i.code ilike $Q or i.name_1 ilike $Q or i.name_2 ilike $Q)";

/** ຖັງ: ມີໃນສາງ / ໝົດສາງ (balance_qty ວ່າງ = ບໍ່ມີ) */
const BUCKET: Record<Tab, string> = {
  all: "true",
  in: "coalesce(i.balance_qty,0) > 0",
  out: "coalesce(i.balance_qty,0) <= 0",
};

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "i.code",
  name: "i.name_1",
  brand: "i.item_brand",
  balance: "coalesce(i.balance_qty,0)",
  unit: "i.unit_standard",
};

/**
 * ຄົ້ນຫາອາໄຫຼ່ດ້ວຍ **ຮຸ່ນສິນຄ້າ** — ຄືນເປັນລະຫັດອາໄຫຼ່ ເພື່ອເອົາໄປກັ່ນຕອງລາຍການ.
 *
 * ຜູກອາໄຫຼ່↔ສິນຄ້າຢູ່ odg_product_spare_mapping ຂອງ ERP (odg) ແລະ ລະຫັດສິນຄ້າ (120101-*)
 * ບໍ່ມີໃນ ic_inventory ຂອງ ODS ⇒ join ຢູ່ SQL ຂ້າມຖານຂໍ້ມູນບໍ່ໄດ້ ຈຶ່ງຖາມ ERP ກ່ອນ
 * ແລ້ວຈຶ່ງເອົາລະຫັດທີ່ໄດ້ໄປໃສ່ `code = any(...)` ຢູ່ຄຳຖາມຂອງ ODS.
 * ບໍ່ພົບສິນຄ້າ = ຄືນ array ວ່າງ ⇒ ລາຍການວ່າງ (ບໍ່ແມ່ນ "ບໍ່ກັ່ນຕອງ").
 */
async function getSpareCodesByProduct(product: string) {
  // ຮຸ່ນຢູ່ item_model, ຊື່ຢູ່ name_1/name_2 ຂອງ ic_inventory (ERP)
  const sql = `select distinct m.spare_code
    from odg_product_spare_mapping m
    left join ic_inventory p on p.code = m.product_code
    where m.product_code ilike $1 or p.name_1 ilike $1 or p.name_2 ilike $1 or p.item_model ilike $1`;
  return (await queryOdg<{ spare_code: string }>(sql, [`%${product}%`])).rows.map((row) => row.spare_code);
}

/** ເງື່ອນໄຂຮ່ວມຂອງທັງລາຍການ ແລະ ຫົວແທັບ — ຮັກສາໃຫ້ຄືກັນ ຈຶ່ງນັບກົງກັບທີ່ເຫັນ */
function filterFor(q: string, brand: string, codes: string[] | null) {
  const where: string[] = [`i.group_main = '${GROUP_MAIN}'`];
  const params: (string | number | string[])[] = [];
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$Q", `$${params.length}`)); }
  if (brand) { params.push(brand); where.push(`i.item_brand = $${params.length}`); }
  if (codes) { params.push(codes); where.push(`i.code = any($${params.length})`); }
  return { where, params };
}

async function getSpares(tab: Tab, q: string, brand: string, codes: string[] | null, page: number, sort: string, dir: SortDir) {
  const { where: conditions, params } = filterFor(q, brand, codes);
  const where = [BUCKET[tab], ...conditions];
  const filter = where.join(" and ");

  const orderBy = `${SORT_SQL[sort] ?? "i.code"} ${dir === "asc" ? "asc" : "desc"} nulls last`;

  // ຍອດສາງໃຫຍ່ຄິດສະເພາະ 20 ແຖວທີ່ສະແດງ (subquery ໃນ select) ຈຶ່ງໄວ ເຖິງລາຍການໃຫຍ່
  const rowsSql = `select i.code, i.name_1, i.name_2, i.unit_standard unit_code, i.item_brand,
      coalesce(i.balance_qty,0)::float8 balance_qty, ${WH_QTY_SQL} wh_qty
    from ic_inventory i where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;
  const countSql = `select count(*)::int total from ic_inventory i where ${filter}`;

  const [rows, count] = await Promise.all([
    queryOdg<Spare>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    queryOdg<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ນັບຢູ່ DB ຈຶ່ງນັບໄດ້ທັງໝົດ ບໍ່ແມ່ນແຕ່ໜ້າປັດຈຸບັນ */
async function getCounts(q: string, brand: string, codes: string[] | null) {
  const { where, params } = filterFor(q, brand, codes);
  const filter = where.join(" and ");

  const sql = `select count(*)::int all_n,
      count(*) filter (where ${BUCKET.in})::int in_n,
      count(*) filter (where ${BUCKET.out})::int out_n
    from ic_inventory i where ${filter}`;
  const row = (await queryOdg<{ all_n: number; in_n: number; out_n: number }>(sql, params)).rows[0];
  return { all: row?.all_n ?? 0, in: row?.in_n ?? 0, out: row?.out_n ?? 0 };
}

/** ຫຍີ່ຫໍ້ທັງໝົດຂອງກຸ່ມອາໄຫຼ່ — ໃສ່ dropdown ຄົ້ນຫາ */
async function getBrands(): Promise<Option[]> {
  const sql = `select distinct item_brand from ic_inventory
    where group_main = '${GROUP_MAIN}' and item_brand is not null and item_brand <> '' order by item_brand`;
  return (await queryOdg<{ item_brand: string }>(sql)).rows.map((row) => ({ value: row.item_brand, label: row.item_brand }));
}

type Dict = Record<string, string>;

const columns = (t: Dict): { key: string; label: string; defaultDir: SortDir }[] => [
  { key: "code", label: t.colCode, defaultDir: "asc" },
  { key: "name", label: t.items, defaultDir: "asc" },
  { key: "brand", label: t.colBrand, defaultDir: "asc" },
  { key: "balance", label: t.colBalance, defaultDir: "desc" },
  { key: "unit", label: t.colUnit, defaultDir: "asc" },
];

export default async function SparePartsPage({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).sparePartsPage;
  const params = await searchParams;
  const tab: Tab = params.tab === "in" ? "in" : params.tab === "out" ? "out" : "all";
  const q = (params.q ?? "").trim();
  const brand = (params.brand ?? "").trim();
  const product = (params.product ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const sort = (params.sort ?? "code").trim();
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";

  // ຮຸ່ນສິນຄ້າຢູ່ອີກຖານຂໍ້ມູນ ⇒ ຫາລະຫັດອາໄຫຼ່ກ່ອນ ແລ້ວຈຶ່ງກັ່ນຕອງລາຍການດ້ວຍລະຫັດນັ້ນ
  const codes = product ? await getSpareCodesByProduct(product) : null;

  const [counts, spares, brands] = await Promise.all([
    getCounts(q, brand, codes),
    getSpares(tab, q, brand, codes, page, sort, dir),
    getBrands(),
  ]);
  const pages = Math.max(1, Math.ceil(spares.total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "all" && { tab }), ...(q && { q }), ...(brand && { brand }), ...(product && { product }) });
  const tabHref = (target: Tab) =>
    `/stock/spare-parts?${new URLSearchParams({ ...(target !== "all" && { tab: target }), ...(q && { q }), ...(brand && { brand }), ...(product && { product }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/spare-parts?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/spare-parts?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Boxes; count: number }[] = [
    { key: "all", label: t.tabAll, icon: Boxes, count: counts.all },
    { key: "in", label: t.tabInStock, icon: PackageCheck, count: counts.in },
    { key: "out", label: t.tabOutOfStock, icon: PackageX, count: counts.out },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {spares.total.toLocaleString()} {t.items} · {t.page} {page}/{pages}
          </p>
        </div>
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

        <SpareFilters q={q} brand={brand} product={product} brands={brands} tab={tab} sort={sort} dir={dir} />
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
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
              </tr>
            </thead>
            <tbody>
              {spares.rows.map((spare) => {
                const inStock = spare.balance_qty > 0;
                return (
                  <tr key={spare.code} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Link href={`/stock/spare-parts/${encodeURIComponent(spare.code)}`} className="font-bold text-[#0536a9] hover:underline">
                        {spare.code}
                        <LinkPending className="ml-1 inline size-3" />
                      </Link>
                    </td>
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
                        <span className="ml-1 text-[10px] text-slate-400">{t.unitMain} {spare.wh_qty.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{spare.unit_code || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {spares.total === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noResults}</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, spares.total)} {t.of} {spares.total.toLocaleString()}
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
