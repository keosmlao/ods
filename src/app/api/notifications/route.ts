import { getSession } from "@/lib/auth";
import type { Notification } from "@/lib/chatter";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NotificationBrief = Notification & { age_seconds: number };

/** ຂໍ້ມູນສົດສຳລັບກະດິ່ງເທິງເວັບ — ບໍ່ cache ແລະອ່ານຕາມ session ເທົ່ານັ້ນ. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [rows, stats] = await Promise.all([
      query<NotificationBrief>(
        `select id, model, res_id, kind, body, actor,
            to_char(created_at,'DD-MM-YYYY HH24:MI') created_at,
            (read_at is not null) as "read",
            greatest(0, round(extract(epoch from (localtimestamp - created_at))))::int age_seconds
           from ods_notification
          where lower(trim(username)) = lower(trim($1))
          order by (read_at is null) desc, id desc
          limit 8`,
        [session.username],
      ),
      query<{ unread: number }>(
        `select count(*)::int unread
           from ods_notification
          where lower(trim(username)) = lower(trim($1)) and read_at is null`,
        [session.username],
      ),
    ]);

    return NextResponse.json(
      { rows: rows.rows, unread: stats.rows[0]?.unread ?? 0 },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("web notification bell failed", error);
    return NextResponse.json({ error: "ດຶງການແຈ້ງເຕືອນບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
