import { apiAllowed } from "@/lib/api-guard";
import { query, queryOdg } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * ຍິງບາໂຄດ (ISN ຫຼື SN) ແລ້ວດຶງທຸກຢ່າງທີ່ຮູ້ໄດ້ຈາກ ERP.
 *
 * ຕ່ອງໂສ້: ບາໂຄດ → sn_inventory (ISN ↔ SN ↔ item_code)
 *          → sn_trans_detail (ບິນຂາຍ trans_flag 44) → doc_ref
 *          → ic_trans (ບິນຈິງ: CAK/INH/...) → ລູກຄ້າ + ວັນທີ
 *
 * ໝາຍເຫດ 2 ຢ່າງທີ່ຄົ້ນພົບຈາກຂໍ້ມູນຈິງ:
 *  1. ໃນ sn_trans_detail ຄໍລຳ `sn` ຄວາມຈິງເກັບຄ່າ ISN — ຈຶ່ງຕ້ອງຈັບຄູ່ທັງ sn ແລະ isn.
 *  2. ລູກຄ້າໃນບິນຄື "ຜູ້ຊື້ເດີມ" (ສ່ວນຫຼາຍເປັນຮ້ານຄ້າ) ເຊິ່ງມີພຽງ ~26% ທີ່ຕົງກັບ
 *     ຄົນທີ່ເອົາເຄື່ອງມາສ້ອມ. ຈຶ່ງສົ່ງກັບເປັນ "ຄຳແນະນຳ" ເທົ່ານັ້ນ ບໍ່ໄດ້ຕັ້ງໃຫ້ອັດຕະໂນມັດ.
 */

type ErpRow = {
  sn: string | null;
  isn: string | null;
  item_code: string;
  item_name: string;
  brand: string;
  model: string;
  item_category: string | null;
  bill_no: string | null;
  bill_date: string | null;
  erp_cust: string | null;
  erp_cust_name: string;
  erp_cust_tel: string;
};

type OdsCustomer = { code: string; name_1: string; tel: string; address: string; ref_code: string };

const ERP_SQL = `
with unit as (
  select sn, isn, item_code, item_name
  from sn_inventory
  where replace(coalesce(isn,''),' ','') = replace($1,' ','')
     or replace(coalesce(sn,''),' ','')  = replace($1,' ','')
  order by coalesce(latest_mapping, create_date_time_now) desc nulls last
  limit 1
),
sale as (
  select t.doc_no bill_no, to_char(t.doc_date,'YYYY-MM-DD') bill_date, t.cust_code erp_cust
  from sn_trans_detail d
  join ic_trans t on t.doc_no = d.doc_ref and t.trans_flag = 44
  where d.trans_flag = 44
    and d.sn in (select sn from unit union select isn from unit union select $1)
  order by t.doc_date desc
  limit 1
)
select u.sn, u.isn, u.item_code, u.item_name,
       coalesce(i.item_brand,'') brand, coalesce(i.item_model,'') model,
       i.item_category,
       s.bill_no, s.bill_date, s.erp_cust,
       coalesce(c.name_1,'') erp_cust_name, coalesce(c.telephone,'') erp_cust_tel
from unit u
left join ic_inventory i on i.code = u.item_code
left join sale s on true
left join ar_customer c on c.code = s.erp_cust`;

export async function GET(request: NextRequest) {
  // ຟອມທີ່ເອີ້ນ route ນີ້ຢູ່ໜ້າ /service/new (ຝ່າຍບໍລິການ) — /api ຢູ່ນອກ matcher ຂອງ proxy
  if (!(await apiAllowed("/service/new"))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (code.length < 3) return NextResponse.json({ found: false });

  const erp = (await queryOdg<ErpRow>(ERP_SQL, [code])).rows[0];
  if (!erp) return NextResponse.json({ found: false });

  // ຜູ້ຊື້ເດີມມີບັນຊີໃນລະບົບສ້ອມບໍ (ຈັບຄູ່ດ້ວຍ ref_code = ລະຫັດລູກຄ້າຢູ່ ERP)
  let buyer: OdsCustomer | null = null;
  if (erp.erp_cust) {
    buyer =
      (
        await query<OdsCustomer>(
          `select code, name_1, coalesce(tel,'') tel, coalesce(address,'') address, coalesce(ref_code,'') ref_code
           from ar_customer where ref_code = $1 limit 1`,
          [erp.erp_cust],
        )
      ).rows[0] ?? null;
  }

  return NextResponse.json({
    found: true,
    sn: erp.isn || erp.sn || code, // ISN ຄືເລກທີ່ພິມຢູ່ປ້າຍ — ໃຊ້ອັນນີ້ເປັນຫຼັກ
    product: erp.item_name,
    itemCode: erp.item_code,
    brand: erp.brand,
    model: erp.model,
    // ໝວດສິນຄ້າຈາກ ERP ໂດຍກົງ (ic_category) — tb_type ຖືກ sync ໃຫ້ຕົງກັນແລ້ວ
    productType: erp.item_category ?? "",
    billNo: erp.bill_no ?? "",
    billDate: erp.bill_date ?? "",
    // ຜູ້ຊື້ເດີມ — ເປັນຄຳແນະນຳ ບໍ່ແມ່ນຄຳຕອບ
    buyer: erp.erp_cust
      ? { erpCode: erp.erp_cust, name: erp.erp_cust_name, tel: erp.erp_cust_tel, ods: buyer }
      : null,
  });
}
