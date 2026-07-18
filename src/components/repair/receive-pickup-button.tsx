"use client";
import { dispatchPickup, receivePickup, undoDispatchPickup } from "@/app/actions/repair";
import { useConfirm } from "@/components/confirm-dialog";
import { UndoButton } from "@/components/checking/undo-button";
import { Button } from "@/components/ui";
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
              title: "ອອກໄປຮັບເຄື່ອງ?",
              message: (
                <>
                  ໝາຍວ່າຂົນສົ່ງ <b>ອອກເດີນທາງ</b> ໄປຮັບເຄື່ອງໃບ <b className="text-slate-700">#{code}</b> ທີ່ບ້ານລູກຄ້າ —
                  ວຽກຍ້າຍໄປ &quot;ກຳລັງໄປຮັບ&quot;
                </>
              ),
              confirmLabel: "ອອກໄປຮັບ",
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
          ອອກໄປຮັບ
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
  return (
    <UndoButton
      variant={variant}
      label="ຍົກເລີກອອກໄປຮັບ"
      title="ຍົກເລີກ ອອກໄປຮັບ?"
      message={
        <>
          ໃບ <b className="text-slate-700">#{code}</b> ຈະກັບໄປ &quot;ລໍໄປຮັບເຄື່ອງ&quot; (ຍັງບໍ່ອອກເດີນທາງ)
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
              title: "ຮັບເຄື່ອງເຂົ້າສູນ?",
              message: (
                <>
                  ໃບຮັບເຄື່ອງ <b className="text-slate-700">#{code}</b> ຖືວ່າ <b>ມາຮອດສູນແລ້ວ</b> ແລະ ຈະຍ້າຍໄປ
                  &quot;ລໍຖ້າກວດເຊັກ&quot; — ໝາຍເມື່ອຂົນສົ່ງເອົາເຄື່ອງມາຮອດຈິງເທົ່ານັ້ນ
                </>
              ),
              confirmLabel: "ຮັບເຂົ້າສູນ",
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
          ຮັບເຂົ້າສູນ
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
