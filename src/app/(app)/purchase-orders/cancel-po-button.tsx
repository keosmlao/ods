"use client";
import { cancelPoOrder, type PurchaseState } from "@/app/actions/purchase";
import { ErrorBox } from "@/components/ui";
import { LoaderCircle, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";

/**
 * ຍົກເລີກໃບສັ່ງຊື້ — **ລຶບໃບອອກຈາກ ERP** (ERP ບໍ່ໃຊ້ທຸງ is_cancel ຈຶ່ງຕິດທຸງບໍ່ໄດ້).
 *
 * ບັງຄັບໃສ່**ເຫດຜົນ** ເພາະການລຶບຖອນຄືນບໍ່ໄດ້ ແລະ ຄົນຕໍ່ໄປຕ້ອງຮູ້ວ່າເປັນຫຍັງ
 * (ເຫດຜົນຖືກບັນທຶກໃສ່ timeline ຂອງວຽກ). ໃຊ້ <dialog> ຄືກ່ອງອື່ນຂອງລະບົບ.
 */
export function CancelPoButton({ poNo, back }: { poNo: string; back?: string }) {
  const [state, action, pending] = useActionState<PurchaseState, FormData>(cancelPoOrder, {});
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  return (
    <>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        <X className="size-3.5" />
        ຍົກເລີກ PO
      </button>

      <dialog ref={ref} className="w-[min(92vw,28rem)] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/40">
        <form action={action} className="space-y-3 p-5">
          <input type="hidden" name="po_no" value={poNo} />
          {back && <input type="hidden" name="back" value={back} />}
          <h2 className="text-sm font-bold text-slate-700">ຍົກເລີກໃບສັ່ງຊື້ {poNo}?</h2>
          <p className="text-xs text-slate-500">
            ໃບຈະຖືກ**ລຶບອອກຈາກ ERP** (ພ້ອມໃບອະນຸມັດ ຖ້າມີ) ແລະ ຖອນຄືນບໍ່ໄດ້ — ອອກ PO ໃໝ່ໄດ້ພາຍຫຼັງ.
            ຖ້າຮັບເຂົ້າສາງໄປແລ້ວ ຈະຍົກເລີກບໍ່ໄດ້.
          </p>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">ເຫດຜົນ</span>
            <input
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              placeholder="ຕົວຢ່າງ: ຜູ້ສະໜອງບໍ່ມີເຄື່ອງ / ສັ່ງຜິດລາຍການ"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ປິດ
            </button>
            <button
              type="submit"
              disabled={reason.trim().length < 3 || pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              ຍົກເລີກ PO
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
