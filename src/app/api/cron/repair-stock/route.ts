import { refreshRepairStock } from "@/lib/repair-stock-cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * **ອັບເດດ cache ຄົງເຫຼືອ ສາງສ້ອມ** — ຍິງຈາກ cron ພາຍນອກ (ເຊັ່ນ ວັນລະຄັ້ງ ຕອນເຊົ້າ):
 *
 *   curl -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/repair-stock
 *
 * ⚠️ ບໍ່ມີ session ⇒ ກັນດ້ວຍ CRON_KEY (ຄືກັບ /api/cron/sla). ໃຊ້ເວລາ ~11–25ວິ (ERP ຄິດຍອດ).
 * ໜ້າ /stock/balance/repair ອ່ານ cache ນີ້ (ບໍ່ຕ້ອງກົດ "ດຶງໃໝ່" ເອງ ຖ້າຕັ້ງ cron ໄວ້).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const key = process.env.CRON_KEY;
  if (!key) return NextResponse.json({ error: "CRON_KEY ບໍ່ໄດ້ຕັ້ງ" }, { status: 401 });
  if (request.headers.get("x-cron-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshRepairStock();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("repair-stock cron failed", error);
    return NextResponse.json({ error: "ອັບເດດ cache ລົ້ມເຫຼວ" }, { status: 500 });
  }
}
