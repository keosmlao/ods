import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ຄົ້ນຫາບີນຂາຍຈາກ ERP (odg) ເພື່ອເປີດງານຕິດຕັ້ງ.
 * ຖອດແບບຈາກ ods: get_bill_invoice_od() + /search_sml_install (install_admin.py).
 * trans_flag 44 = ໃບຮັບເງິນ/ບີນຂາຍ.
 */
export type BillRow = {
  doc_date: string;
  doc_no: string;
  item_code: string;
  item_name: string;
  qty: string;
  item_type: number;
  cust_code: string | null;
  cust_name: string | null;
  telephone: string | null;
  address: string | null;
  sv_type: string;
  item_brand: string | null;
  doc_date_raw: string;
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  try {
    const rows = (
      await queryOdg<BillRow>(
        `select to_char(a.doc_date,'dd/mm/yyyy') as doc_date, a.doc_no, i.item_name,
           case when ar.telephone is not null then ar.telephone else ar2.name_1 end as cust_name,
           case when ar.telephone is not null then ar.mobile else ar2.telephone end as telephone,
           case when ar.telephone is not null then ar.address else ar2.address end as address,
           i.item_code, i.qty, i.item_type,
           case when inv.item_size='112' then '9900-0020'
                when inv.item_size='023' then '9900-0019'
                when inv.item_size='033' then '9900-0018'
                when inv.item_size='051' then '9900-0017'
                when inv.item_size='121' then '9900-0016'
                else '' end as sv_type,
           inv.item_brand,
           case when ar.telephone is not null then ar.name else ar2.code end as cust_code,
           to_char(a.doc_date,'YYYY-MM-DD') as doc_date_raw
         from ic_trans a
         left join (
           select trans_flag, doc_no, item_code, item_name, item_type, qty, roworder from ic_trans_detail
         ) as i on i.doc_no = a.doc_no and i.trans_flag = 44
         left join (select ar_code, name, address, telephone, mobile from ar_contactor) as ar
           on ar.ar_code = a.cust_code and ar.name = a.contactor
         left join ar_customer ar2 on ar2.code = a.cust_code
         left join ic_inventory inv on inv.code = i.item_code
         where i.trans_flag = 44 and a.doc_no ilike $1
         order by a.doc_date asc, a.doc_no asc
         limit 20`,
        [`%${q}%`],
      )
    ).rows;
    // ods ໃຫ້ເລືອກໄດ້ສະເພາະ item_type 0,1,3
    return NextResponse.json({ data: rows.filter((row) => [0, 1, 3].includes(Number(row.item_type))) });
  } catch (error) {
    console.error("bill search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
