import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

/** ຄື /showpic/<id> ຂອງ ods — ສະແດງຮູບພາບສິນຄ້າຂອງໃບຮັບເຄື່ອງໃບດຽວ (ຈຳນວນຮູບຈຳກັດຢູ່ແລ້ວ) */
type Props = { params: Promise<{ code: string }> };

export default async function ServiceImages({ params }: Props) {
  const { code } = await params;

  const job = (
    await query<{ code: string; name_1: string; sn: string | null }>(
      "select code, name_1, sn from tb_product where code = $1 limit 1",
      [code],
    )
  ).rows[0];
  if (!job) notFound();

  // ① ຮູບຕອນຮັບເຄື່ອງ — ໄຟລ໌ຢູ່ product_image (ຕັດແຖວທີ່ product_url ວ່າງອອກ)
  const receive = (
    await query<{ roworder: number; product_url: string; line_number: number }>(
      `select roworder, product_url, coalesce(line_number,0) line_number
       from product_image
       where iteme_code = $1 and coalesce(product_url,'') <> ''
       order by line_number, roworder desc`,
      [code],
    )
  ).rows;

  // ②③ ຮູບຕອນກວດເຊັກ (kind='check') ແລະ ຕອນສ້ອມສຳເລັດ (kind='finish') — base64 ຢູ່ ods_job_photo
  const jobPhotos = (
    await query<{ id: number; kind: string; photo: string; created_by: string; created_at: string }>(
      `select id, kind, photo, created_by, to_char(created_at,'DD-MM-YYYY HH24:MI') created_at
       from ods_job_photo
       where workflow='repair' and job_code=$1 and kind in ('check','finish')
       order by id`,
      [code],
    )
  ).rows;
  const checkPhotos = jobPhotos.filter((p) => p.kind === "check");
  const finishPhotos = jobPhotos.filter((p) => p.kind === "finish");
  const total = receive.length + jobPhotos.length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <Link
          href={`/service/${code}`}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          ກັບໜ້າໃບຮັບເຄື່ອງ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ຮູບພາບ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {job.name_1} {job.sn && <span className="text-slate-400">· {job.sn}</span>} · ລະຫັດງານ {job.code} ·{" "}
          {total} ຮູບ
        </p>
      </div>

      {total === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="py-12 text-center text-xs text-slate-400">ບໍ່ມີຮູບ</p>
        </section>
      ) : (
        <>
          {/* ① ຕອນຮັບເຄື່ອງ — ໄຟລ໌ຜ່ານ /api/uploads */}
          {receive.length > 0 && (
            <PhotoSection title="ຮູບຕອນຮັບເຄື່ອງ" count={receive.length} accent="text-slate-600">
              {receive.map((image) => (
                <a
                  key={`r-${image.roworder}`}
                  href={`/api/uploads/${encodeURIComponent(image.product_url)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-teal-300"
                >
                  <Image
                    src={`/api/uploads/${encodeURIComponent(image.product_url)}`}
                    alt={`ຮັບເຄື່ອງ ${image.line_number + 1}`}
                    width={400}
                    height={300}
                    unoptimized
                    className="h-52 w-full bg-slate-50 object-contain"
                  />
                </a>
              ))}
            </PhotoSection>
          )}

          {/* ② ຕອນກວດເຊັກ — base64 */}
          {checkPhotos.length > 0 && (
            <PhotoSection title="ຮູບຕອນກວດເຊັກ" count={checkPhotos.length} accent="text-sky-700">
              {checkPhotos.map((p) => (
                <Base64Photo key={p.id} src={p.photo} caption={`${p.created_by} · ${p.created_at}`} />
              ))}
            </PhotoSection>
          )}

          {/* ③ ຕອນສ້ອມສຳເລັດ — base64 */}
          {finishPhotos.length > 0 && (
            <PhotoSection title="ຮູບຕອນສ້ອມສຳເລັດ" count={finishPhotos.length} accent="text-emerald-700">
              {finishPhotos.map((p) => (
                <Base64Photo key={p.id} src={p.photo} caption={`${p.created_by} · ${p.created_at}`} />
              ))}
            </PhotoSection>
          )}
        </>
      )}
    </div>
  );
}

/** ໜຶ່ງໝວດຮູບ — ຫົວຂໍ້ + ຕາໜ່າງຮູບ */
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

/** ຮູບ base64 (data-URI) — ໃຊ້ <img> ທຳມະດາ (Next Image ບໍ່ຮັບ data-URI ໂດຍກົງດີ) */
function Base64Photo({ src, caption }: { src: string; caption: string }) {
  const uri = src.startsWith("data:") ? src : `data:image/jpeg;base64,${src}`;
  return (
    <a href={uri} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-teal-300">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={uri} alt={caption} className="h-52 w-full bg-slate-50 object-contain" />
      <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-500">{caption}</p>
    </a>
  );
}
