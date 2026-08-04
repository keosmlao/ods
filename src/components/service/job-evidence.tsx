import { LogIn, LogOut, MapPin } from "lucide-react";

/**
 * ຫຼັກຖານໜ້າງານ + ຮູບ — ສະແດງ **ຢູ່ໜ້າລາຍລະອຽດເລີຍ** (ບໍ່ຕ້ອງກົດເຂົ້າ /images).
 *
 * check-in/out: ເວລາ + ພິກັດ (ກົດເປີດ Google Maps) + ຮູບໜ້າງານ (ຫຼັກຖານວ່າຊ່າງໄປຮອດ).
 * ຮູບ: ຮັບເຄື່ອງ (ໄຟລ໌ /api/uploads) · ກວດເຊັກ · ສ້ອມສຳເລັດ (base64 ods_job_photo).
 */

export type Checkin = {
  id: number;
  job_code: string;
  tech_code: string;
  checkin_at: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_photo: string | null;
  checkout_at: string | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  note: string | null;
};
export type ReceivePhoto = { roworder: number; product_url: string; line_number: number };
export type JobPhoto = { id: number; photo: string; created_by: string; created_at: string };

const mapUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

export function JobEvidence({
  checkins,
  receive,
  checkPhotos,
  finishPhotos,
  serviceType,
}: {
  checkins: Checkin[];
  receive: ReceivePhoto[];
  checkPhotos: JobPhoto[];
  finishPhotos: JobPhoto[];
  serviceType: string | null;
}) {
  const totalPhotos = receive.length + checkPhotos.length + finishPhotos.length;
  if (checkins.length === 0 && totalPhotos === 0) return null;

  // ຮູບ "ສ້ອມສຳເລັດ" ຮູບທຳອິດ — ຄູ່ກັບ check-in ໃນບັດຫຼັກฐาน (checkout = ຈົບงານ)
  const completion = finishPhotos[0] ?? null;

  return (
    <div className="space-y-4">
      {checkins.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
            <MapPin className="size-4 text-brand-orange-700" />
            ຫຼັກຖານໜ້າງານ (check-in · ສ້ອມສຳເລັດ · check-out)
            {serviceType && <span className="text-[10px] font-medium text-slate-400">· {serviceType}</span>}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {checkins.map((c, i) => (
              <CheckinCard key={i} c={c} completion={completion} />
            ))}
          </div>
        </section>
      )}

      {receive.length > 0 && (
        <PhotoSection title="ຮູບຕອນຮັບເຄື່ອງ" count={receive.length} accent="text-slate-600">
          {receive.map((image) => (
            <FilePhoto key={`r-${image.roworder}`} url={image.product_url} alt={`ຮັບເຄື່ອງ ${image.line_number + 1}`} />
          ))}
        </PhotoSection>
      )}

      {checkPhotos.length > 0 && (
        <PhotoSection title="ຮູບຕອນກວດເຊັກ" count={checkPhotos.length} accent="text-brand-600">
          {checkPhotos.map((p) => (
            <Base64Photo key={p.id} id={p.id} src={p.photo} caption={`${p.created_by} · ${p.created_at}`} />
          ))}
        </PhotoSection>
      )}

      {finishPhotos.length > 0 && (
        <PhotoSection title="ຮູບຕອນສ້ອມສຳເລັດ" count={finishPhotos.length} accent="text-brand-800">
          {finishPhotos.map((p) => (
            <Base64Photo key={p.id} id={p.id} src={p.photo} caption={`${p.created_by} · ${p.created_at}`} />
          ))}
        </PhotoSection>
      )}
    </div>
  );
}

