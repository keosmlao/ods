import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { roleOf, SERVICE_SIDE } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ຄົ້ນຫາບີນຂາຍຈາກ ERP (odg) ເພື່ອເປີດງານຕິດຕັ້ງ.
 * ຖອດແບບຈາກ ods: get_bill_invoice_od() + /search_sml_install (install_admin.py).
 * trans_flag 44 = ໃບຮັບເງິນ/ບີນຂາຍໜ້າຮ້ານ.
 *
 * ── ກອງສະເພາະບິນທີ່ມີ "ລາຍການຕິດຕັ້ງ" ──
 * ERP ມີບິນຂາຍ **216,356 ໃບ** ແຕ່ບິນທີ່ມີສິນຄ້າຕ້ອງຕິດຕັ້ງ (ແອ ແລະ ອື່ນໆ) ມີພຽງ
 * **8,515 ໃບ** ⇒ ຖ້າບໍ່ກອງ ຄົນຈະຄົ້ນຫາໃນກອງບິນເຂົ້າຫນົມ/ຫມໍ້ຫຸງເຂົ້າ.
 *
 * ສິນຄ້າທີ່ຕ້ອງຕິດຕັ້ງ ຮູ້ຈາກ `ic_inventory.item_size` 5 ລະຫັດ (112 · 023 · 033 · 051 · 121)
 * — ອັນດຽວກັບທີ່ ods ໃຊ້ຄິດ `sv_type` ຢູ່ແລ້ວ (ຂ້າງລຸ່ມ) ⇒ ບໍ່ໄດ້ຄິດເກນໃໝ່ ພຽງແຕ່
 * ເອົາເກນເກົ່າມາໃຊ້ **ກອງ** ນຳ. ແຖວທີ່ບໍ່ແມ່ນສິນຄ້າຕິດຕັ້ງ (ສາຍ, ທໍ່, ຂອງແຖມ)
 * ບໍ່ຂຶ້ນມາໃຫ້ເລືອກເລີຍ — ເລືອກຜິດແຖວ = ງານຕິດຕັ້ງຜູກສິນຄ້າຜິດ.
 *
 * ── ຮຽງໃໝ່ສຸດກ່ອນ ──
 * ຂອງເກົ່າຮຽງ `doc_date asc` ⇒ ເປີດມາເຫັນບິນປີ 2019. CS ເປີດງານໃຫ້ບິນ**ທີ່ຫາກໍ່ຂາຍ**.
 *
 * ── ສິດ ──
 * matcher ຂອງ src/proxy.ts **ຕັດ /api ອອກ** ⇒ ດ່ານກວດ role ຂອງໜ້າບໍ່ຄຸມມາຮອດນີ້.
 * route ນີ້ປ່ອຍ ຊື່/ເບີໂທ/ທີ່ຢູ່ ຂອງລູກຄ້າຈາກ ERP ອອກມາ ຈຶ່ງຕ້ອງກວດເອງ.
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
  /** ດຶງມາຈາກ ERP — ຟອມຕື່ມໃຫ້ ບໍ່ຕ້ອງພິມເອງ */
  pro_type: string | null;
  pro_type_name: string | null;
  pro_size: string | null;
  /**
   * ISN (ເລກປ້າຍ) ທີ່ຂາຍໄປໃນບິນນີ້ — ຈາກ sn_trans_detail (ອັນດຽວກັບທີ່ຝັ່ງສ້ອມໃຊ້,
   * ເບິ່ງ /api/serials). `sn` = ເລກໂຮງງານທີ່ຜູກກັບ ISN ນັ້ນ (sn_inventory) ຖ້າມີ.
   * ບໍ່ມີ ISN ໃນບິນ = ພິມ S/N ເອງ.
   */
  serials: { isn: string; sn: string; part: string }[];
};

