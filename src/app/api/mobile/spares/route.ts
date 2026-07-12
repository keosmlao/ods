import { requireMobile } from "@/lib/mobile-auth";
import { TECH_SIDE } from "@/lib/roles";
import { pickupQueue, searchSpares } from "@/lib/tech-flow";
import { roleOf } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ອາໄຫຼ່ — ຄົ້ນຫາ (`?q=`) ແລະ ຄິວ "ຮັບອາໄຫຼ່" ຂອງຊ່າງ (`?queue=pickup`).
 * ຄິວ pickup = ໃບທີ່ສາງເບີກອອກແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ໄປຮັບ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;

  try {
    if (params.get("queue") === "pickup") {
      const all = roleOf(guard.user) !== "technical"; // ຫົວໜ້າຊ່າງ/ຜູ້ຈັດການ ເຫັນໝົດ
      return NextResponse.json({ docs: await pickupQueue(guard.user, all) });
    }
    return NextResponse.json({
      items: await searchSpares(params.get("q") ?? "", params.get("in_stock") === "1"),
    });
  } catch (error) {
    console.error("Mobile spares failed", error);
    return NextResponse.json({ error: "ໂຫຼດອາໄຫຼ່ບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
