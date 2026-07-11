import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { Todo } from "@/components/ui";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { CANCELLED_JOBS, DONE_JOBS, OPEN_JOBS, STAGE_LABEL, STAGE_SQL } from "@/lib/stage";
import { CheckCircle2, ChevronLeft, ChevronRight, FileBarChart, Search, Wrench, X } from "lucide-react";
import Link from "next/link";

/** ods: stock.py /home_stock + templates/stock/index.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "open" | "done" | "cancelled";
type Props = { searchParams: Promise<{ tab?: string; q?: string; code?: string; page?: string; sort?: string; dir?: string }> };

type Product = {
  code: string;
  name_1: string | null;
  p_model: string | null;
  sn: string | null;
  issue: string | null;
  customer: string | null;
  stage: number;
  at_time: string | null;
  elapsed_seconds: number | null;
};

type Movement = { rnum: number; date_t: string | null; time_t: string | null; trans: string; code: string };

const CUSTOMER = "left join ar_customer b on b.code = a.cust_code";
const SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_model ilike $Q
  or a.p_brand ilike $Q or a.issue ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q)`;

/**
 * ຖັງງານ — ໃຊ້ເງື່ອນໄຂກາງຂອງ lib/stage.ts (ລວມກັນແລ້ວໄດ້ທຸກແຖວຂອງ tb_product ພໍດີ).
 *
 * ods ຄິດສະຖານະດ້ວຍ case ຂອງມັນເອງ (status = 1..5 + qt_start) ເຊິ່ງບໍ່ຄົບຂັ້ນ:
 * ບໍ່ຮູ້ຈັກ "ກຳລັງສ້ອມແປງ" / "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" / "ຍົກເລີກ" ແລະ ຕົກໄປ 'ຈັດສົ່ງສຳເລັດ' ໝົດ.
 * ຢູ່ນີ້ໃຊ້ STAGE_SQL ອັນດຽວກັບໜ້າອື່ນ ຈຶ່ງບໍ່ມີໃບໃດຕົກຫຼົ່ນ ຫຼື ຕິດປ້າຍຜິດ.
 */
const BUCKET: Record<Tab, string> = { open: OPEN_JOBS, done: DONE_JOBS, cancelled: CANCELLED_JOBS };

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "a.code",
  product: "a.name_1",
  sn: "a.sn",
  customer: "b.name_1",
  stage: `(${STAGE_SQL})`,
  elapsed: "a.time_register",
};

/** ສີຂອງແຕ່ລະຂັ້ນ */
const STAGE_TONE: Record<number, string> = {
  [-1]: "bg-slate-100 text-slate-500",
  1: "bg-red-50 text-red-700",
  2: "bg-blue-50 text-blue-700",
  3: "bg-violet-50 text-violet-700",
  4: "bg-violet-50 text-violet-700",
  5: "bg-amber-50 text-amber-700",
  6: "bg-amber-50 text-amber-700",
  7: "bg-orange-50 text-orange-700",
  8: "bg-teal-50 text-teal-700",
  9: "bg-indigo-50 text-indigo-700",
  10: "bg-fuchsia-50 text-fuchsia-700",
  11: "bg-emerald-50 text-emerald-700",
};

