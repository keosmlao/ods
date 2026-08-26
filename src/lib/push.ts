import { query } from "@/lib/db";
import { recipientsForRoles } from "@/lib/notify";
import { disabledPushEvents } from "@/lib/push-event";
import { applyPushChoice } from "@/lib/push-recipient";
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

/**
 * ⚠️ ບໍ່ຕັ້ງຄ່າ = **ງຽບສະນິດ** — ນີ້ຄືເຫດຜົນທີ່ບັນຫາ "ບໍ່ມີ push ເຂົ້າແອັບ" ຢູ່ໄດ້ດົນ
 * ໂດຍບໍ່ມີໃຜຮູ້: `.env.local` **ບໍ່ຢູ່ໃນ git** (ເບິ່ງ docs/06-deploy.md) ⇒ ກະແຈ FCM ທີ່
 * ຕັ້ງຢູ່ເຄື່ອງພັດທະນາ **ບໍ່ໄດ້ຕິດຂຶ້ນ server ນຳ**. ຈຶ່ງເຕືອນລົງ log ຄັ້ງດຽວ (ບໍ່ຖີ່)
 * ໃຫ້ເຫັນຢູ່ `pm2 logs` ວ່າ push ຖືກປິດຢູ່ ບໍ່ແມ່ນ "ສົ່ງແລ້ວແຕ່ບໍ່ຮອດ".
 */
let warned = false;

function config() {
  const projectId = process.env.FCM_PROJECT_ID?.trim();
  const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) {
    if (!warned) {
      warned = true;
      console.warn(
        "push: ຍັງບໍ່ໄດ້ຕັ້ງ FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY " +
          "⇒ **ບໍ່ສົ່ງແຈ້ງເຕືອນເຂົ້າມືຖືເລີຍ** (ເວັບຍັງປົກກະຕິ). ຕັ້ງໃສ່ .env.local ຂອງ server ແລ້ວ restart.",
      );
    }
    return null;
  }
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
 * **ສົ່ງແຈ້ງເຕືອນຫາກຸ່ມ role** (ຜູ້ອະນຸມັດ · ຜູ້ຈັດການ · ສາງ) — 07-08-2026.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * `pushToUser` ຍິງໄດ້ເທື່ອລະຄົນ ⇒ ຄົນທີ່ຖືກມອບໝາຍງານ (ຊ່າງ) ໄດ້ຮັບ push ຢູ່ແລ້ວ
 * ແຕ່ **ຜູ້ຈັດການ/ຜູ້ອະນຸມັດບໍ່ເຄີຍໄດ້ຮັບຈັກເທື່ອ** ⇒ ໃບສະເໜີລາຄາ ຫຼື ຄຳຂໍຍົກເລີກ
 * ຄາຄິວໂດຍບໍ່ມີໃຜຮູ້ ຈົນກວ່າຈະເປີດແອັບເບິ່ງເອງ.
 *
 * ── ຍິງສະເພາະເລື່ອງທີ່ "ລໍການຕັດສິນ" ເທົ່ານັ້ນ ──
 * ຄວາມເຄື່ອນໄຫວທົ່ວໄປມີ **154,689 ແຖວ/ມື້** (579 ເຫດການ × 258 ຄົນ) ⇒ ຍິງໝົດ
 * ຄືການທຳລາຍປະໂຫຍດຂອງ push. ຈຸດທີ່ເອີ້ນ = ຈຸດທີ່ເອກະສານ**ເຂົ້າຄິວອະນຸມັດ**
 * (ນັບຈິງ < 20 ຄັ້ງ/ມື້) — ຢ່າເອົາໄປໃສ່ logChange ທົ່ວໄປ.
 */
export async function pushToRoles(
  roles: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    if (!config()) return;
    // ຜູ້ຈັດການຕື່ມ/ຕັດຜູ້ຮັບເອງໄດ້ທີ່ /manage/push-recipients — ບໍ່ໄດ້ກຳນົດ = ຕາມ role ຄືເກົ່າ
    const users = await applyPushChoice("approval", await recipientsForRoles(roles));
    // ຄົນດຽວອາດຢູ່ຫຼາຍ role ⇒ ຕັດຊ້ຳກ່ອນ ບໍ່ດັ່ງນັ້ນມືຖືສັ່ນສອງເທື່ອ
    await Promise.all([...new Set(users)].map((user) => pushToUser(user, title, body, data)));
  } catch (error) {
    console.error("pushToRoles failed", error);
  }
}

