"use client";
import { deleteRequest } from "@/app/actions/stock";
import { UndoButton } from "@/components/checking/undo-button";

/**
 * ຍົກເລີກໃບຂໍເບີກ (ods: /del_request/<product_code>/<doc_no>) — ຢືນຢັນກ່ອນລຶບ.
 *
 * ໃຊ້ `UndoButton` ກາງອັນດຽວກັບປຸ່ມຖອນຄືນອື່ນ ⇒ ໄດ້ `variant="icon"` (ປຸ່ມນ້ອຍໃນຕາຕະລາງ)
 * ແລະ ຮູບແບບການຖາມຢືນຢັນ/ສະແດງ error ຄືກັນທັງລະບົບ.
 *
 * ບ່ອນທີ່ໃຊ້: ຄິວ "ກຳລັງເບີກອາໄຫຼ່" (/dashboard/status/repair/withdrawing)
 * — ໜ້າລາຍການ /stock/requests ຖືກລົບແລ້ວ (17-07-2026, ຊ້ຳກັບຄິວ).
 */
export function CancelRequestButton({
  docNo,
  productCode,
  variant,
}: {
  docNo: string;
  productCode: string;
  variant?: "button" | "icon";
}) {
  return (
    <UndoButton
      variant={variant}
      label="ຍົກເລີກໃບຂໍເບີກ"
      buttonLabel="ຍົກເລີກ"
      title="ຍົກເລີກໃບຂໍເບີກ?"
      message={
        <>
          ໃບຂໍເບີກ <b className="text-slate-700">{docNo}</b> ຈະຖືກລຶບອອກ ແລະ ເຄື່ອງຈະກັບໄປລໍຖ້າຂໍເບີກໃໝ່
        </>
      }
      action={async () => {
        const form = new FormData();
        form.set("product_code", productCode);
        form.set("doc_no", docNo);
        await deleteRequest(form);
        return {};
      }}
    />
  );
}
