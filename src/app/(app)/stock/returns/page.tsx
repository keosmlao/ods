import { syncErpReturns } from "@/lib/erp-dispatch";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { Todo } from "@/components/ui";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { Activity, Ban, ChevronLeft, ChevronRight, FileBarChart, PackageOpen, Undo2 } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { ReturnFilters } from "./filters";
import { ReturnRequestButton } from "./return-request-button";

/** ods: stock.py /stock_return + templates/stock/home_return.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "dispatched" | "cancelled" | "requested" | "movements";
type Props = {
  searchParams: Promise<{ tab?: string; q?: string; job?: string; page?: string; sort?: string; dir?: string }>;
};

type Doc = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  doc_ref_date: string | null;
  remark: string | null;
  product_code: string | null;
  job_type: string | null;
  elapsed_seconds: number | null;
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

/**
 * ໃບເບີກທີ່ຍັງມີອາໄຫຼ່ຄ້າງ → ຂໍສົ່ງຄືນໄດ້.
 *
 * ຜົນລັບຄືກັບ ods ທຸກປະການ ແຕ່ຂຽນຄືນເລື່ອງຄວາມໄວ: ods ໃຊ້ correlated
 * `NOT IN (select doc_ref ... where doc_ref = a.doc_no)` ເຊິ່ງ scan ic_trans ໃໝ່ທຸກແຖວ
 * → ໃຊ້ເວລາ 78 ວິນາທີ. ເນື່ອງຈາກ subquery ມີ `doc_ref = a.doc_no` ຢູ່ແລ້ວ ມັນຈຶ່ງທຽບເທົ່າ
 * NOT EXISTS ພໍດີ — ຂຽນແບບນີ້ໃຊ້ index ໄດ້ (idx_ic_trans_doc_no), ເຫຼືອ ~0.1 ວິນາທີ.
 *
 * ໝາຍເຫດ: ຕ້ອງໃສ່ວົງເລັບຄຸມ (A or B) ໄວ້ ຈຶ່ງເອົາຕົວກອງອື່ນ (ຄົ້ນຫາ/ປະເພດວຽກ) ມາ AND ຕໍ່ໄດ້ຢ່າງຖືກຕ້ອງ.
 */
const DISPATCHED_SQL = `(
     ( a.trans_flag = $1 and a.used_status = 0 and a.status = 0
       and not exists (select 1 from ic_trans t
                       where t.doc_ref = a.doc_no and t.used_status = 0 and t.status = 3) )
  or exists (select 1 from ic_trans_detail d
             where d.doc_no = a.doc_no and d.doc_no like 'SWC%' and d.status = $2)
)`;

/** ໃບເບີກທີ່ຂໍສົ່ງຄືນແລ້ວ (status = 3) — ຮັບເລກ placeholder ຂອງ status ເພາະໃຊ້ຮ່ວມກັບ query ນັບແທັບ */
const requestedSql = (statusPlaceholder: string) => `(a.trans_flag = $1 and a.status = ${statusPlaceholder})`;

/**
 * ງານທີ່ **ຍົກເລີກແລ້ວ ແຕ່ອາໄຫຼ່ຍັງຢູ່ນອກສາງ** — ຄິວ "ຖ້າສົ່ງຄືນ".
 *
 * ໃບເບີກຂອງງານພວກນີ້ເຄີຍປົນຢູ່ໃນລາຍການເບີກລວມ (4,600+ ໃບ) ຈຶ່ງບໍ່ມີໃຜເຫັນ:
 * ຕະຫຼອດ 3 ປີ **ບໍ່ເຄີຍມີໃບຂໍສົ່ງຄືນ (59) ຂອງງານ INST- ຈັກໃບ** ທັງທີ່ INST-5849 /
 * INST-5850 / INST-6864 ມີອາໄຫຼ່ 36 ແຖວ (12 ໃບເບີກ) ຄ້າງນອກສາງ ⇒ ຂອງຫາຍໄປຈາກສາງ
 * ໂດຍບໍ່ມີເອກະສານຮັບຮູ້. ດຶງແຍກອອກມາເປັນຄິວຂອງຕົນເອງ ພ້ອມລາຍການອາໄຫຼ່ໃຫ້ເຫັນເລີຍ.
 *
 * ຄຸມທັງສອງສາຍງານ — ນິຍາມ "ຍົກເລີກ" ຄົນລະຕາຕະລາງ:
 *   ຕິດຕັ້ງ (job_type='install') → ods_tb_install.cancel_date  (lib/install-stage ຂັ້ນ -1)
 *   ສ້ອມແປງ                      → tb_product.status = 6       (lib/stage ຂັ້ນ -1)
 */
