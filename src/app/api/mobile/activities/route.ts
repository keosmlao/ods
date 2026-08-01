import { requireMobile } from "@/lib/mobile-auth";
import { mobileActivities } from "@/lib/mobile-activities";
import { MONITOR_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ກິດຈະກຳທີ່ຍັງບໍ່ປິດ ທັງໝົດ — ຜູ້ຈັດການຕິດຕາມສິ່ງທີ່ CS ນັດໄວ້. */
export async function GET(request: Request) {
  const guard = await requireMobile(request, MONITOR_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await mobileActivities());
  } catch (error) {
    console.error("Mobile activities failed", error);
    return NextResponse.json({ error: "ໂຫຼດກິດຈະກຳບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
