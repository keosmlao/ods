import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { roleOf, SERVICE_SIDE } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ISN ຂອງສິນຄ້າລາຍການນຶ່ງ — **ໃຊ້ຕອນບິນບໍ່ໄດ້ລົງ ISN ໄວ້**.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ປົກກະຕິ ISN ຂອງໜ່ວຍທີ່ຂາຍຢູ່ໃນ sn_trans_detail ຂອງບິນ ⇒ ຟອມເອົາອັນນັ້ນມາໃຫ້ເລືອກ
 * (ເບິ່ງ api/installations/bills). ແຕ່ **ບາງບິນ ERP ບໍ່ໄດ້ລົງ ISN ເລີຍ**
 * (ຕົວຢ່າງຈິງ CAK26008723: ຈັກຊັກ + ຕູ້ເຢັນ ⇒ ISN 0 ແຖວ) ⇒ ຄົນຮັບເຄື່ອງຕ້ອງພິມ S/N
 * ດ້ວຍມື ແລະ ພິມຜິດໄດ້ ⇒ ຮັບປະກັນ/ສ້ອມພາຍຫຼັງອ້າງອີງບໍ່ຖືກໜ່ວຍ.
 *
 * ດຽວນີ້: ຄົ້ນ ISN **ຂອງລາຍການນັ້ນ** ຈາກ sn_inventory (ຄັງ ISN ຂອງບໍລິສັດ — ໜ່ວຍທີ່
 * ຂາຍອອກໄປແລ້ວກໍ່ຍັງຢູ່ ພຽງແຕ່ status ປ່ຽນ) ⇒ ຄົນອ່ານ ISN ຈາກປ້າຍແລ້ວເລືອກເອົາ.
 *
 * ⚠️ sn_inventory **ບໍ່ມີ index ຢູ່ item_code** (seq scan 148k ແຖວ ≈ 80ms) — ຮັບໄດ້
 * ເພາະຄົ້ນຕໍ່ເມື່ອກົດເລືອກລາຍການ. ຖານ ERP ອ່ານຢ່າງດຽວ ⇒ ເພີ່ມ index ບໍ່ໄດ້.
 *
 * ສິດ: matcher ຂອງ src/proxy.ts ຕັດ /api ອອກ ⇒ ກວດ role ເອງ (ຝ່າຍບໍລິການ).
 */
export type SerialRow = {
  isn: string;
  sn: string;
  /** 1 = ຍັງຢູ່ໃນສາງ · 0 = ອອກໄປແລ້ວ (ຂາຍ) — ໜ່ວຍທີ່ຕິດຕັ້ງມັກຈະເປັນ 0 */
  in_stock: boolean;
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SERVICE_SIDE.includes(roleOf(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const itemCode = (request.nextUrl.searchParams.get("item_code") ?? "").trim();
  if (!itemCode) return NextResponse.json({ data: [] });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  try {
    const rows = (
      await queryOdg<SerialRow>(
        `select s.isn, coalesce(s.sn,'') as sn, (s.status = 1) as in_stock
           from sn_inventory s
          where s.item_code = $1
            and coalesce(s.isn,'') <> ''
            ${q ? "and (s.isn ilike $2 or s.sn ilike $2)" : ""}
          order by s.create_date_time_now desc
          limit 50`,
        q ? [itemCode, `%${q}%`] : [itemCode],
      )
    ).rows;

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("serial search failed", error);
    return NextResponse.json({ error: "ຄົ້ນ ISN ບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
