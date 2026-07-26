import { requireMobile } from "@/lib/mobile-auth";
import { techDetail } from "@/lib/mobile-tech";
import { MONITOR_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ຜົນງານລູກນ້ອງ 1 ຄົນ — ພາລະ · ຜົນຜະລິດ (ມື້/ອາທິດ/ເດືອນ) · ຄ່າຄອມ · ງານເປີດ. MONITOR_SIDE. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guard = await requireMobile(request, MONITOR_SIDE);
  if (!guard.ok) return guard.response;

  try {
    const { code } = await params;
    const detail = await techDetail(decodeURIComponent(code));
    if (!detail) return NextResponse.json({ error: "ບໍ່ພົບຊ່າງ" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    console.error("Mobile tech detail failed", error);
    return NextResponse.json({ error: "ໂຫຼດຜົນງານຊ່າງບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
