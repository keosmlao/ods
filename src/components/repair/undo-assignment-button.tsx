"use client";

import { undoRepairAssignment } from "@/app/actions/repair";
import { UndoButton } from "@/components/checking/undo-button";

export function UndoRepairAssignmentButton({
  code,
  accepted = false,
  variant,
}: {
  code: string;
  accepted?: boolean;
  /** icon = ປຸ່ມນ້ອຍໃນຕາຕະລາງ · button = ປຸ່ມເຕັມ (ໜ້າລາຍລະອຽດ) */
  variant?: "button" | "icon";
}) {
  const label = accepted ? "ຍົກເລີກຊ່າງຮັບງານ" : "ຍົກເລີກການຈັດຊ່າງ";
  return (
    <UndoButton
      variant={variant}
      label={label}
      title={`${label}?`}
      message={
        <>
          ງານ <b className="text-slate-700">#{code}</b> ຈະກັບໄປຄິວກ່ອນໜ້າ ແລະຕ້ອງຈັດ/ຮັບງານໃໝ່
        </>
      }
      action={() => undoRepairAssignment(code)}
    />
  );
}
