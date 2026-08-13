import { Elapsed } from "@/components/elapsed";
import { minutesLabel, type JobVisitStep } from "@/lib/install-visits";
import type { TimelineStep } from "@/lib/repair-timeline";
import { Check, MapPin } from "lucide-react";

/**
 * ແຖບ **ຮອບເຂົ້າໜ້າງານ** ທີ່ຕິດຢູ່ລຸ່ມເສັ້ນເວລາ.
 *
 * ເສັ້ນເວລາ 9 ຂັ້ນສະແດງຮອບບໍ່ໄດ້ ເພາະຮອບເກີດ **ພາຍໃນຂັ້ນດຽວ** (4 ລໍຕິດຕັ້ງ / 5 ກຳລັງຕິດຕັ້ງ):
 * ຊ່າງເຂົ້າ-ອອກ 3 ຮອບ ຂັ້ນກໍຍັງເປັນ "ກຳລັງຕິດຕັ້ງ" ຢູ່ຕະຫຼອດ (ເບິ່ງ lib/job-flow.scheduleNextVisit).
 * ຈຶ່ງໃສ່ເປັນແຖວທີສອງ ⇒ ຄົນເບິ່ງຮູ້ວ່າ "ຄ້າງ" ນັ້ນ ໄປມາແລ້ວຈັກເທື່ອ ບໍ່ແມ່ນຖືກປະຖິ້ມ.
 */
