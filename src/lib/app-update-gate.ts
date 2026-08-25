/**
 * **ດ່ານບັງຄັບອັບເດດແອັບຊ່າງ** — ແອັບສົ່ງເວີຊັນຂອງຕົນມາທຸກຄຳຂໍ (`x-app-version`)
 * ⇒ ເກົ່າກວ່າ APK ທີ່ວາງໃຫ້ໂຫຼດຢູ່ = ໃຊ້ /api/mobile/* ບໍ່ໄດ້ (426) ຈົນກວ່າຈະອັບເດດ.
 *
 * ── ເປັນຫຍັງຕ້ອງບັງຄັບ ──
 * ແອັບບໍ່ຢູ່ Play Store (ໂຫຼດ APK ຈາກໜ້າ /download) ⇒ ບໍ່ມີໃຜອັບເດດໃຫ້ອັດຕະໂນມັດ.
 * ແອັບເກົ່າຄາຢູ່ໃນມືຊ່າງເປັນເດືອນ = ຂັ້ນຕອນທີ່ເວັບແກ້ໄປແລ້ວຍັງເດີນຜິດຢູ່ໜ້າງານ ແລະ
 * ຂໍ້ຜິດພາດທີ່ແກ້ແລ້ວກໍ່ຍັງເກີດຊ້ຳ.
 *
 * ── ຫຼັກຄວາມປອດໄພ (ຜິດພາດໄປທາງບໍ່ຢຸດວຽກ) ──
 * ① ບໍ່ມີໄຟລ໌ເວີຊັນຂອງ APK = **ບໍ່ຮູ້** ⇒ ບໍ່ບັງຄັບໃຜ (ຢ່າລັອກຊ່າງອອກເພາະໄຟລ໌ຫາຍ)
 * ② ຕັ້ງຄ່າປິດ (mobile_force_update = off) ⇒ ພຽງບອກວ່າມີເວີຊັນໃໝ່ ບໍ່ບລັອກ
 * ③ ບໍ່ມີເນັດ = ບໍ່ມີຄຳຕອບຈາກ server = ດ່ານບໍ່ເຮັດວຽກ ⇒ ຄິວ offline ຂອງແອັບແລ່ນຕໍ່ໄດ້
 */
import { NextResponse } from "next/server";
import { compareVersions } from "@/lib/app-version";
import { SETTING, settingEnabled } from "@/lib/settings";
import { shippedAppVersion } from "@/lib/shipped-app-version";

export { compareVersions, parseVersion } from "@/lib/app-version";

/** ບ່ອນວາງ APK — ຄືກັບໜ້າ /download (ແອັບເອົາລິ້ງນີ້ໄປໂຫຼດ+ຕິດຕັ້ງໃນຕົວເລີຍ) */
export const APK_URL = "/downloads/ods.apk";

export interface MobileAppUpdate {
  /** ເກົ່າກວ່າຂັ້ນຕ່ຳ (ຫຼື ບໍ່ບອກເວີຊັນມາເລີຍ) ແລະ ການບັງຄັບເປີດຢູ່ ⇒ ບລັອກ */
  force_update: boolean;
  /** ມີເວີຊັນໃໝ່ກວ່າ ແຕ່ຍັງໃຊ້ຕໍ່ໄດ້ ⇒ ພຽງແຈ້ງ */
  update_available: boolean;
  min_version: string;
  latest_version: string;
  current_version: string;
  platform: string;
  update_url: string;
}

function header(request: Request, name: string): string {
  return (request.headers.get(name) ?? "").trim();
}

/**
 * ອ່ານນະໂຍບາຍ + ເວີຊັນທີ່ແອັບບອກມາ ແລ້ວຕັດສິນວ່າຕ້ອງບັງຄັບອັບເດດບໍ.
 * **ບໍ່ເຄີຍໂຍນ error** — ຜູ້ເອີ້ນເລືອກເອງວ່າຈະບລັອກ (ເບິ່ງ `assertMobileAppVersion`)
 * ຫຼື ພຽງເອົາຂໍ້ມູນໄປແນບໃນຄຳຕອບ (ເຊັ່ນ login).
 */
export async function evaluateMobileAppVersion(request: Request): Promise<MobileAppUpdate> {
  const current = header(request, "x-app-version");
  const platform = header(request, "x-app-platform").toLowerCase();
  let shipped = "";
  let enforcing = false;
  try {
    [shipped, enforcing] = await Promise.all([
      shippedAppVersion(),
      settingEnabled(SETTING.MOBILE_FORCE_UPDATE),
    ]);
  } catch (error) {
    // ອ່ານນະໂຍບາຍບໍ່ໄດ້ ⇒ ບໍ່ບັງຄັບ (ຢ່າໃຫ້ດ່ານທີ່ລົ້ມກາຍເປັນຕົວຢຸດວຽກທັງບໍລິສັດ)
    console.error("evaluateMobileAppVersion failed", error);
  }

  // ບໍ່ຮູ້ວ່າ APK ທີ່ວາງຢູ່ເປັນເວີຊັນໃດ ⇒ ດ່ານປິດ
  const outdated = shipped ? !current || compareVersions(current, shipped) < 0 : false;

  return {
    force_update: outdated && enforcing,
    update_available: outdated,
    min_version: shipped,
    latest_version: shipped,
    current_version: current,
    platform,
    update_url: APK_URL,
  };
}

/**
 * ຄຳຕອບ **426 Upgrade Required** ພ້ອມນະໂຍບາຍ — ແອັບອ່ານ `app_update` ໄປຂຶ້ນ
 * ໜ້າ "ຕ້ອງອັບເດດ" ໄດ້ເລີຍ. ໃຊ້ 426 (ບໍ່ແມ່ນ 403) ເພື່ອບໍ່ໃຫ້ປົນກັບເລື່ອງສິດ.
 */
export function appUpdateResponse(update: MobileAppUpdate): NextResponse {
  return NextResponse.json(
    {
      error: "ກະລຸນາອັບເດດແອັບເປັນເວີຊັນຫຼ້າສຸດກ່ອນໃຊ້ງານ",
      force_update: true,
      app_update: update,
    },
    { status: 426 },
  );
}

/** ຄືນຄຳຕອບ 426 ເມື່ອຕ້ອງບັງຄັບອັບເດດ · null = ຜ່ານ */
export async function blockOutdatedApp(request: Request): Promise<NextResponse | null> {
  const update = await evaluateMobileAppVersion(request);
  return update.force_update ? appUpdateResponse(update) : null;
}
