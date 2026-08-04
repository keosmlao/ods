"use client";
import { Camera, LoaderCircle, X } from "lucide-react";
import { useState } from "react";

/**
 * ປຸ່ມ "ຫຼັກຖານການສົ່ງ" ໃນຄິວ — ກົດແລ້ວຄ່ອຍດຶງຮູບ.
 *
 * ຢູ່ຄິວມີເປັນຮ້ອຍແຖວ ແລະ ຮູບເປັນ data URI base64 100-200KB ຕໍ່ໃບ
 * ⇒ ໂຫຼດມາພ້ອມໜ້າ = ໜ້າໜັກຫຼາຍສິບ MB. ດຶງເມື່ອກົດເທົ່ານັ້ນ.
 */
export function DeliveryProof({
  billNo,
  count,
  labels,
}: {
  billNo: string;
  count: number;
  labels: { proof: string; loading: string; none: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function show() {
    setOpen(true);
    if (photos !== null || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/installations/delivery?bill=${encodeURIComponent(billNo)}`);
      const json = await response.json();
      setPhotos(json.data ?? []);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-100"
      >
        <Camera className="size-3" />
        {labels.proof} {count}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-brand-900/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {labels.proof} · {billNo}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label={labels.close}
              >
                <X className="size-4" />
              </button>
            </div>

            {loading && (
              <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" />
                {labels.loading}
              </p>
            )}

            {!loading && photos !== null && photos.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">{labels.none}</p>
            )}

            {!loading && photos !== null && photos.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {photos.map((src, index) => (
                  <a key={index} href={src} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URI ຈາກຖານ */}
                    <img
                      src={src}
                      alt={`${labels.proof} ${index + 1}`}
                      className="w-full rounded-lg border border-slate-200 object-contain"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
