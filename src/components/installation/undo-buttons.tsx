"use client";
import { reopenJob, undoFinishInstall, undoStartInstall } from "@/app/actions/installation";
import { UndoButton } from "@/components/checking/undo-button";

/**
 * ປຸ່ມຖອນຄືນຂອງຝັ່ງຕິດຕັ້ງ (ຄູ່ກັບ components/repair/repair-actions ຂອງຝັ່ງສ້ອມ).
 *
 * ⚠️ **ຕ້ອງເປັນ client component** — ໜ້າ /installations/work ກັບ /installations/close
 * ເປັນ server component ແລ້ວສົ່ງ `action={() => undoStartInstall(row.code)}` ລົງມາ
 * ໃຫ້ UndoButton ໂດຍກົງ. React ສົ່ງ **ຟັງຊັນ** ຂ້າມ server → client ບໍ່ໄດ້
 * ⇒ ໜ້າພັງທັນທີທີ່ເປີດແທັບນັ້ນ ("Functions cannot be passed directly to Client Components").
 * ຫໍ່ໄວ້ໃນ client component ແບບນີ້ ⇒ closure ເກີດຢູ່ຝັ່ງ browser ບໍ່ຕ້ອງ serialize.
 */

export function UndoStartInstallButton({ code, variant }: { code: string; variant?: "button" | "icon" }) {
  return (
    <UndoButton
      variant={variant}
      label="ຖອນ ເລີ່ມຕິດຕັ້ງ"
      title="ຖອນ ເລີ່ມຕິດຕັ້ງ?"
      message={
        <>
          ງານ <b className="text-slate-700">#{code}</b> ຈະກັບໄປ &quot;ລໍຖ້າຊ່າງຕິດຕັ້ງ&quot; ແລະ ຢຸດຈັບເວລາ.
          ອາໄຫຼ່ ແລະ ໃບເບີກທີ່ອອກໄປແລ້ວຍັງຢູ່ຄືເກົ່າ.
        </>
      }
      action={() => undoStartInstall(code)}
    />
  );
}

export function UndoFinishInstallButton({ code, variant }: { code: string; variant?: "button" | "icon" }) {
  return (
    <UndoButton
      variant={variant}
      label="ຖອນ ຕິດຕັ້ງສຳເລັດ"
      title="ຖອນ ຕິດຕັ້ງສຳເລັດ?"
      message={
        <>
          ງານ <b className="text-slate-700">#{code}</b> ຈະກັບໄປ &quot;ກຳລັງຕິດຕັ້ງ&quot;. ຖອນບໍ່ໄດ້
          ຖ້າລູກຄ້າຕອບແບບສອບຖາມໄປແລ້ວ.
        </>
      }
      action={() => undoFinishInstall(code)}
    />
  );
}

export function ReopenJobButton({ code, variant }: { code: string; variant?: "button" | "icon" }) {
  return (
    <UndoButton
      variant={variant}
      label="ເປີດງານຄືນ"
      title="ເປີດງານຄືນ?"
      message={
        <>
          ງານ <b className="text-slate-700">#{code}</b> ຈະກັບໄປ &quot;ລໍຖ້າປິດງານ&quot;.
          ຄຳຕອບແບບສອບຖາມຂອງລູກຄ້າຍັງຢູ່ຄືເກົ່າ.
        </>
      }
      action={() => reopenJob(code)}
    />
  );
}
