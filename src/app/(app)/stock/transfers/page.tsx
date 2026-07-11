import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { ArrowLeftRight, ChevronLeft, ChevronRight, PackageCheck, Search } from "lucide-react";
import Link from "next/link";

/**
 * ຕິດຕາມໃບຂໍໂອນອາໄຫຼ່ຂ້າມສາງ (trans_flag 124) — ໜ້ານີ້ **ບໍ່ມີໃນ ods ເລີຍ**.
 *
 * ods ອອກໃບຂໍໂອນແລ້ວປະຖິ້ມ: ບໍ່ມີລາຍການໃບທີ່ຄ້າງ, ບໍ່ມີຂັ້ນ "ຂອງໂອນມາຮອດແລ້ວ" ⇒ ວຽກຄ້າງງຽບໆ
 * (ຂໍ້ມູນຈິງ: ໃບຂໍໂອນ SFRK 10 ໃບຢູ່ ERP, **ບໍ່ມີໃບໃດ** ຖືກອອກໃບໂອນ FT ຕໍ່ເລີຍ).
 * ບ່ອນນີ້ຈຶ່ງມີ 2 ແທັບ: ລໍຖ້າຂອງ / ຮັບຂອງແລ້ວ ພ້ອມໂມງນັບເວລາຄ້າງ.
 */

const PAGE_SIZE = 20;

type Tab = "pending" | "received";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  product_code: string | null;
  product: string | null;
  wh_code: string | null;
  item_code: string | null;
  item_name: string | null;
  qty: string | null;
  unit_code: string | null;
  remark: string | null;
  elapsed_seconds: number | null;
};

/** ວັນ/ເວລາທີ່ອອກໃບ — ໃຊ້ນັບ "ຄ້າງມາ" */
const DOC_AT = "coalesce(a.create_date_time_now, a.doc_date::timestamp)";

