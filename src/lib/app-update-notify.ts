import { query } from "@/lib/db";
import { pushToUser } from "@/lib/push";
import { shippedAppVersion } from "@/lib/shipped-app-version";

/**
 * **ແຈ້ງເຕືອນເມື່ອມີແອັບເວີຊັນໃໝ່** — ຍິງ push ຫາທຸກເຄື່ອງທີ່ລົງທະບຽນໄວ້
 * ເມື່ອ APK ທີ່ວາງຢູ່ (`public/downloads/ods.apk.version`) ປ່ຽນເປັນເລກໃໝ່.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ດ່ານບັງຄັບອັບເດດຮູ້ວ່າແອັບເກົ່າ **ຕໍ່ເມື່ອຊ່າງເປີດແອັບ** ⇒ ຄົນທີ່ບໍ່ໄດ້ເປີດ
 * ຈະບໍ່ຮູ້ຈົນກວ່າຈະຮອດໜ້າງານແລ້ວເປີດບໍ່ໄດ້ — ຊ້າເກີນໄປ. ຢາກໃຫ້ຮູ້ **ກ່ອນອອກຈາກ
 * ບ້ານ/ຫ້ອງການ** ບ່ອນທີ່ຍັງມີ WiFi ⇒ ຍິງແຈ້ງເຕືອນທັນທີທີ່ອອກລຸ້ນໃໝ່.
 *
 * ── ຍິງເທື່ອດຽວຕໍ່ 1 ເວີຊັນ ──
 * ຈື່ເລກທີ່ແຈ້ງໄປແລ້ວໃສ່ `ods_setting` ⇒ cron ຈະແລ່ນຖີ່ເທົ່າໃດກໍ່ບໍ່ຍິງຊ້ຳ.
 */
const NOTIFIED_KEY = "mobile_update_notified";

async function lastNotified(): Promise<string> {
  if (!query) return "";
  const row = (await query<{ value: string }>(`select value from ods_setting where key = $1`, [NOTIFIED_KEY]))
    .rows[0];
  return row?.value ?? "";
}

async function rememberNotified(version: string): Promise<void> {
  if (!query) return;
  await query(
    `insert into ods_setting(key, value, updated_by)
     values ($1, $2, 'cron')
     on conflict (key) do update set value = excluded.value, updated_by = 'cron', updated_at = localtimestamp(0)`,
    [NOTIFIED_KEY, version],
  );
}

export interface AppUpdateNotifyResult {
  /** ເວີຊັນ APK ທີ່ວາງຢູ່ດຽວນີ້ ("" = ບໍ່ມີໄຟລ໌ເວີຊັນ) */
  version: string;
  /** ເລກທີ່ເຄີຍແຈ້ງໄປແລ້ວ */
  previous: string;
  /** ຍິງແຈ້ງເຕືອນຮອບນີ້ບໍ */
  notified: boolean;
  /** ຈຳນວນຄົນທີ່ຍິງໄປຫາ */
  users: number;
  reason?: string;
}

/**
 * ກວດ ແລະ ຍິງ. `dry` = ນັບໃຫ້ເບິ່ງເສີຍໆ ບໍ່ຍິງ ແລະ ບໍ່ຈື່ (ໃຫ້ທົດສອບໄດ້ໂດຍບໍ່ລົບກວນຄົນ).
 */
export async function notifyAppUpdate(dry = false): Promise<AppUpdateNotifyResult> {
  const version = await shippedAppVersion();
  const previous = await lastNotified();

  // ບໍ່ມີໄຟລ໌ເວີຊັນ = ບໍ່ຮູ້ວ່າວາງລຸ້ນໃດ ⇒ ງຽບໄວ້ (ຄືກັບດ່ານບັງຄັບອັບເດດ)
  if (!version) return { version, previous, notified: false, users: 0, reason: "no-version-file" };
  if (version === previous) return { version, previous, notified: false, users: 0, reason: "already-notified" };

  const users = query
    ? (await query<{ user_code: string }>(`select distinct user_code from ods_push_token`)).rows.map(
        (row) => row.user_code,
      )
    : [];

  if (!dry) {
    /*
      ຍິງເປັນຮອບໆ ບໍ່ຍິງທຽວດຽວທັງໝົດ — FCM ຮັບໄດ້ຢູ່ ແຕ່ຖ້າມີ 200+ ເຄື່ອງ
      ການເປີດ connection ພ້ອມກັນທັງໝົດເຮັດໃຫ້ຄຳຂໍອື່ນຂອງເວັບຄ້າງໄປນຳ.
    */
    for (let i = 0; i < users.length; i += 20) {
      await Promise.all(
        users.slice(i, i + 20).map((user) =>
          pushToUser(
            user,
            `ມີແອັບຊ່າງເວີຊັນໃໝ່ ${version}`,
            "ເປີດແອັບຕອນຢູ່ WiFi ແລ້ວມັນຈະອັບເດດໃຫ້ເອງ — ລຸ້ນເກົ່າໃຊ້ບໍ່ໄດ້ຫຼັງຈາກນີ້",
            { type: "app_update", version },
          ),
        ),
      );
    }
    await rememberNotified(version);
  }

  return { version, previous, notified: !dry, users: users.length };
}
