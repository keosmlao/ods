"use client";
import { requestCancel, undoCancel } from "@/app/actions/service";
import { useDict } from "@/lib/i18n/context";
import { Ban, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ຄື modal "ລາຍລະອຽດຍົກເລີກ" + /submit_ccpro/<code> ຂອງ ods */
export function CancelJobButton({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useDict().serviceCancelButtons;

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await requestCancel(code, remark);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        setRemark("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(""); setOpen(true); }}
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#C82333] px-3 text-xs font-semibold text-white transition hover:opacity-90"
      >
        <Ban className="size-3.5" />
        {t.cancelReceive}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-12 items-center bg-[#C82333] px-5 text-sm font-bold text-white">{t.cancelDetailsTitle}</div>
            <div className="p-5 text-left">
              <h4 className="mb-3 font-bold text-slate-700">{t.enterDetails}</h4>
              <p className="mb-2 text-xs text-slate-400">{t.receiptCodeLabel} {code}</p>
              <input
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder={t.remarkPlaceholder}
                className="h-12 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500"
              />
              {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <hr className="my-4 border-slate-100" />
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={submit}
                  className="inline-flex h-10 w-36 items-center justify-center gap-2 rounded-lg bg-teal-600 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {pending && <LoaderCircle className="size-4 animate-spin" />}
                  {t.save}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { setOpen(false); setRemark(""); }}
                  className="inline-flex h-10 w-36 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.exit}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** ຄື deleteitem() + /cc_ccpro/<code> ຂອງ ods — ຖອນການຍົກເລີກ (ກັບໄປ status=1) */
export function UndoCancelButton({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useDict().serviceCancelButtons;

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await undoCancel(code);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        title={t.undoCancelTitle}
        onClick={() => { setError(""); setOpen(true); }}
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
      >
        <RotateCcw className="size-3.5" />
        {t.undo}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full border-4 border-amber-300 text-amber-500">
              <TriangleAlert className="size-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{t.confirmTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">{t.confirmMessage}</p>
            <p className="mt-1 text-xs text-slate-400">{t.receiptCodeLabel} {code}</p>
            {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#3085d6] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                {t.confirmOk}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-lg bg-[#d33] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {t.exit}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
