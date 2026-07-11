import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileBarChart,
  History,
  Repeat,
  Search,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { CancelRequestButton } from "./cancel-request-button";

/** ods: stock.py /stock_request + templates/stock/request.html (ອອກແບບໜ້າຕາໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "waiting" | "active" | "movements";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type WaitRow = {
  roworder: number;
  customer: string | null;
  name_1: string | null;
  p_model: string | null;
  sn: string | null;
  p_brand: string | null;
  warrunty: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  issue: string | null;
  user_regis: string | null;
};

type HeadRow = {
  doc_no: string;
  customer: string | null;
  name_1: string | null;
  p_model: string | null;
  sn: string | null;
  p_brand: string | null;
  warrunty: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  issue: string | null;
  emp_code: string | null;
  product_code: string | null;
};

type LineRow = {
  doc_no: string;
  roworder: number;
  item_code: string;
  item_name: string | null;
  qty: string | null;
  unit_code: string | null;
  status: number | null;
};

type MoveRow = {
  code: string;
  name_1: string | null;
  p_model: string | null;
  sn: string | null;
  p_brand: string | null;
  reg_at: string | null;
  finish_at: string | null;
  elapsed_seconds: number | null;
  emp_code: string | null;
  status_name: string;
};

/* ─── ລໍຖ້າຂໍເບີກ ─── */

/**
 * ເຄື່ອງທີ່ຕ້ອງການອາໄຫຼ່ ແຕ່ຍັງບໍ່ທັນຂໍເບີກ (spare_reg isnull).
 * ນອກປະກັນຕ້ອງສະເໜີລາຄາຈົບກ່ອນ (qt_start/qt_finish) — ໃນປະກັນຂໍໄດ້ເລີຍ (ຄື ods: union ສອງທ່ອນ).
 */
const WAIT_WHERE = `a.used_spare = 1 and a.spare_reg is null and a.status != 6
  and ((a.warrunty = 'ໝົດຮັບປະກັນ' and a.qt_start is not null and a.qt_finish is not null)
       or a.warrunty = 'ຮັບປະກັນ')`;

const WAIT_SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.issue ilike $Q or a.user_regis ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q)`;

const WAIT_SORT: Record<string, string> = {
  customer: "b.name_1",
  product: "a.name_1",
  brand: "a.p_brand",
  warranty: "a.warrunty",
  elapsed: "a.time_finish_check",
  receiver: "a.user_regis",
};

async function getWaiting(q: string, page: number, sort: string, dir: SortDir) {
  const params: unknown[] = [];
  let where = WAIT_WHERE;
  if (q) {
    params.push(`%${q}%`);
    where += ` and ${WAIT_SEARCH.replaceAll("$Q", `$${params.length}`)}`;
  }
  const from = `from tb_product a left join ar_customer b on b.code = a.cust_code`;

  const [rows, count] = await Promise.all([
    query<WaitRow>(
      `select a.roworder, concat_ws('-', b.name_1, b.tel) customer, a.name_1, a.p_model, a.sn, a.p_brand, a.warrunty,
         to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI') at_time,
         greatest(0, round(extract(epoch from (localtimestamp - a.time_finish_check))))::int elapsed_seconds,
         a.issue, a.user_regis
       ${from} where ${where}
       order by ${orderBy(WAIT_SORT, sort, dir, "a.time_finish_check", "a.time_finish_check")}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total ${from} where ${where}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/* ─── ກຳລັງຂໍເບີກ ─── */

/** ໃບຂໍເບີກທີ່ຍັງດຳເນີນຢູ່ — ຄືເງື່ອນໄຂ ods (ລວມແຖວທີ່ກຳລັງສັ່ງຊື້) */
const ACTIVE_DOCS = `select distinct dt.doc_no from ic_trans_detail dt
  where dt.trans_flag = ${TRANS.REQUEST} and dt.status != ${LINE_STATUS.ISSUED}
     or dt.status = ${LINE_STATUS.ON_PURCHASE_ORDER}`;

const ACTIVE_SEARCH = `(a.doc_no ilike $Q or b.code ilike $Q or b.sn ilike $Q or b.name_1 ilike $Q
  or b.p_brand ilike $Q or b.p_model ilike $Q or b.issue ilike $Q or b.emp_code ilike $Q
  or c.name_1 ilike $Q or c.tel ilike $Q)`;

const ACTIVE_SORT: Record<string, string> = {
  doc_no: "a.doc_no",
  customer: "c.name_1",
  product: "b.name_1",
  brand: "b.p_brand",
  warranty: "b.warrunty",
  elapsed: "b.spare_reg",
  technician: "b.emp_code",
};

