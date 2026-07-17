"use client";
import { approveSprOrder, rejectSprOrder, type PurchaseState } from "@/app/actions/purchase";
import { useConfirm } from "@/components/confirm-dialog";
import { ErrorBox } from "@/components/ui";
import { Check, LoaderCircle, X } from "lucide-react";
import { useActionState, useRef } from "react";

/**
 * ຟອມອະນຸມັດໃບຂໍສະເໜີຊື້ — ອະນຸມັດ = ອອກ WPRA ລົງ ERP.
 * **ບໍ່ຖາມຜູ້ສະໜອງ** — ນະໂຍບາຍ (16-07-2026): ຜູ້ສະໜອງເລືອກຕອນ**ອອກ PO**
 * (ເມນູ "ໃບສັ່ງຊື້ (PO)" ຫຼື ອອກໃນ ERP ໂດຍກົງ). ປະຕິເສດ = ລຶບ SPR ອອກຈາກ ERP.
 */
/** `back` = ໜ້າທີ່ຈະກັບຄືນຫຼັງອະນຸມັດ (ໃຊ້ໄດ້ທັງໜ້າອະນຸມັດ ແລະ ໜ້າຂໍສັ່ງຊື້) */
export function ApproveSprForm({ sprNo, back }: { sprNo: string; back?: string }) {
  const [approveState, approve, approving] = useActionState<PurchaseState, FormData>(approveSprOrder, {});
  const [rejectState, reject, rejecting] = useActionState<PurchaseState, FormData>(rejectSprOrder, {});
  const approveRef = useRef<HTMLFormElement>(null);
  const rejectRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  return (
    <div className="space-y-3">
      {dialog}
      {(approveState.error || rejectState.error) && <ErrorBox>{approveState.error ?? rejectState.error}</ErrorBox>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={approving || rejecting}
          onClick={async () => {
            const ok = await ask({
              title: "ອະນຸມັດໃບຂໍຊື້?",
              message: `${sprNo} ຈະຖືກອະນຸມັດ (ອອກ WPRA ລົງ ERP) — ຂັ້ນຕໍ່ໄປ: ອອກໃບສັ່ງຊື້ + ເລືອກຜູ້ສະໜອງ`,
              confirmLabel: "ອະນຸມັດ",
            });
            if (ok) approveRef.current?.requestSubmit();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {approving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          ອະນຸມັດ
        </button>
        <button
          type="button"
          disabled={approving || rejecting}
          onClick={async () => {
            const ok = await ask({
              title: "ປະຕິເສດໃບຂໍຊື້?",
              message: `${sprNo} ຈະຖືກລຶບອອກຈາກ ERP — ວຽກກັບໄປດຳເນີນອາໄຫຼ່ໃໝ່`,
              confirmLabel: "ປະຕິເສດ",
              tone: "danger",
            });
            if (ok) rejectRef.current?.requestSubmit();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          {rejecting ? <LoaderCircle className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          ປະຕິເສດ
        </button>
      </div>

      <form ref={approveRef} action={approve} className="hidden">
        <input type="hidden" name="spr_no" value={sprNo} />
        {back && <input type="hidden" name="back" value={back} />}
      </form>
      <form ref={rejectRef} action={reject} className="hidden">
        <input type="hidden" name="spr_no" value={sprNo} />
        {back && <input type="hidden" name="back" value={back} />}
      </form>
    </div>
  );
}
