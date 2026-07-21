"use client";
import { setJobServiceStage } from "@/app/actions/job-stage";
import { STAGE_LABEL } from "@/lib/stage";
import { LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: "CI", label: "CI · ຮັບເຄື່ອງມາສ້ອມ" },
  { value: "ST", label: "ST · ສ້ອມໜ້າຮ້ານ" },
  { value: "IH", label: "IH · ໄປສ້ອມບ້ານລູກຄ້າ" },
  { value: "PS", label: "PS · ໄປຮັບເຄື່ອງມາສ້ອມ" },
];
// ຂັ້ນ 1-12 (ຕັດ -1 ຍົກເລີກ ແລະ 0 ທີ່ຂຶ້ນກັບ service) — ຄູ່ກັບ action stagePlan
const STAGES = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Modal "ປັບປຸງ" — ແກ້ ປະເພດບໍລິການ + ຂັ້ນ ຂອງງານຈາກໜ້າກວດນັບ.
 * ⚠️ ຕັ້ງຂັ້ນ = ຂ້າມ workflow ປົກກະຕິ (ບັງຄັບຂຽນ) — ໃສ່ຄຳເຕືອນໃຫ້ຮູ້ກ່ອນ.
 */
export function JobStageModal({
  code,
  product,
  serviceType,
  currentStage,
  onClose,
}: {
  code: string;
  product: string | null;
  serviceType: string | null;
  currentStage?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [svc, setSvc] = useState(serviceType ?? "CI");
  const [stage, setStage] = useState<number>(currentStage && currentStage >= 1 && currentStage <= 12 ? currentStage : 1);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setErr("");
      const r = await setJobServiceStage(code, svc, stage);
      if (r.error) { setErr(r.error); return; }
      onClose();
      router.refresh();
    });

  const field = "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">ປັບປຸງ {code}</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{product || "-"}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">ປະເພດບໍລິການ</label>
            <select value={svc} onChange={(e) => setSvc(e.target.value)} className={field}>
              {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">ຂັ້ນ (ສະຖານະ)</label>
            <select value={stage} onChange={(e) => setStage(Number(e.target.value))} className={field}>
              {STAGES.map((s) => <option key={s} value={s}>{s} · {STAGE_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>ຕັ້ງຂັ້ນໂດຍກົງ = ຂ້າມຂັ້ນຕອນປົກກະຕິ. ໃຊ້ແກ້ຂໍ້ມູນທີ່ຜິດ. ບັນທຶກໃສ່ chatter ຂອງງານ.</span>
        </div>

        {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">ຍົກເລີກ</button>
          <button type="button" disabled={pending} onClick={save} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {pending && <LoaderCircle className="size-4 animate-spin" />} ບັນທຶກ
          </button>
        </div>
      </div>
    </div>
  );
}
