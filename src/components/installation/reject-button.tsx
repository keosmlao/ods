"use client";
import { rejectJobAction } from "@/app/actions/job-reject";
import { Button, inputClass } from "@/components/ui";
import type { Workflow } from "@/lib/commission";
import { LoaderCircle, ThumbsDown, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ປະຕິເສດງານ ພ້ອມ **ເຫດຜົນ** — ຈາກເວັບ (ແອັບມືຖືເຮັດອັນດຽວກັນຜ່ານ /api/mobile).
 *
 * ແຕ່ກ່ອນປຸ່ມ "ບໍ່ຮັບ" ຄືນງານໄປຄິວຈັດຊ່າງ **ໂດຍບໍ່ຖາມເຫດຜົນ ແລະ ບໍ່ແຈ້ງໃຜ**
 * ⇒ CS ເຫັນງານເດັ້ງກັບມາໃນຄິວ ໂດຍບໍ່ຮູ້ວ່າຍ້ອນຫຍັງ ແລະ ຈັດໃຫ້ຊ່າງຄົນເກົ່າຄືນອີກໄດ້.
 * ດຽວນີ້ເຫດຜົນຖືກເກັບ (ods_job_reject) ແລະ ແຈ້ງເຕືອນເຖິງ CS ທັນທີ.
 */
export function RejectButton({
  workflow,
  code,
  className = "h-8 px-3 text-xs",
}: {
  workflow: Workflow;
  code: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  /**
   * ── ອອກແບບປຸ່ມໃໝ່ ──
   * ເກົ່າ: "ຮັບງານ" (ຂຽວ) ກັບ "ບໍ່ຮັບ" (ແດງ) ນ້ຳໜັກ **ເທົ່າກັນ** ⇒ ຕາເຫັນສອງທາງເລືອກ
   * ທີ່ດູສຳຄັນເທົ່າກັນ ທັ້ງທີ່ຄວາມຈິງ "ຮັບງານ" ຄືສິ່ງທີ່ເຮັດເກືອບທຸກເທື່ອ ແລະ ການປະຕິເສດ
   * ຄື**ຂໍ້ຍົກເວັ້ນ** ທີ່ຕ້ອງມີເຫດຜົນ (ງານກັບເຂົ້າຄິວ · CS ຕ້ອງຈັດຊ່າງໃໝ່).
   * ໃໝ່: ປະຕິເສດເປັນ **ປຸ່ມຮອງ** (ຂອບເທົາ · ຕົວໜັງສືເທົາ · ຂຶ້ນແດງເມື່ອຊີ້) ⇒ ຕາໄປທີ່
   * "ຮັບງານ" ກ່ອນ ແລະ ຄົນຈະບໍ່ກົດປະຕິເສດໂດຍບັງເອີນ.
   * ຟອມເຫດຜົນຍ້າຍເປັນ **modal** — ຊ່ອງພິມ 44px ໃນຕາຕະລາງ ພິມເຫດຜົນຈິງບໍ່ໄດ້.
   */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ປະຕິເສດງານນີ້ (ຕ້ອງມີເຫດຜົນ)"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 ${className}`}
      >
        <ThumbsDown className="size-3.5" />
        ບໍ່ຮັບ
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
            <TriangleAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">ບໍ່ຮັບງານ {code}?</h2>
            <p className="mt-1 text-xs text-slate-500">
              ງານຈະ<b>ກັບເຂົ້າຄິວຈັດຊ່າງ</b> ແລະ CS ຈະໄດ້ຮັບແຈ້ງເຕືອນພ້ອມເຫດຜົນ
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError("");
            }}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-1 block text-xs font-semibold text-slate-600">ເຫດຜົນ (ບັງຄັບ)</label>
        <input
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="ເຊັ່ນ: ຕິດງານອື່ນມື້ນີ້, ຢູ່ໄກເກີນ, ບໍ່ຖະນັດເຄື່ອງລຸ້ນນີ້..."
          className={inputClass}
        />
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button tone="neutral" onClick={() => setOpen(false)} className="h-9 text-xs">
            ກັບຄືນ
          </Button>
          <Button
            tone="danger"
            className="h-9 text-xs"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                const result = await rejectJobAction(workflow, code, reason);
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
            ຢືນຢັນບໍ່ຮັບງານ
          </Button>
        </div>
      </div>
    </div>
  );
}
