"use client";
import { withdrawRequestOrder } from "@/app/actions/purchase";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ຖອນໃບຂໍສັ່ງຊື້ຄືນ — ທາງອອກຂອງການ "ກົດຜິດ" ທີ່ລະບົບເກົ່າບໍ່ມີ.
 * ພໍກົດ "ສັ່ງຊື້" ໃນ ods ແລ້ວ ແຖວອາໄຫຼ່ຄາ status=7 ຈົນກວ່າຜູ້ອະນຸມັດຈະປະຕິເສດໃຫ້.
 * ອອກໃບສັ່ງຊື້ (SPR) ໄປແລ້ວ ຖອນບໍ່ໄດ້ — server ຈະປະຕິເສດ ພ້ອມບອກເລກໃບທີ່ຂວາງຢູ່.
 */
export function WithdrawButton({ docNo, item }: { docNo: string; item: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="button"
        title="ຖອນໃບຂໍສັ່ງຊື້ຄືນ"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ຖອນໃບຂໍສັ່ງຊື້ຄືນ?",
            message: (
              <>
                ໃບຂໍສັ່ງຊື້ <b className="text-slate-700">{docNo}</b> ຈະຖືກປິດ ແລະ ອາໄຫຼ່ກັບໄປລໍຖ້າການສັ່ງຊື້ໃໝ່
                {item && <span className="mt-1 block text-slate-500">{item}</span>}
              </>
            ),
            confirmLabel: "ຖອນຄືນ",
            cancelLabel: "ບໍ່",
            tone: "danger",
          });
          if (!ok) return;
          setError("");
          start(async () => {
            const state = await withdrawRequestOrder(docNo);
            if (state.error) setError(state.error);
          });
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
        ຖອນຄືນ
      </button>
      {error && <span className="mt-1 block text-[10px] font-medium text-red-600">{error}</span>}
    </>
  );
}
