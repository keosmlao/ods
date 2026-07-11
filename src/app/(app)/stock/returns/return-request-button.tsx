"use client";
import { startInstallReturnRequest } from "@/app/actions/installation-returns";
import { startReturnRequest } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Undo2 } from "lucide-react";
import { useTransition } from "react";

/**
 * ປຸ່ມ "ຂໍສົ່ງຄືນ" ຂອງໃບເບີກນຶ່ງໃບ.
 * ງານຕິດຕັ້ງ (job_type = 'install') ໃຊ້ຄົນລະ action ແລະ ໄປຄົນລະໜ້າ
 * (ods: /return_req_check_inst ຂອງ tech_install.py) — ຮັກສາພຶດຕິກຳນັ້ນໄວ້.
 */
export function ReturnRequestButton({ docNo, jobType }: { docNo: string; jobType: string | null }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const isInstall = jobType === "install";

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ຂໍສົ່ງຄືນອາໄຫຼ່?",
            message: (
              <>
                ອາໄຫຼ່ຂອງໃບເບີກ <b className="text-slate-700">{docNo}</b> ຈະຖືກກ໋ອບໄປໃສ່ໃບຂໍສົ່ງຄືນ
                {isInstall && <> (ງານຕິດຕັ້ງ)</>}
              </>
            ),
            confirmLabel: "ຂໍສົ່ງ​ຄືນ",
          });
          if (!ok) return;
          const data = new FormData();
          data.set("doc_no", docNo);
          start(() => void (isInstall ? startInstallReturnRequest(data) : startReturnRequest(data)));
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
        ຂໍສົ່ງ​ຄືນ
      </button>
    </>
  );
}
