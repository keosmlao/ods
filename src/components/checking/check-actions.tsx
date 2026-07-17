"use client";
import { cancelChecking, startCheck, undoStartCheck } from "@/app/actions/checking";
import { UndoButton } from "@/components/checking/undo-button";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

/** ປຸ່ມ "ເລີ່ມກວດເຊັກ" — ods ຖາມຢືນຢັນດ້ວຍ Swal ກ່ອນ */
export function StartCheckButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <div className="flex flex-col items-start gap-1">
        <Button
          tone="primary"
          size="sm"
          disabled={pending}
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
            setError(null);
            // startCheck redirect ເມື່ອສຳເລັດ · ຄືນ { error } ເມື່ອຂັ້ນຕອນຖືກກັນ
            start(async () => {
              const res = await startCheck(code);
              if (res?.error) setError(res.error);
            });
          }}
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          ເລີ່ມກວດເຊັກ
        </Button>
        {error && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
            <AlertTriangle className="size-3 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * ປຸ່ມ "ຍົກເລີກເລີ່ມກວດເຊັກ" — ກົດ "ເລີ່ມກວດເຊັກ" ຜິດໃບ ໃຫ້ຖອນຄືນໄດ້.
 * ວຽກກັບໄປແທັບ "ລໍຖ້າກວດເຊັກ". ກົດເກນຈິງກວດຢູ່ server (undoStartCheck).
 */
export function UndoStartCheckButton({
  code,
  variant,
  buttonLabel,
}: {
  code: string;
  variant?: "button" | "icon";
  buttonLabel?: string;
}) {
  return (
    <UndoButton
      variant={variant}
      buttonLabel={buttonLabel}
      label="ຍົກເລີກເລີ່ມກວດເຊັກ"
      title="ຍົກເລີກ ເລີ່ມກວດເຊັກ?"
      message={
        <>
          ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຈະກັບໄປ &quot;ລໍຖ້າກວດເຊັກ&quot; ແລະ ຢຸດຈັບເວລາ
        </>
      }
      action={() => undoStartCheck(code)}
    />
  );
}

/**
 * ປຸ່ມ "ຍົກເລີກຜົນກວດເຊັກ" — ລ້າງຜົນກວດທີ່ບັນທຶກຜິດ (ods: cancelchecking).
 *
 * server ຈະປະຕິເສດ ຖ້າວຽກຍ້າຍໄປຂັ້ນຕໍ່ໄປແລ້ວ (ໃບຂໍເບີກ / ໃບເບີກ / ໃບສະເໜີລາຄາ /
 * ເລີ່ມສ້ອມແປງ / ໃບຮັບເງິນ / ສົ່ງຄືນແລ້ວ) ພ້ອມບອກເລກທີເອກະສານທີ່ກີດຂວາງ.
 */
export function CancelCheckButton({
  code,
  variant,
  buttonLabel,
}: {
  code: string;
  variant?: "button" | "icon";
  buttonLabel?: string;
}) {
  return (
    <UndoButton
      variant={variant}
      buttonLabel={buttonLabel}
      label="ຍົກເລີກສຳເລັດການກວດເຊັກ"
      title="ຍົກເລີກສຳເລັດການກວດເຊັກ?"
      message={
        <>
          ຜົນກວດເຊັກຂອງໃບ <b className="text-slate-700">#{code}</b> (ອາການທີ່ຊ່າງວິເຄາະ ແລະ ອາໄຫຼ່ທີ່ເລືອກ) ຈະຖືກລ້າງ
          ແລະ ວຽກກັບໄປ &quot;ກຳລັງກວດເຊັກ&quot; ເພື່ອບັນທຶກຄືນໃໝ່. ອາໄຫຼ່ທີ່ເລືອກໄວ້ຈະກັບເຂົ້າກະຕ່າໃຫ້ອັດຕະໂນມັດ.
        </>
      }
      action={() => cancelChecking(code)}
    />
  );
}
