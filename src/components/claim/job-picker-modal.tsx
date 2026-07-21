"use client";
import { searchClaimJobs } from "@/app/actions/claim";
import type { ClaimJobCandidate } from "@/lib/claim-shared";
import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * Modal ເລືອກ **ເລກງານສ້ອມ** ທີ່ "ສຳເລັດ · ສົ່ງຄືນລູກຄ້າແລ້ວ · ລໍຖ້າອອກໃບເຄມ".
 * ຄົ້ນຫາໄດ້ (code/ສິນຄ້າ/SN/ຫຍີ່ຫໍ້/ລູກຄ້າ) ຜ່ານ server action searchClaimJobs.
 * ເລືອກແລ້ວ → onPick(job) (form ເອົາ code + prefill ຫຍີ່ຫໍ້).
 */
export function JobPickerModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (job: ClaimJobCandidate) => void }) {
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<ClaimJobCandidate[]>([]);
  const [pending, start] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const run = () => start(async () => { const r = await searchClaimJobs(q); setJobs(r.jobs ?? []); setLoaded(true); });
    const t = setTimeout(run, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">ເລືອກເລກງານສ້ອມ</h2>
            <p className="text-[11px] text-slate-500">ສຳເລັດ · ສົ່ງຄືນລູກຄ້າແລ້ວ · ຍັງບໍ່ມີໃບເຄມ</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
        </div>

        <div className="border-b border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-2.5 focus-within:border-teal-500">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ຄົ້ນ code / ສິນຄ້າ / SN / ຫຍີ່ຫໍ້ / ລູກຄ້າ" className="h-9 w-full text-sm outline-none" />
            {pending && <LoaderCircle className="size-4 shrink-0 animate-spin text-slate-400" />}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loaded && jobs.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">ບໍ່ພົບງານ</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {jobs.map((j) => (
                <li key={j.code}>
                  <button type="button" onClick={() => onPick(j)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-teal-50/60">
                    <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-[#0536a9]">{j.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{j.product || "-"} {j.brand ? <span className="text-slate-400">· {j.brand}</span> : null}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {j.sn ? `SN ${j.sn} · ` : ""}{j.customer || "-"}{j.fault ? ` · ${j.fault}` : ""}
                      </span>
                    </span>
                    {j.returned_at && <span className="shrink-0 text-[10px] text-slate-400">ຄືນ {j.returned_at}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
