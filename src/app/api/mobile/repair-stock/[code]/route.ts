import { requireMobile } from "@/lib/mobile-auth";
import { repairStockDetail } from "@/lib/mobile-repair-stock";
import { MONITOR_SIDE, STOCK_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ລາຍລະອຽດອາໄຫຼ່ 1 ຕົວ — ຢູ່ສາງ/ທີ່ຈັດເກັບໃດ ຈັກອັນ + ຄວາມເຄື່ອນໄຫວລ່າສຸດ. */
const ALLOWED = [...new Set([...MONITOR_SIDE, ...STOCK_SIDE])];

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const guard = await requireMobile(request, ALLOWED);
  if (!guard.ok) return guard.response;

  const { code } = await params;
  try {
    const detail = await repairStockDetail(decodeURIComponent(code));
    if (!detail) return NextResponse.json({ error: "ບໍ່ພົບອາໄຫຼ່ນີ້ໃນສາງສູນບໍລິການ" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    console.error("Mobile repair-stock detail failed", error);
    return NextResponse.json({ error: "ໂຫຼດລາຍລະອຽດບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
