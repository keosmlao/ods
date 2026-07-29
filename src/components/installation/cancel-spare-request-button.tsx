"use client";

import { deleteSpareRequest } from "@/app/actions/installation";
import { UndoButton } from "@/components/checking/undo-button";

export function CancelInstallSpareRequestButton({
  docNo,
  code,
  variant = "icon",
}: {
  docNo: string;
  code: string;
  variant?: "button" | "icon";
}) {
  return (
    <UndoButton
      variant={variant}
      label="ລົບໃບຂໍເບີກ"
      buttonLabel="ລົບ"
      title="ລົບໃບຂໍເບີກ?"
      message={
        <>
          ໃບຂໍເບີກ <b className="text-slate-700">{docNo}</b> ຈະຖືກລົບ
          ແລະ ອາໄຫຼ່ຈະກັບໄປລໍຖ້າຂໍເບີກໃໝ່
        </>
      }
      action={() => deleteSpareRequest(docNo, code)}
    />
  );
}
