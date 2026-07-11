"use server";
import { notify } from "@/app/actions/notification";
import { getSession } from "@/lib/auth";
import type { Activity, ChatterMessage } from "@/lib/chatter";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Chatter ແລະ ກິດຈະກຳ — ແບບ Odoo.
 *
 * ບໍ່ມີໃນ ods ເລີຍ: ລະບົບເກົ່າບໍ່ມີບ່ອນຄຸຍກັນເທິງເອກະສານ ແລະ ບໍ່ມີປະຫວັດວ່າໃຜເຮັດຫຍັງເມື່ອໃດ
 * (ຮູ້ໄດ້ແຕ່ຈາກຖັນເວລາ ເຊັ່ນ time_check). ບ່ອນນີ້ເພີ່ມໃຫ້ 3 ຢ່າງ:
 *   ຂໍ້ຄວາມ (ຄົນພິມ) · log (ລະບົບບັນທຶກເອງຕອນປ່ຽນຂັ້ນ) · ກິດຈະກຳ (ນັດວຽກລ່ວງໜ້າ)
 */

const NOW = "localtimestamp(0)";

export type ChatterState = { error?: string; ok?: string };

/**
 * ຕົວເລືອກຂອງ logChange — ຄວບຄຸມວ່າໃຜໄດ້ຮັບການແຈ້ງເຕືອນນອກຈາກຜູ້ຕິດຕາມ.
 *   author → ຜູ້ຂຽນ log ຖ້າບໍ່ແມ່ນຄົນທີ່ login (ເຊັ່ນ "ລູກຄ້າ")
 *   users  → ຄົນທີ່ຖືກມອບໝາຍໂດຍກົງ (ຊ່າງ, ຜູ້ຮັບຜິດຊອບກິດຈະກຳ)
 *   roles  → ກຸ່ມທີ່ຕ້ອງລົງມືຕໍ່ (ROLE_WAREHOUSE / ROLE_APPROVER ຈາກ lib/chatter)
 */
export type LogOptions = { author?: string; users?: string[]; roles?: string[] };

/* ── ອ່ານ ───────────────────────────────────────────────────────── */

export async function getMessages(model: string, resId: string): Promise<ChatterMessage[]> {
  const session = await getSession();
  if (!session) return [];
  const result = await query<ChatterMessage>(
    `select id, kind, body, author, to_char(created_at,'DD-MM-YYYY HH24:MI') created_at
       from ods_chatter_message where model=$1 and res_id=$2 order by id desc limit 100`,
    [model, resId],
  );
  return result.rows;
}

export async function getActivities(model: string, resId: string): Promise<Activity[]> {
  const session = await getSession();
  if (!session) return [];
  const result = await query<Activity>(
    `select id, model, res_id, kind, summary, note, assigned_to,
        to_char(due_date,'DD-MM-YYYY') due_date, state, created_by,
        (due_date - current_date)::int days_left
       from ods_activity
      where model=$1 and res_id=$2 and state='planned'
      order by due_date`,
    [model, resId],
  );
  return result.rows;
}

export async function getFollowers(model: string, resId: string): Promise<string[]> {
  const session = await getSession();
  if (!session) return [];
  const result = await query<{ username: string }>(
    `select username from ods_chatter_follower where model=$1 and res_id=$2 order by username`,
    [model, resId],
  );
  return result.rows.map((row) => row.username);
}

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

async function addFollowerSilently(model: string, resId: string, username: string) {
  await query(
    `insert into ods_chatter_follower(model, res_id, username, created_at)
     values($1,$2,$3,${NOW}) on conflict (model, res_id, username) do nothing`,
    [model, resId, username],
  );
}

const messageSchema = z.object({
  model: z.string().min(1),
  res_id: z.string().min(1),
  body: z.string().trim().min(1),
});

export async function postMessage(_: ChatterState, formData: FormData): Promise<ChatterState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ກະລຸນາພິມຂໍ້ຄວາມ" };
  const { model, res_id, body } = parsed.data;

  try {
    await query(
      `insert into ods_chatter_message(model, res_id, kind, body, author, created_at)
       values($1,$2,'comment',$3,$4,${NOW})`,
      [model, res_id, body, session.username],
    );
    await addFollowerSilently(model, res_id, session.username);
  } catch (error) {
    console.error("postMessage failed", error);
    return { error: "ສົ່ງຂໍ້ຄວາມບໍ່ສຳເລັດ" };
  }

  // ຜູ້ຕິດຕາມຄົນອື່ນຮູ້ວ່າມີຄົນເວົ້າເຖິງເອກະສານນີ້
  await notify(model, res_id, body, "comment");

  revalidatePath("/", "layout");
  return { ok: "ສົ່ງແລ້ວ" };
}

export async function toggleFollow(model: string, resId: string) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const existing = await query(
    `delete from ods_chatter_follower where model=$1 and res_id=$2 and username=$3`,
    [model, resId, session.username],
  );
  if (!existing.rowCount) await addFollowerSilently(model, resId, session.username);

  revalidatePath("/", "layout");
  return {};
}

