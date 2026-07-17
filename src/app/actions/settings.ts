"use server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { SETTING_META, SETTING_TAG, type SettingKey } from "@/lib/settings";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

/**
 * **ເປີດ/ປິດ ການຕັ້ງຄ່າລະບົບ** — ຜູ້ຈັດການເທົ່ານັ້ນ.
 *
 * ການຕັ້ງຄ່າພວກນີ້ປ່ຽນ**ພຶດຕິກຳຂອງທັງລະບົບ** (ຕົວຢ່າງ: ທຸງ "ມີບັນຫາ" ຢຸດນາລິກາ KPI)
 * ⇒ ບໍ່ແມ່ນສິດຂອງຫົວໜ້າໜ່ວຍງານ. ໃຊ້ `manager` ດຽວ ບໍ່ແມ່ນ APPROVER_SIDE.
 */

export type SettingState = { error?: string; ok?: boolean };

const schema = z.object({
  key: z.string().trim(),
  enabled: z.enum(["on", "off"]),
});

export async function setSetting(_: SettingState, formData: FormData): Promise<SettingState> {
  const guard = await requireRole(["manager"], "ສະເພາະຜູ້ຈັດການທີ່ແກ້ການຕັ້ງຄ່າໄດ້");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = schema.safeParse({
    key: String(formData.get("key") ?? ""),
    enabled: String(formData.get("enabled") ?? ""),
  });
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  // ຢ່າເຊື່ອ key ຈາກ form — ຮັບສະເພາະ key ທີ່ນິຍາມໄວ້ (ບໍ່ດັ່ງນັ້ນຄົນຍັດແຖວຂີ້ເຫຍື້ອໄດ້)
  const key = parsed.data.key as SettingKey;
  if (!(key in SETTING_META)) return { error: `ບໍ່ຮູ້ຈັກການຕັ້ງຄ່າ ${parsed.data.key}` };

  try {
    await db.query(
      `insert into ods_setting(key, value, updated_by, updated_at)
       values($1,$2,$3, localtimestamp(0))
       on conflict (key) do update
          set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      [key, parsed.data.enabled, guard.session.username],
    );
  } catch (error) {
    console.error("setSetting failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  }

  // ຄ່າຖືກ cache ໄວ້ (lib/settings) ⇒ ບໍ່ລ້າງ tag ໜ້າອື່ນຈະຍັງເຫັນຄ່າເກົ່າ
  updateTag(SETTING_TAG);
  revalidatePath("/manage/settings");
  revalidatePath("/(app)/dashboard/status/[workflow]/[status]", "page");
  revalidatePath("/service");
  return { ok: true };
}
