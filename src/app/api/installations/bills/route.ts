import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { roleOf, SERVICE_SIDE } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ຄົ້ນຫາບີນຂາຍຈາກ ERP (odg) ເພື່ອເປີດງານຕິດຕັ້ງ.
 * trans_flag 44 = ໃບຮັບເງິນ/ບີນຂາຍໜ້າຮ້ານ.
 *
 * ── ຄວາມໄວ — ຢ່າຍຸບ query 3 ຊັ້ນນີ້ໃຫ້ເປັນອັນດຽວ ──
 * ERP ມີບິນ 216,356 ໃບ ແລະ **ic_trans ບໍ່ມີ index ຢູ່ doc_date**.
 * ຮຸ່ນທຳອິດຂຽນເປັນ query ດຽວ (join ໝົດ + subquery ISN ໃສ່ທຸກແຖວ ແລ້ວຮຽງ doc_date):
 *   ບໍ່ພິມຫຍັງ = **7.7 ວິນາທີ** · ຄົ້ນຊື່ລູກຄ້າ = **8.7 ວິນາທີ**
 *
 * ດຽວນີ້:
 *   ① ຄົ້ນ **ລູກຄ້າ** ກ່ອນ (ar_customer ນ້ອຍ) → ໄດ້ລະຫັດ → ກອງບິນດ້ວຍ cust_code
 *      ທີ່ **ມີ index** (ic_trans_cust_code_idx) ⇒ 8.7s → **0.35s**
 *   ② ຮຽງ/ກອງດ້ວຍ **ic_trans_detail.doc_date** (ມີ index) ບໍ່ແມ່ນ ic_trans.doc_date
 *   ③ ບໍ່ພິມຫຍັງ = ຈຳກັດ **90 ມື້ຫຼ້າສຸດ** ⇒ 7.7s → **0.44s**
 *      (CS ເປີດງານໃຫ້ບິນທີ່ຫາກໍ່ຂາຍ — ບິນເກົ່າກວ່ານັ້ນຫາໄດ້ດ້ວຍການພິມເລກບິນ)
 *   ④ ຄິດ ISN ສະເພາະ 30 ແຖວທີ່ຄັດແລ້ວ (ບໍ່ແມ່ນທຸກແຖວທີ່ scan ຜ່ານ)
 *
 * ── ກອງສະເພາະບິນທີ່ມີ "ລາຍການຕິດຕັ້ງ" ──
 * ຮູ້ຈາກ ic_inventory.item_size 5 ລະຫັດ — ຄ່າດຽວກັບທີ່ໃຊ້ຄິດ sv_type ຢູ່ແລ້ວ.
 * ແອ: ຕັດ [H] ສະເໝີ · ຕັດ [C] ສະເພາະບິນທີ່ມີ [SET] (5,943 ບິນບໍ່ມີ [SET] ເລີຍ
 * ⇒ ຕັດໝົດ = ບິນນັ້ນຫາຍ).
 *
 * ── ສິດ ──
 * matcher ຂອງ src/proxy.ts ຕັດ /api ອອກ ⇒ route ນີ້ປ່ອຍຊື່/ເບີ/ທີ່ຢູ່ລູກຄ້າອອກມາ
 * ຈຶ່ງຕ້ອງກວດ role ເອງ (ຝ່າຍບໍລິການ — ຄືໜ້າ /installations/new).
 */
export type BillRow = {
  doc_date: string;
  doc_no: string;
  item_code: string;
  item_name: string;
  qty: string;
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
  /** ISN ທີ່ຂາຍໃນບິນນີ້ (ແອ: ຢູ່ອົງປະກອບຂອງຊຸດ) ພ້ອມເລກໂຮງງານ */
  serials: { isn: string; sn: string; part: string }[];
};

/** ຂະໜາດສິນຄ້າທີ່ **ຕ້ອງຕິດຕັ້ງ** — ຄ່າດຽວກັບທີ່ໃຊ້ຄິດ sv_type */
const INSTALL_SIZES = ["112", "023", "033", "051", "121"];