const CANCELLED_JOB_SQL = `(
    ( a.job_type = 'install'
      and exists (select 1 from ods_tb_install i
                  where i.code = a.product_code and i.cancel_date is not null) )
 or ( coalesce(a.job_type,'') <> 'install'
      and exists (select 1 from tb_product p
                  where p.code = a.product_code and p.status = 6) )
)`;

/** ແທັບທີ່ຍັງ "ຂໍສົ່ງຄືນໄດ້" (ມີປຸ່ມ) — ລາຍການເບີກລວມ ແລະ ຄິວງານທີ່ຍົກເລີກ */
const canRequest = (tab: Tab) => tab === "dispatched" || tab === "cancelled";

type SpareLine = { doc_no: string; item_code: string | null; item_name: string | null; qty: string; unit_code: string | null };

/**
 * ອາໄຫຼ່ທີ່ຍັງຄ້າງນອກສາງ ຂອງໃບເບີກທີ່ສະແດງຢູ່ໜ້ານີ້ — ນິຍາມດຽວກັນກັບ
 * installations/outstanding.ts: ແຖວ status 0 (ຈ່າຍອອກແລ້ວ ຍັງບໍ່ມາຮັບ) ຫຼື 1 (ຮັບໄປແລ້ວ).
 * ສະຕັອກຖືກຕັດຕັ້ງແຕ່ຕອນສາງເບີກ (56) ⇒ ສອງກໍລະນີນີ້ຂອງຢູ່ນອກສາງທັງຄູ່.
 */
async function getSpareLines(docNos: string[]): Promise<Map<string, SpareLine[]>> {
  const grouped = new Map<string, SpareLine[]>();
  if (docNos.length === 0) return grouped;

  const result = await query<SpareLine>(
    `select d.doc_no, d.item_code, d.item_name, coalesce(d.qty,0)::text qty, d.unit_code
       from ic_trans_detail d
      where d.doc_no = any($1::varchar[]) and d.status = any($2::int[])
      order by d.doc_no, d.roworder`,
    [docNos, [LINE_STATUS.PENDING, LINE_STATUS.ISSUED]],
  );
  for (const row of result.rows) {
    const lines = grouped.get(row.doc_no) ?? [];
    lines.push(row);
    grouped.set(row.doc_no, lines);
  }
  return grouped;
}

const DOC_SEARCH = "(a.doc_no ilike $Q or a.doc_ref ilike $Q or a.remark ilike $Q or a.product_code ilike $Q)";
const MOVE_SEARCH = "(a.code ilike $Q or a.name_1 ilike $Q or a.sn ilike $Q or a.p_model ilike $Q or a.p_brand ilike $Q or a.emp_code ilike $Q)";

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const DOC_SORT: Record<string, string> = {
  doc_no: "a.doc_no",
  elapsed: "at_col",
  doc_ref: "a.doc_ref",
  product: "a.product_code",
  remark: "a.remark",
};
const MOVE_SORT: Record<string, string> = {
  product: "a.name_1",
  model: "a.p_model",
  sn: "a.sn",
  brand: "a.p_brand",
  elapsed: "at_col",
  technician: "a.emp_code",
};

