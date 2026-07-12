"use client";
import { feedbackQr } from "@/app/actions/installation";
import { Button } from "@/components/ui";
import { Check, Copy, LoaderCircle, QrCode, X } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມ "QR ແບບສອບຖາມ" — ຊ່າງເປີດໃຫ້ລູກຄ້າສະແກນຕອບຢູ່ໜ້າງານ ຫຼັງຕິດຕັ້ງແລ້ວ.
 *
 * ງານຕິດຕັ້ງຄ້າງຢູ່ຂັ້ນ "ຕິດຕັ້ງສຳເລັດ" ຈົນກວ່າລູກຄ້າຈະຕອບແບບສອບຖາມ ແຕ່ບໍ່ມີຊ່ອງທາງ
 * ສົ່ງລິ້ງຫາລູກຄ້າເລີຍ (LINE ປິດແລ້ວ) ⇒ ໃຫ້ລູກຄ້າສະແກນເອົາຢູ່ບ່ອນນັ້ນເລີຍ ໄວກວ່າ ແລະ
 * ບໍ່ຕ້ອງພຶ່ງບໍລິການພາຍນອກ. ກົດເກນຈິງ (ຕິດຕັ້ງແລ້ວບໍ / ຕອບແລ້ວບໍ / ເປັນງານຂອງທ່ານບໍ)
 * ບັງຄັບຢູ່ຝັ່ງ server ໝົດ (actions/installation.ts feedbackQr).
 */
export function FeedbackQrButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = () =>
    start(async () => {
      const result = await feedbackQr(code);
      if ("error" in result) {
        setError(result.error);
        setQr(null);
      } else {
        setQr(result);
        setError("");
      }
      setOpen(true);
    });

  const copy = async () => {
    if (!qr) return;
    await navigator.clipboard.writeText(qr.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button
        tone="info"
        disabled={pending}
        className="h-8 px-3 text-xs"
        title="ໃຫ້ລູກຄ້າສະແກນຕອບແບບສອບຖາມ"
        onClick={load}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <QrCode className="size-3.5" />}
        QR ແບບສອບຖາມ
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">ແບບສອບຖາມ {code}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-4" />
              </button>
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-4 text-xs font-semibold text-red-700">{error}</p>
            ) : qr ? (
              <>
                <p className="mb-3 text-xs text-slate-500">ໃຫ້ລູກຄ້າສະແກນ QR ນີ້ ເພື່ອຕອບແບບສອບຖາມ</p>
                {/* svg ມາຈາກ qrcode ຢູ່ຝັ່ງ server (ບໍ່ແມ່ນ input ຂອງຜູ້ໃຊ້) */}
                <div
                  className="mx-auto w-fit rounded-xl border border-slate-200 bg-white p-3"
                  dangerouslySetInnerHTML={{ __html: qr.svg }}
                />
                <p className="mt-3 truncate text-[11px] text-slate-400" title={qr.url}>
                  {qr.url}
                </p>
                <Button tone="neutral" className="mt-3 h-8 w-full justify-center px-3 text-xs" onClick={copy}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "ສຳເນົາແລ້ວ" : "ສຳເນົາລິ້ງ"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
