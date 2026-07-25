import { requireMobile } from "@/lib/mobile-auth";
import { approvalDetail } from "@/lib/mobile-approval-detail";
import { APPROVER_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/** ລາຍລະອຽດເຕັມຂອງລາຍການອະນຸມັດ — ໜ້າ native (APPROVER_SIDE) */
export async function GET(request: Request, context: { params: Promise<{ kind: string; code?: string; ref?: string }> }) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  const params = await context.params;
  const kind = params.kind;
  const ref = decodeURIComponent(params.ref ?? "");
  if ((kind !== "quotation" && kind !== "cancellation") || !ref) {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  try {
    const detail = await approvalDetail(kind, ref);
    if (!detail) return NextResponse.json({ error: "ບໍ່ພົບລາຍການ" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    console.error("Mobile approval detail failed", error);
    return NextResponse.json({ error: "ໂຫຼດລາຍລະອຽດບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
