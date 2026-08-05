"use client";
import { startInstallReturnRequest } from "@/app/actions/installation-returns";
import { startReturnRequest } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Undo2 } from "lucide-react";
import { useTransition } from "react";

/**
 * ປຸ່ມ **"ຂໍຄືນ"** ຂອງໃບເບີກນຶ່ງໃບ.
 *
 * ⚠️ **ຕ້ອງເປັນປຸ່ມ ບໍ່ແມ່ນລິ້ງ** — ຟອມປາຍທາງ (`/stock/returns/<ໃບເບີກ>`) ອ່ານຈາກ
 * **ກະຕ່າຮ່າງ** (`ic_trans_detail_draft`) ບໍ່ແມ່ນອ່ານຈາກໃບເບີກໂດຍກົງ. ຖ້າພາໄປ
 * ດ້ວຍລິ້ງລ້ວນ ກະຕ່າຍັງຫວ່າງ ⇒ ໜ້າຂຶ້ນ "ບໍ່ມີອາໄຫຼ່ໃຫ້ສົ່ງຄືນ" ແລະ ປຸ່ມບັນທຶກຖືກປິດ
 * (ພົບຈິງ 05-08-2026 ກັບໃບ SWC2026070118).
 * ⇒ ກົດປຸ່ມນີ້ → action ກ໋ອບລາຍການຂອງໃບເບີກເຂົ້າກະຕ່າ → ຈຶ່ງພາໄປຟອມ.
 *
 * ງານຕິດຕັ້ງໃຊ້ **ຄົນລະ action ແລະ ຄົນລະໜ້າ** (ods: /return_req_check_inst) — ຮັກສາໄວ້.
 */
export function ReturnRequestButton({
  docNo,
  jobType,
  size = "md",
}: {
  docNo: string;
  jobType: "repair" | "install" | null;
  /** sm = ໃນຕົ້ນໄມ້ອາໄຫຼ່ (ແຖວແໜ້ນ) · md = ໃນຕາຕະລາງ */
  size?: "sm" | "md";
}) {
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
            title: "ຂໍຄືນອາໄຫຼ່ເຂົ້າສາງ?",
            message: (
              <>
                ລາຍການອາໄຫຼ່ຂອງໃບເບີກ <b className="text-slate-700">{docNo}</b> ຈະຖືກດຶງມາໃສ່ໃບຂໍຄືນ
                {isInstall && <> (ງານຕິດຕັ້ງ)</>} — ໜ້າຕໍ່ໄປໃຫ້ເລືອກວ່າຈະຄືນລາຍການໃດແດ່
              </>
            ),
            confirmLabel: "ດຶງລາຍການມາ",
          });
          if (!ok) return;
          const data = new FormData();
          data.set("doc_no", docNo);
          start(() => void (isInstall ? startInstallReturnRequest(data) : startReturnRequest(data)));
        }}
        className={
          size === "sm"
            ? "inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            : "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        }
      >
        {pending ? <LoaderCircle className="size-3 animate-spin" /> : <Undo2 className="size-3" />}
        ຂໍຄືນ
      </button>
    </>
  );
}
