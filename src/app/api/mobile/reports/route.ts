import { requireMobile } from "@/lib/mobile-auth";
import { mobileReports } from "@/lib/mobile-reports";
import { MONITOR_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ລາຍງານ — ແນວໂນ້ມ 14 ມື້ (ເປີດ/ປິດ) + ຄ່າຄອມເດືອນນີ້. ຈຳກັດ MONITOR_SIDE. */
export async function GET(request: Request) {
  const guard = await requireMobile(request, MONITOR_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await mobileReports(guard.user.role !== "admin"));
  } catch (error) {
    console.error("Mobile reports failed", error);
    return NextResponse.json({ error: "ໂຫຼດລາຍງານບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
