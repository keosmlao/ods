import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { MobileCardList } from "@/components/mobile-card-list";
import { RowLink } from "@/components/row-link";
import { SelectField } from "@/components/select-field";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import {
  INSTALL_ELAPSED_SQL,
  INSTALL_OPEN,
  INSTALL_STAGE_LABEL,
  INSTALL_STAGE_SQL,
  installStageChip,
} from "@/lib/install-stage";
import {
  MAINTENANCE_ELAPSED_SQL,
  MAINTENANCE_OPEN,
  MAINTENANCE_STAGE_LABEL,
  MAINTENANCE_STAGE_SQL,
  maintenanceStageChip,
} from "@/lib/maintenance-stage";
import { ownJobsOnly } from "@/lib/scope";
import { NOT_MISSING, NOT_PENDING_CANCEL, OPEN_JOBS, STAGE_ELAPSED_SQL, STAGE_LABEL, STAGE_SQL, stageLabel } from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";
import { ChevronLeft, ChevronRight, HardHat, Layers, Snowflake, Users, Wrench } from "lucide-react";
import Link from "next/link";

/**
 * **ວຽກຂອງຂ້ອຍ ຕາມຂັ້ນ** — ວຽກທັງໝົດຂອງຊ່າງຄົນດຽວ ແບ່ງເປັນຂັ້ນ ຢູ່ໜ້າດຽວ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ຊ່າງມີເມນູຕໍ່ຄິວ (ກວດເຊັກ · ຮັບອາໄຫຼ່ · ສ້ອມແປງ …) ແຕ່ **ບໍ່ມີບ່ອນໃດເຫັນວຽກຕົນເອງ
 * ຄົບທຸກຂັ້ນພ້ອມກັນ** ⇒ ຢາກຮູ້ວ່າ "ຂ້ອຍມີວຽກຄ້າງຈັກໃບ ຢູ່ຂັ້ນໃດແດ່" ຕ້ອງເປີດ 5-6 ໜ້າ.
 * ຝັ່ງຜູ້ຈັດການມີ /work/* ຢູ່ແລ້ວ ແຕ່ **ຊ່າງບໍ່ມີສິດເປີດ** (roles.ts).
 *
 * ── ຕົວເລກມາຈາກໃສ ──
 * ຂັ້ນອ່ານຈາກ `STAGE_SQL` · `INSTALL_STAGE_SQL` · `MAINTENANCE_STAGE_SQL` ບ່ອນດຽວກັບ
 * ໜ້າລວມ ແລະ ຄິວຂອງຜູ້ຈັດການ ⇒ ຕົວເລກສອງຝັ່ງບໍ່ມີທາງບໍ່ຕົງກັນ.
 *
 * ຂອບເຂດ: ຊ່າງ (technical) ເຫັນ **ສະເພາະຂອງຕົນ** (lib/scope) · ຜູ້ຈັດການ/ຫົວໜ້າຊ່າງ
 * ເລືອກຊ່າງໄດ້ (ຫວ່າງ = ທຸກຊ່າງ).
 */

const PAGE_SIZE = 20;

type WorkflowKey = "repair" | "install" | "maintenance";

type Props = {
  searchParams: Promise<{ wf?: string; stage?: string; tech?: string; page?: string }>;
};

/** ຄ່າຕໍ່ສາຍງານ — ຕາຕະລາງ · ຂັ້ນ · ເວລາຄ້າງ · ຖັນຊ່າງ · ໜ້າລາຍລະອຽດ */
const WORKFLOWS: Record<
  WorkflowKey,
  {
    icon: typeof Wrench;
    from: string;
    stageSql: string;
    elapsedSql: string;
    open: string;
    techCol: string;
    labels: Record<number, string>;
    chip: (stage: number | null) => string;
    href: (code: string) => string;
    /** ຖັນສະແດງ: ຊື່ເຄື່ອງ · SN · ລູກຄ້າ · ນັດໝາຍ (null = ບໍ່ມີ) */
    product: string;
    sn: string;
    customer: string;
    appoint: string | null;
  }
