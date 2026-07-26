import { requireMobile } from "@/lib/mobile-auth";
import { techRoster } from "@/lib/mobile-tech";
import { APPROVER_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ຜົນງານລູກນ້ອງ — ລາຍชื่อຊ່າງ + ພາລະ/ຄວາມຊ້າ/ຄ່າຄອມ. ຈຳກັດ APPROVER_SIDE. */
export async function GET(request: Request) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ techs: await techRoster() });
  } catch (error) {
    console.error("Mobile tech roster failed", error);
    return NextResponse.json({ error: "ໂຫຼດຜົນງານລູກນ້ອງບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
