import { requireMobile } from "@/lib/mobile-auth";
import { myJobs } from "@/lib/mobile-jobs";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ວຽກຂອງຂ້ອຍ — ຕິດຕັ້ງ + ສ້ອມແປງ ໃນລາຍການດຽວ ພ້ອມປຸ່ມທີ່ກົດໄດ້ */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ jobs: await myJobs(guard.user) });
  } catch (error) {
    console.error("Mobile jobs failed", error);
    return NextResponse.json({ error: "ໂຫຼດວຽກບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