/**
 * ── **ສະຫຼຸບການເຄື່ອນໄຫວເຂົ້າມືຖື** (07-08-2026 ຕາມຄຳສັ່ງ "ຜູ້ຈັດການຕ້ອງເຫັນທຸກຢ່າງ") ──
 *
 * ທຸກແຖວຍັງເຂົ້າກ່ອງແຈ້ງເຕືອນ **ຄົບ 100%** (ໜ້າຈໍເຫັນໝົດ) — ອັນນີ້ຄື**ສຽງເອີ້ນ**ໃຫ້ຮູ້ວ່າ
 * ມີຂອງໃໝ່. ຍິງທຸກແຖວບໍ່ໄດ້: ວັດຈິງ 154,689 ແຖວ/ມື້ (579 ເຫດການ × 258 ຄົນ) ⇒ ຜູ້ຈັດການ
 * ຄົນດຽວ 630 ຄັ້ງ/ມື້ ⇒ ຄົນປິດແຈ້ງເຕືອນພາຍໃນມື້ດຽວ ແລ້ວກາຍເປັນ "ບໍ່ເຫັນຫຍັງເລີຍ"
 * (Android ເອງກໍ່ຍຸບ/ຈຳກັດຂໍ້ຄວາມທີ່ມາຖີ່ເກີນ).
 *
 * ⇒ ຮວບເປັນສະຫຼຸບ: ຢ່າງໜ້ອຍ `DIGEST_MINUTES` ນາທີຕໍ່ຄັ້ງ ຕໍ່ 1 ຄົນ
 *   "ມີການເຄື່ອນໄຫວ 37 ລາຍການໃໝ່ · ລ່າສຸດ: …" ⇒ ກົດເຂົ້າໄປອ່ານທັງໝົດໄດ້.
 *
 * ນັບຈາກ `ods_notification` ໂດຍກົງ (ຂອງຄົນນັ້ນເອງ) ບໍ່ແມ່ນນັບເອົາຈາກຜູ້ເອີ້ນ
 * ⇒ ຕົວເລກຖືກສະເໝີ ເຖິງຈະມີຫຼາຍເຫດການເກີດພ້ອມກັນ.
 */
const DIGEST_MINUTES = 15;

