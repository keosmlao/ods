"use client";
import { Printer } from "lucide-react";

/**
 * ປຸ່ມພິມ / ບັນທຶກ PDF — ເປີດກ່ອງພິມຂອງ browser (ເລືອກ "Save as PDF" ໄດ້).
 * ໃຊ້ browser print ⇒ ໄດ້ PDF ຄຸນນະພາບເຕັມ (vector, ຟອນລາວຄົມຊັດ) ໂດຍບໍ່ຕ້ອງເພີ່ມ dependency.
 */
export function PrintButton({ label = "ພິມ / ບັນທຶກ PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0536a9] px-4 text-xs font-semibold text-white transition hover:opacity-90"
    >
      <Printer className="size-3.5" />
      {label}
    </button>
  );
}
