"use server";
import { getSession } from "@/lib/auth";
import type { Notification } from "@/lib/chatter";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ການແຈ້ງເຕືອນໃນແອັບ — ແທນ LINE Notify ຂອງ ods.
 *
 * ods ຍິງ LINE Notify ຢູ່ 11 ຈຸດຂອງສາຍງານ (notify-api.line.me) ແຕ່ LINE ປິດບໍລິການນັ້ນ
 * ວັນທີ 31-03-2025 ⇒ ການແຈ້ງເຕືອນທັງໝົດຕາຍໄປ. ບ່ອນນີ້ຂຽນລົງ ods_notification ແທນ
 * ແລ້ວສະແດງຢູ່ກະດິ່ງເທິງແຖບເທິງ (/notifications).
 *
 * ຜູ້ຮັບ = ຜູ້ຕິດຕາມເອກະສານ (ods_chatter_follower) ຍົກເວັ້ນຄົນທີ່ລົງມືເອງ
 *        + ຄົນທີ່ຖືກມອບໝາຍໂດຍກົງ (ຊ່າງ, ຜູ້ຮັບຜິດຊອບກິດຈະກຳ)
 *        + ກຸ່ມຕາມ role (ສາງ, ຜູ້ອະນຸມັດ)
 *
 * ຄືກັບ logChange: ຫ້າມພັງງານຫຼັກ — ຜິດພາດຢູ່ນີ້ກໍ່ກືນໄວ້ເອງ.
 */

const NOW = "localtimestamp(0)";
const PAGE_SIZE = 20;

/* ── ອ່ານ ───────────────────────────────────────────────────────── */

/** ປ້າຍຕົວເລກເທິງ topbar — ນັບສະເພາະທີ່ຍັງບໍ່ໄດ້ອ່ານ */
export async function myNotificationCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;
  try {
    const row = (
      await query<{ unread: number }>(
        `select count(*)::int unread from ods_notification where username=$1 and read_at is null`,
        [session.username],
      )
    ).rows[0];
    return row?.unread ?? 0;
  } catch (error) {
    console.error("myNotificationCount failed", error);
    return 0;
  }
}

export type NotificationPage = { rows: Notification[]; total: number; unread: number; all: number };

/** ກ່ອງຂາເຂົ້າ — ຍັງບໍ່ອ່ານຂຶ້ນກ່ອນ ແລ້ວຮຽງໃໝ່ສຸດກ່ອນ */
export async function myNotifications(tab: "unread" | "all", page: number): Promise<NotificationPage> {
  const session = await getSession();
  if (!session) return { rows: [], total: 0, unread: 0, all: 0 };

  const where = tab === "unread" ? "and read_at is null" : "";
  const [rows, stats] = await Promise.all([
    // "read" ເປັນຄຳສະຫງວນຂອງ Postgres → ຕ້ອງໃສ່ວົງຢືມ
    query<Notification>(
      `select id, model, res_id, kind, body, actor,
          to_char(created_at,'DD-MM-YYYY HH24:MI') created_at, (read_at is not null) as "read"
         from ods_notification
        where username=$1 ${where}
        order by (read_at is null) desc, id desc
        limit $2 offset $3`,
      [session.username, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ unread: number; total: number }>(
      `select count(*) filter (where read_at is null)::int unread, count(*)::int total
         from ods_notification where username=$1`,
      [session.username],
    ),
  ]);

  const unread = stats.rows[0]?.unread ?? 0;
  const all = stats.rows[0]?.total ?? 0;
  return { rows: rows.rows, total: tab === "unread" ? unread : all, unread, all };
}

/** ລາຍການສຳລັບ dropdown ກະດິງ — ມີອາຍຸ (ວິນາທີ) ໄວ້ສະແດງເປັນ "18 ນາທີ" */
export type NotificationBrief = Notification & { age_seconds: number };

/** ຈຳນວນລາຍການທີ່ dropdown ສະແດງ — ພໍໃຫ້ເຫັນຄວາມເຄື່ອນໄຫວ ບໍ່ແມ່ນກ່ອງຂາເຂົ້າເຕັມ */
const BELL_SIZE = 8;

/**
 * ລາຍການລ່າສຸດຂອງ dropdown ກະດິງ — **ຍັງບໍ່ອ່ານກ່ອນ** ແລ້ວໃໝ່ສຸດກ່ອນ (ຄືກ່ອງຂາເຂົ້າ).
 *
 * ແຍກຈາກ `myNotifications` ເພາະ dropdown ຕ້ອງການ 2 ຢ່າງທີ່ໜ້າກ່ອງຂາເຂົ້າບໍ່ຕ້ອງການ:
 * ① **ອາຍຸເປັນວິນາທີ** (ສະແດງ "18 ນາທີ" — ຂໍ້ຄວາມທີ່ຫາກໍ່ມາຕ້ອງອ່ານອອກທັນທີ)
 * ② ຈຳນວນໜ້ອຍ (8 ລາຍການ) ບໍ່ແມ່ນ 20 ພ້ອມການແບ່ງໜ້າ
 * ຄິດອາຍຸຢູ່ **server** ແລ້ວສົ່ງເປັນຕົວເລກ — ບໍ່ສົ່ງວັນທີໄປໃຫ້ browser ຄິດ
 * ຈຶ່ງບໍ່ມີບັນຫາເຂດເວລາ (ຫຼັກດຽວກັບ components/elapsed.tsx).
 */
export async function recentNotifications(): Promise<{ rows: NotificationBrief[]; unread: number }> {
  const session = await getSession();
  if (!session) return { rows: [], unread: 0 };
  try {
    const [rows, stats] = await Promise.all([
      query<NotificationBrief>(
        `select id, model, res_id, kind, body, actor,
            to_char(created_at,'DD-MM-YYYY HH24:MI') created_at, (read_at is not null) as "read",
            greatest(0, round(extract(epoch from (localtimestamp - created_at))))::int age_seconds
           from ods_notification
          where username=$1
          order by (read_at is null) desc, id desc
          limit $2`,
        [session.username, BELL_SIZE],
      ),
      query<{ unread: number }>(
        `select count(*)::int unread from ods_notification where username=$1 and read_at is null`,
        [session.username],
      ),
    ]);
    return { rows: rows.rows, unread: stats.rows[0]?.unread ?? 0 };
  } catch (error) {
    console.error("recentNotifications failed", error);
    return { rows: [], unread: 0 };
  }
}

/* ── ຂຽນ ────────────────────────────────────────────────────────── */

const readSchema = z.object({ id: z.coerce.number().int().positive() });

/** ໝາຍວ່າອ່ານແລ້ວ — 1 ລາຍການ */
export async function markNotificationRead(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const parsed = readSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await query(
    `update ods_notification set read_at=${NOW} where id=$1 and username=$2 and read_at is null`,
    [parsed.data.id, session.username],
  );
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

/** ໝາຍກັບເປັນ "ຍັງບໍ່ອ່ານ" — 1 ລາຍການ (ຄູ່ກັບ markNotificationRead ໃຫ້ກົດ read/unread ໄດ້) */
export async function markNotificationUnread(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const parsed = readSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await query(
    `update ods_notification set read_at=null where id=$1 and username=$2 and read_at is not null`,
    [parsed.data.id, session.username],
  );
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

/** ອ່ານທັງໝົດ */
export async function markAllNotificationsRead() {
  const session = await getSession();
  if (!session) return;

  await query(`update ods_notification set read_at=${NOW} where username=$1 and read_at is null`, [session.username]);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
