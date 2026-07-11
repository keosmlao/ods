"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import type { ActionState } from "./types";

/* ຊິ້ນສ່ວນທີ່ໜ້າ /manage ແລະ /customers ໃຊ້ຮ່ວມກັນ */

/** ແຈ້ງເຕືອນ — ຄື flash message ຂອງ Flask (ຫາຍໄປເອງໃນ 4 ວິນາທີ ຄື ods) */
export function Alert({ state, onClear }: { state: ActionState; onClear?: () => void }) {
  const message = state.ok ?? state.error;
  // ຈື່ "state ໜ່ວຍໃດທີ່ປິດໄປແລ້ວ" ແທນ boolean — ຂໍ້ຄວາມຊໍ້າກັນຄັ້ງໃໝ່ຈຶ່ງສະແດງຄືນໄດ້
  // (useActionState ຄືນ object ໃໝ່ທຸກຄັ້ງ)
  const [dismissed, setDismissed] = useState<ActionState | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setDismissed(state);
      onClear?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, state, onClear]);

  if (!message || dismissed === state) return null;
  const good = Boolean(state.ok);
  return (
    <p
      role="status"
      className={`rounded-lg border p-3 text-center text-sm font-semibold ${
        good ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </p>
  );
}

/** ປຸ່ມລົບ + ຖາມຢືນຢັນ — ຄື swal ຂອງ ods */
export function DeleteButton<Id extends string | number>({
  id,
  action,
  onResult,
  confirmText = "ທ່ານແນ່ໃຈບໍ?\nທ່ານບໍ່ສາມາກເອີ້ນກັບຄືນໃດ້!",
}: {
  id: Id;
  action: (id: Id) => Promise<ActionState>;
  onResult: (state: ActionState) => void;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { ask, dialog } = useConfirm();

  // confirmText ຍັງເປັນ string ຄືເກົ່າ — ແຖວທຳອິດເປັນຄຳຖາມ, ແຖວທີ່ເຫຼືອເປັນລາຍລະອຽດ
  const [title, ...rest] = confirmText.split("\n");
  const detail = rest.join(" ").trim();

  return (
    <>
      {dialog}
      <button
        type="button"
        title="ລົບ"
        disabled={pending}
        className="text-[#DC3545] transition hover:opacity-70 disabled:opacity-40"
        onClick={async () => {
          const ok = await ask({
            title,
            message: detail || undefined,
            confirmLabel: "ລົບ",
            cancelLabel: "ບໍ່",
            tone: "danger",
          });
          if (!ok) return;
          startTransition(async () => {
            const state = await action(id);
            onResult(state);
            router.refresh();
          });
        }}
      >
        <Trash2 className="size-4" />
      </button>
    </>
  );
}

/** ປຸ່ມບັນທຶກທີ່ຮູ້ສະຖານະ pending ຂອງຟອມ */
export function SubmitButton({ children = "ບັນທຶກ", pending }: { children?: ReactNode; pending: boolean }) {
  return (
    <Button type="submit" tone="success" disabled={pending}>
      {pending ? "ກຳລັງບັນທຶກ..." : children}
    </Button>
  );
}

/** ຂໍ້ຄວາມແຈ້ງເຕືອນທີ່ບໍ່ໄດ້ມາຈາກ useActionState (ເຊັ່ນ: ຜົນຂອງການລົບ) */
export function useActionAlert() {
  const [state, setState] = useState<ActionState>({});
  const clear = useCallback(() => setState({}), []);
  return { state, setState, clear };
}