export async function digestPush(usernames: string[]): Promise<void> {
  try {
    if (!config() || usernames.length === 0) return;
    // ຜູ້ຈັດການເລືອກໄດ້ວ່າໃຜຄວນໄດ້ຮັບສະຫຼຸບ (/manage/push-recipients) — ບໍ່ໄດ້ກຳນົດ = ທຸກຄົນຄືເກົ່າ
    const targets = await applyPushChoice("digest", usernames);
    /**
     * ປະເພດທີ່ຜູ້ຈັດການ**ປິດ**ບໍ່ໃຫ້ຍິງເຂົ້າແອັບ — ຕ້ອງຕັດອອກຈາກ**ການນັບ**ນຳ
     * ບໍ່ດັ່ງນັ້ນສະຫຼຸບຈະບອກ "ມີ 37 ລາຍການໃໝ່" ໂດຍນັບເອົາອັນທີ່ຖືກປິດປົນເຂົ້າມາ
     * (ແຖວຍັງຢູ່ໃນຖານສະເໝີ — ປິດແຕ່ສຽງເອີ້ນ ບໍ່ໄດ້ປິດປະຫວັດ).
     */
    const muted = [...(await disabledPushEvents())];
    for (const username of [...new Set(targets.map((name) => name.trim()).filter(Boolean))]) {
      /**
       * ຈອງສິດສົ່ງແບບ **atomic**: ແຖວຖືກອັບເດດຕໍ່ເມື່ອຄົບໄລຍະແລ້ວ ⇒ ສອງຄຳຂໍທີ່ມາພ້ອມກັນ
       * ມີແຕ່ອັນດຽວທີ່ໄດ້ແຖວກັບຄືນ ⇒ ບໍ່ຍິງຊ້ຳ (ຫຼັກການດຽວກັບ claimErpSyncSlot).
       */
      const slot = await query<{ last_id: string }>(
        `insert into ods_push_digest(username, last_push_at, last_id)
         values($1, localtimestamp(0), 0)
         on conflict (username) do update
            set last_push_at = localtimestamp(0)
          where ods_push_digest.last_push_at < localtimestamp - interval '${DIGEST_MINUTES} minutes'
         returning last_id::text`,
        [username],
      );
      if (!slot.rowCount) continue; // ຫາກໍ່ສົ່ງໄປ — ລໍຮອບໜ້າ

      const since = Number(slot.rows[0]?.last_id ?? 0);
      const stat = (
        await query<{ n: number; max_id: string; body: string | null }>(
          `select count(*)::int n, coalesce(max(id),$2)::text max_id,
              (select body from ods_notification
                where username=$1 and id > $2 and (model || ':' || kind) <> all($3::text[])
                order by id desc limit 1) body
             from ods_notification
            where username=$1 and id > $2 and read_at is null
              and (model || ':' || kind) <> all($3::text[])`,
          [username, since, muted],
        )
      ).rows[0];
      const total = stat?.n ?? 0;
      if (total === 0) continue;

      await query("update ods_push_digest set last_id=$2 where username=$1", [username, stat?.max_id ?? "0"]);
      await pushToUser(
        username,
        total === 1 ? "ມີການເຄື່ອນໄຫວໃໝ່" : `ມີການເຄື່ອນໄຫວໃໝ່ ${total} ລາຍການ`,
        (stat?.body ?? "").slice(0, 120),
        { kind: "digest" },
      );
    }
  } catch (error) {
    // ຫ້າມໂຍນຕໍ່ — ສະຫຼຸບລົ້ມ ບໍ່ຄວນເຮັດໃຫ້ການບັນທຶກງານລົ້ມ
    console.error("digestPush failed", error);
  }
}

/**
 * **ຊ່ອງແຈ້ງເຕືອນ (Android channel)** — ຕ້ອງຕົງກັບ `mobile/lib/push.dart`.
 *
 * ── ເປັນຫຍັງຕ້ອງມີຫຼາຍກວ່າ 1 ຊ່ອງ (26-08-2026) ──
 * ແຕ່ກ່ອນທຸກຂໍ້ຄວາມຍິງເຂົ້າຊ່ອງດຽວ (`jobs`, ດັງແຮງ) ⇒ "ມີງານໃໝ່ມອບໃຫ້ທ່ານ" ກັບ
 * "ມີການເຄື່ອນໄຫວ 37 ລາຍການ" ດັງເທົ່າກັນ. ຄົນທີ່ຮຳຄານສະຫຼຸບຈຶ່ງມີທາງເລືອກດຽວຄື
 * **ປິດແຈ້ງເຕືອນຂອງແອັບທັງໝົດ** ແລ້ວກໍ່ພາດງານທີ່ມອບໃຫ້ໄປນຳ.
 * ແຍກຊ່ອງແລ້ວ Android ໃຫ້ຄົນປິດ**ສະເພາະຊ່ອງທີ່ດັງເກີນ**ໄດ້ໃນຕັ້ງຄ່າຂອງເຄື່ອງ
 * ໂດຍທີ່ງານຂອງຕົນຍັງດັງຢູ່.
 *
 * ⚠️ ຊ່ອງ Android **ສ້າງແລ້ວແກ້ບໍ່ໄດ້** — ຈະປ່ຽນສຽງ/ຄວາມແຮງຕ້ອງໃຊ້ id ໃໝ່.
 */
export type PushChannel = "jobs" | "digest" | "alert";

/**
 * ເລືອກຊ່ອງຈາກ `data.kind`/`data.type` ທີ່ຜູ້ເອີ້ນສົ່ງມາຢູ່ແລ້ວ.
 * ບໍ່ຮູ້ຈັກ ⇒ `jobs` (ດັງ) — ຜິດພາດໄປທາງ**ໃຫ້ຄົນເຫັນ** ດີກວ່າມິດງຽບແລ້ວພາດງານ.
 */
