import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import {
  INSTALL_ELAPSED_SQL,
  INSTALL_STAGE_SQL,
  INSTALL_STAGE_TIME_COL,
  installStageChip,
  installStageLabel,
} from "@/lib/install-stage";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

/**
 * ຊິ້ນສ່ວນທີ່ໜ້າຕິດຕັ້ງທຸກໜ້າໃຊ້ຮ່ວມກັນ — ຕາຕະລາງ, ແທັບ, ຄົ້ນຫາ, ແບ່ງໜ້າ.
 * ໃຫ້ໜ້າຕິດຕັ້ງມີໜ້າຕາຄືກັນກັບໜ້າກວດເຊັກ (/checking) ແລະ ສ້ອມແປງ (/repair).
 */

export const PAGE_SIZE = 20;

export type InstallRow = {
  code: string;
  customer: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  doc_ref_1: string | null;
  tech_code: string | null;
  user_created: string | null;
  location_inst: string | null;
  time_register: string | null;
  appoint_date: string | null;
  stage: number;
  elapsed_seconds: number | null;
  /** ວັນ/ເວລາທີ່ເຂົ້າຂັ້ນປັດຈຸບັນ */
  stage_time: string | null;
  complain_cust: string | null;
  cancel_date: string | null;
  cancel_remark: string | null;
  cancel_code: string | null;
  used_spare: number | null;
};

/** ຕາຕະລາງ ods_tb_install = a · ar_customer = c */
export const INSTALL_FROM = "from ods_tb_install a left join ar_customer c on c.code = a.cust_code";

export const INSTALL_COLUMNS = `a.code,
  concat_ws('-', c.name_1, c.tel) customer,
  a.item_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
  a.doc_ref_1, a.tech_code, a.user_created, a.location_inst,
  to_char(a.time_register,'DD-MM-YYYY HH24:MI') time_register,
  to_char(a.appoint_date,'DD-MM-YYYY') appoint_date,
  (${INSTALL_STAGE_SQL}) stage,
  ${INSTALL_ELAPSED_SQL} elapsed_seconds,
  to_char((${INSTALL_STAGE_TIME_COL}),'DD-MM-YYYY HH24:MI') stage_time,
  a.complain_cust, a.cancel_date, a.cancel_remark, a.cancel_code, a.used_spare`;

/** ຄົ້ນຫາ — $Q ຖືກປ່ຽນເປັນເລກ parameter ຕອນປະກອບ query */
export const INSTALL_SEARCH = `(a.code ilike $Q or a.doc_ref_1 ilike $Q or a.item_name ilike $Q
  or a.pro_brand ilike $Q or a.pro_model ilike $Q or a.pro_sn ilike $Q or a.tech_code ilike $Q
  or a.location_inst ilike $Q or c.name_1 ilike $Q or c.tel ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection. at_col = ຖັນເວລາຂອງຂັ້ນປັດຈຸບັນ */
export const INSTALL_SORT_SQL: Record<string, string> = {
  code: "a.code",
  register: "a.time_register",
  appoint: "a.appoint_date",
  customer: "c.name_1",
  item: "a.item_name",
  brand: "a.pro_brand",
  tech: "a.tech_code",
  stage: `(${INSTALL_STAGE_SQL})`,
  elapsed: "at_col",
};

/**
 * ປະໂຫຍກ ORDER BY — "ຄ້າງດົນສຸດກ່ອນ" ໝາຍເຖິງເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້.
 * timeCol = ຖັນເວລາທີ່ໜ້ານັ້ນນັບຄ້າງຈາກ (ຫຼື ຂັ້ນປັດຈຸບັນ).
 */
export function installOrderBy(sort: string, dir: SortDir, timeCol = INSTALL_STAGE_TIME_COL) {
  const column = INSTALL_SORT_SQL[sort] ?? "at_col";
  if (column === "at_col") return `(${timeCol}) ${dir === "desc" ? "asc" : "desc"} nulls last`;
  return `${column} ${dir === "asc" ? "asc" : "desc"} nulls last`;
}

/** ດຶງແຖວ + ນັບຈຳນວນທັງໝົດພ້ອມກັນ */
export async function fetchInstallRows(options: {
  where: string;
  params: (string | number)[];
  orderBy: string;
  page: number;
  extraColumns?: string;
}) {
  const { where, params, orderBy, page, extraColumns = "" } = options;
  const select = `${INSTALL_COLUMNS}${extraColumns ? `,\n  ${extraColumns}` : ""}`;
  const [rows, count] = await Promise.all([
    query<InstallRow>(
      `select ${select} ${INSTALL_FROM} where ${where} order by ${orderBy}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total ${INSTALL_FROM} where ${where}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/* ─────────────────────────────── UI ─────────────────────────────── */

