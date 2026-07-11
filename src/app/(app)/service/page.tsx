import { LinkPending } from "@/components/link-pending";
import { SelectField } from "@/components/select-field";
import { ServiceBoard, STAGES, type BoardCard } from "@/components/service-board";
import { ServicePendingTable } from "@/components/service-pending-table";
import type { SortDir } from "@/components/sort-header";
import { ServiceTable, type TableRow } from "@/components/service-table";
import { query } from "@/lib/db";
import { CANCELLED_JOBS, DONE_JOBS, OPEN_JOBS, STAGE_SQL } from "@/lib/stage";
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileBarChart, FilePlus2, LayoutGrid, Search, Table2, XCircle } from "lucide-react";
import Link from "next/link";

/** 3 ແທັບ: ວຽກຄ້າງ · ຈົບແລ້ວ · ຍົກເລີກ */
type Tab = "pending" | "done" | "cancelled";
type Props = { searchParams: Promise<{ q?: string; tab?: string; page?: string; view?: string; status?: string; sort?: string; dir?: string }> };

/**
 * ຂັ້ນທີ່ວຽກກຳລັງຄ້າງຢູ່ ເລີ່ມແຕ່ເມື່ອໃດ — ໃຊ້ຄຳນວນວ່າຄ້າງດົນປານໃດແລ້ວ.
 * ຂັ້ນ (STAGE_SQL) ຄຳນວນມາຈາກ timestamp ເຫຼົ່ານີ້ຢູ່ແລ້ວ.
 */
const STAGE_SINCE = `case (${STAGE_SQL})
  when 1 then a.time_register
  when 2 then a.time_check
  when 3 then a.time_finish_check
  when 4 then a.qt_start
  when 5 then coalesce(a.qt_finish, a.time_finish_check)
  when 6 then a.spare_reg
  when 7 then a.spare_order
  when 8 then coalesce(a.spare_finish, a.time_finish_check)
  when 9 then a.time_repair
  when 10 then a.time_finish_repair
end`;

const SEARCH = `(a.code ilike $1 or a.sn ilike $1 or a.name_1 ilike $1 or a.p_brand ilike $1
  or a.issue ilike $1 or b.name_1 ilike $1 or b.tel ilike $1)`;

/** ວຽກທີ່ຍັງຄ້າງ (ຂັ້ນ 1..10) — ສຳລັບກະດານ */
async function getBoard(q: string, status: number | null) {
  const where = [OPEN_JOBS];
  const params: (string | number)[] = [];
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$1", `$${params.length}`)); }
  if (status) { params.push(status); where.push(`(${STAGE_SQL}) = $${params.length}`); }

  // ບໍ່ດຶງຮູບ: ບັດ 98 ໃບ = 98 request ໄປ /api/uploads ພ້ອມກັນ → ໜ້າຊ້າ.
  // ຮູບຍັງເບິ່ງໄດ້ຢູ່ໜ້າລາຍລະອຽດ ແລະ ຕາຕະລາງ "ຈົບແລ້ວ".
  const sql = `select a.code, (${STAGE_SQL}) stage, b.name_1 customer,
      concat_ws(' ', a.name_1, a.p_model) product, a.sn, a.p_brand brand,
      a.warrunty warranty, a.emp_code technician, a.user_regis creator,
      round(extract(epoch from (now() - (${STAGE_SINCE}))))::int stage_seconds
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${where.join(" and ")}`;
  return (await query<BoardCard>(sql, params)).rows;
}

/** ວຽກທີ່ຈົບແລ້ວ / ຍົກເລີກ — ບໍ່ຂຶ້ນກະດານ (ມີເປັນພັນໃບ), ເບິ່ງເປັນຕາຕະລາງແທນ */
export const PAGE_SIZE = 20;

/** ຖັນທີ່ຈັດຮຽງໄດ້ໃນແທັບ ຈົບແລ້ວ/ຍົກເລີກ — whitelist ກັນ SQL injection */
const CLOSED_SORT_SQL: Record<string, string> = {
  code: "a.roworder",
  registered: "a.time_register",
  customer: "b.name_1",
  product: "a.name_1",
  brand: "a.p_brand",
  technician: "a.emp_code",
  receiver: "a.user_regis",
};

