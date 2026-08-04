import { syncErpDispatch, syncErpReturns } from "@/lib/erp-dispatch";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * **ເຊັກໃບເບີກ ERP ທັນທີສຳລັບໜ້າຈໍ** — ໜ້າຄິວ (ຮັບອາໄຫຼ່…) ຍິງເອງທຸກບໍ່ເກີນ 15 ວິ
 * ຜ່ານ ErpDispatchWatcher ⇒ ສາງເບີກຢູ່ ERP ແປ້ບດຽວ ໜ້າຈໍກໍ່ອັບເດດ ບໍ່ຕ້ອງລໍ cron.
 *
 * ຕ່າງຈາກ /api/cron/erp-dispatch: ອັນນັ້ນສຳລັບ cron ພາຍນອກ (x-cron-key),
 * ອັນນີ້ສຳລັບຄົນທີ່ **login ຢູ່ແລ້ວ** ກວດຈາກ browser.
 * idempotent ຄືກັນ — ຍິງຊ້ຳບ່ອຍໆປອດໄພ (ໃບທີ່ດຶງແລ້ວຖືກຂ້າມ).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const dispatch = await syncErpDispatch();
    const returns = await syncErpReturns();
    return NextResponse.json({ imported: dispatch.imported + returns.imported });
  } catch (error) {
    console.error("erp-dispatch check failed", error);
    // ERP ລົ້ມ ⇒ ບໍ່ລົບກວນໜ້າຈໍ (ຄືກັບ syncErpDispatch ທີ່ບໍ່ໂຍນ error ໃສ່ຄິວ)
    return NextResponse.json({ imported: 0 });
  }
}