const SEARCH = `(a.doc_no ilike $Q or a.doc_ref ilike $Q or a.product_code ilike $Q or a.remark ilike $Q
  or d.item_code ilike $Q or d.item_name ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  doc_no: "a.doc_no",
  elapsed: "at_col",
  doc_ref: "a.doc_ref",
  item: "d.item_name",
  wh: "a.wh_code",
};

/** ໃບ 124 ນຶ່ງໃບ = ອາໄຫຼ່ນຶ່ງລາຍການ (saveTransferRequest ອອກໃບລະແຖວ) → join ລາຍລະອຽດແຖວທຳອິດ */
const FROM = `from ic_trans a
  left join lateral (
    select item_code, item_name, qty, unit_code from ic_trans_detail
    where doc_no = a.doc_no and trans_flag = a.trans_flag order by roworder limit 1
  ) d on true
  left join tb_product p on p.code = a.product_code`;

async function getRows(tab: Tab, q: string, page: number, sort: string, dir: SortDir) {
  const params: (string | number)[] = [TRANS.TRANSFER, tab === "pending" ? LINE_STATUS.PENDING : LINE_STATUS.ISSUED];
  const where = ["a.trans_flag = $1 and coalesce(a.status,0) = $2"];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "at_col";
  const orderBy = column === "at_col" ? `${DOC_AT} ${dir} nulls last` : `${column} ${dir} nulls last`;

  const rowsSql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.doc_ref, a.product_code,
      p.name_1||'_'||p.sn product, a.wh_code, d.item_code, d.item_name, d.qty, d.unit_code, a.remark,
      greatest(0, round(extract(epoch from (localtimestamp - ${DOC_AT}))))::int elapsed_seconds
    ${FROM} where ${filter}
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
    await query<{ pending: number; received: number }>(
      `select count(*) filter (where coalesce(status,0) = $2)::int pending,
         count(*) filter (where coalesce(status,0) = $3)::int received
       from ic_trans where trans_flag = $1`,
      [TRANS.TRANSFER, LINE_STATUS.PENDING, LINE_STATUS.ISSUED],
    )
  ).rows[0];
  return { pending: row?.pending ?? 0, received: row?.received ?? 0 };
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທີໃບຂໍໂອນ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "doc_ref", label: "ເລກໃບຂໍເບີກ", defaultDir: "desc" },
  { key: "item", label: "ອາໄຫຼ່", defaultDir: "asc" },
  { key: "wh", label: "ໂອນເຂົ້າສາງ", defaultDir: "asc" },
];

export default async function StockTransfersPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "received" ? "received" : "pending";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, data] = await Promise.all([getCounts(), getRows(tab, q, page, sort, dir)]);
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "pending" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/stock/transfers?${new URLSearchParams({ ...(target !== "pending" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/transfers?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/transfers?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof PackageCheck; count: number }[] = [
    { key: "pending", label: "ລໍຖ້າຂອງໂອນມາ", icon: ArrowLeftRight, count: counts.pending },
    { key: "received", label: "ຮັບຂອງທີ່ໂອນມາແລ້ວ", icon: PackageCheck, count: counts.received },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ຕິດຕາມການໂອນອາໄຫຼ່ຂ້າມສາງ</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {data.total.toLocaleString()} ໃບ · ໜ້າ {page}/{pages}
          </p>
        </div>
      </div>

      {/* ແທັບ + ຄົ້ນຫາ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap overflow-hidden rounded-lg border border-slate-300">
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
              <span
                className={`rounded px-1 text-[10px] font-bold ${tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}
              >
                {count.toLocaleString()}
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
              placeholder="ຄົ້ນຫາ ເລກທີ, ອາໄຫຼ່, ລະຫັດເຄື່ອງ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຄຳເຕືອນ: ການໂອນຈິງເກີດຢູ່ ERP ບໍ່ແມ່ນຢູ່ນີ້ */}
      {tab === "pending" && data.total > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          ໃບຂໍໂອນ (124) ບໍ່ຕັດ/ບວກສະຕັອກ — ສາງໃຫຍ່ຕ້ອງອອກ <span className="font-semibold">ໃບໂອນ (FT)</span> ໃນ ERP ກ່ອນ.
          ເມື່ອຍອດຂຶ້ນຢູ່ສາງປາຍທາງແລ້ວ ຈຶ່ງກົດ “ຮັບຂອງທີ່ໂອນມາ” ຢູ່ນີ້ ແລ້ວແຖວຈະກັບເຂົ້າຄິວເບີກອາໄຫຼ່.
        </p>
      )}

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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສິນຄ້າ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                return (
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span
                        className={`absolute inset-y-0 left-0 w-1 ${tab === "pending" ? tone.bar : ""}`}
                        aria-hidden
                      />
                      {row.doc_no}
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{row.doc_date ?? "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed
                        seconds={row.elapsed_seconds}
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                          tab === "pending" ? tone.chip : "bg-slate-100 text-slate-500"
                        }`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {row.doc_ref ? (
                        <Link
                          href={`/stock/requests/view/${encodeURIComponent(row.doc_ref)}`}
                          className="text-[#0536a9] hover:underline"
                        >
                          {row.doc_ref}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={row.item_name ?? ""}>
                        {row.item_name ?? "-"}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {row.item_code ?? "-"} · {Number(row.qty ?? 0)} {row.unit_code ?? ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.wh_code ?? "-"}</td>
                    <td className="max-w-56 truncate px-3 py-2.5" title={row.product ?? ""}>
                      {row.product ?? row.product_code ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          tab === "pending" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {tab === "pending" ? "ລໍຖ້າຂອງໂອນມາ" : "ຂອງມາຮອດແລ້ວ"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {tab === "pending" ? (
                        <Link
                          href={`/stock/transfers/receive/${encodeURIComponent(row.doc_no)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <PackageCheck className="size-3.5" />
                          ຮັບຂອງທີ່ໂອນມາ
                          <LinkPending className="size-3" />
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-400">ປິດແລ້ວ</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} ຈາກ{" "}
            {data.total.toLocaleString()}
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
