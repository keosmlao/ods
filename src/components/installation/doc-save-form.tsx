"use client";
import type { ActionState } from "@/app/actions/installation";
import { Button, Card, ErrorBox, LinkButton, inputClass, labelClass } from "@/components/ui";
import { Save } from "lucide-react";
import { useActionState } from "react";

/**
 * ຟອມບັນທຶກເອກະສານທີ່ອ້າງອີງເອກະສານກ່ອນໜ້າ (SWC ອ້າງ SION, PISP ອ້າງ SWC).
 * ໃຊ້ຮ່ວມກັນລະຫວ່າງໜ້າສາງເບີກ ແລະ ໜ້າຮັບອາໄຫຼ່.
 * ເລກເອກະສານໃໝ່ອອກຢູ່ຝັ່ງ server ພາຍໃນ transaction ທີ່ລັອກແລ້ວ (ບໍ່ໃຫ້ຊ້ຳ)
 * — ຕ່າງຈາກ ods ທີ່ຄິດເລກໄວ້ໃນຟອມແລ້ວສົ່ງມາ.
 */
export function DocSaveForm({
  action,
  docRef,
  productCode,
  today,
  backHref,
  submitLabel,
  disabled,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  docRef: string;
  productCode: string;
  today: string;
  backHref: string;
  submitLabel: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction}>
      <Card title="ບັນທຶກ">
        {state.error && <ErrorBox>{state.error}</ErrorBox>}
        <input type="hidden" name="doc_ref" value={docRef} />
        <input type="hidden" name="product_code" value={productCode} />

        <div className="mt-2 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>ອ້າງອີງເອກະສານ</label>
            <input readOnly value={docRef} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ວັນທີ</label>
            <input type="date" name="doc_date" required defaultValue={today} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ໝາຍເຫດ</label>
            <input name="remark" className={inputClass} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button type="submit" tone="success" disabled={pending || disabled}>
            <Save className="size-4" />
            {pending ? "ກຳລັງບັນທຶກ..." : submitLabel}
          </Button>
          <LinkButton href={backHref} tone="danger">ອອກ</LinkButton>
        </div>
      </Card>
    </form>
  );
}
