import { requireMobile } from "@/lib/mobile-auth";
import { TECH_SIDE } from "@/lib/roles";
import { stockBalanceLookup } from "@/lib/stock-lookup";
import { NextResponse } from "next/server";

/** ຕິດຕາມສິນຄ້າຄົງເຫຼືອ (ຊ່າງ) — ຄົ້ນ `?q=` ໄດ້ຍອດຄົງເຫຼືອແຍກຕາມສາງ. */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ items: await stockBalanceLookup(q) });
  } catch (error) {
    console.error("Mobile stock-balance failed", error);
    return NextResponse.json({ error: "ໂຫຼດຍອດຄົງເຫຼືອບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
