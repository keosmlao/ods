import { queryOdg } from "@/lib/db";
import { requireMobile } from "@/lib/mobile-auth";
import { TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ຄ່າທີ່ແອັບຕ້ອງໃຊ້ໃນຟອມ — ສາງ ແລະ ທີ່ເກັບ ທີ່ **ອະນຸຍາດ** ຕອນຂໍເບີກ.
 *
 * ບັນຊີລາຍຊື່ທີ່ອະນຸຍາດຢູ່ lib/stock-constants ບ່ອນດຽວ (ອັນດຽວກັບໜ້າເວັບ) —
 * ຢ່າໃຫ້ແອັບຝັງລະຫັດສາງໄວ້ເອງ ບໍ່ດັ່ງນັ້ນມື້ທີ່ສາງປ່ຽນ ໃບຂໍເບີກຈາກແອັບຈະຊີ້ສາງຜິດ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  try {
    // ⚠️ ສາງ/ທີ່ເກັບ ຢູ່ຖານ **ERP** (odg) — ບໍ່ແມ່ນ ODS ⇒ ຕ້ອງໃຊ້ queryOdg
    // ທຸກສາງເບີກໄດ້ (ນະໂຍບາຍ 16-07-2026) — ຄືກັນກັບຟອມເວັບ /stock/requests/[roworder]
    const [warehouses, shelves] = await Promise.all([
      queryOdg<{ code: string; name: string }>(
        `select code, coalesce(nullif(name_1,''), code) as name from ic_warehouse order by code`,
      ),
      queryOdg<{ code: string; name: string; wh_code: string }>(
        `select code, coalesce(nullif(name_1,''), code) as name, whcode as wh_code from ic_shelf order by code`,
      ),
    ]);
    return NextResponse.json({ warehouses: warehouses.rows, shelves: shelves.rows });
  } catch (error) {
    console.error("Mobile lookups failed", error);
    return NextResponse.json({ error: "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
