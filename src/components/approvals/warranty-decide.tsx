"use client";
import { approveWarranty, rejectWarranty } from "@/app/actions/warranty";
import { Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມຕັດສິນ 1 ຄຳຂໍ. **ບໍ່ອະນຸມັດຕ້ອງມີເຫດຜົນ** — ຊ່າງທີ່ຖືກປະຕິເສດຕ້ອງຮູ້ວ່າຍ້ອນຫຍັງ
 * ບໍ່ດັ່ງນັ້ນລາວກໍ່ຂໍຊ້ຳອີກແບບເກົ່າ.
 */
export function WarrantyDecideButtons({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const result = await fn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });

  const button = "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-60";

  return (
    <div className="w-full max-w-xs shrink-0 space-y-2">
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="ໝາຍເຫດ (ບັງຄັບເມື່ອບໍ່ອະນຸມັດ)"
        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-brand-600"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act(() => approveWarranty(id, note))}
          className={`${button} flex-1 justify-center bg-brand-700 text-white hover:bg-brand-700`}
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          ອະນຸມັດ
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!note.trim()) {
              setError("ບໍ່ອະນຸມັດ ຕ້ອງໃສ່ໝາຍເຫດ");
              return;
            }
            act(() => rejectWarranty(id, note));
          }}
          className={`${button} flex-1 justify-center border border-brand-orange-400 text-brand-orange-700 hover:bg-brand-orange-50`}
        >
          <X className="size-3.5" />
          ບໍ່ອະນຸມັດ
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-brand-orange-700">{error}</p>}
    </div>
  );
}
