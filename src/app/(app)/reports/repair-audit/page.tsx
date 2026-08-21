import { AuditNoteForm } from "@/components/report/audit-note-form";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { permissionFor } from "@/lib/permissions";
import {
  AUDIT_TAB_LABEL,
  auditSummary,
  fetchRepairAudit,
  filterByTab,
  isAuditTab,
  searchAudit,
  sortAudit,
  type AuditScope,
  type AuditTab,
  type RepairAuditRow,
} from "@/lib/repair-audit";
import {
  AUDIT_FLAG_LABEL,
  CRITICAL_RATIO,
  formatSpan,
  formatTarget,
  isAuditProblem,
  SEVERE_RATIO,
  type Anomaly,
  type AuditFlag,
  type SpanResult,
} from "@/lib/repair-audit-check";
import { REPAIR_SERVICE_TYPES, REPAIR_STAGE_POLICY } from "@/lib/repair-sla";
import { defaultFromIso } from "@/components/report-shell";
import { safeDate } from "@/lib/report-sql";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
  ShieldAlert,
  Timer,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ກວດສອບງານສ້ອມແປງ** — ໄລ່ທຸກໃບຕັ້ງແຕ່ "ຮັບເຄື່ອງ" ຮອດ "ລໍສົ່ງຄືນ/ປິດງານ" ທຽບ KPI.
 *
 * ── ຕ່າງຈາກ /reports/kpi ແນວໃດ ──
 * KPI = **ຄ່າລວມ** ("ຂັ້ນ 6 ທັນ SLA 54%") ⇒ ເບິ່ງແນວໂນ້ມໄດ້ ແຕ່ລົງມືບໍ່ໄດ້.
 * ໜ້ານີ້ = **ລາຍໃບ**: ໃບໃດຊ້າ · ຊ້າຢູ່ຂັ້ນໃດ · ຊ້າກີ່ເທົ່າ · timeline ຜິດຂັ້ນຕອນບໍ ·
 * ດຽວນີ້ໃຜຮັບຜິດຊອບ — ແລະ **ມີບ່ອນໃຫ້ຄົນຊີ້ແຈງ** (ສາເຫດ · ຜູ້ຮັບຜິດຊອບ · ໄຟລ໌ແນບ)
 * ຈຶ່ງກາຍເປັນວົງຮອບການແກ້ໄຂ ບໍ່ແມ່ນພຽງລາຍງານ.
 *
 * ── 2 ແກນ ບໍ່ໃຫ້ປົນກັນ ──
 *   ① **ຊ້າ** (ເກີນ SLA ກີ່ເທົ່າ) ⇒ ໄປໄລ່ວຽກ
 *   ② **timeline ຜິດ** (ເວລາຖອຍຫຼັງ · ຂ້າມຂັ້ນ · ເວລາລ້ຳໜ້າ) ⇒ ໄປແກ້ການບັນທຶກ,
 *      ແລະ ຕົວເລກ KPI ຂອງໃບນັ້ນ **ເຊື່ອບໍ່ໄດ້** ຈົນກວ່າຈະແກ້
 * ກົດເກນທັງໝົດຢູ່ lib/repair-audit-check (ບໍ່ແຕະ DB ⇒ ມີ test ຄຸມ).
 */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    scope?: string;
    svc?: string;
    tab?: string;
    q?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 20;

const FLAG_TONE: Record<AuditFlag, string> = {
  critical: "bg-brand-orange-700 text-white",
  problem: "bg-brand-orange-300 text-brand-900",
  watch: "bg-brand-orange-100 text-brand-orange-700",
  ok: "bg-brand-50 text-brand-800",
};

