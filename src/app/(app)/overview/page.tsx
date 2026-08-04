import { DashboardAutoRefresh } from "@/components/dashboard-auto-refresh";
import { LinkPending } from "@/components/link-pending";
import { RowLink } from "@/components/row-link";
import { getSession } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getManagerOverview, monthRevenue } from "@/lib/manager-overview";
import { roleOf } from "@/lib/roles";
import { STAGE_LABEL } from "@/lib/stage";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  ClipboardCheck,
  Frown,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Timer,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * ── ໜ້າແລກຂອງ **ຜູ້ຈັດການ** ──
 *
 * ອອກແບບຮອບຄຳຖາມ 2 ຂໍ້ ຕາມລຳດັບ (ຕົກລົງກັບຜູ້ໃຊ້ 31-07-2026):
 *   ① ເທິງ = **ວຽກຄ້າງທີ່ຕ້ອງລົງມື** — ເປີດແອັບຕອນເຊົ້າແລ້ວຮູ້ທັນທີວ່າຕ້ອງໄປແກ້ຫຍັງ
 *   ② ລຸ່ມ = **ຜົນງານ (KPI)** — ເດືອນນີ້ໄປໄດ້ດີບໍ
 *
 * ── ຄວາມຕ່າງຈາກ /dashboard ──
 * /dashboard ສະແດງ**ທຸກຄິວຂອງທຸກສາຍງານ** ໃຫ້ທຸກ role ⇒ ຜູ້ຈັດການຕ້ອງກວາດຕາຫາເອົາເອງ
 * ວ່າອັນໃດຜິດປົກກະຕິ. ຜູ້ຈັດການບໍ່ໄດ້ລົງມືເຮັດຄິວເຫຼົ່ານັ້ນ — ລາວ **ຕັດສິນ** ແລະ
 * **ຕາມງານທີ່ຄ້າງຜິດປົກກະຕິ** ⇒ ໜ້ານີ້ຄັດມາສະເພາະສິ່ງທີ່ຕ້ອງການການຕັດສິນ
 * ບວກ **ອາຍຸຂອງກອງວຽກ** ເຊິ່ງເປັນສິ່ງທີ່ /dashboard ບໍ່ເຄີຍບອກ.
 *
 * ບັດທີ່ເປັນ 0 **ບໍ່ສະແດງ** — ໜ້າຫວ່າງ = ບໍ່ມີຫຍັງຄ້າງ ເປັນຄຳຕອບທີ່ຖືກຕ້ອງ
 * ແລະ ດີກວ່າຕາຕະລາງເລກສູນທີ່ຄົນຕ້ອງອ່ານທຸກມື້ຈົນເຊົາເບິ່ງ.
 */
export const dynamic = "force-dynamic";

type Tone = "red" | "amber" | "violet";

const TONE: Record<Tone, { card: string; icon: string; value: string }> = {
  red: { card: "border-brand-orange-400 hover:border-brand-orange-600", icon: "bg-brand-orange-50 text-brand-orange-700", value: "text-brand-orange-700" },
  amber: { card: "border-brand-orange-400 hover:border-brand-orange-500", icon: "bg-brand-orange-100 text-brand-900", value: "text-brand-900" },
  violet: { card: "border-brand-orange-200 hover:border-brand-orange-400", icon: "bg-brand-orange-50 text-brand-orange-700", value: "text-brand-orange-700" },
};

type Action = {
  label: string;
  value: number;
  detail?: string;
  href: string;
  icon: typeof Timer;
  tone: Tone;
};

/** ຈຳນວນເງິນ — ບາດ (ເບິ່ງໝາຍເຫດສະກຸນເງິນຢູ່ lib/service-money) */
const money = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });

