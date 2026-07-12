import { apiAllowed } from "@/lib/api-guard";
import { queryOdg } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * 2 ໂໝດ:
 *
 *  A) ?customer=<ERP cust_code>&item_code=<ລະຫັດສິນຄ້າ>
 *     ISN ຂອງສິນຄ້ານັ້ນ ທີ່ **ຂາຍໃຫ້ລູກຄ້າລາຍນີ້** — ໃຊ້ໃນຟອມຮັບເຄື່ອງ.
 *     ບໍ່ເອົາທຸກໜ່ວຍໃນສາງ ເພາະລູກຄ້າຈະເອົາຄືນມາໄດ້ແຕ່ໜ່ວຍທີ່ຕົນຊື້ໄປ.
 *     (ຕົວຢ່າງ: ສິນຄ້າ 110301-0721 ມີ 583 ໜ່ວຍໃນສາງ ແຕ່ຂາຍໃຫ້ລູກຄ້າຄົນນຶ່ງພຽງ 33 ໜ່ວຍ)
 *
 *  B) ?sn=..
 *     ຄື /checksn ຂອງ ods: ຫາໝາຍເລກເຄື່ອງ ເພື່ອດຶງບິນຂາຍມາຕື່ມໃສ່ໃບຮັບເຄື່ອງ
 *
 * ໝາຍເຫດ: ໃນ sn_trans_detail ຄໍລຳ `sn` ຄວາມຈິງເກັບຄ່າ ISN (ເລກທີ່ພິມຢູ່ປ້າຍ)
 *          ສ່ວນ sn_inventory.sn ຄືເລກຈາກໂຮງງານ — ຈຶ່ງຕ້ອງ join ເອົາ.
 */
export async function GET(request: NextRequest) {
  // ຟອມທີ່ເອີ້ນ route ນີ້ຢູ່ໜ້າ /service/new (ຝ່າຍບໍລິການ) — /api ຢູ່ນອກ matcher ຂອງ proxy
  if (!(await apiAllowed("/service/new"))) return NextResponse.json([], { status: 403 });

  const sn = request.nextUrl.searchParams.get("sn")?.trim() ?? "";
  if (sn) {
    const result = await queryOdg(
      `select a.roworder, a.item_code, coalesce(c.name_1, a.item_name) item_name, a.sn, coalesce(a.isn,'') isn,
         coalesce(b.doc_no,'') doc_no, coalesce(to_char(b.doc_date,'YYYY-MM-DD'),'') doc_date,
         coalesce(a.doc_ref,'') doc_ref
       from sn_trans_detail a
       left join public.ic_trans b on b.doc_no = a.doc_ref
       left join public.ic_inventory c on c.code = a.item_code
       where a.sn = $1 or a.isn = $1
       order by b.doc_date desc nulls last, a.roworder desc limit 10`,
      [sn],
    );
    return NextResponse.json(result.rows);
  }

  const itemCode = request.nextUrl.searchParams.get("item_code")?.trim() ?? "";
  const customer = request.nextUrl.searchParams.get("customer")?.trim() ?? "";
  if (!itemCode || !customer) return NextResponse.json([]);

  const result = await queryOdg(
    `select distinct on (d.sn)
       d.roworder,
       d.sn        as isn,            -- ເລກປ້າຍ (ISN)
       coalesce(inv.sn,'') as sn,     -- ເລກໂຮງງານ
       d.item_code,
       coalesce(inv.item_name, d.item_name) item_name,
       coalesce(inv.status, 0) status,
       t.doc_no,
       to_char(t.doc_date,'YYYY-MM-DD') doc_date
     from sn_trans_detail d
     join public.ic_trans t on t.doc_no = d.doc_ref and t.trans_flag = 44
     left join public.sn_inventory inv on inv.isn = d.sn
     where d.trans_flag = 44
       and t.cust_code = $1
       and d.item_code = $2
       and coalesce(d.sn,'') <> ''
     order by d.sn, t.doc_date desc
     limit 100`,
    [customer, itemCode],
  );
  return NextResponse.json(result.rows);
}