function VisitStrip({ visits }: { visits: JobVisitStep[] }) {
  if (visits.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-brand-100 pt-2.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700">
        <MapPin className="size-3" />
        ຮອບເຂົ້າໜ້າງານ ({visits.length})
      </span>
      {visits.map((visit) => (
        <span
          key={visit.n}
          className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] tabular-nums text-brand-800"
          title={[visit.tech && `ຊ່າງ ${visit.tech}`, visit.reason && `ຍັງບໍ່ຈົບຍ້ອນ: ${visit.reason}`]
            .filter(Boolean)
            .join(" · ") || undefined}
        >
          <b className="font-bold">ຮອບ {visit.n}</b> {visit.at ?? "-"}
          {visit.out ? ` → ${visit.out.slice(-5)} (${minutesLabel(visit.minutes)})` : (
            <span className="text-brand-orange-700"> · ຍັງຢູ່ໜ້າງານ</span>
          )}
          {/* ເຫດຜົນທີ່ຮອບນັ້ນຄ້າງ — ຄຳຕອບຂອງ "ເປັນຫຍັງຕ້ອງໄປອີກຮອບ" */}
          {visit.reason && <span className="text-brand-orange-700"> · {visit.reason}</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * ເສັ້ນເວລາຂອງງານສ້ອມ — ທຸກຂັ້ນ (ໄປຕາມ service_type) ພ້ອມ **ໄລຍະເວລາທີ່ຢູ່ແຕ່ລະຂັ້ນ**.
 * ຂັ້ນຜ່ານແລ້ວ = ໝາຍ ● · ຂັ້ນປັດຈຸບັນ = ● ກະພິບ + "ຄ້າງມາ" · ຂັ້ນຍັງບໍ່ຮອດ = ○ ເທົາ.
 *
 * ⚠️ **ຜ່ານແລ້ວຕ້ອງຢຸດເຄື່ອນໄຫວ**: ຂັ້ນທີ່ຜ່ານໄປແລ້ວບໍ່ກະພິບ ແລະ ເວລາເປັນຄ່າຄົງທີ່
 * (`live={current}`) — ບໍ່ດັ່ງນັ້ນງານທີ່ຈົບແລ້ວຈະເບິ່ງຄືຍັງຄ້າງຢູ່. ງານທີ່ຈົບ (ຂັ້ນສຸດທ້າຍ)
 * ໝາຍເປັນສີຂຽວຄົງທີ່ ບໍ່ແມ່ນ "ຂັ້ນປັດຈຸບັນ".
 */
export function JobTimeline({
  steps,
  cancelledAt,
  bare = false,
  horizontal = false,
  visits = [],
}: {
  steps: TimelineStep[];
  cancelledAt: string | null;
  /** bare = ໃສ່ໃນ container ອື່ນ (details) ⇒ ບໍ່ຫຸ້ມ section/ຫົວຂໍ້ຂອງໂຕເອງ */
  bare?: boolean;
  /** horizontal = stepper ແນວນອນ ສຳລັບ Tree ໃນໜ້າລາຍການ */
  horizontal?: boolean;
  /** ຮອບເຂົ້າໜ້າງານ (ງານຕິດຕັ້ງ/ສ້ອມນອກສູນ) — ວ່າງ ⇒ ບໍ່ສະແດງແຖບ */
  visits?: JobVisitStep[];
}) {
  if (steps.length === 0) return null;
  if (horizontal) {
    return (
      <div className="pb-1">
        <div className="overflow-x-auto">
        <ol
          className="grid min-w-max"
          style={{ gridTemplateColumns: `repeat(${steps.length + (cancelledAt ? 1 : 0)}, minmax(130px, 1fr))` }}
        >
          {steps.map((step, index) => {
            const done = step.state === "done";
            const current = step.state === "current";
            const reached = done || current;
            return (
              <li key={step.stage} className="relative min-w-32 px-2 text-center">
                {index > 0 && (
                  <span
                    className={`absolute left-0 right-1/2 top-[7px] h-0.5 ${reached ? "bg-brand-700" : "bg-slate-200"}`}
                    aria-hidden
                  />
                )}
                {index < steps.length - 1 && (
                  <span
                    className={`absolute left-1/2 right-0 top-[7px] h-0.5 ${done ? "bg-brand-700" : "bg-slate-200"}`}
                    aria-hidden
                  />
                )}
                <span
                  className={`relative z-[1] mx-auto grid size-4 place-items-center rounded-full border-2 ${
                    done
                      ? "border-brand-600 bg-brand-700 text-white"
                      : current
                        ? "border-brand-600 bg-brand-600 text-white ring-4 ring-brand-100"
                        : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  {reached && <Check className="size-2.5" strokeWidth={4} />}
                </span>
                <span className={`mt-2 block text-[10px] font-semibold ${current ? "text-brand-700" : done ? "text-slate-700" : "text-slate-400"}`}>
                  {step.label}
                </span>
                <span className="mt-0.5 block text-[9px] tabular-nums text-slate-400">{step.at || "ລໍຖ້າ"}</span>
                {step.durationSeconds != null && (
                  <span className="mt-0.5 block text-[9px] text-slate-500">
                    {current ? "ຄ້າງ " : "ໃຊ້ເວລາ "}
                    <Elapsed seconds={step.durationSeconds} live={current} className="font-semibold" />
                  </span>
                )}
              </li>
            );
          })}
          {cancelledAt && (
            <li className="relative min-w-32 px-2 text-center">
              <span className="absolute left-0 right-1/2 top-[7px] h-0.5 bg-brand-orange-400" aria-hidden />
              <span className="relative z-[1] mx-auto block size-4 rounded-full border-2 border-brand-orange-600 bg-brand-orange-700" />
              <span className="mt-2 block text-[10px] font-semibold text-brand-orange-700">ຂໍຍົກເລີກ</span>
              <span className="mt-0.5 block text-[9px] text-slate-400">{cancelledAt}</span>
            </li>
          )}
        </ol>
        </div>
        <VisitStrip visits={visits} />
      </div>
    );
  }
  const list = (
    <ol className="relative ml-1">
        {steps.map((s, i) => {
          const done = s.state === "done";
          const current = s.state === "current";
          const last = i === steps.length - 1 && !cancelledAt;
          // ງານຈົບແລ້ວ (ຂັ້ນສຸດທ້າຍຜ່ານແລ້ວ) — ໝາຍຂຽວຄົງທີ່ ບໍ່ກະພິບ
          const finished = done && last;
          const dot = current
            ? "border-brand-600 bg-brand-600"
            : finished
              ? "border-brand-600 bg-brand-700"
              : done
                ? "border-brand-600 bg-white"
                : "border-slate-300 bg-white";
          return (
            <li key={s.stage} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span className={`absolute left-[7px] top-4 h-full w-px ${done ? "bg-brand-300" : "bg-slate-200"}`} aria-hidden />}
              <span className={`relative z-[1] mt-0.5 size-3.5 shrink-0 rounded-full border-2 ${dot} ${current ? "animate-pulse" : ""}`} aria-hidden />
              <div className="-mt-0.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className={`text-sm font-semibold ${current ? "text-brand-700" : finished ? "text-brand-800" : done ? "text-slate-700" : "text-slate-400"}`}>{s.label}</span>
                  {s.at && <span className="text-[11px] tabular-nums text-slate-400">{s.at}</span>}
                </div>
                {s.durationSeconds != null ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {current ? "ຄ້າງມາ " : "ໃຊ້ເວລາ "}
                    {/* ເດີນສະເພາະຂັ້ນທີ່ກຳລັງຢູ່ — ຂັ້ນທີ່ຜ່ານແລ້ວເປັນຄ່າຄົງທີ່ */}
                    <Elapsed seconds={s.durationSeconds} live={current} className="font-semibold text-slate-600" />
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
            <span className="relative z-[1] mt-0.5 size-3.5 shrink-0 rounded-full border-2 border-brand-orange-600 bg-brand-orange-700" aria-hidden />
            <div className="-mt-0.5">
              <span className="text-sm font-semibold text-brand-orange-700">ຂໍຍົກເລີກ</span>
              <span className="ml-2 text-[11px] tabular-nums text-slate-400">{cancelledAt}</span>
            </div>
          </li>
        )}
      </ol>
  );
  const block = (
    <>
      {list}
      <VisitStrip visits={visits} />
    </>
  );
  if (bare) return block;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">ເສັ້ນເວລາ (Timeline)</h2>
      {block}
    </section>
  );
}
