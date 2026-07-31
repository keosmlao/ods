import { managerDrill } from "@/lib/manager-drill";
import { requireMobile } from "@/lib/mobile-auth";
import { MONITOR_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ກົດຕົວເລກຢູ່ໜ້າພາບລວມ → ລາຍການໃບງານທີ່ຢູ່ໃນຕົວເລກນັ້ນ.
 * `?bucket=age:over30` · `unassigned` · `sla-late` · `tech:23037` … (ເບິ່ງ lib/manager-drill)
 * ຈຳກັດ MONITOR_SIDE ຄືກັບ /api/mobile/overview.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, MONITOR_SIDE);
  if (!guard.ok) return guard.response;

  const bucket = new URL(request.url).searchParams.get("bucket")?.trim() ?? "";
  if (!bucket) return NextResponse.json({ error: "ບໍ່ໄດ້ລະບຸກຸ່ມ" }, { status: 400 });

  try {
    return NextResponse.json(await managerDrill(bucket));
  } catch (error) {
    console.error("Mobile overview drill failed", bucket, error);
    return NextResponse.json({ error: "ໂຫຼດລາຍການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
