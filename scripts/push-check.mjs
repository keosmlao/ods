#!/usr/bin/env node
/**
 * ── ກວດເສັ້ນທາງແຈ້ງເຕືອນເຂົ້າມືຖື (FCM) ຕັ້ງແຕ່ຕົ້ນຮອດປາຍ ──
 *
 * ເປັນຫຍັງຕ້ອງມີ: `pushToUser()` ຈັບ error ໄວ້ໝົດ ແລະ **ບໍ່ຕັ້ງຄ່າ = ບໍ່ສົ່ງແບບງຽບໆ**
 * (ຕັ້ງໃຈ — push ລົ້ມຫ້າມເຮັດໃຫ້ການມອບໝາຍງານລົ້ມ) ⇒ ຈາກຂ້າງນອກແຍກບໍ່ອອກວ່າ
 * "ສົ່ງແລ້ວແຕ່ບໍ່ຮອດມືຖື" ຫຼື "ບໍ່ເຄີຍສົ່ງເລີຍ". ສະຄິບນີ້ຕອບຄຳຖາມນັ້ນພາຍໃນ 10 ວິນາທີ.
 *
 * ⚠️ ຕ້ອງແລ່ນ **ເທິງ server ຈິງ** ຈຶ່ງມີຄວາມໝາຍ — ເພາະສິ່ງທີ່ກວດຄື env ຂອງ server
 * (`.env.local` ບໍ່ຢູ່ໃນ git ⇒ ເຄື່ອງພັດທະນາມີກະແຈ ບໍ່ໄດ້ແປວ່າ server ມີ).
 *
 * ໃຊ້:
 *   node scripts/push-check.mjs                 # ກວດຢ່າງດຽວ (dry-run — ບໍ່ມີມືຖືໃຜສັ່ນ)
 *   node scripts/push-check.mjs --to 22020      # ສົ່ງຈິງໃສ່ເຄື່ອງຂອງຄົນນັ້ນ (ທົດສອບ)
 *
 * ອ່ານ env ຈາກ process.env ກ່ອນ (pm2/systemd ອາດສັກໃຫ້) ແລ້ວຈຶ່ງຫຼົບໄປ .env.local.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { SignJWT, importPKCS8 } from "jose";

const KEYS = ["FCM_PROJECT_ID", "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY"];
const fromProcess = new Set(KEYS.filter((key) => (process.env[key] ?? "").trim()));

let envFile = false;
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  envFile = true;
} catch {
  /* ບໍ່ມີ .env.local — ໃຊ້ env ໂດຍກົງ */
}

const flag = process.argv.indexOf("--to");
const target = flag === -1 ? "" : (process.argv[flag + 1] ?? "").trim();
const REAL = Boolean(target);

const projectId = process.env.FCM_PROJECT_ID?.trim();
const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

console.log("① ຕັ້ງຄ່າ Firebase");
console.log(`   .env.local: ${envFile ? "ພົບ" : "ບໍ່ພົບ (ໃຊ້ env ຂອງ process)"}`);
for (const key of KEYS) {
  const value = (process.env[key] ?? "").trim();
  const where = fromProcess.has(key) ? "env ຂອງ process" : "ໄຟລ໌ .env.local";
  console.log(`   ${value ? "✅" : "❌"} ${key.padEnd(17)} ${value ? `(${where})` : "ຍັງບໍ່ໄດ້ຕັ້ງ"}`);
}
if (!projectId || !clientEmail || !privateKey) {
  console.log("\n⛔ ຂາດກະແຈ ⇒ ລະບົບ **ບໍ່ສົ່ງ push ເລີຍ** (ງຽບໆ ບໍ່ມີ error).");
  console.log("   ຕື່ມ 3 ແຖວນີ້ໃສ່ .env.local ຂອງ server ແລ້ວ restart (pm2 restart odss --update-env)");
  process.exit(1);
}

console.log("\n② ຂໍ access token ຈາກ Google (service account)");
const key = await importPKCS8(privateKey, "RS256");
const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
  .setProtectedHeader({ alg: "RS256" })
  .setIssuer(clientEmail)
  .setSubject(clientEmail)
  .setAudience("https://oauth2.googleapis.com/token")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(key);
