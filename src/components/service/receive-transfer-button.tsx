"use client";
import { receiveJobTransfer } from "@/app/actions/job-transfer";
import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມ "ຮັບເຂົ້າ" ຂອງສູນປາຍທາງ — ປິດການໂອນ ແລ້ວຕັ້ງ service_center = ສູນນີ້.
 * ດ່ານຈິງຢູ່ actions/job-transfer (ກວດສິດ + ກວດວ່າມີການໂອນທີ່ລໍຢູ່ແທ້).
 */
export function ReceiveTransferButton({
  code,
  label,
  busyLabel,
}: {
  code: string;
  label: string;
  busyLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const result = await receiveJobTransfer(code);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          })
        }
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {pending ? busyLabel : label}
      </button>
      {error && <span className="text-[11px] font-semibold text-brand-orange-700">{error}</span>}
    </div>
  );
}
