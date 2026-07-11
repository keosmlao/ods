import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackStatus } from "@/components/track-status";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSearchable, jobByCode, jobsBySn } from "@/lib/track";

/**
 * ປາຍທາງຂອງ QR ໃນໃບຮັບເຄື່ອງ — /track/<ເລກທີໃບຮັບເຄື່ອງ> (ຮັບ SN ໄດ້ຄືກັນ ຕາມ ods /tracking/<sn>).
 * ສາທາລະນະ: ບໍ່ຕ້ອງ login (ຢູ່ນອກກຸ່ມ (app) ຈຶ່ງບໍ່ຜ່ານການກວດ session).
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export default async function TrackJobPage({ params }: Props) {
  const raw = decodeURIComponent((await params).code).trim();
  if (!isSearchable(raw)) notFound();

  // ເລກທີເປັນເລກລຽງລຳດັບ → ຈຳກັດການໄລ່ເປີດເປັນຊຸດ
  if (!rateLimit(`track:${await clientIp()}`, 30, 60_000)) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500 shadow-sm">
        ເປີດຫຼາຍຄັ້ງເກີນໄປ — ກະລຸນາລອງໃໝ່ໃນອີກ 1 ນາທີ
      </p>
    );
  }

  const job = (await jobByCode(raw)) ?? (await jobsBySn(raw))[0];
  if (!job) notFound();

  return (
    <div className="space-y-4">
      <TrackStatus job={job} />
      <Link
        href="/track"
        className="block rounded-xl border border-slate-200 bg-white py-2.5 text-center text-xs font-medium text-[#0536a9] shadow-sm"
      >
        ຄົ້ນຫາໃບອື່ນ
      </Link>
    </div>
  );
}
