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
/** ລາຍການ **ທີ່ຕ້ອງຕິດຕັ້ງ** ໃນບິນ — 1 ບິນ ອາດມີຫຼາຍລາຍການ ແລະ ຫຼາຍໜ່ວຍ */
export type BillItem = {
  item_code: string;
  item_name: string;
  /** ຈຳນວນທີ່ຂາຍໃນບິນ — ຕັ້ງຕົ້ນຂອງ "ຈະຕິດຕັ້ງຈັກໜ່ວຍ" */
  qty: number;
  sv_type: string;
  item_brand: string | null;
  /** ດຶງມາຈາກ ERP — ຟອມຕື່ມໃຫ້ ບໍ່ຕ້ອງພິມເອງ */
  pro_type: string | null;
  pro_type_name: string | null;
  pro_size: string | null;
  /** ISN ທີ່ຂາຍໃນບິນນີ້ (ແອ: ຢູ່ອົງປະກອບຂອງຊຸດ) ພ້ອມເລກໂຮງງານ */
  serials: { isn: string; sn: string; part: string }[];
};

/** ແຖວ "ບໍລິການຕິດຕັ້ງ" ທີ່ພະນັກງານຂາຍເພີ່ມເຂົ້າບິນ — ຈຳນວນນີ້ຄື **ຈຳນວນງານທີ່ຈ່າຍເງິນແລ້ວ** */
export type BillService = {
  item_code: string;
  item_name: string;
  qty: number;
};

/** ບິນ 1 ໃບ = 1 ແຖວ (ບໍ່ແມ່ນ 1 ລາຍການ = 1 ແຖວ ຄືເກົ່າ) */
export type BillRow = {
  doc_date: string;
  doc_date_raw: string;
  doc_no: string;
  cust_code: string | null;
  cust_name: string | null;
  telephone: string | null;
  address: string | null;
  items: BillItem[];
  /** ບໍລິການຕິດຕັ້ງທີ່ຢູ່ໃນບິນ (ອັນທີ່ເຮັດໃຫ້ບິນນີ້ຖືກເອົາມາສະແດງ) */
  services: BillService[];
};

/**
 * ສິນຄ້າທີ່ **ຕິດຕັ້ງໄດ້** = ເຄື່ອງຈິງ ບໍ່ແມ່ນຂອງແຖມ/ທໍ່/ຄູປອງ.
 *
 * ⚠️ ຮຸ່ນກ່ອນກອງດ້ວຍ item_size ຂອງ**ແອ** ⇒ ບິນທີ່ຕິດຕັ້ງ **ໂທລະທັດ · ຈັກຊັກເຄື່ອງ ·
 * ຕູ້ເຢັນ · ເຄື່ອງເຮັດນ້ຳອຸ່ນ** (ບໍລິການ 970101-0013 "ຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ" ແລະ
 * 970102 "ນ້ຳອຸ່ນ") **ບໍ່ຂຶ້ນມາເລີຍ**.
 *
 * ຂໍ້ມູນຈິງ (1 ປີ, ບິນທີ່ມີບໍລິການຕິດຕັ້ງ): ກຸ່ມ **11** = ເຄື່ອງໃຊ້ໄຟຟ້າ (2,770 ແຖວ —
 * ໂທລະທັດ · ຈັກຊັກ · ຕູ້ເຢັນ · ນ້ຳອຸ່ນ) · ກຸ່ມ **12** = ແອ (1,559) ·
 * ສ່ວນ 14 = ທໍ່/ຂາຈັບ · 98/96 = ຂອງແຖມ · LU = ຄູປອງ · 97 = ຕົວບໍລິການເອງ ⇒ ບໍ່ເອົາ.
 */
const INSTALLABLE_GROUPS = "(i.item_code like '11%' or i.item_code like '12%')";

/** ບໍ່ພິມຫຍັງ = ບິນ 90 ມື້ຫຼ້າສຸດ (ບໍ່ດັ່ງນັ້ນຕ້ອງ scan ບິນ 7 ປີ) */
const RECENT_DAYS = 90;

