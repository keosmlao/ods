"use client";
import { beginEditQuote, cancelQuote } from "@/app/actions/quotation";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useTransition } from "react";

/** ປຸ່ມ ລຶບ / ແກ້ໄຂ ໃນຕາຕະລາງ "ກຳລັງດຳເນີນການ" (ຄື /qtcancle + /before_edit_qt ຂອງ ods) */
export function QuoteRowActions({ docNo }: { docNo: string }) {
  const [pending, startTransition] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <div className="flex items-center justify-center gap-3">
      {dialog}
      <button
        type="button"
        title="ລຶບໃບສະເໜີລາຄາ"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ທ່ານແນ່ໃຈບໍ?",
            message: (
              <>
                ໃບສະເໜີລາຄາ <b className="text-slate-700">#{docNo}</b> — ທ່ານບໍ່ສາມາດເອີ້ນກັບຄືນໄດ້!
              </>
            ),
            confirmLabel: "ລຶບ",
            cancelLabel: "ບໍ່",
            tone: "danger",
          });
          if (!ok) return;
          startTransition(() => cancelQuote(docNo));
        }}
        className="text-red-600 hover:opacity-70 disabled:opacity-40"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
      <button
        type="button"
        title="ແກ້ໄຂ"
        disabled={pending}
        onClick={() => startTransition(() => beginEditQuote(docNo))}
        className="text-sky-600 hover:opacity-70 disabled:opacity-40"
      >
        <Pencil className="size-4" />
      </button>
    </div>
  );
}
