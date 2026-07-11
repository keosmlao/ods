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

  // ແກ້ບັກ: product_image ມີແຖວທີ່ product_url ເປັນ null ຢູ່ຈິງ — ເກົ່າສ້າງ <img src="/api/uploads/null">
  // ແລະ ປ້າຍ "ຮູບທີ NaN" (ເພາະ line_number ກໍ null). ດຽວນີ້ຕັດແຖວທີ່ບໍ່ມີໄຟລ໌ອອກເລີຍ.
  const images = (
    await query<{ roworder: number; product_url: string; line_number: number }>(
      `select roworder, product_url, coalesce(line_number,0) line_number
       from product_image
       where iteme_code = $1 and coalesce(product_url,'') <> ''
       order by line_number, roworder desc`,
      [code],
    )
  ).rows;

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
        <h1 className="text-xl font-bold text-slate-700">ຮູບພາບສິນຄ້າ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {job.name_1} {job.sn && <span className="text-slate-400">· {job.sn}</span>} · ລະຫັດງານ {job.code} ·{" "}
          {images.length} ຮູບ
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {images.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-400">ບໍ່ມີຮູບ</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <a
                key={image.roworder}
                href={`/api/uploads/${encodeURIComponent(image.product_url)}`}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-teal-300"
              >
                <Image
                  src={`/api/uploads/${encodeURIComponent(image.product_url)}`}
                  alt={`ຮູບທີ ${image.line_number + 1}`}
                  width={400}
                  height={300}
                  unoptimized
                  className="h-52 w-full bg-slate-50 object-contain"
                />
                <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-500">
                  ຮູບທີ {image.line_number + 1}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
