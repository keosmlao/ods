"use client";

import { backfillInstallSerials } from "@/app/actions/install-serial";
import { Barcode, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ປຸ່ມລົງມື — ຢືນຢັນເທື່ອໜຶ່ງກ່ອນ ເພາະແຕະຂໍ້ມູນຫຼາຍພັນຊ່ອງ (ແຕ່ບໍ່ທັບຂອງເກົ່າ) */
export function BackfillButton({ slots, jobs }: { slots: number; jobs: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`ຈະຕື່ມ ${slots} ຊ່ອງ ໃນ ${jobs} ໃບງານ — ຕໍ່ໄປບໍ?`)) return;
          setError("");
          start(async () => {
            const result = await backfillInstallSerials();
            if (result.error) {
              setError(result.error);
              return;
            }
            setDone(`ຕື່ມແລ້ວ ${result.written} ຊ່ອງ`);
            router.refresh();
          });
        }}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Barcode className="size-4" />}
        ຕື່ມ ISN/SN ຄືນ ({slots} ຊ່ອງ)
      </button>
      {done && <p className="text-xs font-semibold text-brand-800">{done}</p>}
      {error && <p className="text-xs text-brand-orange-700">{error}</p>}
    </div>
  );
}
