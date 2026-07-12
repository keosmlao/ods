import { query } from "@/lib/db";
import { SignJWT, importPKCS8 } from "jose";

/**
 * ແຈ້ງເຕືອນອອກມືຖືຊ່າງ — **FCM (Firebase Cloud Messaging) HTTP v1**.
 *
 * ── ເປັນຫຍັງ FCM ບໍ່ແມ່ນ Expo Push ──
 * ແອັບຮຸ່ນທຳອິດເປັນ Expo (React Native) ຈຶ່ງໃຊ້ Expo Push ໄດ້. ດຽວນີ້ແອັບເປັນ
 * **Flutter** ⇒ ໃຊ້ Expo Push ບໍ່ໄດ້ອີກ ຕ້ອງຍິງເຂົ້າ FCM ໂດຍກົງ (FCM ສົ່ງຕໍ່ໃຫ້
 * Android ເອງ ແລະ ໃຫ້ APNs ຂອງ iOS ໃຫ້).
 *
 * ── ຕັ້ງຄ່າ (.env) ──
 *   FCM_PROJECT_ID   = ໄອດີໂປຣເຈັກ Firebase
 *   FCM_CLIENT_EMAIL = service account (…@….iam.gserviceaccount.com)
 *   FCM_PRIVATE_KEY  = ກະແຈຂອງ service account (ໃສ່ \n ແທນຂຶ້ນແຖວໃໝ່ໄດ້)
 * ບໍ່ຕັ້ງ = ບໍ່ສົ່ງ (ບັນທຶກ log ໄວ້) — **ແອັບ ແລະ ເວັບຍັງໃຊ້ໄດ້ປົກກະຕິ**.
 *
 * ── ຫ້າມລົ້ມງານ ──
 * push ລົ້ມເຫຼວ **ຫ້າມ** ເຮັດໃຫ້ການມອບໝາຍງານລົ້ມເຫຼວ ⇒ ຈັບ error ໄວ້ໝົດ
 * (ຄືກັບ recordPayout ຂອງຄ່າຄອມ). ງານຕ້ອງຖືກມອບໝາຍໄດ້ ເຖິງແຈ້ງເຕືອນຈະສົ່ງບໍ່ອອກ.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function config() {
  const projectId = process.env.FCM_PROJECT_ID?.trim();
  const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/** access token ຂອງ Google — ອາຍຸ 1 ຊົ່ວໂມງ ⇒ ເກັບໄວ້ໃຊ້ຊ້ຳ (ບໍ່ຂໍໃໝ່ທຸກຄັ້ງທີ່ສົ່ງ) */
let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string | null> {
  const settings = config();
  if (!settings) return null;
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const key = await importPKCS8(settings.privateKey, "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(settings.clientEmail)
    .setSubject(settings.clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    console.error("FCM token failed", response.status, await response.text());
    return null;
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

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
 * FCM ຕອບ 404 (NOT_FOUND) ຫຼື 403 ເມື່ອ token ຕາຍ → ລຶບຖິ້ມທັນທີ
 * ບໍ່ດັ່ງນັ້ນຕາຕະລາງຈະເຕັມໄປດ້ວຍ token ຜີ ແລະ ທຸກການສົ່ງຈະຊ້າລົງເລື້ອຍໆ.
 */
export async function pushToUser(
  userCode: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const settings = config();
    if (!settings) return; // ຍັງບໍ່ຕັ້ງຄ່າ Firebase — ບໍ່ສົ່ງ ແຕ່ບໍ່ລົ້ມງານ

    const tokens = (
      await query<{ token: string }>("select token from ods_push_token where user_code = $1", [userCode])
    ).rows;
    if (tokens.length === 0) return;

    const bearer = await accessToken();
    if (!bearer) return;

    await Promise.all(
      tokens.map(async ({ token }) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${settings.projectId}/messages:send`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: data ?? {},
                android: { priority: "HIGH", notification: { channel_id: "jobs" } },
              },
            }),
          },
        );

        if (response.status === 404 || response.status === 403) {
          await removePushToken(token); // ເຄື່ອງຖອນແອັບ / token ຕາຍ
          return;
        }
        if (!response.ok) console.error("FCM send failed", response.status, await response.text());
      }),
    );
  } catch (error) {
    // ຫ້າມໂຍນຕໍ່ — ການແຈ້ງເຕືອນລົ້ມ ບໍ່ຄວນເຮັດໃຫ້ການມອບໝາຍງານລົ້ມ
    console.error("pushToUser failed", error);
  }
}
