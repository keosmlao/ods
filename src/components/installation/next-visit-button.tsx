"use client";

import { scheduleInstallVisit } from "@/app/actions/installation";
import { CalendarClock, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ຮອບນີ້ຍັງບໍ່ຈົບ — ນັດເຂົ້າຮອບຕໍ່ໄປ** (ງານຕິດຕັ້ງທີ່ຕ້ອງໄປຫຼາຍມື້).
 *
 * ເມື່ອກ່ອນຊ່າງມີແຕ່ "ຈົບງານ" ຫຼື ປະໄວ້ງຽບໆ ⇒ ກົດຈົບທັງທີ່ຍັງບໍ່ຈົບ (QC ແລະ ການປະເມີນ
 * ຂອງລູກຄ້າເລີ່ມແລ່ນຜິດ) ຫຼື ງານຄາຢູ່ "ກຳລັງຕິດຕັ້ງ" ໂດຍບໍ່ມີໃຜຮູ້ວ່າຈະກັບໄປມື້ໃດ.
 * ປຸ່ມນີ້ປິດຮອບປັດຈຸບັນ ແລ້ວໃສ່ວັນນັດ ⇒ ງານຂຶ້ນຄິວປະຈຳວັນຂອງມື້ນັ້ນເອງ ໂດຍຂັ້ນບໍ່ຂະຍັບ.
 */
export function NextVisitButton({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setReason("");
          // ຄ່າຕັ້ງຕົ້ນ = ມື້ອື່ນ (ກໍລະນີພົບຫຼາຍທີ່ສຸດ)
          const tomorrow = new Date(Date.now() + 86_400_000);
          setDate(tomorrow.toISOString().slice(0, 10));
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-orange-400 bg-white px-3 text-xs font-semibold text-brand-orange-700 hover:bg-brand-orange-50"
      >
        <CalendarClock className="size-4" />
        ຍັງບໍ່ຈົບ — ນັດຮອບຕໍ່ໄປ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <h2 className="text-base font-bold text-slate-800">ນັດເຂົ້າໜ້າງານຮອບຕໍ່ໄປ</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                ໃບງານ {code} ຈະຄາຢູ່ຂັ້ນ “ກຳລັງຕິດຕັ້ງ” ຄືເກົ່າ — ບໍ່ນັບວ່າຈົບງານ
              </p>
            </div>

            <label className="block text-xs font-semibold text-slate-600">
              ວັນທີ່ຈະກັບໄປ
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-600"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-600">
              ຍັງບໍ່ຈົບຍ້ອນຫຍັງ
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="ຕົວຢ່າງ: ລໍງານໄຟຟ້າ · ຝົນຕົກ · ຂາດອາໄຫຼ່ · ລູກຄ້າຂໍເລື່ອນ"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
              />
            </label>

            {error && <p className="rounded-lg bg-brand-orange-50 px-3 py-2 text-xs text-brand-orange-700">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await scheduleInstallVisit(code, date, reason);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  })
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-orange-600 px-4 text-xs font-semibold text-white hover:bg-brand-orange-700 disabled:opacity-60"
              >
                {pending && <LoaderCircle className="size-3.5 animate-spin" />}
                ບັນທຶກນັດ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
