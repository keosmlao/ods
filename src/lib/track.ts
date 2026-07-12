import { headers } from "next/headers";
import { query } from "@/lib/db";
import { STAGE_LABEL, STAGE_SQL } from "@/lib/stage";

/**
 * ໜ້າຕິດຕາມສາທາລະນະ (ບໍ່ຕ້ອງ login) — ຂໍ້ມູນ ແລະ ຂໍ້ຄວາມສຳລັບລູກຄ້າ.
 *
 * ods: /tracking/<sn> (tracking.py) ເປັນ route ສາທາລະນະ ແລະ QR ໃນໃບຮັບເຄື່ອງ
 * (templates/billprint/reciptpd.html) ຝັງ URL ".../servicefuond/<code>".
 * ບ່ອນນີ້ຮັບໄດ້ທັງ "ເລກທີໃບຮັບເຄື່ອງ" (tb_product.code) ແລະ Serial Number.
 *
 * ຂໍ້ມູນທີ່ເປີດເຜີຍ: ເລກທີ, ຊື່ເຄື່ອງ/ຍີ່ຫໍ້/ຮຸ່ນ/SN, ວັນທີຮັບເຄື່ອງ, ຂັ້ນຕອນປັດຈຸບັນ, ຂັ້ນຕໍ່ໄປ.
 * **ບໍ່** ເປີດເຜີຍ: ຊື່/ເບີ/ທີ່ຢູ່ລູກຄ້າ, ຄ່າສ້ອມ/ລາຄາ, ຊື່ຊ່າງ, ໝາຍເຫດພາຍໃນ, ອາການ/ຮ່ອງຮອຍ.
 *
 * ຂັ້ນຕອນຄິດຈາກ STAGE_SQL (src/lib/stage.ts) ເທົ່ານັ້ນ — ບໍ່ໃຊ້ view tracking_tb_product ທີ່ເລີກໃຊ້ແລ້ວ.
 */
export type TrackJob = {
  code: string;
  product: string | null;
  brand: string | null;
  model: string | null;
  sn: string | null;
  registered: string | null;
  returned: string | null;
  stage: number;
};

/** ຄຳອະທິບາຍຂັ້ນຕໍ່ໄປ ໃນພາສາລູກຄ້າ (ບໍ່ແມ່ນພາສາພາຍໃນ) */
export const NEXT_STEP: Record<number, string> = {
  [-1]: "ໃບຮັບເຄື່ອງນີ້ຖືກຍົກເລີກ — ກະລຸນາຕິດຕໍ່ສູນບໍລິການ",
  1: "ຊ່າງຈະເລີ່ມກວດເຊັກເຄື່ອງຂອງທ່ານ",
  2: "ລໍຖ້າຜົນການກວດເຊັກຈາກຊ່າງ",
  3: "ທາງສູນຈະແຈ້ງລາຄາສ້ອມແປງໃຫ້ທ່ານພິຈາລະນາ",
  4: "ພະນັກງານຈະຕິດຕໍ່ຫາທ່ານເພື່ອຢືນຢັນລາຄາ",
  5: "ກຳລັງກຽມອາໄຫຼ່ສຳລັບການສ້ອມແປງ",
  6: "ກຳລັງເບີກອາໄຫຼ່ຈາກສາງ",
  7: "ອາໄຫຼ່ຢູ່ລະຫວ່າງການສັ່ງຊື້ — ອາດໃຊ້ເວລາເພີ່ມ",
  8: "ເຄື່ອງຂອງທ່ານເຂົ້າຄິວສ້ອມແປງແລ້ວ",
  9: "ຊ່າງກຳລັງສ້ອມແປງເຄື່ອງຂອງທ່ານ",
  10: "ສ້ອມແປງສຳເລັດ — ກຳລັງກວດຮັບຄຸນນະພາບກ່ອນສົ່ງມອບ",
  11: "ຜ່ານການກວດຮັບແລ້ວ — ກະລຸນາມາຮັບເຄື່ອງ ຫຼື ລໍຖ້າການຈັດສົ່ງ",
  12: "ສົ່ງຄືນລູກຄ້າແລ້ວ — ຂອບໃຈທີ່ໃຊ້ບໍລິການ",
};

/** ຂັ້ນສຸດທ້າຍ — ໃຊ້ຕັດສິນວ່າ "ຈົບແລ້ວ" ຢູ່ໜ້າຕິດຕາມ ແລະ ໜ້າໃບຮັບເຄື່ອງ */
export const DONE_STAGE = 12;

export const STAGE_TEXT = STAGE_LABEL;

/**
 * ຂັ້ນຕອນຫຍໍ້ທີ່ລູກຄ້າເຫັນ (ບາງໃບຂ້າມຂັ້ນ ເຊັ່ນ ຍັງຮັບປະກັນ ບໍ່ຕ້ອງສະເໜີລາຄາ).
 * ເພີ່ມ "ກວດຮັບຄຸນນະພາບ" ຕາມຂັ້ນໄດໃໝ່ — ລູກຄ້າຄວນເຫັນວ່າມີດ່ານກວດກ່ອນສົ່ງມອບ.
 */
