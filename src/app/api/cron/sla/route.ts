import { escalateInstallSla, escalateRepairFrontStage } from "@/lib/sla-escalate";
import { NextResponse, type NextRequest } from "next/server";

/**
 * **ຕົວກວດນາລິກາ 24 ຊມ** — ຍິງຈາກ cron ພາຍນອກ (ເຊັ່ນ ທຸກ 30 ນາທີ):
 *
 *   curl -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/sla
 *
 * ⚠️ **ບໍ່ມີ session** (cron ບໍ່ໄດ້ login) ⇒ ກັນດ້ວຍ **ກະແຈລັບ** (CRON_KEY).
 * ບໍ່ຕັ້ງ CRON_KEY = ປິດເສັ້ນທາງນີ້ໄວ້ (401) — ບໍ່ໃຫ້ໃຜກໍ່ຍິງແຈ້ງເຕືອນອອກໄດ້.
 *
 * ບໍ່ໄດ້ໃຊ້ scheduler ພາຍໃນ Next ເພາະ serverless/ຫຼາຍ instance ຈະແລ່ນຊ້ຳກັນ —
 * ການກັນເຕືອນຊ້ຳຢູ່ທີ່ຖານ (ods_sla_escalation) ຈຶ່ງເປັນຕົວກັນຫຼັກ.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = process.env.CRON_KEY;
  if (!key) return NextResponse.json({ error: "CRON_KEY ບໍ່ໄດ້ຕັ້ງ" }, { status: 401 });
  if (request.headers.get("x-cron-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [install, repair] = await Promise.all([escalateInstallSla(), escalateRepairFrontStage()]);
    return NextResponse.json({ ok: true, ...install, ...repair });
  } catch (error) {
    console.error("sla cron failed", error);
    return NextResponse.json({ error: "ຕົວກວດລົ້ມເຫຼວ" }, { status: 500 });
  }
}
