import { ImageOff, Images } from "lucide-react";
import Link from "next/link";

/**
 * ຮູບໜ້າປົກໃນຕາຕະລາງ — ກົດເປີດຮູບທັງໝົດຂອງໃບ (ຕອນຮັບເຄື່ອງ · ກວດເຊັກ · ສ້ອມສຳເລັດ).
 *
 * thumb = ຮູບຮັບເຄື່ອງຮູບທຳອິດ (ໄຟລ໌ product_image) · count = ຮູບທັງໝົດ.
 *   ມີ thumb            → ຮູບຈິງ
 *   ບໍ່ມີ thumb ແຕ່ count>0 → ມີແຕ່ຮູບກວດ/ສ້ອມ (base64) ⇒ ໄອຄອນ
 *   ບໍ່ມີເລີຍ            → ກ່ອງຈາງ (ບໍ່ກົດໄດ້)
 *
 * ໃຊ້ຮ່ວມ: ໜ້າຮັບສິນຄ້າປະຈຳວັນ (/service) ແລະ ຄິວທຸກຂັ້ນຕອນ (/work/repair/*).
 */
export function PhotoThumb({
  code,
  thumb,
  count,
  size = "size-11",
}: {
  code: string;
  thumb?: string | null;
  count: number;
  size?: string;
}) {
  if (!thumb && count === 0) {
    return (
      <span className={`grid ${size} shrink-0 place-items-center rounded-lg border border-dashed border-slate-200 text-slate-300`} title="ບໍ່ມີຮູບ">
        <ImageOff className="size-4" />
      </span>
    );
  }
  return (
    <Link
      href={`/service/${code}/images`}
      className={`relative block ${size} shrink-0 overflow-hidden rounded-lg border border-slate-200 transition hover:border-teal-400`}
      title={`ເບິ່ງຮູບ (${count})`}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/uploads/${encodeURIComponent(thumb)}`} alt="" className="size-full bg-slate-50 object-cover" />
      ) : (
        <span className="grid size-full place-items-center bg-teal-50 text-teal-500">
          <Images className="size-4" />
        </span>
      )}
      {count > 1 && (
        <span className="absolute bottom-0 right-0 rounded-tl bg-slate-900/70 px-1 text-[9px] font-bold text-white">{count}</span>
      )}
    </Link>
  );
}
