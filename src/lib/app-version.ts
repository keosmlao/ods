/**
 * ປຽບທຽບເລກເວີຊັນຂອງແອັບມືຖື (`1.11.0` · `1.11.0+33`).
 *
 * ໃຊ້ບ່ອນດຽວກັບດ່ານບັງຄັບອັບເດດ (lib/app-update-gate) ⇒ ນິຍາມ "ເກົ່າກວ່າ" ຢູ່ບ່ອນດຽວ.
 * ບໍ່ໃຊ້ semver lib — pubspec ຂອງ Flutter ໃຊ້ຮູບແບບ `x.y.z+build` ເຊິ່ງ **ບໍ່ແມ່ນ**
 * semver ແທ້ (build ຂອງ semver ບໍ່ນັບ ແຕ່ຂອງ Flutter ຄື versionCode ຂອງ Android).
 */

/** `"1.11.0+33"` → `[1, 11, 0, 33]` — ຕົວທີ່ບໍ່ແມ່ນເລກຖືເປັນ 0 */
export function parseVersion(value: string): number[] {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return [];
  return trimmed
    .replace("+", ".")
    .split(".")
    .map((part) => {
      const digits = part.match(/\d+/)?.[0] ?? "0";
      return Number(digits);
    });
}

/**
 * ນ້ອຍກວ່າ 0 = `a` ເກົ່າກວ່າ `b` · 0 = ເທົ່າກັນ · ຫຼາຍກວ່າ 0 = ໃໝ່ກວ່າ.
 * ຄວາມຍາວບໍ່ເທົ່າກັນ ຖືວ່າຊ່ອງທີ່ຂາດ = 0 (`1.11` = `1.11.0`).
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}
