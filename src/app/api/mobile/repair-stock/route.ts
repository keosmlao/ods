import { requireMobile } from "@/lib/mobile-auth";
import { repairStockList } from "@/lib/mobile-repair-stock";
import { MONITOR_SIDE, STOCK_SIDE, TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ຄົງເຫຼືອ ສາງສູນບໍລິການ (1104/1206) ສຳລັບແອັບ — `?q=&wh=&loc=&page=`.
 *
 * ⚠️ **ຕ້ອງເຂົ້າກັນໄດ້ກັບໜ້າຊ່າງເກົ່າ** (RepairStockScreen ຍິງມາດ້ວຍ `?q=` ຢ່າງດຽວ
 * ແລ້ວອ່ານ `items[].warehouses`): ບໍ່ສົ່ງ `page` ມາ ⇒ **ຄືນທັງໝົດ ບໍ່ຕັດໜ້າ** ຄືເກົ່າ
 * ແລະ ແຕ່ລະລາຍການມີ `warehouses` ຢູ່ຄືເກົ່າ. ຕັດໜ້າສະເພາະເມື່ອສົ່ງ `page` ມາ.
 * ຖ້າຕັດໜ້າໃຫ້ທຸກຄົນ ຊ່າງຄົ້ນອາໄຫຼ່ຈະເຫັນແຕ່ 30 ຕົວທຳອິດ **ໂດຍບໍ່ຮູ້ຕົວ**.
 *
 * ເປີດໃຫ້ຊ່າງ (ຄືເກົ່າ) · ຝ່າຍຕິດຕາມ · ສາງ — ທັງສາມຝ່າຍຕ້ອງເບິ່ງຍອດ.
 */
const ALLOWED = [...new Set([...TECH_SIDE, ...MONITOR_SIDE, ...STOCK_SIDE])];

export async function GET(request: Request) {
  const guard = await requireMobile(request, ALLOWED);
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  try {
    const paged = params.has("page");
    return NextResponse.json(
      await repairStockList(
        params.get("q") ?? "",
        params.get("wh") ?? "",
        params.get("loc") ?? "",
        paged ? Number(params.get("page")) || 1 : 0,
      ),
    );
  } catch (error) {
    console.error("Mobile repair-stock failed", error);
    return NextResponse.json({ error: "ໂຫຼດຄົງເຫຼືອບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