export default async function RepairAuditPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permission = await permissionFor(session, "/reports/repair-audit");
  if (!permission.read) redirect("/forbidden");

  const params = await searchParams;
  const from = safeDate(params.from, defaultFromIso(90));
  const to = safeDate(params.to);
  const scope: AuditScope = params.scope === "all" ? "all" : "open";
  const service = REPAIR_SERVICE_TYPES.includes(params.svc as never) ? params.svc! : "";
  const tab: AuditTab = isAuditTab(params.tab) ? params.tab : "problem";
  const search = (params.q ?? "").trim();

  const all = await fetchRepairAudit({ from, to, scope, service });
  /**
   * ຄົ້ນຫາກ່ອນສະຫຼຸບ ⇒ **ທຸກຢ່າງໃນຈໍເປັນຊຸດຂໍ້ມູນດຽວກັນ**: ແຖບຕົວເລກ · ຄໍຂວດ · ຕົວເລກຂ້າງແທັບ ·
   * ລາຍການ ແລະ ໄຟລ໌ Excel. ຖ້າສະຫຼຸບຄິດຈາກທຸກແຖວແຕ່ລາຍການກອງແລ້ວ ຄົນຈະທຽບຕົວເລກບໍ່ໄດ້.
   */
  const scoped = searchAudit(all, search);
  const summary = auditSummary(scoped);
  const rows = sortAudit(filterByTab(scoped, tab));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filters = { from, to, scope, ...(service && { svc: service }), ...(search && { q: search }) };
  const href = (extra: Record<string, string>) =>
    `/reports/repair-audit?${new URLSearchParams({ ...filters, tab, ...extra })}`;
  const exportHref = `/api/reports/export/repair-audit?${new URLSearchParams({ ...filters, tab })}`;

  const counts: Record<AuditTab, number> = {
    problem: summary.problem,
    anomaly: summary.anomaly,
    late: summary.late,
    noted: summary.noted,
    all: summary.total,
  };

  return (
    <div className="w-full space-y-4 pb-8">
      {/* ── ຫົວລາຍງານ ── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/reports" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-900">
              <ChevronLeft className="size-3.5" /> ລາຍງານ <LinkPending className="size-3" />
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              <ShieldAlert className="size-5 text-brand-700" /> ກວດສອບງານສ້ອມແປງ
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-500">
              ໄລ່ທຸກໃບ ຂັ້ນ 1 (ຮັບເຄື່ອງ) → ຂັ້ນ 11 (ລໍສົ່ງຄືນ / ປິດງານ) ທຽບ SLA ຂອງແຕ່ລະຂັ້ນ ຕາມປະເພດບໍລິການ.
              ເກີນ <b>{SEVERE_RATIO} ເທົ່າ</b> = ຜິດປົກກະຕິ · ເກີນ <b>{CRITICAL_RATIO} ເທົ່າ</b> = ວິກິດ ·
              timeline ຜິດຂັ້ນຕອນ = ຕົວເລກຂອງໃບນັ້ນເຊື່ອບໍ່ໄດ້.
            </p>
          </div>
          <a
            href={exportHref}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-4 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
          >
            <Download className="size-3.5" /> ດຶງ Excel
          </a>
        </div>
      </div>

      {/* ── ຕົວກອງ (GET ⇒ ແບ່ງ link ໄດ້) ── */}
      <form action="/reports/repair-audit" method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="tab" value={tab} />
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="grid size-7 place-items-center rounded-lg bg-slate-100 text-slate-600">
            <Filter className="size-3.5" />
          </span>
          ຕົວກອງ
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">ຮັບເຄື່ອງ ຈາກວັນທີ</span>
            <input type="date" name="from" defaultValue={from} className="h-10 min-w-40 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs outline-none focus:border-brand-600 focus:bg-white" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">ຫາວັນທີ</span>
            <input type="date" name="to" defaultValue={to} className="h-10 min-w-40 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs outline-none focus:border-brand-600 focus:bg-white" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">ຂອບເຂດງານ</span>
            <select name="scope" defaultValue={scope} className="h-10 min-w-52 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs outline-none focus:border-brand-600 focus:bg-white">
              <option value="open">ງານທີ່ຍັງບໍ່ຈົບ (ທຸກໃບ)</option>
              <option value="all">ລວມງານທີ່ຈົບແລ້ວ ໃນຊ່ວງວັນທີ</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">ປະເພດບໍລິການ</span>
            <select name="svc" defaultValue={service} className="h-10 min-w-32 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs outline-none focus:border-brand-600 focus:bg-white">
              <option value="">ທຸກປະເພດ</option>
              {REPAIR_SERVICE_TYPES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-52 flex-1 flex-col">
            <span className="mb-1 block text-[11px] text-slate-500">ຄົ້ນຫາ</span>
            <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 focus-within:border-brand-600 focus-within:bg-white">
              <Search className="size-3.5 shrink-0 text-slate-400" />
              <input name="q" defaultValue={search} placeholder="ລະຫັດໃບງານ · ເຄື່ອງ · SN · ລູກຄ້າ · ຊ່າງ" className="w-full text-xs outline-none" />
            </span>
          </label>
          <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-900 px-5 text-xs font-semibold text-white hover:bg-brand-800">
            <Search className="size-3.5" /> ຄົ້ນຫາ
          </button>
        </div>
      </form>

      {/* ── ຕົວເລກທີ່ຕ້ອງໄລ່ ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="ງານທີ່ໄລ່ທັງໝົດ" value={summary.total} />
        <Tile label="ຜິດປົກກະຕິ" value={summary.problem} tone="bad" note={`ວິກິດ ${summary.critical}`} />
        <Tile label="timeline ຜິດຂັ້ນຕອນ" value={summary.anomaly} tone="bad" note="ຕົວເລກເຊື່ອບໍ່ໄດ້" />
        <Tile label="ເກີນ SLA (ຢ່າງໜ້ອຍ 1 ຂັ້ນ)" value={summary.late} />
        <Tile
          label="ຜິດປົກກະຕິ ແຕ່ຍັງບໍ່ຊີ້ແຈງ"
          value={summary.unexplained}
          tone={summary.unexplained > 0 ? "bad" : "good"}
          note={`ຊີ້ແຈງແລ້ວ ${summary.noted}`}
        />
      </div>

      {/* ── ຄໍຂວດ: ຂັ້ນໃດເກີນ SLA ຫຼາຍໃບສຸດ ── */}
      {summary.byStage.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <Timer className="size-4 text-brand-700" /> ຂັ້ນທີ່ເກີນ SLA ຫຼາຍໃບສຸດ (ຄໍຂວດ)
          </h2>
          <div className="space-y-1.5">
            {summary.byStage.slice(0, 6).map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="w-52 shrink-0 truncate text-xs text-slate-700">
                  <b>{stage.stage}.</b> {stage.label}
                </span>
                <span className="hidden w-40 shrink-0 truncate text-[11px] text-slate-400 sm:block">{stage.owner}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-brand-orange-400"
                    style={{ width: `${Math.max(2, Math.round((stage.count / summary.byStage[0].count) * 100))}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums text-slate-700">
                  {stage.count} ໃບ
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ແທັບ ── */}
      <div className="flex flex-wrap overflow-hidden rounded-lg border border-slate-300">
        {(Object.keys(AUDIT_TAB_LABEL) as AuditTab[]).map((key) => (
          <Link
            key={key}
            href={href({ tab: key })}
            className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
              tab === key ? "bg-brand-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {AUDIT_TAB_LABEL[key]}
            <span className={`rounded px-1 tabular-nums ${tab === key ? "bg-white/20" : "bg-slate-100"}`}>
              {counts[key]}
            </span>
            <LinkPending className="size-3" />
          </Link>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        {rows.length.toLocaleString()} ໃບ · ໜ້າ {page}/{pages}
        {scope === "open" && " · ກຳລັງເບິ່ງສະເພາະງານທີ່ຍັງບໍ່ຈົບ (ຊ່ວງວັນທີໃຊ້ກັບງານທີ່ຈົບແລ້ວເທົ່ານັ້ນ)"}
      </p>

      {/* ── ລາຍການ ── */}
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
          ບໍ່ພົບງານໃນເງື່ອນໄຂນີ້
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((row) => (
            <JobCard key={row.code} row={row} canEdit={permission.update} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} ຈາກ {rows.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={href({ page: String(page - 1) })}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" /> ກ່ອນ
            </Link>
            <span className="px-3 font-medium text-slate-700">{page} / {pages}</span>
            <Link
              href={href({ page: String(page + 1) })}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ຕໍ່ໄປ <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── ໜຶ່ງໃບງານ */

function JobCard({ row, canEdit }: { row: RepairAuditRow; canEdit: boolean }) {
  const { analysis } = row;
  const problem = isAuditProblem(analysis);

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
        analysis.broken
          ? "border-brand-orange-700"
          : problem
            ? "border-brand-orange-400"
            : "border-slate-200"
      }`}
    >
      {/* ຫົວບັດ */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/service/${encodeURIComponent(row.code)}`}
              className="text-sm font-bold text-brand-800 hover:underline"
            >
              #{row.code}
            </Link>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${FLAG_TONE[analysis.flag]}`}>
              {AUDIT_FLAG_LABEL[analysis.flag]}
            </span>
            {analysis.broken && (
              <span className="inline-flex items-center gap-1 rounded bg-brand-orange-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                <TriangleAlert className="size-3" /> timeline ຜິດຂັ້ນຕອນ
              </span>
            )}
            {row.serviceType && (
              <span
                title={row.serviceLabel}
                className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
              >
                {row.serviceType}
              </span>
            )}
            {row.hold && (
              <span className="rounded bg-brand-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-900">
                ພັກຊົ່ວຄາວ {row.hold.held_days} ມື້ (ນາລິກາຢຸດ)
              </span>
            )}
            {row.cancelled && (
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white">ຍົກເລີກ</span>
            )}
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-slate-800">
            {row.product ?? "-"}
            {row.sn && <span className="ml-2 font-normal text-slate-500">SN {row.sn}</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            ລູກຄ້າ: {row.customer ?? "-"} · ຮັບເຄື່ອງ {row.registeredAt ?? "-"}
            {row.returnedAt ? ` · ສົ່ງຄືນ ${row.returnedAt}` : " · ຍັງບໍ່ຈົບ"}
          </p>
        </div>

        {/* ໃຜຮັບຜິດຊອບຢູ່ສະຖານະປັດຈຸບັນ */}
        <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px]">
          <p className="font-bold text-slate-800">
            ຂັ້ນ {row.stage}. {row.stageLabel}
          </p>
          <p className="mt-0.5 text-slate-600">ຝ່າຍຮັບຜິດຊອບ: <b>{row.ownerDept}</b></p>
          {row.next && (
            <p className="mt-0.5 text-brand-800">
              ຕ້ອງລົງມືຕໍ່: <b>{row.next.actorLabel}</b> — {row.next.action}
            </p>
          )}
          <p className="mt-0.5 text-slate-500">
            ຊ່າງ: {row.tech} · ຮັບເຄື່ອງໂດຍ {row.receivedBy}
          </p>
          <p className="mt-0.5 text-slate-500">
            ລວມທັງງານ: <b className="tabular-nums">{formatSpan(analysis.totalSeconds)}</b>
          </p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {/* ① timeline ຜິດ — ຂຶ້ນກ່ອນ ເພາະມັນທຳລາຍຄວາມເຊື່ອຖືຂອງຕົວເລກຂ້າງລຸ່ມ */}
        {analysis.anomalies.length > 0 && (
          <ul className="space-y-1">
            {analysis.anomalies.map((item, index) => (
              <AnomalyLine key={`${item.kind}-${index}`} item={item} />
            ))}
          </ul>
        )}

        {/* ② ເວລາຕໍ່ຂັ້ນ ທຽບ SLA */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-slate-500">
            ເວລາຕໍ່ຂັ້ນ ທຽບ SLA (ສີສົ້ມ = ເກີນ · ໜາ = ຂັ້ນທີ່ຍັງຄ້າງຢູ່)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.spans.map((span) => (
              <StageChip key={span.stage} span={span} />
            ))}
          </div>
        </div>

        {/* ③ ຄຳຊີ້ແຈງ */}
        <AuditNoteForm
          code={row.code}
          note={row.note}
          defaultDept={row.ownerDept === "-" ? "" : row.ownerDept}
          defaultPerson={row.tech === "-" ? "" : row.tech}
          canEdit={canEdit}
        />
      </div>
    </section>
  );
}

function AnomalyLine({ item }: { item: Anomaly }) {
  const high = item.severity === "high";
  return (
    <li
      className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px] ${
        high ? "bg-brand-orange-50 text-brand-orange-700" : "bg-slate-50 text-slate-600"
      }`}
    >
      {high ? <TriangleAlert className="mt-0.5 size-3 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3 shrink-0" />}
      <span>
        <b>{high ? "ຜິດແທ້" : "ຂໍ້ສັງເກດ"}:</b> {item.detail}
      </span>
    </li>
  );
}

/** ສີຂອງ chip ຂັ້ນ — ເວລາຕິດລົບ (ຈົບກ່ອນເລີ່ມ) ແດງເທົ່າກັບວິກິດ */
function chipTone(span: SpanResult, ratio: number): string {
  if (span.state === "skipped") return "border-slate-300 bg-slate-100 text-slate-500";
  if ((span.seconds ?? 0) < 0 || ratio >= CRITICAL_RATIO) return "border-brand-orange-700 bg-brand-orange-700 text-white";
  if (ratio >= SEVERE_RATIO) return "border-brand-orange-400 bg-brand-orange-100 text-brand-orange-700";
  if (ratio > 1) return "border-brand-orange-300 bg-brand-orange-50 text-brand-900";
  return "border-slate-200 bg-white text-slate-600";
}

/** ໜຶ່ງຂັ້ນ — ໃຊ້ໄປເທົ່າໃດ / SLA ເທົ່າໃດ / ເກີນກີ່ເທົ່າ */
function StageChip({ span }: { span: SpanResult }) {
  const policy = REPAIR_STAGE_POLICY.get(span.stage);
  const ratio = span.ratio ?? 0;
  const tone = chipTone(span, ratio);

  return (
    <span
      title={`${policy?.label ?? ""} · ຜູ້ຮັບຜິດຊອບ: ${policy?.owner ?? "-"} · KPI: ${policy?.kpi ?? "-"}`}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] tabular-nums ${tone} ${
        span.state === "open" ? "font-bold ring-1 ring-brand-700/40" : ""
      }`}
    >
      <span className="font-semibold">{span.stage}.</span>
      <span className="max-w-28 truncate font-normal">{policy?.label ?? "-"}</span>
      {span.state === "skipped" ? (
        <span>ບໍ່ມີບັນທຶກ</span>
      ) : span.state === "pending" ? (
        <span>ຍັງບໍ່ເຖິງ</span>
      ) : (span.seconds ?? 0) < 0 ? (
        // ເວລາຕິດລົບ = ຈົບກ່ອນເລີ່ມ ⇒ ວັດບໍ່ໄດ້. ບອກວ່າຜິດ ດີກວ່າໂຊ້ "-26 ມື້" ໃຫ້ຄົນຄິດເອງ
        <span className="font-bold">ເວລາຜິດລຳດັບ</span>
      ) : (
        <>
          <span>{formatSpan(span.seconds)}</span>
          <span className="opacity-60">/ {formatTarget(span.targetHours)}</span>
          {ratio > 1 && <span className="font-bold">×{ratio >= 100 ? Math.round(ratio) : ratio.toFixed(1)}</span>}
        </>
      )}
      {span.state === "open" && <Wrench className="size-2.5" />}
    </span>
  );
}

function Tile({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: number;
  note?: string;
  tone?: "good" | "bad" | "plain";
}) {
  const color =
    tone === "good"
      ? "border-brand-200 bg-brand-50 text-brand-800"
      : tone === "bad"
        ? "border-brand-orange-400 bg-brand-orange-50 text-brand-orange-700"
        : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${color}`}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      {note && <p className="text-[10px] opacity-70">{note}</p>}
    </div>
  );
}
