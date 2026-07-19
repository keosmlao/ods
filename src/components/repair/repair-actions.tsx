"use client";
import { startRepair, undoFinishRepair, undoStartRepair } from "@/app/actions/repair";
import { UndoButton } from "@/components/checking/undo-button";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useTransition } from "react";

/** ປຸ່ມ "ເລີ່ມສ້ອມແປງ" — ods ຖາມຢືນຢັນດ້ວຍ Swal ກ່ອນ (home_repair.html) */
export function StartRepairButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const t = useDict().repairActions;

  return (
    <>
      {dialog}
      <Button
        tone="primary"
        size="sm"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: t.startRepairConfirmTitle,
            message: (
              <>
                {t.receiptWord} <b className="text-slate-700">#{code}</b> {t.startRepairMoveTo} &quot;ກຳລັງສ້ອມແປງ&quot; {t.startRepairAndTimer}
              </>
            ),
            confirmLabel: t.startRepair,
          });
          if (!ok) return;
          start(() => void startRepair(code));
        }}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        {t.startRepair}
      </Button>
    </>
  );
}

/**
 * ປຸ່ມ "ຍົກເລີກເລີ່ມສ້ອມແປງ" — ກົດຜິດໃບ ໃຫ້ຖອນຄືນໄດ້.
 * ວຽກກັບໄປ "ລໍຖ້າສ້ອມແປງ" ໂດຍ **ບໍ່** ແຕະອາໄຫຼ່ ຫຼື ໃບເບີກໃດເລີຍ.
 */
export function UndoStartRepairButton({
  code,
  variant,
  buttonLabel,
}: {
  code: string;
  variant?: "button" | "icon";
  buttonLabel?: string;
}) {
  const t = useDict().repairActions;
  return (
    <UndoButton
      variant={variant}
      buttonLabel={buttonLabel}
      label={t.undoStartRepairLabel}
      title={t.undoStartRepairTitle}
      message={
        <>
          {t.receiptWord} <b className="text-slate-700">#{code}</b> {t.undoStartRepairReturnTo} &quot;ລໍຖ້າສ້ອມແປງ&quot; {t.undoStartRepairTail}
        </>
      }
      action={() => undoStartRepair(code)}
    />
  );
}

/**
 * ປຸ່ມ "ຍົກເລີກ ຈົບການສ້ອມແປງ" — ດຶງວຽກທີ່ກົດຈົບໄວເກີນກັບມາສ້ອມຕໍ່.
 * server ປະຕິເສດ ຖ້າສົ່ງຄືນລູກຄ້າແລ້ວ ຫຼື ອອກໃບຮັບເງິນແລ້ວ.
 */
export function UndoFinishRepairButton({
  code,
  variant,
  buttonLabel,
}: {
  code: string;
  variant?: "button" | "icon";
  buttonLabel?: string;
}) {
  const t = useDict().repairActions;
  return (
    <UndoButton
      variant={variant}
      buttonLabel={buttonLabel}
      label={t.undoFinishRepairLabel}
      title={t.undoFinishRepairTitle}
      message={
        <>
          {t.receiptWord} <b className="text-slate-700">#{code}</b> {t.undoFinishRepairPullFrom} &quot;ລໍຖ້າສົ່ງຄືນ&quot; {t.undoFinishRepairBackTo}
          &quot;ກຳລັງສ້ອມແປງ&quot;. {t.undoFinishRepairTail}
        </>
      }
      action={() => undoFinishRepair(code)}
    />
  );
}