async function getProducts(tab: Tab, q: string, page: number, sort: string, dir: SortDir) {
  const where = [BUCKET[tab]];
  const params: (string | number)[] = [];
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$Q", `$${params.length}`)); }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "a.time_register";
  // "ຄ້າງມາ" ດົນສຸດກ່ອນ = ເວລາຮັບເຄື່ອງເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "a.time_register"
      ? `a.time_register ${dir === "desc" ? "asc" : "desc"} nulls last`
      : `${column} ${dir === "asc" ? "asc" : "desc"} nulls last`;

  // ods ດຶງທຸກແຖວຂອງ tb_product (5,000+) ມາໃສ່ໜ້າດຽວ — ຢູ່ນີ້ແບ່ງໜ້າຢູ່ຝັ່ງ DB
  const rowsSql = `select a.code, a.name_1, a.p_model, a.sn, a.issue,
      concat_ws('-', b.name_1, b.tel) customer, (${STAGE_SQL})::int stage,
      to_char(a.time_register,'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds
    from tb_product a ${CUSTOMER}
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;
  const countSql = `select count(*)::int total from tb_product a ${CUSTOMER} where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Product>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts(q: string) {
  const params: string[] = [];
  let search = "true";
  if (q) { params.push(`%${q}%`); search = SEARCH.replaceAll("$Q", "$1"); }

  const sql = `select count(*) filter (where ${BUCKET.open})::int open_n,
      count(*) filter (where ${BUCKET.done})::int done_n,
      count(*) filter (where ${BUCKET.cancelled})::int cancelled_n
    from tb_product a ${CUSTOMER} where ${search}`;
  const row = (await query<{ open_n: number; done_n: number; cancelled_n: number }>(sql, params)).rows[0];
  return { open: row?.open_n ?? 0, done: row?.done_n ?? 0, cancelled: row?.cancelled_n ?? 0 };
}

/**
 * ໄທມ໌ໄລນ໌ຂອງເຄື່ອງໜຶ່ງໜ່ວຍ.
 * ods ສ້າງ union ຂອງທຸກຂັ້ນຈາກ tb_product ທັງຕາຕະລາງ ແລ້ວຈຶ່ງກັ່ນເອົາລະຫັດດຽວຢູ່ຊັ້ນນອກ
 * → ສະແກນ tb_product 10 ຮອບ. ຢູ່ນີ້ຍັດເງື່ອນໄຂ code ເຂົ້າໄປໃນທຸກກິ່ງເລີຍ.
 */
async function getMovements(code: string) {
  const stages: [string, string][] = [
    ["time_register", "ຮັບເຄື່ອງເຊົ້າສ້ອມ"],
    ["time_check", "ເລີ່ມກວດເຊັກເຄື່ອງ"],
    ["time_finish_check", "ເຊັກເຄື່ອງສຳເລັດ"],
    ["qt_start", "ເລີ່ມສະເໜີລາຄາ"],
    ["qt_finish", "ສະເໜີລາຄາສຳເລັດ"],
    ["spare_reg", "ເລີ່ມເບີກອາໄລ່"],
    ["spare_finish", "ເບີກສຳເລັດ"],
    ["time_repair", "ເລີ່ມສ້ອມແປງ"],
    ["time_finish_repair", "ສ້ອມແປງສຳເລັດ"],
    ["return_complete", "ສົ່ງເຄື່ອງລູກຄ້າ"],
  ];
  const union = stages
    .map(
      ([column, label]) =>
        `select code, to_char(${column},'DD-MM-YYYY') date_t, to_char(${column},'HH24:MI') time_t,
           '${label}' trans, ${column} sort_at
         from tb_product where code = $1 and ${column} is not null`,
    )
    .join(" union all ");

  const sql = `select row_number() over (order by a.sort_at)::int rnum, a.date_t, a.time_t, a.trans, a.code
    from (${union}) a order by a.sort_at`;
  return (await query<Movement>(sql, [code])).rows;
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ລະຫັດ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ", defaultDir: "asc" },
  { key: "sn", label: "ໝາຍເລກເຄື່ອງ", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "stage", label: "ສະຖານະ", defaultDir: "asc" },
];

export default async function StockProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "done" ? "done" : params.tab === "cancelled" ? "cancelled" : "open";
  const q = (params.q ?? "").trim();
  const code = (params.code ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, products, movements] = await Promise.all([
    getCounts(q),
    getProducts(tab, q, page, sort, dir),
    code ? getMovements(code) : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(products.total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "open" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/stock/products?${new URLSearchParams({ ...(target !== "open" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/products?${new URLSearchParams({ ...base(), sort: key, dir: nextDir, ...(code && { code }) })}`;
  const pageHref = (n: number) =>
    `/stock/products?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;
  const rowHref = (target: string) =>
    `/stock/products?${new URLSearchParams({
      ...base(),
      sort,
      dir,
      ...(page > 1 && { page: String(page) }),
      ...(target !== code && { code: target }),
    })}`;

  const TABS: { key: Tab; label: string; icon: typeof Wrench; count: number }[] = [
    { key: "open", label: "ຢູ່ໃນສາງ", icon: Wrench, count: counts.open },
    { key: "done", label: "ສົ່ງຄືນສຳເລັດ", icon: CheckCircle2, count: counts.done },
    { key: "cancelled", label: "ຍົກເລີກ", icon: X, count: counts.cancelled },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ການເຄື່ອນໃຫວສາງສິນຄ້າ</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ສິນຄ້າສ້ອມແປງ · {products.total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Todo className="h-9 px-3 text-xs">
            <FileBarChart className="size-4" />
            ລາຍງານເຄື່ອງສ້ອມແປງຄົງເຫຼືອ
          </Todo>
          <Todo className="h-9 px-3 text-xs">
            <FileBarChart className="size-4" />
            ລາຍງານການເຄື່ອງໃຫວ
          </Todo>
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

        <form className="flex flex-1 items-center gap-2">
          {tab !== "open" && <input type="hidden" name="tab" value={tab} />}
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ຄົ້ນຫາ ລະຫັດ, SN, ລາຍການ, ລູກຄ້າ, ອາການ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການເພ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {products.rows.map((product) => {
                const tone = elapsedTone(product.elapsed_seconds);
                const selected = product.code === code;
                return (
                  <tr
                    key={product.code}
                    className={`border-b border-slate-100 ${selected ? "bg-teal-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      <Link href={`/service/${product.code}`} className="hover:underline">
                        {product.code}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed
                        seconds={product.elapsed_seconds}
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-400">{product.at_time ?? "-"}</span>
                    </td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={product.name_1 ?? ""}>
                        {product.name_1 || "-"} {product.p_model && <span className="text-slate-400">{product.p_model}</span>}
                      </span>
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5" title={product.sn ?? ""}>
                      {product.sn || "-"}
                    </td>
                    <td className="max-w-44 truncate px-3 py-2.5" title={product.customer ?? ""}>
                      {product.customer || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          STAGE_TONE[product.stage] ?? "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {STAGE_LABEL[product.stage] ?? "-"}
                      </span>
                    </td>
                    <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={product.issue ?? ""}>
                      {product.issue || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <Link
                        href={rowHref(product.code)}
                        scroll={false}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
                          selected
                            ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            : "bg-sky-500 text-white hover:bg-sky-600"
                        }`}
                      >
                        {selected ? "ປິດ" : "ລາຍລະອຽດ"}
                        <LinkPending className="size-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {products.total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, products.total)} ຈາກ{" "}
            {products.total.toLocaleString()}
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

      {/* ລາຍການເຄື່ອນໃຫວຂອງເຄື່ອງທີ່ເລືອກ */}
      {code && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
            <h2 className="text-xs font-bold text-slate-700">ລາຍການເຄື່ອນໃຫວ — {code}</h2>
            <Link
              href={`/stock/products?${new URLSearchParams({ ...base(), sort, dir, ...(page > 1 && { page: String(page) }) })}`}
              scroll={false}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <X className="size-3" />
              ປິດ
              <LinkPending className="size-3" />
            </Link>
          </div>
          {movements.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">#</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ວັນທີ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເວລາ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລານການ</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((row) => (
                    <tr key={`${row.trans}-${row.rnum}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-400">{row.rnum}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.date_t ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{row.time_t ?? "-"}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-700">{row.trans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
