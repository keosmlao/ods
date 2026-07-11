"use client";
import type { ActionState } from "@/app/actions/installation";
import { useConfirm } from "@/components/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** ລົບໃບຂໍເບີກ SION — ຖອດແບບຈາກ ods /delete_in_req (tech_reg_install.py) */
export function DeleteSpareRequestButton({
  docNo,
  code,
  action,
}: {
  docNo: string;
  code: string;
  action: (docNo: string, code: string) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="button"
        title="ລົບ"
        disabled={pending}
        className="text-slate-500 hover:text-red-600 disabled:opacity-50"
        onClick={async () => {
          const ok = await ask({
            title: "ລົບເລກທີຂໍເບີກ?",
            message: (
              <>
                ເລກທີຂໍເບີກ <b className="text-slate-700">#{docNo}</b>
              </>
            ),
            confirmLabel: "ລົບ",
            cancelLabel: "ບໍ່",
            tone: "danger",
          });
          if (!ok) return;
          start(async () => {
            const result = await action(docNo, code);
            if (result.error) window.alert(result.error);
            else router.refresh();
          });
        }}
      >
        <Trash2 className="size-4" />
      </button>
    </>
  );
}
