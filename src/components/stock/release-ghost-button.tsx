"use client";
import { releaseGhostPurchase, type PurchaseState } from "@/app/actions/purchase";
import { ErrorBox } from "@/components/ui";
import { LoaderCircle, Undo2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";

/**
 * **ຍົກເລີກສັ່ງຊື້ (ໃບຜີ)** — ວຽກທີ່ ODS ໝາຍວ່າ "ກຳລັງສັ່ງຊື້" ແຕ່ **ERP ບໍ່ມີໃບ**.
 *
 * ຂຶ້ນສະເພາະແຖວທີ່ tracking ຫາໃບຢູ່ ERP ບໍ່ພົບ (ບໍ່ດັ່ງນັ້ນຄົນຈະກົດຜິດໃສ່ວຽກທີ່ສັ່ງແທ້).
 * server ກວດ ERP ຄືນອີກເທື່ອກ່ອນປົດ — ພົບໃບໃດກໍ່ຕາມ ຈະປະຕິເສດພ້ອມບອກເລກໃບ.
 */
export function ReleaseGhostButton({ job }: { job: string }) {
  const [state, action, pending] = useActionState<PurchaseState, FormData>(releaseGhostPurchase, {});
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  return (
    <>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        title="ODS ວ່າກຳລັງສັ່ງຊື້ ແຕ່ ERP ບໍ່ມີໃບ — ປົດວຽກກັບໄປຂໍຊື້ໃໝ່"
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-50"
      >
        <Undo2 className="size-3" />
        ຍົກເລີກສັ່ງຊື້
      </button>

      <dialog ref={ref} className="w-[min(92vw,28rem)] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/40">
        <form action={action} className="space-y-3 p-5">
          <input type="hidden" name="job" value={job} />
          <h2 className="text-sm font-bold text-slate-700">ຍົກເລີກສັ່ງຊື້ຂອງວຽກ {job}?</h2>
          <p className="text-xs text-slate-500">
            ໃບຂໍຊື້ຂອງວຽກນີ້ <b>ບໍ່ມີຢູ່ ERP</b> ⇒ ບໍ່ມີໃຜສັ່ງຂອງ ແລະ ວຽກຈະຄ້າງຕະຫຼອດ.
            ກົດແລ້ວວຽກກັບໄປຂັ້ນ &ldquo;ດຳເນີນອາໄຫຼ່&rdquo; ເພື່ອຂໍຊື້ໃໝ່. ຖ້າ ERP ມີໃບແທ້ ລະບົບຈະປະຕິເສດເອງ.
          </p>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">ເຫດຜົນ</span>
            <input
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              placeholder="ຕົວຢ່າງ: ໃບບໍ່ໄດ້ລົງ ERP ຕັ້ງແຕ່ຕົ້ນ — ຂໍຊື້ໃໝ່"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
              ຍົກເລີກສັ່ງຊື້
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