const auth = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
});
if (!auth.ok) {
  console.log(`   ❌ ${auth.status} — ${(await auth.text()).replace(/\s+/g, " ").slice(0, 200)}`);
  console.log("   ກະແຈຜິດ/ໝົດອາຍຸ ຫຼື service account ຖືກລຶບ ⇒ ອອກກະແຈໃໝ່ຢູ່ Firebase console.");
  process.exit(1);
}
const bearer = (await auth.json()).access_token;
console.log(`   ✅ 200 · project ${projectId}`);

console.log("\n③ ເຄື່ອງທີ່ລົງທະບຽນໄວ້ (ods_push_token)");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
if (process.env.ODS_SCHEMA?.trim()) await client.query(`set search_path to ${process.env.ODS_SCHEMA.trim()}, public`);

const rows = (
  await client.query(
    target
      ? "select token, user_code, platform, updated_at from ods_push_token where lower(user_code) = lower($1) order by updated_at desc"
      : "select token, user_code, platform, updated_at from ods_push_token order by updated_at desc",
    target ? [target] : [],
  )
).rows;

if (!rows.length) {
  console.log(
    target
      ? `   ❌ "${target}" ຍັງບໍ່ມີເຄື່ອງລົງທະບຽນ — ຕ້ອງ login ແອັບ ແລະ ກົດ "ອະນຸຍາດການແຈ້ງເຕືອນ" ເທື່ອໜຶ່ງກ່ອນ`
      : "   ❌ ບໍ່ມີໃຜລົງທະບຽນເລີຍ",
  );
  await client.end();
  process.exit(1);
}
console.log(`   ພົບ ${rows.length} ເຄື່ອງ${target ? ` ຂອງ "${target}"` : ""}`);

/**
 * ④ ຍິງຈິງ (--to) ຫຼື ກວດເສັ້ນທາງ (validate_only — Google ກວດໃຫ້ໝົດ ແຕ່ບໍ່ສົ່ງອອກ
 * ⇒ ບໍ່ມີມືຖືໃຜສັ່ນ). 404 NotRegistered = ຖອນແອັບ/ລ້າງຂໍ້ມູນ — ໂຄ້ດຈິງລຶບຖິ້ມໃຫ້ເອງ.
 */
console.log(`\n④ ${REAL ? "ສົ່ງຈິງ" : "ກວດເສັ້ນທາງ (dry-run — ບໍ່ມີໃຜໄດ້ຮັບ)"}`);
let ok = 0;
let dead = 0;
for (const row of rows) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify({
      validate_only: !REAL,
      message: {
        token: row.token,
        notification: REAL
          ? { title: "ທົດສອບແຈ້ງເຕືອນ", body: "ຖ້າເຫັນຂໍ້ຄວາມນີ້ = ເສັ້ນທາງ push ໃຊ້ໄດ້ແລ້ວ" }
          : { title: "test", body: "test" },
        data: { kind: "test" },
        android: { priority: "HIGH", notification: { channel_id: "jobs" } },
      },
    }),
  });
  const status = response.status;
  if (status === 404 || status === 403) dead++;
  else if (response.ok) ok++;
  const note = response.ok ? "" : ` ${(await response.text()).replace(/\s+/g, " ").slice(0, 90)}`;
  console.log(
    `   ${response.ok ? "✅" : "❌"} ${String(status).padEnd(4)} ${String(row.user_code).padEnd(12)}` +
      ` ${row.platform ?? "-"} ${row.updated_at.toISOString().slice(0, 16)}${note}`,
  );
}
await client.end();

console.log(`\n⇒ ໃຊ້ໄດ້ ${ok} ເຄື່ອງ · ຕາຍແລ້ວ ${dead} ເຄື່ອງ`);
if (ok && !REAL) console.log("   ເສັ້ນທາງດີ. ຢາກລອງໃຫ້ມືຖືສັ່ນຈິງ: --to <ຊື່ຜູ້ໃຊ້>");
if (REAL && ok) console.log("   ບໍ່ເຫັນຢູ່ມືຖື ທັງທີ່ຂຶ້ນ ✅ ⇒ ໄປເບິ່ງຝັ່ງເຄື່ອງ: ອະນຸຍາດແຈ້ງເຕືອນ · ປະຢັດແບັດເຕີຣີ");
