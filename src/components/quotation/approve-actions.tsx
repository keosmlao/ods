"use client";
import {
  approveQuote,
  customerApproveQuote,
  customerRejectQuote,
  rejectQuote,
  undoCustomerDecision,
  undoQuoteApproval,
  type ApprovalState,
} from "@/app/actions/approval";
import { beginEditQuote } from "@/app/actions/quotation";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import { Check, LoaderCircle, LogOut, Pencil, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

/** ຖອດແບບຈາກ ods templates/approve/qt/detail.html + cust_qtdetail.html + Service/approve_cc_page.html */

function useApproval() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const run = (action: (state: ApprovalState, formData: FormData) => Promise<ApprovalState>, fields: Record<string, string>) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      const result = await action({}, formData);
      setError(result?.error ?? "");
    });
  };
  return { pending, error, run };
}

/** ອະນຸມັດພາຍໃນ — ມີໝາຍເຫດ */
export function QuoteApproveActions({ docNo, productCode }: { docNo: string; productCode: string }) {
  const { pending, error, run } = useApproval();
  const [remark, setRemark] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          tone="success"
          disabled={pending}
          onClick={() => run(approveQuote, { doc_no: docNo, pro_id: productCode, remark })}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          ອະນຸມັດ
        </Button>
        <Button
          type="button"
          tone="danger"
          disabled={pending}
          onClick={() => run(rejectQuote, { doc_no: docNo, pro_id: productCode, remark })}
        >
          <X className="size-4" />
          ບໍ່ອະນຸມັດ
        </Button>
        <Link
          href="/approvals/quotations"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="size-4" />
          ອອກ
        </Link>
      </div>

      <div>
        <label className={labelClass} htmlFor="remark">ໝາຍເຫດ</label>
        <input
          id="remark"
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          className={inputClass}
          autoComplete="off"
        />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}

/**
 * ລູກຄ້າອະນຸມັດ.
 *
 * ຊ່ອງ "ເຫດຜົນ / ໝາຍເຫດ" ເປັນຂອງໃໝ່: ຟອມເກົ່າບໍ່ມີເລີຍ ທັງທີ່ customerRejectQuote ອ່ານ remark
 * ຢູ່ ⇒ ເຫດຜົນທີ່ລູກຄ້າປະຕິເສດຖືກຖິ້ມທຸກເທື່ອ. ດຽວນີ້ **ບັງຄັບຕອນບໍ່ອະນຸມັດ**.
 */
