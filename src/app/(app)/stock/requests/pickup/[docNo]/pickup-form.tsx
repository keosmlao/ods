"use client";

import { savePickSpare, type StockState } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox, LinkButton, inputClass } from "@/components/ui";
import { LoaderCircle, LogOut, PackageCheck } from "lucide-react";
import { useActionState, useRef } from "react";

/**
 * ຢືນຢັນວ່າຊ່າງໄດ້ຮັບອາໄຫຼ່ຈາກສາງແລ້ວ (ອອກໃບ PISP).
 * ຖາມຢືນຢັນດ້ວຍ useConfirm() ກ່ອນສົ່ງ — ຮັບແລ້ວແກ້ຄືນບໍ່ໄດ້.
 */
export function PickupForm({
  docRef,
  lineCount,
  defaultRemark,
  disabled,
}: {
  docRef: string;
  lineCount: number;
  defaultRemark: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<StockState, FormData>(savePickSpare, {});
  const { ask, dialog } = useConfirm();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} className="space-y-4">
      {dialog}
      <input type="hidden" name="doc_ref" value={docRef} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          tone="success"
          disabled={pending || disabled}
          onClick={async () => {
            const ok = await ask({
              title: "ຢືນຢັນຮັບອາໄຫຼ່?",
              message: (
                <>
                  ຢືນຢັນວ່າໄດ້ຮັບອາໄຫຼ່ທັງ <b className="text-slate-700">{lineCount}</b> ລາຍການ ຈາກສາງຕາມໃບເບີກ{" "}
                  <b className="text-slate-700">{docRef}</b> ຄົບຖ້ວນແລ້ວ
                </>
              ),
              confirmLabel: "ຮັບອາໄຫຼ່",
              cancelLabel: "ຍັງບໍ່ຮັບ",
            });
            if (ok) form.current?.requestSubmit();
          }}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
          &nbsp;{pending ? "ກຳລັງບັນທຶກ..." : "ຮັບອາໄຫຼ່"}
        </Button>

        <LinkButton href="/stock/requests/pickup" tone="neutral">
          <LogOut className="size-4" />
          &nbsp;ອອກ
        </LinkButton>
      </div>

      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">ໝາຍເຫດ</span>
        <input type="text" name="remark" defaultValue={defaultRemark} autoComplete="off" className={inputClass} />
      </label>
    </form>
  );
}
