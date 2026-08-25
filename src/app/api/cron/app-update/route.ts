import { cronKeyMatches } from "@/lib/cron-auth";
import { notifyAppUpdate } from "@/lib/app-update-notify";
import { NextResponse, type NextRequest } from "next/server";

/**
 * **ແຈ້ງເຕືອນເມື່ອອອກແອັບເວີຊັນໃໝ່** — ຍິງຈາກ cron (ແນະນຳທຸກ 10 ນາທີ):
 *
 *   curl -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/app-update
 *
 * ວາງ APK ໃໝ່ (`./scripts/publish-apk.sh`) ⇒ ຮອບ cron ຖັດໄປຈະຍິງແຈ້ງເຕືອນ
 * ຫາທຸກເຄື່ອງເທື່ອດຽວ ແລ້ວຈື່ເລກໄວ້ ⇒ ຮອບຕໍ່ໆໄປງຽບ.
 *
 * `?dry=1` = ບອກວ່າຈະຍິງຫາຈັກຄົນ ໂດຍ**ບໍ່**ຍິງ ແລະ **ບໍ່**ຈື່ (ທົດສອບໄດ້ບໍ່ລົບກວນຄົນ).
 * `?seed=1` = ຈື່ເລກປັດຈຸບັນໄວ້ໂດຍບໍ່ຍິງ — ໃຊ້ **ຄັ້ງດຽວ**ຕອນເປີດລະບົບນີ້ ບໍ່ດັ່ງນັ້ນ
 *   ຄົນທີ່ຖືເວີຊັນປັດຈຸບັນຢູ່ແລ້ວຈະໄດ້ຮັບ "ມີເວີຊັນໃໝ່" ຂອງເວີຊັນຂອງຕົນເອງ.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = process.env.CRON_KEY;
  if (!key) return NextResponse.json({ error: "CRON_KEY ບໍ່ໄດ້ຕັ້ງ" }, { status: 401 });
  if (!cronKeyMatches(request, key)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  // ?seed=1 = ຈື່ເລກປັດຈຸບັນໄວ້ໂດຍບໍ່ຍິງ (ໃຊ້ຕອນເປີດລະບົບນີ້ຄັ້ງທຳອິດ)
  const seed = params.get("seed") === "1";
  try {
    return NextResponse.json(await notifyAppUpdate(dry, seed));
  } catch (error) {
    console.error("cron app-update failed", error);
    return NextResponse.json({ error: "ແຈ້ງເຕືອນອັບເດດລົ້ມ" }, { status: 500 });
  }
}
