import { ArrivalButton, UndoArrivalButton } from "@/app/(app)/stock/arrivals/arrival-buttons";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { AlertTriangle, ChevronLeft, ChevronRight, PackageCheck, Search, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";

/**
 * ຮັບອາໄຫຼ່ທີ່ສັ່ງຊື້ (ຂັ້ນ 7 → 6) — ໜ້າໃໝ່ ບໍ່ມີໃນ ods.
 *
 * ບັນຫາເດີມ: ໃບຮັບເຄື່ອງເຂົ້າຂັ້ນ "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" ຕອນໃບຂໍຊື້ຖືກອະນຸມັດ (tb_product.spare_order)
 * ແຕ່ **ບໍ່ມີປຸ່ມໃດໃນລະບົບທີ່ໝາຍວ່າ "ຂອງມາຮອດແລ້ວ"** ⇒ ວຽກຄ້າງຢູ່ຂັ້ນນັ້ນ
 * ຈົນກວ່າສາງຈະບັງເອີນເບີກອາໄຫຼ່ໃຫ້ (ເກົ່າສຸດຄ້າງ 225 ມື້ ໂດຍທີ່ຊ່າງບໍ່ຮູ້ວ່າຂອງມາຫຼືຍັງ).
 *
 * ໜ້ານີ້ = ບັນຊີຕິດຕາມໃບສັ່ງຊື້ (ອາຍຸ + ອາໄຫຼ່ທີ່ສັ່ງ + ເລກໃບ SPR/RQ) + ປຸ່ມ "ອາໄຫຼ່ມາຮອດແລ້ວ".
 * ກົດແລ້ວຂຽນ spare_arrive → ຂັ້ນຕົກເປັນ 6 ⇒ ວຽກໄປໂຜ່ຢູ່ /stock/dispatch ໃຫ້ເບີກໃຫ້ຊ່າງ.
 *
 * ໝາຍເຫດ: ຖານ ODS ບໍ່ໄດ້ເກັບ "ຜູ້ສະໜອງ" ໄວ້ຈັກບ່ອນ (ic_trans ບໍ່ມີຖັນ supplier/vendor)
 * ⇒ ເອກະສານອ້າງອີງທີ່ສະແດງໄດ້ຄື ໃບສັ່ງຊື້ SPR ແລະ ໃບຂໍອະນຸມັດ RQ ຕົ້ນທາງ.
 */

const PAGE_SIZE = 20;

type Tab = "waiting" | "arrived";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type OrderedItem = { item_code: string; item_name: string | null; qty: number | string };

type Row = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  technician: string | null;
  issue: string | null;
  ordered_at: string | null;
  elapsed_seconds: number | null;
  arrived_at: string | null;
  arrived_seconds: number | null;
  spare_arrive_by: string | null;
  spr_no: string | null;
  spr_date: string | null;
  rq_no: string | null;
  items: OrderedItem[];
};

/** ວຽກທີ່ຍັງບໍ່ຈົບ ແລະ ຍັງບໍ່ໄດ້ເບີກອາໄຫຼ່ — ພື້ນຖານຂອງທັງສອງແທັບ */
const LIVE = `coalesce(a.used_spare,0) = 1 and a.spare_finish is null
  and a.status <> 6 and a.return_complete is null`;

/**
 * ແທັບ "ລໍຖ້າອາໄຫຼ່ມາຮອດ" = ຂັ້ນ 7 ຂອງ STAGE_SQL ພໍດີ (ສັ່ງຊື້ແລ້ວ ຍັງບໍ່ມາຮອດ).
 * ບໍ່ໄດ້ import STAGE_SQL ມາທັງກ້ອນ ເພາະຕ້ອງການ where ທີ່ index ໃຊ້ໄດ້ ແລະ ອ່ານງ່າຍ
 * — ເງື່ອນໄຂຢູ່ນີ້ຄືກັນກັບກິ່ງຂັ້ນ 7 ທຸກປະການ (ເບິ່ງ lib/stage.ts).
 */
const BUCKET: Record<Tab, string> = {
  waiting: `${LIVE} and a.spare_order is not null and a.spare_order_finish is null and a.spare_arrive is null`,
  arrived: `${LIVE} and a.spare_arrive is not null`,
};

const CUSTOMER = "left join ar_customer b on b.code = a.cust_code";

