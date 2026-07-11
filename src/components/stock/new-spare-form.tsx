"use client";

import { createSpareDraft, type StockState } from "@/app/actions/stock";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import { LoaderCircle, Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

/** ods: templates/newspare/home_create.html + /save_newspare */
export function NewSpareForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<StockState, FormData>(createSpareDraft, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">ບັນທຶກສຳເລັດ</p>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block">
          <span className={labelClass}>ວັນທີຂໍສ້າງ:</span>
          <input type="date" name="doc_date" defaultValue={today} readOnly required className={inputClass} />
        </label>

        <label className="block md:col-span-2">
          <span className={labelClass}>ຊື່ອາໄຫຼ່:</span>
          <input
            type="text"
            name="pro_name"
            required
            autoComplete="off"
            placeholder="ປ້ອນຊື່ອາໄຫຼ່"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>ຫົວໜ່ວຍ:</span>
          <input
            type="text"
            name="unit_code"
            required
            autoComplete="off"
            placeholder="ປ້ອນຫົວໜ່ວຍອາໄຫຼ່"
            className={inputClass}
          />
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        ເພີ່ມລາຍການ
      </Button>
    </form>
  );
}