/** ວັນ/ເວລາທີ່ອອກໃບເບີກ — ໃຊ້ນັບ "ຄ້າງມາ" (create_date_time_now ມີຄົບທຸກແຖວ) */
const DOC_AT = "coalesce(a.create_date_time_now, a.doc_date::timestamp)";

/** ເອກະສານ (ແທັບ "ລາຍການເບີກອາໄຫຼ່" ແລະ "ຂໍສົ່ງຄືນແລ້ວ") */
type DocTab = Exclude<Tab, "movements">;

async function getDocs(tab: DocTab, q: string, job: string, page: number, sort: string, dir: SortDir) {
  const params: (string | number)[] = canRequest(tab)
    ? [TRANS.DISPATCH, LINE_STATUS.PENDING]
    : [TRANS.DISPATCH, LINE_STATUS.RETURN_REQUESTED];
  const where = [canRequest(tab) ? DISPATCHED_SQL : requestedSql("$2")];
  // ຄິວ "ຍົກເລີກ" = ໃບເບີກທີ່ຍັງຄືນໄດ້ ແລະ ງານເຈົ້າຂອງຖືກຍົກເລີກແລ້ວ
  if (tab === "cancelled") where.push(CANCELLED_JOB_SQL);

  if (q) { params.push(`%${q}%`); where.push(DOC_SEARCH.replaceAll("$Q", `$${params.length}`)); }
  // ງານສ້ອມແປງ = job_type ວ່າງ · ງານຕິດຕັ້ງ = 'install'
  if (job === "install") where.push("a.job_type = 'install'");
  else if (job === "repair") where.push("coalesce(a.job_type,'') <> 'install'");
  const filter = where.join(" and ");

  const column = DOC_SORT[sort] ?? "at_col";
  const orderBy = column === "at_col" ? `${DOC_AT} ${dir} nulls last` : `${column} ${dir} nulls last`;

  // ods ດຶງທຸກແຖວ (4,600+) ມາໃສ່ໜ້າດຽວ — ຢູ່ນີ້ແບ່ງໜ້າຢູ່ຝັ່ງ DB
  const rowsSql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.doc_ref,
      to_char(a.doc_ref_date::date,'DD-MM-YYYY') doc_ref_date, a.remark, a.product_code, a.job_type,
      greatest(0, round(extract(epoch from (localtimestamp - ${DOC_AT}))))::int elapsed_seconds
    from ic_trans a where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;
  const countSql = `select count(*)::int total from ic_trans a where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Doc>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ການເຄື່ອນໃຫວອາໄຫຼ່ຂອງແຕ່ລະເຄື່ອງ (tb_product.used_spare = 1) */
async function getMovements(q: string, page: number, sort: string, dir: SortDir) {
  const params: (string | number)[] = [];
  const where = ["a.used_spare = 1"];
  if (q) { params.push(`%${q}%`); where.push(MOVE_SEARCH.replaceAll("$Q", `$${params.length}`)); }
  const filter = where.join(" and ");

  const column = MOVE_SORT[sort] ?? "at_col";
  const orderBy = column === "at_col" ? `a.spare_reg ${dir} nulls last` : `${column} ${dir} nulls last`;

  const rowsSql = `select a.code, a.name_1, a.p_model, a.sn, a.p_brand,
      to_char(a.spare_reg,'DD-MM-YYYY HH24:MI') reg_at,
      to_char(a.spare_finish,'DD-MM-YYYY HH24:MI') finish_at,
      greatest(0, round(extract(epoch from (coalesce(a.spare_finish, localtimestamp) - a.spare_reg))))::int elapsed_seconds,
      a.emp_code,
      case when a.spare_reg is null then 'ລໍຖ້າດຳເນີນການອາໄຫຼ່'
           when a.spare_finish is null then 'ລໍຖ້າສາງເບີກ' else 'ເບີກສຳເລັດ' end status_name
    from tb_product a where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;
  const countSql = `select count(*)::int total from tb_product a where ${filter}`;

  const [rows, count] = await Promise.all([
    query<MoveRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts(job: "install" | "repair") {
  const jobSql = job === "install" ? "a.job_type = 'install'" : "coalesce(a.job_type,'') <> 'install'";
  const docSql = `select count(*) filter (where ${DISPATCHED_SQL} and ${jobSql})::int dispatched,
      count(*) filter (where ${DISPATCHED_SQL} and ${CANCELLED_JOB_SQL} and ${jobSql})::int cancelled,
      count(*) filter (where ${requestedSql("$3")} and ${jobSql})::int requested
    from ic_trans a`;
  // ການເຄື່ອນໄຫວອ່ານຈາກ tb_product ຈຶ່ງເປັນສາຍສ້ອມແປງເທົ່ານັ້ນ
  const moveSql = job === "repair"
    ? "select count(*)::int total from tb_product a where a.used_spare = 1"
    : "select 0::int total";

  const [docs, moves] = await Promise.all([
    query<{ dispatched: number; cancelled: number; requested: number }>(docSql, [
      TRANS.DISPATCH,
      LINE_STATUS.PENDING,
      LINE_STATUS.RETURN_REQUESTED,
    ]),
    query<{ total: number }>(moveSql),
  ]);
  return {
    dispatched: docs.rows[0]?.dispatched ?? 0,
    cancelled: docs.rows[0]?.cancelled ?? 0,
    requested: docs.rows[0]?.requested ?? 0,
    movements: moves.rows[0]?.total ?? 0,
  };
}

/**
 * ຫົວຕາຕະລາງ: ods ຂຽນ "ລູກຄ້າ/ລາຍການ/Model/SN..." ໄວ້ ແຕ່ query ຄືນຄ່າຄໍລຳຂອງເອກະສານ
 * (doc_no, doc_date, doc_ref, ...) → ຫົວກັບຂໍ້ມູນບໍ່ຕົງກັນ. ຢູ່ນີ້ໃສ່ຫົວໃຫ້ຕົງກັບຂໍ້ມູນຈິງ.
 */
const DOC_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທີໃບເບີກ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "asc" },
  { key: "doc_ref", label: "ເລກທີໃບກວດເຊັກ", defaultDir: "desc" },
  { key: "product", label: "ລະຫັດເຄື່ອງ", defaultDir: "desc" },
  { key: "remark", label: "ໝາຍເຫດ", defaultDir: "asc" },
];

const MOVE_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "product", label: "ລາຍການ", defaultDir: "asc" },
  { key: "model", label: "Model", defaultDir: "asc" },
  { key: "sn", label: "SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "elapsed", label: "ໄລຍະເວລາ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
];

