"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { RepairTransferForm } from "./repair-transfer-form";

/**
 * ປຸ່ມ **ເພີ່ມ** + ຟອມທີ່ພັບເກັບໄວ້.
 *
 * ── ເປັນຫຍັງບໍ່ໃຫ້ຟອມກາງໜ້າຄືເກົ່າ ──
 * ໜ້ານີ້ເປີດມາເຫັນແຕ່ຟອມເປົ່າ ⇒ ບອກບໍ່ໄດ້ວ່າ **ຂໍໄປແລ້ວແມ່ນຫຍັງແດ່ ຄ້າງຢູ່ຈັກໃບ**
 * ຄົນຈຶ່ງຂໍຊ້ຳ ຫຼື ລືມທວງ. ດຽວນີ້ລາຍການເປັນຫຼັກ ສ່ວນການສ້າງໃໝ່ຢູ່ຫຼັງປຸ່ມ (06-08-2026).
 */
export function NewTransferPanel({ warehouses }: { warehouses: { code: string; name: string }[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-900 px-4 text-xs font-semibold text-white hover:bg-brand-800"
      >
        <Plus className="size-4" />
        ເພີ່ມໃບຂໍໂອນ
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">ໃບຂໍໂອນໃໝ່</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white"
          title="ປິດ"
        >
          <X className="size-4" />
        </button>
      </div>
      <RepairTransferForm warehouses={warehouses} />
    </div>
  );
}
