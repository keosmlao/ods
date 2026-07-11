"use client";
import { loadSpareParts } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import { Download, LoaderCircle } from "lucide-react";
import { useTransition } from "react";

/**
 * ດຶງອາໄຫຼ່ໃໝ່ຈາກ sparepart_list ເຂົ້າ ic_inventory (ods: /loadspa).
 * ods ຍິງ POST ໂດຍບໍ່ຖາມ — ຢູ່ນີ້ຖາມຢືນຢັນກ່ອນ (useConfirm ແທນ window.confirm).
 */
export function LoadSparePartsButton() {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ດຶງລາຍການອາໄຫຼ່?",
            message: "ອາໄຫຼ່ໃໝ່ທີ່ຍັງບໍ່ມີໃນສາງຈະຖືກເພີ່ມເຂົ້າລາຍການ (ຂອງເກົ່າບໍ່ຖືກແກ້)",
            confirmLabel: "ດຶງລາຍການ",
          })
          if (!ok) return;
          start(() => void loadSpareParts());
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-500 px-3 text-xs font-medium text-white transition hover:bg-sky-600 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        ດືງລາຍການອາໄຫຼ່
      </button>
    </>
  );
}
