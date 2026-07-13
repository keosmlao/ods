"use client";
import { deleteService } from "@/app/actions/service-delete";
import { Button, inputClass } from "@/components/ui";
import { LoaderCircle, Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ລຶບໃບຮັບເຄື່ອງ — **ຜູ້ຈັດການເທົ່ານັ້ນ ແລະ ຍ້ອນຄືນບໍ່ໄດ້**.
 *
 * ບອກຄວາມຈິງໃຫ້ຄົນກົດຮູ້ກ່ອນ: ເອກະສານ (ໃບສະເໜີລາຄາ · ໃບເບີກ · ໃບຮັບເງິນ) ຖືກລຶບຕາມ
 * ແລະ **ສະຕັອກ ERP ທີ່ຕັດໄປແລ້ວ ບໍ່ຄືນມາ** (ເບິ່ງ actions/service-delete.ts).
 * ບັງຄັບໃສ່ເຫດຜົນ — ມັນຖືກເກັບເປັນຫຼັກຖານໃສ່ chatter ຂອງລູກຄ້າ.
 */
export function ServiceDeleteButton({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        title="ລຶບໃບຮັບເຄື່ອງ (ຜູ້ຈັດການ)"
        onClick={() => setOpen(true)}
        className="text-slate-400 hover:text-red-600"
      >
        <Trash2 className="size-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                <TriangleAlert className="size-5" />
              </span>
              <div>
                <h2 className="font-bold text-slate-800">ລຶບໃບຮັບເຄື່ອງ #{code}?</h2>
                <p className="mt-1 text-xs text-slate-500">ຍ້ອນຄືນບໍ່ໄດ້</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <ul className="mb-3 space-y-1 rounded-lg bg-red-50 p-3 text-xs text-red-800">
              <li>· ໃບສະເໜີລາຄາ · ໃບຂໍເບີກ · ໃບເບີກ · ໃບຮັບເງິນ ຂອງໃບນີ້ <b>ຖືກລຶບຕາມ</b></li>
              <li>· <b>ສະຕັອກ ERP ທີ່ຕັດໄປແລ້ວ ບໍ່ຄືນມາ</b> — ອາໄຫຼ່ຈະຫາຍຈາກສາງໂດຍບໍ່ມີເອກະສານ</li>
              <li>· ຢາກໃຫ້ງານອອກຈາກຄິວແຕ່ຮັກສາປະຫວັດ ⇒ ໃຊ້ &quot;ຍົກເລີກງານ&quot; ແທນ</li>
            </ul>

            <label className="mb-1 block text-xs font-semibold text-slate-600">ເຫດຜົນທີ່ລຶບ (ເກັບເປັນຫຼັກຖານ)</label>
            <input
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="ເຊັ່ນ: ໃບທົດລອງ, ລົງຊ້ຳ..."
              className={inputClass}
            />
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button tone="neutral" onClick={() => setOpen(false)} className="h-9 text-xs">
                ຍົກເລີກ
              </Button>
              <Button
                tone="danger"
                disabled={pending || reason.trim().length < 3}
                className="h-9 text-xs"
                onClick={() =>
                  start(async () => {
                    const result = await deleteService(code, reason);
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
                ລຶບຖາວອນ
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
