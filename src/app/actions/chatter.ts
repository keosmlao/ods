"use server";
import { addFollowerSilently, logChange } from "@/lib/chatter-log";
import { notify } from "@/lib/notify";
import { getSession, type Session } from "@/lib/auth";
import type { Activity, ChatterMessage } from "@/lib/chatter";
import { query } from "@/lib/db";
import { roleOf } from "@/lib/roles";
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


export type ChatterState = { error?: string; ok?: string };

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

/**
 * ໃຜແຕະກິດຈະກຳໄດ້ — **ຜູ້ຮັບຜິດຊອບ ຫຼື ຜູ້ນັດ** (ຜູ້ຈັດການແຕະໄດ້ໝົດ).
 * ແຕ່ກ່ອນເງື່ອນໄຂມີແຕ່ `id=$1` ⇒ ຜູ້ໃຊ້ຄົນໃດກໍ່ປິດ/ຍົກເລີກກິດຈະກຳຂອງຄົນອື່ນໄດ້
 * ພຽງແຕ່ຮູ້ເລກ id (ເປັນເລກລຽງລຳດັບ ⇒ ເດົາງ່າຍ).
 */
const activityScope = (session: Session, placeholder: string) =>
  roleOf(session) === "manager" ? "true" : `(assigned_to=${placeholder} or created_by=${placeholder})`;

export async function completeActivity(id: number, doneNote?: string) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const row = (
    await query<{ model: string; res_id: string; summary: string }>(
      `update ods_activity set state='done', done_at=${NOW}, done_note=nullif($2,'')
        where id=$1 and state='planned' and ${activityScope(session, "$3")}
        returning model, res_id, summary`,
      [id, doneNote ?? "", session.username],
    )
  ).rows[0];

  if (!row) return { error: "ກິດຈະກຳນີ້ປິດໄປແລ້ວ ຫຼື ບໍ່ແມ່ນຂອງທ່ານ" };

  const suffix = doneNote?.trim() ? ` — ${doneNote.trim()}` : "";
  await logChange(row.model, row.res_id, `ກິດຈະກຳສຳເລັດ: ${row.summary}${suffix}`);

  revalidatePath("/", "layout");
  return {};
}

export async function cancelActivity(id: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const row = (
    await query<{ model: string; res_id: string; summary: string }>(
      `update ods_activity set state='cancelled', done_at=${NOW}
        where id=$1 and state='planned' and ${activityScope(session, "$2")}
        returning model, res_id, summary`,
      [id, session.username],
    )
  ).rows[0];

  if (!row) return { error: "ກິດຈະກຳນີ້ປິດໄປແລ້ວ ຫຼື ບໍ່ແມ່ນຂອງທ່ານ" };

  await logChange(row.model, row.res_id, `ຍົກເລີກກິດຈະກຳ: ${row.summary}`);

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
