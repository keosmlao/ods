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
 * GET  ?tab=unread|all &group=todo|activity|all  → ລາຍການ
 * POST { id } ຫຼື { all: true } → ໝາຍວ່າອ່ານແລ້ວ
 *
 * ── ເປັນຫຍັງຕ້ອງແຍກ `group` (26-08-2026) ──
 * `notify()` ຂຽນ **1 ແຖວຕໍ່ຜູ້ຮັບ 1 ຄົນ** ແລະ ຜູ້ຈັດການຮັບທຸກການເຄື່ອນໄຫວສະເໝີ
 * ⇒ ຖານມີ 2.4 ລ້ານແຖວ ໃນນັ້ນ **ຍັງບໍ່ອ່ານ 2.4 ລ້ານ** (283 ຄົນ ~9,900 ຄົນລະ,
 * ວັນລະ 60,000–88,000 ແຖວ). ຄວາມຈິງຄື **ບໍ່ມີໃຜເຄີຍອ່ານຈັກແຖວ** — ຕົວເລກ
 * "ຍັງບໍ່ອ່ານ" ຈຶ່ງໝົດຄວາມໝາຍ ແລະ ເລື່ອງທີ່ຕ້ອງລົງມື (ມອບໝາຍງານ · ມີຄົນເວົ້າເຖິງ)
 * ຈົມຢູ່ກ້ອງ `log` (ຊ່າງຄົນໜຶ່ງ: log 3,294 ຕໍ່ assign 629).
 *
 * ⚠️ **ບໍ່ລຶບ ແລະ ບໍ່ຢຸດຂຽນ `log`** — ກະດິ່ງຢູ່ເວັບຕັ້ງໃຈໃຫ້ເປັນ audit feed ຂອງ
 * ຜູ້ຈັດການ (ເບິ່ງ lib/notify.ts). ນີ້ພຽງ**ແຍກຊັ້ນຕອນອ່ານ**: ແອັບເປີດມາເຫັນ
 * "ວຽກຂອງຂ້ອຍ" ກ່ອນ ສ່ວນ audit ຍ້າຍໄປອີກແຖບ — ຂໍ້ມູນຍັງຄົບຄືເກົ່າ.
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
  age_seconds: number;
  day_offset: number;
  read: boolean;
};

