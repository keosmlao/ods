"use client";
import type { DeliveryInfo } from "@/lib/delivery";
import { Camera, LoaderCircle, MapPin, Navigation, Truck } from "lucide-react";
import { useState } from "react";

/**
 * ກ່ອງ "ການສົ່ງເຄື່ອງ" ຢູ່ໜ້າລາຍລະອຽດງານຕິດຕັ້ງ.
 *
 * ຈຸດປະສົງ: ຊ່າງກົດເປີດແຜນທີ່ໄປ **ບ່ອນທີ່ເຄື່ອງຖືກສົ່ງໄປແທ້** ໄດ້ເລີຍ
 * ແລະ CS ເບິ່ງຮູບຕອນສົ່ງເປັນຫຼັກຖານ (ເຄື່ອງວາງໄວ້ໃສ · ບ້ານໜ້າຕາແນວໃດ).
 *
 * ຮູບບໍ່ໄດ້ໂຫຼດມາພ້ອມໜ້າ — ເປັນ base64 ຫຼາຍ 100KB ຕໍ່ຮູບ ⇒ ດຶງຕອນກົດເທົ່ານັ້ນ.
 */
export function DeliveryCard({ info, labels }: { info: DeliveryInfo; labels: DeliveryLabels }) {
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const hasGeo = info.lat != null && info.lng != null;
  const mapsUrl = hasGeo ? `https://www.google.com/maps?q=${info.lat},${info.lng}` : null;

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/installations/delivery?bill=${encodeURIComponent(info.bill_no)}`);
      const json = await response.json();
      setPhotos(json.data ?? []);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
        <Truck className="size-4 text-brand-800" />
        {labels.title}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
          {info.bill_no}
        </span>
      </h2>

      <div className="space-y-3 p-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-400">{labels.sentAt}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{info.sent_end ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{labels.checkinAt}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{info.checkin_at ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{labels.dropPoint}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">
              {hasGeo ? `${info.lat?.toFixed(6)}, ${info.lng?.toFixed(6)}` : labels.noDropPoint}
            </dd>
          </div>

          {/* ຄົນຮັບເຄື່ອງອາດບໍ່ແມ່ນຄົນໃນບິນ ⇒ ເບີນີ້ຄືເບີທີ່ຕິດຕໍ່ໄດ້ຈິງ */}
          {info.telephone && (
            <div>
              <dt className="text-xs text-slate-400">{labels.receiverPhone}</dt>
              <dd className="mt-1 text-sm font-medium">
                <a href={`tel:${info.telephone}`} className="text-brand hover:underline">
                  {info.telephone}
                </a>
              </dd>
            </div>
          )}

          {info.remark && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-400">{labels.driverNote}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{info.remark}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap gap-2">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white transition hover:bg-brand-700"
            >
              <Navigation className="size-3.5" />
              {labels.openMap}
            </a>
          )}
          {info.photos > 0 && photos === null && (
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              {labels.viewPhotos} ({info.photos})
            </button>
          )}
        </div>

        {photos !== null &&
          (photos.length === 0 ? (
            <p className="text-xs text-slate-400">{labels.noPhotos}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {photos.map((src, index) => (
                <a key={index} href={src} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI ຈາກຖານ, next/image ໃຊ້ບໍ່ໄດ້ */}
                  <img
                    src={src}
                    alt={`${labels.title} ${index + 1}`}
                    className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                  />
                </a>
              ))}
            </div>
          ))}

        {!hasGeo && (
          <p className="flex items-center gap-1.5 text-xs text-brand-900">
            <MapPin className="size-3.5" />
            {labels.noDropPointHint}
          </p>
        )}
      </div>
    </section>
  );
}

export type DeliveryLabels = {
  title: string;
  sentAt: string;
  checkinAt: string;
  dropPoint: string;
  receiverPhone: string;
  driverNote: string;
  noDropPoint: string;
  noDropPointHint: string;
  openMap: string;
  viewPhotos: string;
  noPhotos: string;
};
