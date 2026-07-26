import { timingSafeEqual } from "node:crypto";

/**
 * ທຽບ `x-cron-key` ແບບ **constant-time** — ກັນ timing attack ຕໍ່ CRON_KEY.
 * `!==` ທຳມະດາ ອອກໄວກວ່າຕອນ byte ທຳອິດຕ່າງ ⇒ ຄົນຮ້າຍ ວັດເວລາ ເດົາ key ເທື່ອລະ byte ໄດ້.
 */
export function cronKeyMatches(request: Request, key: string): boolean {
  const provided = request.headers.get("x-cron-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
