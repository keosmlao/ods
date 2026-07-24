import { requireMobile } from "@/lib/mobile-auth";
import { suggestSpares } from "@/lib/mobile-suggest";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ຜູ້ຊ່ວຍ AI ຝັ່ງມືຖື — ແນະນຳອາໄຫຼ່ຕາມຮຸ່ນເຄື່ອງ (ຈາກປະຫວັດการเบิกจริง).
 * ໃຊ້ຕອນຊ່າງກວດເຊັກ (check screen). ຈຳກັດ TECH_SIDE.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "ຕ້ອງมีเลขงาน" }, { status: 400 });

  try {
    return NextResponse.json({ spares: await suggestSpares(code) });
  } catch (error) {
    console.error("Mobile suggest failed", error);
    return NextResponse.json({ error: "ແນະນຳອາໄຫຼ່ບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
