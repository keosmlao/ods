import { requireMobile } from "@/lib/mobile-auth";
import { pendingApprovals } from "@/lib/mobile-approvals";
import { APPROVER_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ຄິວອະນຸມັດ — ສະເພາະຜູ້ຈັດການ/ຫົວໜ້າ (APPROVER_SIDE), ອ່ານຢ່າງດຽວ */
export async function GET(request: Request) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ items: await pendingApprovals() });
  } catch (error) {
    console.error("Mobile approvals failed", error);
    return NextResponse.json({ error: "ໂຫຼດຄິວອະນຸມັດບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