> = {
  repair: {
    icon: Wrench,
    from: "tb_product a left join ar_customer c on c.code = a.cust_code",
    stageSql: STAGE_SQL,
    elapsedSql: STAGE_ELAPSED_SQL,
    open: `${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL}`,
    techCol: "a.emp_code",
    labels: STAGE_LABEL,
    chip: () => "bg-slate-100 text-slate-600",
    href: (code) => `/service/${code}`,
    product: "concat_ws(' ', a.name_1, a.p_model)",
    sn: "a.sn",
    customer: "concat_ws('-', c.name_1, c.tel)",
    appoint: null,
  },
  install: {
    icon: HardHat,
    from: "ods_tb_install a left join ar_customer c on c.code = a.cust_code",
    stageSql: INSTALL_STAGE_SQL,
    elapsedSql: INSTALL_ELAPSED_SQL,
    open: INSTALL_OPEN,
    techCol: "a.tech_code",
    labels: INSTALL_STAGE_LABEL,
    chip: installStageChip,
    href: (code) => `/installations/${code}`,
    product: "concat_ws(' ', a.item_name, a.pro_model)",
    sn: "a.pro_sn",
    customer: "concat_ws('-', c.name_1, c.tel)",
    appoint: "to_char(a.appoint_date,'DD-MM-YYYY')",
  },
  maintenance: {
    icon: Snowflake,
    from: "ods_tb_maintenance a",
    stageSql: MAINTENANCE_STAGE_SQL,
    elapsedSql: MAINTENANCE_ELAPSED_SQL,
    open: MAINTENANCE_OPEN,
    techCol: "a.emp_code",
    labels: MAINTENANCE_STAGE_LABEL,
    chip: maintenanceStageChip,
    href: (code) => `/maintenance/${code}`,
    product: "coalesce(a.location,'-')",
    sn: "''",
    customer: "concat_ws('-', a.cust_name, a.cust_tel)",
    appoint: "to_char(a.appoint_date,'DD-MM-YYYY')",
  },
};

type StageCount = { stage: number; n: number };

type JobRow = {
  code: string;
  stage: number;
  elapsed_seconds: number | null;
  product: string | null;
  sn: string | null;
  customer: string | null;
  appoint: string | null;
  /** ສ້ອມແປງ: ປ້າຍຂັ້ນຂອງ IH ຕ່າງຄຳ ⇒ ຕ້ອງຮູ້ປະເພດບໍລິການ */
  service_type: string | null;
};

/** ນັບວຽກຄ້າງຂອງແຕ່ລະຂັ້ນ — query ດຽວຕໍ່ສາຍງານ, ບໍ່ດຶງແຖວ */
async function stageCounts(wf: WorkflowKey, tech: string) {
  const config = WORKFLOWS[wf];
  const scope = tech ? `and ${config.techCol} = $1` : "";
  const sql = `select (${config.stageSql})::int stage, count(*)::int n
    from ${config.from}
    where ${config.open} ${scope}
    group by 1`;
  const rows = (await query<StageCount>(sql, tech ? [tech] : [])).rows;
  // ຂັ້ນລົບ (-1 = ລໍອະນຸມັດຍົກເລີກ · ຂັ້ນປິດ) ບໍ່ແມ່ນວຽກທີ່ຕ້ອງລົງມື ⇒ ບໍ່ນັບ
  return rows.filter((row) => row.stage >= 0);
}

