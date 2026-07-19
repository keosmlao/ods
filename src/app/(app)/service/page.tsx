import { LinkPending } from "@/components/link-pending";
import { SelectField } from "@/components/select-field";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { ServiceBoard, STAGES, type BoardCard } from "@/components/service-board";
import { ServicePendingTable } from "@/components/service-pending-table";
import type { SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { permissionFor } from "@/lib/permissions";
import { holdJsonSql } from "@/lib/job-hold";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";
import { OPEN_JOBS, STAGE_ELAPSED_SQL, STAGE_SQL } from "@/lib/stage";
import { Bell, ChevronLeft, ChevronRight, FileBarChart, FilePlus2, FileSpreadsheet, LayoutGrid, Search, Table2 } from "lucide-react";
import Link from "next/link";

/** 3 ແທັບ: ວຽກຄ້າງ · ຈົບແລ້ວ · ຍົກເລີກ */
type Tab = "pending" | "done" | "cancelled";
type Props = { searchParams: Promise<{ q?: string; tab?: string; page?: string; view?: string; status?: string; service?: string; sort?: string; dir?: string }> };

/** ປະເພດບໍລິການທີ່ກອງໄດ້ — CI/ST/IH/PS (lib/sla) */
const SERVICE_CODES = ["CI", "ST", "IH", "PS"];

/**
 * ── ເວລາຄ້າງ: ໃຊ້ຂອງ lib/stage ບ່ອນດຽວ ຢ່າຄິດເອງ ──
 * ໜ້ານີ້ເຄີຍຂຽນ CASE ຂອງຕົນເອງ ແລ້ວຢຸດທີ່ຂັ້ນ 10 ⇒ ຫຼັງເພີ່ມດ່ານ QC (ຂັ້ນເລື່ອນເປັນ 11/12)
 * ງານ "ລໍຖ້າສົ່ງຄືນ" ໄດ້ null ແລ້ວເວລາຄ້າງຫາຍໄປງຽບໆ. ຕໍ່ມາໃຊ້ STAGE_TIME_COL ແຕ່ຍັງ
 * ຄິດ `now() - …` ເອງ ⇒ ພໍເພີ່ມທຸງ "ມີບັນຫາ" ທີ່ຢຸດນາລິກາ ໜ້ານີ້ກໍ່ຈະນັບຕໍ່ຄົນດຽວອີກ.
 * ດຽວນີ້ໃຊ້ **STAGE_ELAPSED_SQL** ໂດຍກົງ — ຫຼັກປ່ຽນອີກກໍ່ຕາມມາເອງ.
 */

const SEARCH = `(a.code ilike $1 or a.sn ilike $1 or a.name_1 ilike $1 or a.p_brand ilike $1
  or a.issue ilike $1 or b.name_1 ilike $1 or b.tel ilike $1)`;

/** ວຽກທີ່ຍັງຄ້າງ (ຂັ້ນ 1..10) — ສຳລັບກະດານ */
async function getBoard(q: string, status: number | null, service: string | null) {
  const where = [OPEN_JOBS];
  const params: (string | number)[] = [];
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$1", `$${params.length}`)); }
  if (status) { params.push(status); where.push(`(${STAGE_SQL}) = $${params.length}`); }
  if (service) { params.push(service); where.push(`a.service_type = $${params.length}`); }

  // ບໍ່ດຶງຮູບ: ບັດ 98 ໃບ = 98 request ໄປ /api/uploads ພ້ອມກັນ → ໜ້າຊ້າ.
  // ຮູບຍັງເບິ່ງໄດ້ຢູ່ໜ້າລາຍລະອຽດ ແລະ ຕາຕະລາງ "ຈົບແລ້ວ".
  /**
   * ເວລາຄ້າງ: ໃຊ້ `STAGE_ELAPSED_SQL` ຂອງ lib/stage **ບໍ່ຄິດເອງ** (17-07-2026).
   * ແຕ່ກ່ອນຢູ່ນີ້ຂຽນ `now() - STAGE_SINCE` ເອງ ⇒ ພໍເພີ່ມທຸງ "ມີບັນຫາ" ທີ່ຢຸດນາລິກາ
   * ໜ້ານີ້ຈະຍັງນັບຕໍ່ ແລ້ວເລກຢູ່ໜ້ານີ້ກັບໜ້າຄິວຈະ**ບໍ່ຕົງກັນ**ຢ່າງງຽບໆ —
   * ຄືບັກ CASE ຂອງຕົນເອງທີ່ເຄີຍເກີດຕອນເພີ່ມຂັ້ນ QC (ເບິ່ງໝາຍເຫດ STAGE_SINCE ຂ້າງເທິງ).
   */
  const sql = `select a.code, (${STAGE_SQL}) stage, b.name_1 customer,
      concat_ws(' ', a.name_1, a.p_model) product, a.sn, a.p_brand brand,
      a.warrunty warranty, a.emp_code technician, a.user_regis creator,
      nullif(trim(coalesce(a.remark,'')),'') remark,
      ${STAGE_ELAPSED_SQL} stage_seconds,
      ${holdJsonSql("repair")}
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${where.join(" and ")}`;
  return (await query<BoardCard>(sql, params)).rows;
}

/** ວຽກທີ່ຈົບແລ້ວ / ຍົກເລີກ — ບໍ່ຂຶ້ນກະດານ (ມີເປັນພັນໃບ), ເບິ່ງເປັນຕາຕະລາງແທນ */
export const PAGE_SIZE = 20;


/**
 * ── ຖອດ getClosed() ອອກ (13-07-2026) ──
 * ມັນ scan ໃບຮັບເຄື່ອງ 5,000+ ໃບ ທຸກເທື່ອທີ່ເປີດໜ້າ ເພື່ອຕື່ມແທັບ "ຈົບແລ້ວ / ຍົກເລີກ"
 * ທີ່ຄົນເຮັດວຽກປະຈຳວັນບໍ່ໄດ້ໃຊ້ ⇒ ໜ້າຊ້າໂດຍບໍ່ຈຳເປັນ.
 * ໃບເກົ່າເບິ່ງໄດ້ຜ່ານ: ຄົ້ນຫາ · /service/<ລະຫັດ> · ລາຍງານໃບຮັບເງິນ/ຍົກເລີກ.
 */

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
  /**
   * ── ຖອດແທັບ "ຈົບແລ້ວ / ຍົກເລີກ" ອອກ (13-07-2026) ──
   * ສອງແທັບນັ້ນ scan ໃບຮັບເຄື່ອງເປັນ **ພັນໆໃບ** ທຸກເທື່ອທີ່ເປີດໜ້າ (5,000+ ໃບ)
   * ⇒ ໜ້າຊ້າ ໃນຂະນະທີ່ຄົນເຮັດວຽກຕ້ອງການແຕ່ **ວຽກຄ້າງ**.
   * ໃບທີ່ຈົບ/ຍົກເລີກແລ້ວ ຍັງເປີດເບິ່ງໄດ້ຜ່ານ **ຄົ້ນຫາ** ແລະ ໜ້າລາຍລະອຽດ /service/<ລະຫັດ>
   * ພ້ອມທັງລາຍງານ (ລາຍງານໃບຮັບເງິນ · ຍົກເລີກຮັບເຄື່ອງ) ທີ່ມີຢູ່ແລ້ວ.
   */
  const tab: Tab = "pending";
  const isPending = true;
  // ວຽກຄ້າງ: ຕາຕະລາງເປັນຄ່າຕັ້ງຕົ້ນ, ກະດານເປັນທາງເລືອກ
  const board_view = isPending && params.view === "board";
  const page = Math.max(1, Number(params.page) || 1);

  // ຕົວກອງສະຖານະ (ສະເພາະແທັບວຽກຄ້າງ) — ຂັ້ນ 1..11 (11 = ລໍຖ້າສົ່ງຄືນ, ຫຼັງເພີ່ມດ່ານ QC)
  const statusRaw = Number(params.status);
  const status = isPending && statusRaw >= 1 && statusRaw <= 11 ? statusRaw : null;
  // ຕົວກອງປະເພດບໍລິການ (CI/ST/IH/PS) — ໃຊ້ໄດ້ທຸກແທັບ ແລະ ໄປນຳ export
  const service = SERVICE_CODES.includes(params.service ?? "") ? params.service! : null;

  // ຈັດຮຽງ
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (isPending ? "elapsed" : "code")).trim();

  const session = await getSession();
  const t = (await getDictionary(await getLocale())).service;
  const servicePermission = session
    ? await permissionFor(session, "/service")
    : { read: false, create: false, update: false, delete: false };
  /** ໝາຍ/ປົດ ທຸງ "ມີບັນຫາ" — ຕ້ອງເປີດສະວິດ + ເປັນຫົວໜ້າ/ຜູ້ມີສິດອະນຸມັດ (ຄືກັນກັບໜ້າຄິວ) */
  const canHold = (await settingEnabled(SETTING.JOB_HOLD)) && APPROVER_SIDE.includes(roleOf(session));

  const [board, noticeCount] = await Promise.all([getBoard(q, status, service), getNoticeCount()]);

  const total = board.length;

  // ວຽກຄ້າງໂຫຼດຄົບ (96 ໃບ) ຈຶ່ງຈັດຮຽງ ແລະ ແບ່ງໜ້າຢູ່ນີ້ໄດ້ເລີຍ
  const pendingSorted = sortPending(board, sort, dir);
  const pages = board_view ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingPage = pendingSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** ຄ່າທີ່ຕ້ອງພາໄປນຳທຸກລິ້ງ */
  const base = () => ({
    ...(board_view && { view: "board" }),
    ...(q && { q }),
    ...(status && { status: String(status) }),
    ...(service && { service }),
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
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.of} {total.toLocaleString()}
          </span>

          <div className="flex items-center gap-1">
            <Link
              href={pageHref(1)}
              aria-disabled={page === 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.first}
            </Link>
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              {t.prev}
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
              {t.next}
              <LinkPending />
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href={pageHref(pages)}
              aria-disabled={page >= pages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.last}
            </Link>
          </div>
        </nav>
  ) : null;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-700">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {board_view
              ? `${t.pendingJobs} ${total} ${t.unit}`
              : `${t.pendingJobs} ${total} ${t.unit} · ${t.page} ${page}/${pages}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {servicePermission.create && (
            <Link
              href="/service/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <FilePlus2 className="size-4" />
              {t.receipt}
            </Link>
          )}
          <Link
            href="/reports/job-dispatch"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <FileBarChart className="size-4" />
            {t.report}
          </Link>
          {/* Excel — ໃຊ້ຕົວກອງອັນດຽວກັບໜ້າຈໍ (ແທັບ · ຄຳຄົ້ນຫາ · ຂັ້ນ) ແຕ່ເອົາ **ຄົບທຸກແຖວ** ບໍ່ແບ່ງໜ້າ */}
          <a
            href={`/api/reports/export/service?${new URLSearchParams({
              tab,
              ...(q && { q }),
              ...(status && { status: String(status) }),
              ...(service && { service }),
            })}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <FileSpreadsheet className="size-4 text-emerald-700" />
            Excel
          </a>
          <Link
            href="/service/notices"
            className="inline-flex h-10 items-center gap-2 rounded-lg border-2 border-red-500 bg-slate-100 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            {t.customerNotice}
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
          <input name="q" defaultValue={q} placeholder={t.searchPlaceholder} className="w-full text-sm outline-none" />
        </div>

        {/* ກອງຕາມສະຖານະ — ສະເພາະແທັບວຽກຄ້າງ */}
        {isPending && (
          <div className="w-52">
            <SelectField
              name="status"
              defaultValue={status ? String(status) : ""}
              placeholder={t.allStatus}
              options={STAGES.map((stage) => ({ value: String(stage.id), label: stage.label }))}
            />
          </div>
        )}

        {/* ກອງຕາມປະເພດບໍລິການ (CI/ST/IH/PS) — ໃຊ້ໄດ້ທຸກແທັບ · export ຕາມນີ້ */}
        <div className="w-56">
          <SelectField
            name="service"
            defaultValue={service ?? ""}
            placeholder={t.allServiceTypes}
            options={SERVICE_CODES.map((code) => ({ value: code, label: `${code} · ${SERVICE_TYPE_LABEL[code] ?? code}` }))}
          />
        </div>

        <button className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white">{t.search}</button>

        {/* ວຽກຄ້າງ: ສະຫຼັບ ຕາຕະລາງ ↔ ກະດານ */}
        {isPending && (
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            <Link
              href={tabHref("pending")}
              title={t.table}
              className={`inline-flex h-10 items-center gap-2 px-3 text-sm font-medium ${!board_view ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
            >
              <Table2 className="size-4" />
              {t.table}
              <LinkPending />
            </Link>
            <Link
              href={`/service?${new URLSearchParams({ view: "board", ...(q && { q }) })}`}
              title={t.board}
              className={`inline-flex h-10 items-center gap-2 px-3 text-sm font-medium ${board_view ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
            >
              <LayoutGrid className="size-4" />
              {t.board}
              <LinkPending />
            </Link>
          </div>
        )}

      </form>

      {board_view ? (
        <ServiceBoard cards={board} />
      ) : (
        <>
          <ServicePendingTable
            cards={pendingPage}
            sort={sort}
            dir={dir}
            sortHref={sortHref}
            canUpdate={servicePermission.update}
            canDelete={servicePermission.delete}
            canHold={canHold}
          />
          {pagination}
        </>
      )}
    </div>
  );
}
