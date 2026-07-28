import { deliveryPhotos } from "@/lib/delivery";
import { requireMobile } from "@/lib/mobile-auth";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ຮູບຕອນຂົນສົ່ງໄປສົ່ງເຄື່ອງ — **ສະບັບຂອງແອັບມືຖື**.
 *
 * ⚠️ ຢ່າໃຫ້ແອັບເອີ້ນ /api/installations/delivery: ອັນນັ້ນກວດ **cookie** ຂອງເວັບ
 * ແຕ່ແອັບສົ່ງ **Bearer token** (aud=mobile) ມາ ⇒ ຈະໄດ້ 401 ສະເໝີ.
 * ຕົວດຶງຮູບແມ່ນ lib/delivery ອັນດຽວກັນ — ຕ່າງກັນແຕ່ດ່ານກວດຕົວຕົນ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const bill = (new URL(request.url).searchParams.get("bill") ?? "").trim();
  if (!bill) return NextResponse.json({ error: "ຕ້ອງລະບຸເລກບິນ" }, { status: 400 });

  try {
    return NextResponse.json({ data: await deliveryPhotos(bill) });
  } catch (error) {
    console.error("Mobile delivery photos failed", error);
    return NextResponse.json({ error: "ດຶງຮູບບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
