import { Check } from "lucide-react";
import { DONE_STAGE, NEXT_STEP, STAGE_TEXT, STEPS, stepOfStage, type TrackJob } from "@/lib/track";

/**
 * ບັດສະຖານະສຳລັບລູກຄ້າ — ໃຊ້ຮ່ວມກັນລະຫວ່າງ /track ແລະ /track/[code].
 * ສະແດງສະເພາະຂໍ້ມູນທີ່ລູກຄ້າເຫັນໄດ້ (ເບິ່ງ src/lib/track.ts).
 */
function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim();
  if (!text || text === "-") return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-xs font-semibold break-all text-slate-800">{text}</dd>
    </div>
  );
}

export function TrackStatus({ job }: { job: TrackJob }) {
  const cancelled = job.stage === -1;
  const current = stepOfStage(job.stage);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className={`px-4 py-3 text-white ${cancelled ? "bg-red-600" : "bg-[#0536a9]"}`}>
        <p className="text-[11px] opacity-80">ເລກທີໃບຮັບເຄື່ອງ</p>
        <p className="text-2xl font-bold">{job.code}</p>
        <p className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
          {STAGE_TEXT[job.stage] ?? "ບໍ່ຮູ້ສະຖານະ"}
        </p>
      </header>

      <div className="p-4">
        <p
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            cancelled ? "bg-red-50 text-red-700" : job.stage === DONE_STAGE ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {NEXT_STEP[job.stage] ?? "ກະລຸນາຕິດຕໍ່ສູນບໍລິການ"}
        </p>

        <dl className="mt-3">
          <Row label="ສິນຄ້າ" value={job.product} />
          <Row label="ຍີ່ຫໍ້" value={job.brand} />
          <Row label="ຮຸ່ນ" value={job.model} />
          <Row label="Serial Number" value={job.sn} />
          <Row label="ວັນທີຮັບເຄື່ອງ" value={job.registered} />
          <Row label="ວັນທີສົ່ງຄືນ" value={job.returned} />
        </dl>

        {!cancelled && (
          <ol className="mt-4 border-t border-slate-100 pt-4">
            {STEPS.map((step, index) => {
              const done = index < current || job.stage === DONE_STAGE;
              const active = index === current && job.stage !== DONE_STAGE;
              return (
                <li key={step} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < STEPS.length - 1 && (
                    <span
                      className={`absolute top-5 left-[9px] h-full w-0.5 ${done ? "bg-emerald-400" : "bg-slate-200"}`}
                    />
                  )}
                  <span
                    className={`relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-[#0536a9] ring-4 ring-blue-100"
                          : "border border-slate-300 bg-white"
                    }`}
                  >
                    {done && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span
                    className={`text-xs ${
                      active ? "font-bold text-[#0536a9]" : done ? "font-medium text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {step}
                    {active && <span className="ml-1 text-[10px] font-normal text-slate-500">(ກຳລັງດຳເນີນການ)</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
