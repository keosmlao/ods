"use client";
import {
  approveCancellation,
  approveQuote,
  customerApproveQuote,
  customerRejectQuote,
  rejectQuote,
  type ApprovalState,
} from "@/app/actions/approval";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import { Check, LoaderCircle, LogOut, X } from "lucide-react";
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

/** ລູກຄ້າອະນຸມັດ — ບໍ່ມີໝາຍເຫດ (ຄື ods) */
export function CustomerApproveActions({ docNo, productCode }: { docNo: string; productCode: string }) {
  const { pending, error, run } = useApproval();
  const { ask, dialog } = useConfirm();

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          tone="success"
          disabled={pending}
          onClick={() => run(customerApproveQuote, { doc_no: docNo, pro_id: productCode })}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          ອະນຸມັດ
        </Button>
        <Button
          type="button"
          tone="danger"
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: "ລູກຄ້າບໍ່ອະນຸມັດ?",
              message: <>ເຄື່ອງຈະຖືກສົ່ງໄປຂໍຍົກເລີກ</>,
              confirmLabel: "ບໍ່ອະນຸມັດ",
              cancelLabel: "ຍົກເລີກ",
              tone: "danger",
            });
            if (!ok) return;
            run(customerRejectQuote, { doc_no: docNo, pro_id: productCode });
          }}
        >
          <X className="size-4" />
          ບໍ່ອະນຸມັດ
        </Button>
        <Link
          href="/quotations/customer-approval"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="size-4" />
          ອອກ
        </Link>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}

/** ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ */
export function CancelApproveActions({ productCode }: { productCode: string }) {
  const { pending, error, run } = useApproval();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          tone="success"
          disabled={pending}
          onClick={() => run(approveCancellation, { pro_code: productCode })}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          ອະນູມັດ
        </Button>
        <Link
          href="/approvals/cancellations"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="size-4" />
          ອອກ
        </Link>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}