export function StageChip({ stage }: { stage: number | null }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${installStageChip(stage)}`}>
      {installStageLabel(stage)}
    </span>
  );
}

export type TabItem<T extends string> = {
  key: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
};

/** ແທັບ + ຊ່ອງຄົ້ນຫາ — ຫົວຂອງທຸກໜ້າລາຍການຕິດຕັ້ງ */
export function TabsAndSearch<T extends string>({
  tabs,
  current,
  tabHref,
  q,
  sort,
  dir,
  hidden = {},
  placeholder = "ຄົ້ນຫາ ເລກທີ, ເລກບີນ, ລູກຄ້າ, ຊ່າງ, ລາຍການ...",
}: {
  tabs: TabItem<T>[];
  current: T;
  tabHref: (key: T) => string;
  q: string;
  sort: string;
  dir: SortDir;
  /** ຄ່າອື່ນທີ່ຕ້ອງຮັກສາໄວ້ຕອນກົດຄົ້ນຫາ (ເຊັ່ນ tab) */
  hidden?: Record<string, string>;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex overflow-hidden rounded-lg border border-slate-300">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
              current === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
            <span
              className={`rounded px-1 text-[10px] font-bold ${
                current === key ? "bg-white/20" : "bg-slate-100 text-slate-600"
              }`}
            >
              {count}
            </span>
            <LinkPending className="size-3" />
          </Link>
        ))}
      </div>

      <form className="flex flex-1 items-center gap-2">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input name="q" defaultValue={q} placeholder={placeholder} className="w-full text-xs outline-none" />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
      </form>
    </div>
  );
}

export type Column = { key: string; label: string; defaultDir: SortDir };

/** ຫົວຕາຕະລາງ: ຖັນຈັດຮຽງໄດ້ + ຖັນຄົງທີ່ */
export function InstallTableHead({
  columns,
  plain = [],
  sort,
  dir,
  sortHref,
}: {
  columns: Column[];
  plain?: string[];
  sort: string;
  dir: SortDir;
  sortHref: (key: string, dir: SortDir) => string;
}) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
        {columns.map((column) => (
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
        {plain.map((label, index) => (
          <th key={index} className="whitespace-nowrap px-3 py-2.5 font-semibold">
            {label}
          </th>
        ))}
        <th className="px-3 py-2.5" />
      </tr>
    </thead>
  );
}

/**
 * ຊ່ອງມາດຕະຖານຂອງແຖວງານຕິດຕັ້ງ — ຕ້ອງກົງລຳດັບກັບ INSTALL_TABLE_COLUMNS.
 * ໜ້າໃດຢາກເພີ່ມຊ່ອງ ໃຫ້ຕໍ່ <td> ຂອງຕົນຫຼັງຈາກນີ້.
 */
export function InstallCells({ row, timeLabel }: { row: InstallRow; timeLabel?: string }) {
  const tone = elapsedTone(row.elapsed_seconds);
  return (
    <>
      <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
        <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
        {row.code}
        {row.doc_ref_1 && <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{row.doc_ref_1}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <Elapsed
          seconds={row.elapsed_seconds}
          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
        />
        <span className="mt-0.5 block text-[10px] text-slate-400" title={timeLabel}>
          {row.stage_time ?? "-"}
        </span>
      </td>
      <td className="max-w-64 px-3 py-2.5">
        <span className="block truncate font-medium text-slate-800" title={row.item_name ?? ""}>
          {row.item_name || "-"}
        </span>
        <span className="block truncate text-[10px] text-slate-400">
          {[row.pro_brand, row.pro_model, row.pro_type, row.pro_size].filter(Boolean).join(" · ") || "-"}
        </span>
      </td>
      <td className="max-w-44 px-3 py-2.5">
        <span className="block truncate" title={row.customer ?? ""}>
          {row.customer || "-"}
        </span>
        {row.location_inst && (
          <span className="block truncate text-[10px] text-slate-400" title={row.location_inst}>
            {row.location_inst}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-center">
        <span className="block">{row.appoint_date ?? "-"}</span>
        <span className="mt-0.5 block text-[10px] text-slate-400">{row.time_register ?? "-"}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{row.tech_code || "-"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-center text-slate-500">{row.user_created || "-"}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <StageChip stage={row.stage} />
      </td>
    </>
  );
}

/** ຫົວຖັນທີ່ຈັດຮຽງໄດ້ — ຄູ່ກັບ 6 ຊ່ອງທຳອິດຂອງ <InstallCells/> */
export const INSTALL_SORTABLE_COLUMNS: Column[] = [
  { key: "code", label: "ເລກທີ / ເລກບີນ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "item", label: "ລາຍການຕິດຕັ້ງ", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "appoint", label: "ນັດຕິດຕັ້ງ / ເປີດງານ", defaultDir: "desc" },
  { key: "tech", label: "ຊ່າງ", defaultDir: "asc" },
];
/** ຖັນຄົງທີ່ 2 ຖັນສຸດທ້າຍຂອງ <InstallCells/> */
export const INSTALL_PLAIN_COLUMNS = ["ຜູ້ສ້າງ", "ສະຖານະ"];

/** ກອບຕາຕະລາງ + ຂໍ້ຄວາມ "ບໍ່ພົບລາຍການ" */
export function TableShell({ total, minWidth = 1200, children }: { total: number; minWidth?: number; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
    </section>
  );
}

export function Pager({
  page,
  pages,
  total,
  pageHref,
}: {
  page: number;
  pages: number;
  total: number;
  pageHref: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
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
  );
}

/** ຫົວໜ້າ: ຊື່ໜ້າ + ຈຳນວນ + ໜ້າທີ່ເທົ່າໃດ */
export function ListHeader({
  title,
  scope,
  total,
  page,
  pages,
  children,
}: {
  title: string;
  scope: string;
  total: number;
  page: number;
  pages: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {scope} · {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
        </p>
      </div>
      {children}
    </div>
  );
}

/** ອ່ານ searchParams ມາດຕະຖານຂອງໜ້າລາຍການ */
export type ListSearchParams = { tab?: string; q?: string; page?: string; sort?: string; dir?: string };
export function readParams(params: ListSearchParams, defaultSort = "elapsed") {
  return {
    q: (params.q ?? "").trim(),
    page: Math.max(1, Number(params.page) || 1),
    dir: (params.dir === "asc" ? "asc" : "desc") as SortDir,
    sort: (params.sort ?? defaultSort).trim(),
  };
}
