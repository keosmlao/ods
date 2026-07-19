"use client";
import { dispatchPickup, receivePickup, undoDispatchPickup } from "@/app/actions/repair";
import { useConfirm } from "@/components/confirm-dialog";
import { UndoButton } from "@/components/checking/undo-button";
import { Button } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { AlertTriangle, LoaderCircle, PackageCheck, Truck } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມ "ອອກໄປຮັບ" (PS) — CS/ຝ່າຍບໍລິການ ໝາຍວ່າຂົນສົ່ງອອກເດີນທາງໄປຮັບເຄື່ອງບ້ານລູກຄ້າ.
 * ວຽກຍ້າຍ "ລໍໄປຮັບເຄື່ອງ" → "ກຳລັງໄປຮັບ" (ຍັງຢູ່ຂັ້ນ 0 ຈົນກວ່າຮັບເຂົ້າສູນ).
 */
export function DispatchPickupButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();
  const t = useDict().receivePickupButton;

  return (
    <>
      {dialog}
      <div className="flex flex-col items-start gap-1">
        <Button
          tone="primary"
          size="sm"
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: t.dispatchTitle,
              message: (
                <>
                  {t.dispatchMsgPre} <b>{t.dispatchMsgBold}</b> {t.dispatchMsgMid} <b className="text-slate-700">#{code}</b>{" "}
                  {t.dispatchMsgTail}
                </>
              ),
              confirmLabel: t.dispatch,
            });
            if (!ok) return;
            setError(null);
            start(async () => {
              const res = await dispatchPickup(code);
              if (res?.error) setError(res.error);
            });
          }}
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Truck className="size-3.5" />}
          {t.dispatch}
        </Button>
        {error && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
            <AlertTriangle className="size-3 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/** ປຸ່ມ "ຍົກເລີກອອກໄປຮັບ" — ໝາຍຜິດໃບ ໃຫ້ວຽກກັບໄປ "ລໍໄປຮັບເຄື່ອງ". */
export function UndoDispatchPickupButton({ code, variant }: { code: string; variant?: "button" | "icon" }) {
  const t = useDict().receivePickupButton;
  return (
    <UndoButton
      variant={variant}
      label={t.undoDispatchLabel}
      title={t.undoDispatchTitle}
      message={
        <>
          {t.undoDispatchMsgPre} <b className="text-slate-700">#{code}</b> {t.undoDispatchMsgTail}
        </>
      }
      action={() => undoDispatchPickup(code)}
    />
  );
}

/**
 * ປຸ່ມ "ຮັບເຂົ້າສູນ" (PS) — ຂົນສົ່ງໄປຮັບເຄື່ອງບ້ານລູກຄ້າມາຮອດ, CS ກົດຢືນຢັນ.
 * ວຽກຍ້າຍຈາກ "ລໍໄປຮັບເຄື່ອງ" (ຂັ້ນ 0) → "ລໍຖ້າກວດເຊັກ" (ຂັ້ນ 1) ແລະ ເລີ່ມນັບໃນສະຕ໋ອກສູນ.
 */
export function ReceivePickupButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();
  const t = useDict().receivePickupButton;

  return (
    <>
      {dialog}
      <div className="flex flex-col items-start gap-1">
        <Button
          tone="primary"
          size="sm"
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: t.receiveTitle,
              message: (
                <>
                  {t.receiveMsgPre} <b className="text-slate-700">#{code}</b> {t.receiveMsgMid} <b>{t.receiveMsgBold}</b>{" "}
                  {t.receiveMsgTail}
                </>
              ),
              confirmLabel: t.receive,
            });
            if (!ok) return;
            setError(null);
            start(async () => {
              const res = await receivePickup(code);
              if (res?.error) setError(res.error);
            });
          }}
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />}
          {t.receive}
        </Button>
        {error && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
            <AlertTriangle className="size-3 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </>
  );
}