/** ປ້າຍປະເພດວຽກ */
function JobBadge({ jobType }: { jobType: string | null }) {
  const install = jobType === "install";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        install ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {install ? "ຕິດຕັ້ງ" : "ສ້ອມແປງ"}
    </span>
  );
}

export default async function StockReturnsPage({ searchParams }: Props) {
  // ດຶງໃບຮັບຄືນຈາກ ERP ກ່ອນ ⇒ ຄິວທີ່ເຫັນເປັນຄວາມຈິງລ້າສຸດ
  await syncErpReturns();

  const params = await searchParams;
  // ໜ້າສ້ອມແປງເປັນຄ່າເລີ່ມຕົ້ນ; ງານຕິດຕັ້ງຕ້ອງເຂົ້າດ້ວຍ job=install
  // ບໍ່ມີສະຖານະ "ທັງໝົດ" ເພື່ອບໍ່ໃຫ້ສອງ workflow ປົນກັນອີກ
  const job: "install" | "repair" = params.job === "install" ? "install" : "repair";
  const tab: Tab =
    params.tab === "requested"
      ? "requested"
      : params.tab === "movements" && job === "repair"
        ? "movements"
        : params.tab === "cancelled"
          ? "cancelled"
          : "dispatched";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, list] = await Promise.all([
    getCounts(job),
    tab === "movements" ? getMovements(q, page, sort, dir) : getDocs(tab, q, job, page, sort, dir),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  // ຄິວ "ຍົກເລີກ" ສະແດງ **ລາຍການອາໄຫຼ່** ຂອງແຕ່ລະໃບເບີກນຳ — ດຶງສະເພາະໃບທີ່ຢູ່ໜ້ານີ້
  const spareLines =
    tab === "cancelled"
      ? await getSpareLines((list.rows as Doc[]).map((doc) => doc.doc_no))
      : new Map<string, SpareLine[]>();

  const base = () => ({ ...(tab !== "dispatched" && { tab }), ...(q && { q }), job });
  const tabHref = (target: Tab) =>
    `/stock/returns?${new URLSearchParams({ ...(target !== "dispatched" && { tab: target }), ...(q && { q }), job })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/returns?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/returns?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof PackageOpen; count: number }[] = [
    { key: "dispatched", label: "ລາຍການເບີກອາໄຫຼ່", icon: PackageOpen, count: counts.dispatched },
    // ງານຍົກເລີກແຕ່ອາໄຫຼ່ຍັງຢູ່ນອກສາງ — ຕ້ອງສ້າງໃບຂໍຄືນ ບໍ່ດັ່ງນັ້ນຂອງຫາຍໂດຍບໍ່ມີເອກະສານ
    { key: "cancelled", label: "ຍົກເລີກ — ຖ້າສົ່ງຄືນ", icon: Ban, count: counts.cancelled },
    { key: "requested", label: "ລາຍການຂໍສົ່ງ​ຄືນອາໄລ່", icon: Undo2, count: counts.requested },
    ...(job === "repair"
      ? [{ key: "movements" as const, label: "ການເຄື່ອນໃຫວ", icon: Activity, count: counts.movements }]
      : []),
  ];

  const docs = tab === "movements" ? [] : (list.rows as Doc[]);
  const moves = tab === "movements" ? (list.rows as MoveRow[]) : [];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">
            ສົ່ງຄືນອາໄຫຼ່ ({job === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມແປງ"})
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ໃບຂໍສົ່ງອາໄຫຼ່ · {list.total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
        <Todo className="h-9 px-3 text-xs">
          <FileBarChart className="size-4" />
          ລາຍງານ
        </Todo>
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

        <ReturnFilters
          q={q}
          job={job}
          tab={tab}
          sort={sort}
          dir={dir}
          showJob={tab !== "movements"}
          placeholder={
            tab === "movements" ? "ຄົ້ນຫາ ລາຍການ, SN, ຫຍີ່ຫໍ້, ຊ່າງ..." : "ຄົ້ນຫາ ເລກທີ, ໃບກວດເຊັກ, ໝາຍເຫດ..."
          }
        />
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {tab === "movements" ? (
            <table className="w-full min-w-[1100px] border-collapse text-xs">
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
                {moves.map((row) => {
                  const done = row.status_name === "ເບີກສຳເລັດ";
                  // ເບີກແລ້ວ = ຢຸດຈັບເວລາ (ບໍ່ຕ້ອງເຕືອນສີ) · ຍັງບໍ່ເບີກ = ນັບຕໍ່ ແລະ ເຕືອນຕາມເວລາ
                  const tone = done ? { chip: "bg-slate-100 text-slate-500", bar: "" } : elapsedTone(row.elapsed_seconds);
                  return (
                    <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="max-w-64 px-3 py-2.5">
                        <Link href={`/service/${row.code}`} className="block truncate font-medium text-[#0536a9] hover:underline" title={row.name_1 ?? ""}>
                          {row.name_1 || "-"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.p_model || "-"}</td>
                      <td className="max-w-40 truncate px-3 py-2.5" title={row.sn ?? ""}>{row.sn || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.p_brand || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {done ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone.chip}`}>
                            {/* ຄ່າຄົງທີ່ — ຈາກຂໍເບີກຫາເບີກສຳເລັດ */}
                            {formatSpan(row.elapsed_seconds)}
                          </span>
                        ) : (
                          <Elapsed
                            seconds={row.elapsed_seconds}
                            className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.emp_code || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{row.reg_at ?? "ລໍຖ້າ"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{row.finish_at ?? "ລໍຖ້າ"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            done
                              ? "bg-emerald-50 text-emerald-700"
                              : row.reg_at
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
          ) : (
            <table className="w-full min-w-[1100px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {DOC_COLUMNS.map((column) => (
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
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
                  {canRequest(tab) && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const tone = elapsedTone(doc.elapsed_seconds);
                  const lines = spareLines.get(doc.doc_no) ?? [];
                  return (
                    <Fragment key={doc.doc_no}>
                    <tr className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                        <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                        {doc.doc_no}
                        <span className="mt-0.5 block">
                          <JobBadge jobType={doc.job_type} />
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Elapsed
                          seconds={doc.elapsed_seconds}
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                        />
                        <span className="mt-0.5 block text-[10px] text-slate-400">{doc.doc_date ?? "-"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {doc.doc_ref || "-"}
                        <span className="mt-0.5 block text-[10px] text-slate-400">{doc.doc_ref_date ?? "-"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{doc.product_code || "-"}</td>
                      <td className="max-w-72 truncate px-3 py-2.5" title={doc.remark ?? ""}>
                        {doc.remark || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            tab === "cancelled"
                              ? "bg-red-100 text-red-700"
                              : tab === "dispatched"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {tab === "cancelled"
                            ? "ງານຍົກເລີກ — ຕ້ອງສົ່ງຄືນ"
                            : tab === "dispatched"
                              ? "ເບີກອາໄຫຼ່ສຳເລັດ"
                              : "ຂໍສົ່ງຄືນອາໄຫຼ່"}
                        </span>
                      </td>
                      {canRequest(tab) && (
                        <td className="whitespace-nowrap px-3 py-2.5 text-center">
                          <ReturnRequestButton docNo={doc.doc_no} jobType={doc.job_type} />
                        </td>
                      )}
                    </tr>

                    {/* ລາຍການອາໄຫຼ່ທີ່ຍັງຄ້າງນອກສາງຂອງໃບເບີກນີ້ — ຄິວ "ຍົກເລີກ" ເທົ່ານັ້ນ */}
                    {tab === "cancelled" && lines.length > 0 && (
                      <tr className="border-b border-slate-100 bg-red-50/40">
                        <td colSpan={DOC_COLUMNS.length + 2} className="px-3 pb-3 pt-0">
                          <p className="mb-1 text-[11px] font-bold text-red-800">
                            ອາໄຫຼ່ຄ້າງນອກສາງ {lines.length} ລາຍການ
                          </p>
                          <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                            {lines.map((line, index) => (
                              <li key={`${doc.doc_no}-${line.item_code}-${index}`} className="text-[11px] text-slate-600">
                                {line.item_code} · {line.item_name || "-"} ·{" "}
                                <b className="text-slate-800">
                                  {Number(line.qty).toLocaleString()} {line.unit_code ?? ""}
                                </b>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {list.total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} ຈາກ {list.total.toLocaleString()}
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

/** ໄລຍະເວລາທີ່ຈົບແລ້ວ — ຮູບແບບດຽວກັບ <Elapsed> ແຕ່ບໍ່ເດີນ */
function formatSpan(seconds: number | null) {
  if (seconds == null) return "-";
  const days = Math.floor(seconds / 86400);
  const rest = seconds % 86400;
  const clock = [Math.floor(rest / 3600), Math.floor((rest % 3600) / 60), rest % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  return days > 0 ? `${days} ມື້ ${clock}` : clock;
}