export default async function ManagerOverview() {
  const session = await getSession();
  const role = roleOf(session!);
  /* ໜ້ານີ້ຄິດມາເພື່ອຜູ້ຈັດການ — ຄົນອື່ນສົ່ງກັບໄປໜ້າລວມທົ່ວໄປ (ບໍ່ແມ່ນ /forbidden: ບໍ່ແມ່ນຄວາມລັບ) */
  if (role !== "manager") redirect("/dashboard");

  const t = (await getDictionary(await getLocale())).overview;

  const [{ data }, mgr, month] = await Promise.all([
    getDashboard(null, 30),
    getManagerOverview(30),
    monthRevenue(),
  ]);

  const stale = mgr.aging.find((bucket) => bucket.key === "over30")?.n ?? 0;

  /* ── ① ຕ້ອງລົງມື — ບັດ 0 ຖືກກອງອອກ ── */
  const actions: Action[] = ([
    { label: t.actApprovals, value: data?.approvals.quotes ?? 0, href: "/approvals/quotations", icon: ClipboardCheck, tone: "red" },
    { label: t.actCancels, value: data?.cancelRequests ?? 0, href: "/approvals/cancellations", icon: Ban, tone: "red" },
    { label: t.actPurchases, value: data?.approvals.purchases ?? 0, href: "/purchase-requests", icon: ShoppingCart, tone: "amber" },
    { label: t.actUnassigned, value: (data?.unassigned.repair ?? 0) + (data?.unassigned.install ?? 0), href: "/repair/assign", icon: UserPlus, tone: "red" },
    { label: t.actSlaLate, value: data?.sla.late ?? 0, href: "/reports/pending", icon: Timer, tone: "red" },
    { label: t.actOverdueAppointments, value: data?.overdueAppointments ?? 0, href: "/installations", icon: CalendarClock, tone: "amber" },
    { label: t.actClaimDecision, value: mgr.claims.waitDecision, href: "/claims/jobs/claim-decision", icon: ShieldCheck, tone: "violet" },
    { label: t.actLoaners, value: mgr.loaners, href: "/service/loaners", icon: PackageCheck, tone: "amber" },
    { label: t.actUnhappy, value: data?.feedback.unhappy_jobs ?? 0, href: "/reports/customer-feedback", icon: Frown, tone: "amber" },
  ] as Action[]).filter((action) => action.value > 0);

  const flowDelta = mgr.flow.closed - mgr.flow.opened;

  /** ຄະແນນຄວາມພໍໃຈ **ຕໍ່າ = ດີ** — ກົດດຽວກັບ scoreTone ຂອງ /dashboard */
  const score = data?.feedback.avg_points ?? 0;
  const feedbackTone = score >= 2.5 ? "text-brand-orange-700" : score >= 1.5 ? "text-brand-900" : "text-brand-800";

  return (
    <div className="w-full space-y-6">
      <DashboardAutoRefresh />

      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t.subtitle}</p>
      </div>

      {/* ── ພາດຫົວ: ອາຍຸຂອງກອງວຽກ — ຕົວເລກດຽວທີ່ບອກສຸຂະພາບຂອງສູນໄດ້ດີສຸດ ── */}
      <section className={`rounded-2xl border p-5 shadow-sm ${stale > 0 ? "border-brand-orange-400 bg-brand-orange-50/50" : "border-brand-200 bg-brand-50/50"}`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
              {stale > 0 && <AlertTriangle className="size-4 text-brand-orange-700" />}
              {t.staleTitle}
            </p>
            <p className="mt-1">
              <span className={`text-4xl font-black ${stale > 0 ? "text-brand-orange-700" : "text-brand-800"}`}>{stale}</span>
              <span className="ml-2 text-sm text-slate-500">
                {t.staleOf} {mgr.openTotal} {t.jobsUnit}
              </span>
            </p>
          </div>
          <Link
            href="/reports/pending"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-800 px-4 text-xs font-semibold text-white hover:bg-brand-900"
          >
            {t.seeAllPending}
            <ArrowRight className="size-3.5" />
            <LinkPending className="size-3" />
          </Link>
        </div>

        {/* ແຖບອາຍຸ — 4 ຖັງບໍ່ຫຼົ້ນກັນ ລວມ = ງານເປີດທັງໝົດ */}
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white">
          {mgr.aging.map((bucket) => (
            <div
              key={bucket.key}
              style={{ width: `${mgr.openTotal ? (bucket.n / mgr.openTotal) * 100 : 0}%` }}
              className={
                bucket.key === "over30" ? "bg-brand-orange-700"
                : bucket.key === "d30" ? "bg-brand-orange-300"
                : bucket.key === "d14" ? "bg-brand-orange-300"
                : "bg-brand-400"
              }
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          {mgr.aging.map((bucket) => (
            <span key={bucket.key}>
              <b className="text-slate-800">{bucket.n}</b> · {t.age[bucket.key]}
            </span>
          ))}
        </div>
      </section>

      {/* ── ສະຫຼຸບແຍກຕາມສາຍງານ — ຕົວເລກລວມເຊື່ອງໄວ້ວ່າສາຍໃດເປັນຕົ້ນເຫດ ── */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">{t.workflowsTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mgr.workflows.map((flow) => (
            <Link
              key={flow.key}
              href={flow.href}
              className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                flow.stale > 0 ? "border-brand-orange-400 hover:border-brand-orange-600" : "border-slate-200 hover:border-brand-300"
              }`}
            >
              <p className="text-xs font-bold text-slate-500">{flow.label}</p>
              <p className="mt-1">
                <span className="text-2xl font-black text-slate-800">{flow.open}</span>
                <span className="ml-1 text-[11px] text-slate-400">{t.jobsUnit}</span>
              </p>
              {/* ແຖບ: ແດງ = ຄ້າງເກີນ 30 ມື້ · ຂຽວ = ຍັງຢູ່ໃນເກນ */}
              <span className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span style={{ width: `${flow.open ? (flow.stale / flow.open) * 100 : 0}%` }} className="bg-brand-orange-700" />
                <span style={{ width: `${flow.open ? ((flow.open - flow.stale) / flow.open) * 100 : 0}%` }} className="bg-brand-400" />
              </span>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {flow.stale > 0 ? (
                  <span className="font-semibold text-brand-orange-700">
                    {flow.stale} {t.workflowStale}
                  </span>
                ) : (
                  <span className="text-brand-800">{t.workflowClean}</span>
                )}
                {flow.oldest_days > 0 && (
                  <span className="ml-2 text-slate-400">
                    · {t.workflowOldest} {flow.oldest_days}{t.daysUnit}
                  </span>
                )}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── ① ບັດຕ້ອງລົງມື ── */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-700">{t.actionsTitle}</h2>
        {actions.length === 0 ? (
          <p className="rounded-xl border border-brand-200 bg-brand-50/50 p-5 text-center text-sm font-semibold text-brand-800">
            {t.actionsEmpty}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {actions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition ${TONE[action.tone].card}`}
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${TONE[action.tone].icon}`}>
                  <action.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-2xl font-black leading-none ${TONE[action.tone].value}`}>{action.value}</span>
                  <span className="mt-1 block truncate text-xs text-slate-600">{action.label}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── ໃບເກົ່າສຸດ — ຊື່ຄົນ ແລະ ເລກໃບ ບໍ່ແມ່ນຕົວເລກລວມ ⇒ ຕາມໄດ້ທັນທີ ── */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">{t.oldestTitle}</h2>
        {mgr.oldest.length === 0 ? (
          <p className="p-5 text-center text-xs text-slate-400">{t.oldestEmpty}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mgr.oldest.map((job) => (
              <li key={job.code}>
                <RowLink href={`/service/${job.code}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <span className="w-14 shrink-0 text-right">
                    <span className={`text-lg font-black ${job.days > 30 ? "text-brand-orange-700" : "text-slate-700"}`}>{job.days}</span>
                    <span className="ml-0.5 text-[10px] text-slate-400">{t.daysUnit}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-700">
                      #{job.code} · {job.product}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {job.cust_name ?? "-"}
                      <span className="ml-2 text-slate-400">
                        {STAGE_LABEL[job.stage] ?? job.stage}
                        {job.tech ? ` · ${job.tech}` : ` · ${t.noTech}`}
                      </span>
                    </span>
                  </span>
                </RowLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── ② KPI ── */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-slate-700">{t.kpiTitle}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ເງິນ */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Wallet className="size-4 text-brand-700" />
              {t.moneyTitle}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-800">{money(month.quoted)}</p>
            <p className="text-[11px] text-slate-400">{t.moneyQuoted}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-brand-50 p-2">
                <dt className="text-[11px] text-brand-800">{t.moneyPaid}</dt>
                <dd className="font-bold text-brand-800">{money(month.paid)}</dd>
              </div>
              <div className="rounded-lg bg-brand-orange-100 p-2">
                <dt className="text-[11px] text-brand-900">{t.moneyDue}</dt>
                <dd className="font-bold text-brand-900">{money(month.due)}</dd>
              </div>
            </dl>
            <Link href="/reports/service-revenue" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline">
              {t.moreReport}
              <ArrowRight className="size-3" />
            </Link>
          </section>

          {/* ໄຫຼເຂົ້າ / ໄຫຼອອກ */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
              {flowDelta >= 0 ? <TrendingUp className="size-4 text-brand-800" /> : <TrendingDown className="size-4 text-brand-orange-700" />}
              {t.flowTitle}
            </p>
            <p className="mt-2">
              <span className={`text-2xl font-black ${flowDelta >= 0 ? "text-brand-800" : "text-brand-orange-700"}`}>
                {flowDelta > 0 ? "+" : ""}
                {flowDelta}
              </span>
              <span className="ml-2 text-[11px] text-slate-400">{flowDelta >= 0 ? t.flowGood : t.flowBad}</span>
            </p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">{t.flowOpened}</dt>
                <dd className="font-bold text-slate-700">{mgr.flow.opened}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">{t.flowClosed}</dt>
                <dd className="font-bold text-slate-700">{mgr.flow.closed}</dd>
              </div>
            </dl>
            <Link href="/reports/kpi" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline">
              {t.moreReport}
              <ArrowRight className="size-3" />
            </Link>
          </section>

          {/* ຄວາມພໍໃຈລູກຄ້າ */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <ClipboardCheck className="size-4 text-brand-orange-600" />
              {t.feedbackTitle}
            </p>
            {/*
              ⚠️ ຄະແນນນີ້ **ຕໍ່າ = ດີ** (cust_complain.points 1=ດີຫຼາຍ … 4=ບໍ່ພໍໃຈ)
              ⇒ ຫ້າມສະແດງເປັນ "x / 5" ຄືດາວ ບໍ່ດັ່ງນັ້ນ 1.3 ຈະຖືກອ່ານວ່າ "ແຍ່ຫຼາຍ"
              ທັງທີ່ຄວາມຈິງແມ່ນດີ. ໃຊ້ສີດຽວກັບ scoreTone ຂອງ /dashboard.
            */}
            <p className="mt-2">
              <span className={`text-2xl font-black ${feedbackTone}`}>
                {data?.feedback.avg_points != null ? data.feedback.avg_points.toFixed(2) : "—"}
              </span>
              <span className="ml-1 text-[11px] text-slate-400">{t.feedbackScale}</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {data?.feedback.jobs ?? 0} {t.feedbackJobs}
              {(data?.feedback.unhappy_jobs ?? 0) > 0 && (
                <span className="ml-2 font-semibold text-brand-orange-700">
                  · {data?.feedback.unhappy_jobs} {t.feedbackUnhappy}
                </span>
              )}
            </p>
            <Link href="/reports/customer-feedback" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline">
              {t.moreReport}
              <ArrowRight className="size-3" />
            </Link>
          </section>
        </div>
      </div>

      {/* ── ກອງວຽກຂອງແຕ່ລະຊ່າງ — ລຽງດ້ວຍ "ຄ້າງເກີນ 30 ມື້" ບໍ່ແມ່ນ "ຈຳນວນວຽກ" ── */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">{t.techTitle}</h2>
        {mgr.techBacklog.length === 0 ? (
          <p className="p-5 text-center text-xs text-slate-400">{t.techEmpty}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mgr.techBacklog.map((tech) => (
              <li key={tech.tech} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-28 shrink-0 truncate text-sm font-semibold text-slate-700">{tech.tech}</span>
                <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    style={{ width: `${tech.open ? (tech.stale / tech.open) * 100 : 0}%` }}
                    className="bg-brand-orange-700"
                  />
                  <span
                    style={{ width: `${tech.open ? ((tech.open - tech.stale) / tech.open) * 100 : 0}%` }}
                    className="bg-brand-400"
                  />
                </span>
                <span className="w-40 shrink-0 text-right text-xs text-slate-500">
                  <b className="text-slate-700">{tech.open}</b> {t.jobsUnit}
                  {tech.stale > 0 && <span className="ml-2 font-semibold text-brand-orange-700">{tech.stale} {t.techStale}</span>}
                  <span className="ml-2 text-slate-400">· {tech.oldest_days}{t.daysUnit}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
