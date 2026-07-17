"use client";
import { AlertTriangle, HelpCircle, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type ConfirmTone = "danger" | "warning" | "default";

const TONES: Record<ConfirmTone, { icon: typeof HelpCircle; ring: string; button: string }> = {
  danger: {
    icon: Trash2,
    ring: "bg-red-50 text-red-600",
    button: "bg-red-600 hover:bg-red-700",
  },
  warning: {
    icon: AlertTriangle,
    ring: "bg-amber-50 text-amber-600",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  default: {
    icon: HelpCircle,
    ring: "bg-teal-50 text-teal-600",
    button: "bg-teal-600 hover:bg-teal-700",
  },
};

/**
 * ກ່ອງຢືນຢັນຂອງລະບົບ — ແທນ window.confirm() ຂອງ browser.
 *
 * ໃຊ້ <dialog> ຂອງ HTML ຈຶ່ງໄດ້ພຶດຕິກຳຖືກຕ້ອງໂດຍບໍ່ຕ້ອງຂຽນເອງ:
 * ດັກ focus ໄວ້ໃນກ່ອງ, ກົດ Esc ປິດ, ພື້ນຫຼັງກົດບໍ່ໄດ້.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "ຢືນຢັນ",
  cancelLabel = "ຍົກເລີກ",
  tone = "default",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const { icon: Icon, ring, button } = TONES[tone];

  return (
    <dialog
      ref={ref}
      data-no-nav
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
      onClick={(event) => { if (event.target === ref.current && !pending) onCancel(); }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 p-0 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-5">
        <div className="flex gap-3.5">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${ring}`}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {message && <div className="mt-1.5 text-xs leading-relaxed text-slate-500">{message}</div>}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            disabled={pending}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-white transition disabled:opacity-60 ${button}`}
          >
            {pending && <LoaderCircle className="size-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ---------------------------------------------------------------- */

type AskOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

/**
 * ໃຊ້ແທນ window.confirm() ໄດ້ 1:1 — ແຕ່ອອກມາເປັນ modal ຂອງລະບົບ.
 *
 *   const { ask, dialog } = useConfirm();
 *   ...
 *   if (!(await ask({ title: "ເລີ່ມກວດເຊັກ?" }))) return;
 *   ...
 *   return <>{dialog}<button .../></>;
 */
export function useConfirm() {
  const [request, setRequest] = useState<(AskOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const ask = (options: AskOptions) =>
    new Promise<boolean>((resolve) => setRequest({ ...options, resolve }));

  function settle(ok: boolean) {
    request?.resolve(ok);
    setRequest(null);
  }

  const dialog = (
    <ConfirmDialog
      open={request !== null}
      title={request?.title ?? ""}
      message={request?.message}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      tone={request?.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { ask, dialog };
}
