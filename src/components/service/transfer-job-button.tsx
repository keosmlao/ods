"use client";
import { receiveJobTransfer, transferJob } from "@/app/actions/job-transfer";
import { useDict } from "@/lib/i18n/context";
import { centerLabel, REPAIR_CENTER_LABEL, REPAIR_CENTERS } from "@/lib/repair-center";
import { ArrowLeftRight, Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ບ່ອນຮັບເຄື່ອງ ↔ ບ່ອນທີ່ເຄື່ອງຢູ່** ຢູ່ໜ້າໃບງານ — ພ້ອມປຸ່ມໂອນຂ້າມສູນ / ຮັບເຂົ້າ.
 *
 * ແຕ່ກ່ອນການໂອນລີ້ຢູ່ modal ຂອງໜ້າກວດນັບສະຕັອກບ່ອນດຽວ ⇒ ຄົນໜ້າເຄົາເຕີບໍ່ຮູ້ວ່າມີ.
 * ບ່ອນນີ້ຄືບ່ອນທີ່ຄົນເບິ່ງໃບງານຢູ່ແລ້ວ ⇒ ເຫັນທັນທີວ່າເຄື່ອງຢູ່ໃສ ແລະ ຕ້ອງໂອນກັບບໍ.
 */
export function TransferJobButton({
  code,
  intake,
  current,
  transferTo,
  canEdit,
}: {
  code: string;
  /** ບ່ອນຮັບເຄື່ອງເຂົ້າ (ບໍ່ປ່ຽນ) */
  intake: string | null;
  /** ບ່ອນທີ່ເຄື່ອງຢູ່ດຽວນີ້ */
  current: string | null;
  /** ສູນປາຍທາງ ຖ້າກຳລັງໂອນ (ຍັງບໍ່ກົດຮັບ) */
  transferTo: string | null;
  canEdit: boolean;
}) {
  const t = useDict().jobTransfer;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // ໃບເກົ່າບໍ່ມີທັງສອງຄ່າ ແລະ ບໍ່ມີການໂອນຄ້າງ ⇒ ບໍ່ຕ້ອງລົບກວນໜ້າຈໍ
  if (!intake && !current && !transferTo) return null;

  const away = Boolean(intake && current && intake !== current);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <ArrowLeftRight className="size-4 text-teal-600" />
            {t.intakeAt} <b className="text-slate-900">{centerLabel(intake)}</b>
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${away ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
            {t.nowAt} {centerLabel(current)}
          </span>
          {transferTo && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
              → {centerLabel(transferTo)} ({t.receive})
            </span>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {transferTo ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    const result = await receiveJobTransfer(code);
                    if (result.error) return setError(result.error);
                    router.refresh();
                  })
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {t.receive}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-100"
              >
                {open ? <X className="size-3.5" /> : <ArrowLeftRight className="size-3.5" />}
                {open ? t.cancel : t.transferTitle}
              </button>
            )}
          </div>
        )}
      </div>

      {open && canEdit && !transferTo && (
        <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[200px_1fr_auto]">
          <select
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-teal-500"
          >
            <option value="">{t.transferTo}...</option>
            {REPAIR_CENTERS.filter((centre) => centre !== current).map((centre) => (
              <option key={centre} value={centre}>
                {REPAIR_CENTER_LABEL[centre]}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t.reason}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500"
          />
          <button
            type="button"
            disabled={pending || !to || reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                setError("");
                const result = await transferJob(code, to, reason);
                if (result.error) return setError(result.error);
                setOpen(false);
                setReason("");
                router.refresh();
              })
            }
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <ArrowLeftRight className="size-3.5" />}
            {t.transfer}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </section>
  );
}
