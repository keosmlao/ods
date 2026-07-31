import { requireMobile } from "@/lib/mobile-auth";
import { mobileCommission } from "@/lib/mobile-commission";
import { MONITOR_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ສະຫຼຸບຄ່າຄອມ (ຜູ້ຈັດການ) — `?month=YYYY-MM` · `?employee=<ລະຫັດ>` ສຳລັບໜ້າລາຍລະອຽດ.
 * ຈຳກັດ MONITOR_SIDE ຄືກັບຄິວຕິດຕາມງານ (ຜູ້ຈັດການ · ຫົວໜ້າຊ່າງ · CS).
 *
 * ⚠️ ອ່ານຢ່າງດຽວ — ຄ່າຄອມຄິດ ແລະ ແຊ່ໄວ້ຕອນປິດງານ (lib/commission-record) ບໍ່ຄິດຄືນຢູ່ນີ້.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, MONITOR_SIDE);
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  try {
    return NextResponse.json(
      await mobileCommission(params.get("month") ?? "", params.get("employee") ?? ""),
    );
  } catch (error) {
    console.error("Mobile commission failed", error);
    return NextResponse.json({ error: "ໂຫຼດຄ່າຄອມບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
