import { requireMobile } from "@/lib/mobile-auth";
import { myDoneJobs } from "@/lib/mobile-done";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ວຽກທີ່ຂ້ອຍຈົບໄປແລ້ວ (30 ມື້ຫຼ້າສຸດ) — ອ່ານຢ່າງດຽວ */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ jobs: await myDoneJobs(guard.user) });
  } catch (error) {
    console.error("Mobile done jobs failed", error);
    return NextResponse.json({ error: "ໂຫຼດປະຫວັດວຽກບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
