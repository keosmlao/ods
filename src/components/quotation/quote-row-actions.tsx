"use client";
import { beginEditQuote, cancelQuote } from "@/app/actions/quotation";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມ ລຶບ / ແກ້ໄຂ ຂອງໃບສະເໜີລາຄາ (ຄື /qtcancle + /before_edit_qt ຂອງ ods)
 *
 *   compact  → ແທັບ "ກຳລັງດຳເນີນການ" (ໃບທີ່ຍັງລໍຖ້າອະນຸມັດ) — ໄອຄອນລ້າໆ
 *   rejected → ແທັບ "ລໍຖ້າອອກໃບສະເໜີລາຄາ" ຂອງເຄື່ອງທີ່ໃບຖືກ "ບໍ່ອະນຸມັດ" — ມີປ້າຍຄຳ
 *              ເພື່ອໃຫ້ຜູ້ຮັບຜິດຊອບເຫັນທາງອອກ 2 ທາງຢ່າງຊັດເຈນ:
 *              ແກ້ໄຂແລ້ວສົ່ງອະນຸມັດຄືນ · ຫຼື ລຶບຖິ້ມແລ້ວອອກໃບໃໝ່
 */
type Props = { docNo: string; variant?: "compact" | "rejected" };

export function QuoteRowActions({ docNo, variant = "compact" }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  const remove = async () => {
    const ok = await ask({
      title: "ທ່ານແນ່ໃຈບໍ?",
      message: (
        <>
          ລຶບໃບສະເໜີລາຄາ <b className="text-slate-700">#{docNo}</b> — ເຄື່ອງຈະກັບໄປລໍຖ້າສະເໜີລາຄາໃໝ່
          ແລະ ທ່ານບໍ່ສາມາດເອີ້ນໃບເກົ່າກັບຄືນໄດ້!
        </>
      ),
      confirmLabel: "ລຶບ",
      cancelLabel: "ບໍ່",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await cancelQuote(docNo);
      setError(result?.error ?? "");
    });
  };

  const edit = () =>
    startTransition(async () => {
      const result = await beginEditQuote(docNo);
      setError(result?.error ?? "");
    });

  if (variant === "rejected") {
    return (
      <div className="flex flex-col items-center gap-1">
        {dialog}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={edit}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            ແກ້ໄຂ ແລະ ສົ່ງອະນຸມັດຄືນ
          </button>
          <button
            type="button"
            title="ລຶບໃບສະເໜີລາຄາ ແລ້ວອອກໃບໃໝ່"
            disabled={pending}
            onClick={remove}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            ລຶບ
          </button>
        </div>
        {error && <span className="text-[10px] font-medium text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {dialog}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          title="ລຶບໃບສະເໜີລາຄາ"
          disabled={pending}
          onClick={remove}
          className="text-red-600 hover:opacity-70 disabled:opacity-40"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
        <button
          type="button"
          title="ແກ້ໄຂ"
          disabled={pending}
          onClick={edit}
          className="text-sky-600 hover:opacity-70 disabled:opacity-40"
        >
          <Pencil className="size-4" />
        </button>
      </div>
      {error && <span className="text-[10px] font-medium text-red-600">{error}</span>}
    </div>
  );
}