/**
 * ບິນ **ໜ້າຮ້ານທີ່ມີບໍລິການຕິດຕັ້ງ** — ຕ້ອງມີແຖວ "ບໍລິການຕິດຕັ້ງ…" ຢູ່ໃນບິນ.
 *
 * ⚠️ ນີ້ຄືເກນທີ່ຖືກ — ບໍ່ແມ່ນເດົາຈາກ item_size ຂອງສິນຄ້າ.
 * ຂໍ້ມູນ 90 ມື້: ບິນທີ່ມີສິນຄ້າແອ **922 ໃບ** ແຕ່ມີບໍລິການຕິດຕັ້ງພຽງ **738 ໃບ**
 * ⇒ 184 ໃບທີ່ເຫຼືອຄືຂາຍສົ່ງ/ລູກຄ້າຫອບໄປເອງ (CAHAC…) — **ບໍ່ຄວນເປີດງານຕິດຕັ້ງໃຫ້**.
 *
 * ລະຫັດບໍລິການຕິດຕັ້ງ: 9701xx (ແອ · ເຄື່ອງໃຊ້ໄຟຟ້າ · Cassette · ຕູ້ຕັ້ງ · ໂຄງການ)
 * ແລະ 970102xx (ເຄື່ອງເຮັດນ້ຳອຸ່ນ).
 */