/* ── ກິດຈະກຳ ────────────────────────────────────────────────────── */

const activitySchema = z.object({
  model: z.string().min(1),
  res_id: z.string().min(1),
  kind: z.enum(["todo", "call", "visit", "meeting"]),
  summary: z.string().trim().min(1),
  note: z.string().optional(),
  assigned_to: z.string().trim().min(1),
  due_date: z.string().min(1),
});

export async function scheduleActivity(_: ChatterState, formData: FormData): Promise<ChatterState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ — ຕ້ອງມີ ຫົວຂໍ້, ຜູ້ຮັບຜິດຊອບ ແລະ ວັນກຳນົດ" };
  const { model, res_id, kind, summary, note, assigned_to, due_date } = parsed.data;

  try {
    await query(
      `insert into ods_activity(model, res_id, kind, summary, note, assigned_to, due_date, state, created_by, created_at)
       values($1,$2,$3,$4,nullif($5,''),$6,$7::date,'planned',$8,${NOW})`,
      [model, res_id, kind, summary, note ?? "", assigned_to, due_date, session.username],
    );
  } catch (error) {
    console.error("scheduleActivity failed", error);
    return { error: "ບັນທຶກກິດຈະກຳບໍ່ສຳເລັດ" };
  }

  // ຜູ້ຮັບຜິດຊອບກິດຈະກຳໄດ້ຮັບການແຈ້ງເຕືອນ ແລະ ກາຍເປັນຜູ້ຕິດຕາມເອກະສານນຳ
  await logChange(model, res_id, `ນັດກິດຈະກຳ: ${summary} · ມອບໃຫ້ ${assigned_to} · ກຳນົດ ${due_date}`, {
    users: [assigned_to],
  });

  revalidatePath("/", "layout");
  return { ok: "ນັດກິດຈະກຳແລ້ວ" };
}

export async function completeActivity(id: number, doneNote?: string) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const row = (
    await query<{ model: string; res_id: string; summary: string }>(
      `update ods_activity set state='done', done_at=${NOW}, done_note=nullif($2,'')
        where id=$1 and state='planned'
        returning model, res_id, summary`,
      [id, doneNote ?? ""],
    )
  ).rows[0];

  if (row) {
    const suffix = doneNote?.trim() ? ` — ${doneNote.trim()}` : "";
    await logChange(row.model, row.res_id, `ກິດຈະກຳສຳເລັດ: ${row.summary}${suffix}`);
  }

  revalidatePath("/", "layout");
  return {};
}

export async function cancelActivity(id: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const row = (
    await query<{ model: string; res_id: string; summary: string }>(
      `update ods_activity set state='cancelled', done_at=${NOW}
        where id=$1 and state='planned' returning model, res_id, summary`,
      [id],
    )
  ).rows[0];

  if (row) await logChange(row.model, row.res_id, `ຍົກເລີກກິດຈະກຳ: ${row.summary}`);

  revalidatePath("/", "layout");
  return {};
}

/* ── ກິດຈະກຳຂອງຜູ້ໃຊ້ (ໜ້າລວມ + ປ້າຍຕົວເລກເທິງ topbar) ─────────── */

export async function myActivityCount(): Promise<{ total: number; late: number }> {
  const session = await getSession();
  if (!session) return { total: 0, late: 0 };
  const row = (
    await query<{ total: number; late: number }>(
      `select count(*)::int total,
          count(*) filter (where due_date < current_date)::int late
        from ods_activity where assigned_to=$1 and state='planned'`,
      [session.username],
    )
  ).rows[0];
  return { total: row?.total ?? 0, late: row?.late ?? 0 };
}

export async function myActivities(): Promise<Activity[]> {
  const session = await getSession();
  if (!session) return [];
  const result = await query<Activity>(
    `select id, model, res_id, kind, summary, note, assigned_to,
        to_char(due_date,'DD-MM-YYYY') due_date, state, created_by,
        (due_date - current_date)::int days_left
       from ods_activity
      where assigned_to=$1 and state='planned'
      order by due_date`,
    [session.username],
  );
  return result.rows;
}

/**
 * ກິດຈະກຳຂອງທຸກຄົນ — ໃຊ້ໃນແທັບ "ທຸກຄົນ" ຂອງໜ້າກິດຈະກຳ.
 * ຊ່າງ (technical) ເຫັນສະເພາະຂອງຕົນເອງ ຈຶ່ງບໍ່ໃຫ້ເອີ້ນ (ຄືກົດເກນ ownJobsOnly).
 */
export async function allActivities(): Promise<Activity[]> {
  const session = await getSession();
  if (!session || session.role === "technical") return [];
  const result = await query<Activity>(
    `select id, model, res_id, kind, summary, note, assigned_to,
        to_char(due_date,'DD-MM-YYYY') due_date, state, created_by,
        (due_date - current_date)::int days_left
       from ods_activity
      where state='planned'
      order by due_date, assigned_to`,
  );
  return result.rows;
}
