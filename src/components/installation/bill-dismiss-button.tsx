"use client";
import { dismissBill, restoreBill } from "@/app/actions/bill-dismiss";
import { Button, inputClass } from "@/components/ui";
import { CheckCircle2, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ໝາຍວ່າ "ບິນນີ້ຄົບແລ້ວ" ⇒ ອອກຈາກຄິວ "ບິນຄ້າງອອກໃບງານ".
 * ບັງຄັບໃສ່ເຫດຜົນ (ຫຼັກຖານ) ແລະ **ຍົກເລີກໄດ້** — ບໍ່ແມ່ນການລຶບຂໍ້ມູນ.
 */
export function BillDismissButton({ docNo }: { docNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ໝາຍວ່າຄົບແລ້ວ — ບໍ່ຕ້ອງເປີດໃບງານ"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        <CheckCircle2 className="size-3.5" />
        ຄົບແລ້ວ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-slate-800">ໝາຍບິນ {docNo} ວ່າຄົບແລ້ວ</h2>
                <p className="mt-1 text-xs text-slate-500">ບິນນີ້ຈະບໍ່ຂຶ້ນຄິວອີກ — ຍົກເລີກໄດ້ພາຍຫຼັງ</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <label className="mb-1 block text-xs font-semibold text-slate-600">ເຫດຜົນ (ເກັບເປັນຫຼັກຖານ)</label>
            <input
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="ເຊັ່ນ: ລູກຄ້າຕິດເອງ, ຍົກເລີກ, ຕິດໄປແລ້ວແຕ່ບໍ່ໄດ້ເປີດໃບງານ..."
              className={inputClass}
            />
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button tone="neutral" onClick={() => setOpen(false)} className="h-9 text-xs">
                ຍົກເລີກ
              </Button>
              <Button
                tone="success"
                disabled={pending || reason.trim().length < 3}
                className="h-9 text-xs"
                onClick={() =>
                  start(async () => {
                    const result = await dismissBill(docNo, reason);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                {pending && <LoaderCircle className="size-3.5 animate-spin" />}
                ໝາຍວ່າຄົບແລ້ວ
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** ຍົກເລີກການໝາຍ — ບິນກັບຂຶ້ນຄິວຄືເກົ່າ */
export function BillRestoreButton({ docNo }: { docNo: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await restoreBill(docNo);
          router.refresh();
        })
      }
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
      ເອົາກັບຄິວ
    </button>
  );
}
