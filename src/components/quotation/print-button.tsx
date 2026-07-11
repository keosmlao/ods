"use client";
import { Printer } from "lucide-react";

/** ປຸ່ມພິມ — ໃຊ້ browser print (ods ໃຊ້ window.print() ອັດຕະໂນມັດ) */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
    >
      <Printer className="size-4" />
      ພິມ
    </button>
  );
}
