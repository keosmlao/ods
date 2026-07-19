"use client";
import { holdJob, markJobRepaired, releaseJobHold } from "@/app/actions/job-hold";
import { requestCancel } from "@/app/actions/service";
import { useConfirm } from "@/components/confirm-dialog";
import { useDict } from "@/lib/i18n/context";
import { type JobHold } from "@/lib/job-hold";
import { CircleAlert, LoaderCircle, Undo2, Wrench, X } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * **ຈັດການວຽກຄ້າງ** — ແທນປຸ່ມ "ມີບັນຫາ" ເກົ່າ ດ້ວຍ 3 ທາງອອກ ທີ່ຕໍ່ workflow ຈິງ:
 *
 *   ① ຕ້ອງກວດວ່າຍັງຢູ່ → holdJob        (ໝາຍໄວ້ກວດ · ນາລິກາຢຸດ · ແຍກແທັບ)
 *   ② ຍົກເລີກ          → requestCancel   (ເຂົ້າຄິວອະນຸມັດຍົກເລີກ /approvals/cancellations)
 *   ③ ແປງແລ້ວ          → markJobRepaired (ຫົວໜ້າ override → ວຽກໄປຂັ້ນ QC/ສົ່ງຄືນ)
 *
 * ທຸກອັນບັງຄັບເຫດຜົນ (ບໍ່ດັ່ງນັ້ນວຽກຄ້າງທີ່ບໍ່ບອກເຫດຜົນ ຄືວຽກທີ່ບໍ່ມີໃຜແກ້ໄດ້).
 * ເຫັນສະເພາະຫົວໜ້າ/ຜູ້ມີສິດອະນຸມັດ — server ກວດຊ້ຳ.
 */

type Mode = "verify" | "cancel" | "repaired";

const modeConfig = (t: Record<string, string>) => ({
  verify: { label: t.verifyLabel, icon: CircleAlert, tone: "text-amber-700 border-amber-300 hover:bg-amber-50", placeholder: t.verifyPlaceholder },
  cancel: { label: t.cancelLabel, icon: X, tone: "text-rose-700 border-rose-300 hover:bg-rose-50", placeholder: t.cancelPlaceholder },
  repaired: { label: t.repairedLabel, icon: Wrench, tone: "text-emerald-700 border-emerald-300 hover:bg-emerald-50", placeholder: t.repairedPlaceholder },
}) as const;

export function HoldButtons({ code, hold }: { code: string; hold: JobHold | null }) {
  const t = useDict().holdButtons;
  const MODE = modeConfig(t);
  const [open, setOpen] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const { ask, dialog } = useConfirm();

  const run = (mode: Mode) => {
    setError(null);
    startBusy(async () => {
      const r = reason.trim();
      const res =
        mode === "verify"
          ? await holdJob({}, fd({ workflow: "repair", job_code: code, kind: "other", reason: r }))
          : mode === "cancel"
            ? await requestCancel(code, r)
            : await markJobRepaired({}, fd({ job_code: code, note: r }));
      if (res?.error) { setError(res.error); return; }
      setOpen(null);
      setReason("");
    });
  };

  // ── ວຽກທີ່ຖືກໝາຍ "ຕ້ອງກວດ" ແລ້ວ: ສະແດງສະຖານະ + ປົດ ── (key ຕາມ hold ⇒ mount ໃໝ່ຕອນປ່ຽນ)
  if (hold) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {dialog}
        <span
          title={`${hold.reason}\n${t.markedBy} ${hold.created_by} · ${hold.created_at}`}
          className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
        >
          <CircleAlert className="size-3" />
          {t.needCheckBadge} · {hold.held_days} {t.daysUnit}
        </span>
        <button
          type="button"
          disabled={busy}
          title={t.releaseTitle}
          onClick={async () => {
            const ok = await ask({
              title: t.releaseAskTitle,
              message: `${code} ${t.releaseAskBody} (${t.heldFor} ${hold.held_days} ${t.daysUnit})`,
              confirmLabel: t.release,
            });
            if (!ok) return;
            setError(null);
            startBusy(async () => {
              const res = await releaseJobHold({}, fd({ workflow: "repair", job_code: code, note: "" }));
              if (res?.error) setError(res.error);
            });
          }}
          className="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
        </button>
        {error && <span className="text-[10px] text-rose-600">{error}</span>}
      </span>
    );
  }

  // ── ວຽກຄ້າງທົ່ວໄປ: 3 ທາງອອກ ──
  if (open) {
    const m = MODE[open];
    return (
      <span className="inline-flex items-center gap-1">
        {dialog}
        <input
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={200}
          placeholder={m.placeholder}
          className="h-6 w-44 rounded border border-slate-300 px-1.5 text-[10px] focus:border-teal-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={async () => {
            const confirmMsg =
              open === "cancel"
                ? `${code} ${t.cancelConfirm}`
                : open === "repaired"
                  ? `${code} ${t.repairedConfirm}`
                  : `${code} ${t.verifyConfirm}`;
            const ok = await ask({ title: `${m.label}?`, message: confirmMsg, confirmLabel: m.label, tone: open === "cancel" ? "danger" : undefined });
            if (ok) run(open);
          }}
          className={`inline-flex h-6 items-center gap-1 rounded border bg-white px-2 text-[10px] font-semibold disabled:opacity-40 ${m.tone}`}
        >
          {busy ? <LoaderCircle className="size-3 animate-spin" /> : <m.icon className="size-3" />}
          {m.label}
        </button>
        <button type="button" disabled={busy} onClick={() => { setOpen(null); setReason(""); setError(null); }} className="h-6 px-1 text-[10px] text-slate-400 hover:text-slate-700">
          {t.dismiss}
        </button>
        {error && <span className="text-[10px] text-rose-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {(Object.keys(MODE) as Mode[]).map((mode) => {
        const m = MODE[mode];
        return (
          <button
            key={mode}
            type="button"
            title={m.label}
            onClick={() => { setOpen(mode); setReason(""); setError(null); }}
            className={`inline-flex h-6 items-center gap-1 rounded border bg-white px-1.5 text-[10px] font-semibold ${m.tone}`}
          >
            <m.icon className="size-3" />
            {m.label}
          </button>
        );
      })}
    </span>
  );
}

/** ສ້າງ FormData ຈາກ object — ໃຫ້ເອີ້ນ action ແບບ (state, formData) ໄດ້ໂດຍກົງ */
function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}
