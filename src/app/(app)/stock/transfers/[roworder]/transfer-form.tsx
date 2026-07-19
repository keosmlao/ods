"use client";

import { saveTransferRequest, type StockState } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import type { DocField } from "@/components/stock/doc-form";
import { FormError } from "@/components/stock/save-bar";
import { LinkButton, inputClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { LoaderCircle, LogOut, Save } from "lucide-react";
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

/** ປຸ່ມບັນທຶກ — ຢືນຢັນກ່ອນ ແລ້ວຈຶ່ງສົ່ງຟອມ (ໃຊ້ useConfirm ແທນ window.confirm) */
function SaveButton({ onConfirmed, saveLabel }: { onConfirmed: () => void; saveLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onConfirmed}
      disabled={pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
      &nbsp;{saveLabel}
    </button>
  );
}

/**
 * ຟອມໃບຂໍໂອນອາໄຫຼ່ຂ້າມສາງ — ods: templates/stock/showstockretrans.html + /save_reqest_trans.
 * (ຂຽນຟອມເອງແທນ <DocForm> ເພາະ DocForm ຜູກກັບ 3 action ເດີມເທົ່ານັ້ນ)
 */
export function TransferForm({
  docNo,
  today,
  docRef,
  roworder,
  fields,
  defaultRemark = "",
  itemName,
}: {
  docNo: string;
  today: string;
  docRef: string;
  roworder: number;
  fields: DocField[];
  defaultRemark?: string;
  itemName: string;
}) {
  const t = useDict().transferForm;
  const [state, action] = useActionState<StockState, FormData>(saveTransferRequest, {});
  const formRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  async function confirmSave() {
    const ok = await ask({
      title: t.confirmTitle,
      message: `${t.confirmMessagePrefix} ${docNo} — ${itemName} ${t.confirmMessageSuffix}`,
      confirmLabel: t.confirmSubmit,
    });
    if (ok) formRef.current?.requestSubmit();
  }

  return (
    <>
      {dialog}
      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="doc_ref" value={docRef} />
        <input type="hidden" name="roworder" value={roworder} />

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton onConfirmed={confirmSave} saveLabel={t.save} />
          <LinkButton href="/stock/dispatch" tone="neutral">
            <LogOut className="size-4" />
            &nbsp;{t.exit}
          </LinkButton>
        </div>

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
    </>
  );
}
