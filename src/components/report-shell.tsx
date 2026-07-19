import { LinkPending } from "@/components/link-pending";
import { MobileCardList } from "@/components/mobile-card-list";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { searchRows, todayIso } from "@/lib/report-sql";
import { BarChart3, ChevronLeft, ChevronRight, Download, Filter, Printer, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * ໂຄງກາງຂອງໜ້າລາຍງານທຸກໜ້າ — ໃຫ້ໜ້າຕາ ແລະ ພຶດຕິກຳຄືກັນໝົດ:
 *   ຫົວລາຍງານ → ແຖບຕົວກອງ (ຊ່ວງວັນທີ / dropdown / ຄົ້ນຫາ) → ແຖບສະຫຼຸບ → ຕາຕະລາງ → ແບ່ງໜ້າ
 *
 * ຄືກັນກັບໜ້າ /checking: ຕົວໜັງສື text-xs, ຫົວຖັນຈັດຮຽງໄດ້, ແບ່ງໜ້າລະ 20 ລາຍການ, LinkPending.
 *
 * ໝາຍເຫດ: SQL ຂອງລາຍງານດຶງແຖວມາຄົບຢູ່ແລ້ວ (ຈຳກັດດ້ວຍຊ່ວງວັນທີ) ຈຶ່ງ ຄົ້ນຫາ/ຈັດຮຽງ/ແບ່ງໜ້າ
 * ຢູ່ server ຈາກແຖວທີ່ດຶງມາ — ຕົວເລກລວມຈຶ່ງຄືເກົ່າທຸກປະການ ແລະ ບໍ່ມີຊ່ອງ SQL injection
 * (ຖັນທີ່ຈັດຮຽງໄດ້ = key ຂອງຄໍລຳທີ່ປະກາດໄວ້ເທົ່ານັ້ນ = whitelist).
 */

export const PAGE_SIZE = 20;

/**
 * ຊ່ວງວັນທີຕັ້ງຕົ້ນຂອງລາຍງານ = 30 ມື້ຫຼ້າສຸດ (ວັນນີ້ຍ້ອນຫຼັງ 30 ມື້ → ວັນນີ້).
 *
 * ແຕ່ກ່ອນຕັ້ງຕົ້ນເປັນ ມື້ນີ້ → ມື້ນີ້ ⇒ ເປີດລາຍງານມາເຫັນ 0 ແຖວທຸກເທື່ອ.
 * ໃຊ້ເປັນ "ຄ່າຕັ້ງຕົ້ນ" ເທົ່ານັ້ນ — link ທີ່ມີ ?from=&to= ມາແລ້ວ ຍັງໃຊ້ຄ່າຂອງມັນຄືເກົ່າ
 * ແລະ ປຸ່ມ "ສະແດງທັງໝົດ" (all=1) ກໍບໍ່ຖືກກະທົບ.
 */
export const DEFAULT_RANGE_DAYS = 30;

/** ວັນທີເລີ່ມຕົ້ນຕັ້ງຕົ້ນ (YYYY-MM-DD) — ນັບຈາກ "ມື້ນີ້" ຂອງ todayIso (Asia/Bangkok) */
export function defaultFromIso(days = DEFAULT_RANGE_DAYS) {
  // ຄິດເປັນ UTC ລ້ວນ ຈຶ່ງບໍ່ຂຶ້ນກັບເຂດເວລາຂອງເຄື່ອງ server
  const day = new Date(`${todayIso()}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - days);
  return day.toISOString().slice(0, 10);
}

export type ReportRow = Record<string, string | number | null>;
export type ReportColumn = { key: string; label: string };
export type ReportState = { q: string; sort: string; dir: SortDir; page: number };
export type SummaryItem = { label: string; value: string | number };
export type ReportTab = { key: string; label: string; href: string; active: boolean };

/** ອ່ານສະຖານະຕາຕະລາງ (ຄົ້ນຫາ / ຈັດຮຽງ / ໜ້າ) ຈາກ URL */
export function reportState(params: Record<string, string | string[] | undefined>): ReportState {
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  return {
    q: pick(params.q).trim(),
    sort: pick(params.sort).trim(),
    dir: pick(params.dir) === "desc" ? "desc" : "asc",
    page: Math.max(1, Number(pick(params.page)) || 1),
  };
}

/** ນັບແຖວຕາມຄ່າຂອງຖັນໜຶ່ງ — ໃຊ້ສ້າງແຖບສະຫຼຸບ (ຂ້າມຄ່າວ່າງ) */
export function countBy(rows: ReportRow[], key: string): SummaryItem[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[key] ?? "").trim();
    if (!label || label === "-") continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value: value.toLocaleString() }));
}

/* --------------------------------------------------------------- ຈັດຮຽງ / ຄົ້ນຫາ */

const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** ຄ່າທີ່ປຽບທຽບແບບຕົວເລກໄດ້: ວັນທີ DD-MM-YYYY [HH:MI[:SS]] ຫຼື ຕົວເລກລ້ວນ */
function numeric(value: string | number): number | null {
  if (typeof value === "number") return value;
  const date = DATE_RE.exec(value);
  if (date) {
    const [, d, m, y, hh = "0", mi = "0", ss = "0"] = date;
    return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mi), Number(ss));
  }
  const text = value.replace(/,/g, "").trim();
  return text !== "" && !Number.isNaN(Number(text)) ? Number(text) : null;
}

function compare(a: string | number, b: string | number) {
  const na = numeric(a);
  const nb = numeric(b);
  if (na !== null && nb !== null) return na - nb;
  return String(a).localeCompare(String(b), "lo");
}

function sortRows(rows: ReportRow[], sort: string, dir: SortDir) {
  return [...rows].sort((left, right) => {
    const a = left[sort] ?? "";
    const b = right[sort] ?? "";
    // ຄ່າວ່າງໄປທ້າຍສະເໝີ (ບໍ່ວ່າຈັດຮຽງຂຶ້ນ ຫຼື ລົງ)
    if (a === "" && b === "") return 0;
    if (a === "") return 1;
    if (b === "") return -1;
    return dir === "asc" ? compare(a, b) : -compare(a, b);
  });
}

/* ------------------------------------------------------------------------ ໂຄງ */

export async function ReportShell({
  title,
  subtitle,
  basePath,
  query,
  state,
  columns,
  rows,
  error = null,
  dateRange,
  filters,
  tabs,
  summary = [],
  exportHref,
  printHref,
  actions,
  minWidth = 1100,
  searchPlaceholder,
  sortable = true,
  omitFromForm = [],
}: {
  title: string;
  /** ຂໍ້ຄວາມນ້ອຍໃຕ້ຫົວຂໍ້ (ຊ່ວງວັນທີ / ຕົວກອງທີ່ເລືອກ) */
  subtitle?: ReactNode;
  basePath: string;
  /** ຕົວກອງຂອງລາຍງານນີ້ທີ່ຕ້ອງຮັກສາໄວ້ໃນທຸກ link (from, to, flag, all, ...) */
  query: Record<string, string>;
  state: ReportState;
  columns: ReportColumn[];
  /** ແຖວທັງໝົດຂອງລາຍງານ — ຄົ້ນຫາ/ຈັດຮຽງ/ແບ່ງໜ້າ ເຮັດຢູ່ນີ້ */
  rows: ReportRow[];
  error?: string | null;
  /** ສະແດງຊ່ອງ ຈາກວັນທີ / ຫາວັນທີ */
  dateRange?: { from: string; to: string };
  /** ຊ່ອງກອງເພີ່ມເຕີມ (dropdown ຈາກ SelectField) */
  filters?: ReactNode;
  tabs?: ReportTab[];
  summary?: SummaryItem[];
  exportHref?: string;
  printHref?: string;
  /** ປຸ່ມເພີ່ມເຕີມ (ເຊັ່ນ "ສະແດງທັງໝົດ") */
  actions?: ReactNode;
  minWidth?: number;
  searchPlaceholder?: string;
  /** ບາງລາຍງານມີແຖວຍ່ອຍແຊກຢູ່ (ສະເໜີຊື້ແບບລະອຽດ) — ຈັດຮຽງໃໝ່ຈະເຮັດໃຫ້ແຖວຍ່ອຍຫຼຸດຈາກຫົວຂອງມັນ */
  sortable?: boolean;
  /**
   * key ຂອງ query ທີ່ **ບໍ່ຕ້ອງ** ໃສ່ເປັນ hidden input ໃນຟອມ:
   *  - key ທີ່ຊ່ອງກອງ (SelectField) ສົ່ງເອງຢູ່ແລ້ວ → ກັນສົ່ງຊ້ຳ 2 ຄ່າ
   *  - key ຢ່າງ all=1 → ເມື່ອກົດຄົ້ນຫາຕາມວັນທີ ຕ້ອງອອກຈາກໂໝດ "ທັງໝົດ"
   */
  omitFromForm?: string[];
}) {
  const t = (await getDictionary(await getLocale())).reportShell;
  const total = rows.length;
  const keys = new Set(columns.map((column) => column.key));
  const sort = sortable && keys.has(state.sort) ? state.sort : "";

  // ຄົ້ນຫາ: ໃຊ້ຕົວຊ່ວຍກາງ searchRows — route export Excel ກໍໃຊ້ອັນດຽວກັນ ຈຶ່ງໄດ້ແຖວຄືກັນສະເໝີ
  const found = searchRows(rows, columns.map((column) => column.key), state.q);
  const ordered = sort ? sortRows(found, sort, state.dir) : found;
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const page = Math.min(state.page, pages);
  const shown = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const base = () => ({ ...query, ...(state.q && { q: state.q }) });
  const sortHref = (key: string, nextDir: SortDir) =>
    `${basePath}?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `${basePath}?${new URLSearchParams({
      ...base(),
      ...(sort && { sort, dir: state.dir }),
      ...(n > 1 && { page: String(n) }),
    })}`;

  const tiles: SummaryItem[] = [{ label: t.totalAll, value: total.toLocaleString() }, ...summary];

  return (
    <div className="w-full space-y-5 pb-6">
      {/* ຫົວລາຍງານ */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-teal-100/60 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
          <Link href="/reports" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 transition hover:text-teal-900">
            <ChevronLeft className="size-3.5" />
            {t.reports}
            <LinkPending className="size-3" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            {subtitle}
            {subtitle && " · "}
            {state.q ? `${t.found} ${ordered.length.toLocaleString()} ${t.from} ${total.toLocaleString()} ${t.items}` : `${total.toLocaleString()} ${t.items}`}
            {" · "}{t.page} {page}/{pages}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 sm:pt-1">
          {actions}
          {exportHref && (
            <a
              href={exportHref}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              <Download className="size-3.5" />
              {t.downloadExcel}
            </a>
          )}
          {printHref && (
            <Link
              href={printHref}
              target="_blank"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Printer className="size-3.5" />
              {t.print}
              <LinkPending className="size-3" />
            </Link>
          )}
        </div>
        </div>
      </div>

      {/* ແທັບ (ລາຍງານທີ່ມີຫຼາຍຊຸດຂໍ້ມູນ) */}
      {tabs && tabs.length > 0 && (
        <div className="no-print flex overflow-hidden rounded-lg border border-slate-300">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                tab.active ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>
      )}

      {/* ແຖບຕົວກອງ — GET ຈຶ່ງແບ່ງປັນ link ໄດ້ */}
      <form
        action={basePath}
        method="get"
        className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="grid size-7 place-items-center rounded-lg bg-slate-100 text-slate-600"><Filter className="size-3.5" /></span>
          {t.reportFilter}
        </div>
        <div className="flex flex-wrap items-end gap-3">
        {/* ຮັກສາຕົວກອງ ແລະ ການຈັດຮຽງໄວ້ເມື່ອກົດຄົ້ນຫາ */}
        {Object.entries(query)
          .filter(([key]) => key !== "from" && key !== "to" && !omitFromForm.includes(key))
          .map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        {sort && (
          <>
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={state.dir} />
          </>
        )}

        {dateRange && (
          <>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">{t.fromDate}</span>
              <input
                type="date"
                name="from"
                defaultValue={dateRange.from}
                className="h-10 w-full min-w-40 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">{t.toDate}</span>
              <input
                type="date"
                name="to"
                defaultValue={dateRange.to}
                className="h-10 w-full min-w-40 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </>
        )}

        {filters}

        <label className="flex min-w-56 flex-1 flex-col">
          <span className="mb-1 block text-[11px] text-slate-500">{t.search}</span>
          <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 transition focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input name="q" defaultValue={state.q} placeholder={searchPlaceholder ?? t.searchPlaceholder} className="w-full text-xs outline-none" />
          </span>
        </label>

        <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700">
          <Search className="size-3.5" /> {t.search}
        </button>
        </div>
      </form>

      {/* ແຖບສະຫຼຸບ */}
      {!error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          {tiles.map((tile, index) => (
            <div
              key={`${tile.label}-${index}`}
              className={`relative min-w-40 overflow-hidden rounded-2xl border px-4 py-3 shadow-sm ${
                index === 0 ? "border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-6">
                <div><p className={`text-[11px] font-medium ${index === 0 ? "text-teal-700" : "text-slate-500"}`}>{tile.label}</p>
                <p className={`mt-1 text-xl font-bold ${index === 0 ? "text-teal-900" : "text-slate-900"}`}>{tile.value}</p></div>
                <span className={`grid size-9 place-items-center rounded-xl ${index === 0 ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"}`}><BarChart3 className="size-4" /></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>
      ) : (
        <>
          {/* ຕາຕະລາງ desktop — ເຊື່ອງໃນມືຖື, ຄົງເດີມທຸກປະການໃນຈໍໃຫຍ່ */}
          <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-800">{t.dataList}</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">{t.tableHint}</p>
            </div>
            <div className="max-h-[calc(100vh-16rem)] overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-xs" style={{ minWidth }}>
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600 [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-slate-200 [&>th]:bg-slate-50">
                    {columns.map((column) =>
                      sortable ? (
                        <SortHeader
                          key={column.key}
                          label={column.label}
                          sortKey={column.key}
                          current={sort}
                          dir={state.dir}
                          href={sortHref}
                          className="py-2.5"
                        />
                      ) : (
                        <th key={column.key} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                          {column.label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row, index) => (
                    <tr key={`${row[columns[0].key] ?? ""}-${index}`} className="group transition hover:bg-teal-50/40">
                      {columns.map((column) => {
                        const value = row[column.key];
                        return (
                          <td
                            key={column.key}
                            className="max-w-64 truncate border-b border-slate-100 px-3 py-3 text-slate-700 first:font-semibold first:text-slate-900"
                            title={value === null || value === undefined ? "" : String(value)}
                          >
                            {value === null || value === undefined || value === "" ? "-" : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ordered.length === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noItems}</p>}
          </section>

          {/* ບັດ mobile — ໃຊ້ຖັນ/ແຖວດຽວກັນ, ຖັນທຳອິດເປັນຫົວບັດ ສ່ວນຖັນທີ່ເຫຼືອເປັນ ປ້າຍ:ຄ່າ */}
          <div className="md:hidden">
            <MobileCardList className="space-y-2">
              {shown.map((row, index) => {
                const [head, ...rest] = columns;
                const headValue = row[head.key];
                return (
                  <div
                    key={`m-${row[head.key] ?? ""}-${index}`}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <p className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
                      {headValue === null || headValue === undefined || headValue === "" ? "-" : headValue}
                    </p>
                    <dl className="space-y-1.5">
                      {rest.map((column) => {
                        const value = row[column.key];
                        return (
                          <div key={column.key} className="flex items-start justify-between gap-3 text-xs">
                            <dt className="shrink-0 text-slate-500">{column.label}</dt>
                            <dd className="min-w-0 break-words text-right font-medium text-slate-700">
                              {value === null || value === undefined || value === "" ? "-" : value}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                );
              })}
            </MobileCardList>
            {ordered.length === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noItems}</p>}
          </div>
        </>
      )}

      {pages > 1 && (
        <nav className="no-print flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, ordered.length)} {t.from}{" "}
            {ordered.length.toLocaleString()}
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
