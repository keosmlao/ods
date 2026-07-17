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
    // ຄົນທີ່ລົງມືເຮັດ ກາຍເປັນຜູ້ຕິດຕາມເອກະສານນັ້ນເອງ (ຄື Odoo)
    if (session?.username) await addFollowerSilently(model, resId, session.username);
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

