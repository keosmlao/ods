/**
 * **ບັນທຶກ log ອັດຕະໂນມັດເທິງເອກະສານ — ຫ້ອງສະໝຸດຝັ່ງ server (ບໍ່ແມ່ນ server action).**
 *
 * ── ⚠️ ເປັນຫຍັງບໍ່ຢູ່ໃນ actions/chatter.ts ອີກ ──
 * ໄຟລ໌ `"use server"` ເຮັດໃຫ້**ທຸກ export ກາຍເປັນ endpoint ສາທາລະນະ**. `logChange()`
 * ບໍ່ໄດ້ກວດ session ແລະ ຮັບ `author` ຈາກຜູ້ເອີ້ນ ⇒ ຄົນນອກຂຽນປະຫວັດປອມໃສ່ເອກະສານ
 * ໃດກໍ່ໄດ້ ໃນນາມຂອງໃຜກໍ່ໄດ້ — ປະຫວັດທີ່ປອມໄດ້ ບໍ່ແມ່ນປະຫວັດ.
 * ມັນຖືກເອີ້ນຈາກ action/lib ຝັ່ງ server ເທົ່ານັ້ນ ⇒ ຢູ່ນີ້ບໍ່ມີ endpoint ໃຫ້ຍິງ.
 */
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { notify } from "@/lib/notify";

const NOW = "localtimestamp(0)";

/**
 * ── ຂອບເຂດເວລາຂອງ chatter/log ຕໍ່ໃບປັດຈຸບັນ ──
 * ໃບຮັບເຄື່ອງ (tb_product) ແລະ ງານຕິດຕັ້ງ (ods_tb_install) ໃຊ້ code = max(code)+1.
 * ຖ້າໃບເກົ່າຖືກລຶບ (ຕອນທົດສອບ) ເລກ code ຈະຖືກ **ນຳກັບມາໃຊ້ຄືນ** ແຕ່ log ຂອງໃບເກົ່າ
 * (res_id ດຽວກັນ) ຍັງຄ້າງໃນ ods_chatter_message ⇒ ປະຫວັດຮົ່ວມາປົນ.
 * ຄືນຄ່າ **ເວລາເປີດໃບປັດຈຸບັນ (ລົບ 30 ວິ)** ໃຫ້ query ຕັດ log ກ່ອນໜ້ານັ້ນອອກ.
 * ໃບປະເພດອື່ນ (ic_trans, ar_customer) ບໍ່ recycle code ⇒ ຄືນ null (ບໍ່ຕັດ).
 */
export async function chatterSince(model: string, resId: string): Promise<string | null> {
  if (model !== "tb_product" && model !== "ods_tb_install") return null;
  const table = model === "ods_tb_install" ? "ods_tb_install" : "tb_product";
  const row = (
    await query<{ since: string | null }>(
      `select to_char(time_register - interval '30 seconds','YYYY-MM-DD HH24:MI:SS') since
         from ${table} where code=$1`,
      [resId],
    )
  ).rows[0];
  return row?.since ?? null;
}

/**
 * ຕົວເລືອກຂອງ logChange — ຄວບຄຸມວ່າໃຜໄດ້ຮັບການແຈ້ງເຕືອນນອກຈາກຜູ້ຕິດຕາມ.
 *   author → ຜູ້ຂຽນ log ຖ້າບໍ່ແມ່ນຄົນທີ່ login (ເຊັ່ນ "ລູກຄ້າ")
 *   users  → ຄົນທີ່ຖືກມອບໝາຍໂດຍກົງ (ຊ່າງ, ຜູ້ຮັບຜິດຊອບກິດຈະກຳ)
 *   roles  → ກຸ່ມທີ່ຕ້ອງລົງມືຕໍ່ (ROLE_WAREHOUSE / ROLE_APPROVER ຈາກ lib/chatter)
 */
export type LogOptions = { author?: string; users?: string[]; roles?: string[] };

/* ── ຂຽນ ────────────────────────────────────────────────────────── */

/**
 * ບັນທຶກ log ອັດຕະໂນມັດ + ແຈ້ງເຕືອນຜູ້ກ່ຽວຂ້ອງ — ເອີ້ນຈາກ action ອື່ນຕອນວຽກປ່ຽນຂັ້ນ.
 * ຕັ້ງໃຈໃຫ້ "ບໍ່ພັງງານຫຼັກ": ຖ້າ log ຫຼື ການແຈ້ງເຕືອນລົ້ມ ກໍ່ບໍ່ໃຫ້ການບັນທຶກວຽກຈິງລົ້ມນຳ.
 *
 * ຂໍ້ຄວາມອັນດຽວກັນນີ້ໄປ 2 ບ່ອນພ້ອມກັນ:
 *   ods_chatter_message → ປະຫວັດເທິງເອກະສານ
 *   ods_notification    → ກ່ອງແຈ້ງເຕືອນຂອງຜູ້ຕິດຕາມ (ແທນ LINE Notify ຂອງ ods)
 */
export async function logChange(model: string, resId: string, body: string, options?: LogOptions) {
  const assignees = (options?.users ?? []).map((name) => name.trim()).filter(Boolean);
  try {
    const session = await getSession();
    const who = options?.author ?? session?.username ?? "ລະບົບ";
    await query(
      `insert into ods_chatter_message(model, res_id, kind, body, author, created_at)
       values($1,$2,'log',$3,$4,${NOW})`,
      [model, resId, body, who],
    );
    /**
     * ຄົນທີ່ລົງມືເຮັດ ກາຍເປັນຜູ້ຕິດຕາມເອກະສານນັ້ນເອງ (ຄື Odoo).
     * ⚠️ ໃຊ້ `who` **ບໍ່ແມ່ນ session** — ຄຳສັ່ງຈາກ**ແອັບມືຖື** ມາດ້ວຍ Bearer token
     * ຈຶ່ງບໍ່ມີ cookie session (getSession() = null) ⇒ ຖ້າອີງ session ຢ່າງດຽວ
     * ຊ່າງຈະບໍ່ຖືກເພີ່ມເປັນຜູ້ຕິດຕາມ ແລະ ຄວາມເຄື່ອນໄຫວຈາກແອັບຈະຂຶ້ນວ່າ "ລະບົບ" ເຮັດ.
     */
    if (who && who !== "ລະບົບ") await addFollowerSilently(model, resId, who);
    // ຄົນທີ່ຖືກມອບໝາຍກໍ່ຕິດຕາມນຳ ຈຶ່ງໄດ້ຮັບຄວາມເຄື່ອນໄຫວຄັ້ງຕໍ່ໆໄປ
    for (const user of assignees) await addFollowerSilently(model, resId, user);
  } catch (error) {
    console.error("logChange failed", error);
  }

  await notify(model, resId, body, assignees.length ? "assign" : "log", {
    users: assignees,
    roles: options?.roles,
    actor: options?.author,
  });
}

/** ຄົນທີ່ລົງມື/ຖືກມອບໝາຍ ກາຍເປັນຜູ້ຕິດຕາມເອກະສານ (ຄື Odoo) */
export async function addFollowerSilently(model: string, resId: string, username: string) {
  await query(
    `insert into ods_chatter_follower(model, res_id, username, created_at)
     values($1,$2,$3,${NOW}) on conflict (model, res_id, username) do nothing`,
    [model, resId, username],
  );
}

