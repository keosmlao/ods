import { requireMobile } from "@/lib/mobile-auth";
import { repairStockCache } from "@/lib/repair-stock-cache";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** browse ຄົງເຫຼືອ ສາງສ້ອມ (cache) — ອ່ານຢ່າງດຽວ, ໄວ. refresh ເຮັດຢູ່ເວັບ/cron. */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const { items, refreshedAt } = await repairStockCache(q);
    return NextResponse.json({
      refreshed_at: refreshedAt,
      items: items.map((item) => ({
        code: item.code,
        name: item.name,
        brand: null,
        unit_code: item.unit_code,
        total: item.total,
        warehouses: item.warehouses,
      })),
    });
  } catch (error) {
    console.error("Mobile repair-stock failed", error);
    return NextResponse.json({ error: "ໂຫຼດຄົງເຫຼືອສາງສ້ອມບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
