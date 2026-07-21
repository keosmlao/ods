"use client";
import { markMissing, restoreMissing } from "@/app/actions/stock-count";
import { useConfirm } from "@/components/confirm-dialog";
import { JobStageModal } from "@/components/stock-count/job-stage-modal";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { StockCountReportRow } from "@/lib/stock-count";
import { Check, Clock, PackageX, RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type T = Dictionary["stockCountReport"];
type Tab = "all" | "counted" | "missing" | "uncounted";

const SERVICE_ORDER = ["CI", "ST", "IH", "PS"];
const stateOf = (r: StockCountReportRow): "counted" | "missing" | "uncounted" =>
  r.counted ? "counted" : r.missing ? "missing" : "uncounted";

/**
 * ຕາຕະລາງລາຍງານກວດນັບ + tab (client, ໄວ — ຂໍ້ມູນໂຫຼດໝົດແລ້ວ):
 * ① tab ສະຖານະ: ທັງໝົດ / ນັບພົບ / ນັບບໍ່ພົບ(ຫາຍ) / ຍັງບໍ່ນັບ
 * ② ຢູ່ tab "ຍັງບໍ່ນັບ" — sub-tab ຕາມ service (CI/ST/IH/PS)
 * ③ ຍັງບໍ່ນັບ → ປຸ່ມ "ປິດ · ນັບບໍ່ພົບ" (confirm) · ນັບບໍ່ພົບ → "ນຳກັບຄືນ" (reversible)
 */
export function StockCountReportTable({ rows, t, initialTab = "uncounted" }: { rows: StockCountReportRow[]; t: T; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [svc, setSvc] = useState<string>("all");
  const [editRow, setEditRow] = useState<StockCountReportRow | null>(null);
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const router = useRouter();

  const counts = useMemo(() => {
    let counted = 0, missing = 0, uncounted = 0;
    for (const r of rows) {
      const s = stateOf(r);
      if (s === "counted") counted++;
      else if (s === "missing") missing++;
      else uncounted++;
    }
    return { counted, missing, uncounted };
  }, [rows]);

  // ແຖວຂອງ tab ສະຖານະປັດຈຸບັນ (ກ່ອນຕອງ service)
  const statusRows = useMemo(() => {
    if (tab === "counted") return rows.filter((r) => stateOf(r) === "counted");
    if (tab === "missing") return rows.filter((r) => stateOf(r) === "missing");
    if (tab === "uncounted") return rows.filter((r) => stateOf(r) === "uncounted");
    return rows;
  }, [rows, tab]);

  // service ທີ່ມີໃນ tab ປັດຈຸບັນ — ຮຽງ CI/ST/IH/PS ກ່ອນ (ໃຊ້ໄດ້ທຸກ tab ບໍ່ພຽງ ຍັງບໍ່ນັບ)
  const svcTabs = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of statusRows) {
      const key = r.service_type ?? "?";
      count.set(key, (count.get(key) ?? 0) + 1);
    }
    return [...count.keys()]
      .sort((a, b) => (SERVICE_ORDER.indexOf(a) + 1 || 99) - (SERVICE_ORDER.indexOf(b) + 1 || 99))
      .map((key) => ({ key, count: count.get(key) ?? 0 }));
  }, [statusRows]);

  const filtered = useMemo(
    () => (svc === "all" ? statusRows : statusRows.filter((r) => (r.service_type ?? "?") === svc)),
    [statusRows, svc],
  );

  // ປ່ຽນ tab ສະຖານະ = ຣີເຊັດຕົວຕອງ service (ບໍ່ດັ່ງນັ້ນ svc ອາດຫາຍ)
  const selectTab = (key: Tab) => { setTab(key); setSvc("all"); };

  // ── dashboard: (ນັບແລ້ວ / ຍັງບໍ່ນັບ / ນັບບໍ່ພົບ) → ບໍລິການ → ຂັ້ນ ──
  const breakdown = useMemo(() => {
    const rowStage = (r: StockCountReportRow) => (r.counted ? r.counted_stage_label ?? r.stage_label : r.stage_label) || "-";
    const groups: { key: string; label: string; tone: string; rows: StockCountReportRow[] }[] = [
      { key: "counted", label: t.tabCounted, tone: "text-emerald-700", rows: rows.filter((r) => stateOf(r) === "counted") },
      { key: "uncounted", label: t.tabUncounted, tone: "text-rose-600", rows: rows.filter((r) => stateOf(r) === "uncounted") },
      { key: "missing", label: t.tabMissing, tone: "text-amber-600", rows: rows.filter((r) => stateOf(r) === "missing") },
    ];
    return groups
      .filter((g) => g.rows.length > 0)
      .map((g) => {
        const svcs = [...new Set(g.rows.map((r) => r.service_type ?? "?"))].sort(
          (a, b) => (SERVICE_ORDER.indexOf(a) + 1 || 99) - (SERVICE_ORDER.indexOf(b) + 1 || 99),
        );
        return {
          ...g,
          total: g.rows.length,
          services: svcs.map((sv) => {
            const srows = g.rows.filter((r) => (r.service_type ?? "?") === sv);
            const svLabel = sv === "?" ? t.svcNone : srows[0]?.service_type_label ?? sv;
            const stages = [...new Set(srows.map(rowStage))];
            return { sv, svLabel, total: srows.length, stages: stages.map((st) => ({ st, n: srows.filter((r) => rowStage(r) === st).length })) };
          }),
        };
      });
  }, [rows, t.tabCounted, t.tabUncounted, t.tabMissing, t.svcNone]);

  const closeAsMissing = (code: string) =>
    void (async () => {
      const ok = await ask({ title: t.confirmCloseTitle, message: t.confirmCloseMsg.replace("{code}", code), confirmLabel: t.confirmCloseBtn, tone: "danger" });
      if (ok) start(async () => { await markMissing(code); router.refresh(); });
    })();

  const bringBack = (code: string) =>
    void (async () => {
      const ok = await ask({ title: t.confirmRestoreTitle, message: t.confirmRestoreMsg.replace("{code}", code), confirmLabel: t.confirmRestoreBtn });
      if (ok) start(async () => { await restoreMissing(code); router.refresh(); });
    })();

  const tabBtn = (key: Tab, label: string, n: number, tone: string) => (
    <button
      type="button"
      onClick={() => selectTab(key)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === key ? `${tone} shadow-sm` : "bg-white text-slate-500 hover:bg-slate-50"}`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${tab === key ? "bg-white/70 text-slate-800" : "bg-slate-100"}`}>{n.toLocaleString()}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      {dialog}
      {editRow && (
        <JobStageModal
          code={editRow.code}
          product={editRow.product}
          serviceType={editRow.service_type}
          currentStage={editRow.stage}
          onClose={() => setEditRow(null)}
        />
      )}

      {/* ── dashboard: (ນັບແລ້ວ / ຍັງບໍ່ນັບ / ນັບບໍ່ພົບ) → ບໍລິການ → ຂັ້ນ (ໜ້າດຽວ) ── */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {breakdown.map((g) => (
          <div key={g.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between border-b border-slate-100 pb-1.5">
              <span className={`text-sm font-bold ${g.tone}`}>{g.label}</span>
              <span className="text-lg font-black tabular-nums text-slate-800">{g.total.toLocaleString()}</span>
            </div>
            <div className="space-y-2.5">
              {g.services.map((s) => (
                <div key={s.sv}>
                  <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-sky-700">
                    <span className="min-w-0 truncate">{s.sv === "?" ? "" : `${s.sv} · `}{s.svLabel}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{s.total}</span>
                  </div>
                  <ul className="mt-0.5 space-y-0.5 border-l border-slate-100 pl-2.5">
                    {s.stages.map((st) => (
                      <li key={st.st} className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="min-w-0 truncate">{st.st}</span>
                        <span className="shrink-0 tabular-nums">{st.n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── tab ສະຖານະ ── */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabBtn("all", t.tabAll, rows.length, "bg-slate-700 text-white")}
        {tabBtn("counted", t.tabCounted, counts.counted, "bg-emerald-600 text-white")}
        {tabBtn("missing", t.tabMissing, counts.missing, "bg-amber-500 text-white")}
        {tabBtn("uncounted", t.tabUncounted, counts.uncounted, "bg-rose-600 text-white")}
      </div>

      {/* ── sub-tab service (ທຸກ tab ສະຖານະ) ── */}
      {svcTabs.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">{t.byService}:</span>
          <button
            type="button"
            onClick={() => setSvc("all")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${svc === "all" ? "bg-sky-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.svcAll} <span className="tabular-nums opacity-80">{statusRows.length}</span>
          </button>
          {svcTabs.map(({ key, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSvc(key)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${svc === key ? "bg-sky-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {key === "?" ? t.svcNone : key} <span className="tabular-nums opacity-80">{count}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">{t.emptyState}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1040px] border-collapse text-[11px] leading-tight">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1.5 font-semibold">{t.colCountState}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colJob}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colProduct}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colBrand}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colCustomer}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colIssue}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colService}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colStage}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colCountedAtBy}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const state = stateOf(row);
                return (
                  <tr
                    key={row.code}
                    className={`border-b border-slate-100 ${state === "uncounted" ? "bg-rose-50/40" : state === "missing" ? "bg-amber-50/50" : ""}`}
                  >
                    <td className="whitespace-nowrap px-2 py-1">
                      {state === "counted" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <Check className="size-3" /> {t.stateCounted}
                        </span>
                      ) : state === "missing" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <PackageX className="size-3" /> {t.stateMissing}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                          <Clock className="size-3" /> {t.stateNotCounted}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 font-bold text-[#0536a9]">{row.code}</td>
                    <td className="max-w-72 px-2 py-1">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>{row.product || "-"}</span>
                      <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">{row.brand || "-"}</td>
                    <td className="max-w-48 truncate px-2 py-1" title={row.customer ?? ""}>{row.customer || "-"}</td>
                    <td className="max-w-56 truncate px-2 py-1 text-slate-600" title={row.issue ?? ""}>{row.issue || "-"}</td>
                    <td className="whitespace-nowrap px-2 py-1">
                      {row.service_type ? <b className="text-sky-700">{row.service_type}</b> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{row.stage_label}</span>
                        {row.counted && row.counted_stage_label && row.counted_stage_label !== row.stage_label && (
                          <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700" title={t.countedStageTooltip}>{row.counted_stage_label}</span>
                        )}
                        {row.returned && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700" title={t.returnedTooltip}>
                            <TriangleAlert className="size-2.5" /> {t.returnedBadge}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                      {state === "uncounted" ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Check className="size-3 text-emerald-600" />
                          {row.counted_at || "-"}
                          {row.counted_by && <span className="text-slate-400">· {row.counted_by}</span>}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditRow(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <SlidersHorizontal className="size-3" /> ປັບປຸງ
                        </button>
                        {state === "uncounted" && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => closeAsMissing(row.code)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <PackageX className="size-3" /> {t.closeMissing}
                          </button>
                        )}
                        {state === "missing" && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => bringBack(row.code)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RotateCcw className="size-3" /> {t.restoreBack}
                          </button>
                        )}
                        <a
                          href={`/service/${row.code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {t.manageJob}
                        </a>
                        <a
                          href={`/service/${row.code}/label`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                        >
                          {t.printSticker}
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