/** ບັດ check-in ໜຶ່ງຄັ້ງ — ຮູບໄປຮອດ + ຮູບສ້ອມສຳເລັດ (ຄູ່ກັນ) + ເວລາເຂົ້າ/ອອກ + ພິກັດ */
function CheckinCard({ c, completion }: { c: Checkin; completion: JobPhoto | null }) {
  const photo = c.checkin_photo ? asUri(c.checkin_photo) : null;
  // ຮູບສ້ອມສຳເລັດ ຄູ່ກັບ check-out (ຈົບงານ) — ສະແດງເມື່ອ checkout ແລ້ວ ແລະ ມີຮູບ
  const done = c.checkout_at ? completion : null;
  const inMap = c.checkin_lat != null && c.checkin_lng != null ? mapUrl(c.checkin_lat, c.checkin_lng) : null;
  const outMap = c.checkout_lat != null && c.checkout_lng != null ? mapUrl(c.checkout_lat, c.checkout_lng) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="grid grid-cols-2">
        <EvidencePhoto
          src={photo}
          href={`/api/checkin-photo/${encodeURIComponent(c.job_code)}?id=${c.id}`}
          label="ໄປຮອດ"
          empty="ບໍ່ມີຮູບ"
        />
        <EvidencePhoto
          src={done ? asUri(done.photo) : null}
          href={done ? `/api/job-photo/${done.id}` : ""}
          label="ສ້ອມສຳເລັດ"
          empty={c.checkout_at ? "—" : "ຍັງບໍ່ຈົບ"}
        />
      </div>
      <div className="space-y-1.5 border-t border-slate-100 p-2.5 text-xs">
        <div className="font-semibold text-slate-700">{c.tech_code}</div>
        <EvidenceRow icon={<LogIn className="size-3.5 text-brand-800" />} label="ເຂົ້າ" time={c.checkin_at} map={inMap} />
        <EvidenceRow icon={<LogOut className="size-3.5 text-slate-500" />} label="ອອກ" time={c.checkout_at} map={outMap} />
        {c.note?.trim() && <div className="pt-0.5 text-[11px] text-slate-500">{c.note.trim()}</div>}
      </div>
    </div>
  );
}

/**
 * ຮູບຫຼັກຖານ 1 ຮູບ ພ້ອມປ້າຍ (ໄປຮອດ / ສ້ອມສຳເລັດ)
 * src = data-URI (ສະແດງທັນທີ) · href = route ຮູບຈິງ (ກົດເປີດເຕັມ — ເບິ່ງ lib/photo-response)
 */
function EvidencePhoto({ src, href, label, empty }: { src: string | null; href: string; label: string; empty: string }) {
  return (
    <div className="relative">
      {src ? (
        <a href={href} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={label} className="h-40 w-full bg-slate-50 object-cover" />
        </a>
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-slate-50 text-[11px] text-slate-400">{empty}</div>
      )}
      <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">{label}</span>
    </div>
  );
}

function EvidenceRow({
  icon,
  label,
  time,
  map,
}: {
  icon: React.ReactNode;
  label: string;
  time: string | null;
  map: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="w-8 text-[10px] text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{time || "—"}</span>
      {map && (
        <a
          href={map}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded bg-brand-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-orange-700 hover:bg-brand-orange-100"
        >
          <MapPin className="size-3" />
          ພິກັດ
        </a>
      )}
    </div>
  );
}

function PhotoSection({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className={`mb-3 text-sm font-bold ${accent}`}>
        {title} <span className="text-slate-400">({count})</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** ຮູບໄຟລ໌ (product_image ຜ່ານ /api/uploads) */
function FilePhoto({ url, alt }: { url: string; alt: string }) {
  const src = `/api/uploads/${encodeURIComponent(url)}`;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-brand-300">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-52 w-full bg-slate-50 object-contain" />
    </a>
  );
}

/** base64 ໃນຖານ → data-URI (ໃສ່ <img src> ໄດ້; ໃສ່ href **ບໍ່ໄດ້** — Chrome ຫ້າມ) */
const asUri = (s: string) => (s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`);

/** ຮູບ base64 (data-URI) — ກົດເປີດເຕັມຜ່ານ /api/job-photo/<id> */
function Base64Photo({ id, src, caption }: { id: number; src: string; caption: string }) {
  const uri = asUri(src);
  return (
    <a href={`/api/job-photo/${id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-brand-300">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={uri} alt={caption} className="h-52 w-full bg-slate-50 object-contain" />
      <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-500">{caption}</p>
    </a>
  );
}