/** ຊ່າງເຫັນສະເພາະໃບຂອງຕົນ (ods ກັ່ນຕອງດ້ວຍ emp_code) — ນີ້ແມ່ນການກັ່ນຕອງຂໍ້ມູນ ບໍ່ແມ່ນສິດ */
async function getActive(emp: string | null, q: string, page: number, sort: string, dir: SortDir) {
  const params: unknown[] = [];
  let where = `a.trans_flag = ${TRANS.REQUEST} and a.doc_no in (${ACTIVE_DOCS})`;
  if (emp) {
    params.push(emp);
    where += ` and b.emp_code = $${params.length}`;
  }
  if (q) {
    params.push(`%${q}%`);
    where += ` and ${ACTIVE_SEARCH.replaceAll("$Q", `$${params.length}`)}`;
  }
  const from = `from ic_trans a
    left join tb_product b on b.code = a.product_code
    left join ar_customer c on c.code = b.cust_code`;

  const [heads, count] = await Promise.all([
    query<HeadRow>(
      `select a.doc_no, concat_ws('-', c.name_1, c.tel) customer, b.name_1, b.p_model, b.sn, b.p_brand, b.warrunty,
         to_char(b.spare_reg,'DD-MM-YYYY HH24:MI') at_time,
         greatest(0, round(extract(epoch from (localtimestamp - b.spare_reg))))::int elapsed_seconds,
         b.issue, b.emp_code, b.code product_code
       ${from} where ${where}
       order by ${orderBy(ACTIVE_SORT, sort, dir, "b.spare_reg", "b.spare_reg")}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total ${from} where ${where}`, params),
  ]);

  // ແຖວອາໄຫຼ່ຂອງໃບທີ່ຢູ່ໜ້ານີ້ເທົ່ານັ້ນ
  const docNos = heads.rows.map((row) => row.doc_no);
  const lines = docNos.length
    ? (
        await query<LineRow>(
          `select doc_no, roworder, item_code, item_name, qty::text, unit_code, status
           from ic_trans_detail
           where trans_flag = $1 and doc_no = any($2::text[]) and status != $3
           order by doc_no, roworder`,
          [TRANS.REQUEST, docNos, LINE_STATUS.ISSUED],
        )
      ).rows
    : [];

  const byDoc = new Map<string, LineRow[]>();
  for (const line of lines) byDoc.set(line.doc_no, [...(byDoc.get(line.doc_no) ?? []), line]);

  return { rows: heads.rows, lines: byDoc, total: count.rows[0]?.total ?? 0 };
}

/* ─── ການເຄື່ອນໄຫວ ─── */

