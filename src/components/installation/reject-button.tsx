"use client";
import { rejectJobAction } from "@/app/actions/job-reject";
import { Button, inputClass } from "@/components/ui";
import type { Workflow } from "@/lib/commission";
import { LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ປະຕິເສດງານ ພ້ອມ **ເຫດຜົນ** — ຈາກເວັບ (ແອັບມືຖືເຮັດອັນດຽວກັນຜ່ານ /api/mobile).
 *
 * ແຕ່ກ່ອນປຸ່ມ "ບໍ່ຮັບ" ຄືນງານໄປຄິວຈັດຊ່າງ **ໂດຍບໍ່ຖາມເຫດຜົນ ແລະ ບໍ່ແຈ້ງໃຜ**
 * ⇒ CS ເຫັນງານເດັ້ງກັບມາໃນຄິວ ໂດຍບໍ່ຮູ້ວ່າຍ້ອນຫຍັງ ແລະ ຈັດໃຫ້ຊ່າງຄົນເກົ່າຄືນອີກໄດ້.
 * ດຽວນີ້ເຫດຜົນຖືກເກັບ (ods_job_reject) ແລະ ແຈ້ງເຕືອນເຖິງ CS ທັນທີ.
 */
export function RejectButton({
  workflow,
  code,
  className = "h-8 px-3 text-xs",
}: {
  workflow: Workflow;
  code: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button type="button" tone="danger" className={className} onClick={() => setOpen(true)}>
        ບໍ່ຮັບ
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="ເຫດຜົນ (ຕິດງານ, ຢູ່ໄກ...)"
          className={`${inputClass} h-8 w-44 text-xs`}
        />
        <Button
          type="button"
          tone="danger"
          className="h-8 px-2 text-xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await rejectJobAction(workflow, code, reason);
              if (result.error) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            })
          }
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          ຢືນຢັນ
        </Button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="grid size-8 place-items-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50"
        >
          <X className="size-3.5" />
        </button>
      </span>
      {error && <span className="text-[11px] font-semibold text-red-600">{error}</span>}
    </span>
  );
}
