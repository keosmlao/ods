import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
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

/** ຊ່ອງທີ່ <InstallCells/> ຕ້ອງການ — ໜ້າທີ່ດຶງຈາກ ic_trans ກໍໃຫ້ຊ່ອງຊຸດນີ້ຄືກັນ */
export type InstallCellRow = {
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
};

export type InstallRow = InstallCellRow & {
  complain_cust: string | null;
  cancel_date: string | null;
  cancel_remark: string | null;
  cancel_code: string | null;
  used_spare: number | null;
};

/** ແຖວທີ່ມາຈາກໃບເອກະສານ (ic_trans) — ໃບຂໍເບີກ / ໃບເບີກ / ໃບຮັບອາໄຫຼ່ */
export type InstallDocRow = InstallCellRow & {
  doc_no: string;
  /** ວັນ/ເວລາຂອງໃບ */
  doc_time: string | null;
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
 * sortSql = whitelist ຂອງໜ້ານັ້ນ (ໜ້າໃບເບີກໃຊ້ INSTALL_DOC_SORT_SQL ທີ່ມີ doc_no ເພີ່ມ).
 */
/** ຮຽງຕາມນາລິກາ 24 ຊມ (ນ້ອຍສຸດ = ໃກ້ໝົດ/ເລີຍແລ້ວ ຂຶ້ນກ່ອນ) — ບິນທີ່ບໍ່ມີວັນທີ ຕົກລຸ່ມສຸດ */
const SLA_ORDER = `(${INSTALL_LEFT_SQL}) asc nulls last`;

export function installOrderBy(
  sort: string,
  dir: SortDir,
  timeCol = INSTALL_STAGE_TIME_COL,
  sortSql: Record<string, string> = INSTALL_SORT_SQL,
) {
  if (sort === "sla") return SLA_ORDER;
  const column = sortSql[sort] ?? "at_col";
  if (column === "at_col") return `(${timeCol}) ${dir === "desc" ? "asc" : "desc"} nulls last`;
  return `${column} ${dir === "asc" ? "asc" : "desc"} nulls last`;
}

/* ── ໜ້າທີ່ດຶງຈາກໃບເອກະສານ (ic_trans = ic) ແທນທີ່ຈະດຶງຈາກງານ (ods_tb_install = a) ── */

/**
 * ຊ່ອງມາດຕະຖານຂອງແຖວໃບເບີກ — ic = ic_trans, a = ods_tb_install (left join), c = ar_customer.
 * ໃຊ້ left join ຈຶ່ງມີແຖວໃບເບີກທີ່ຫາງານຄູ່ບໍ່ພົບ (ຂໍ້ມູນເກົ່າ) ນຳ — ຈຳນວນແຖວຄືເກົ່າທຸກປະການ.
 */
export const INSTALL_DOC_COLUMNS = `ic.doc_no,
  coalesce(a.code, ic.product_code) code,
  concat_ws('-', c.name_1, c.tel) customer,
  a.item_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
  a.doc_ref_1, a.tech_code, coalesce(ic.user_created, a.user_created) user_created, a.location_inst,
  to_char(a.time_register,'DD-MM-YYYY HH24:MI') time_register,
  to_char(a.appoint_date,'DD-MM-YYYY') appoint_date,
  (${INSTALL_STAGE_SQL}) stage,
  ${INSTALL_ELAPSED_SQL} elapsed_seconds,
  to_char((${INSTALL_STAGE_TIME_COL}),'DD-MM-YYYY HH24:MI') stage_time,
  to_char(coalesce(ic.create_date_time_now, ic.doc_date),'DD-MM-YYYY HH24:MI') doc_time`;

/** ຄົ້ນຫາໃນໜ້າໃບເບີກ — ຄືກັບ INSTALL_SEARCH ແຕ່ຄົ້ນເລກທີໃບໄດ້ນຳ */
export const INSTALL_DOC_SEARCH = `(ic.doc_no ilike $Q or ic.product_code ilike $Q or a.code ilike $Q
  or a.doc_ref_1 ilike $Q or a.item_name ilike $Q or a.pro_brand ilike $Q or a.pro_model ilike $Q
  or a.pro_sn ilike $Q or a.tech_code ilike $Q or a.location_inst ilike $Q
  or c.name_1 ilike $Q or c.tel ilike $Q)`;

/** whitelist ຂອງໜ້າໃບເບີກ — ເພີ່ມ doc_no ຈາກ whitelist ຂອງງານ */
export const INSTALL_DOC_SORT_SQL: Record<string, string> = { ...INSTALL_SORT_SQL, doc_no: "ic.doc_no" };

/** ຖັນທີ່ຈັດຮຽງໄດ້ ຕໍ່ທ້າຍຕາຕະລາງໜ້າໃບເບີກ */
export const INSTALL_DOC_COLUMN: Column = { key: "doc_no", label: "ເລກທີໃບ", defaultDir: "desc" };

/** ດຶງແຖວໃບເບີກ + ນັບຈຳນວນທັງໝົດພ້ອມກັນ */
export async function fetchInstallDocRows<T extends InstallDocRow>(options: {
  /** ປະໂຫຍກ from ເຕັມ (ຕ້ອງ alias ic / a / c) */
  from: string;
  where: string;
  params: (string | number)[];
  orderBy: string;
  page: number;
  extraColumns?: string;
}) {
  const { from, where, params, orderBy, page, extraColumns = "" } = options;
  const select = `${INSTALL_DOC_COLUMNS}${extraColumns ? `,\n  ${extraColumns}` : ""}`;
  const [rows, count] = await Promise.all([
    query<T>(
      `select ${select} ${from} where ${where} order by ${orderBy}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total ${from} where ${where}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ດຶງແຖວ + ນັບຈຳນວນທັງໝົດພ້ອມກັນ */
export async function fetchInstallRows<T extends InstallRow = InstallRow>(options: {
  where: string;
  params: (string | number)[];
  orderBy: string;
  page: number;
  extraColumns?: string;
}) {
  const { where, params, orderBy, page, extraColumns = "" } = options;
  const select = `${INSTALL_COLUMNS}${extraColumns ? `,\n  ${extraColumns}` : ""}`;
  const [rows, count] = await Promise.all([
    query<T>(
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

/**
 * ແທັບ + ຊ່ອງຄົ້ນຫາ — ຫົວຂອງທຸກໜ້າລາຍການຕິດຕັ້ງ.
 *
 * ── ອອກແບບໃໝ່ ──
 * ຮຸ່ນກ່ອນເປັນ "ກ່ອງລອຍ" ອີກຊັ້ນນຶ່ງ (ຂອບ + ເງົາ) ວາງທັບຢູ່ເທິງກ່ອງຕາຕະລາງ
 * ⇒ ຫົວໜ້າມີ 3 ຊັ້ນຊ້ອນກັນ (ຫົວຂໍ້ · ແຖວປຸ່ມ · ກ່ອງແທັບ) ກິນທີ່ສູງ ~200px
 * ກ່ອນຈະເຫັນຂໍ້ມູນແຖວທຳອິດ. ດຽວນີ້ແທັບເປັນ **ປຸ່ມລອຍ** (ບໍ່ມີກ່ອງຫຸ້ມ) ແລະ
 * ຊ່ອງຄົ້ນຫາຢູ່ຂວາແຖວດຽວກັນ — ກົດ Enter = ຄົ້ນຫາ ⇒ ບໍ່ຕ້ອງມີປຸ່ມ "ຄົ້ນຫາ" ອີກ.
 */
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
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {/* ແທັບ = ຄິວງານ ⇒ ເລກຄ້າງຕ້ອງເຫັນແຕ່ໄກ (ບໍ່ແມ່ນຕົວເລກນ້ອຍໆຊ້ອນຢູ່ຫຼັງຊື່) */}
      {tabs.map(({ key, label, icon: Icon, count }) => {
        const active = current === key;
        return (
          <Link
            key={key}
            href={tabHref(key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className={`size-3.5 ${active ? "" : "text-slate-400"}`} />
            {label}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {count.toLocaleString()}
            </span>
            <LinkPending className="size-3" />
          </Link>
        );
      })}

      {/* ຄົ້ນຫາ — Enter ພຽງພໍ ບໍ່ຕ້ອງມີປຸ່ມ (ຟອມ submit ເອງ) */}
      <form className="ml-auto flex min-w-64 flex-1 items-center gap-2 md:max-w-sm md:flex-none">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input name="q" defaultValue={q} placeholder={placeholder} className="w-full text-xs outline-none" />
          {q && (
            <Link href="?" className="shrink-0 text-[11px] font-semibold text-slate-400 hover:text-red-600">
              ລ້າງ
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}

/** ຊ່ອງຄົ້ນຫາລ້ວນ — ສຳລັບໜ້າທີ່ບໍ່ມີແທັບ */
export function SearchBar({
  q,
  sort,
  dir,
  placeholder = "ຄົ້ນຫາ ເລກທີໃບ, ເລກທີງານ, ລູກຄ້າ, ຊ່າງ, ລາຍການ...",
}: {
  q: string;
  sort: string;
  dir: SortDir;
  placeholder?: string;
}) {
  return (
    <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={dir} />
      <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
        <Search className="size-3.5 shrink-0 text-slate-400" />
        <input name="q" defaultValue={q} placeholder={placeholder} className="w-full text-xs outline-none" />
      </div>
      <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
    </form>
  );
}

export type Column = { key: string; label: string; defaultDir: SortDir };

/** ຫົວຕາຕະລາງ: ຖັນຈັດຮຽງໄດ້ + ຖັນຄົງທີ່ + ຖັນຈັດຮຽງໄດ້ທ້າຍສຸດ (ເຊັ່ນ ເລກທີໃບ) */
export function InstallTableHead({
  columns,
  plain = [],
  trailing = [],
  sort,
  dir,
  sortHref,
}: {
  columns: Column[];
  plain?: string[];
  trailing?: Column[];
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
        {trailing.map((column) => (
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
  );
}

/** ຊ່ອງ "ເລກທີໃບ" — ເລກທີ + ວັນ/ເວລາຂອງໃບ */
export function DocCell({ row }: { row: InstallDocRow }) {
  return (
    <td className="whitespace-nowrap px-3 py-2.5">
      <span className="font-semibold text-slate-700">{row.doc_no}</span>
      <span className="mt-0.5 block text-[10px] text-slate-400">{row.doc_time ?? "-"}</span>
    </td>
  );
}

/**
 * ຊ່ອງມາດຕະຖານຂອງແຖວງານຕິດຕັ້ງ — ຕ້ອງກົງລຳດັບກັບ INSTALL_TABLE_COLUMNS.
 * ໜ້າໃດຢາກເພີ່ມຊ່ອງ ໃຫ້ຕໍ່ <td> ຂອງຕົນຫຼັງຈາກນີ້.
 */
export function InstallCells({ row, timeLabel }: { row: InstallCellRow; timeLabel?: string }) {
  const tone = elapsedTone(row.elapsed_seconds);
  return (
    <>
      <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
        <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
        {/* ກົດເລກງານ → ໜ້າລາຍລະອຽດ (ອ່ານຢ່າງດຽວ, ເປີດໃຫ້ທຸກ role). list ບໍ່ເຄີຍລິ້ງໄປ detail ມາກ່ອນ */}
        <Link href={`/installations/${encodeURIComponent(row.code)}`} className="hover:underline">
          {row.code}
        </Link>
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
/**
 * ຫົວຂອງໜ້າລາຍການ — **ແຖວດຽວ**: ຊື່ໜ້າ + ຕົວເລກ ຢູ່ຊ້າຍ · ການກະທຳຢູ່ຂວາ.
 *
 * ຮຸ່ນກ່ອນ: ຊື່ໜ້າ → ບັນທັດຄຳອະທິບາຍ → ແຖວປຸ່ມ → ກ່ອງແທັບ = 4 ຊັ້ນກ່ອນຮອດຂໍ້ມູນ.
 * ຕົວເລກ ("30 ລາຍການ · ໜ້າ 2/2") ຍ້າຍມາເປັນ **ປ້າຍ** ຢູ່ຂ້າງຊື່ ⇒ ອ່ານໄດ້ໄວກວ່າ
 * ບັນທັດຂໍ້ຄວາມສີເທົາ ແລະ ບໍ່ກິນຄວາມສູງເພີ່ມ.
 */
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>

      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 tabular-nums">
        {total.toLocaleString()} ລາຍການ
      </span>
      {pages > 1 && (
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
          ໜ້າ {page}/{pages}
        </span>
      )}
      {/* ຊ່າງເຫັນສະເພາະງານຂອງຕົນ — ຕ້ອງບອກໃຫ້ຮູ້ ບໍ່ດັ່ງນັ້ນເຂົ້າໃຈວ່າງານຫາຍ */}
      <span className="text-[11px] text-slate-400">{scope}</span>

      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
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
