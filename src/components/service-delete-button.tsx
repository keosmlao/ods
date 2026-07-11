"use client";
import { deleteService } from "@/app/actions/service";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ຄື deleteitem() + /del_rcp/<code> ຂອງ ods (SweetAlert 'ທ່ານແນ່ໃຈບໍ?') */
export function DeleteServiceButton({ code }: { code: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="button"
        title="ລົບ"
        disabled={pending}
        onClick={async () => {
          const ok = await ask({
            title: "ທ່ານແນ່ໃຈບໍ?",
            message: (
              <>
                ທ່ານບໍ່ສາມາກເອີ້ນກັບຄືນໃດ້!
                <br />
                ລະຫັດຮັບເຄື່ອງ: <b className="text-slate-700">{code}</b>
              </>
            ),
            confirmLabel: "ລົບເລີຍ!",
            cancelLabel: "ອອກ",
            tone: "danger",
          });
          if (!ok) return;
          setError("");
          startTransition(async () => {
            const result = await deleteService(code);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
        className="text-red-600 transition hover:opacity-70 disabled:opacity-40"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}
