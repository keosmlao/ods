import { qcRoles } from "@/app/actions/qc-admin";
import { QcRoleMatrix } from "./qc-role-matrix";
import { ActiveToggle, RoleSelect } from "./role-controls";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { listEmployeeOverrides } from "@/lib/employee-role";
import { query, queryOdg } from "@/lib/db";
import { ERP_IDENTITY_SQL, roleFromErp } from "@/lib/erp-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { normalizeRole, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { Building2, ChevronLeft, ChevronRight, Search, Settings2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

/**
 * ຈັດການພະນັກງານ / ກຳນົດສິດ — ຜູ້ຈັດການເທົ່ານັ້ນ (lib/roles: /manage/employees).
 *
 * ລາຍຊື່ມາຈາກ ERP (odg_employee — ອ່ານຢ່າງດຽວ) ສ່ວນສິດທີ່ກຳນົດເອງເກັບຢູ່ຖານ ODS
 * (ods_employee_role) ⇒ ຢູ່ຄົນລະຖານ join ໃນ SQL ບໍ່ໄດ້ ຈຶ່ງດຶງມາປະສານກັນຢູ່ JS.
 * ພະນັກງານທັງບໍລິສັດມີ 242 ຄົນ (ໃນຂອບເຂດ 82 ຄົນ) ⇒ ດຶງມາໝົດແລ້ວແບ່ງໜ້າເອງ ບໍ່ໜັກ.
 *
 * ຂອບເຂດຕັ້ງຕົ້ນ = ຝ່າຍບໍລິການ (division 400: 401 ສ້ອມແປງ · 402 ຕິດຕັ້ງ ·
 * 403 ຕິດຕັ້ງໂຄງການ · 405 CS) + ພະແນກສາງ (501) — ກົດ "ພະນັກງານທັງໝົດ" ເພື່ອເບິ່ງຄົນອື່ນ.
 */

const PAGE_SIZE = 20;

