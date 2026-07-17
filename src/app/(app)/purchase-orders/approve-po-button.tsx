"use client";
import { approvePoOrder, type PurchaseState } from "@/app/actions/purchase";
import { useConfirm } from "@/components/confirm-dialog";
import { ErrorBox } from "@/components/ui";
import { Check, LoaderCircle } from "lucide-react";
import { useActionState, useRef } from "react";

/** ອະນຸມັດໃບສັ່ງຊື້ — ຂຽນ WPOA ລົງ ERP. ຫຼັງນີ້ລໍຜູ້ສະໜອງສົ່ງຂອງ + ສາງຮັບເຂົ້າ (sync ຈັບເອງ). */
/** `back` = ໜ້າກັບຄືນຫຼັງອະນຸມັດ (ໜ້າລາຍການ ຫຼື ໜ້າເອກະສານ) */
export function ApprovePoButton({ poNo, back }: { poNo: string; back?: string }) {
  const [state, action, pending] = useActionState<PurchaseState, FormData>(approvePoOrder, {});
  const formRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      <form ref={formRef} action={action}>
        <input type="hidden" name="po_no" value={poNo} />
        {back && <input type="hidden" name="back" value={back} />}
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: "ອະນຸມັດໃບສັ່ງຊື້?",
              message: `${poNo} ຈະຖືກອະນຸມັດ (ອອກ WPOA ລົງ ERP) — ຜູກພັນການສັ່ງຊື້ກັບຜູ້ສະໜອງ`,
              confirmLabel: "ອະນຸມັດ PO",
            });
            if (ok) formRef.current?.requestSubmit();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          ອະນຸມັດ PO
        </button>
      </form>
    </>
  );
}
