import { permissionFor } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { erpItemUnits, INSTALL_KIT_MENU, searchErpItems } from "@/lib/install-kit";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ── ຄົ້ນຫາອາໄຫຼ່ ແລະ ຫົວໜ່ວຍ ສຳລັບໜ້າຈັດການຊຸດອາໄຫຼ່ມາດຕະຖານ ──
 *
 * ສອງໂໝດໃນ route ດຽວ:
 *   `?q=ນ໋ອດ`        → ຄົ້ນ `ic_inventory` (code · name_1 · unit_standard)
 *   `?units=140507-0200` → ຫົວໜ່ວຍທີ່ສິນຄ້ານັ້ນໃຊ້ໄດ້ (`ic_unit_use`)
 *
 * ⚠️ matcher ຂອງ src/proxy.ts ຕັດ /api ອອກ ⇒ ຕ້ອງກວດສິດເອງຢູ່ນີ້ (ຄືກັບ
 * api/installations/spares). ໃຊ້ **ສິດເມນູອັນດຽວກັບ action** (/manage/install-kits)
 * ບໍ່ແມ່ນ role ລ້ວນ ⇒ ຄົນທີ່ຜູ້ຈັດການເປີດສິດໃຫ້ ຄົ້ນຫາໄດ້ຄືກັນກັບທີ່ບັນທຶກໄດ້.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  /**
   * ອ່ານລາຍການສິນຄ້າ = ຂັ້ນຕອນນຶ່ງຂອງການ "ເພີ່ມ/ແກ້" ⇒ ຕ້ອງມີສິດອ່ານເມນູນີ້.
   * `permissionFor` ຕົກມາໃຊ້ role ໃຫ້ເອງເມື່ອບໍ່ມີ override (ຜູ້ຈັດການຈຶ່ງຜ່ານຢູ່ແລ້ວ).
   */
  if (!(await permissionFor(session, INSTALL_KIT_MENU)).read) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const forUnits = (params.get("units") ?? "").trim();

  try {
    if (forUnits) {
      return NextResponse.json({ units: await erpItemUnits(forUnits) });
    }
    const q = (params.get("q") ?? "").trim();
    // ຄຳສັ້ນເກີນ ⇒ ຄືນຫວ່າງ (ບໍ່ໃຫ້ scan ic_inventory ທັງກ້ອນຕໍ່ທຸກຕົວອັກສອນ)
    if (q.length < 2) return NextResponse.json({ data: [] });
    return NextResponse.json({ data: await searchErpItems(q) });
  } catch (error) {
    console.error("install-kit item search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
