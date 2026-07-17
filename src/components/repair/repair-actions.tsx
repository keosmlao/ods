"use client";
import { startRepair, undoFinishRepair, undoStartRepair } from "@/app/actions/repair";
import { UndoButton } from "@/components/checking/undo-button";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useTransition } from "react";

/** ປຸ່ມ "ເລີ່ມສ້ອມແປງ" — ods ຖາມຢືນຢັນດ້ວຍ Swal ກ່ອນ (home_repair.html) */
export function StartRepairButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <Button
        tone="primary"
        size="sm"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ເລີ່ມສ້ອມແປງ?",
            message: (
              <>
                ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຈະຖືກຍ້າຍໄປ &quot;ກຳລັງສ້ອມແປງ&quot; ແລະ ເລີ່ມຈັບເວລາ
              </>
            ),
            confirmLabel: "ເລີ່ມສ້ອມແປງ",
          });
          if (!ok) return;
          start(() => void startRepair(code));
        }}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        ເລີ່ມສ້ອມແປງ
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
  return (
    <UndoButton
      variant={variant}
      buttonLabel={buttonLabel}
      label="ຍົກເລີກເລີ່ມສ້ອມແປງ"
      title="ຍົກເລີກ ເລີ່ມສ້ອມແປງ?"
      message={
        <>
          ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຈະກັບໄປ &quot;ລໍຖ້າສ້ອມແປງ&quot; ແລະ ຢຸດຈັບເວລາ.
          ອາໄຫຼ່ ແລະ ໃບເບີກທີ່ອອກໄປແລ້ວຍັງຢູ່ຄືເກົ່າ.
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
  return (
    <UndoButton
      variant={variant}
      buttonLabel={buttonLabel}
      label="ຍົກເລີກສຳເລັດການສ້ອມແປງ"
      title="ຍົກເລີກສຳເລັດການສ້ອມແປງ?"
      message={
        <>
          ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຈະຖືກດຶງອອກຈາກ &quot;ລໍຖ້າສົ່ງຄືນ&quot; ກັບມາ
          &quot;ກຳລັງສ້ອມແປງ&quot;. ບັນທຶກການສ້ອມ (ໝາຍເຫດຂອງຊ່າງ) ຍັງຢູ່ຄືເກົ່າ.
        </>
      }
      action={() => undoFinishRepair(code)}
    />
  );
}
