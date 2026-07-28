import "server-only";

import { queryOdg } from "@/lib/db";

/**
 * **ຂໍ້ມູນການສົ່ງເຄື່ອງຈາກລະບົບຂົນສົ່ງ** (odg_tms_detail — ຜູກດ້ວຍ bill_no).
 *
 * ໃຊ້ໃນງານຕິດຕັ້ງ: ບ່ອນທີ່ຂົນສົ່ງເອົາເຄື່ອງໄປວາງ = ບ່ອນທີ່ຊ່າງຕ້ອງໄປຕິດຕັ້ງ
 * ⇒ ຊ່າງເປີດແຜນທີ່ໄປໄດ້ເລີຍ ແລະ CS ເຫັນຮູບຕອນສົ່ງເປັນຫຼັກຖານ.
 *
 * ── ຢ່າດຶງຮູບມາພ້ອມ metadata ──
 * ຮູບເກັບເປັນ **data URI base64 ຢູ່ໃນຖານ** (100-200KB ຕໍ່ຮູບ, ບາງບິນມີຫຼາຍຮູບ).
 * ໜ້າລາຍລະອຽດງານໂຫຼດ metadata ຢ່າງດຽວ (ໄວ) ແລ້ວຄ່ອຍດຶງຮູບຕອນຄົນກົດເບິ່ງ
 * ຜ່ານ /api/installations/delivery.
 */

export type DeliveryInfo = {
  bill_no: string;
  /** ພິກັດຈຸດສົ່ງ — null ຖ້າຄົນສົ່ງບໍ່ໄດ້ປັກ */
  lat: number | null;
  lng: number | null;
  sent_end: string | null;
  checkin_at: string | null;
  /**
   * ເບີຂອງ**ຄົນທີ່ຮັບເຄື່ອງຈິງ** — ບາງເທື່ອບໍ່ແມ່ນຄົນໃນບິນ (ຍາມ · ລູກ · ເພື່ອນບ້ານ)
   * ⇒ ຊ່າງໂທຫາຄົນນີ້ໄດ້ຖ້າໂທຫາເບີໃນໃບງານບໍ່ຕິດ.
   */
  telephone: string | null;
  /** ໝາຍເຫດຂອງຄົນສົ່ງ (ເຊັ່ນ "ວາງໄວ້ໜ້າບ້ານ", "ຝາກຍາມ") */
  remark: string | null;
  /** ມີຮູບໃຫ້ເບິ່ງບໍ (ນັບຢ່າງດຽວ ບໍ່ດຶງຮູບ) */
  photos: number;
};

/** lat/lng ໃນຕາຕະລາງນີ້ເປັນ varchar — ຫວ່າງ ຫຼື '0' = ຄົນສົ່ງບໍ່ໄດ້ປັກ */
const HAS_GEO = `coalesce(lat,'') not in ('','0') and coalesce(lng,'') not in ('','0')`;

const toNumber = (value: string | null) => {
  const n = Number(value);
  return value != null && value !== "" && Number.isFinite(n) ? n : null;
};

/**
 * ຂໍ້ມູນການສົ່ງຂອງບິນໜຶ່ງ — null ຖ້າບິນນີ້ບໍ່ຢູ່ໃນລະບົບຂົນສົ່ງ (ລູກຄ້າຫອບເອງ).
 *
 * 1 ບິນມີໄດ້ຫຼາຍແຖວ (ສົ່ງບໍ່ສຳເລັດແລ້ວສົ່ງໃໝ່) ⇒ ເອົາແຖວ **ທີ່ມີພິກັດ** ກ່ອນ,
 * ແລ້ວ status=1 (ສົ່ງສຳເລັດ), ແລ້ວອັນຫຼ້າສຸດ.
 */
export async function deliveryFor(billNo: string | null | undefined): Promise<DeliveryInfo | null> {
  const bill = (billNo ?? "").trim();
  if (!bill) return null;

  try {
    const row = (
      await queryOdg<{
        bill_no: string;
        lat: string | null;
        lng: string | null;
        sent_end: string | null;
        checkin_at: string | null;
        telephone: string | null;
        remark: string | null;
        photos: number;
      }>(
        `select distinct on (d.bill_no) d.bill_no, d.lat, d.lng,
            to_char(d.sent_end,'DD-MM-YYYY HH24:MI') as sent_end,
            to_char(d.checkin_at,'DD-MM-YYYY HH24:MI') as checkin_at,
            nullif(trim(coalesce(d.telephone,'')),'') as telephone,
            nullif(trim(coalesce(d.remark,'')),'') as remark,
            (case when coalesce(d.url_img,'') <> '' then 1 else 0 end
             + (select count(*)::int from odg_tms_delivery_images i where i.bill_no = d.bill_no)) as photos
           from odg_tms_detail d
          where d.bill_no = $1
          order by d.bill_no, (${HAS_GEO}) desc, (d.status = 1) desc, d.sent_end desc nulls last`,
        [bill],
      )
    ).rows[0];
    if (!row) return null;

    return {
      bill_no: row.bill_no,
      lat: toNumber(row.lat),
      lng: toNumber(row.lng),
      sent_end: row.sent_end,
      checkin_at: row.checkin_at,
      telephone: row.telephone,
      remark: row.remark,
      photos: Number(row.photos) || 0,
    };
  } catch (error) {
    // ລະບົບຂົນສົ່ງລົ້ມ ບໍ່ຄວນພາໜ້າງານລົ້ມນຳ — ບໍ່ມີຂໍ້ມູນກໍ່ພຽງແຕ່ບໍ່ສະແດງກ່ອງນີ້
    console.error("deliveryFor failed", error);
    return null;
  }
}

/**
 * ຮູບຕອນສົ່ງ (data URI) — ດຶງຕອນຄົນກົດເບິ່ງເທົ່ານັ້ນ.
 * ມາຈາກ 2 ບ່ອນ: ຮູບຫຼັກຢູ່ odg_tms_detail.url_img ແລະ ຮູບເພີ່ມຢູ່ odg_tms_delivery_images.
 */
export async function deliveryPhotos(billNo: string, limit = 8): Promise<string[]> {
  const bill = billNo.trim();
  if (!bill) return [];

  const [main, extra] = await Promise.all([
    queryOdg<{ img: string }>(
      `select url_img as img from odg_tms_detail
        where bill_no = $1 and coalesce(url_img,'') <> ''
        order by sent_end desc nulls last limit $2`,
      [bill, limit],
    ),
    queryOdg<{ img: string }>(
      `select image_data as img from odg_tms_delivery_images
        where bill_no = $1 and coalesce(image_data,'') <> ''
        order by roworder desc limit $2`,
      [bill, limit],
    ),
  ]);

  // ບາງບິນຮູບຫຼັກກັບຮູບເພີ່ມເປັນຮູບດຽວກັນ ⇒ ຕັດຊ້ຳອອກ
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of [...main.rows, ...extra.rows]) {
    if (!row.img.startsWith("data:image/")) continue; // ກັນຄ່າແປກປອມ
    if (seen.has(row.img)) continue;
    seen.add(row.img);
    out.push(row.img);
    if (out.length >= limit) break;
  }
  return out;
}
