import { requireMobile } from "@/lib/mobile-auth";
import { mobileMonitor } from "@/lib/mobile-monitor";
import { APPROVER_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ຕິດຕາມງານ (ຜູ້ຈັດການ) — ລາຍการงานที่ต้องลงมือ ຈັດເປັນກຸ່ມ (ເລີຍ SLA · ຍັງບໍ່ຈັດຊ່າງ · ຄ້າງດົນ).
 * ຈຳກັດ APPROVER_SIDE (ຜູ້ຈັດການ · ຫົວໜ້າຊ່າງ).
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await mobileMonitor());
  } catch (error) {
    console.error("Mobile monitor failed", error);
    return NextResponse.json({ error: "ໂຫຼດຕິດຕາມງານບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
