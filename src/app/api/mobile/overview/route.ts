import { requireMobile } from "@/lib/mobile-auth";
import { mobileOverview } from "@/lib/mobile-overview";
import { APPROVER_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ພາບລວມຜູ້ຈັດການ (ໜ້າຫຼັກຂອງ manager ຢູ່ແອັບ) — ຕົວເລກລວມທັງບໍລິສັດ.
 * ຈຳກັດ APPROVER_SIDE (ຜູ້ຈັດການ · ຫົວໜ້າຊ່າງ) ເພາະເປັນຂໍ້ມູນບໍລິຫານທັງໝົດ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await mobileOverview());
  } catch (error) {
    console.error("Mobile overview failed", error);
    return NextResponse.json({ error: "ໂຫຼດພາບລວມບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
