"use client";
import { refreshRepairStockAction } from "@/app/actions/repair-stock";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ປຸ່ມ "ດຶງໃໝ່" — ດຶງຄົງເຫຼືອຈາກ ERP (ຊ້າ ~25ວິ) ⇒ ມີ spinner + ຂໍ້ຄວາມ. */
export function RefreshRepairStock({ refreshedAt }: { refreshedAt: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">
        ອັບເດດຂໍ້ມູນ: <b className="tabular-nums text-slate-700">{refreshedAt ?? "ຍັງບໍ່ໄດ້ດຶງ"}</b>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await refreshRepairStockAction();
            if (res.error) setError(res.error);
            else router.refresh();
          })
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        <RotateCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />
        {pending ? "ກຳລັງດຶງ… (~25ວິ)" : "ດຶງໃໝ່ຈາກ ERP"}
      </button>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertTriangle className="size-3.5" /> {error}
        </span>
      )}
    </div>
  );
}
