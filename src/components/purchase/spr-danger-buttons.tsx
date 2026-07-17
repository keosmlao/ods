"use client";
import { deleteSprOrder, unapproveSprOrder, type PurchaseState } from "@/app/actions/purchase";
import { useConfirm } from "@/components/confirm-dialog";
import { ErrorBox } from "@/components/ui";
import { LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { useActionState, useRef } from "react";

/**
 * **ຖອນການອະນຸມັດ · ລົບທັງໃບ** — ສອງທາງອອກຂອງໃບຂໍຊື້ທີ່ອະນຸມັດໄປແລ້ວ.
 *
 * ຖອນການອະນຸມັດ = ລຶບແຕ່ WPRA ⇒ ໃບກັບໄປ "ລໍອະນຸມັດ" (ອະນຸມັດຜິດໃບ)
 * ລົບທັງໃບ     = ລຶບ SPR + WPRA ⇒ ເທົ່າກັບບໍ່ເຄີຍຂໍຊື້ (ວຽກກັບໄປດຳເນີນອາໄຫຼ່ໃໝ່)
 *
 * ທັງສອງອັນ **ອອກ PO ໄປແລ້ວເຮັດບໍ່ໄດ້** — server ກວດຊ້ຳ ແລະ ບອກເລກ PO ທີ່ຂວາງຢູ່.
 */
export function SprDangerButtons({ sprNo, back }: { sprNo: string; back?: string }) {
  const [unapproveState, unapprove, unapproving] = useActionState<PurchaseState, FormData>(unapproveSprOrder, {});
  const [deleteState, remove, removing] = useActionState<PurchaseState, FormData>(deleteSprOrder, {});
  const unapproveRef = useRef<HTMLFormElement>(null);
  const deleteRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();
  const busy = unapproving || removing;
  const error = unapproveState.error ?? deleteState.error;

  return (
    <div className="space-y-2">
      {dialog}
      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const ok = await ask({
              title: "ຖອນການອະນຸມັດ?",
              message: `ໃບອະນຸມັດ (WPRA) ຂອງ ${sprNo} ຈະຖືກລຶບອອກຈາກ ERP — ໃບຂໍຊື້ຢູ່ຄືເກົ່າ ແລະ ກັບໄປລໍອະນຸມັດໃໝ່`,
              confirmLabel: "ຖອນການອະນຸມັດ",
              tone: "danger",
            });
            if (ok) unapproveRef.current?.requestSubmit();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          {unapproving ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          ຖອນການອະນຸມັດ
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const ok = await ask({
              title: "ລົບໃບຂໍຊື້ທັງໃບ?",
              message: `${sprNo} ພ້ອມໃບອະນຸມັດຂອງມັນ ຈະຖືກລຶບອອກຈາກ ERP ຖາວອນ — ເທົ່າກັບບໍ່ເຄີຍຂໍຊື້ ແລະ ວຽກຈະກັບໄປດຳເນີນອາໄຫຼ່ໃໝ່`,
              confirmLabel: "ລົບທັງໃບ",
              tone: "danger",
            });
            if (ok) deleteRef.current?.requestSubmit();
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          {removing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          ລົບທັງໃບ
        </button>
      </div>

      <form ref={unapproveRef} action={unapprove} className="hidden">
        <input type="hidden" name="spr_no" value={sprNo} />
        {back && <input type="hidden" name="back" value={back} />}
      </form>
      <form ref={deleteRef} action={remove} className="hidden">
        <input type="hidden" name="spr_no" value={sprNo} />
        {back && <input type="hidden" name="back" value={back} />}
      </form>
    </div>
  );
}
