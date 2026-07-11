import { permanentRedirect } from "next/navigation";

/**
 * ສັນຍາເກົ່າຂອງ ods: GET /tracking/<sn> (tracking.py — route ສາທາລະນະ, ບໍ່ກວດ session)
 * ເຊິ່ງເປັນ QR ຮຸ່ນກ່ອນໜ້າ (http://183.182.101.13:4444/tracking/<sn>) ໃນໃບຮັບເຄື່ອງ.
 * ສົ່ງຕໍ່ໄປ /track/<sn> — ໜ້າໃໝ່ຮັບທັງ SN ແລະ ເລກທີໃບຮັບເຄື່ອງ.
 */
export default async function LegacyTrackingAlias({ params }: { params: Promise<{ sn: string }> }) {
  const { sn } = await params;
  permanentRedirect(`/track/${encodeURIComponent(decodeURIComponent(sn))}`);
}
