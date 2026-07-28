"use client";
import { returnWithoutCharge } from "@/app/actions/return";
import { HandCoins, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

/**
 * ປຸ່ມ "ສົ່ງຄືນບໍ່ເກັບເງິນ" ຢູ່**ໃນຄິວ** — ບໍ່ຕ້ອງເຂົ້າໜ້າອອກໃບຮັບເງິນກ່ອນ.
 *
 * ວຽກທີ່ລູກຄ້າປະຕິເສດ (ບໍ່ແປງ/ບໍ່ເອົາ) ຄ້າງຄິວເປັນຮ້ອຍມື້ ເພາະທາງດຽວທີ່ປິດໄດ້
 * ຄືການອອກໃບຮັບເງິນ ຊຶ່ງບໍ່ກົງກັບຄວາມຈິງ ⇒ ຄົນເລີ່ຍບໍ່ປິດ.
 *
 * ⚠️ ນີ້ຄືການປິດງານ **ໂດຍບໍ່ເກັບເງິນ** ຈຶ່ງບັງຄັບໃສ່ເຫດຜົນ ແລະ ບັນທຶກລົງ chatter
 * (ໃຜປິດ · ຍ້ອນຫຍັງ). ດ່ານອາໄຫຼ່ຄ້າງກວດຢູ່ຝັ່ງ server.
 */
export function ReturnNoChargeButton({
  code,
  labels,
}: {
  code: string;
  labels: { action: string; title: string; hint: string; reason: string; confirm: string; cancel: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(returnWithoutCharge, {});
  const dialog = useRef<HTMLDivElement>(null);

  // ສຳເລັດ (ບໍ່ມີ error ຫຼັງ submit) ⇒ ປິດກ່ອງ — ແຖວຈະຫາຍໄປເອງຫຼັງ revalidate
  useEffect(() => {
    if (!pending && open && state && !state.error && dialog.current?.dataset.submitted === "1") {
      setOpen(false);
    }
  }, [pending, state, open]);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-600 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
      >
        <HandCoins className="size-3.5" />
        {labels.action}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            ref={dialog}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-800">{labels.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{labels.hint}</p>

            <form
              action={formAction}
              onSubmit={() => {
                if (dialog.current) dialog.current.dataset.submitted = "1";
              }}
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="pro_code" value={code} />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{labels.reason}</label>
                <input
                  name="reason"
                  autoFocus
                  required
                  minLength={3}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500"
                />
              </div>

              {state?.error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{state.error}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {pending && <LoaderCircle className="size-3.5 animate-spin" />}
                  {labels.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
