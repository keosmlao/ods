"use client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { StockCountReportRow } from "@/lib/stock-count";
import { Check, Clock, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

type T = Dictionary["stockCountReport"];
type Tab = "all" | "counted" | "uncounted";

const SERVICE_ORDER = ["CI", "ST", "IH", "PS"];

/**
 * ຕາຕະລາງລາຍງານກວດນັບ + tab (client, ໄວ — ຂໍ້ມູນໂຫຼດໝົດແລ້ວ):
 * ① tab ສະຖານະ: ທັງໝົດ / ນັບແລ້ວ / ຍັງບໍ່ນັບ
 * ② ຢູ່ tab "ຍັງບໍ່ນັບ" — ແຍກ sub-tab ຕາມ service (CI/ST/IH/PS) ອີກຮອບ.
 */
export function StockCountReportTable({ rows, t }: { rows: StockCountReportRow[]; t: T }) {
  const [tab, setTab] = useState<Tab>("uncounted");
  const [svc, setSvc] = useState<string>("all");

  const uncounted = useMemo(() => rows.filter((r) => !r.counted), [rows]);
  const countedN = rows.length - uncounted.length;

  // service ທີ່ມີໃນ "ຍັງບໍ່ນັບ" — ຮຽງ CI/ST/IH/PS ກ່ອນ, ຕົວອື່ນຕໍ່ທ້າຍ
  const svcTabs = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of uncounted) {
      const key = r.service_type ?? "?";
      count.set(key, (count.get(key) ?? 0) + 1);
    }
    const keys = [...count.keys()].sort(
      (a, b) => (SERVICE_ORDER.indexOf(a) + 1 || 99) - (SERVICE_ORDER.indexOf(b) + 1 || 99),
    );
    return keys.map((key) => ({ key, count: count.get(key) ?? 0 }));
  }, [uncounted]);

  const filtered = useMemo(() => {
    if (tab === "counted") return rows.filter((r) => r.counted);
    if (tab === "uncounted") return svc === "all" ? uncounted : uncounted.filter((r) => (r.service_type ?? "?") === svc);
    return rows;
  }, [rows, uncounted, tab, svc]);

  const tabBtn = (key: Tab, label: string, n: number, tone: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        tab === key ? `${tone} shadow-sm` : "bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${tab === key ? "bg-white/70" : "bg-slate-100"}`}>{n.toLocaleString()}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      {/* ── tab ສະຖານະ ── */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabBtn("all", t.tabAll, rows.length, "bg-slate-700 text-white")}
        {tabBtn("counted", t.tabCounted, countedN, "bg-emerald-600 text-white")}
        {tabBtn("uncounted", t.tabUncounted, uncounted.length, "bg-rose-600 text-white")}
      </div>

      {/* ── sub-tab service (ສະເພາະ tab ຍັງບໍ່ນັບ) ── */}
      {tab === "uncounted" && svcTabs.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">{t.byService}:</span>
          <button
            type="button"
            onClick={() => setSvc("all")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${svc === "all" ? "bg-sky-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.svcAll} <span className="tabular-nums opacity-80">{uncounted.length}</span>
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
          <table className="w-full min-w-[980px] border-collapse text-[11px] leading-tight">
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
                <th className="px-2 py-1.5 font-semibold">{t.colLabel}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.code}
                  className={`border-b border-slate-100 ${!row.counted ? "bg-rose-50/40" : row.returned ? "bg-amber-50/50" : ""}`}
                >
                  <td className="whitespace-nowrap px-2 py-1">
                    {row.counted ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Check className="size-3" /> {t.stateCounted}
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
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700" title={t.countedStageTooltip}>
                          {row.counted_stage_label}
                        </span>
                      )}
                      {row.returned && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700" title={t.returnedTooltip}>
                          <TriangleAlert className="size-2.5" /> {t.returnedBadge}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                    {row.counted ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-3 text-emerald-600" />
                        {row.counted_at || "-"}
                        {row.counted_by && <span className="text-slate-400">· {row.counted_by}</span>}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    <a
                      href={`/service/${row.code}/label`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                    >
                      {t.printSticker}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
