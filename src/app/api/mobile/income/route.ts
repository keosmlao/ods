import { requireMobile } from "@/lib/mobile-auth";
import { myIncome } from "@/lib/mobile-jobs";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ລາຍຮັບຂອງຂ້ອຍ (ເດືອນນີ້) — ອ່ານຈາກ ods_service_payout ທີ່ແຊ່ໄວ້ຕອນປິດງານ.
 * ຖ້າຊ່າງຍັງບໍ່ໄດ້ເຊື່ອມຕົວຕົນ ODS↔ERP (/manage/technicians) ຈະໄດ້ 0
 * ພ້ອມທຸງ `linked: false` — ແອັບຕ້ອງບອກໃຫ້ໄປຫາຜູ້ຈັດການ ບໍ່ແມ່ນສະແດງ 0 ງຽບໆ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  try {
    const income = await myIncome(guard.user);
    return NextResponse.json({ ...income, linked: income.month !== "" });
  } catch (error) {
    console.error("Mobile income failed", error);
    return NextResponse.json({ error: "ໂຫຼດລາຍຮັບບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
