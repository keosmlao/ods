"use client";
import { returnWithoutInvoice } from "@/app/actions/return";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox } from "@/components/ui";
import { Ban, LoaderCircle, PackageCheck } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ວຽກທີ່ຖືກຍົກເລີກ — ສົ່ງເຄື່ອງຄືນລູກຄ້າໂດຍບໍ່ສ້ອມ (GAP A).
 *
 * ຢູ່ໜ້າດຽວກັນນີ້ຜູ້ໃຊ້ເລືອກໄດ້ 2 ທາງ:
 *   ອອກໃບຮັບເງິນຄ່າກວດເຊັກ → ໃຊ້ຟອມຂ້າງລຸ່ມ (InvoiceEditor) ຕາມປົກກະຕິ
 *   ບໍ່ເກັບເງິນ            → ປຸ່ມນີ້ (ບໍ່ອອກເອກະສານເງິນ ພຽງແຕ່ປະທັບວ່າສົ່ງຄືນແລ້ວ)
 */
export function ReturnWithoutInvoice({ code, outstandingLines }: { code: string; outstandingLines: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      {dialog}
      <div className="flex flex-wrap items-center gap-3">
        <Ban className="size-4 shrink-0 text-red-600" />
        <div className="min-w-56 flex-1">
          <h2 className="text-sm font-bold text-slate-700">ວຽກນີ້ຖືກຍົກເລີກ — ສົ່ງຄືນໂດຍບໍ່ສ້ອມ</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ຕະກ້າຈະບໍ່ຖືກຕື່ມອາໄຫຼ່ອັດຕະໂນມັດ (ອາໄຫຼ່ຕ້ອງສົ່ງຄືນສາງ ບໍ່ແມ່ນຄິດເງິນລູກຄ້າ).
            ຖ້າຈະເກັບຄ່າກວດເຊັກ ໃຫ້ເລືອກ &quot;ລາຍການຄ່າບໍລິການ&quot; ຂ້າງລຸ່ມ ແລ້ວກົດ ບັນທືກ ເພື່ອອອກໃບຮັບເງິນ.
          </p>
        </div>
        <Button
          type="button"
          tone="neutral"
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: "ສົ່ງຄືນລູກຄ້າໂດຍບໍ່ອອກໃບຮັບເງິນ?",
              message: (
                <>
                  ໃບຮັບເຄື່ອງ <b className="text-slate-700">{code}</b> ຈະຖືກປະທັບວ່າ ສົ່ງຄືນແລ້ວ ໂດຍບໍ່ມີໃບຮັບເງິນ.
                  {outstandingLines > 0 && (
                    <>
                      {" "}
                      <b className="text-amber-700">
                        ເຕືອນ: ຍັງມີອາໄຫຼ່ {outstandingLines} ລາຍການ ທີ່ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ
                      </b>{" "}
                      — ຢ່າລືມສ້າງໃບຂໍສົ່ງອາໄຫຼ່ຄືນ.
                    </>
                  )}
                </>
              ),
              confirmLabel: "ສົ່ງຄືນ",
              tone: outstandingLines > 0 ? "warning" : "default",
            });
            if (!ok) return;
            const data = new FormData();
            data.set("pro_code", code);
            start(async () => {
              const result = await returnWithoutInvoice({}, data);
              setError(result?.error ?? "");
            });
          }}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
          ສົ່ງຄືນໂດຍບໍ່ອອກໃບຮັບເງິນ
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </div>
  );
}
