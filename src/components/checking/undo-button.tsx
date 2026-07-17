"use client";
import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { LoaderCircle, Undo2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

/**
 * ປຸ່ມ "ຖອນຄືນ" ຂອງຂັ້ນວຽກ — ໃຊ້ຮ່ວມກັນທັງໜ້າກວດເຊັກ ແລະ ໜ້າສ້ອມແປງ.
 *
 * ຮູບແບບດຽວກັນທຸກບ່ອນ:
 *   ຖາມຢືນຢັນກ່ອນ (useConfirm — ບໍ່ໃຊ້ window.confirm) → ຍິງ action →
 *   ຖ້າ server ປະຕິເສດ ສະແດງເຫດຜົນເປັນກ່ອງຂໍ້ຄວາມ (ບອກເລກທີເອກະສານທີ່ກີດຂວາງ)
 *
 * ສຳຄັນ: ການກັນຢູ່ນີ້ເປັນພຽງ "ບໍ່ໃຫ້ກົດຫຼິ້ນ" — ກົດເກນຈິງບັງຄັບຢູ່ຝັ່ງ server ໝົດ
 * (actions/checking.ts, actions/repair.ts) ເພາະ server action ຖືກຍິງໂດຍກົງໄດ້.
 */
export function UndoButton({
  label,
  title,
  message,
  action,
  variant = "button",
  buttonLabel,
  className = "",
}: {
  label: string;
  title: string;
  message: ReactNode;
  action: () => Promise<{ error?: string }>;
  /** button = ປຸ່ມເຕັມ (ໜ້າລາຍລະອຽດ) · icon = ປຸ່ມນ້ອຍໃນຕາຕະລາງ */
  variant?: "button" | "icon";
  /** ຂໍ້ຄວາມສັ້ນທີ່ສະແດງເທິງປຸ່ມ; label ຍັງໃຊ້ກັບ dialog/aria ເພື່ອບອກ action ຕົວຈິງ */
  buttonLabel?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  const run = async () => {
    const ok = await ask({ title, message, confirmLabel: label, cancelLabel: "ບໍ່", tone: "warning" });
    if (!ok) return;
    start(async () => {
      const result = await action();
      setError(result?.error ?? "");
    });
  };

  return (
    <>
      {dialog}
      {/* ຖືກປະຕິເສດ → ບອກເຫດຜົນເປັນພາສາລາວ ພ້ອມເລກທີເອກະສານທີ່ກີດຂວາງ */}
      <ConfirmDialog
        open={Boolean(error)}
        title="ຖອນຄືນບໍ່ໄດ້"
        message={error}
        confirmLabel="ເຂົ້າໃຈແລ້ວ"
        cancelLabel="ປິດ"
        tone="danger"
        onConfirm={() => setError("")}
        onCancel={() => setError("")}
      />

      {variant === "icon" ? (
        <button
          type="button"
          title={label}
          aria-label={label}
          disabled={pending}
          onClick={run}
          className={`grid size-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 ${className}`}
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={run}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 ${className}`}
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
          {buttonLabel ?? label}
        </button>
      )}
    </>
  );
}
