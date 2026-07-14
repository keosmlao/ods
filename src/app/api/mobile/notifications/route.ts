import { query } from "@/lib/db";
import { requireMobile } from "@/lib/mobile-auth";
import { NextResponse, type NextRequest } from "next/server";

/**
 * **ກ່ອງແຈ້ງເຕືອນຂອງແອັບຊ່າງ** — ອ່ານຈາກ `ods_notification` **ຕາຕະລາງດຽວກັບເວັບ**
 * (actions/notification) ⇒ ອ່ານຢູ່ແອັບແລ້ວ ເວັບກໍ່ເຫັນວ່າອ່ານແລ້ວ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ແອັບມີແຕ່ **push** — ຖ້າຊ່າງປັດຖິ້ມ ຫຼື ມືຖືປິດຢູ່ຕອນນັ້ນ **ຂໍ້ຄວາມຫາຍໄປເລີຍ**
 * (ເຊັ່ນ "ມີງານໃໝ່" · "ເຫຼືອ 6 ຊມ ຈະຄົບ 24 ຊມ" · "ສາງເບີກອາໄຫຼ່ໃຫ້ແລ້ວ").
 * ກ່ອງນີ້ຄືບ່ອນທີ່ຂໍ້ຄວາມນອນຢູ່ ຈົນກວ່າຊ່າງຈະໄດ້ອ່ານ.
 *
 * GET  ?tab=unread|all  → ລາຍການ
 * POST { id } ຫຼື { all: true } → ໝາຍວ່າອ່ານແລ້ວ
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Row = {
  id: number;
  model: string;
  res_id: string;
  kind: string;
  body: string;
  actor: string | null;
  created_at: string;
  read: boolean;
};

export async function GET(request: NextRequest) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  const unreadOnly = request.nextUrl.searchParams.get("tab") !== "all";

  try {
    const [rows, stats] = await Promise.all([
      query<Row>(
        `select id, model, res_id, kind, body, actor,
            to_char(created_at,'DD-MM-YYYY HH24:MI') as created_at,
            (read_at is not null) as "read"
           from ods_notification
          where username = $1 ${unreadOnly ? "and read_at is null" : ""}
          order by (read_at is null) desc, id desc
          limit ${PAGE_SIZE}`,
        [guard.user.username],
      ),
      query<{ unread: number }>(
        "select count(*) filter (where read_at is null)::int unread from ods_notification where username = $1",
        [guard.user.username],
      ),
    ]);

    return NextResponse.json({ data: rows.rows, unread: stats.rows[0]?.unread ?? 0 });
  } catch (error) {
    console.error("mobile notifications failed", error);
    return NextResponse.json({ error: "ດຶງແຈ້ງເຕືອນບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { id?: number; all?: boolean };

  try {
    if (body.all) {
      // ໝາຍທັງໝົດວ່າອ່ານແລ້ວ — ສະເພາະຂອງຄົນນີ້ (ບໍ່ແມ່ນຂອງທຸກຄົນ)
      await query("update ods_notification set read_at=localtimestamp(0) where username=$1 and read_at is null", [
        guard.user.username,
      ]);
    } else if (body.id) {
      await query(
        "update ods_notification set read_at=localtimestamp(0) where id=$1 and username=$2 and read_at is null",
        [body.id, guard.user.username],
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("mobile notifications read failed", error);
    return NextResponse.json({ error: "ບັນທຶກບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