async function jobs(wf: WorkflowKey, tech: string, stage: number | null, page: number) {
  const config = WORKFLOWS[wf];
  const params: (string | number)[] = [];
  const where = [config.open];
  if (tech) { params.push(tech); where.push(`${config.techCol} = $${params.length}`); }
  if (stage !== null) { params.push(stage); where.push(`(${config.stageSql}) = $${params.length}`); }
  else where.push(`(${config.stageSql}) >= 0`);
  const filter = where.join(" and ");

  const rowsSql = `select a.code, (${config.stageSql})::int stage,
      ${config.elapsedSql} elapsed_seconds,
      ${config.product} product, ${config.sn} sn, ${config.customer} customer,
      ${config.appoint ?? "null"} appoint,
      ${wf === "repair" ? "a.service_type" : "null"} service_type
    from ${config.from}
    where ${filter}
    order by stage asc, elapsed_seconds desc
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from ${config.from} where ${filter}`;

  const [rows, total] = await Promise.all([
    query<JobRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: total.rows[0]?.total ?? 0 };
}

export default async function MyJobsPage({ searchParams }: Props) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const t = (await getDictionary(await getLocale())).myJobs;

  // ຊ່າງ = ຖືກລັອກໃສ່ຕົນເອງ · ຄົນອື່ນ (ຜູ້ຈັດການ/ຫົວໜ້າຊ່າງ) ເລືອກໄດ້
  const own = ownJobsOnly(session);
  const canChoose = own === null;
  const tech = own ?? (params.tech ?? "").trim();

  const wf: WorkflowKey = params.wf === "install" || params.wf === "maintenance" ? params.wf : "repair";
  const stage = params.stage != null && params.stage !== "" && Number.isFinite(Number(params.stage))
    ? Number(params.stage)
    : null;
  const page = Math.max(1, Number(params.page) || 1);

  const [repairCounts, installCounts, maintenanceCounts, list, technicians] = await Promise.all([
    stageCounts("repair", tech),
    stageCounts("install", tech),
    stageCounts("maintenance", tech),
    jobs(wf, tech, stage, page),
    canChoose ? listTechnicians() : Promise.resolve([]),
  ]);

  const countsOf: Record<WorkflowKey, StageCount[]> = {
    repair: repairCounts,
    install: installCounts,
    maintenance: maintenanceCounts,
  };
  const sum = (rows: StageCount[]) => rows.reduce((total, row) => total + row.n, 0);
  const active = countsOf[wf];
  const config = WORKFLOWS[wf];
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  const base = () => ({ ...(tech && canChoose && { tech }) });
  const wfHref = (target: WorkflowKey) => `/my-jobs?${new URLSearchParams({ ...base(), wf: target })}`;
  const stageHref = (target: number | null) =>
    `/my-jobs?${new URLSearchParams({ ...base(), wf, ...(target !== null && { stage: String(target) }) })}`;
  const pageHref = (n: number) =>
    `/my-jobs?${new URLSearchParams({
      ...base(),
      wf,
      ...(stage !== null && { stage: String(stage) }),
      ...(n > 1 && { page: String(n) }),
    })}`;

  const TABS: { key: WorkflowKey; label: string }[] = [
    { key: "repair", label: t.repair },
    { key: "install", label: t.install },
    { key: "maintenance", label: t.maintenance },
  ];

  // ຊ່າງ: ບໍ່ໂຊ້ຊື່ຜູ້ໃຊ້ດິບ (session ມີແຕ່ username) — ບອກເປັນຄຳແທນ
  const who = own
    ? t.yourJobs
    : tech
    ? (technicians.find((item) => item.code === tech)?.name ?? tech)
    : t.allTechnicians;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-700">{own ? t.title : t.titleManager}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {who} · {t.openJobs} {(sum(repairCounts) + sum(installCounts) + sum(maintenanceCounts)).toLocaleString()}
            {` · ${t.repair} ${sum(repairCounts)} · ${t.install} ${sum(installCounts)} · ${t.maintenance} ${sum(maintenanceCounts)}`}
          </p>
        </div>

        {/* ຜູ້ຈັດການ/ຫົວໜ້າຊ່າງ — ເລືອກຊ່າງ (ຫວ່າງ = ທຸກຊ່າງ) */}
        {canChoose && (
          <form className="flex items-center gap-2">
            <input type="hidden" name="wf" value={wf} />
            <Users className="size-4 text-slate-400" />
            <div className="w-64">
              <SelectField
                name="tech"
                defaultValue={tech}
                placeholder={t.allTechnicians}
                options={technicians.map((item) => ({
                  value: item.code,
                  label: `${item.name}${item.head ? " · ຫົວໜ້າ" : ""}`,
                }))}
              />
            </div>
            <button className="h-10 rounded-lg bg-brand-900 px-4 text-sm font-medium text-white">{t.show}</button>
          </form>
        )}
      </div>

      {/* ສາຍງານ + ຂັ້ນ */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {TABS.map(({ key, label }) => {
            const Icon = WORKFLOWS[key].icon;
            return (
              <Link
                key={key}
                href={wfHref(key)}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 border-l border-slate-300 px-3 text-sm font-medium first:border-l-0 ${
                  wf === key ? "bg-brand-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="size-4" />
                {label}
                <span className={`rounded px-1.5 text-xs font-bold ${wf === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                  {sum(countsOf[key])}
                </span>
                <LinkPending />
              </Link>
            );
          })}
        </div>

        {/* ຂັ້ນທີ່ມີວຽກຢູ່ຈິງ — ບໍ່ໂຊ້ຂັ້ນຫວ່າງ ໃຫ້ຮົກຕາ */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={stageHref(null)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
              stage === null ? "border-brand-900 bg-brand-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers className="size-4" />
            {t.allStages}
            <span className={`rounded px-1.5 text-xs font-bold ${stage === null ? "bg-white/20" : "bg-slate-100"}`}>
              {sum(active)}
            </span>
            <LinkPending />
          </Link>

          {active
            .slice()
            .sort((a, b) => a.stage - b.stage)
            .map((row) => (
              <Link
                key={row.stage}
                href={stageHref(row.stage)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm ${
                  stage === row.stage
                    ? "border-brand-900 bg-brand-900 font-semibold text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {config.labels[row.stage] ?? `${t.stage} ${row.stage}`}
                <span className={`rounded px-1.5 text-xs font-bold ${stage === row.stage ? "bg-white/20" : "bg-slate-100"}`}>
                  {row.n}
                </span>
                <LinkPending />
              </Link>
            ))}

          {active.length === 0 && <span className="py-1.5 text-sm text-slate-400">{t.noOpenJobs}</span>}
        </div>
      </div>

      {/* ຕາຕະລາງ — ເດັສທັອບ */}
      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="whitespace-nowrap px-3 py-3 text-center font-semibold">{t.colCode}</th>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colStage}</th>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colElapsed}</th>
                <th className="px-3 py-3 font-semibold">{t.colProduct}</th>
                <th className="px-3 py-3 font-semibold">{t.colCustomer}</th>
                {config.appoint && <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colAppoint}</th>}
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                const label = wf === "repair"
                  ? stageLabel(row.stage, row.service_type)
                  : (config.labels[row.stage] ?? `${t.stage} ${row.stage}`);
                return (
                  <RowLink key={row.code} href={config.href(row.code)} className="relative border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-3 text-center font-bold text-brand">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      <Link href={config.href(row.code)} className="hover:underline">{row.code}</Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${config.chip(row.stage)}`}>{label}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <Elapsed
                        seconds={row.elapsed_seconds}
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${tone.chip}`}
                      />
                    </td>
                    <td className="max-w-72 px-3 py-3">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"}
                      </span>
                      {row.sn && <span className="block truncate text-xs text-slate-400">SN: {row.sn}</span>}
                    </td>
                    <td className="max-w-56 truncate px-3 py-3" title={row.customer ?? ""}>{row.customer || "-"}</td>
                    {config.appoint && (
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{row.appoint || "-"}</td>
                    )}
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Link
                        href={config.href(row.code)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {t.open}
                        <LinkPending />
                      </Link>
                    </td>
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.total === 0 && <p className="py-12 text-center text-sm text-slate-400">{t.noResults}</p>}
      </section>

      {/* ບັດ — ມືຖື */}
      <div className="md:hidden">
        <MobileCardList className="space-y-2">
          {list.rows.map((row) => {
            const tone = elapsedTone(row.elapsed_seconds);
            const label = wf === "repair"
              ? stageLabel(row.stage, row.service_type)
              : (config.labels[row.stage] ?? `${t.stage} ${row.stage}`);
            return (
              <Link
                key={row.code}
                href={config.href(row.code)}
                className="relative block overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                <div className="flex items-start justify-between gap-2">
                  <span className="text-base font-bold text-brand">{row.code}</span>
                  <Elapsed
                    seconds={row.elapsed_seconds}
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${tone.chip}`}
                  />
                </div>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${config.chip(row.stage)}`}>
                  {label}
                </span>
                <p className="mt-1.5 text-sm font-medium text-slate-800">{row.product || "-"}</p>
                {row.sn && <p className="text-xs text-slate-400">SN: {row.sn}</p>}
                <p className="mt-1 text-sm text-slate-600">{row.customer || "-"}</p>
                {config.appoint && row.appoint && (
                  <p className="mt-1 text-xs text-slate-500">{t.colAppoint}: {row.appoint}</p>
                )}
              </Link>
            );
          })}
        </MobileCardList>
        {list.total === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">{t.noResults}</p>
        )}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} {t.of} {list.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              {t.prev}
              <LinkPending />
            </Link>
            <span className="px-3 py-2 font-medium text-slate-700">{page} / {pages}</span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.next}
              <LinkPending />
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