const MOVE_SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.emp_code ilike $Q)`;

const MOVE_SORT: Record<string, string> = {
  product: "a.name_1",
  brand: "a.p_brand",
  elapsed: "a.spare_reg",
  technician: "a.emp_code",
};

/** ການເຄື່ອນໄຫວການເບີກອາໄຫຼ່ຂອງທຸກເຄື່ອງ (ods: ດຶງທຸກແຖວ — ດຽວນີ້ແບ່ງໜ້າ) */
async function getMovements(q: string, page: number, sort: string, dir: SortDir) {
  const params: unknown[] = [];
  let where = "a.used_spare = 1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and ${MOVE_SEARCH.replaceAll("$Q", `$${params.length}`)}`;
  }

  const [rows, count] = await Promise.all([
    query<MoveRow>(
      `select a.code, a.name_1, a.p_model, a.sn, a.p_brand,
         to_char(a.spare_reg,'DD-MM-YYYY HH24:MI') reg_at,
         to_char(a.spare_finish,'DD-MM-YYYY HH24:MI') finish_at,
         greatest(0, round(extract(epoch from (coalesce(a.spare_finish, localtimestamp) - a.spare_reg))))::int elapsed_seconds,
         a.emp_code,
         case when a.spare_reg is null then 'ລໍຖ້າດຳເນີນການອາໄຫຼ່'
              when a.spare_finish is null then 'ລໍຖ້າສາງເບີກ'
              else 'ເບີກສຳເລັດ' end status_name
       from tb_product a where ${where}
       order by ${orderBy(MOVE_SORT, sort, dir, "a.spare_reg", "a.spare_reg")}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total from tb_product a where ${where}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts(emp: string | null) {
  const [waiting, active, movements] = await Promise.all([
    query<{ total: number }>(
      `select count(*)::int total from tb_product a
       left join ar_customer b on b.code = a.cust_code where ${WAIT_WHERE}`,
    ),
    query<{ total: number }>(
      `select count(*)::int total from ic_trans a
       left join tb_product b on b.code = a.product_code
       where a.trans_flag = ${TRANS.REQUEST} and a.doc_no in (${ACTIVE_DOCS})
         ${emp ? "and b.emp_code = $1" : ""}`,
      emp ? [emp] : [],
    ),
    query<{ total: number }>(`select count(*)::int total from tb_product a where a.used_spare = 1`),
  ]);
  return {
    waiting: waiting.rows[0]?.total ?? 0,
    active: active.rows[0]?.total ?? 0,
    movements: movements.rows[0]?.total ?? 0,
  };
}

/** ຈັດຮຽງ — whitelist ຖັນ, ຖັນເວລາຈັດ "ຄ້າງດົນສຸດກ່ອນ" ຈຶ່ງກັບທິດໃຫ້ */
function orderBy(map: Record<string, string>, sort: string, dir: SortDir, fallback: string, timeColumn: string) {
  const column = map[sort] ?? fallback;
  if (column === timeColumn) return `${column} ${dir === "desc" ? "asc" : "desc"} nulls last`;
  return `${column} ${dir} nulls last`;
}

/** ປ້າຍສະຖານະຂອງແຖວອາໄຫຼ່ */
function LineStatus({ status }: { status: number | null }) {
  if (status === LINE_STATUS.ON_PURCHASE_ORDER)
    return (
      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">ກຳລັງສັ່ງຊື້</span>
    );
  return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">ກຳລັງຂໍເບີກ</span>;
}

const WAIT_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ຊື່ເຄື່ອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ຮັບປະກັນ", defaultDir: "asc" },
  { key: "receiver", label: "ຜູ້ຮັບເຄື່ອງ", defaultDir: "asc" },
];

const ACTIVE_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກຂໍເບີກ", defaultDir: "desc" },
  { key: "elapsed", label: "ຂໍເບີກມາແລ້ວ", defaultDir: "desc" },
  { key: "product", label: "ຊື່ເຄື່ອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ຮັບປະກັນ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
];

const MOVE_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "elapsed", label: "ໄລຍະເວລາ", defaultDir: "desc" },
  { key: "product", label: "ຊື່ເຄື່ອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
];

export default async function StockRequestsPage({ searchParams }: Props) {
  const session = await getSession();
  // ຊ່າງເຫັນສະເພາະໃບຂອງຕົນ (ຄື ods) — ບົດບາດອື່ນເຫັນທຸກໃບ
  const emp = session?.role === "technical" ? session.username : null;

  const params = await searchParams;
  const tab: Tab = params.tab === "active" || params.tab === "movements" ? params.tab : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const load = async (): Promise<{
    rows: WaitRow[] | HeadRow[] | MoveRow[];
    total: number;
    lines?: Map<string, LineRow[]>;
  }> => {
    if (tab === "waiting") return getWaiting(q, page, sort, dir);
    if (tab === "active") return getActive(emp, q, page, sort, dir);
    return getMovements(q, page, sort, dir);
  };

  const [counts, data] = await Promise.all([getCounts(emp), load()]);

  const total = data.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/stock/requests?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/requests?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/requests?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "waiting", label: "ຕ້ອງການອາໄຫຼ່", icon: Clock, count: counts.waiting },
    { key: "active", label: "ກຳລັງຂໍເບີກ", icon: ClipboardList, count: counts.active },
    { key: "movements", label: "ການເຄື່ອນໃຫວ", icon: History, count: counts.movements },
  ];

  const waiting = tab === "waiting" ? (data.rows as WaitRow[]) : [];
  const heads = tab === "active" ? (data.rows as HeadRow[]) : [];
  const linesByDoc = data.lines ?? new Map<string, LineRow[]>();
  const movements = tab === "movements" ? (data.rows as MoveRow[]) : [];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ລາຍການຕ້ອງການອາໄຫຼ່</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {emp ? "ສະແດງສະເພາະວຽກຂອງທ່ານ" : "ສະແດງທຸກວຽກ"} · {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/stock/requests/again"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#DE3163] px-3 text-xs font-semibold text-white hover:opacity-90"
          >
            <Repeat className="size-4" />
            ຂໍເບີກຊ້ຳ
            <LinkPending className="size-3.5" />
          </Link>
          {/* ods: stock_print.py /home_rq_print (122) — ລາຍງານໃບຂໍເບີກ */}
          <Link
            href="/reports/stock?tab=122"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileBarChart className="size-4" />
            ລາຍງານ
            <LinkPending className="size-3.5" />
          </Link>
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
              <span
                className={`rounded px-1 text-[10px] font-bold ${tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}
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
              placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ຊ່າງ, ອາການ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {tab === "waiting" && (
            <table className="w-full min-w-[1150px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {WAIT_COLUMNS.map((column) => (
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
                {waiting.map((row) => {
                  const tone = elapsedTone(row.elapsed_seconds);
                  const inWarranty = row.warrunty === "ຮັບປະກັນ";
                  return (
                    <tr key={row.roworder} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="relative whitespace-nowrap px-3 py-2.5">
                        <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                        <Elapsed
                          seconds={row.elapsed_seconds}
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                        />
                        <span className="mt-0.5 block text-[10px] text-slate-400">{row.at_time ?? "-"}</span>
                      </td>
                      <td className="max-w-64 px-3 py-2.5">
                        <span className="block truncate font-medium text-slate-800" title={row.name_1 ?? ""}>
                          {row.name_1 ?? "-"} {row.p_model && <span className="text-slate-400">{row.p_model}</span>}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">{row.sn ?? "-"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.p_brand ?? "-"}</td>
                      <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>
                        {row.customer ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {row.warrunty ?? "-"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.user_regis ?? "-"}</td>
                      <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
                        {row.issue ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Link
                          href={`/stock/requests/${row.roworder}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <ShoppingBag className="size-3.5" />
                          ຂໍເບີກ
                          <LinkPending className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "active" && (
            <table className="w-full min-w-[1250px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {ACTIVE_COLUMNS.map((column) => (
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
                {heads.map((head) => {
                  const tone = elapsedTone(head.elapsed_seconds);
                  const inWarranty = head.warrunty === "ຮັບປະກັນ";
                  const lines = linesByDoc.get(head.doc_no) ?? [];
                  return (
                    <Fragment key={head.doc_no}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                          <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                          <Link
                            href={`/stock/requests/view/${encodeURIComponent(head.doc_no)}`}
                            className="hover:underline"
                          >
                            {head.doc_no}
                          </Link>
                          <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                            {lines.length} ລາຍການ
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <Elapsed
                            seconds={head.elapsed_seconds}
                            className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                          />
                          <span className="mt-0.5 block text-[10px] text-slate-400">{head.at_time ?? "-"}</span>
                        </td>
                        <td className="max-w-64 px-3 py-2.5">
                          <span className="block truncate font-medium text-slate-800" title={head.name_1 ?? ""}>
                            {head.name_1 ?? "-"} {head.p_model && <span className="text-slate-400">{head.p_model}</span>}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400">{head.sn ?? "-"}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">{head.p_brand ?? "-"}</td>
                        <td className="max-w-44 truncate px-3 py-2.5" title={head.customer ?? ""}>
                          {head.customer ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {head.warrunty ?? "-"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">{head.emp_code ?? "-"}</td>
                        <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={head.issue ?? ""}>
                          {head.issue ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <CancelRequestButton docNo={head.doc_no} productCode={head.product_code ?? ""} />
                        </td>
                      </tr>

                      {/* ແຖວອາໄຫຼ່ຂອງໃບນີ້ */}
                      {lines.map((line) => (
                        <tr key={line.roworder} className="border-b border-slate-100 bg-slate-50/60 text-slate-600">
                          <td className="px-3 py-1.5" />
                          <td className="whitespace-nowrap px-3 py-1.5">
                            <LineStatus status={line.status} />
                          </td>
                          <td className="max-w-64 truncate px-3 py-1.5" title={line.item_name ?? ""}>
                            {line.item_name ?? "-"}
                            <span className="ml-1 text-[10px] text-slate-400">{line.item_code}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {line.qty ? Number(line.qty) : "-"}{" "}
                            <span className="text-[10px] text-slate-400">{line.unit_code ?? ""}</span>
                          </td>
                          <td className="px-3 py-1.5" colSpan={5} />
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "movements" && (
            <table className="w-full min-w-[1050px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {MOVE_COLUMNS.map((column) => (
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
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເວລາຂໍເບີກ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເວລາເບີກ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((row) => {
                  const tone = elapsedTone(row.elapsed_seconds);
                  const done = row.status_name === "ເບີກສຳເລັດ";
                  return (
                    <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="relative whitespace-nowrap px-3 py-2.5">
                        <span className={`absolute inset-y-0 left-0 w-1 ${done ? "bg-emerald-400" : tone.bar}`} aria-hidden />
                        <Elapsed
                          seconds={row.elapsed_seconds}
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                            done ? "bg-emerald-50 text-emerald-700" : tone.chip
                          }`}
                        />
                      </td>
                      <td className="max-w-64 px-3 py-2.5">
                        <span className="block truncate font-medium text-slate-800" title={row.name_1 ?? ""}>
                          <Link href={`/service/${row.code}`} className="hover:underline">
                            {row.name_1 ?? "-"}
                          </Link>{" "}
                          {row.p_model && <span className="text-slate-400">{row.p_model}</span>}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">{row.sn ?? "-"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.p_brand ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.emp_code ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.reg_at ?? "ລໍຖ້າ"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.finish_at ?? "ລໍຖ້າ"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            done
                              ? "bg-emerald-50 text-emerald-700"
                              : row.status_name === "ລໍຖ້າສາງເບີກ"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.status_name}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