function channelFor(data?: Record<string, string>): PushChannel {
  /*
    ຜູ້ເອີ້ນລະບຸເອງໄດ້ (`channel`) ແລະ **ຊະນະສະເໝີ** — ຈຳເປັນສຳລັບຂໍ້ຄວາມທີ່
    ລະບຸຕົວຄົນໂດຍກົງ: ຄົນນັ້ນຖືກ**ເອີ້ນຫາຊື່** ⇒ ຕ້ອງດັງ ເຖິງວ່າ kind ຈະເປັນ `log`
    ກໍ່ຕາມ (ບໍ່ດັ່ງນັ້ນ "ສາງເບີກອາໄຫຼ່ໃຫ້ແລ້ວ" ຈະງຽບໄປຢູ່ຊ່ອງສະຫຼຸບ).
  */
  const forced = (data?.channel ?? "").toLowerCase();
  if (forced === "jobs" || forced === "digest" || forced === "alert") return forced;
  const kind = (data?.kind ?? data?.type ?? "").toLowerCase();
  if (kind === "digest" || kind === "log") return "digest";
  if (kind === "app_update" || kind === "day_brief" || kind === "sla") return "alert";
  return "jobs";
}

/**
 * ຂໍ້ຄວາມທີ່ **ອັນໃໝ່ແທນອັນເກົ່າ** ໄດ້ ⇒ ໃສ່ `tag` ດຽວກັນ.
 * ສະຫຼຸບ ("ມີການເຄື່ອນໄຫວ 37 ລາຍການ") ທຸກ 15 ນາທີ ຖ້າບໍ່ໃສ່ tag ຈະກອງກັນເປັນ
 * ຕັ້ງຢູ່ໃນ tray ທັງທີ່ອັນລ່າສຸດອັນດຽວກໍ່ພຽງພໍ — ຄືກັນກັບ "ມີເວີຊັນໃໝ່".
 * ສ່ວນ `jobs` **ບໍ່ໃສ່** — ງານ 2 ໃບຄື 2 ເລື່ອງ ບໍ່ຄວນທັບກັນ.
 */
function tagFor(channel: PushChannel, data?: Record<string, string>): string | undefined {
  if (channel === "digest") return "digest";
  if (channel === "alert") return (data?.kind ?? data?.type ?? "alert").toLowerCase();
  return undefined;
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

    /**
     * ທຽບແບບ **ບໍ່ສົນໂຕພິມໃຫຍ່-ນ້ອຍ**: ຊື່ຜູ້ໃຊ້ເກົ່າຂອງ ODS ຂຽນຄົນລະຮູບ ('Mee' · 'Phuang')
     * ແລະ ບ່ອນເອີ້ນອາດສົ່ງມາອີກຮູບໜຶ່ງ ⇒ ທຽບຕົງໆຈະຫຼົ່ນຄົນໂດຍບໍ່ມີ error (ຕາຕະລາງນ້ອຍ ບໍ່ໜັກ).
     */
    const tokens = (
      await query<{ token: string }>("select token from ods_push_token where lower(user_code) = lower($1)", [
        userCode,
      ])
    ).rows;
    if (tokens.length === 0) return;

    const bearer = await accessToken();
    if (!bearer) return;

    const channel = channelFor(data);
    const collapse = tagFor(channel, data);

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
                android: {
                  // ສະຫຼຸບບໍ່ຮີບ ⇒ NORMAL: ບໍ່ປຸກເຄື່ອງທີ່ນອນຢູ່ (ປະຢັດແບັດ ແລະ ບໍ່ລົບກວນ)
                  priority: channel === "digest" ? "NORMAL" : "HIGH",
                  ...(collapse ? { collapse_key: collapse } : {}),
                  notification: {
                    channel_id: channel,
                    ...(collapse ? { tag: collapse } : {}),
                    // ສີ + ຮູບກະແຈ ⇒ ຂໍ້ຄວາມໃນ tray ເປັນຂອງ ODS ຈະແຈ້ງ (ມີ້ນ v6)
                    color: "#14B8A6",
                    icon: "ic_notification",
                    notification_priority: channel === "digest" ? "PRIORITY_LOW" : "PRIORITY_HIGH",
                  },
                },
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
