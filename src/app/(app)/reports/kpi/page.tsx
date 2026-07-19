import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import {
  frontStageKpi,
  INSTALL_TARGET_HOURS,
  installKpi,
  qualityKpi,
  repairKpi,
  repairSlaCompliance,
  technicianKpi,
  technicianServiceMix,
  technicianSla,
  weeklyThroughput,
  type FlowKpi,
  type Period,
} from "@/lib/kpi";
import { REPAIR_STAGE_POLICIES, REPAIR_SERVICE_TYPES } from "@/lib/repair-sla";
import { Download, HardHat, TrendingUp, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";

/**
 * **KPI ປະສິດທິພາບ — ຕິດຕັ້ງ ແລະ ສ້ອມແປງ.**
 *
 * ຕອບ 3 ຄຳຖາມທີ່ຜູ້ຈັດການຖາມແທ້ໆ:
 *   ① ງານໄຫຼໄດ້ດີບໍ (ຮັບເຂົ້າ vs ປິດໄດ້ · ຄ້າງດຽວນີ້ · ເກີນກຳນົດ)
 *   ② **ຄ້າງຢູ່ຂັ້ນໃດ** — ເວລາຕໍ່ຂັ້ນ (ຂັ້ນທີ່ຍາວສຸດ = ຄໍຂວດ ⇒ ແກ້ບ່ອນນັ້ນຈຶ່ງໄດ້ຜົນ)
 *   ③ ໃຜເຮັດໄດ້ເທົ່າໃດ (ຕໍ່ຊ່າງ)
 *
 * ໃຊ້ **ມັດທະຍົມ** ບໍ່ແມ່ນຄ່າສະເລ່ຍ (ງານຄ້າງ 3 ເດືອນ 1 ງານ ດຶງຄ່າສະເລ່ຍໃຫ້ຜິດຮູບ)
 * ແລະ ສະແດງ p90 ຄູ່ກັນ — "ງານຊ້າສຸດ 10% ໃຊ້ເວລາເທົ່າໃດ".
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ d?: string }> };

type Dict = Record<string, string>;

const PERIODS: Period[] = [30, 90, 180, 365];

/** ຊົ່ວໂມງ → ຂໍ້ຄວາມທີ່ຄົນອ່ານອອກ (48.5 ຊມ = 2 ມື້ 0.5 ຊມ) */
function hours(value: number, t: Dict): string {
  if (!value || value <= 0) return "-";
  if (value < 24) return `${value} ${t.hoursUnitShort}`;
  const days = Math.floor(value / 24);
  const rest = Math.round(value - days * 24);
  return rest > 0 ? `${days} ${t.daysUnit} ${rest} ${t.hoursUnitShort}` : `${days} ${t.daysUnit}`;
}

export default async function KpiPage({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).kpiReport;

  const params = await searchParams;
  const days = (PERIODS.includes(Number(params.d) as Period) ? Number(params.d) : 90) as Period;

  const [install, repair, techs, quality, weeks, repairSla, techSla, serviceMix, frontStage] = await Promise.all([
    installKpi(days),
    repairKpi(days),
    technicianKpi(days),
    qualityKpi(days),
    weeklyThroughput(days),
    repairSlaCompliance(days),
    technicianSla(days),
    technicianServiceMix(days),
    frontStageKpi(days),
  ]);
  const repairSlaMap = new Map(repairSla.map((item) => [`${item.stage}:${item.service_type}`, item]));
  const techSlaMap = new Map(techSla.map((item) => [item.tech, item]));

  // ── ອັດຕາທັນເວລາ ຕໍ່ຝ່າຍ — ລວມ SLA ຕໍ່ຂັ້ນ ຕາມຜູ້ຮັບຜິດຊອບ (ຂ້າມຂັ້ນ external: ລູກຄ້າ/ຜູ້ສະໜອງ)
  const ownerAgg = new Map<string, { within: number; total: number; stages: Set<number> }>();
  for (const policy of REPAIR_STAGE_POLICIES) {
    if (policy.external) continue;
    for (const serviceType of REPAIR_SERVICE_TYPES) {
      const item = repairSlaMap.get(`${policy.stage}:${serviceType}`);
      if (!item) continue;
      const cur = ownerAgg.get(policy.owner) ?? { within: 0, total: 0, stages: new Set<number>() };
      cur.within += item.within_sla;
      cur.total += item.total;
      cur.stages.add(policy.stage);
      ownerAgg.set(policy.owner, cur);
    }
  }
  const ownerRows = [...ownerAgg.entries()]
    .map(([owner, v]) => ({
      owner,
      within: v.within,
      total: v.total,
      stages: [...v.stages].sort((a, b) => a - b),
      pct: v.total ? Math.round((v.within / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const repeatPct = quality.repair_with_sn
    ? Math.round((quality.repeat_repairs / quality.repair_with_sn) * 1000) / 10
    : 0;
  const unhappyPct = quality.feedback_jobs
    ? Math.round((quality.feedback_unhappy / quality.feedback_jobs) * 1000) / 10
    : 0;

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={t.pageSub}>{t.pageTitle}</PageTitle>

      {/* ໄລຍະທີ່ເບິ່ງ */}
      <div className="flex flex-wrap items-center gap-1">
        {PERIODS.map((period) => (
          <Link
            key={period}
            href={`/reports/kpi?d=${period}`}
            className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold transition ${
              days === period ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {period} {t.daysUnit}
          </Link>
        ))}
        <span className="ml-2 text-[11px] text-slate-400">{t.closedInPeriodNote}</span>
        <Link
          href={`/api/reports/export/kpi-tech?d=${days}`}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download className="size-3.5" /> {t.exportTech}
        </Link>
      </div>

      {/* ── ເປົ້າໝາຍຫຼັກ: ຕິດຕັ້ງແລ້ວພາຍໃນ 24 ຊມ ນັບແຕ່ **ອອກບິນ** ── */}
      {install.target && (
        <div
          className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${
            install.target.pct >= 80
              ? "border-emerald-200 bg-emerald-50"
              : install.target.pct >= 50
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-600">
              {t.targetPrefix} <b>{INSTALL_TARGET_HOURS} {t.hoursUnitFull}</b> {t.targetSuffix}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-800">
              {install.target.pct}%
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({install.target.done.toLocaleString()} / {install.target.total.toLocaleString()} {t.jobsUnit})
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t.targetActualPrefix} <b>{hours(install.target.median, t)}</b> {t.targetActualSuffix}
            </p>
          </div>
          <span className="h-2 w-full overflow-hidden rounded-full bg-white sm:w-64">
            <span
              className={`block h-full rounded-full ${install.target.pct >= 80 ? "bg-emerald-500" : "bg-red-500"}`}
              style={{ width: `${Math.max(1, install.target.pct)}%` }}
            />
          </span>
        </div>
      )}

      <Flow title={t.install} icon={<HardHat className="size-4 text-teal-600" />} kpi={install} overdueLabel={t.overdueInstall} t={t} />
      <Flow
        title={t.repairFull}
        icon={<Wrench className="size-4 text-teal-600" />}
        kpi={repair}
        overdueLabel={t.overdueRepair}
        t={t}
      />

      <Card title={t.repairSlaCardTitle}>
        <p className="mb-3 text-xs text-slate-500">
          {t.repairSlaCardNote}
        </p>
        <Table head={[t.colStage, t.colOwner, "KPI", ...REPAIR_SERVICE_TYPES, t.colTarget]} minWidth={1100}>
          {REPAIR_STAGE_POLICIES.map((policy) => (
            <tr key={policy.stage} className="border-b border-slate-100 align-top hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-800">
                {policy.stage}. {policy.label}
                {policy.external && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">External</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-slate-600">{policy.owner}</td>
              <td className="max-w-80 px-3 py-2.5 text-slate-600">{policy.kpi}</td>
              {REPAIR_SERVICE_TYPES.map((code) => {
                const actual = repairSlaMap.get(`${policy.stage}:${code}`);
                const met = actual && actual.total > 0 && actual.pct >= policy.targetPct;
                return (
                  <td key={code} className="whitespace-nowrap px-3 py-2.5 text-center tabular-nums">
                    <span className="block font-semibold text-slate-700">SLA {hours(policy.hours[code], t)}</span>
                    <span className={`mt-0.5 block text-[10px] font-bold ${
                      !actual?.total ? "text-slate-400" : met ? "text-emerald-700" : "text-red-600"
                    }`}>
                      {t.resultPrefix} {actual?.total ? `${actual.pct}% (${actual.within_sla}/${actual.total})` : "-"}
                    </span>
                  </td>
                );
              })}
              <td className="whitespace-nowrap px-3 py-2.5 text-center font-bold text-teal-700">≥ {policy.targetPct}%</td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* ── ຄຸນນະພາບ: ໄວຢ່າງດຽວບໍ່ພຽງພໍ ── */}
      <Card title={t.qualityCardTitle}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t.repeatLabel}
            text={`${repeatPct}%`}
            note={`${quality.repeat_repairs.toLocaleString()} / ${quality.repair_with_sn.toLocaleString()} ${t.sheetsUnit}`}
            tone={repeatPct >= 20 ? "bad" : "plain"}
          />
          <Stat
            label={t.unhappyLabel}
            text={`${unhappyPct}%`}
            note={`${quality.feedback_jobs.toLocaleString()} ${t.feedbackJobsNote}`}
            tone={unhappyPct >= 20 ? "bad" : "plain"}
          />
          <Stat
            label={t.avgScoreLabel}
            text={quality.feedback_avg ? String(quality.feedback_avg) : "-"}
            note={t.avgScoreNote}
          />
          <Stat
            label={t.rejectsLabel}
            value={quality.rejects}
            note={`${t.qcDefectPrefix} ${quality.qc_failed_jobs} ${t.jobsUnit}`}
            tone={quality.rejects > 0 ? "bad" : "plain"}
          />
        </div>
        {quality.qc_answers === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {t.qcNoDataNote}
          </p>
        )}
      </Card>

      {/* ── ປະລິມານຕໍ່ອາທິດ: ຮັບເຂົ້າ vs ປິດໄດ້ (ຮັບເຂົ້າ > ປິດ ຕິດຕໍ່ກັນ = ງານກອງ) ── */}
      <Card title={t.weeklyCardTitle}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Weekly title={t.install} points={weeks.install} t={t} />
          <Weekly title={t.repairFull} points={weeks.repair} t={t} />
        </div>
      </Card>

      {/* ③ ຕໍ່ຊ່າງ */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <TrendingUp className="size-4 text-teal-600" />
            {t.techResultsTitle} ({days} {t.daysUnit})
          </span>
        }
      >
        {techs.length === 0 ? (
          <Empty>{t.techNoJobs}</Empty>
        ) : (
          <Table head={[t.colTech, t.install, t.colRepair, t.colTotal, t.colTimePerJob, t.colSlaOnTime, t.colRejects, t.colQcFail]} minWidth={920}>
            {techs.map((tech) => {
              const sla = techSlaMap.get(tech.tech);
              return (
              <tr key={tech.tech} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-800">{tech.tech}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{tech.install_done}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{tech.repair_done}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-slate-800">
                  {tech.install_done + tech.repair_done}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-600">{hours(tech.median_hours, t)}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  {sla ? (
                    <span className="inline-flex flex-col items-center leading-tight">
                      <span className={`font-bold ${sla.pct >= 90 ? "text-emerald-600" : sla.pct >= 75 ? "text-amber-600" : "text-red-600"}`}>
                        {sla.pct}%
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {sla.within_sla}/{sla.total}{sla.late > 0 ? ` · ${t.lateLabel} ${sla.late}` : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-300">–</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  {/* ປະຕິເສດຫຼາຍ = ຈັດງານບໍ່ຕົງຄົນ ຫຼື ຊ່າງເລືອກງານ ⇒ ຄວນຖາມ */}
                  <span className={tech.rejects > 0 ? "font-bold text-amber-700" : "text-slate-400"}>
                    {tech.rejects}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  <span className={tech.qc_failed > 0 ? "font-bold text-red-600" : "text-slate-400"}>
                    {tech.qc_failed}
                  </span>
                </td>
              </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ④ ແຍກປະເພດບໍລິການ ຕໍ່ຊ່າງ — ໃຜເຮັດ IH/PS (ໄປໜ້າງານ) vs CI/ST (ຢູ່ສູນ) */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <Wrench className="size-4 text-teal-600" />
            {t.serviceMixTitle} ({days} {t.daysUnit})
          </span>
        }
      >
        {serviceMix.length === 0 ? (
          <Empty>{t.serviceMixNoJobs}</Empty>
        ) : (
          <Table head={[t.colTech, t.colCiImport, t.colStStock, t.colIhHome, t.colPsPickup, t.colTotal]} minWidth={720}>
            {serviceMix.map((row) => (
              <tr key={row.tech} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-800">{row.tech}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{row.ci || "–"}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{row.st || "–"}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  <span className={row.ih > 0 ? "font-semibold text-emerald-700" : "text-slate-300"}>{row.ih || "–"}</span>
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  <span className={row.ps > 0 ? "font-semibold text-amber-700" : "text-slate-300"}>{row.ps || "–"}</span>
                </td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-slate-800">{row.total}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* ⑤ ອັດຕາທັນເວລາ ຕໍ່ຝ່າຍ — ໃຜ (ຊ່າງ/CS/ສາງ/ຫົວໜ້າ) ຮັບຜິດຊອບ ແລ້ວທັນ SLA ບໍ */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <TriangleAlert className="size-4 text-teal-600" />
            {t.ownerSlaTitle} ({days} {t.daysUnit})
          </span>
        }
      >
        {ownerRows.length === 0 ? (
          <Empty>{t.ownerSlaNoData}</Empty>
        ) : (
          <Table head={[t.colOwnerDept, t.colStage, t.colOnTime, t.colSheetsWithinTotal]} minWidth={640}>
            {ownerRows.map((row) => (
              <tr key={row.owner} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2.5 font-semibold text-slate-800">{row.owner}</td>
                <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">{row.stages.join(", ")}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`font-bold ${row.pct >= 90 ? "text-emerald-600" : row.pct >= 75 ? "text-amber-600" : "text-red-600"}`}>
                    {row.pct}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">{row.within}/{row.total}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* ⑥ ຂັ້ນໜ້າ (workflow ໃໝ່): PS ໄປຮັບ · IH ນັດ/ຈັດຊ່າງ — ຂໍ້ມູນເກັບຈາກນີ້ໄປ */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <TrendingUp className="size-4 text-teal-600" />
            {t.frontStageTitle} ({days} {t.daysUnit})
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-xs font-bold text-amber-700">{t.psStageLabel}</p>
            {frontStage.ps.count === 0 ? (
              <p className="mt-2 text-sm text-slate-400">{t.noDataNewColumn}</p>
            ) : (
              <p className="mt-2">
                <span className="text-2xl font-extrabold tabular-nums text-slate-800">{hours(frontStage.ps.median_hours ?? 0, t)}</span>
                <span className="ml-2 text-xs text-slate-500">{t.medianPrefix} · {frontStage.ps.count} {t.sheetsUnit}</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">{t.psStageNote}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs font-bold text-emerald-700">{t.ihStageLabel}</p>
            {frontStage.ih.count === 0 ? (
              <p className="mt-2 text-sm text-slate-400">{t.noDataNewColumn}</p>
            ) : (
              <p className="mt-2">
                <span className="text-2xl font-extrabold tabular-nums text-slate-800">{hours(frontStage.ih.median_hours ?? 0, t)}</span>
                <span className="ml-2 text-xs text-slate-500">{t.medianPrefix} · {frontStage.ih.count} {t.sheetsUnit}</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">{t.ihStageNote}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** ໜຶ່ງສາຍງານ: ຕົວເລກລວມ + ເວລາຕໍ່ຂັ້ນ (ຄໍຂວດຂຶ້ນສີ) */
function Flow({
  title,
  icon,
  kpi,
  overdueLabel,
  t,
}: {
  title: string;
  icon: React.ReactNode;
  kpi: FlowKpi;
  overdueLabel: string;
  t: Dict;
}) {
  // ຂັ້ນທີ່ກິນເວລາຫຼາຍສຸດ = ຄໍຂວດ — ແກ້ຂັ້ນອື່ນໄປກໍ່ບໍ່ຊ່ວຍ
  const worst = kpi.stages.reduce((left, right) => (right.median > left.median ? right : left), kpi.stages[0]);
  const max = Math.max(...kpi.stages.map((stage) => stage.median), 1);

  return (
    <Card title={<span className="inline-flex items-center gap-2">{icon} {title}</span>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={t.opened} value={kpi.opened} />
        <Stat label={t.closed} value={kpi.closed} tone="good" />
        <Stat label={t.openNow} value={kpi.open_now} />
        <Stat label={overdueLabel} value={kpi.overdue} tone={kpi.overdue > 0 ? "bad" : "plain"} />
        <Stat label={t.timePerJob} text={hours(kpi.total.median, t)} note={`${t.slowest10} ${hours(kpi.total.p90, t)}`} />
      </div>

      {/* ເວລາຕໍ່ຂັ້ນ — ອັນຍາວສຸດຄືບ່ອນທີ່ຕ້ອງແກ້ */}
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500">
          {t.stageTimePrefix} <b className="text-red-600">{t.bottleneckLabel}</b>
        </p>
        {kpi.stages.map((stage) => {
          const bottleneck = stage.label === worst?.label && stage.median > 0;
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-slate-600 sm:w-56">{stage.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className={`block h-full rounded-full ${bottleneck ? "bg-red-500" : "bg-teal-500"}`}
                  style={{ width: `${Math.max(2, Math.round((stage.median / max) * 100))}%` }}
                />
              </span>
              <span
                className={`w-24 shrink-0 text-right text-xs tabular-nums sm:w-32 ${
                  bottleneck ? "font-bold text-red-600" : "text-slate-600"
                }`}
              >
                {hours(stage.median, t)}
                <span className="ml-1 text-[10px] font-normal text-slate-400">p90 {hours(stage.p90, t)}</span>
              </span>
            </div>
          );
        })}
        {worst && worst.median > 0 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <TriangleAlert className="size-3.5" />
            {t.bottleneckLabel}: <b>{worst.label}</b> — {hours(worst.median, t)} {t.perJobFromTotal} {hours(kpi.total.median, t)})
          </p>
        )}
      </div>
    </Card>
  );
}

/** ແທ່ງຕໍ່ອາທິດ — ບໍ່ໃຊ້ library ກຣາຟ (ໜ້ານີ້ບໍ່ຄຸ້ມທີ່ຈະເພີ່ມ dependency) */
function Weekly({ title, points, t }: { title: string; points: { week: string; opened: number; closed: number }[]; t: Dict }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.opened, point.closed]));
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-slate-600">
        {title}
        <span className="ml-3 text-[11px] font-normal text-slate-400">
          <span className="mr-1 inline-block size-2 rounded-sm bg-slate-400" /> {t.opened}
          <span className="ml-2 mr-1 inline-block size-2 rounded-sm bg-teal-500" /> {t.closed}
        </span>
      </p>
      <div className="flex h-28 items-end gap-1 overflow-x-auto">
        {points.map((point) => (
          <div key={point.week} className="flex min-w-6 flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end justify-center gap-0.5">
              <span
                title={`${t.opened} ${point.opened}`}
                className="w-1/2 rounded-t bg-slate-300"
                style={{ height: `${Math.round((point.opened / max) * 100)}%` }}
              />
              <span
                title={`${t.closed} ${point.closed}`}
                className="w-1/2 rounded-t bg-teal-500"
                style={{ height: `${Math.round((point.closed / max) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400">{point.week}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  text,
  note,
  tone = "plain",
}: {
  label: string;
  value?: number;
  text?: string;
  note?: string;
  tone?: "good" | "bad" | "plain";
}) {
  const color =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "bad"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{text ?? (value ?? 0).toLocaleString()}</p>
      {note && <p className="text-[10px] opacity-70">{note}</p>}
    </div>
  );
}
