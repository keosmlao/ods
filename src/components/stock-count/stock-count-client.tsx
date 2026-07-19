"use client";
import { finalizeStockCount } from "@/app/actions/stock-count";
import { useConfirm } from "@/components/confirm-dialog";
import { Elapsed } from "@/components/elapsed";
import { MobileCardList } from "@/components/mobile-card-list";
import { elapsedTone } from "@/lib/elapsed-tone";
import { useDict } from "@/lib/i18n/context";
import type { StockCountJob } from "@/lib/stock-count";
import { Check, CircleAlert, ScanLine } from "lucide-react";
import { useRef, useState, useTransition } from "react";

export function StockCountClient({ jobs }: { jobs: StockCountJob[] }) {
  const t = useDict().stockCount;
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ code: string; ok: boolean } | null>(null);
  const [result, setResult] = useState<{ held: number; missing: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const { ask, dialog } = useConfirm();

  const inputRef = useRef<HTMLInputElement>(null);
  // ຍິງໄດ້ທັງ **ເລກງານ** (barcode ຂອງເຮົາ) ຫຼື **SN** (ປ້າຍໂຮງງານ) → ໝາຍງານດຽວກັນ
  const lookup = useRef(
    new Map<string, string>(
      jobs.flatMap((job) =>
        job.sn?.trim() ? [[job.code, job.code], [job.sn.trim(), job.code]] : [[job.code, job.code]],
      ),
    ),
  );

  const total = jobs.length;
  const found = scanned.size;
  const pct = total > 0 ? Math.round((found / total) * 100) : 0;

  // ── ກອງຕາມປະເພດບໍລິການ (CI/ST/PS — IH ຖືກຂ້າມແລ້ວ) ──
  const [type, setType] = useState<string>("all");
  const typeCounts = new Map<string, { total: number; found: number }>();
  for (const j of jobs) {
    const key = j.service_type || "-";
    const cur = typeCounts.get(key) ?? { total: 0, found: 0 };
    cur.total += 1;
    if (scanned.has(j.code)) cur.found += 1;
    typeCounts.set(key, cur);
  }
  const typeList = ["CI", "ST", "PS"].filter((code) => typeCounts.has(code));
  const typeLabel = (code: string) =>
    jobs.find((j) => j.service_type === code)?.service_type_label ?? code;
  const shownJobs = type === "all" ? jobs : jobs.filter((j) => (j.service_type || "-") === type);

  // ── ສະແກນ (keyboard-wedge: ພິມ code/SN + Enter) ──
  const onScan = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const code = lookup.current.get(value); // ຈັບໄດ້ທັງເລກງານ ຫຼື SN
    if (code) {
      setScanned((prev) => (prev.has(code) ? prev : new Set(prev).add(code)));
      setFlash({ code, ok: true });
    } else {
      setFlash({ code: value, ok: false });
    }
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  const finalize = async () => {
    const notScanned = total - found;
    const ok = await ask({
      title: t.finalizeTitle,
      message: `${t.scanFound} ${found}/${total} ${t.itemsUnit}. ${t.itemsNotFound} ${notScanned} ${t.itemsUnit} ${t.willBeMarked} “ຕ້ອງກວດວ່າຍັງຢູ່” ${t.autoStopClock}`,
      confirmLabel: `${t.markWord} ຕ້ອງກວດ`,
      tone: notScanned > 0 ? "danger" : undefined,
    });
    if (!ok) return;
    setError(null);
    startBusy(async () => {
      const res = await finalizeStockCount(Array.from(scanned));
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult({ held: res.held ?? 0, missing: res.missing ?? 0 });
    });
  };

  return (
    <div className="w-full space-y-4">
      {dialog}

      {/* ── ແຖບສະແກນ + ຄວາມຄືບໜ້າ (ຕິດເທິງເມື່ອເລື່ອນ) ── */}
      <div className="sticky top-0 z-[5] space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onScan(inputRef.current?.value ?? "");
          }}
          className="flex items-center gap-2"
        >
          <ScanLine className="size-5 shrink-0 text-teal-600" />
          <input
            ref={inputRef}
            autoFocus
            inputMode="text"
            placeholder={t.scanPlaceholder}
            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-base focus:border-teal-500 focus:outline-none"
          />
          <button type="submit" className="h-11 shrink-0 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700">
            {t.count}
          </button>
        </form>

        {flash && (
          <p className={`flex items-center gap-1.5 text-xs font-semibold ${flash.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {flash.ok ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
            {flash.ok ? `${t.foundWord} ${flash.code} — ${t.countedWord}` : `${flash.code} ${t.notInCountList}`}
          </p>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              {t.scanFound} {found.toLocaleString()} / {total.toLocaleString()}
            </span>
            <span className="text-slate-400">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={finalize}
          className="h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? t.marking : `${t.finishCountMark} ${(total - found).toLocaleString()} ${t.itemsNotFoundAs} ‘ຕ້ອງກວດ’`}
        </button>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        {result && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            {t.doneMark} “ຕ້ອງກວດ” {result.held.toLocaleString()} {t.itemsUnit} ({t.notFoundWord} {result.missing.toLocaleString()}). {t.jobsMovedTo} ‘ຕ້ອງກວດ’.
          </p>
        )}
      </div>

      {/* ── ຕົວກອງປະເພດບໍລິການ (ພົບ/ທັງໝົດ ຕໍ່ປະເພດ) ── */}
      {typeList.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { code: "all", label: t.all, t: total, f: found },
            ...typeList.map((code) => ({
              code,
              label: `${code} · ${typeLabel(code)}`,
              t: typeCounts.get(code)?.total ?? 0,
              f: typeCounts.get(code)?.found ?? 0,
            })),
          ].map((chip) => (
            <button
              key={chip.code}
              type="button"
              onClick={() => setType(chip.code)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                type === chip.code
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {chip.label}
              <span className={`tabular-nums ${type === chip.code ? "opacity-80" : "text-slate-400"}`}>
                {chip.f}/{chip.t}
              </span>
            </button>
          ))}
        </div>
      )}

      {total === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">{t.emptyMsg}</p>
      ) : (
        <>
          {/* ── Desktop = ຕາຕະລາງ ── */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="w-20 px-3 py-3 text-center font-semibold">{t.count}</th>
                  <th className="px-3 py-3 font-semibold">{t.colNo}</th>
                  <th className="px-3 py-3 font-semibold">{t.colProductSn}</th>
                  <th className="px-3 py-3 font-semibold">{t.colBrand}</th>
                  <th className="px-3 py-3 font-semibold">{t.colCustomer}</th>
                  <th className="px-3 py-3 font-semibold">{t.colStage}</th>
                  <th className="px-3 py-3 font-semibold">{t.colServiceType}</th>
                  <th className="px-3 py-3 font-semibold">{t.colElapsed}</th>
                </tr>
              </thead>
              <tbody>
                {shownJobs.map((job) => {
                  const isFound = scanned.has(job.code);
                  const tone = elapsedTone(job.elapsed_seconds);
                  return (
                    <tr key={job.code} className={`border-b border-slate-100 ${isFound ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                      <td className="px-3 py-2.5 text-center">
                        {isFound ? (
                          <Check className="mx-auto size-4 text-emerald-600" />
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{job.code}</td>
                      <td className="max-w-72 px-3 py-2.5">
                        <span className="block truncate font-medium text-slate-800" title={job.product ?? ""}>{job.product || "-"}</span>
                        <span className="block truncate text-[10px] text-slate-400">{job.sn || "-"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{job.brand || "-"}</td>
                      <td className="max-w-48 truncate px-3 py-2.5" title={job.customer ?? ""}>{job.customer || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{job.stage_label}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {job.service_type ? (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            <b>{job.service_type}</b>
                            <span className="font-medium text-sky-600">{job.service_type_label}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Elapsed seconds={job.elapsed_seconds} className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile = card + ໂຫຼດເພີ່ມ (10 · +3 · 2ວິ) ── */}
          <div className="md:hidden">
            <MobileCardList className="grid grid-cols-1 gap-3">
              {shownJobs.map((job) => {
                const isFound = scanned.has(job.code);
                const tone = elapsedTone(job.elapsed_seconds);
                return (
                  <div
                    key={job.code}
                    className={`rounded-2xl border p-3.5 shadow-sm transition ${isFound ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-lg font-bold text-[#0536a9]">{job.code}</span>
                      {isFound ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          <Check className="size-3" />
                          {t.foundBadge}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{job.stage_label}</span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium text-slate-800" title={job.product ?? ""}>{job.product || "-"}</p>
                    <p className="truncate text-xs text-slate-400">{[job.brand, job.sn].filter(Boolean).join(" · ") || "-"}</p>
                    {job.service_type && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                        <b>{job.service_type}</b> {job.service_type_label}
                      </span>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <span className="truncate text-xs text-slate-500" title={job.customer ?? ""}>{job.customer || "-"}</span>
                      <Elapsed seconds={job.elapsed_seconds} className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`} />
                    </div>
                  </div>
                );
              })}
            </MobileCardList>
          </div>
        </>
      )}
    </div>
  );
}
