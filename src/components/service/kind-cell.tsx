"use client";
import { setCustomerKind, type PayState } from "@/app/actions/service-payment";
// ⚠️ ຢ່າ import ຈາກ lib/service-money — ມັນດຶງ `pg` ເຂົ້າ browser ແລ້ວ build ພັງ
import { CUST_KIND_LABEL, UNSET_KIND_LABEL, type CustKind } from "@/lib/cust-kind";
import { LoaderCircle } from "lucide-react";
import { useActionState, useRef } from "react";

/**
 * **ລະບຸປະເພດລູກຄ້າ (ຮ້ານຄ້າ / ທົ່ວໄປ) ຈາກຕາຕະລາງ** — ເລືອກແລ້ວບັນທຶກທັນທີ.
 *
 * ບໍ່ມີຂໍ້ມູນນີ້ຢູ່ຖານໃດມາກ່ອນ (ODS ar_type null 10,040/10,045 · ERP ar_type ເປັນປະເພດບັນຊີ)
 * ແລະ ເດົາຈາກຊື່ບໍ່ໄດ້ ⇒ ຕ້ອງໃຫ້ຄົນລະບຸ. ວາງໄວ້ໃນຕາຕະລາງລູກຄ້າເພື່ອໃຫ້ລະບຸໄດ້ໄວເປັນຊຸດ
 * (ຖ້າຕ້ອງເປີດເຂົ້າແກ້ເທື່ອລະຄົນ 3,390 ລູກຄ້າ ຈະບໍ່ມີໃຜເຮັດ).
 *
 * ບັນທຶກທັນທີຕອນເລືອກ (ບໍ່ມີປຸ່ມຢືນຢັນ) — ເປັນຂໍ້ມູນຈັດປະເພດ ບໍ່ແມ່ນເງິນ ແລະ ປ່ຽນຄືນໄດ້ທັນທີ.
 */
export function KindCell({ code, value, canEdit }: { code: string; value: CustKind | null; canEdit: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, saving] = useActionState<PayState, FormData>(setCustomerKind, {});

  if (!canEdit) {
    return value ? (
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          value === "shop" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {CUST_KIND_LABEL[value]}
      </span>
    ) : (
      <span className="text-[10px] text-slate-300">{UNSET_KIND_LABEL}</span>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex items-center gap-1">
      <input type="hidden" name="code" value={code} />
      <select
        name="kind"
        defaultValue={value ?? ""}
        disabled={saving}
        onChange={() => formRef.current?.requestSubmit()}
        className={`h-7 rounded border px-1 text-[11px] focus:outline-none ${
          value === "shop"
            ? "border-violet-300 bg-violet-50 text-violet-700"
            : value === "general"
              ? "border-slate-300 bg-white text-slate-600"
              : "border-dashed border-slate-300 bg-white text-slate-400"
        }`}
      >
        <option value="">{UNSET_KIND_LABEL}</option>
        <option value="shop">{CUST_KIND_LABEL.shop}</option>
        <option value="general">{CUST_KIND_LABEL.general}</option>
      </select>
      {saving && <LoaderCircle className="size-3 animate-spin text-slate-400" />}
      {state.error && <span className="text-[9px] font-semibold text-rose-600">{state.error}</span>}
    </form>
  );
}