const INSTALL_SERVICE_ITEM = "(sv.item_code like '9701%' or sv.item_code like '970102%')";

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
    /** ຂອບເຂດຂອງ svc ຕ້ອງແຄບຄືກັບຕົວກອງຫຼັກ ບໍ່ດັ່ງນັ້ນມັນຈະດຶງບິນ 7 ປີມາທັງໝົດ */
    const svcWhere = !q
      ? `and sv.doc_date >= current_date - ${RECENT_DAYS}`
      : custCodes.length > 0
        ? `and (sv.doc_no like upper($1) || '%'
               or sv.doc_no in (select t.doc_no from ic_trans t
                                 where t.trans_flag = 44 and t.cust_code = any($2::text[])))`
        : "and sv.doc_no like upper($1) || '%'";

    const where = !q
      ? `and i.doc_date >= current_date - ${RECENT_DAYS}`
      : custCodes.length > 0
        ? "and (i.doc_no like upper($1) || '%' or a0.cust_code = any($2::text[]))"
        : "and i.doc_no like upper($1) || '%'";

    const rows = (
      await queryOdg<BillRow>(
        `with svc as (
           /**
            * ບິນທີ່ **ມີບໍລິການຕິດຕັ້ງ** — ຄິດເປັນຊຸດກ່ອນ ແລ້ວຄ່ອຍ join.
            * ໃສ່ເປັນ exists ຕໍ່ແຖວ = 1.6-5.0 ວິນາທີ · ເປັນ CTE ແບບນີ້ = 0.3-0.5 ວິນາທີ.
            */
           select distinct sv.doc_no
             from ic_trans_detail sv
            where sv.trans_flag = 44 and ${INSTALL_SERVICE_ITEM}
              ${svcWhere}
         ),
         candidate as (
           -- ② ຄັດຜູ້ສະໝັກກ່ອນ ດ້ວຍ ic_trans_detail (ມີ index ຢູ່ doc_date)
           select i.doc_no, i.doc_date, i.item_code, i.item_name, i.qty
             from ic_trans_detail i
             join svc on svc.doc_no = i.doc_no
             join ic_inventory inv on inv.code = i.item_code
             ${custCodes.length > 0 ? "join ic_trans a0 on a0.doc_no = i.doc_no and a0.trans_flag = 44" : ""}
            where i.trans_flag = 44
              and ${INSTALLABLE_GROUPS}
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
         ),
         lines as (
           -- ⑤ ແຖວລາຍການ ພ້ອມຂໍ້ມູນທີ່ດຶງຈາກ ERP
           select k.doc_no, k.doc_date, k.item_code, k.item_name, k.qty::float as qty,
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
               * ISN — ⚠️ ຂອງແອຢູ່ **ອົງປະກອບຂອງຊຸດ** ບໍ່ແມ່ນຢູ່ແຖວ [SET]
               * (ບິນ CAK26008714: [SET] ບໍ່ມີ ISN ແຕ່ [C]/[H] ມີ) ⇒ ແຕກຊຸດຜ່ານ
               * ic_inventory_set_detail ກ່ອນ ບໍ່ດັ່ງນັ້ນແອທຸກຊຸດຈະບໍ່ມີ ISN ໃຫ້ເລືອກ.
               */
              coalesce((
                select json_agg(json_build_object(
                         'isn', x.isn, 'sn', x.sn,
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
             join ic_inventory inv on inv.code = k.item_code
             left join ic_category cat on cat.code = inv.item_category
             left join ic_size siz on siz.code = inv.item_size
         )
         /**
          * ⑥ **1 ບິນ = 1 ແຖວ** (ບໍ່ແມ່ນ 1 ລາຍການ = 1 ແຖວ ຄືເກົ່າ).
          * ບິນນຶ່ງອາດຂາຍແອ 2 ຊຸດ ຫຼື ຫຼາຍລາຍການ ⇒ ຄົນເລືອກ **ບິນ** ກ່ອນ
          * ແລ້ວຄ່ອຍກຳນົດວ່າຈະຕິດຕັ້ງລາຍການໃດ ຈັກໜ່ວຍ (ຢູ່ຟອມ).
          */
         select to_char(l.doc_date,'dd/mm/yyyy') as doc_date,
            to_char(l.doc_date,'YYYY-MM-DD') as doc_date_raw,
            l.doc_no,
            case when ar.telephone is not null then ar.telephone else ar2.name_1 end as cust_name,
            case when ar.telephone is not null then ar.mobile else ar2.telephone end as telephone,
            case when ar.telephone is not null then ar.address else ar2.address end as address,
            case when ar.telephone is not null then ar.name else ar2.code end as cust_code,
            /**
             * ບໍລິການຕິດຕັ້ງທີ່ **ພະນັກງານຂາຍເພີ່ມເຂົ້າບິນ** — ຈຳນວນນີ້ຄືຈຳນວນງານທີ່
             * ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ (ຂໍ້ມູນຈິງ: ຕົງກັບຈຳນວນເຄື່ອງພໍດີ —
             * CAK25010452 ຂາຍແອ 21+2 ໜ່ວຍ ⇒ ຄ່າຕິດຕັ້ງ ×21 ແລະ ×2).
             * ⇒ ໃຊ້ເປັນຄ່າຕັ້ງຕົ້ນຂອງ "ຈະຕິດຕັ້ງຈັກໜ່ວຍ" ແລະ ເປັນຫຼັກຖານໃຫ້ CS ເຫັນ.
             */
            (select coalesce(json_agg(json_build_object(
                      'item_code', sv2.item_code, 'item_name', sv2.item_name, 'qty', sv2.qty::float)
                      order by sv2.item_code), '[]'::json)
               from ic_trans_detail sv2
              where sv2.doc_no = l.doc_no and sv2.trans_flag = 44
                and (sv2.item_code like '9701%' or sv2.item_code like '970102%')) as services,
            json_agg(json_build_object(
              'item_code', l.item_code, 'item_name', l.item_name, 'qty', l.qty,
              'sv_type', l.sv_type, 'item_brand', l.item_brand,
              'pro_type', l.pro_type, 'pro_type_name', l.pro_type_name, 'pro_size', l.pro_size,
              'serials', l.serials) order by l.item_name) as items
          from lines l
          join ic_trans a on a.doc_no = l.doc_no and a.trans_flag = 44
          left join ar_contactor ar on ar.ar_code = a.cust_code and ar.name = a.contactor
          left join ar_customer ar2 on ar2.code = a.cust_code
         group by l.doc_no, l.doc_date, ar.telephone, ar.mobile, ar.address, ar.name, ar2.name_1, ar2.telephone, ar2.address, ar2.code
         order by l.doc_date desc, l.doc_no desc`,
        !q ? [] : custCodes.length > 0 ? [q, custCodes] : [q],
      )
    ).rows;

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("bill search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
