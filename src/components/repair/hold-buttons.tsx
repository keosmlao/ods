"use client";
import { holdJob, releaseJobHold, type HoldState } from "@/app/actions/job-hold";
import { useConfirm } from "@/components/confirm-dialog";
import { HOLD_KIND_LABEL, type JobHold } from "@/lib/job-hold";
import { CircleAlert, LoaderCircle, Undo2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";

/**
 * ປຸ່ມ **ໝາຍວ່າມີບັນຫາ / ປົດທຸງ** ຢູ່ໃນແຖວຂອງຄິວ.
 *
 * ໝາຍແລ້ວ: ວຽກຍ້າຍໄປແທັບ "ມີບັນຫາ" ຂອງຂັ້ນເດີມ ແລະ **ນາລິກາຂັ້ນຢຸດນັບ**
 * ⇒ ຕ້ອງບອກເຫດຜົນສະເໝີ (ທຸງທີ່ບໍ່ບອກເຫດຜົນ ຄືທຸງທີ່ບໍ່ມີໃຜແກ້ໄດ້).
 * ເຫັນສະເພາະຫົວໜ້າ/ຜູ້ມີສິດອະນຸມັດ — ຝັ່ງ server ກວດຊ້ຳຢູ່ດີ (ຢ່າເຊື່ອ UI).
 */
export function HoldButtons({ code, hold }: { code: string; hold: JobHold | null }) {
  const [holdState, holdAction, holding] = useActionState<HoldState, FormData>(holdJob, {});
  const [releaseState, releaseAction, releasing] = useActionState<HoldState, FormData>(releaseJobHold, {});
  const holdRef = useRef<HTMLFormElement>(null);
  const releaseRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("spare_wait");
  const [reason, setReason] = useState("");
  const busy = holding || releasing;
  const error = holdState.error ?? releaseState.error;

  /**
   * ບໍ່ຕ້ອງລ້າງ state ເອງຫຼັງບັນທຶກ: action revalidate ແລ້ວແຖວ render ໃໝ່ພ້ອມ `hold`
   * ⇒ ໄປກິ່ງ "ມີທຸງ" ເອງ. ຝັ່ງເອີ້ນໃສ່ `key` ຕາມສະຖານະທຸງ ⇒ ປ່ຽນທຸງ = mount ໃໝ່
   * ⇒ ກ່ອງ/ເຫດຜົນເກົ່າຫາຍໄປເອງ (ບໍ່ຕ້ອງ setState ໃນ effect).
   */
  if (hold) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {dialog}
        <span
          title={`${HOLD_KIND_LABEL[hold.kind] ?? hold.kind}: ${hold.reason}\nໝາຍໂດຍ ${hold.created_by} · ${hold.created_at}`}
          className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
        >
          <CircleAlert className="size-3" />
          {HOLD_KIND_LABEL[hold.kind] ?? hold.kind} · {hold.held_days} ມື້
        </span>
        <button
          type="button"
          disabled={busy}
          title="ປົດທຸງ — ວຽກກັບເຂົ້າຄິວປົກກະຕິ ແລະ ນາລິກາເດີນຕໍ່"
          onClick={async () => {
            const ok = await ask({
              title: "ປົດທຸງ ‘ມີບັນຫາ’?",
              message: `${code} ຈະກັບເຂົ້າຄິວປົກກະຕິ ແລະ ນາລິກາຂັ້ນເດີນຕໍ່ຈາກຈຸດທີ່ຢຸດ (ຄ້າງມາແລ້ວ ${hold.held_days} ມື້)`,
              confirmLabel: "ປົດທຸງ",
            });
            if (ok) releaseRef.current?.requestSubmit();
          }}
          className="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
        >
          {releasing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
        </button>
        {error && <span className="text-[10px] text-rose-600">{error}</span>}
        <form ref={releaseRef} action={releaseAction} className="hidden">
          <input type="hidden" name="workflow" value="repair" />
          <input type="hidden" name="job_code" value={code} />
        </form>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {dialog}
      {!open ? (
        <button
          type="button"
          disabled={busy}
          title="ໝາຍວ່າມີບັນຫາ — ຍ້າຍໄປແທັບ ‘ມີບັນຫາ’ ແລະ ຢຸດນາລິກາຂັ້ນ"
          onClick={() => setOpen(true)}
          className="inline-flex h-6 items-center gap-1 rounded border border-amber-300 bg-white px-1.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40"
        >
          <CircleAlert className="size-3" />
          ມີບັນຫາ
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="h-6 rounded border border-slate-300 bg-white px-1 text-[10px]"
          >
            {Object.entries(HOLD_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder="ຍ້ອນຫຍັງ..."
            className="h-6 w-40 rounded border border-slate-300 px-1.5 text-[10px] focus:border-teal-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              const ok = await ask({
                title: "ໝາຍວ່າມີບັນຫາ?",
                message: `${code} ຈະຍ້າຍໄປແທັບ "ມີບັນຫາ" ຂອງຂັ້ນນີ້ ແລະ **ນາລິກາຂັ້ນຈະຢຸດນັບ** — ວຽກຍັງຄ້າງຢູ່ ພຽງແຕ່ບໍ່ປົນກັບວຽກທີ່ເຮັດໄດ້`,
                confirmLabel: "ໝາຍ",
              });
              if (ok) holdRef.current?.requestSubmit();
            }}
            className="inline-flex h-6 items-center gap-1 rounded bg-amber-600 px-2 text-[10px] font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
          >
            {holding ? <LoaderCircle className="size-3 animate-spin" /> : null}
            ບັນທຶກ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setOpen(false); setReason(""); }}
            className="h-6 px-1 text-[10px] text-slate-400 hover:text-slate-700"
          >
            ຍົກເລີກ
          </button>
        </span>
      )}
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
      <form ref={holdRef} action={holdAction} className="hidden">
        <input type="hidden" name="workflow" value="repair" />
        <input type="hidden" name="job_code" value={code} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="reason" value={reason} />
      </form>
    </span>
  );
}
