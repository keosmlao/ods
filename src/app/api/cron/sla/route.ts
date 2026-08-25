import {
  escalateInstallSla,
  escalateRepairFrontStage,
  escalateRepairStageSla,
  escalateStaleRepairJobs,
} from "@/lib/sla-escalate";
import { NextResponse, type NextRequest } from "next/server";
import { cronKeyMatches } from "@/lib/cron-auth";

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
  if (!cronKeyMatches(request, key)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?dry=1 = **ທົດສອບ** — ນັບວ່າຈະເຕືອນຈັກໃບ ໂດຍ **ບໍ່** push/chatter/insert (ບໍ່ລົບກວນຄົນ)
  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  /*
    ?seed=1 = ໝາຍງານຄ້າງ**ທີ່ມີຢູ່ດຽວນີ້**ວ່າ "ເຕືອນແລ້ວ" ໂດຍບໍ່ເຕືອນຈິງ.
    ໃຊ້ **ຄັ້ງດຽວຕອນເປີດລະບົບ**: ບໍ່ດັ່ງນັ້ນຮອບທຳອິດຈະຍິງທັງ backlog ພ້ອມກັນ
    (ວັດຈິງ 25-08-2026 = 57 ໃບ) ⇒ ມືຖືຫົວໜ້າສັ່ນຮ້ອຍຄັ້ງ ແລ້ວຄົນປິດແຈ້ງເຕືອນ
    ຊຶ່ງເປັນການທຳລາຍປະໂຫຍດຂອງລະບົບເຕືອນທັງໝົດ.
  */
  const seed = params.get("seed") === "1";

  try {
    const [install, repair, repairStage, stale] = await Promise.all([
      escalateInstallSla(dry, seed),
      escalateRepairFrontStage(dry, seed),
      escalateRepairStageSla(dry, seed),
      // ວຽກທີ່ຖືກລືມ (ເປີດເກີນ 30 ມື້) — ດ່ານສຸດທ້າຍ ຖ້າ SLA ຕໍ່ຂັ້ນເຕືອນໄປແລ້ວ ແຕ່ບໍ່ມີໃຜລົງມື
      escalateStaleRepairJobs(dry, seed),
    ]);
    return NextResponse.json({ ok: true, dry, ...install, ...repair, ...repairStage, ...stale });
  } catch (error) {
    console.error("sla cron failed", error);
    return NextResponse.json({ error: "ຕົວກວດລົ້ມເຫຼວ" }, { status: 500 });
  }
}
