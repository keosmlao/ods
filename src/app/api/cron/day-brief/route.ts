import { cronKeyMatches } from "@/lib/cron-auth";
import { sendDayBrief } from "@/lib/day-brief";
import { NextResponse, type NextRequest } from "next/server";

/**
 * **ສະຫຼຸບນັດຕອນເຊົ້າ** — ຍິງຈາກ cron (ແນະນຳ 07:30 ໂມງລາວ = 00:30 UTC):
 *
 *   curl -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/day-brief
 *
 * ຍິງເທື່ອດຽວຕໍ່ຄົນຕໍ່ມື້ (ods_day_brief) ⇒ ແລ່ນຊ້ຳບໍ່ດັງຊ້ຳ.
 * `?dry=1` = ບອກວ່າຈະຍິງຫາຈັກຄົນ ໂດຍບໍ່ຍິງ ແລະ ບໍ່ຈື່.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = process.env.CRON_KEY;
  if (!key) return NextResponse.json({ error: "CRON_KEY ບໍ່ໄດ້ຕັ້ງ" }, { status: 401 });
  if (!cronKeyMatches(request, key)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  try {
    return NextResponse.json(await sendDayBrief(dry));
  } catch (error) {
    console.error("cron day-brief failed", error);
    return NextResponse.json({ error: "ສົ່ງສະຫຼຸບຕອນເຊົ້າລົ້ມ" }, { status: 500 });
  }
}
