"use client";
import { deleteNotice } from "@/app/actions/notice";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ລຶບຄຳແຈ້ງສ້ອມຂອງລູກຄ້າ (ຄຳແຈ້ງທົດລອງ/ຊ້ຳ/ຜິດ).
 *
 * ⚠️ ນີ້ **ບໍ່ແມ່ນປຸ່ມລຶບງານ** — ການລຶບງານຍັງຫ້າມເດັດຂາດ (ເບິ່ງ actions/notice.ts).
 * ຄຳແຈ້ງທີ່ເປີດເປັນໃບຮັບເຄື່ອງໄປແລ້ວ server ຈະປະຕິເສດ.
 */
export function NoticeDeleteButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        title={error || "ລຶບຄຳແຈ້ງນີ້"}
        onClick={async () => {
          const yes = await ask({
            title: `ລຶບຄຳແຈ້ງ ${code}?`,
            message: "ຄຳແຈ້ງທີ່ເປີດເປັນໃບຮັບເຄື່ອງໄປແລ້ວ ລຶບບໍ່ໄດ້",
            tone: "danger",
          });
          if (!yes) return;
          start(async () => {
            const result = await deleteNotice(code);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
        className={`inline-flex size-8 items-center justify-center rounded-lg border ${
          error
            ? "border-red-300 bg-red-50 text-red-600"
            : "border-slate-300 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600"
        }`}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </>
  );
}