/** ຂະໜາດສິນຄ້າທີ່ **ຕ້ອງຕິດຕັ້ງ** — ຄ່າດຽວກັບທີ່ໃຊ້ຄິດ sv_type ຂ້າງລຸ່ມ */
const INSTALL_SIZES = ["112", "023", "033", "051", "121"];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SERVICE_SIDE.includes(roleOf(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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
           to_char(a.doc_date,'YYYY-MM-DD') as doc_date_raw,
           /**
            * ── ດຶງຈາກ ERP ແທນທີ່ຈະໃຫ້ CS ພິມເອງ ──
            * ປະເພດ (ic_category) ແລະ ຂະໜາດ (ic_size) ຢູ່ໃນ master ຂອງສິນຄ້າແລ້ວ.
            * ⚠️ **Model ດຶງບໍ່ໄດ້** — ic_inventory.item_model ຫວ່າງ 24,156/24,281 ແຖວ
            * ⇒ ຍັງຕ້ອງພິມເອງ (ຊື່ສິນຄ້າມີລະຫັດຮຸ່ນຢູ່ ໃຫ້ຄັດລອກເອົາ).
            */
           inv.item_category as pro_type,
           cat.name_1 as pro_type_name,
           siz.name_1 as pro_size,
           /**
            * ── ISN ຂອງແອຢູ່ **ອົງປະກອບຂອງຊຸດ** ບໍ່ແມ່ນຢູ່ແຖວ [SET] ──
            * ພິສູດຈາກຂໍ້ມູນຈິງ (ບິນ CAK26008714): ແຖວ [SET] 120101-2606 ບໍ່ມີ ISN ເລີຍ
            * ແຕ່ ISN ຢູ່ທີ່ [C] 120101-2607 ແລະ [H] 120101-2608.
            * ⇒ ຕ້ອງແຕກຊຸດອອກກ່ອນ (ic_inventory_set_detail: ic_set_code → ic_code)
            *   ແລ້ວຄົ້ນ ISN ຂອງ **ອົງປະກອບ** ພ້ອມ.
            * ຖ້າຄົ້ນແຕ່ item_code ຂອງແຖວທີ່ເລືອກ ⇒ ແອ **ທຸກຊຸດ** ຈະບໍ່ມີ ISN ໃຫ້ເລືອກເລີຍ.
            *
            * ໜ່ວຍໃນ [C] ຂຶ້ນກ່ອນ — ເປັນຕົວທີ່ຖືເປັນເອກະລັກຂອງເຄື່ອງ.
            */
           coalesce((
             select json_agg(json_build_object(
                      'isn', d.sn,
                      'sn', coalesce(inv2.sn, ''),
                      'part', case when d.item_name ilike '%[C]%' then 'ໜ່ວຍໃນ'
                                   when d.item_name ilike '%[H]%' then 'ໜ່ວຍນອກ'
                                   else '' end)
                      order by (d.item_name ilike '%[C]%') desc, d.sn)
               from sn_trans_detail d
               left join sn_inventory inv2 on inv2.isn = d.sn
              where d.doc_ref = a.doc_no and d.trans_flag = 44 and coalesce(d.sn,'') <> ''
                and (
                  d.item_code = i.item_code
                  or d.item_code in (
                    select sd.ic_code from ic_inventory_set_detail sd where sd.ic_set_code = i.item_code)
                )
           ), '[]'::json) as serials
         from ic_trans a
         join ic_trans_detail i on i.doc_no = a.doc_no and i.trans_flag = 44
         join ic_inventory inv on inv.code = i.item_code
         left join (select ar_code, name, address, telephone, mobile from ar_contactor) as ar
           on ar.ar_code = a.cust_code and ar.name = a.contactor
         left join ar_customer ar2 on ar2.code = a.cust_code
         left join ic_category cat on cat.code = inv.item_category
         left join ic_size siz on siz.code = inv.item_size
         where a.trans_flag = 44
           -- ສະເພາະ **ແຖວສິນຄ້າທີ່ຕ້ອງຕິດຕັ້ງ** (ບໍ່ເອົາສາຍ/ທໍ່/ຂອງແຖມມາໃຫ້ເລືອກຜິດ)
           and inv.item_size = any($2::text[])
           and i.item_type in (0,1,3)
           /**
            * ── ແອ: ເອົາແຕ່ແຖວ [SET] ──
            * ERP ແຍກແອອອກເປັນ 3 ແຖວ: [C] ໜ່ວຍໃນ (10,529) · [H] ໜ່ວຍນອກ (10,396)
            * · [SET] ຊຸດ (2,779) ⇒ ບິນດຽວຂຶ້ນ 3 ແຖວ ແລະ ຄົນເລືອກຜິດແຖວໄດ້ງ່າຍ.
            *
            * ຕັດ [H] ສະເໝີ (ໜ່ວຍນອກ ບໍ່ແມ່ນຕົວເຄື່ອງທີ່ຜູກງານ) ແລະ ຕັດ [C] **ສະເພາະ
            * ບິນທີ່ມີ [SET] ຢູ່ແລ້ວ** — ບໍ່ຕັດຖິ້ມທັງໝົດ ເພາະ **5,943 ບິນບໍ່ມີ [SET] ເລີຍ**
            * (ບິນເກົ່າທີ່ຂາຍແຍກໜ່ວຍ ແລະ ແອເຄື່ອນທີ່ທີ່ບໍ່ມີ tag) ⇒ ຕັດໝົດ = ບິນນັ້ນຫາຍ.
            */
           and i.item_name not ilike '%[H]%'
           and (
             i.item_name not ilike '%[C]%'
             or not exists (
               select 1 from ic_trans_detail s
                where s.doc_no = a.doc_no and s.trans_flag = 44 and s.item_name ilike '%[SET]%')
           )
           and ($1 = '' or a.doc_no ilike $3 or ar2.name_1 ilike $3 or ar2.telephone ilike $3)
         order by a.doc_date desc, a.doc_no desc
         limit 30`,
        [q, INSTALL_SIZES, `%${q}%`],
      )
    ).rows;

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("bill search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
