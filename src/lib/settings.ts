import { query } from "@/lib/db";
import { unstable_cache } from "next/cache";

/**
 * **ການຕັ້ງຄ່າລະບົບ** (ods_setting) — ນິຍາມ key · ຄ່າຕັ້ງຕົ້ນ · ຄຳອະທິບາຍ **ບ່ອນດຽວ**.
 *
 * ── ກົດ ──
 * ① **ບໍ່ມີແຖວໃນຖານ = ໃຊ້ຄ່າຕັ້ງຕົ້ນຢູ່ນີ້** (ບໍ່ແມ່ນ "ປິດ") — ລະບົບທີ່ຫາກໍ່ deploy
 *    ຍັງບໍ່ມີແຖວໃດ ຕ້ອງເຮັດວຽກຕາມປົກກະຕິ.
 * ② ຖາມຖານບໍ່ໄດ້ (ຖານລົ້ມ) ⇒ ຄືນຄ່າຕັ້ງຕົ້ນ **ບໍ່ແມ່ນ "ປິດ"** — ຖານລົ້ມບໍ່ຄວນ
 *    ພາໃຫ້ຄວາມສາມາດຫາຍໄປງຽບໆ.
 * ③ ຢ່າພິມ key ສົດຢູ່ບ່ອນເອີ້ນ — ໃຊ້ `SETTING.*` ເທົ່ານັ້ນ.
 */

export const SETTING = {
  /** ທຸງ "ວຽກມີບັນຫາ" (ods_job_hold) — ປິດແລ້ວ: ປຸ່ມ/ແທັບຫາຍ ນາລິກາເດີນປົກກະຕິ */
  JOB_HOLD: "job_hold_enabled",
  /** ແຈ້ງເຕືອນ**ທຸກ**ການເຄື່ອນໄຫວ ຫາ**ທຸກຄົນ** (ນອກເໜືອຄົນຕິດຕາມ) — audit feed */
  NOTIFY_ALL: "notify_all_activity",
} as const;

export type SettingKey = (typeof SETTING)[keyof typeof SETTING];

/** ຄຳອະທິບາຍໃຫ້ໜ້າຕັ້ງຄ່າ — ຢູ່ຄຽງ key ຈຶ່ງບໍ່ລືມອັບເດດ */
export const SETTING_META: Record<SettingKey, { label: string; help: string; fallback: boolean }> = {
  [SETTING.JOB_HOLD]: {
    label: "ໝາຍວຽກວ່າ “ມີບັນຫາ”",
    help:
      "ໃຫ້ຫົວໜ້າໝາຍວຽກທີ່ຄາຢູ່ຂັ້ນດຽວດ້ວຍເຫດຜົນທີ່ຄິວແກ້ບໍ່ໄດ້ (ລໍອາໄຫຼ່ນອກ, ລູກຄ້າບໍ່ຕອບ). " +
      "ວຽກທີ່ຖືກໝາຍຈະແຍກໄປແທັບ “ມີບັນຫາ” ແລະ ນາລິກາຂັ້ນຈະຢຸດນັບ. " +
      "ປິດແລ້ວ: ປຸ່ມ ແລະ ແທັບຫາຍໄປ ນາລິກາເດີນປົກກະຕິທຸກວຽກ — ທຸງເກົ່າຍັງເກັບໄວ້ ບໍ່ຖືກລຶບ.",
    fallback: true,
  },
  [SETTING.NOTIFY_ALL]: {
    label: "ແຈ້ງເຕືອນທຸກການເຄື່ອນໄຫວ ຫາທຸກຄົນ",
    help:
      "ໃຫ້ພະນັກງານທຸກຄົນໄດ້ຮັບການແຈ້ງເຕືອນຂອງ “ທຸກ” ການເຄື່ອນໄຫວໃນລະບົບ (audit feed) ບໍ່ແມ່ນສະເພາະ " +
      "ເອກະສານທີ່ຕົນຕິດຕາມ. ປິດແລ້ວ: ແຕ່ລະຄົນໄດ້ຮັບແຕ່ເລື່ອງທີ່ຕົນຕິດຕາມ ຫຼື ຖືກມອບໝາຍ. " +
      "ແຕ່ລະຄົນກົດ “ອ່ານ/ຍັງບໍ່ອ່ານ” ຈັດການເອງໄດ້. ໝາຍເຫດ: ການທີ່ຕົນລົງມືເອງ ຈະບໍ່ແຈ້ງກັບຄືນຫາຕົນ.",
    fallback: true,
  },
};

/**
 * ອ່ານຄ່າ boolean — cache ໄວ້ຕາມ tag ເພາະທຸກໜ້າຄິວຖາມມັນທຸກເທື່ອທີ່ render
 * ແຕ່ມັນປ່ຽນປີລະເທື່ອ. ບັນທຶກການຕັ້ງຄ່າແລ້ວ action ຕ້ອງ `updateTag(SETTING_TAG)`.
 */
export const SETTING_TAG = "ods-setting";

const readSetting = unstable_cache(
  async (key: string): Promise<string | null> => {
    if (!query) return null;
    const row = (await query<{ value: string }>(`select value from ods_setting where key = $1`, [key])).rows[0];
    return row?.value ?? null;
  },
  ["ods-setting"],
  { tags: [SETTING_TAG] },
);

export async function settingEnabled(key: SettingKey): Promise<boolean> {
  const fallback = SETTING_META[key].fallback;
  try {
    const value = await readSetting(key);
    if (value === null) return fallback; // ບໍ່ມີແຖວ = ຄ່າຕັ້ງຕົ້ນ
    return value === "on";
  } catch (error) {
    console.error(`settingEnabled(${key}) failed`, error);
    return fallback; // ຖານລົ້ມ ≠ ປິດຄວາມສາມາດ
  }
}

/** ອ່ານທຸກຄ່າໃຫ້ໜ້າຕັ້ງຄ່າ (ຄ່າຈິງ + ຄ່າຕັ້ງຕົ້ນທີ່ຈະໃຊ້ຖ້າຍັງບໍ່ເຄີຍຕັ້ງ) */
export async function allSettings(): Promise<
  { key: SettingKey; enabled: boolean; configured: boolean; updated_by: string | null; updated_at: string | null }[]
> {
  const keys = Object.values(SETTING);
  try {
    if (!query) throw new Error("no db");
    const rows = (
      await query<{ key: string; value: string; updated_by: string | null; updated_at: string | null }>(
        `select key, value, updated_by, to_char(updated_at,'DD-MM-YYYY HH24:MI') updated_at
           from ods_setting where key = any($1::text[])`,
        [keys],
      )
    ).rows;
    const found = new Map(rows.map((row) => [row.key, row]));
    return keys.map((key) => {
      const row = found.get(key);
      return {
        key,
        enabled: row ? row.value === "on" : SETTING_META[key].fallback,
        configured: Boolean(row),
        updated_by: row?.updated_by ?? null,
        updated_at: row?.updated_at ?? null,
      };
    });
  } catch (error) {
    console.error("allSettings failed", error);
    return keys.map((key) => ({
      key,
      enabled: SETTING_META[key].fallback,
      configured: false,
      updated_by: null,
      updated_at: null,
    }));
  }
}
