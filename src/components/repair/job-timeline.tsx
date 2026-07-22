import { Elapsed } from "@/components/elapsed";
import type { TimelineStep } from "@/lib/repair-timeline";

/**
 * ເສັ້ນເວລາຂອງງານສ້ອມ — ທຸກຂັ້ນ (ໄປຕາມ service_type) ພ້ອມ **ໄລຍະເວລາທີ່ຢູ່ແຕ່ລະຂັ້ນ**.
 * ຂັ້ນຜ່ານແລ້ວ = ໝາຍ ● · ຂັ້ນປັດຈຸບັນ = ● ກະພິບ + "ຄ້າງມາ" · ຂັ້ນຍັງບໍ່ຮອດ = ○ ເທົາ.
 */
export function JobTimeline({ steps, cancelledAt }: { steps: TimelineStep[]; cancelledAt: string | null }) {
  if (steps.length === 0) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">ເສັ້ນເວລາ (Timeline)</h2>
      <ol className="relative ml-1">
        {steps.map((s, i) => {
          const done = s.state === "done";
          const current = s.state === "current";
          const last = i === steps.length - 1 && !cancelledAt;
          const dot = current ? "border-indigo-500 bg-indigo-500" : done ? "border-indigo-500 bg-white" : "border-slate-300 bg-white";
          return (
            <li key={s.stage} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span className={`absolute left-[7px] top-4 h-full w-px ${done ? "bg-indigo-300" : "bg-slate-200"}`} aria-hidden />}
              <span className={`relative z-[1] mt-0.5 size-3.5 shrink-0 rounded-full border-2 ${dot} ${current ? "animate-pulse" : ""}`} aria-hidden />
              <div className="-mt-0.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className={`text-sm font-semibold ${current ? "text-indigo-700" : done ? "text-slate-700" : "text-slate-400"}`}>{s.label}</span>
                  {s.at && <span className="text-[11px] tabular-nums text-slate-400">{s.at}</span>}
                </div>
                {s.durationSeconds != null ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {current ? "ຄ້າງມາ " : "ໃຊ້ເວລາ "}
                    <Elapsed seconds={s.durationSeconds} className="font-semibold text-slate-600" />
                  </p>
                ) : s.state === "pending" ? (
                  <p className="mt-0.5 text-[11px] text-slate-300">ຍັງບໍ່ຮອດ</p>
                ) : null}
              </div>
            </li>
          );
        })}
        {cancelledAt && (
          <li className="relative flex gap-3">
            <span className="relative z-[1] mt-0.5 size-3.5 shrink-0 rounded-full border-2 border-rose-500 bg-rose-500" aria-hidden />
            <div className="-mt-0.5">
              <span className="text-sm font-semibold text-rose-600">ຂໍຍົກເລີກ</span>
              <span className="ml-2 text-[11px] tabular-nums text-slate-400">{cancelledAt}</span>
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}
