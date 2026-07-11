import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { CheckCheck, ChevronLeft, ChevronRight, Clock, Search, ShoppingCart } from "lucide-react";
import Link from "next/link";

/**
 * ຖອດແບບຈາກ ods: order.py request_order() + templates/request_order/home_request_order.html (ອອກແບບໃໝ່)
 * (list_baiberk / list_spr ທີ່ ods ສົ່ງໄປ template ນັ້ນບໍ່ໄດ້ຖືກໃຊ້ຈັກບ່ອນ → ຕັດອອກ)
 */

const PAGE_SIZE = 20;

type Tab = "pending" | "approved";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  roworder: number;
  doc_no: string;
  product: string | null;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  balance_qty: number;
  wh_qty: string | null;
  owh_qty: string | null;
  inv_unit: string | null;
  status: number | null;
  product_code: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
};

const FROM = `from ic_trans_detail a
    left join ic_trans b on b.doc_no = a.doc_no
    left join tb_product c on c.code = a.product_code
    left join ic_inventory e on e.code = a.item_code`;

/** ແຖວອາໄຫຼ່ຂອງໃບຂໍເບີກ (trans_flag 122) ທີ່ stock ໝົດ — ເງື່ອນໄຂຄັດລອກມາຈາກ ods ທຸກຢ່າງ */
const BASE = `((a.trans_flag = 122 and a.status not in (1,5) and (e.balance_qty = 0 or e.balance_qty is null))
    or (c.spare_order is not null and a.status = 5 and a.trans_flag = 122)
    or (c.spare_order is not null and a.status = 7 and a.trans_flag = 122))`;

/** ແຍກເປັນສອງແທັບຕາມ status — ຄືການແຍກເດີມ (status 5 = ອະນຸມັດເເລ້ວ) */
const BUCKET: Record<Tab, string> = {
  pending: `${BASE} and a.status is distinct from 5`,
  approved: `${BASE} and a.status = 5`,
};

const SEARCH = `(a.doc_no ilike $Q or a.item_code ilike $Q or a.item_name ilike $Q
  or c.name_1 ilike $Q or c.sn ilike $Q or c.code ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  doc_no: "a.doc_no",
  elapsed: "at_col",
  product: "c.name_1",
  item_code: "a.item_code",
  item_name: "a.item_name",
  qty: "a.qty",
  balance_qty: "e.balance_qty",
};

/** "ຄ້າງມາ" ນັບຈາກເວລາອອກໃບຂໍເບີກ */
const TIME_COL = "b.create_date_time_now";

async function getRows(tab: Tab, q: string, page: number, sort: string, dir: SortDir) {
  const where = [BUCKET[tab]];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "a.doc_no";
  // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col" ? `${TIME_COL} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const rowsSql = `select a.roworder, a.doc_no, concat_ws('_', c.name_1, c.sn) product, a.item_code, a.item_name,
      coalesce(a.qty,0) qty, a.unit_code, coalesce(e.balance_qty::int,0) balance_qty,
      e.wh_qty, e.owh_qty, e.unit_code inv_unit, a.status, c.code product_code,
      to_char(${TIME_COL},'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${TIME_COL}))))::int elapsed_seconds
    ${FROM}
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total ${FROM} where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Row>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts() {
  const row = (
    await query<{ pending: number; approved: number }>(
      `select count(*) filter (where a.status is distinct from 5)::int pending,
          count(*) filter (where a.status = 5)::int approved
        ${FROM} where ${BASE}`,
    )
  ).rows[0];
  return { pending: row?.pending ?? 0, approved: row?.approved ?? 0 };
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທີໃບຂໍເບີກ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ສິນຄ້າ", defaultDir: "asc" },
  { key: "item_code", label: "ລະຫັດ", defaultDir: "asc" },
  { key: "item_name", label: "ລາຍການ", defaultDir: "asc" },
  { key: "qty", label: "ຈຳນວນ", defaultDir: "desc" },
  { key: "balance_qty", label: "ຄົງເຫຼືອ", defaultDir: "asc" },
];

export default async function PurchaseRequestsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "approved" ? "approved" : "pending";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, list] = await Promise.all([getCounts(), getRows(tab, q, page, sort, dir)]);
  const total = list.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "pending" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/purchase-requests?${new URLSearchParams({ ...(target !== "pending" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/purchase-requests?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/purchase-requests?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "pending", label: "ລາຍການຂໍສັ່ງຊື້ອາໄຫຼ່", icon: Clock, count: counts.pending },
    { key: "approved", label: "ອະນຸມັດຂໍສັ່ງຊື້ເເລ້ວ", icon: CheckCheck, count: counts.approved },
  ];

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ລາຍການຂໍສັ່ງຊື້ອາໄຫຼ່</h1>
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
          {tab !== "pending" && <input type="hidden" name="tab" value={tab} />}
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ຄົ້ນຫາ ໃບຂໍເບີກ, ລະຫັດ, ລາຍການ, ສິນຄ້າ, SN..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-xs">
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຫົວໜ່ວຍ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສາງຈ່າຍ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສາງອື່ນ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຫົວໜ່ວຍ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                return (
                  <tr key={row.roworder} className="border-b border-slate-100 hover:bg-slate-50">
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
                    <td className="max-w-52 truncate px-3 py-2.5" title={row.product ?? ""}>
                      {row.product || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">{row.item_code}</td>
                    <td className="max-w-64 truncate px-3 py-2.5" title={row.item_name ?? ""}>
                      {row.item_name || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">{Number(row.qty)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          row.balance_qty > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.balance_qty}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.unit_code || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.wh_qty ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.owh_qty ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.inv_unit || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {tab === "approved" ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          ອະນຸມັດເເລ້ວ
                        </span>
                      ) : row.status === 7 ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          ລໍຖ້າອະນຸມັດຂໍສັ່ງຊື້
                        </span>
                      ) : row.product_code ? (
                        <Link
                          href={`/purchase-requests/new/${encodeURIComponent(row.product_code)}/${encodeURIComponent(row.doc_no)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <ShoppingCart className="size-3.5" />
                          ສັ່ງຊື້
                          <LinkPending className="size-3" />
                        </Link>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>
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
