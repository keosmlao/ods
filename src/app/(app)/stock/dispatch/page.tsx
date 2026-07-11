import { refreshInventory } from "@/app/actions/stock";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { fmtQty, getBalances } from "@/lib/stock-balance";
import { DISPATCH_WAREHOUSES, LINE_STATUS, TRANS } from "@/lib/stock-constants";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  FileText,
  Hammer,
  PackageCheck,
  RotateCcw,
  Search,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

/** ods: stock.py /spdispatch + templates/stock/spdispatch.html (ອອກແບບໜ້າຕາໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "pending" | "install" | "dispatched" | "ordered" | "transfers";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

/** ແຖວດິບຈາກ SQL — ຍັງບໍ່ມີຍອດສະຕັອກ (ຄິດເພີ່ມພາຍຫຼັງດ້ວຍ getBalances) */
type RawLine = Omit<Line, "balance_qty" | "balance_qty_wh" | "owh_qty"> & { wh_code: string | null };

type Line = {
  doc_no: string;
  product: string | null;
  product_code: string | null;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  balance_qty: string | null;
  balance_qty_wh: string | null;
  owh_qty: string | null;
  inv_unit_code: string | null;
  roworder: number;
  status: number | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  /** ຂໍໂອນອາໄຫຼ່ແຖວນີ້ໄປແລ້ວບໍ (ic_trans_detail trans_flag 124) */
  transfer_requested: boolean;
};

type Doc = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  doc_ref_date: string | null;
  remark: string | null;
};

type Install = {
  doc_no: string;
  product: string | null;
  wh_code: string | null;
  customer: string | null;
  roworder: number;
};

/** ຜູ້ໃຊ້ສາງເຫັນສະເພາະສາງຂອງຕົນ (users.ic_wht) — ຄື ods */
async function getOwnWarehouses(username: string) {
  const row = (await query<{ ic_wht: string | null }>(`select ic_wht from users where code=$1 limit 1`, [username]))
    .rows[0];
  return row?.ic_wht ? [row.ic_wht] : [...DISPATCH_WAREHOUSES];
}

/*
 * ແຖວທີ່ລໍຖ້າເບີກ.
 *
 * ຕ່າງຈາກ ods: ods ມີເງື່ອນໄຂ `st.current_wh_balance > 0` → ແຖວທີ່ບໍ່ມີຂອງໃນສາງຂອງໃບຂໍເບີກ
 * ຫາຍໄປຈາກໜ້າຈໍເລີຍ ຈຶ່ງບໍ່ມີໃຜກົດ "ຂໍໂອນ" ຫຼື "ສັ່ງຊື້" ໄດ້ (ວຽກຄ້າງແບບງຽບໆ).
 * ຢູ່ນີ້ສະແດງທຸກແຖວ ແລ້ວໃຫ້ປຸ່ມທ້າຍແຖວຕັດສິນ: ມີໃນສາງ → ເບີກ, ຢູ່ສາງອື່ນ → ຂໍໂອນ, ບໍ່ມີເລີຍ → ສັ່ງຊື້.
 */
/** FROM ສຳລັບ "ນັບ" ເທົ່ານັ້ນ — ບໍ່ມີ lateral ຄິດຍອດສະຕັອກ (ເບົາກວ່າ ~67 ເທົ່າ) */
const PENDING_COUNT_FROM = `from ic_trans_detail a
  left join ic_trans b on a.doc_no = b.doc_no
  left join tb_product c on c.code = a.product_code`;

const PENDING_WHERE = `a.trans_flag = $1 and a.status != $2
  and (b.job_type != 'install' or b.job_type is null)
  and b.wh_code = any($3::text[])`;

