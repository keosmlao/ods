"use client";
import { acceptRepairJob } from "@/app/actions/repair";
import { Button } from "@/components/ui";
import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ປຸ່ມ "ຮັບງານ" ຂອງຊ່າງ (ຂັ້ນ ລໍຖ້າຊ່າງຮັບ) — ຕັ້ງ repair_confirm ຜ່ານ acceptRepairJob. */
export function AcceptRepairButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Button
        tone="success"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await acceptRepairJob(code);
            if (result.error) setError(result.error);
            else {
              setError("");
              router.refresh();
            }
          })
        }
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        ຮັບງານ
      </Button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  );
}
