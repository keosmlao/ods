/**
 * ເວີຊັນຂອງ APK ທີ່ **ວາງໃຫ້ໂຫຼດຢູ່ຈິງ** ທີ່ `/downloads/ods.apk`.
 *
 * ອ່ານຈາກໄຟລ໌ຂ້າງໆ `public/downloads/ods.apk.version` (ຂຽນຕອນ copy APK ໃໝ່ —
 * ເບິ່ງໜ້າ /download ແລະ scripts/deploy.sh). ບໍ່ອ່ານຈາກຕົວ APK ໂດຍກົງ ເພາະ
 * AndroidManifest ໃນ APK ເປັນ binary XML ຕ້ອງມີ aapt ຂອງ Android SDK ຈຶ່ງອ່ານໄດ້
 * — ບໍ່ຄຸ້ມທີ່ຈະຜູກ runtime ຂອງເວັບໄວ້ກັບເຄື່ອງມືນັ້ນ.
 *
 * ນີ້ຄືສິ່ງທີ່ເຮັດໃຫ້ການບັງຄັບອັບເດດເປັນອັດຕະໂນມັດ: ອອກ APK ໃໝ່ → ໄຟລ໌ນີ້ປ່ຽນ →
 * ເວີຊັນຂັ້ນຕ່ຳຂະຫຍັບຕາມເອງ ໂດຍບໍ່ຕ້ອງມີໃຜເຂົ້າໄປພິມເລກໃສ່ບ່ອນໃດ (ຂັ້ນຕອນທີ່ລືມງ່າຍສຸດ).
 */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

/** ບ່ອນທີ່ຊ່າງໂຫຼດ APK — ນອກດ່ານ login (proxy matcher ຂ້າມ path ທີ່ມີຈຸດ) */
export const APK_PUBLIC_PATH = "/downloads/ods.apk";

const APK_FILE = join(process.cwd(), "public", "downloads", "ods.apk");
const VERSION_FILE = join(process.cwd(), "public", "downloads", "ods.apk.version");

let cached = "";
let cachedMtimeMs = -1;
let checkedAtMs = 0;

/** ອ່ານດິສຢ່າງຫຼາຍ 1 ຄັ້ງ/10 ວິນາທີ — ດ່ານນີ້ແລ່ນທຸກ request ຂອງມືຖື */
const RECHECK_MS = 10_000;

/**
 * ເວີຊັນ (ເຊັ່ນ `"1.11.0"`) ຂອງ APK ທີ່ວາງຢູ່. ຄືນ `""` ເມື່ອບໍ່ມີໄຟລ໌ —
 * ຜູ້ເອີ້ນຕ້ອງຖືວ່າ "ບໍ່ຮູ້" ແລ້ວ **ບໍ່ບັງຄັບ** ອັບເດດ ດີກວ່າລັອກຊ່າງອອກຈາກແອັບ
 * ເພາະໄຟລ໌ຫາຍ.
 */
export async function shippedAppVersion(now = Date.now()): Promise<string> {
  if (cachedMtimeMs >= 0 && now - checkedAtMs < RECHECK_MS) return cached;
  checkedAtMs = now;
  try {
    const info = await stat(VERSION_FILE);
    if (info.mtimeMs === cachedMtimeMs) return cached;
    const raw = await readFile(VERSION_FILE, "utf8");
    // ໄຟລ໌ຂຽນເປັນ "1.11.0+33" — ເອົາທັງໝົດ (ລວມ build) ໃຫ້ປຽບທຽບລະອຽດເຖິງ versionCode
    cached = raw.trim().split(/\s+/)[0] ?? "";
    cachedMtimeMs = info.mtimeMs;
  } catch {
    cached = "";
    cachedMtimeMs = -1;
  }
  return cached;
}

/** ລ້າງ cache — ໃຊ້ໃນເທສ */
export function resetShippedAppVersionCache(): void {
  cached = "";
  cachedMtimeMs = -1;
  checkedAtMs = 0;
}

/**
 * ຂະໜາດ + ວັນທີຂອງ APK ທີ່ວາງໃຫ້ໂຫຼດ — `null` = ຍັງບໍ່ມີໄຟລ໌.
 * ໜ້າ /download ແລະ ໜ້າ login ໃຊ້ອັນນີ້ຮ່ວມກັນ ⇒ ບໍ່ໃຫ້ 2 ໜ້າບອກຂໍ້ມູນຄົນລະຢ່າງ.
 */
export async function apkFileInfo(): Promise<{ size: string; updated: string } | null> {
  try {
    const info = await stat(APK_FILE);
    return {
      size: `${(info.size / 1024 / 1024).toFixed(1)} MB`,
      updated: info.mtime.toISOString().slice(0, 16).replace("T", " "),
    };
  } catch {
    return null;
  }
}
