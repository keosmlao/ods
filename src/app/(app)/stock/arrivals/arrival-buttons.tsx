"use client";
import { confirmSpareArrival, undoSpareArrival } from "@/app/actions/purchase";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { LoaderCircle, PackageCheck, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມ "ອາໄຫຼ່ມາຮອດແລ້ວ" — ທາງອອກຂອງຂັ້ນ 7 ທີ່ລະບົບເກົ່າບໍ່ເຄີຍມີ.
 * ກົດແລ້ວວຽກຕົກລົງຂັ້ນ 6 (ກຳລັງເບີກອາໄຫຼ່) ແລ້ວໄປໂຜ່ຢູ່ໜ້າ "ເບີກອາໄຫຼ່" ໃຫ້ສາງຈ່າຍຕໍ່.
 */
export function ArrivalButton({ code, item }: { code: string; item: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <Button
        tone="success"
        disabled={pending}
        className="h-8 px-3 text-xs"
        onClick={async () => {
          const ok = await ask({
            title: "ຢືນຢັນວ່າອາໄຫຼ່ມາຮອດແລ້ວ?",
            message: (
              <>
                ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຈະຍ້າຍໄປຂັ້ນ &quot;ກຳລັງເບີກອາໄຫຼ່&quot;
                ແລະ ໂຜ່ຢູ່ໜ້າ &quot;ເບີກອາໄຫຼ່&quot; ໃຫ້ສາງຈ່າຍໃຫ້ຊ່າງ
                {item && <span className="mt-1 block text-slate-500">{item}</span>}
              </>
            ),
            confirmLabel: "ອາໄຫຼ່ມາຮອດແລ້ວ",
          });
          if (!ok) return;
          setError("");
          start(async () => {
            const state = await confirmSpareArrival(code);
            if (state.error) setError(state.error);
          });
        }}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />}
        ອາໄຫຼ່ມາຮອດແລ້ວ
      </Button>
      {error && <span className="mt-1 block text-[10px] font-medium text-red-600">{error}</span>}
    </>
  );
}

/** ຖອນຄືນ — ກົດຜິດໃບແລ້ວດຶງວຽກກັບໄປລໍຖ້າອາໄຫຼ່ຕາມເກົ່າ */
export function UndoArrivalButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="button"
        title="ຖອນຄືນການຢືນຢັນ"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ຖອນຄືນການຢືນຢັນ?",
            message: (
              <>
                ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຈະກັບໄປຂັ້ນ &quot;ກຳລັງສັ່ງຊື້ອາໄຫຼ່&quot; ຄືເກົ່າ
              </>
            ),
            confirmLabel: "ຖອນຄືນ",
            cancelLabel: "ບໍ່",
            tone: "danger",
          });
          if (!ok) return;
          setError("");
          start(async () => {
            const state = await undoSpareArrival(code);
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
