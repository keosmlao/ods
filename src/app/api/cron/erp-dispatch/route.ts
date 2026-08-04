import { syncErpDispatch, syncErpReturns } from "@/lib/erp-dispatch";
import { syncErpPurchase } from "@/lib/erp-purchase";
import { NextResponse, type NextRequest } from "next/server";
import { cronKeyMatches } from "@/lib/cron-auth";

/**
 * **ດຶງໃບເບີກ/ໃບຮັບຄືນ/ໃບຮັບເຂົ້າສາງຈາກ ERP ແບບເປັນຮອບ** — ຍິງຈາກ cron ພາຍນອກ (ແນະນຳ ທຸກ 5 ນາທີ):
 *
 *   curl -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/erp-dispatch
 *
 * ── ເປັນຫຍັງ ──
 * ປົກກະຕິ ODS ກວດໃບເບີກ (ຜູກຜ່ານ **doc_ref** ຂອງ ERP → ເລກໃບຂໍ SIO…) ຕອນ
 * ຄົນເປີດໜ້າຄິວເທົ່ານັ້ນ ⇒ ສາງເບີກແລ້ວ ແຕ່ບໍ່ມີໃຜເປີດໜ້າ ກໍ່ບໍ່ມີໃຜຮູ້.
 * ເສັ້ນທາງນີ້ເຮັດໃຫ້ **ຮູ້ທັນທີ** (ພາຍໃນບໍ່ເກີນຮອບ cron) ແລ້ວ push ແຈ້ງຊ່າງເອງ.
 *
 * ລວມ **syncErpPurchase** (03-08-2026): ERP ຮັບເຂົ້າສາງຄົບ ⇒ ສະແຕມ spare_arrive
 * ໃຫ້ວຽກຂັ້ນ 7 ປ່ອຍອອກໄປ — ມີໃບຂໍເບີກແລ້ວໄປຄິວ "ກຳລັງເບີກອາໄຫຼ່" ທັນທີ ບໍ່ຕ້ອງລໍ
 * ໃຜມາກົດປຸ່ມ sync ດ້ວຍມື (ບໍ່ດັ່ງນັ້ນວຽກຄ້າງຢູ່ "ກຳລັງສັ່ງຊື້" ເປັນເດືອນ).
 *
 * ⚠️ **ບໍ່ມີ session** (cron ບໍ່ໄດ້ login) ⇒ ກັນດ້ວຍກະແຈລັບ CRON_KEY (ຫຼັກການດຽວກັບ /api/cron/sla).
 * ປອດໄພທີ່ຈະຍິງຊ້ຳ — sync ເປັນ idempotent (ໃບທີ່ດຶງແລ້ວຖືກຂ້າມ).
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = process.env.CRON_KEY;
  if (!key) return NextResponse.json({ error: "CRON_KEY ບໍ່ໄດ້ຕັ້ງ" }, { status: 401 });
  if (!cronKeyMatches(request, key)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // ຮັບເຂົ້າສາງກ່ອນ — ວຽກທີ່ຖືກສະແຕມ spare_arrive ຮອບນີ້ ອາດມີໃບເບີກລໍຢູ່ແລ້ວ,
    // syncErpDispatch ທີ່ຮັນຕໍ່ຈະໄດ້ເຫັນແຖວ in (0,5) ຂອງມັນນຳ.
    const purchase = await syncErpPurchase();
    const dispatch = await syncErpDispatch();
    const returns = await syncErpReturns();
    return NextResponse.json({
      ok: true,
      purchase_advanced: purchase.advanced,
      purchase_jobs: purchase.jobs,
      dispatch_imported: dispatch.imported,
      dispatch_jobs: dispatch.jobs,
      returns_imported: returns.imported,
      returns_jobs: returns.jobs,
    });
  } catch (error) {
    console.error("erp-dispatch cron failed", error);
    return NextResponse.json({ error: "ຕົວກວດລົ້ມເຫຼວ" }, { status: 500 });
  }
}