async function getClosed(tab: "done" | "cancelled", q: string, page: number, sort: string, dir: "asc" | "desc") {
  // ຈົບແລ້ວ = ສົ່ງຄືນສຳເລັດ (ຂັ້ນ 11) · ຍົກເລີກ = ຂັ້ນ -1
  const where = [tab === "done" ? DONE_JOBS : CANCELLED_JOBS];
  const params: (string | number)[] = [];
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$1", `$${params.length}`)); }
  const filter = where.join(" and ");
  const orderBy = `${CLOSED_SORT_SQL[sort] ?? "a.roworder"} ${dir === "asc" ? "asc" : "desc"}`;

  // ບໍ່ດຶງຮູບ ດ້ວຍເຫດຜົນດຽວກັບກະດານ — ແຕ່ລະຮູບ = 1 request ໄປ /api/uploads
  const rowsSql = `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
      concat_ws('-', b.name_1, b.tel) customer, concat_ws(' ', a.name_1, a.p_model) product, a.sn,
      a.p_brand brand, a.warrunty warranty, a.issue, a.emp_code technician, a.user_regis receiver,
      a.status raw_status,
      case (${STAGE_SQL}) when 11 then 'ສົ່ງຄືນສຳເລັດ' when -1 then 'ຍົກເລີກເເລ້ວ' else '-' end status
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${filter}
    order by ${orderBy} limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${filter}`;

  const [rows, count] = await Promise.all([
    query<TableRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

async function getNoticeCount() {
  const sql = `select count(*)::int count from tb_product_notice
    where code not in (select ref_notice from tb_product where ref_notice is not null)`;
  return (await query<{ count: number }>(sql)).rows[0]?.count ?? 0;
}

/** ຈັດຮຽງວຽກຄ້າງ — ຂໍ້ມູນໂຫຼດຄົບແລ້ວ ຈຶ່ງຮຽງຢູ່ນີ້ໄດ້ */
function sortPending(cards: BoardCard[], sort: string, dir: SortDir): BoardCard[] {
  const sign = dir === "asc" ? 1 : -1;
  const text = (value: string | null) => (value ?? "").toLowerCase();

  const compare: Record<string, (a: BoardCard, b: BoardCard) => number> = {
    code: (a, b) => (Number(a.code) || 0) - (Number(b.code) || 0),
    status: (a, b) => a.stage - b.stage,
    elapsed: (a, b) => (a.stage_seconds ?? 0) - (b.stage_seconds ?? 0),
    product: (a, b) => text(a.product).localeCompare(text(b.product)),
    brand: (a, b) => text(a.brand).localeCompare(text(b.brand)),
    customer: (a, b) => text(a.customer).localeCompare(text(b.customer)),
    technician: (a, b) => text(a.technician).localeCompare(text(b.technician)),
    creator: (a, b) => text(a.creator).localeCompare(text(b.creator)),
  };

  const fn = compare[sort] ?? compare.elapsed;
  return [...cards].sort((a, b) => sign * fn(a, b));
}

export default async function ServicePage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tab: Tab = params.tab === "done" ? "done" : params.tab === "cancelled" ? "cancelled" : "pending";
  const isPending = tab === "pending";
  // ວຽກຄ້າງ: ຕາຕະລາງເປັນຄ່າຕັ້ງຕົ້ນ, ກະດານເປັນທາງເລືອກ
  const board_view = isPending && params.view === "board";
  const page = Math.max(1, Number(params.page) || 1);

  // ຕົວກອງສະຖານະ (ສະເພາະແທັບວຽກຄ້າງ) — 1..10
  const statusRaw = Number(params.status);
  const status = isPending && statusRaw >= 1 && statusRaw <= 10 ? statusRaw : null;

  // ຈັດຮຽງ
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (isPending ? "elapsed" : "code")).trim();

  const [board, closed, noticeCount] = await Promise.all([
    isPending ? getBoard(q, status) : Promise.resolve([]),
    isPending ? Promise.resolve({ rows: [], total: 0 }) : getClosed(tab as "done" | "cancelled", q, page, sort, dir),
    getNoticeCount(),
  ]);

  const total = isPending ? board.length : closed.total;

  // ວຽກຄ້າງໂຫຼດຄົບ (96 ໃບ) ຈຶ່ງຈັດຮຽງ ແລະ ແບ່ງໜ້າຢູ່ນີ້ໄດ້ເລີຍ
  const pendingSorted = sortPending(board, sort, dir);
  const pages = board_view ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingPage = pendingSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** ຄ່າທີ່ຕ້ອງພາໄປນຳທຸກລິ້ງ */
  const base = () => ({
    ...(!isPending && { tab }),
    ...(board_view && { view: "board" }),
    ...(q && { q }),
    ...(status && { status: String(status) }),
  });

  const pageHref = (n: number) =>
    `/service?${new URLSearchParams({ ...base(), ...(sort && { sort }), dir, ...(n > 1 && { page: String(n) }) })}`;

  /** ກົດຫົວຖັນ → ຈັດຮຽງໃໝ່ ແລະ ກັບໄປໜ້າ 1 */
  const sortHref = (key: string, nextDir: SortDir) =>
    `/service?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;

  /** ລິ້ງໄປແທັບອື່ນ (ຮັກສາຄຳຄົ້ນຫາໄວ້, ລ້າງຕົວກອງ/ໜ້າ) */
  const tabHref = (target: Tab) =>
    `/service?${new URLSearchParams({ ...(target !== "pending" && { tab: target }), ...(q && { q }) })}`;

  const pagination = pages > 1 ? (
        <nav className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} ຈາກ {total.toLocaleString()}
          </span>

          <div className="flex items-center gap-1">
            <Link
              href={pageHref(1)}
              aria-disabled={page === 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ທຳອິດ
            </Link>
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              ກ່ອນໜ້າ
              <LinkPending />
            </Link>

            <span className="px-3 py-2 font-medium text-slate-700">
              {page} / {pages}
            </span>

            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ຕໍ່ໄປ
              <LinkPending />
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href={pageHref(pages)}
              aria-disabled={page >= pages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ສຸດທ້າຍ
            </Link>
          </div>
        </nav>
  ) : null;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-700">ລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "done"
              ? `ສົ່ງຄືນສຳເລັດ ${total.toLocaleString()} ໃບ · ໜ້າ ${page}/${pages}`
              : tab === "cancelled"
                ? `ຍົກເລີກແລ້ວ ${total.toLocaleString()} ໃບ · ໜ້າ ${page}/${pages}`
                : board_view
                  ? `ວຽກທີ່ຍັງຄ້າງ ${total} ໃບ`
                  : `ວຽກທີ່ຍັງຄ້າງ ${total} ໃບ · ໜ້າ ${page}/${pages}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/service/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <FilePlus2 className="size-4" />
            ໃບຮັບເຄື່ອງ
          </Link>
          <Link
            href="/reports/job-dispatch"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <FileBarChart className="size-4" />
            ລາຍງານ
          </Link>
          <Link
            href="/service/notices"
            className="inline-flex h-10 items-center gap-2 rounded-lg border-2 border-red-500 bg-slate-100 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            ລູກຄ້າເເຈ້ງສ້ອມ
            <Bell className="size-4" />
            <span className="grid min-w-6 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
              {noticeCount}
            </span>
          </Link>
        </div>
      </div>

      {/* ຄົ້ນຫາ + ຕົວກອງ + ສະຫຼັບມຸມມອງ */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {/* ຄົ້ນຫາແລ້ວຢູ່ມຸມມອງເດີມ ແລະ ກັບໄປໜ້າ 1 ສະເໝີ */}
        {!isPending && <input type="hidden" name="tab" value={tab} />}
        {board_view && <input type="hidden" name="view" value="board" />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ອາການ..." className="w-full text-sm outline-none" />
        </div>

        {/* ກອງຕາມສະຖານະ — ສະເພາະແທັບວຽກຄ້າງ */}
        {isPending && (
          <div className="w-52">
            <SelectField
              name="status"
              defaultValue={status ? String(status) : ""}
              placeholder="ສະຖານະທັງໝົດ"
              options={STAGES.map((stage) => ({ value: String(stage.id), label: stage.label }))}
            />
          </div>
        )}

        <button className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white">ຄົ້ນຫາ</button>

        {/* ວຽກຄ້າງ: ສະຫຼັບ ຕາຕະລາງ ↔ ກະດານ */}
        {isPending && (
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            <Link
              href={tabHref("pending")}
              title="ຕາຕະລາງ"
              className={`inline-flex h-10 items-center gap-2 px-3 text-sm font-medium ${!board_view ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
            >
              <Table2 className="size-4" />
              ຕາຕະລາງ
              <LinkPending />
            </Link>
            <Link
              href={`/service?${new URLSearchParams({ view: "board", ...(q && { q }) })}`}
              title="ກະດານ"
              className={`inline-flex h-10 items-center gap-2 px-3 text-sm font-medium ${board_view ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
            >
              <LayoutGrid className="size-4" />
              ກະດານ
              <LinkPending />
            </Link>
          </div>
        )}

        {/* 3 ແທັບ: ວຽກຄ້າງ · ຈົບແລ້ວ · ຍົກເລີກ */}
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
          <Link
            href={tabHref("pending")}
            className={`inline-flex h-10 items-center gap-2 px-4 text-sm font-medium ${isPending ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            <Clock className="size-4" />
            ວຽກຄ້າງ
            <LinkPending />
          </Link>
          <Link
            href={tabHref("done")}
            className={`inline-flex h-10 items-center gap-2 border-l border-slate-300 px-4 text-sm font-medium ${tab === "done" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            <CheckCircle2 className="size-4" />
            ຈົບແລ້ວ
            <LinkPending />
          </Link>
          <Link
            href={tabHref("cancelled")}
            className={`inline-flex h-10 items-center gap-2 border-l border-slate-300 px-4 text-sm font-medium ${tab === "cancelled" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            <XCircle className="size-4" />
            ຍົກເລີກ
            <LinkPending />
          </Link>
        </div>
      </form>

      {!isPending ? (
        <>
          <ServiceTable rows={closed.rows} sort={sort} dir={dir} sortHref={sortHref} />
          {pagination}
        </>
      ) : board_view ? (
        <ServiceBoard cards={board} />
      ) : (
        <>
          <ServicePendingTable cards={pendingPage} sort={sort} dir={dir} sortHref={sortHref} />
          {pagination}
        </>
      )}
    </div>
  );
}