export const STEPS = [
  "ຮັບເຄື່ອງເຂົ້າສ້ອມ",
  "ກວດເຊັກເຄື່ອງ",
  "ສະເໜີລາຄາ",
  "ຈັດຫາອາໄຫຼ່",
  "ສ້ອມແປງ",
  "ກວດຮັບຄຸນນະພາບ",
  "ລໍຖ້າສົ່ງຄືນ",
  "ສົ່ງຄືນສຳເລັດ",
];

const STEP_OF_STAGE: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 6, 12: 7,
};
export const stepOfStage = (stage: number) => STEP_OF_STAGE[stage] ?? 0;

const SELECT = `select a.code, a.name_1 as product, a.p_brand as brand, a.p_model as model, a.sn,
    to_char(a.time_register,'DD-MM-YYYY') as registered,
    to_char(a.return_complete,'DD-MM-YYYY') as returned,
    ${STAGE_SQL} as stage
  from tb_product a`;

/** ຄົ້ນດ້ວຍເລກທີໃບຮັບເຄື່ອງ — ໃຊ້ index idx_tb_product_code (ຄົ້ນຄັ້ງດຽວ, ບໍ່ scan) */
export async function jobByCode(code: string): Promise<TrackJob | null> {
  const result = await query<TrackJob>(`${SELECT} where a.code = $1 limit 1`, [code]);
  return result.rows[0] ?? null;
}

/**
 * ຄົ້ນດ້ວຍ Serial Number — ໃຊ້ index idx_tb_product_sn.
 *
 * ໃຊ້ = (ບໍ່ແມ່ນ upper()/like) ເພື່ອໃຫ້ຍັງໃຊ້ index ໄດ້, ແຕ່ລອງທັງຕົວພິມໃຫຍ່/ນ້ອຍ.
 * SN ດຽວອາດມີຫຼາຍໃບ (ເຄື່ອງເຂົ້າສ້ອມຫຼາຍຄັ້ງ) → ສົ່ງຄືນສູງສຸດ 5 ໃບ ໃໝ່ສຸດກ່ອນ.
 */
export async function jobsBySn(sn: string): Promise<TrackJob[]> {
  const result = await query<TrackJob>(
    `${SELECT} where a.sn in ($1::text, upper($1::text), lower($1::text))
      order by a.time_register desc nulls last limit 5`,
    [sn],
  );
  return result.rows;
}

/** ຄ່າທີ່ພິມໃສ່ໃບຮັບເຄື່ອງ/ສະແກນເອົາ — ຕ້ອງເປັນ code ຫຼື SN ທີ່ມີຄວາມໝາຍ */
export function isSearchable(value: string) {
  const q = value.trim();
  return q.length >= 3 && q !== "-" && q !== "--";
}

/**
 * URL ຫຼັກຂອງເວັບ — ໃຊ້ຕອນສ້າງ QR ໃນໃບພິມ (QR ຕ້ອງເປັນ URL ເຕັມ ໂທລະສັບຈຶ່ງເປີດໄດ້).
 * ຕັ້ງ PUBLIC_BASE_URL ໃນ .env ເພື່ອບັງຄັບ (ຕົວຢ່າງ https://service.odien.net);
 * ຖ້າບໍ່ຕັ້ງ ຈະໃຊ້ host ຂອງ request ນັ້ນ.
 */
export async function publicBaseUrl() {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function trackUrl(code: string) {
  return `${await publicBaseUrl()}/track/${encodeURIComponent(code)}`;
}

/**
 * ລິ້ງແບບສອບຖາມຂອງງານຕິດຕັ້ງ (ໜ້າສາທາລະນະ /feedback/<ລະຫັດງານ>).
 *
 * ງານຕິດຕັ້ງຄ້າງຢູ່ຂັ້ນ 6 (ຕິດຕັ້ງສຳເລັດ) ຈົນກວ່າລູກຄ້າຈະຕອບແບບສອບຖາມ ແຕ່ LINE Notify
 * ທີ່ ods ໃຊ້ສົ່ງລິ້ງໃຫ້ລູກຄ້າ **ປິດບໍລິການແລ້ວ** (31-03-2025) ແລະ ບໍ່ມີຫຍັງມາແທນ
 * ⇒ ຕ້ອງສົ່ງລິ້ງດ້ວຍມື ແລະ ງານກອງຢູ່ຂັ້ນ 6.
 *
 * ຊ່າງບໍ່ຕ້ອງສົ່ງລິ້ງເລີຍ: ເອົາ QR ນີ້ໃຫ້ລູກຄ້າສະແກນຢູ່ໜ້າງານຕອນຕິດຕັ້ງແລ້ວ
 * (ຄືກັບ QR ຕິດຕາມສະຖານະໃນໃບຮັບເຄື່ອງ — trackUrl ຂ້າງເທິງ). ບໍ່ຕ້ອງມີບໍລິການພາຍນອກ.
 */
export async function feedbackUrl(code: string) {
  return `${await publicBaseUrl()}/feedback/${encodeURIComponent(code)}`;
}
