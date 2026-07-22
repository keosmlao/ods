import { Elapsed } from "@/components/elapsed";
import type { SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import {
  MAINTENANCE_ELAPSED_SQL,
  MAINTENANCE_STAGE_SQL,
  MAINTENANCE_STAGE_TIME_COL,
  maintenanceStageChip,
  maintenanceStageLabel,
} from "@/lib/maintenance-stage";
import Link from "next/link";

/**
 * ຊິ້ນສ່ວນທີ່ໜ້າສ້ອມບໍລຸງທຸກໜ້າໃຊ້ຮ່ວມກັນ — ຕາຕະລາງ · ຄົ້ນຫາ · ແບ່ງໜ້າ.
 * **ໜ້າຕາຄືໜ້າຕິດຕັ້ງ**: reuse shell ທົ່ວໄປ (ListHeader/SearchBar/TableShell/Pager/InstallTableHead)
 * ຈາກ ../installations/shared — ບ່ອນນີ້ໃສ່ສະເພາະຊ່ອງ/ຄໍລຳຂອງ ods_tb_maintenance.
 */
export { PAGE_SIZE, ListHeader, SearchBar, TableShell, Pager, InstallTableHead as MaintTableHead, readParams, type Column, type ListSearchParams } from "../installations/shared";

export type MaintenanceRow = {
  code: string;
  customer: string | null;
  location: string | null;
  tech: string | null;
  total: number;
  time_register: string | null;
  appoint_date: string | null;
  stage: number;
  elapsed_seconds: number | null;
  stage_time: string | null;
  services: string | null;
};

/** ຕາຕະລາງ ods_tb_maintenance = a */
export const MAINTENANCE_FROM = "from ods_tb_maintenance a";

export const MAINTENANCE_COLUMNS = `a.code,
  concat_ws(' · ', a.cust_name, a.cust_tel) customer,
  a.location, a.emp_code tech,
  coalesce(a.total,0)::float total,
  to_char(a.time_register,'DD-MM-YYYY HH24:MI') time_register,
  to_char(a.appoint_date,'DD-MM-YYYY') appoint_date,
  (${MAINTENANCE_STAGE_SQL}) stage,
  ${MAINTENANCE_ELAPSED_SQL} elapsed_seconds,
  to_char((${MAINTENANCE_STAGE_TIME_COL}),'DD-MM-YYYY HH24:MI') stage_time,
  (select string_agg(d.name, ', ') from ods_tb_maintenance_detail d where d.job_code = a.code) services`;

export const MAINTENANCE_SEARCH = `(a.code ilike $Q or a.cust_name ilike $Q or a.cust_tel ilike $Q
  or a.location ilike $Q or a.emp_code ilike $Q or a.remark ilike $Q)`;

/** whitelist ຈັດຮຽງ — ກັນ SQL injection. at_col = ຖັນເວລາຂອງຂັ້ນປັດຈຸບັນ */
export const MAINTENANCE_SORT_SQL: Record<string, string> = {
  code: "a.code",
  elapsed: "at_col",
  services: "(select string_agg(d.name, ',') from ods_tb_maintenance_detail d where d.job_code = a.code)",
  customer: "a.cust_name",
  appoint: "a.appoint_date",
  tech: "a.emp_code",
  stage: `(${MAINTENANCE_STAGE_SQL})`,
};

export function maintenanceOrderBy(sort: string, dir: SortDir, timeCol = MAINTENANCE_STAGE_TIME_COL) {
  const column = MAINTENANCE_SORT_SQL[sort] ?? "at_col";
  if (column === "at_col") return `(${timeCol}) ${dir === "desc" ? "asc" : "desc"} nulls last`;
  return `${column} ${dir === "asc" ? "asc" : "desc"} nulls last`;
}

/** ດຶງແຖວ + ນັບຈຳນວນທັງໝົດພ້ອມກັນ (ຄູ່ກັບ fetchInstallRows) */
export async function fetchMaintenanceRows(options: {
  where: string;
  params: (string | number)[];
  orderBy: string;
  page: number;
  pageSize: number;
}) {
  const { where, params, orderBy, page, pageSize } = options;
  const [rows, count] = await Promise.all([
    query<MaintenanceRow>(
      `select ${MAINTENANCE_COLUMNS} ${MAINTENANCE_FROM} where ${where} order by ${orderBy}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    ),
    query<{ total: number }>(`select count(*)::int total ${MAINTENANCE_FROM} where ${where}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/* ─────────────────────────────── UI ─────────────────────────────── */

export function MaintStageChip({ stage }: { stage: number | null }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${maintenanceStageChip(stage)}`}>
      {maintenanceStageLabel(stage)}
    </span>
  );
}

/** ຫົວຖັນທີ່ຈັດຮຽງໄດ້ — ຄູ່ກັບ 6 ຊ່ອງທຳອິດຂອງ <MaintenanceCells/> */
export const MAINT_SORTABLE_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "services", label: "ບໍລິການ", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "appoint", label: "ນັດ / ເປີດງານ", defaultDir: "desc" },
  { key: "tech", label: "ຊ່າງ", defaultDir: "asc" },
];
/** ຖັນຄົງທີ່ 2 ຖັນສຸດທ້າຍ */
export const MAINT_PLAIN_COLUMNS = ["ລວມ (ກີບ)", "ສະຖານະ"];

/** ຊ່ອງມາດຕະຖານຂອງແຖວງານສ້ອມບໍລຸງ — ຕ້ອງກົງລຳດັບກັບ MAINT_SORTABLE_COLUMNS + MAINT_PLAIN_COLUMNS */
export function MaintenanceCells({ row }: { row: MaintenanceRow }) {
  const tone = elapsedTone(row.elapsed_seconds);
  return (
    <>
      <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
        <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
        <Link href={`/maintenance/${encodeURIComponent(row.code)}`} className="hover:underline">{row.code}</Link>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <Elapsed seconds={row.elapsed_seconds} className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`} />
        <span className="mt-0.5 block text-[10px] text-slate-400">{row.stage_time ?? "-"}</span>
      </td>
      <td className="max-w-64 px-3 py-2.5">
        <span className="block truncate font-medium text-slate-800" title={row.services ?? ""}>{row.services || "-"}</span>
      </td>
      <td className="max-w-44 px-3 py-2.5">
        <span className="block truncate" title={row.customer ?? ""}>{row.customer || "-"}</span>
        {row.location && <span className="block truncate text-[10px] text-slate-400" title={row.location}>{row.location}</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-center">
        <span className="block">{row.appoint_date ?? "-"}</span>
        <span className="mt-0.5 block text-[10px] text-slate-400">{row.time_register ?? "-"}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{row.tech || "-"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">{row.total ? row.total.toLocaleString() : "-"}</td>
      <td className="whitespace-nowrap px-3 py-2.5"><MaintStageChip stage={row.stage} /></td>
    </>
  );
}
