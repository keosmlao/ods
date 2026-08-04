"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ActivitiesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <div className="w-full max-w-md rounded-2xl border border-brand-orange-400 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-10 text-brand-orange-700" />
        <h1 className="mt-3 text-lg font-bold text-slate-800">
          ໂຫຼດກິດຈະກຳບໍ່ສຳເລັດ
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ເກີດຂໍ້ຜິດພາດຊົ່ວຄາວ ກະລຸນາກົດລອງໃໝ່
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-900 px-4 text-xs font-semibold text-white hover:bg-brand-800"
        >
          <RotateCcw className="size-3.5" />
          ລອງໃໝ່
        </button>
      </div>
    </div>
  );
}
