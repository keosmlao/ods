"use client";
import { startRepair } from "@/app/actions/repair";
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
        disabled={pending}
        className="h-8 px-3 text-xs"
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