type Scope = "service" | "all";
type Props = {
  searchParams: Promise<{
    scope?: string;
    dept?: string;
    role?: string;
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
};

type ErpRow = {
  employee_code: string;
  identity: string | null;
  fullname_lo: string | null;
  department_code: string | null;
  department_name: string | null;
  position_code: string | null;
  position_name: string | null;
  app_role: string | null;
};

type Row = {
  code: string;
  identity: string;
  fullname: string;
  department_code: string;
  department: string;
  position: string;
  /** ສິດຕາມຕຳແໜ່ງ + ພະແນກ (ERP) */
  derived: Role;
  /** ສິດຈາກຕາຕະລາງ users ເກົ່າ — ຊະນະສິດຕາມຕຳແໜ່ງ ແຕ່ແພ້ສິດທີ່ກຳນົດເອງ */
  legacy: Role | null;
  /** ສິດທີ່ຜູ້ຈັດການກຳນົດເອງ */
  assigned: Role | null;
  /** ສິດທີ່ໃຊ້ຈິງຕອນເຂົ້າລະບົບ */
  effective: Role;
  active: boolean;
  updated_by: string | null;
  updated_at: string | null;
};

/** ພະນັກງານ ERP — ຝ່າຍບໍລິການ (400) + ສາງ (501) ຫຼື ທັງໝົດ */
const ERP_SQL = `
  select e.employee_code,
         ${ERP_IDENTITY_SQL} as identity,
         e.fullname_lo, e.department_code, e.position_code, e.app_role,
         d.department_name_lo as department_name,
         p.position_name_lo as position_name
    from odg_employee e
    left join odg_department d on d.department_code = e.department_code
    left join odg_position p on p.position_code = e.position_code
   where e.employment_status = 'ACTIVE'`;

const SCOPE_SQL = ` and (e.division_code = '400' or e.department_code = '501')`;

async function getRows(scope: Scope): Promise<Row[]> {
  const [erp, overrides, legacy] = await Promise.all([
    queryOdg<ErpRow>(ERP_SQL + (scope === "service" ? SCOPE_SQL : "")),
    listEmployeeOverrides(),
    query<{ username: string; roles: string }>(`select username, roles from users`),
  ]);

  const assigned = new Map(overrides.map((row) => [row.employee_code, row]));

  /**
   * ຜູ້ໃຊ້ເກົ່າ (users) — ຈັບຄູ່ດ້ວຍ ລະຫັດພະນັກງານ / ຊື່ຫຼິ້ນ / ຊື່ເຕັມ ຄືກັບຕອນ login.
   * ຄົນດຽວອາດມີຫຼາຍແຖວ (ເຊັ່ນ 24005 ເປັນທັງ manager ແລະ headtechnical)
   * ⇒ ເອົາອັນທີ່ສິດສູງກວ່າ ຄືກັບ order by ຂອງ actions/auth.
   */
  const rank: Record<string, number> = { manager: 1, headtechnical: 2 };
  const legacyByName = new Map<string, Role>();
  for (const row of legacy.rows) {
    const key = (row.username ?? "").trim().toLowerCase();
    if (!key) continue;
    const current = legacyByName.get(key);
    const better = !current || (rank[row.roles] ?? 3) < (rank[current] ?? 3);
    if (better) legacyByName.set(key, normalizeRole(row.roles));
  }

  return erp.rows.map((row) => {
    const identity = (row.identity ?? "").trim() || (row.fullname_lo ?? "").trim() || row.employee_code;
    const override = assigned.get(row.employee_code);
    const derived = normalizeRole(roleFromErp(row.app_role, row.position_code, row.department_code));
    const legacyRole =
      legacyByName.get(row.employee_code.toLowerCase()) ??
      legacyByName.get(identity.toLowerCase()) ??
      legacyByName.get((row.fullname_lo ?? "").trim().toLowerCase()) ??
      null;
    const assignedRole = override?.app_role ? normalizeRole(override.app_role) : null;

    return {
      code: row.employee_code,
      identity,
      fullname: (row.fullname_lo ?? "").trim() || "-",
      department_code: row.department_code ?? "",
      department: (row.department_name ?? "").trim() || "-",
      position: (row.position_name ?? "").trim() || "-",
      derived,
      legacy: legacyRole,
      assigned: assignedRole,
      effective: assignedRole ?? legacyRole ?? derived,
      active: override ? override.active : true,
      updated_by: override?.updated_by ?? null,
      updated_at: override?.updated_at ?? null,
    };
  });
}

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist */
const SORT_KEYS = ["code", "identity", "fullname", "department", "position", "derived", "assigned"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const columns = (t: Record<string, string>): { key: SortKey; label: string; defaultDir: SortDir }[] => [
  { key: "code", label: t.colCode, defaultDir: "asc" },
  { key: "identity", label: t.colNickname, defaultDir: "asc" },
  { key: "fullname", label: t.colFullname, defaultDir: "asc" },
  { key: "department", label: t.colDepartment, defaultDir: "asc" },
  { key: "position", label: t.colPosition, defaultDir: "asc" },
  { key: "derived", label: t.roleByPosition, defaultDir: "asc" },
  { key: "assigned", label: t.assignedRight, defaultDir: "asc" },
];

function sortValue(row: Row, key: SortKey): string {
  switch (key) {
    case "code":
      return row.code;
    case "identity":
      return row.identity;
    case "fullname":
      return row.fullname;
    case "department":
      return row.department;
    case "position":
      return row.position;
    case "derived":
      return ROLE_LABEL[row.derived];
    case "assigned":
      return row.assigned ? ROLE_LABEL[row.assigned] : "￿"; // ຄົນທີ່ຍັງບໍ່ກຳນົດ ໄປທ້າຍສຸດ
  }
}

const ROLE_TONE: Record<Role, string> = {
  manager: "bg-violet-50 text-violet-700",
  headtechnical: "bg-amber-50 text-amber-700",
  admin: "bg-sky-50 text-sky-700",
  stock: "bg-orange-50 text-orange-700",
  technical: "bg-teal-50 text-teal-700",
  sales: "bg-rose-50 text-rose-700",
  user: "bg-slate-100 text-slate-600",
};

export default async function EmployeeRolesPage({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).manageEmployees;
  const params = await searchParams;
  const scope: Scope = params.scope === "all" ? "all" : "service";
  const dept = (params.dept ?? "").trim();
  const roleFilter = (params.role ?? "").trim();
  const q = (params.q ?? "").trim().toLowerCase();
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "department";

  // ຜູ້ມີສິດກວດ QC (ods_qc_role) — ສະແດງຢູ່ບັດທ້າຍໜ້າ
  const [all, qcRoleRows] = await Promise.all([getRows(scope), qcRoles()]);

  // ລາຍການພະແນກສຳລັບຕົວກອງ — ມາຈາກຂອບເຂດປັດຈຸບັນ
  const departments = [...new Map(all.map((row) => [row.department_code, row.department])).entries()]
    .filter(([code]) => code)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const deptCount = new Map<string, number>();
  for (const row of all) deptCount.set(row.department_code, (deptCount.get(row.department_code) ?? 0) + 1);

  const filtered = all
    .filter((row) => !dept || row.department_code === dept)
    .filter((row) => !roleFilter || row.effective === roleFilter)
    .filter(
      (row) =>
        !q ||
        row.code.toLowerCase().includes(q) ||
        row.identity.toLowerCase().includes(q) ||
        row.fullname.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const value = sortValue(a, sort).localeCompare(sortValue(b, sort), "lo");
      return dir === "asc" ? value : -value;
    });

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const assignedCount = all.filter((row) => row.assigned).length;
  const blockedCount = all.filter((row) => !row.active).length;

  const base = () => ({
    ...(scope === "all" && { scope }),
    ...(dept && { dept }),
    ...(roleFilter && { role: roleFilter }),
    ...(q && { q: params.q?.trim() ?? "" }),
  });
  const href = (extra: Record<string, string> = {}) =>
    `/manage/employees?${new URLSearchParams({ ...base(), ...extra })}`;
  const sortHref = (key: string, nextDir: SortDir) => href({ sort: key, dir: nextDir });
  const pageHref = (n: number) => href({ sort, dir, ...(n > 1 && { page: String(n) }) });
  const scopeHref = (target: Scope) =>
    `/manage/employees?${new URLSearchParams({ ...(target === "all" && { scope: "all" }), ...(q && { q: params.q?.trim() ?? "" }) })}`;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
            <ShieldCheck className="size-5 text-slate-400" />
            {t.title}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {total.toLocaleString()} {t.people} · {t.page} {page}/{pages} · {t.assignedOwn} {assignedCount} {t.people} · {t.blocked}{" "}
            {blockedCount} {t.people}
          </p>
        </div>
      </div>

      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        {t.infoPre}{" "}
        <b>{t.roleByPosition}</b> {t.infoMid}{" "}
        <b>{t.blocked}</b> {t.infoPost}
      </p>

      {/* ຂອບເຂດ + ຕົວກອງ + ຄົ້ນຫາ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {(
            [
              { key: "service", label: t.scopeService, icon: Building2 },
              { key: "all", label: t.scopeAll, icon: Users },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={scopeHref(key)}
              className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                scope === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>

        <form className="flex flex-1 flex-wrap items-center gap-2">
          {scope === "all" && <input type="hidden" name="scope" value="all" />}
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />

          <select
            name="dept"
            defaultValue={dept}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">{t.allDepartments}</option>
            {departments.map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({deptCount.get(code) ?? 0})
              </option>
            ))}
          </select>

          <select
            name="role"
            defaultValue={roleFilter}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
          >
            <option value="">{t.allRoles}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>

          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder={t.searchPlaceholder}
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">{t.search}</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns(t).map((column) => (
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colActive}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colMenuCrud}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colLastEditor}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code} className={`border-b border-slate-100 ${row.active ? "hover:bg-slate-50" : "bg-red-50/40"}`}>
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{row.code}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">{row.identity}</td>
                  <td className="max-w-52 truncate px-3 py-2.5 text-slate-600" title={row.fullname}>
                    {row.fullname}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.department}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.position}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ROLE_TONE[row.derived]}`}>
                      {ROLE_LABEL[row.derived]}
                    </span>
                    {row.legacy && row.legacy !== row.derived && (
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {t.legacyPrefix}: {ROLE_LABEL[row.legacy]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <RoleSelect code={row.code} name={row.identity} current={row.assigned} derived={row.derived} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <ActiveToggle code={row.code} name={row.identity} active={row.active} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Link
                      href={`/manage/employees/${encodeURIComponent(row.code)}/permissions`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-100"
                    >
                      <Settings2 className="size-3.5" />
                      {t.setMenus}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                    {row.updated_by ? (
                      <>
                        {row.updated_by}
                        <span className="mt-0.5 block text-[10px] text-slate-400">{row.updated_at}</span>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noEmployees}</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.of} {total.toLocaleString()}
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

      {/**
       * ໃຜກວດຮັບຄຸນນະພາບ (QC) ໄດ້ — **ຢູ່ໜ້າກຳນົດສິດນີ້** ບໍ່ແມ່ນໜ້າແຍກຕ່າງຫາກ.
       * ເລື່ອງ "ໃຜເຮັດຫຍັງໄດ້" ຄວນຢູ່ບ່ອນດຽວ ບໍ່ດັ່ງນັ້ນຜູ້ຈັດການຕ້ອງໄລ່ຫາຕາມໜ້າຕ່າງໆ.
       * (ຄ່າເກັບຢູ່ ods_qc_role — ໜ້າ /manage/qc-checklist ເຫຼືອແຕ່ລາຍການທີ່ຕ້ອງກວດ)
       */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-bold text-slate-700">
          <ShieldCheck className="size-4 text-slate-400" />
          {t.qcTitle}
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          {t.qcDesc}{" "}
          <Link href="/manage/qc-checklist" className="font-semibold text-teal-700 hover:underline">
            {t.qcSetChecklist}
          </Link>
        </p>
        <QcRoleMatrix current={qcRoleRows} />
      </section>
    </div>
  );
}
