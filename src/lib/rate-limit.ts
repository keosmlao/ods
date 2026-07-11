import { headers } from "next/headers";

/**
 * ຕົວຈຳກັດຈຳນວນຄັ້ງແບບງ່າຍ (ໃນໜ່ວຍຄວາມຈຳຂອງ process ດຽວ).
 *
 * ໃຊ້ກັບໜ້າສາທາລະນະ /track ເທົ່ານັ້ນ: ເລກທີໃບຮັບເຄື່ອງເປັນເລກລຽງລຳດັບ (1..7xxx)
 * ຈຶ່ງມີຄວາມສ່ຽງທີ່ຄົນຈະໄລ່ເປີດທຸກເລກເພື່ອດຶງຂໍ້ມູນເປັນຊຸດ.
 * ບໍ່ແມ່ນຕົວແທນຂອງ WAF/nginx limit_req ແຕ່ຕັດການໄລ່ແບບ script ທຳມະດາອອກໄດ້.
 */
type Hits = { count: number; resetAt: number };
declare global {
  var odsRateLimit: Map<string, Hits> | undefined;
}
const buckets = (global.odsRateLimit ??= new Map<string, Hits>());

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 5000) buckets.clear(); // ກັນໜ່ວຍຄວາມຈຳບວມ
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** IP ຂອງຜູ້ຮ້ອງຂໍ (ຜ່ານ reverse proxy) — ໃຊ້ເປັນ key ຂອງຕົວຈຳກັດ */
export async function clientIp() {
  const head = await headers();
  const forwarded = head.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || head.get("x-real-ip") || "unknown";
}
