import { requireMobile } from "@/lib/mobile-auth";
import { mobileOverview } from "@/lib/mobile-overview";
import { MONITOR_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ພາບລວມຜູ້ຈັດການ (ໜ້າຫຼັກຂອງ manager ຢູ່ແອັບ) — ຕົວເລກລວມທັງບໍລິສັດ.
 * ຈຳກັດ MONITOR_SIDE (ຜູ້ຈັດການ · ຫົວໜ້າຊ່າງ · CS).
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, MONITOR_SIDE);
  if (!guard.ok) return guard.response;

  try {
    // ສົ່ງຊື່ຜູ້ໃຊ້ໄປນຳ ⇒ ໄດ້ການເຄື່ອນໄຫວລ່າສຸດ**ຂອງຄົນນີ້**ມາພ້ອມພາບລວມ (ບໍ່ຕ້ອງຂໍອີກຮອບ)
    return NextResponse.json(await mobileOverview(guard.user.username));
  } catch (error) {
    console.error("Mobile overview failed", error);
    return NextResponse.json({ error: "ໂຫຼດພາບລວມບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
