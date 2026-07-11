"use client";

import { saveReceiveTransfer, type StockState } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import type { DocField } from "@/components/stock/doc-form";
import { FormError } from "@/components/stock/save-bar";
import { LinkButton, inputClass } from "@/components/ui";
import { LoaderCircle, LogOut, PackageCheck } from "lucide-react";
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

/** ປຸ່ມຢືນຢັນ — ຖາມກ່ອນ ແລ້ວຈຶ່ງສົ່ງຟອມ (useConfirm ບໍ່ແມ່ນ window.confirm) */
function ReceiveButton({ onConfirmed, disabled }: { onConfirmed: () => void; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onConfirmed}
      disabled={pending || disabled}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
      &nbsp;ຮັບຂອງທີ່ໂອນມາ
    </button>
  );
}

export function ReceiveTransferForm({
  docNo,
  itemName,
  fields,
  defaultRemark = "",
  disabled = false,
}: {
  docNo: string;
  itemName: string;
  fields: DocField[];
  defaultRemark?: string;
  disabled?: boolean;
}) {
  const [state, action] = useActionState<StockState, FormData>(saveReceiveTransfer, {});
  const formRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  async function confirmReceive() {
    const ok = await ask({
      title: "ຮັບຂອງທີ່ໂອນມາ?",
      message: `ປິດໃບຂໍໂອນ ${docNo} — ${itemName} · ແຖວຈະກັບເຂົ້າຄິວເບີກອາໄຫຼ່`,
      confirmLabel: "ຮັບຂອງ",
    });
    if (ok) formRef.current?.requestSubmit();
  }

  return (
    <>
      {dialog}
      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="doc_no" value={docNo} />

        <div className="flex flex-wrap items-center gap-3">
          <ReceiveButton onConfirmed={confirmReceive} disabled={disabled} />
          <LinkButton href="/stock/transfers" tone="neutral">
            <LogOut className="size-4" />
            &nbsp;ອອກ
          </LinkButton>
        </div>

        <FormError message={state.error} />

        <div className="grid gap-4 rounded-xl bg-[#0a5e96] p-5 text-white md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-white/70">ເລກທີ:</span> {docNo}
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
            <span className="mb-1 block text-sm text-white/80">ໝາຍເຫດ</span>
            <input type="text" name="remark" defaultValue={defaultRemark} autoComplete="off" className={inputClass} />
          </label>
        </div>
      </form>
    </>
  );
}
