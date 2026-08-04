import { Check } from "lucide-react";

/**
 * ແຖບຄວາມຄືບໜ້າ **ແນວນອນ** — ຫຍໍ້ຂັ້ນ 0–12 ເປັນ 6 ໄລຍະໃຫຍ່ ເຫັນທັນທີວ່າຮອດໃສ.
 * (ເສັ້ນເວລາລະອຽດຢູ່ JobTimeline ດ້ານລຸ່ມ — ອັນນີ້ໃຫ້ເຫັນພາບລວມ ບໍ່ໃຫ້ຍາວ.)
 */
const PHASES = ["ຮັບເຄື່ອງ", "ກວດເຊັກ", "ລາຄາ/ອາໄຫຼ່", "ສ້ອມແປງ", "QC", "ສົ່ງຄືນ"];
const PHASES_IH = ["ນັດ/ໄປສ້ອມ", "ກວດເຊັກ", "ລາຄາ/ອາໄຫຼ່", "ສ້ອມແປງ", "QC", "ປິດງານ"];

function phaseOf(stage: number): number {
  if (stage >= 13 && stage <= 16) return 2;
  if (stage <= 1) return 0;
  if (stage <= 2) return 1;
  if (stage <= 7) return 2;
  if (stage <= 9) return 3;
  if (stage === 10) return 4;
  return 5; // 11–12
}

export function JobProgress({
  stage,
  serviceType,
  cancelled,
}: {
  stage: number;
  serviceType: string | null;
  cancelled: boolean;
}) {
  const labels = serviceType === "IH" ? PHASES_IH : PHASES;
  const current = phaseOf(stage);
  const completed = stage === 12;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-stretch">
        {labels.map((label, i) => {
          const done = i < current || (completed && i === current);
          const active = i === current && !completed && !cancelled;
          const dotClass = cancelled
            ? "border-slate-200 bg-white text-slate-300"
            : done
              ? "border-brand-600 bg-brand-600 text-white"
              : active
                ? "border-brand-600 bg-white text-brand-700 ring-4 ring-brand-100"
                : "border-slate-200 bg-white text-slate-300";
          const lineDone = i < current && !cancelled;
          return (
            <div key={label} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : lineDone ? "bg-brand-400" : "bg-slate-200"}`} />
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${dotClass}`}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={`h-0.5 flex-1 ${i === labels.length - 1 ? "opacity-0" : i < current && !cancelled ? "bg-brand-400" : "bg-slate-200"}`} />
              </div>
              <span
                className={`mt-1.5 text-center text-[11px] leading-tight ${
                  active ? "font-bold text-brand-800" : done ? "font-medium text-slate-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
