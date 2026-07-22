"use client";
import { advanceMaintenance, assignMaintenance, cancelMaintenance, closeMaintenance } from "@/app/actions/maintenance";
import { useConfirm } from "@/components/confirm-dialog";
import { Elapsed } from "@/components/elapsed";
import type { MaintenanceDetail as Detail, MaintenanceJob, MaintenanceStep } from "@/lib/maintenance";
import { maintenanceStageChip } from "@/lib/maintenance-stage";
import { CheckCircle2, LoaderCircle, Phone, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Tech = { code: string; name: string };

const field = "h-9 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-cyan-500";

/** ເສັ້ນເວລາ (timeline) — ແຕ່ລະຂັ້ນ: ເວລາເຂົ້າ + ໄລຍະທີ່ຢູ່ຂັ້ນນັ້ນ */
function Timeline({ steps, cancelledAt }: { steps: MaintenanceStep[]; cancelledAt: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-slate-700">ເສັ້ນເວລາ (Timeline)</h2>
      <ol className="relative ml-2 space-y-0">
        {steps.map((s, i) => {
          const done = s.state === "done";
          const current = s.state === "current";
          const dot = current ? "border-cyan-500 bg-cyan-500" : done ? "border-cyan-500 bg-white" : "border-slate-300 bg-white";
          const line = i < steps.length - 1;
          return (
            <li key={s.stage} className="relative flex gap-3 pb-4 last:pb-0">
              {line && <span className={`absolute left-[7px] top-4 h-full w-px ${done ? "bg-cyan-300" : "bg-slate-200"}`} aria-hidden />}
              <span className={`relative z-[1] mt-0.5 size-3.5 shrink-0 rounded-full border-2 ${dot} ${current ? "animate-pulse" : ""}`} aria-hidden />
              <div className="min-w-0 flex-1 -mt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className={`text-sm font-semibold ${current ? "text-cyan-700" : done ? "text-slate-700" : "text-slate-400"}`}>{s.label}</span>
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
              <span className="text-sm font-semibold text-rose-600">ຍົກເລີກງານ</span>
              <span className="ml-2 text-[11px] tabular-nums text-slate-400">{cancelledAt}</span>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

/** ໜ້າລາຍລະອຽດງານສ້ອມບໍລຸງ + ປຸ່ມເລື່ອນຂັ້ນຕາມສະຖານະປັດຈຸບັນ. */
export function MaintenanceDetail({
  job,
  details,
  steps,
  cancelledAt,
  technicians,
}: {
  job: MaintenanceJob;
  details: Detail[];
  steps: MaintenanceStep[];
  cancelledAt: string | null;
  technicians: Tech[];
}) {
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [emp, setEmp] = useState(job.emp_code ?? "");
  const [appoint, setAppoint] = useState(job.appoint_date ?? "");

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) { alert(r.error); return; }
      router.refresh();
    });

  const cancel = () =>
    void (async () => {
      const reason = window.prompt("ເຫດຜົນທີ່ຍົກເລີກ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສอน):", "");
      if (reason == null) return;
      const ok = await ask({ title: "ຍົກເລີກງານ?", message: `ຍົກເລີກ ${job.code} — ${reason}`, confirmLabel: "ຍົກເລີກງານ", tone: "danger" });
      if (ok) run(() => cancelMaintenance(job.code, reason));
    })();

  const closed = job.stage === 6;
  const cancelled = job.stage === -1;

  const primary = (label: string, fn: () => Promise<{ error?: string }>) => (
    <button type="button" disabled={pending} onClick={() => run(fn)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {dialog}

      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-800">{job.code}</h1>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${maintenanceStageChip(job.stage)}`}>{job.stage_label}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {job.cust_name || "-"}
            {job.cust_tel && <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-400"><Phone className="size-3" />{job.cust_tel}</span>}
          </p>
        </div>
        <button type="button" onClick={() => router.push("/maintenance")} className="text-xs font-semibold text-slate-500 hover:text-slate-700">← ກັບລາຍການ</button>
      </div>

      {/* ── ຂໍ້ມູນ ── */}
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-2">
        <div><span className="text-slate-400">ທີ່ຢູ່ໜ້າງານ:</span> {job.location || "-"}</div>
        <div><span className="text-slate-400">ວັນນັດ:</span> {job.appoint_date || "-"}</div>
        <div><span className="text-slate-400">ຊ່າງ:</span> {technicians.find((t) => t.code === job.emp_code)?.name ?? job.emp_code ?? "-"}</div>
        <div><span className="text-slate-400">ລວມ:</span> <b className="tabular-nums text-slate-700">{job.total.toLocaleString()}</b> ກີບ</div>
        {job.remark && <div className="sm:col-span-2"><span className="text-slate-400">ໝາຍເຫດ:</span> {job.remark}</div>}
      </div>

      {/* ── ບໍລິການ ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr><th className="px-3 py-1.5 font-semibold">ບໍລິການ</th><th className="px-3 py-1.5 text-center font-semibold">ຈຳນວນ</th><th className="px-3 py-1.5 text-right font-semibold">ລາຄາ</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {details.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-1.5">{d.name}</td>
                <td className="px-3 py-1.5 text-center tabular-nums">{d.qty}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{(d.price * d.qty).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Timeline: ໄລຍະເວລາຕໍ່ຂັ້ນ ── */}
      <Timeline steps={steps} cancelledAt={cancelledAt} />

      {/* ── ປຸ່ມຕາມຂັ້ນ ── */}
      {!closed && !cancelled && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {job.stage === 0 && (
            <>
              <select value={emp} onChange={(e) => setEmp(e.target.value)} className={field}>
                <option value="">— ເລືອກຊ່າງ —</option>
                {technicians.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
              <input type="date" value={appoint} onChange={(e) => setAppoint(e.target.value)} className={field} />
              {primary("ຈັດຊ່າງ + ນັດ", () => assignMaintenance(job.code, emp, appoint))}
            </>
          )}
          {job.stage === 1 && primary("ຊ່າງຮັບງານ", () => advanceMaintenance(job.code, "accept"))}
          {job.stage === 2 && primary("ເລີ່ມລ້າງ", () => advanceMaintenance(job.code, "start-clean"))}
          {job.stage === 3 && primary("ລ້າງສຳເລັດ", () => advanceMaintenance(job.code, "finish-clean"))}
          {job.stage === 4 && primary("ຜ່ານ QC", () => advanceMaintenance(job.code, "qc"))}
          {job.stage === 5 && primary("ເກັບເງິນ + ປິດງານ", () => closeMaintenance(job.code))}

          <button type="button" disabled={pending} onClick={cancel} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60">
            <XCircle className="size-4" /> ຍົກເລີກງານ
          </button>
        </div>
      )}
      {closed && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700">✓ ງານສຳເລັດ ແລະ ປິດແລ້ວ</p>}
      {cancelled && <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-sm font-semibold text-rose-700">ງານນີ້ຖືກຍົກເລີກ</p>}
    </div>
  );
}