export function CustomerApproveActions({ docNo, productCode }: { docNo: string; productCode: string }) {
  const { pending, error, run } = useApproval();
  const { ask, dialog } = useConfirm();
  const [remark, setRemark] = useState("");
  const [warn, setWarn] = useState("");
  const [editing, startEdit] = useTransition();

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          tone="success"
          disabled={pending}
          onClick={() => run(customerApproveQuote, { doc_no: docNo, pro_id: productCode, remark })}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          ອະນຸມັດ
        </Button>
        <Button
          type="button"
          tone="danger"
          disabled={pending}
          onClick={async () => {
            if (!remark.trim()) {
              setWarn("ກະລຸນາລະບຸເຫດຜົນທີ່ລູກຄ້າບໍ່ຕົກລົງຢູ່ຊ່ອງ ເຫດຜົນ / ໝາຍເຫດ ກ່ອນ");
              return;
            }
            setWarn("");
            const ok = await ask({
              title: "ລູກຄ້າບໍ່ອະນຸມັດ?",
              message: <>ເຄື່ອງຈະຖືກສົ່ງໄປຂໍຍົກເລີກ · ຖອນຄືນໄດ້ຖ້າຍັງບໍ່ໄດ້ອອກໃບຮັບເງິນ</>,
              confirmLabel: "ບໍ່ອະນຸມັດ",
              cancelLabel: "ຍົກເລີກ",
              tone: "danger",
            });
            if (!ok) return;
            run(customerRejectQuote, { doc_no: docNo, pro_id: productCode, remark });
          }}
        >
          <X className="size-4" />
          ບໍ່ອະນຸມັດ
        </Button>
        {/* ລູກຄ້າຕໍ່ລອງລາຄາ → ແກ້ໄຂແລ້ວຂໍອະນຸມັດຄືນ.
            ກົດເກນຮອງຮັບຢູ່ແລ້ວ (ໃບ 1/0 ແກ້ໄຂໄດ້ ແລ້ວຕັດກັບເປັນ 0/0) ແຕ່ບໍ່ມີປຸ່ມໃດພາໄປເລີຍ */}
        <Button
          type="button"
          tone="info"
          disabled={pending || editing}
          onClick={() => startEdit(async () => { await beginEditQuote(docNo); })}
        >
          {editing ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
          ແກ້ໄຂລາຄາ (ຂໍອະນຸມັດຄືນ)
        </Button>
        <Link
          href="/quotations/customer-approval"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="size-4" />
          ອອກ
        </Link>
      </div>

      <div>
        <label className={labelClass} htmlFor="cust_remark">
          ເຫດຜົນ / ໝາຍເຫດ <span className="text-red-600">(ບັງຄັບ ຕອນລູກຄ້າບໍ່ຕົກລົງ)</span>
        </label>
        <input
          id="cust_remark"
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          placeholder="ເຊັ່ນ: ລາຄາແພງເກີນ, ບໍ່ຄຸ້ມສ້ອມ, ຈະໄປສ້ອມບ່ອນອື່ນ..."
          className={inputClass}
          autoComplete="off"
        />
      </div>

      {warn && <ErrorBox>{warn}</ErrorBox>}
      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}

/* ───────── ຖອນຄືນ (undo) ─────────
 * ບໍ່ມີໃນ ods ເລີຍ: ກົດຜິດແລ້ວແກ້ບໍ່ໄດ້. server ກັນບໍ່ໃຫ້ຖອຍຂ້າມເອກະສານທີ່ອອກແລ້ວ
 * (ໃບຮັບເງິນ / ສົ່ງຄືນ / ອະນຸມັດຍົກເລີກ) ແລະ ຄືນຂໍ້ຄວາມທີ່ບອກຊື່ເອກະສານທີ່ຂວາງຢູ່.
 */

function UndoButton({
  docNo,
  action,
  label,
  title,
  message,
  size = "sm",
}: {
  docNo: string;
  action: (docNo: string) => Promise<ApprovalState>;
  label: string;
  title: string;
  message: React.ReactNode;
  size?: "sm" | "md";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  const click = async () => {
    const ok = await ask({ title, message, confirmLabel: "ຖອນຄືນ", cancelLabel: "ບໍ່", tone: "warning" });
    if (!ok) return;
    startTransition(async () => {
      const result = await action(docNo);
      setError(result?.error ?? "");
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={click}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-300 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40 ${
          size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-4 text-sm"
        }`}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
        {label}
      </button>
      {error && <span className="max-w-56 text-[10px] font-medium text-red-600">{error}</span>}
    </div>
  );
}

/** ຜູ້ອະນຸມັດ: ຖອນການອະນຸມັດ / ບໍ່ອະນຸມັດ ພາຍໃນ → ກັບເຂົ້າຄິວລໍຖ້າອະນຸມັດ */
export function UndoApprovalButton({ docNo, size }: { docNo: string; size?: "sm" | "md" }) {
  return (
    <UndoButton
      docNo={docNo}
      action={undoQuoteApproval}
      label="ຖອນຄືນ"
      title="ຖອນການຕັດສິນຂອງທ່ານ?"
      size={size}
      message={
        <>
          ໃບສະເໜີລາຄາ <b className="text-slate-700">#{docNo}</b> ຈະກັບເຂົ້າຄິວ “ລໍຖ້າອະນຸມັດ” ອີກຄັ້ງ
          (ຜູ້ອະນຸມັດ ແລະ ໝາຍເຫດເກົ່າຖືກລ້າງ)
        </>
      }
    />
  );
}

/** ຝ່າຍບໍລິການ: ຖອນຄຳຕອບຂອງລູກຄ້າ → ກັບເປັນ ລໍຖ້າລູກຄ້າອະນຸມັດ */
export function UndoCustomerButton({ docNo, size }: { docNo: string; size?: "sm" | "md" }) {
  return (
    <UndoButton
      docNo={docNo}
      action={undoCustomerDecision}
      label="ຖອນຄຳຕອບ"
      title="ຖອນຄຳຕອບຂອງລູກຄ້າ?"
      size={size}
      message={
        <>
          ໃບສະເໜີລາຄາ <b className="text-slate-700">#{docNo}</b> ຈະກັບເປັນ “ລໍຖ້າລູກຄ້າອະນຸມັດ”.
          ຖ້າລູກຄ້າເຄີຍປະຕິເສດ ຄຳຂໍຍົກເລີກຈະຖືກຖອນໃຫ້ນຳ. ຖອນບໍ່ໄດ້ຖ້າອອກໃບຮັບເງິນແລ້ວ.
        </>
      }
    />
  );
}
