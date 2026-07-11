"use client";
import { approveCancellation, rejectCancellation, type ApprovalState } from "@/app/actions/approval";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import { Check, LoaderCircle, LogOut, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * ຕັດສິນຄຳຂໍຍົກເລີກ — **ອະນຸມັດ** ຫຼື **ບໍ່ອະນຸມັດ**.
 *
 * ແຕ່ກ່ອນ (CancelApproveActions ຂອງ components/quotation) ມີແຕ່ປຸ່ມ "ອະນຸມັດ" ດຽວ:
 * ຜູ້ອະນຸມັດທີ່ເຫັນວ່າ "ວຽກນີ້ບໍ່ຄວນຍົກເລີກ" ບໍ່ມີທາງປະຕິເສດເລີຍ ⇒ ຄຳຂໍຄ້າງຄິວຕະຫຼອດ.
 *
 * ບໍ່ອະນຸມັດ = ລ້າງຄຳຂໍຍົກເລີກ ແລ້ວວຽກກັບຄືນສູ່ຂັ້ນຕອນປົກກະຕິ (ບໍ່ແມ່ນ "ລົບວຽກ").
 * ຕ້ອງມີເຫດຜົນ — ຜູ້ຂໍໄດ້ຮັບການແຈ້ງເຕືອນພ້ອມເຫດຜົນນັ້ນ.
 */
export function CancelDecision({ productCode }: { productCode: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const { ask, dialog } = useConfirm();

  const run = (
    action: (state: ApprovalState, formData: FormData) => Promise<ApprovalState>,
    fields: Record<string, string>,
  ) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      const result = await action({}, formData);
      setError(result?.error ?? "");
    });
  };

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          tone="success"
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: "ອະນຸມັດການຍົກເລີກ?",
              message: (
                <>
                  ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{productCode}</b> ຈະຖືກຍົກເລີກ ແລະ ຕ້ອງສົ່ງເຄື່ອງຄືນລູກຄ້າ
                </>
              ),
              confirmLabel: "ອະນຸມັດ",
            });
            if (!ok) return;
            run(approveCancellation, { pro_code: productCode });
          }}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          ອະນຸມັດການຍົກເລີກ
        </Button>

        <Button
          type="button"
          tone="danger"
          disabled={pending}
          onClick={async () => {
            // ເຫດຜົນບັງຄັບ — ກວດຢູ່ນີ້ກ່ອນ ເພື່ອບໍ່ໃຫ້ຜູ້ໃຊ້ເສຍເວລາ (server ກວດຊ້ຳອີກ)
            if (!reason.trim()) {
              setError("ກະລຸນາລະບຸເຫດຜົນທີ່ບໍ່ອະນຸມັດການຍົກເລີກຢູ່ຊ່ອງລຸ່ມນີ້ກ່ອນ");
              return;
            }
            const ok = await ask({
              title: "ບໍ່ອະນຸມັດການຍົກເລີກ?",
              message: (
                <>
                  ຄຳຂໍຍົກເລີກຂອງໃບ <b className="text-slate-700">#{productCode}</b> ຈະຖືກລ້າງ ແລະ ວຽກກັບຄືນສູ່ຂັ້ນຕອນປົກກະຕິ
                  · ຜູ້ຂໍຈະໄດ້ຮັບການແຈ້ງເຕືອນພ້ອມເຫດຜົນ
                </>
              ),
              confirmLabel: "ບໍ່ອະນຸມັດ",
              cancelLabel: "ຍົກເລີກ",
              tone: "danger",
            });
            if (!ok) return;
            run(rejectCancellation, { pro_code: productCode, reason: reason.trim() });
          }}
        >
          <X className="size-4" />
          ບໍ່ອະນຸມັດການຍົກເລີກ
        </Button>

        <Link
          href="/approvals/cancellations"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="size-4" />
          ອອກ
        </Link>
      </div>

      <div>
        <label className={labelClass} htmlFor="reject-reason">
          ເຫດຜົນທີ່ບໍ່ອະນຸມັດ <span className="text-red-500">*</span>{" "}
          <span className="text-xs text-slate-400">(ຈຳເປັນສະເພາະຕອນ &quot;ບໍ່ອະນຸມັດ&quot;)</span>
        </label>
        <input
          id="reject-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="ເຊັ່ນ: ລູກຄ້າຢືນຢັນໃຫ້ສ້ອມຕໍ່ · ອາໄຫຼ່ມາຮອດແລ້ວ · ຂໍຜິດໃບ"
          className={inputClass}
          autoComplete="off"
        />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}
