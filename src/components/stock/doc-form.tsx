"use client";

import { saveDispatch, saveReceiveReturn, saveReturnRequest, type StockState } from "@/app/actions/stock";
import { FormError, SaveBar } from "@/components/stock/save-bar";
import { inputClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { useActionState } from "react";

export type DocField = { label: string; value: string | null; accent?: boolean };

/**
 * ຟອມຫົວບິນທີ່ໃຊ້ຮ່ວມກັນ 3 ໜ້າ:
 *  - ເບີກອາໄຫຼ່        (ods /showdispatch.html + /save_dispatch)
 *  - ຂໍສົ່ງຄືນອາໄຫຼ່     (ods /return_req_page.html + /save_return_req)
 *  - ຮັບຄືນເຂົ້າສາງ     (ods /show_return.html + /save_com_return)
 */
const ACTIONS = {
  dispatch: saveDispatch,
  returnRequest: saveReturnRequest,
  receiveReturn: saveReceiveReturn,
} as const;

export function DocForm({
  kind,
  backHref,
  exitAction,
  docNo,
  today,
  docRef,
  docRefDate,
  productCode,
  fields,
  defaultRemark = "",
  disabled,
}: {
  kind: keyof typeof ACTIONS;
  backHref?: string;
  exitAction?: () => Promise<void>;
  docNo: string;
  today: string;
  docRef: string;
  docRefDate?: string;
  productCode: string;
  fields: DocField[];
  defaultRemark?: string;
  disabled?: boolean;
}) {
  const t = useDict().docChrome;
  const [state, action] = useActionState<StockState, FormData>(ACTIONS[kind], {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="doc_ref" value={docRef} />
      <input type="hidden" name="Product_code" value={productCode} />
      {docRefDate !== undefined && <input type="hidden" name="doc_ref_date" value={docRefDate} />}

      <SaveBar backHref={backHref} exitAction={exitAction} disabled={disabled} />
      <FormError message={state.error} />

      <div className="grid gap-4 rounded-xl bg-[#0a5e96] p-5 text-white md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-white/70">{t.dateLabel}</span> {today}
          </p>
          <p>
            <span className="text-white/70">{t.docNoLabel}</span> {docNo}
          </p>
        </div>

        <div className="space-y-1 text-sm">
          {fields.map((field) => (
            <p key={field.label}>
              <span className="text-white/70">{field.label}</span>{" "}
              <span className={field.accent ? "text-[#ffd0d0]" : undefined}>{field.value || "-"}</span>
            </p>
          ))}
        </div>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-white/80">{t.remark}</span>
          <input type="text" name="remark" defaultValue={defaultRemark} autoComplete="off" className={inputClass} />
        </label>
      </div>
    </form>
  );
}
