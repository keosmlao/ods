import { requireMobile } from "@/lib/mobile-auth";
import { mobileMapPending } from "@/lib/mobile-map";
import { MONITOR_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ແຜນທີ່ງານທີ່ຍັງຄ້າງ (ສ້ອມ + ຕິດຕັ້ງ) — ອ່ານຢ່າງດຽວ, ຈຳກັດ MONITOR_SIDE.
 * ຄືນ `without_gps` ນຳ ⇒ ແອັບບອກໄດ້ວ່າມີງານຄ້າງອີກຈັກໃບທີ່ຍັງບໍ່ໄດ້ໝາຍພິກັດ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, MONITOR_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await mobileMapPending());
  } catch (error) {
    console.error("Mobile map failed", error);
    return NextResponse.json({ error: "ໂຫຼດແຜນທີ່ບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
