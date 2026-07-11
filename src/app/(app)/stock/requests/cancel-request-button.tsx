"use client";

import { deleteRequest } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, X } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";

/** ປຸ່ມສົ່ງຟອມ — ໝູນວົງກົມຕອນກຳລັງລຶບ */
function Submit({ onAsk }: { onAsk: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onAsk}
      disabled={pending}
      className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#DE3163] px-2.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-3 animate-spin" /> : <X className="size-3" />}
      ຍົກເລີກ
    </button>
  );
}

/** ຍົກເລີກໃບຂໍເບີກ (ods: /del_request/<product_code>/<doc_no>) — ຢືນຢັນກ່ອນລຶບ */
export function CancelRequestButton({ docNo, productCode }: { docNo: string; productCode: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  async function confirm() {
    const ok = await ask({
      title: "ຍົກເລີກໃບຂໍເບີກ?",
      message: `ໃບຂໍເບີກ ${docNo} ຈະຖືກລຶບອອກ ແລະ ເຄື່ອງຈະກັບໄປລໍຖ້າຂໍເບີກໃໝ່`,
      confirmLabel: "ຍົກເລີກໃບຂໍເບີກ",
      cancelLabel: "ບໍ່ແມ່ນ",
      tone: "danger",
    });
    if (ok) formRef.current?.requestSubmit();
  }

  return (
    <>
      {dialog}
      <form ref={formRef} action={deleteRequest}>
        <input type="hidden" name="product_code" value={productCode} />
        <input type="hidden" name="doc_no" value={docNo} />
        <Submit onAsk={confirm} />
      </form>
    </>
  );
}
