import { requireMobile } from "@/lib/mobile-auth";
import { mobileRank } from "@/lib/mobile-rank";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ອັນດັບຊ່າງປະຈຳເດືອນ (`?month=YYYY-MM`) — ສຳລັບ**ຊ່າງເອງ**.
 * ຈຳນວນເງິນຂອງຄົນອື່ນຖືກເຊື່ອງຕາມການຕັ້ງຄ່າ (ເບິ່ງ lib/mobile-rank).
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  try {
    const month = new URL(request.url).searchParams.get("month") ?? "";
    return NextResponse.json(await mobileRank(guard.user, month));
  } catch (error) {
    console.error("Mobile rank failed", error);
    return NextResponse.json({ error: "ໂຫຼດອັນດັບບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