export async function GET(request: NextRequest) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  const unreadOnly = request.nextUrl.searchParams.get("tab") !== "all";
  /*
    `log` = ບັນທຶກປະຫວັດ (ໃຜແກ້ຫຍັງ) — ອ່ານກໍ່ບໍ່ໄດ້ເຮັດຫຍັງຕໍ່.
    ອັນອື່ນ (assign · comment · ອະນາຄົດ) = **ມີຄົນຮຽກຫາຂ້ອຍ** ⇒ ຕ້ອງເຫັນກ່ອນ.
    ບໍ່ hard-code ລາຍຊື່ຝ່າຍ todo — ໃຊ້ "ບໍ່ແມ່ນ log" ⇒ kind ໃໝ່ທີ່ເພີ່ມມາພາຍຫຼັງ
    ຈະໄປຢູ່ຝ່າຍ "ຕ້ອງເຮັດ" ເອງ ບໍ່ຕົກຫຼົ່ນຢູ່ໃນ audit ໂດຍບໍ່ຮູ້ຕົວ.
  */
  const group = request.nextUrl.searchParams.get("group") ?? "todo";
  const kindWhere =
    group === "todo" ? "and kind <> 'log'" : group === "activity" ? "and kind = 'log'" : "";
  /**
   * ── ໂຫຼດຕໍ່ (07-08-2026) ──
   * ຄຳສັ່ງ: "ຜູ້ຈັດການຕ້ອງເຫັນທຸກຢ່າງທີ່ເຄື່ອນໄຫວ". ແຕ່ກ່ອນ endpoint ນີ້ຄືນ **30 ແຖວ
   * ຕາຍຕົວ ບໍ່ມີທາງໂຫຼດຕໍ່** ⇒ ຜູ້ຈັດການທີ່ມີ 630 ແຖວ/ມື້ ເຫັນໄດ້ພຽງ 30 ອັນລ່າສຸດ
   * ແລ້ວທີ່ເຫຼືອຫາຍໄປຈາກສາຍຕາ. `before` = id ຂອງແຖວສຸດທ້າຍທີ່ໄດ້ໄປແລ້ວ.
   */
  const before = Number(request.nextUrl.searchParams.get("before") ?? 0);

  try {
    const [rows, stats] = await Promise.all([
      query<Row>(
        `select id::float8 as id, model, res_id::text as res_id, kind, body, actor,
            to_char(created_at,'DD-MM-YYYY HH24:MI') as created_at,
            /*
              ⚠️ ສົ່ງ **ອາຍຸເປັນວິນາທີ** ແລະ **ຈຳນວນມື້ຜ່ານມາ** ບໍ່ແມ່ນສົ່ງເວລາດິບ.
              created_at ເປັນ timestamp ບໍ່ມີເຂດເວລາ ແລະ ເສີບເວີແລ່ນເປັນ UTC ແຕ່ມືຖື
              ຢູ່ ICT (UTC+7) ⇒ ຖ້າໃຫ້ແອັບເອົາເວລານັ້ນໄປລົບກັບ now() ຂອງຕົນ ຈະຜິດ
              7 ຊົ່ວໂມງ ("15 ນາທີກ່ອນ" ກາຍເປັນ "7 ຊົ່ວໂມງກ່ອນ"). ໃຫ້ຖານຄິດຈາກເວລາ
              ຂອງມັນເອງທັງສອງຝ່າຍ ⇒ ຖືກສະເໝີ ບໍ່ວ່າເສີບເວີຈະຕັ້ງເຂດເວລາໃດ.
              ⚠️ ຫ້າມໃສ່ເຄື່ອງໝາຍ backtick ໃນຄຳອະທິບາຍນີ້ — ຢູ່ໃນ template literal
              ມັນຈະປິດຂໍ້ຄວາມກາງຄັນ (ພົບຈິງ 2 ເທື່ອ: day-brief 25-08, ອັນນີ້ 26-08).
            */
            greatest(0, extract(epoch from (localtimestamp - created_at)))::int as age_seconds,
            (current_date - created_at::date)::int as day_offset,
            (read_at is not null) as "read"
           from ods_notification
          where username = $1 ${unreadOnly ? "and read_at is null" : ""}
            ${kindWhere}
            ${before > 0 ? "and id < $2" : ""}
          order by id desc
          limit ${PAGE_SIZE}`,
        before > 0 ? [guard.user.username, before] : [guard.user.username],
      ),
      /*
        ນັບແຍກ 2 ຝ່າຍ. ເລກທີ່ຂຶ້ນປ້າຍແດງໃນແອັບໃຊ້ `unread_todo` — ບໍ່ແມ່ນ `unread`
        ລວມ, ເພາະເລກລວມຄ້າງຢູ່ ~9,900 ຕະຫຼອດ ⇒ ປ້າຍທີ່ບໍ່ເຄີຍລົງ = ປ້າຍທີ່ຄົນເລີກເບິ່ງ.
        ຂີດເພດານ 999 ໄວ້: ນັບແຖວທັງໝົດຂອງຄົນທີ່ມີ 9,900 ແຖວ ເສຍເວລາໂດຍບໍ່ໄດ້ຫຍັງ
        — ຈໍສະແດງໄດ້ແຄ່ "999+" ຢູ່ແລ້ວ.
      */
      query<{ unread: number; unread_todo: number }>(
        `select count(*)::int unread,
                count(*) filter (where kind <> 'log')::int unread_todo
           from (select kind from ods_notification
                  where username = $1 and read_at is null limit 999) capped`,
        [guard.user.username],
      ),
    ]);

    return NextResponse.json({
      data: rows.rows,
      unread: stats.rows[0]?.unread ?? 0,
      unread_todo: stats.rows[0]?.unread_todo ?? 0,
    });
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
