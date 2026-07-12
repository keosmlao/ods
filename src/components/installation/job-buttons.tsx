"use client";
import type { ActionState } from "@/app/actions/installation";
import { cancelInstall } from "@/app/actions/installation";
import { useConfirm, type ConfirmTone } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

type Tone = "primary" | "success" | "danger" | "neutral" | "info";

/** ປຸ່ມທີ່ເອີ້ນ server action ດ້ວຍ code ແລ້ວ refresh ໜ້າ — ຖາມຢືນຢັນກ່ອນຖ້າມີ confirmTitle */
export function JobButton({
  code,
  action,
  children,
  tone = "primary",
  confirmTitle,
  confirmTone,
  className,
}: {
  code: string;
  action: (code: string) => Promise<ActionState>;
  children: ReactNode;
  tone?: Tone;
  confirmTitle?: string;
  confirmTone?: ConfirmTone;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  return (
    <>
      {dialog}
      <Button
        type="button"
        tone={tone}
        disabled={pending}
        className={className}
        onClick={async () => {
          if (confirmTitle && !(await ask({ title: confirmTitle, tone: confirmTone }))) return;
          setError("");
          start(async () => {
            const result = await action(code);
            if (result?.error) setError(result.error);
            else router.refresh();
          });
        }}
      >
        {children}
      </Button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}

/** ຍົກເລີກງານ — ຕ້ອງໃສ່ໝາຍເຫດ (ຄືກັບ modal ໃນ Homeinstall.html) */
export function CancelJobButton({ code, onDone }: { code: string; onDone?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        title="ຍົກເລີກ"
        className="text-[#DE3163] hover:opacity-70"
        onClick={() => {
          setRemark("");
          setError("");
          setOpen(true);
        }}
      >
        <Ban className="size-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="rounded-t-xl bg-[#E74033] px-5 py-3 font-bold text-white">ຍົກເລີກງານຕິດຕັ້ງ</div>
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-600">
                ລະຫັດງານ: <strong className="text-red-600">{code}</strong>
              </p>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                ຫມາຍເຫດຍົກເລີກ <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="ລະບຸເຫດຜົນ..."
                className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-teal-500"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
              <Button type="button" tone="neutral" onClick={() => setOpen(false)}>
                ອອກ
              </Button>
              <Button
                type="button"
                tone="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await cancelInstall(code, remark);
                    if (result.error) setError(result.error);
                    else {
                      setOpen(false);
                      router.refresh();
                      onDone?.();
                    }
                  })
                }
              >
                ຢືນຢັນຍົກເລີກ
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
