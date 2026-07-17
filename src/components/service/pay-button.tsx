"use client";
import { METHOD_LABEL, recordServicePayment, type PayState } from "@/app/actions/service-payment";
import { ErrorBox } from "@/components/ui";
import { Banknote, LoaderCircle } from "lucide-react";
import { useActionState, useRef, useState } from "react";

/**
 * **ຮັບຊຳລະຄ່າສ້ອມ** — ບັນທຶກລົງ `ods_service_payment` (ບ່ອນດຽວທີ່ເງິນເຂົ້າຖືກບັນທຶກ).
 *
 * ຕັ້ງຍອດໃຫ້ເປັນ "ຄ້າງທັງໝົດ" ໄວ້ກ່ອນ ເພາະສ່ວນຫຼາຍຈ່າຍຄົບເທື່ອດຽວ — ຈ່າຍບາງສ່ວນ
 * ກໍ່ພິມທັບໄດ້ (server ກັນຮັບເກີນຍອດຄ້າງ). ບັນທຶກແລ້ວລົງ timeline ຂອງໃບ.
 */
export function PayButton({ job, due, today }: { job: string; due: number; today: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState(String(due));

  /** ຫຸ້ມ action ⇒ ປິດກ່ອງຫຼັງ server ຕອບວ່າສຳເລັດ (ບໍ່ໃຊ້ effect ທີ່ setState) */
  const [state, submit, pending] = useActionState<PayState, FormData>(async (prev, formData) => {
    const result = await recordServicePayment(prev, formData);
    if (result.ok) ref.current?.close();
    return result;
  }, {});


  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAmount(String(due));
          ref.current?.showModal();
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <Banknote className="size-3.5" />
        ຮັບເງິນ
      </button>

      <dialog ref={ref} className="w-[min(92vw,26rem)] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/40">
        <form action={submit} className="space-y-3 p-5">
          <input type="hidden" name="job" value={job} />
          <h2 className="text-sm font-bold text-slate-700">ຮັບຊຳລະ — ວຽກ {job}</h2>
          <p className="text-xs text-slate-500">
            ຄ້າງທັງໝົດ <b className="text-slate-700">{due.toLocaleString()}</b> ບາດ · ຮັບບາງສ່ວນກໍ່ໄດ້ (ພິມຍອດຈິງ)
          </p>
          {state.error && <ErrorBox>{state.error}</ErrorBox>}

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">ຍອດທີ່ຮັບ (ບາດ)</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min={0.01}
              max={due}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-right text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">ວັນທີຮັບ</span>
              <input
                name="paid_on"
                type="date"
                defaultValue={today}
                max={today}
                className="h-10 w-full rounded-lg border border-slate-300 px-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-slate-600">ຮັບເປັນ</span>
              <select
                name="method"
                defaultValue="cash"
                className="h-10 w-full rounded-lg border border-slate-300 px-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                {Object.entries(METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-slate-600">ເລກອ້າງອີງ (ສະລິບ / ໃບຮັບເງິນ)</span>
            <input
              name="reference"
              maxLength={100}
              placeholder="ບໍ່ມີກໍ່ໄດ້"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <input type="hidden" name="note" value="" />

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
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Banknote className="size-3.5" />}
              ບັນທຶກການຮັບເງິນ
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
