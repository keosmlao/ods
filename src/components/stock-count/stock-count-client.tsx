"use client";
import { finalizeStockCount } from "@/app/actions/stock-count";
import { useConfirm } from "@/components/confirm-dialog";
import { Elapsed } from "@/components/elapsed";
import { MobileCardList } from "@/components/mobile-card-list";
import { elapsedTone } from "@/lib/elapsed-tone";
import { useDict } from "@/lib/i18n/context";
import type { StockCountJob } from "@/lib/stock-count";
import { Check, CircleAlert, RotateCcw, ScanLine } from "lucide-react";
import { useRef, useState, useTransition } from "react";

export function StockCountClient({ jobs }: { jobs: StockCountJob[] }) {
  const t = useDict().stockCount;
  const [scanned, setScanned] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ code: string; ok: boolean; dupe?: boolean } | null>(null);
  const [result, setResult] = useState<{ held: number; missing: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const { ask, dialog } = useConfirm();

  const inputRef = useRef<HTMLInputElement>(null);
  // ຍິງໄດ້ທັງ **ເລກງານ** (barcode ຂອງເຮົາ) ຫຼື **SN** (ປ້າຍໂຮງງານ) → ໝາຍງານດຽວກັນ.
  // key ເປັນ UPPERCASE — SN ໂຮງງານມີທັງຕົວນ້ອຍ/ໃຫຍ່ ⇒ ຈັບຄູ່ບໍ່ສົນໃຈຂະໜາດຕົວອັກສອນ.
  const lookup = useRef(
    new Map<string, string>(
      jobs.flatMap((job) => {
        const entries: [string, string][] = [[job.code.trim().toUpperCase(), job.code]];
        if (job.sn?.trim()) entries.push([job.sn.trim().toUpperCase(), job.code]);
        return entries;
      }),
    ),
  );

  const total = jobs.length;
  const found = scanned.size;
  const pct = total > 0 ? Math.round((found / total) * 100) : 0;

  // Pending ທັງໝົດ — ບໍ່ແຍກ service type (ສະແດງທຸກອັນ)
  const shownJobs = jobs;

  // ── ສະແກນ (keyboard-wedge: ພິມ code/SN + Enter) ──
  const onScan = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const code = lookup.current.get(value.toUpperCase()); // ຈັບໄດ້ທັງເລກງານ ຫຼື SN (ບໍ່ສົນຂະໜາດຕົວ)
    if (code) {
      // ຍິງຊ້ຳຕົວທີ່ນັບແລ້ວ ⇒ ບອກວ່າ "ນັບໄປແລ້ວ" (ບໍ່ນັບຊ້ຳ)
      const dupe = scanned.has(code);
      if (!dupe) setScanned((prev) => new Set(prev).add(code));
      setFlash({ code, ok: true, dupe });
    } else {
      setFlash({ code: value, ok: false });
    }
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  // ── ກົດ (tap) ແຖວ/card ເພື່ອ ໝາຍ/ຍົກເລີກ "ນັບແລ້ວ" — ສຳລັບອັນທີ່ສະແກນບໍ່ໄດ້ (ເຊັ່ນ IH) ──
  const toggleCounted = (code: string) => {
    setScanned((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // ── ຍົກເລີກ/ລ້າງການກວດນັບ — ກັບໄປ 0 ທັງໝົດ (ຢືນຢັນກ່ອນ) ──
  const resetCount = async () => {
    if (scanned.size === 0) return;
    const ok = await ask({
      title: t.resetTitle,
      message: t.resetMessage,
      confirmLabel: t.resetConfirm,
      tone: "danger",
    });
    if (ok) setScanned(new Set());
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
          <p
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              !flash.ok ? "text-rose-700" : flash.dupe ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {flash.ok ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
            {!flash.ok
              ? `${flash.code} ${t.notInCountList}`
              : flash.dupe
                ? `${flash.code} — ${t.alreadyCounted}`
                : `${t.foundWord} ${flash.code} — ${t.countedWord}`}
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={finalize}
            className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? t.marking : `${t.finishCountMark} ${(total - found).toLocaleString()} ${t.itemsNotFoundAs} ‘ຕ້ອງກວດ’`}
          </button>
          {found > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={resetCount}
              title={t.resetCount}
              className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
            >
              <RotateCcw className="size-4" />
              {t.resetCount}
            </button>
          )}
        </div>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        {result && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            {t.doneMark} “ຕ້ອງກວດ” {result.held.toLocaleString()} {t.itemsUnit} ({t.notFoundWord} {result.missing.toLocaleString()}). {t.jobsMovedTo} ‘ຕ້ອງກວດ’.
          </p>
        )}
      </div>

      {total === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">{t.emptyMsg}</p>
      ) : (
        <>
          {/* ── Desktop = ຕາຕະລາງ ── */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[760px] border-collapse text-[11px] leading-tight">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="w-12 px-2 py-1.5 text-center font-semibold">{t.count}</th>
                  <th className="px-2 py-1.5 font-semibold">{t.colNo}</th>
                  <th className="px-2 py-1.5 font-semibold">{t.colProductSn}</th>
                  <th className="px-2 py-1.5 font-semibold">{t.colBrand}</th>
                  <th className="px-2 py-1.5 font-semibold">{t.colCustomer}</th>
                  <th className="px-2 py-1.5 font-semibold">{t.colStage}</th>
                  <th className="px-2 py-1.5 font-semibold">{t.colServiceType}</th>
                  <th className="px-2 py-1.5 font-semibold">{t.colElapsed}</th>
                </tr>
              </thead>
              <tbody>
                {shownJobs.map((job) => {
                  const isFound = scanned.has(job.code);
                  const tone = elapsedTone(job.elapsed_seconds);
                  return (
                    <tr
                      key={job.code}
                      onClick={() => toggleCounted(job.code)}
                      title={t.tapToCount}
                      className={`cursor-pointer select-none border-b border-slate-100 ${isFound ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-2 py-1 text-center">
                        {isFound ? (
                          <Check className="mx-auto size-3.5 text-emerald-600" />
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 font-bold text-[#0536a9]">{job.code}</td>
                      <td className="max-w-72 px-2 py-1">
                        <span className="block truncate font-medium text-slate-800" title={job.product ?? ""}>{job.product || "-"}</span>
                        <span className="block truncate text-[10px] text-slate-400">{job.sn || "-"}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1">{job.brand || "-"}</td>
                      <td className="max-w-48 truncate px-2 py-1" title={job.customer ?? ""}>{job.customer || "-"}</td>
                      <td className="whitespace-nowrap px-2 py-1">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{job.stage_label}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1">
                        {job.service_type ? (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            <b>{job.service_type}</b>
                            <span className="font-medium text-sky-600">{job.service_type_label}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1">
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
                    onClick={() => toggleCounted(job.code)}
                    className={`cursor-pointer select-none rounded-xl border p-2.5 shadow-sm transition ${isFound ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-[#0536a9]">{job.code}</span>
                      {isFound ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          <Check className="size-3" />
                          {t.foundBadge}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{job.stage_label}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-slate-800" title={job.product ?? ""}>{job.product || "-"}</p>
                    <p className="truncate text-[11px] text-slate-400">{[job.brand, job.sn].filter(Boolean).join(" · ") || "-"}</p>
                    {job.service_type && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                        <b>{job.service_type}</b> {job.service_type_label}
                      </span>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                      <span className="truncate text-[11px] text-slate-500" title={job.customer ?? ""}>{job.customer || "-"}</span>
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
