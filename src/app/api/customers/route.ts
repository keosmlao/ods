import { getSession } from "@/lib/auth";
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

type ErpRow = { erp_code: string; name_1: string; tel: string; address: string };
type OdsRow = { code: string; ref_code: string };

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json([], { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  // ໝາຍເຫດ: `ref` ເປັນຄຳສະຫງວນຂອງ SQL — ຕ້ອງໃຊ້ຊື່ອື່ນ
  const erp = await queryOdg<ErpRow>(
    `select code as erp_code, name_1, coalesce(telephone,'') tel, coalesce(address,'') address
     from ar_customer
     where code ilike $1 or name_1 ilike $1 or telephone ilike $1
     order by name_1 limit 25`,
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
      source: "erp" as const,
    })),
  );
}
