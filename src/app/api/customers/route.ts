import { apiAllowed } from "@/lib/api-guard";
import { query, queryOdg } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * ຄົ້ນຫາລູກຄ້າ — ຈາກ ERP ar_customer ຢ່າງດຽວ (20,521 ຄົນ).
 *
 * tb_product.cust_code ຍັງຕ້ອງເປັນລະຫັດຂອງ ODS (ວຽກເກົ່າ 5,000+ ໃບອີງໃສ່ມັນ)
 * ຈຶ່ງສົ່ງກັບທັງລະຫັດ ERP (ref_code) ແລະ ລະຫັດ ODS (code — ວ່າງຖ້າຍັງບໍ່ມີ).
 * ຕອນບັນທຶກ createService ຈະ copy ລູກຄ້າ ERP ເຂົ້າ ar_customer ຂອງ ODS ໃຫ້ເອງ
 * — ຄືກັບທີ່ install_admin.py ຂອງ ods ເຮັດຢູ່ແລ້ວ (upsert ດ້ວຍ ref_code).
 */

type ErpRow = {
  erp_code: string;
  name_1: string;
  tel: string;
  address: string;
  /** ພິກັດຂອງລູກຄ້າ (ar_customer_detail) — null ຖ້າບໍ່ມີ ຫຼື ເປັນ 0 */
  lat: number | null;
  lng: number | null;
};
type OdsRow = { code: string; ref_code: string };

export async function GET(request: NextRequest) {
  // ຟອມທີ່ເອີ້ນ route ນີ້ຢູ່ໜ້າ /service/new (ຝ່າຍບໍລິການ) — /api ຢູ່ນອກ matcher ຂອງ proxy
  if (!(await apiAllowed("/service/new"))) return NextResponse.json([], { status: 403 });
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  // ໝາຍເຫດ: `ref` ເປັນຄຳສະຫງວນຂອງ SQL — ຕ້ອງໃຊ້ຊື່ອື່ນ
  /**
   * ── ພິກັດຈາກ ar_customer_detail (01-08-2026) ──
   * ຖ້າ ERP ຮູ້ບ່ອນຂອງລູກຄ້າແລ້ວ ບໍ່ຕ້ອງໃຫ້ຄົນຮັບເຄື່ອງປັກໝຸດເອງອີກ.
   *
   * ⚠️ **20,595 ຈາກ 20,845 ແຖວເປັນ 0.0** ເຊິ່ງບໍ່ແມ່ນພິກັດ (ມັນຢູ່ກາງມະຫາສະໝຸດ)
   * ⇒ ຕ້ອງກອງດ້ວຍຂອບເຂດປະເທດລາວ ບໍ່ດັ່ງນັ້ນທຸກໃບຈະໄດ້ໝຸດຜິດບ່ອນ.
   * ໃຊ້ໄດ້ຈິງພຽງ **247 ຄົນ** — ທີ່ເຫຼືອຍັງຕ້ອງປັກເອງຄືເກົ່າ.
   */
  const erp = await queryOdg<ErpRow>(
    `select a.code as erp_code, a.name_1, coalesce(a.telephone,'') tel, coalesce(a.address,'') address,
        case when d.latitude between 13 and 23 and d.longitude between 100 and 108
             then d.latitude::float8 end lat,
        case when d.latitude between 13 and 23 and d.longitude between 100 and 108
             then d.longitude::float8 end lng
     from ar_customer a
     left join ar_customer_detail d on d.ar_code = a.code
     where a.code ilike $1 or a.name_1 ilike $1 or a.telephone ilike $1
     order by a.name_1 limit 25`,
    [`%${q}%`],
  );
  if (!erp.rows.length) return NextResponse.json([]);

  // ຄົນໃດມີບັນຊີ ODS ແລ້ວແດ່ (ຜູກດ້ວຍ ref_code = ລະຫັດ ERP)
  const refs = erp.rows.map((row) => row.erp_code);
  const linked = new Map<string, string>();
  const rows = (await query<OdsRow>("select code, ref_code from ar_customer where ref_code = any($1)", [refs])).rows;
  for (const row of rows) linked.set(row.ref_code, row.code);

  return NextResponse.json(
    erp.rows.map((row) => ({
      // ວ່າງ = ຍັງບໍ່ມີບັນຊີ ODS, ຈະສ້າງໃຫ້ຕອນບັນທຶກ
      code: linked.get(row.erp_code) ?? "",
      ref_code: row.erp_code,
      name_1: row.name_1,
      tel: row.tel,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      source: "erp" as const,
    })),
  );
}