/** ບໍ່ພິມຫຍັງ = ບິນ 90 ມື້ຫຼ້າສຸດ (ບໍ່ດັ່ງນັ້ນຕ້ອງ scan ບິນ 7 ປີ) */
const RECENT_DAYS = 90;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SERVICE_SIDE.includes(roleOf(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  try {
    /**
     * ① ຄຳຄົ້ນອາດເປັນ "ຊື່ລູກຄ້າ" ຫຼື "ເບີໂທ" ⇒ ຫາລະຫັດລູກຄ້າກ່ອນຈາກຕາຕະລາງນ້ອຍ.
     * ຖ້າ join ar_customer ເຂົ້າໄປໃນ query ບິນໂດຍກົງ ຈະກາຍເປັນ scan 216k ບິນ (8.7s).
     */
    const custCodes = q
      ? (
          await queryOdg<{ code: string }>(
            `select code from ar_customer
              where name_1 ilike $1 or telephone ilike $1 or code = $2
              limit 50`,
            [`%${q}%`, q],
          )
        ).rows.map((row) => row.code)
      : [];

    /**
     * ⚠️ `ilike '%q%'` **ໃຊ້ index ບໍ່ໄດ້** (2.4 ວິນາທີ). ເລກບິນເປັນຕົວພິມໃຫຍ່ສະເໝີ
     * ⇒ ໃຊ້ `like upper(q) || '%'` (ຄົ້ນຈາກຫົວ, case-sensitive) ⇒ index ໃຊ້ໄດ້:
     *   ຫົວເລກບິນ = 0.72s · ເລກບິນເຕັມ = **0.006s**
     * ຝັ່ງລູກຄ້າກອງດ້ວຍ cust_code ທີ່ມີ index = 0.01s.
     */
    /**
     * ບໍ່ພົບລູກຄ້າ ⇒ **ຢ່າໃສ່ເງື່ອນໄຂ OR cust_code** — ຕົວ OR ບັງຄັບໃຫ້ planner scan
     * ທັງໆທີ່ຂ້າງນຶ່ງຫວ່າງ (ເລກບິນເຕັມ: 2.0s → 0.2s).
     */
    const where = !q
      ? `and i.doc_date >= current_date - ${RECENT_DAYS}`
      : custCodes.length > 0
        ? "and (i.doc_no like upper($2) || '%' or a0.cust_code = any($3::text[]))"
        : "and i.doc_no like upper($2) || '%'";

    const rows = (
      await queryOdg<BillRow>(
        `with candidate as (
           -- ② ຄັດຜູ້ສະໝັກກ່ອນ ດ້ວຍ ic_trans_detail (ມີ index ຢູ່ doc_date)
           select i.doc_no, i.doc_date, i.item_code, i.item_name, i.qty
             from ic_trans_detail i
             join ic_inventory inv on inv.code = i.item_code
             ${custCodes.length > 0 ? "join ic_trans a0 on a0.doc_no = i.doc_no and a0.trans_flag = 44" : ""}
            where i.trans_flag = 44
              and inv.item_size = any($1::text[])
              and i.item_type in (0,1,3)
              and i.item_name not ilike '%[H]%'   -- ແອ: ຕັດໜ່ວຍນອກສະເໝີ
              ${where}
            order by i.doc_date desc, i.doc_no desc
            limit 60
         ),
         kept as (
           -- ແອ: ຕັດ [C] ສະເພາະບິນທີ່ມີ [SET] (ບິນເກົ່າຂາຍແຍກໜ່ວຍ ⇒ ຕ້ອງເຫຼືອ [C] ໄວ້)
           select c.* from candidate c
            where c.item_name not ilike '%[C]%'
               or not exists (
                 select 1 from ic_trans_detail s
                  where s.doc_no = c.doc_no and s.trans_flag = 44 and s.item_name ilike '%[SET]%')
            limit 30
         ),
         comp as (
           -- ອົງປະກອບຂອງຊຸດ (ແອ [SET] → [C]/[H]) — ຄິດຄັ້ງດຽວສຳລັບ 30 ແຖວ
           select k.doc_no, k.item_code, sd.ic_code
             from kept k
             join ic_inventory_set_detail sd on sd.ic_set_code = k.item_code
         ),
         isn as (
           /**
            * ISN ຂອງ **30 ບິນ** ດຶງເປັນກ້ອນດຽວ (doc_ref = any) — ບໍ່ແມ່ນຄິດ subquery
            * ຕໍ່ແຖວ. subquery ຕໍ່ແຖວກິນ **2.6 ວິນາທີ**, ແບບນີ້ເຫຼືອ ~0.5 ວິນາທີ.
            */
           select d.doc_ref, d.item_code, d.item_name, d.sn as isn, coalesce(sni.sn,'') as sn
             from sn_trans_detail d
             left join sn_inventory sni on sni.isn = d.sn
            where d.trans_flag = 44 and coalesce(d.sn,'') <> ''
              and d.doc_ref = any(select doc_no from kept)
         )
         select to_char(k.doc_date,'dd/mm/yyyy') as doc_date,
            to_char(k.doc_date,'YYYY-MM-DD') as doc_date_raw,
            k.doc_no, k.item_code, k.item_name, k.qty,
            case when ar.telephone is not null then ar.telephone else ar2.name_1 end as cust_name,
            case when ar.telephone is not null then ar.mobile else ar2.telephone end as telephone,
            case when ar.telephone is not null then ar.address else ar2.address end as address,
            case when ar.telephone is not null then ar.name else ar2.code end as cust_code,
            case when inv.item_size='112' then '9900-0020'
                 when inv.item_size='023' then '9900-0019'
                 when inv.item_size='033' then '9900-0018'
                 when inv.item_size='051' then '9900-0017'
                 when inv.item_size='121' then '9900-0016'
                 else '' end as sv_type,
            inv.item_brand,
            inv.item_category as pro_type,
            cat.name_1 as pro_type_name,
            siz.name_1 as pro_size,
            /**
             * ④ ISN — ຄິດສະເພາະ 30 ແຖວທີ່ຄັດແລ້ວ.
             * ⚠️ ISN ຂອງແອຢູ່ **ອົງປະກອບຂອງຊຸດ** ບໍ່ແມ່ນຢູ່ແຖວ [SET] (ພິສູດຈາກບິນ
             * CAK26008714: [SET] ບໍ່ມີ ISN ແຕ່ [C]/[H] ມີ) ⇒ ຕ້ອງແຕກຊຸດຜ່ານ
             * ic_inventory_set_detail ກ່ອນ ບໍ່ດັ່ງນັ້ນແອທຸກຊຸດຈະບໍ່ມີ ISN ໃຫ້ເລືອກ.
             */
            coalesce((
              select json_agg(json_build_object(
                       'isn', x.isn,
                       'sn', x.sn,
                       'part', case when x.item_name ilike '%[C]%' then 'ໜ່ວຍໃນ'
                                    when x.item_name ilike '%[H]%' then 'ໜ່ວຍນອກ'
                                    else '' end)
                       order by (x.item_name ilike '%[C]%') desc, x.isn)
                from isn x
               where x.doc_ref = k.doc_no
                 and (x.item_code = k.item_code
                      or x.item_code in (select c2.ic_code from comp c2
                                          where c2.doc_no = k.doc_no and c2.item_code = k.item_code))
            ), '[]'::json) as serials
          from kept k
          join ic_trans a on a.doc_no = k.doc_no and a.trans_flag = 44
          join ic_inventory inv on inv.code = k.item_code
          left join ic_category cat on cat.code = inv.item_category
          left join ic_size siz on siz.code = inv.item_size
          left join ar_contactor ar on ar.ar_code = a.cust_code and ar.name = a.contactor
          left join ar_customer ar2 on ar2.code = a.cust_code
         order by k.doc_date desc, k.doc_no desc`,
        !q
          ? [INSTALL_SIZES]
          : custCodes.length > 0
            ? [INSTALL_SIZES, q, custCodes]
            : [INSTALL_SIZES, q],
      )
    ).rows;

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("bill search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
