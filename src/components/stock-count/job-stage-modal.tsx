"use client";
import { setJobPaused, setJobServiceStage } from "@/app/actions/job-stage";
import { receiveJobTransfer, transferJob } from "@/app/actions/job-transfer";
import { HOLD_KIND_LABEL, HOLD_KINDS } from "@/lib/job-hold";
import { REPAIR_CENTER_LABEL, REPAIR_CENTERS } from "@/lib/repair-center";
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
const PAUSED = "paused";
const TRANSFER = "transfer";
const RECEIVE = "receive";

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
  const [status, setStatus] = useState<string>(currentStage && currentStage >= 1 && currentStage <= 12 ? String(currentStage) : "1");
  const [kind, setKind] = useState("other");
  const [reason, setReason] = useState("");
  const [toCenter, setToCenter] = useState(REPAIR_CENTERS[0]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const isPaused = status === PAUSED;
  const isTransfer = status === TRANSFER;
  const isReceive = status === RECEIVE;

  const save = () =>
    start(async () => {
      setErr("");
      const r = isPaused
        ? await setJobPaused(code, kind, reason)
        : isTransfer
          ? await transferJob(code, toCenter, reason)
          : isReceive
            ? await receiveJobTransfer(code)
            : await setJobServiceStage(code, svc, Number(status));
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
          {!isPaused && !isTransfer && !isReceive && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">ປະເພດບໍລິການ</label>
              <select value={svc} onChange={(e) => setSvc(e.target.value)} className={field}>
                {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">ຂັ້ນ (ສະຖານະ)</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
              {STAGES.map((s) => <option key={s} value={String(s)}>{s} · {STAGE_LABEL[s]}</option>)}
              <option value={PAUSED}>⏸ ພັກຊົ່ວຄາວ</option>
              <option value={TRANSFER}>📦 ໂອນໄປສ້ອມສູນອື່ນ</option>
              <option value={RECEIVE}>📥 ຮັບເຂົ້າສູນ (ເຄື່ອງມາຮອດ)</option>
            </select>
          </div>

          {isPaused && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">ປະເພດເຫດຜົນ</label>
                <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
                  {HOLD_KINDS.map((k) => <option key={k} value={k}>{HOLD_KIND_LABEL[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">ເຫດຜົນ *</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="ບອກເຫດຜົນທີ່ພັກ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>
            </>
          )}

          {isTransfer && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">ສູນປາຍທາງ</label>
                <select value={toCenter} onChange={(e) => setToCenter(e.target.value)} className={field}>
                  {REPAIR_CENTERS.map((c) => <option key={c} value={c}>{c} · {REPAIR_CENTER_LABEL[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">ເຫດຜົນ *</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="ຍ້ອນຫຍັງຈຶ່ງໂອນ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>
            </>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {isPaused
              ? "ພັກຊົ່ວຄາວ = ຄາຢູ່ຂັ້ນເດີມ ນາລິກາຂັ້ນຢຸດ. ບັນທຶກເຫດຜົນໃສ່ chatter."
              : isTransfer
                ? "ໂອນໄປສູນອື່ນ = ເຄື່ອງສົ່ງໄປສ້ອມສູນອື່ນ (ລໍສູນປາຍທາງກົດ 'ຮັບເຂົ້າ'). ຄາຢູ່ຂັ້ນເດີມ."
                : isReceive
                  ? "ຮັບເຂົ້າສູນ = ຢືນຢັນວ່າເຄື່ອງໂອນມາຮອດສູນນີ້ແລ້ວ — ປິດການໂອນ."
                  : "ຕັ້ງຂັ້ນໂດຍກົງ = ຂ້າມຂັ້ນຕອນປົກກະຕິ (ຖ້າພັກຢູ່ຈະສືບຕໍ່). ບັນທຶກໃສ່ chatter."}
          </span>
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
