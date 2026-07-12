import { query } from "@/lib/db";

/**
 * ແຈ້ງເຕືອນອອກມືຖື — ຜ່ານ Expo Push (https://exp.host).
 *
 * ── ເປັນຫຍັງ Expo ບໍ່ແມ່ນ FCM/APNs ໂດຍກົງ ──
 * FCM/APNs ຕ້ອງມີກະແຈຂອງ Apple/Google ແລະ ຕັ້ງຄ່າຄົນລະຢ່າງສອງລະບົບ.
 * Expo ຮັບ token ດຽວ (ExponentPushToken[...]) ແລ້ວສົ່ງຕໍ່ໃຫ້ທັງສອງ — ບໍ່ຕ້ອງມີ
 * ກະແຈຢູ່ຝັ່ງ server ນີ້ເລີຍ. ຖ້າມື້ໜ້າຢາກຍ້າຍໄປ FCM ໂດຍກົງ ປ່ຽນສະເພາະໄຟລ໌ນີ້.
 *
 * ── ບໍ່ໃຫ້ລົ້ມງານ ──
 * push ລົ້ມເຫຼວ **ຫ້າມ** ເຮັດໃຫ້ການມອບໝາຍງານລົ້ມເຫຼວ ⇒ ຈັບ error ໄວ້ໝົດ
 * (ຄືກັບ recordPayout ຂອງຄ່າຄອມ). ງານຕ້ອງຖືກມອບໝາຍໄດ້ ເຖິງແອັບຈະສົ່ງບໍ່ອອກ.
 */

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

type PushMessage = { to: string; title: string; body: string; data?: Record<string, unknown> };

/** ບັນທຶກ/ອັບເດດ token ຂອງເຄື່ອງ — ຄົນນຶ່ງມີຫຼາຍເຄື່ອງໄດ້ */
export async function savePushToken(userCode: string, token: string, platform: string | null) {
  await query(
    `insert into ods_push_token(token, user_code, platform)
     values($1,$2,nullif($3,''))
     on conflict (token) do update
        set user_code = excluded.user_code, platform = excluded.platform, updated_at = localtimestamp(0)`,
    [token, userCode, platform ?? ""],
  );
}

export async function removePushToken(token: string) {
  await query("delete from ods_push_token where token = $1", [token]);
}

/**
 * ສົ່ງແຈ້ງເຕືອນຫາທຸກເຄື່ອງຂອງຄົນນຶ່ງ.
 * ຕອບກັບຈາກ Expo ບອກວ່າ token ໃດຕາຍ (DeviceNotRegistered) → ລຶບຖິ້ມທັນທີ
 * ບໍ່ດັ່ງນັ້ນຕາຕະລາງຈະເຕັມໄປດ້ວຍ token ຜີ ແລະ ທຸກການສົ່ງຈະຊ້າລົງເລື້ອຍໆ.
 */
export async function pushToUser(
  userCode: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const tokens = (
      await query<{ token: string }>("select token from ods_push_token where user_code = $1", [userCode])
    ).rows;
    if (tokens.length === 0) return;

    const messages: PushMessage[] = tokens.map((row) => ({ to: row.token, title, body, data }));
    const response = await fetch(EXPO_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      console.error("Expo push failed", response.status, await response.text());
      return;
    }

    const result = (await response.json()) as { data?: { status: string; details?: { error?: string } }[] };
    await Promise.all(
      (result.data ?? []).map(async (item, index) => {
        if (item.status === "error" && item.details?.error === "DeviceNotRegistered") {
          await removePushToken(messages[index].to);
        }
      }),
    );
  } catch (error) {
    // ຫ້າມໂຍນຕໍ່ — ການແຈ້ງເຕືອນລົ້ມ ບໍ່ຄວນເຮັດໃຫ້ການມອບໝາຍງານລົ້ມ
    console.error("pushToUser failed", error);
  }
}