const PENDING_SEARCH = `(a.doc_no ilike $Q or a.item_code ilike $Q or a.item_name ilike $Q
  or c.name_1 ilike $Q or c.sn ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const PENDING_SORT: Record<string, string> = {
  doc_no: "a.doc_no",
  product: "c.name_1",
  item: "a.item_name",
  qty: "a.qty",
  balance: "st.total_balance",
  elapsed: "c.spare_reg",
};

const DOC_SORT: Record<string, string> = {
  doc_no: "doc_no",
  doc_date: "doc_date",
  doc_ref: "doc_ref",
  remark: "remark",
};

const INSTALL_SORT: Record<string, string> = {
  doc_no: "b.doc_no",
  product: "c.item_name",
  wh: "b.wh_code",
  customer: "d.name_1",
};

function order(map: Record<string, string>, sort: string, dir: SortDir, fallback: string) {
  const column = map[sort] ?? fallback;
  // "ຄ້າງດົນສຸດກ່ອນ" = ເວລາຂໍເບີກເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  if (column === "c.spare_reg") return `${column} ${dir === "desc" ? "asc" : "desc"} nulls last`;
  return `${column} ${dir} nulls last`;
}

async function getPending(warehouses: string[], q: string, page: number, sort: string, dir: SortDir) {
  const params: unknown[] = [TRANS.REQUEST, LINE_STATUS.ISSUED, warehouses];
  let where = PENDING_WHERE;
  if (q) {
    params.push(`%${q}%`);
    where += ` and ${PENDING_SEARCH.replaceAll("$Q", `$${params.length}`)}`;
  }

  /**
   * ດຶງແຖວ — **ບໍ່ຄິດຍອດສະຕັອກໃນ SQL ອີກແລ້ວ**.
   *
   * ods ໃຊ້ `cross join lateral odg_stock_balance_location(item_code,...)` ຢູ່ນີ້
   * ແຕ່ຟັງຊັນນັ້ນຍິງ dblink ຂ້າມໄປ ERP ໃໝ່ທຸກຄັ້ງທີ່ເອີ້ນ (63ms ຕໍ່ 1 ລາຍການ)
   * ⇒ 48 ແຖວ = ຫຼາຍວິນາທີ. ດຽວນີ້ດຶງແຖວກ່ອນ ແລ້ວຄິດຍອດ **ຄັ້ງດຽວ** ໃຫ້ທຸກລາຍການ
   * ໃນໜ້ານັ້ນ (lib/stock-balance.ts). ວັດຈິງ: 2,915ms → ເບິ່ງລຸ່ມ.
   *
   * ຈັດຮຽງຕາມ "ຄົງເຫຼືອ" ຕ້ອງຮູ້ຍອດກ່ອນ ⇒ ດຶງທຸກແຖວທີ່ຕົງເງື່ອນໄຂ (ຈຳກັດ 500)
   * ຄິດຍອດເທື່ອດຽວ ແລ້ວຮຽງ/ຕັດໜ້າຢູ່ Node.
   */
  const sortsByBalance = PENDING_SORT[sort] === "st.total_balance";
  // ຄົງເຫຼືອບໍ່ມີຢູ່ໃນ SQL ອີກແລ້ວ → ໃຫ້ SQL ຮຽງຕາມເວລາຂໍເບີກໄປກ່ອນ ແລ້ວຮຽງຄືນຢູ່ Node
  const orderBy = sortsByBalance ? order(PENDING_SORT, "elapsed", "desc", "c.spare_reg") : order(PENDING_SORT, sort, dir, "c.spare_reg");

  const rowsSql = `select a.doc_no, c.name_1||'_'||c.sn product, a.product_code, a.item_code, a.item_name,
      a.qty, a.unit_code, e.unit_code inv_unit_code, a.roworder, a.status, b.wh_code,
      to_char(c.spare_reg,'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - c.spare_reg))))::int elapsed_seconds,
      exists(select 1 from ic_trans_detail t
             where t.trans_flag = ${TRANS.TRANSFER} and t.doc_ref = a.doc_no and t.item_code = a.item_code) transfer_requested
    from ic_trans_detail a
    left join ic_trans b on a.doc_no = b.doc_no
    left join tb_product c on c.code = a.product_code
    left join ic_inventory e on a.item_code = e.code
    where ${where}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  /**
   * ນັບແຖວ — ຢ່າໃຊ້ FROM ອັນທີ່ມີ lateral: ການນັບບໍ່ຕ້ອງໃຊ້ຍອດສະຕັອກເລີຍ
   * ແຕ່ຈ່າຍລາຄາເຕັມ (ວັດຈິງ 2,423ms → 36ms ດ້ວຍຜົນລັບດຽວກັນ 48 ແຖວ).
   */
  const countSql = `select count(*)::int total ${PENDING_COUNT_FROM} where ${where}`;

  const [rows, count] = await Promise.all([
    query<RawLine>(rowsSql, sortsByBalance ? [...params, 500, 0] : [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);

  // ຄິດຍອດສະຕັອກຄັ້ງດຽວໃຫ້ທຸກລາຍການທີ່ດຶງມາ (1 ຄຳຖາມໄປ ERP ແທນ 1 ຄັ້ງຕໍ່ແຖວ)
  const balances = await getBalances(rows.rows.map((row) => row.item_code));

  let lines: Line[] = rows.rows.map((row) => {
    const balance = balances.get(row.item_code) ?? { total: 0, byWarehouse: new Map<string, number>() };
    const inWarehouse = row.wh_code ? (balance.byWarehouse.get(row.wh_code) ?? 0) : 0;
    return {
      ...row,
      balance_qty: fmtQty(balance.total),
      balance_qty_wh: fmtQty(inWarehouse),
      owh_qty: fmtQty(balance.total - inWarehouse),
    };
  });

  // ຮຽງຕາມ "ຄົງເຫຼືອ" ເຮັດຢູ່ Node ໄດ້ ເພາະຍອດພຶ່ງຄິດຂຶ້ນມາບ່ອນນີ້
  if (sortsByBalance) {
    lines.sort((a, b) => (dir === "asc" ? 1 : -1) * (Number(a.balance_qty) - Number(b.balance_qty)));
    lines = lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }

  return { rows: lines, total: count.rows[0]?.total ?? 0 };
}

/** ໃບຂໍເບີກຂອງງານຕິດຕັ້ງ — ຍັງບໍ່ທັນຍ້າຍມາ Next.js (ເປັນຂອງໂມດູນຕິດຕັ້ງ) */
async function getInstalls(q: string, page: number, sort: string, dir: SortDir) {
  const params: unknown[] = [TRANS.REQUEST, LINE_STATUS.ISSUED];
  let where = `b.trans_flag = $1 and b.job_type = 'install'
    and b.doc_no in (select distinct doc_no from ic_trans_detail where trans_flag = $1 and status != $2)`;
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where += ` and (b.doc_no ilike ${p} or c.item_name ilike ${p} or d.name_1 ilike ${p} or d.tel ilike ${p})`;
  }

  const from = `from ic_trans b
    left join ods_tb_install c on c.code = b.product_code
    left join ar_customer d on d.code = c.cust_code`;

  const [rows, count] = await Promise.all([
    query<Install>(
      `select b.doc_no, c.item_name product, b.wh_code, d.name_1||'-'||d.tel customer, b.roworder
       ${from} where ${where}
       order by ${order(INSTALL_SORT, sort, dir, "b.doc_no")}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total ${from} where ${where}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ໃບເບີກ (56) / ໃບສັ່ງຊື້ (2) / ໃບຂໍໂອນ (124) — ເມື່ອກ່ອນດຶງແຕ່ 15 ໃບລ່າສຸດ, ດຽວນີ້ແບ່ງໜ້າໄດ້ໝົດ */
async function getDocs(transFlag: number, q: string, page: number, sort: string, dir: SortDir) {
  const params: unknown[] = [transFlag];
  let where = "trans_flag = $1";
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where += ` and (doc_no ilike ${p} or doc_ref ilike ${p} or remark ilike ${p} or user_created ilike ${p})`;
  }

  const [rows, count] = await Promise.all([
    query<Doc>(
      `select doc_no, to_char(doc_date,'DD-MM-YYYY') doc_date, doc_ref,
         to_char(doc_ref_date::date,'DD-MM-YYYY') doc_ref_date, remark
       from ic_trans where ${where}
       order by ${order(DOC_SORT, sort, dir, "doc_no")}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total from ic_trans where ${where}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts(warehouses: string[]) {
  const [pending, installs, docs] = await Promise.all([
    query<{ total: number }>(`select count(*)::int total ${PENDING_COUNT_FROM} where ${PENDING_WHERE}`, [
      TRANS.REQUEST,
      LINE_STATUS.ISSUED,
      warehouses,
    ]),
    query<{ total: number }>(
      `select count(*)::int total from ic_trans b
       where b.trans_flag = $1 and b.job_type = 'install'
         and b.doc_no in (select distinct doc_no from ic_trans_detail where trans_flag = $1 and status != $2)`,
      [TRANS.REQUEST, LINE_STATUS.ISSUED],
    ),
    query<{ trans_flag: number; total: number }>(
      `select trans_flag, count(*)::int total from ic_trans where trans_flag = any($1::int[]) group by trans_flag`,
      [[TRANS.DISPATCH, 2, TRANS.TRANSFER]],
    ),
  ]);
  const byFlag = new Map(docs.rows.map((row) => [Number(row.trans_flag), row.total]));
  return {
    pending: pending.rows[0]?.total ?? 0,
    install: installs.rows[0]?.total ?? 0,
    dispatched: byFlag.get(TRANS.DISPATCH) ?? 0,
    ordered: byFlag.get(2) ?? 0,
    transfers: byFlag.get(TRANS.TRANSFER) ?? 0,
  };
}

/** ປ້າຍບອກວ່າອາໄຫຼ່ຢູ່ໃສ */
function StockChip({ inWh, other }: { inWh: number; other: number }) {
  if (inWh > 0)
    return (
      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">ມີໃນສາງນີ້</span>
    );
  if (other > 0)
    return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">ຢູ່ສາງອື່ນ</span>;
  return <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">ບໍ່ມີໃນສະຕັອກ</span>;
}

const actionClass = "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white";

/** ປຸ່ມທ້າຍແຖວ — ຄືເງື່ອນໄຂໃນ spdispatch.html ຂອງ ods */
function RowAction({ line }: { line: Line }) {
  const total = Number(line.balance_qty ?? 0);
  const inWh = Number(line.balance_qty_wh ?? 0);
  const other = Number(line.owh_qty ?? 0);

  const dispatch = (
    <Link href={`/stock/dispatch/${line.roworder}`} className={`${actionClass} bg-teal-600 hover:bg-teal-700`}>
      <PackageCheck className="size-3.5" />
      ເບີກ
      <LinkPending className="size-3" />
    </Link>
  );
  // ods: /showrequesttrans/<roworder>/<doc_no> — ຂໍໃຫ້ສາງໃຫຍ່ໂອນອາໄຫຼ່ເຂົ້າສາງສ້ອມ
  const transfer = line.transfer_requested ? (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-500">
      <ArrowLeftRight className="size-3.5" />
      ຂໍໂອນແລ້ວ
    </span>
  ) : (
    <Link href={`/stock/transfers/${line.roworder}`} className={`${actionClass} bg-sky-500 hover:bg-sky-600`}>
      <ArrowLeftRight className="size-3.5" />
      ຂໍໂອນ
      <LinkPending className="size-3" />
    </Link>
  );
  // ods: orderspare.py /showsparefororder/<doc_no>/<item_code>
  const purchase = (
    <Link
      href={`/purchase-requests/spare/${encodeURIComponent(line.doc_no)}/${encodeURIComponent(line.item_code)}`}
      className={`${actionClass} bg-indigo-600 hover:bg-indigo-700`}
    >
      <ShoppingCart className="size-3.5" />
      ສັ່ງຊື້
      <LinkPending className="size-3" />
    </Link>
  );

  if (line.status === LINE_STATUS.ON_PURCHASE_ORDER) {
    if (inWh > 0) return dispatch;
    if (other > 0) return transfer;
    return <span className="text-[11px] font-semibold text-indigo-600">ກຳລັງສັ່ງຊື້</span>;
  }
  if (total < 1) return purchase;
  if (inWh > 0) return dispatch;
  return transfer;
}

const PENDING_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທີໃບຂໍເບີກ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ສິນຄ້າ", defaultDir: "asc" },
  { key: "item", label: "ອາໄຫຼ່", defaultDir: "asc" },
  { key: "qty", label: "ຈຳນວນ", defaultDir: "desc" },
  { key: "balance", label: "ຄົງເຫຼືອ", defaultDir: "desc" },
];

const DOC_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທີ", defaultDir: "desc" },
  { key: "doc_date", label: "ວັນທີ", defaultDir: "desc" },
  { key: "doc_ref", label: "ເລກໃບອ້າງອີງ", defaultDir: "desc" },
  { key: "remark", label: "ໝາຍເຫດ", defaultDir: "asc" },
];

const INSTALL_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທີຂໍເບີກ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການຕິດຕັ້ງ", defaultDir: "asc" },
  { key: "wh", label: "ສາງ", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
];

export default async function StockDispatchPage({ searchParams }: Props) {
  const session = await getSession();
  const warehouses = await getOwnWarehouses(session?.username ?? "");

  const params = await searchParams;
  const tab: Tab =
    params.tab === "install" || params.tab === "dispatched" || params.tab === "ordered" || params.tab === "transfers"
      ? params.tab
      : "pending";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (tab === "pending" ? "elapsed" : "doc_no")).trim();

  const load = async (): Promise<{ rows: Line[] | Install[] | Doc[]; total: number }> => {
    if (tab === "pending") return getPending(warehouses, q, page, sort, dir);
    if (tab === "install") return getInstalls(q, page, sort, dir);
    // ໃບເບີກ (56) · ໃບສັ່ງຊື້ (2) · ໃບຂໍໂອນ (124)
    const flag = tab === "dispatched" ? TRANS.DISPATCH : tab === "ordered" ? 2 : TRANS.TRANSFER;
    return getDocs(flag, q, page, sort, dir);
  };

  const [counts, data] = await Promise.all([getCounts(warehouses), load()]);

  const total = data.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "pending" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/stock/dispatch?${new URLSearchParams({ ...(target !== "pending" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/dispatch?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/dispatch?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof PackageCheck; count: number }[] = [
    { key: "pending", label: "ລໍຖ້າເບີກ", icon: PackageCheck, count: counts.pending },
    { key: "install", label: "ງານຕິດຕັ້ງ", icon: Hammer, count: counts.install },
    { key: "dispatched", label: "ໃບເບີກອາໄຫຼ່", icon: FileText, count: counts.dispatched },
    { key: "transfers", label: "ໃບຂໍໂອນ", icon: ArrowLeftRight, count: counts.transfers },
    { key: "ordered", label: "ໃບສັ່ງຊື້ອາໄຫຼ່", icon: ShoppingCart, count: counts.ordered },
  ];

  const lines = tab === "pending" ? (data.rows as Line[]) : [];
  const installs = tab === "install" ? (data.rows as Install[]) : [];
  const docs = tab === "dispatched" || tab === "ordered" || tab === "transfers" ? (data.rows as Doc[]) : [];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ເບີກອາໄຫຼ່</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ສາງ: {warehouses.join(", ")} · {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <form action={refreshInventory}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="size-4" />
              refresh
            </button>
          </form>
          {/* ods: stock_print.py /home_rq1_print (56) — ລາຍງານໃບເບີກອາໄຫຼ່ */}
          <Link
            href="/reports/stock?tab=56"
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
              placeholder="ຄົ້ນຫາ ເລກທີ, ອາໄຫຼ່, ສິນຄ້າ, ໝາຍເຫດ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {tab === "pending" && (
            <table className="w-full min-w-[1250px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {PENDING_COLUMNS.map((column) => (
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
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສາງຈ່າຍ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສາງອື່ນ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const tone = elapsedTone(line.elapsed_seconds);
                  const inWh = Number(line.balance_qty_wh ?? 0);
                  const other = Number(line.owh_qty ?? 0);
                  return (
                    <tr key={line.roworder} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                        <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                        <Link
                          href={`/stock/requests/view/${encodeURIComponent(line.doc_no)}`}
                          className="hover:underline"
                        >
                          {line.doc_no}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Elapsed
                          seconds={line.elapsed_seconds}
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                        />
                        <span className="mt-0.5 block text-[10px] text-slate-400">{line.at_time ?? "-"}</span>
                      </td>
                      <td className="max-w-56 truncate px-3 py-2.5" title={line.product ?? ""}>
                        {line.product ?? "-"}
                      </td>
                      <td className="max-w-64 px-3 py-2.5">
                        <span className="block truncate font-medium text-slate-800" title={line.item_name ?? ""}>
                          {line.item_name ?? "-"}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">{line.item_code}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        {Number(line.qty)}{" "}
                        <span className="text-[10px] text-slate-400">{line.unit_code ?? ""}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        {Number(line.balance_qty ?? 0)}{" "}
                        <span className="text-[10px] text-slate-400">{line.inv_unit_code ?? ""}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-emerald-700">
                        {inWh}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">{other}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <StockChip inWh={inWh} other={other} />
                        {line.status === LINE_STATUS.ON_PURCHASE_ORDER && (
                          <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            ກຳລັງສັ່ງຊື້
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <RowAction line={line} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "install" && (
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {INSTALL_COLUMNS.map((column) => (
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
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {installs.map((row) => (
                  <tr key={row.roworder} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{row.doc_no}</td>
                    <td className="max-w-72 truncate px-3 py-2.5" title={row.product ?? ""}>
                      {row.product ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.wh_code ?? "-"}</td>
                    <td className="max-w-56 truncate px-3 py-2.5" title={row.customer ?? ""}>
                      {row.customer ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        title="ຍັງບໍ່ທັນຍ້າຍມາ Next.js"
                        className="inline-flex h-8 cursor-not-allowed items-center rounded-lg bg-slate-200 px-3 text-xs font-semibold text-slate-500"
                      >
                        ເບີກ
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {(tab === "dispatched" || tab === "ordered" || tab === "transfers") && (
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {DOC_COLUMNS.map((column) => (
                    <SortHeader
                      key={column.key}
                      label={column.key === "doc_ref" && tab !== "ordered" ? "ເລກໃບຂໍເບີກ" : column.label}
                      sortKey={column.key}
                      current={sort}
                      dir={dir}
                      href={sortHref}
                      defaultDir={column.defaultDir}
                      className="py-2.5"
                    />
                  ))}
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ວັນທີອ້າງອີງ</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{doc.doc_no}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{doc.doc_date ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{doc.doc_ref ?? "-"}</td>
                    <td className="max-w-72 truncate px-3 py-2.5" title={doc.remark ?? ""}>
                      {doc.remark ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{doc.doc_ref_date ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {tab === "dispatched" ? (
                        <Link
                          href={`/stock/dispatch/bill/${encodeURIComponent(doc.doc_no)}`}
                          className={`${actionClass} bg-sky-500 hover:bg-sky-600`}
                        >
                          ເບີ່ງ
                          <LinkPending className="size-3" />
                        </Link>
                      ) : (
                        <span
                          title="ຍັງບໍ່ທັນຍ້າຍມາ Next.js"
                          className="inline-flex h-8 cursor-not-allowed items-center rounded-lg bg-slate-200 px-3 text-xs font-semibold text-slate-500"
                        >
                          ເບີ່ງ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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
