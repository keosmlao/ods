"use client";
import { cancelChecking, startCheck } from "@/app/actions/checking";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useTransition } from "react";

/** ປຸ່ມ "ເລີ່ມກວດເຊັກ" — ods ຖາມຢືນຢັນດ້ວຍ Swal ກ່ອນ */
export function StartCheckButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <Button
        tone="primary"
        disabled={pending}
        className="h-8 px-3 text-xs"
        onClick={async () => {
          const ok = await ask({
            title: "ເລີ່ມກວດເຊັກ?",
            message: (
              <>
                ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຈະຖືກຍ້າຍໄປ &quot;ກຳລັງກວດເຊັກ&quot; ແລະ ເລີ່ມຈັບເວລາ
              </>
            ),
            confirmLabel: "ເລີ່ມກວດເຊັກ",
          });
          if (!ok) return;
          start(() => void startCheck(code));
        }}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        ເລີ່ມກວດເຊັກ
      </Button>
    </>
  );
}

/**
 * ປຸ່ມ "ຍົກເລີກ" — ຍົກເລີກການກວດເຊັກທີ່ບັນທຶກໄປແລ້ວ (ods: cancelchecking).
 * ໝາຍເຫດ: ຍັງບໍ່ທັນຖືກໃສ່ໃນໜ້າ /checking — ເກັບໄວ້ຄູ່ກັບ action cancelChecking()
 * ເພາະເປັນຟັງຊັນທີ່ຍ້າຍມາຈາກ ods ຄົບແລ້ວ ພຽງແຕ່ຍັງບໍ່ໄດ້ຕໍ່ເຂົ້າໜ້າຈໍ.
 */
export function CancelCheckButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="button"
        title="ຍົກເລີກການກວດເຊັກ"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ຍົກເລີກການກວດເຊັກ?",
            message: (
              <>
                ຜົນກວດເຊັກຂອງໃບ <b className="text-slate-700">#{code}</b> ຈະຖືກລົບ ແລະ ວຽກກັບໄປຂັ້ນ &quot;ກຳລັງກວດເຊັກ&quot;
              </>
            ),
            confirmLabel: "ຍົກເລີກການກວດ",
            cancelLabel: "ບໍ່",
            tone: "danger",
          });
          if (!ok) return;
          start(() => void cancelChecking(code));
        }}
        className="mx-auto grid size-7 place-items-center rounded-full text-[#DE3163] transition hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </>
  );
}