/** ຄົ້ນຫາໄດ້ເຖິງລະດັບ "ອາໄຫຼ່ທີ່ສັ່ງ" ນຳ — ສາງມັກຄົ້ນຫາດ້ວຍຊື່ອາໄຫຼ່ທີ່ຫາກໍ່ມາຮອດ */
const SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.emp_code ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q
  or exists (select 1 from ic_trans_detail d
              where d.product_code = a.code
                and (d.doc_no ilike $Q or d.item_code ilike $Q or d.item_name ilike $Q)))`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "a.code",
  elapsed: "at_col",
  product: "a.name_1",
  brand: "a.p_brand",
  customer: "b.name_1",
  technician: "a.emp_code",
  doc: "spr.doc_no",
};

/**
 * ອາໄຫຼ່ທີ່ສັ່ງ — ເອົາຈາກແຖວຂອງໃບ SPR ຂອງວຽກນີ້, ຖ້າຫາໃບ SPR ບໍ່ພົບ
 * ຈຶ່ງຖອຍໄປໃຊ້ແຖວໃບຂໍເບີກ (122) ທີ່ຖືກໝາຍວ່າກຳລັງສັ່ງຊື້ (status 5/7).
 *
 * ຕ້ອງ distinct: ods ເກົ່າຍິງ INSERT..SELECT ຄືນລະລາຍການໃນ loop → ແຖວ SPR ຊ້ຳກັນ
 * (ຕົວຢ່າງຈິງ SPR26050002 ມີ 4 ແຖວ ແຕ່ເປັນອາໄຫຼ່ຕົວດຽວ). ບໍ່ distinct = ສະແດງຊ້ຳ 4 ເທື່ອ.
 */
const ORDERED_LINES = `left join lateral (
    select t.doc_no, t.doc_ref, to_char(t.doc_date,'DD-MM-YYYY') doc_date
      from ic_trans t
     where t.product_code = a.code and t.trans_flag = 2
     order by t.doc_no desc limit 1
  ) spr on true
  left join lateral (
    select coalesce(json_agg(json_build_object('item_code', x.item_code, 'item_name', x.item_name, 'qty', x.qty)
                             order by x.item_code), '[]'::json) items
      from (select distinct d.item_code, d.item_name, coalesce(d.qty,0) qty
              from ic_trans_detail d
             where d.product_code = a.code
               and (d.doc_no = spr.doc_no
                    or (spr.doc_no is null and d.trans_flag = 122 and d.status in (5,7)))) x
  ) ln on true`;

async function getRows(tab: Tab, q: string, page: number, sort: string, dir: SortDir) {
  // ແທັບ "ລໍຖ້າ" ນັບເວລາຈາກມື້ສັ່ງຊື້ · ແທັບ "ມາຮອດແລ້ວ" ນັບຈາກມື້ຂອງມາຮອດ (ຄ້າງລໍຖ້າເບີກ)
  const timeCol = tab === "waiting" ? "a.spare_order" : "a.spare_arrive";
  const where = [BUCKET[tab]];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "at_col";
  // ຄ້າງດົນສຸດຢູ່ເທິງສຸດ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col"
      ? `${timeCol} ${dir === "desc" ? "asc" : "desc"} nulls last`
      : `${column} ${dir} nulls last`;

  const rowsSql = `select a.code, concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model,
      a.sn, a.p_brand brand, a.emp_code technician, a.issue,
      to_char(a.spare_order,'DD-MM-YYYY HH24:MI') ordered_at,
      greatest(0, round(extract(epoch from (localtimestamp - a.spare_order))))::int elapsed_seconds,
      to_char(a.spare_arrive,'DD-MM-YYYY HH24:MI') arrived_at,
      greatest(0, round(extract(epoch from (localtimestamp - a.spare_arrive))))::int arrived_seconds,
      a.spare_arrive_by, spr.doc_no spr_no, spr.doc_date spr_date, spr.doc_ref rq_no, ln.items
    from tb_product a ${CUSTOMER} ${ORDERED_LINES}
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  // ນັບ "ຄ້າງເກີນ 30 ມື້" ຢູ່ DB ຈຶ່ງນັບໄດ້ທຸກໜ້າ ບໍ່ແມ່ນແຕ່ໜ້າປັດຈຸບັນ
  const countSql = `select count(*)::int total,
      count(*) filter (where ${timeCol} < localtimestamp - interval '30 days')::int overdue
    from tb_product a ${CUSTOMER} where ${filter}`;

  const [rows, stats] = await Promise.all([
    query<Row>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number; overdue: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: stats.rows[0]?.total ?? 0, overdue: stats.rows[0]?.overdue ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts() {
  const row = (
    await query<{ waiting: number; arrived: number }>(
      `select count(*) filter (where ${BUCKET.waiting})::int waiting,
          count(*) filter (where ${BUCKET.arrived})::int arrived
        from tb_product a`,
    )
  ).rows[0];
  return { waiting: row?.waiting ?? 0, arrived: row?.arrived ?? 0 };
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "doc", label: "ໃບສັ່ງຊື້", defaultDir: "desc" },
  { key: "product", label: "ຊື່ເຄື່ອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
];

const qty = (value: number | string) => Number(value).toLocaleString();

export default async function ArrivalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "arrived" ? "arrived" : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, list] = await Promise.all([getCounts(), getRows(tab, q, page, sort, dir)]);
  const total = list.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/stock/arrivals?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/arrivals?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/arrivals?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Truck; count: number }[] = [
    { key: "waiting", label: "ລໍຖ້າອາໄຫຼ່ມາຮອດ", icon: Truck, count: counts.waiting },
    { key: "arrived", label: "ມາຮອດແລ້ວ ລໍຖ້າເບີກ", icon: PackageCheck, count: counts.arrived },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ຮັບອາໄຫຼ່ທີ່ສັ່ງຊື້</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {tab === "waiting"
              ? "ວຽກທີ່ອະນຸມັດສັ່ງຊື້ອາໄຫຼ່ແລ້ວ ແລະ ຍັງລໍຖ້າຂອງມາຮອດ"
              : "ຢືນຢັນວ່າຂອງມາຮອດແລ້ວ ລໍຖ້າສາງເບີກໃຫ້ຊ່າງ"}{" "}
            · {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
        <Link
          href="/stock/dispatch"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ShoppingCart className="size-4" />
          ໄປໜ້າເບີກອາໄຫຼ່
          <LinkPending className="size-3.5" />
        </Link>
      </div>

      {list.overdue > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            ມີ <b>{list.overdue}</b> ລາຍການ <b>ຄ້າງເກີນ 30 ມື້</b>
          </span>
          <span className="text-red-500">
            {tab === "waiting" ? "(ນັບຈາກມື້ອະນຸມັດສັ່ງຊື້ອາໄຫຼ່)" : "(ນັບຈາກມື້ຢືນຢັນວ່າຂອງມາຮອດ)"}
          </span>
        </p>
      )}

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
              <span
                className={`rounded px-1 text-[10px] font-bold ${
                  tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"
                }`}
              >
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
              placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຊ່າງ, ໃບສັ່ງຊື້, ຊື່ອາໄຫຼ່..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-xs">
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາໄຫຼ່ທີ່ສັ່ງ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const seconds = tab === "waiting" ? row.elapsed_seconds : row.arrived_seconds;
                const tone = elapsedTone(seconds);
                const items = row.items ?? [];
                return (
                  <tr key={row.code} className="border-b border-slate-100 align-top hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      <Link href={`/service/${row.code}`} className="hover:underline">
                        {row.code}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed
                        seconds={seconds}
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {tab === "waiting" ? (
                          <>ສັ່ງຊື້ {row.ordered_at ?? "-"}</>
                        ) : (
                          <>
                            ມາຮອດ {row.arrived_at ?? "-"}
                            {row.spare_arrive_by && <span className="ml-1">· {row.spare_arrive_by}</span>}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-semibold text-slate-700">{row.spr_no ?? "-"}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {row.spr_date ?? "-"}
                        {row.rq_no && <span className="ml-1">· {row.rq_no}</span>}
                      </span>
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
                    <td className="whitespace-nowrap px-3 py-2.5">{row.technician || "-"}</td>
                    <td className="max-w-80 px-3 py-2.5">
                      {items.length === 0 ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {items.map((item) => (
                            <li key={item.item_code} className="truncate" title={item.item_name ?? item.item_code}>
                              <span className="font-medium text-slate-700">{item.item_name || item.item_code}</span>
                              <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
                                × {qty(item.qty)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {tab === "waiting" ? (
                        <ArrivalButton
                          code={row.code}
                          item={items.map((item) => `${item.item_name || item.item_code} × ${qty(item.qty)}`).join(" · ")}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link
                            href="/stock/dispatch"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                          >
                            <ShoppingCart className="size-3.5" />
                            ໄປເບີກ
                            <LinkPending className="size-3" />
                          </Link>
                          <UndoArrivalButton code={row.code} />
                        </div>
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
