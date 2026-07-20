"use client";
import { countByScan, resetStockCount, unmarkCounted } from "@/app/actions/stock-count";
import { useConfirm } from "@/components/confirm-dialog";
import { code128Svg } from "@/lib/barcode";
import { useDict } from "@/lib/i18n/context";
import type { CountedItem } from "@/lib/stock-count";
import { Check, CircleAlert, LoaderCircle, Printer, RotateCcw, ScanLine, SlidersHorizontal, Trash2, TriangleAlert } from "lucide-react";
import { useRef, useState, useTransition } from "react";

/**
 * ກວດນັບສະຕັອກ — **scan-driven**: ຍິງ/ພິມ code ຫຼື SN (job ໃດກໍ່ໄດ້, ບໍ່ຈຳກັດ pending) →
 * server ຄົ້ນຫາ + ໝາຍ "ນັບແລ້ວ" → ຂຶ້ນລາຍການ "ພົບແລ້ວ". ບໍ່ໂຫຼດ job ທັງໝົດມາສະແດງ (ໄວ).
 */
export function StockCountClient({ initialItems }: { initialItems: CountedItem[] }) {
  const t = useDict().stockCount;
  const [items, setItems] = useState<CountedItem[]>(initialItems);
  const [flash, setFlash] = useState<{ text: string; ok: boolean; warn?: boolean } | null>(null);
  const [pending, startScan] = useTransition();
  const { ask, dialog } = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  /** ສຽງແຈ້ງເຕືອນຕອນນັບ — ພົບ=ຕິບສູງ, ນັບຊ້ຳ=ຕິບຄູ່, ບໍ່ພົບ=ຕິບຕ່ຳ (scan station ຕ້ອງໄດ້ຍິນ) */
  const beep = (kind: "ok" | "warn" | "error") => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioRef.current ?? (audioRef.current = new Ctor());
      void ctx.resume();
      const tones = kind === "ok" ? [{ f: 1040, t: 0 }] : kind === "warn" ? [{ f: 720, t: 0 }, { f: 720, t: 0.14 }] : [{ f: 200, t: 0 }, { f: 160, t: 0.16 }];
      for (const { f, t: at } of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === "error" ? "sawtooth" : "square";
        osc.frequency.value = f;
        const start = ctx.currentTime + at;
        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.14);
      }
    } catch {
      /* ບາງ browser ບໍ່ຮອງຮັບ — ຂ້າມສຽງໄປ, flash ຍັງມີ */
    }
  };

  const onScan = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    startScan(async () => {
      const res = await countByScan(value);
      if (res.error || !res.item) {
        setFlash({ text: `${value} — ${res.error === "notfound" ? t.notFoundInSystem : t.notInCountList}`, ok: false });
        beep("error");
      } else if (res.dupe) {
        setFlash({ text: `${res.item.code} — ${t.alreadyCounted}`, ok: true, warn: true });
        beep("warn");
        // ຍ້າຍຂຶ້ນເທິງ (ບໍ່ເພີ່ມຊ້ຳ)
        setItems((prev) => [res.item!, ...prev.filter((it) => it.code !== res.item!.code)]);
      } else {
        setFlash({ text: `${t.foundWord} ${res.item.code} — ${t.countedWord}`, ok: true });
        beep("ok");
        setItems((prev) => [res.item!, ...prev.filter((it) => it.code !== res.item!.code)]);
      }
      focusInput();
    });
  };

  const remove = (code: string) => {
    void (async () => {
      const ok = await ask({ title: t.cancelCountTitle, message: t.cancelCountMessage.replace("{code}", code), confirmLabel: t.cancelCountConfirm, tone: "danger" });
      if (!ok) return;
      setItems((prev) => prev.filter((it) => it.code !== code));
      void unmarkCounted(code).catch(() => {});
    })();
  };

  const resetAll = async () => {
    if (items.length === 0) return;
    const ok = await ask({ title: t.resetTitle, message: t.resetMessage, confirmLabel: t.resetConfirm, tone: "danger" });
    if (ok) {
      setItems([]);
      void resetStockCount().catch(() => {});
    }
  };

  return (
    <div className="w-full space-y-4">
      {dialog}

      {/* ── ແຖບຍິງ ── */}
      <div className="sticky top-0 z-[5] space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onScan(inputRef.current?.value ?? "");
          }}
          className="flex items-center gap-2"
        >
          {pending ? (
            <LoaderCircle className="size-5 shrink-0 animate-spin text-teal-600" />
          ) : (
            <ScanLine className="size-5 shrink-0 text-teal-600" />
          )}
          <input
            ref={inputRef}
            autoFocus
            inputMode="text"
            placeholder={t.scanPlaceholder}
            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-base focus:border-teal-500 focus:outline-none"
          />
          <button type="submit" disabled={pending} className="h-11 shrink-0 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            {pending ? t.scanning : t.count}
          </button>
        </form>

        {flash && (
          <p
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
              !flash.ok
                ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                : flash.warn
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            }`}
            role="status"
            aria-live="assertive"
          >
            {flash.ok ? <Check className="size-5 shrink-0" /> : <CircleAlert className="size-5 shrink-0" />}
            {flash.text}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">
            {t.foundCount} <span className="tabular-nums text-teal-700">{items.length.toLocaleString()}</span> {t.itemsUnit}
          </span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={resetAll}
              title={t.resetCount}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
            >
              <RotateCcw className="size-3.5" />
              {t.resetCount}
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-400">
          <ScanLine className="size-8 text-slate-300" />
          {t.emptyScanHint}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.code} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50">
                <Check className="size-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-bold text-[#0536a9]">{it.code}</span>
                    {it.service_type && (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">{it.service_type}</span>
                    )}
                    {it.counted_stage_label && (
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">{it.counted_stage_label}</span>
                    )}
                    {it.returned && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        <TriangleAlert className="size-3" />
                        {t.returnedWarn}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-slate-500">
                    {[it.product, it.brand, it.sn, it.customer].filter(Boolean).join(" · ") || "-"}
                  </p>
                </div>
                {/* barcode ເລກ job — ສະແກນ/ຢືນຢັນໄດ້ໄວ (SVG ຈາກ code128Svg, ບໍ່ມີ user input) */}
                <div
                  className="hidden h-7 w-28 shrink-0 md:block"
                  aria-label={`barcode ${it.code}`}
                  dangerouslySetInnerHTML={{ __html: code128Svg(it.code, { height: 28, fit: true }) }}
                />
                <a
                  href={`/service/${it.code}`}
                  target="_blank"
                  rel="noreferrer"
                  title={t.manageJob}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <SlidersHorizontal className="size-4" />
                </a>
                <a
                  href={`/service/${it.code}/label`}
                  target="_blank"
                  rel="noreferrer"
                  title={t.printLabel}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                >
                  <Printer className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => remove(it.code)}
                  title={t.remove}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
