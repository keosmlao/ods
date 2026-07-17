"use client";

import { undoQc } from "@/app/actions/qc";
import { UndoButton } from "@/components/checking/undo-button";

export function UndoQcButton({
  workflow,
  code,
  variant,
}: {
  workflow: "repair" | "install";
  code: string;
  /** icon = ປຸ່ມນ້ອຍໃນຕາຕະລາງ · button = ປຸ່ມເຕັມ (ໜ້າລາຍລະອຽດ) */
  variant?: "button" | "icon";
}) {
  return (
    <UndoButton
      variant={variant}
      label="ຍົກເລີກ QC ຜ່ານ"
      title="ຍົກເລີກ QC ຜ່ານ?"
      message={
        <>
          ງານ <b className="text-slate-700">#{code}</b> ຈະກັບໄປ &quot;ລໍກວດຮັບຄຸນນະພາບ&quot; ເພື່ອແກ້ໄຂ ແລະກວດໃໝ່
        </>
      }
      action={() => undoQc(workflow, code)}
    />
  );
}
