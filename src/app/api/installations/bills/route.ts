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
  /**
   * ເລກ **ໃບຄ່າຕິດຕັ້ງທີ່ອອກແຍກ** ຊຶ່ງ remark ອ້າງເຖິງບິນນີ້ (ເຊັ່ນ CAK26009338 →
   * "ຕິດຕັ່ງຂອງບິນ CAK26009256"). null/undefined = ຄ່າຕິດຕັ້ງຢູ່ໃນບິນດຽວກັນ ຄືປົກກະຕິ.
   */
  service_doc_no?: string | null;
  /**
   * ສະຖານະການສົ່ງເຄື່ອງຈາກລະບົບຂົນສົ່ງ (bill_tracking_tms) — ຄ່າຈິງຈາກ ERP:
   * `ສົ່ງແລ້ວ` ຫຼື `ຄ້າງສົ່ງ` · null = ບິນນີ້ບໍ່ຢູ່ໃນລະບົບຂົນສົ່ງ (ລູກຄ້າຫອບເອງ).
   * CS ຕ້ອງເຫັນກ່ອນເປີດງານ — ສົ່ງເຄື່ອງບໍ່ທັນ ຊ່າງໄປຮອດກໍ່ຕິດຕັ້ງບໍ່ໄດ້.
   */
  ship_status: string | null;
  ship_date: string | null;
  /**
   * ພິກັດລູກຄ້າ — **ບ່ອນທີ່ຂົນສົ່ງໄປສົ່ງເຄື່ອງຈິງ** (odg_tms_detail) ຖ້າມີ,
   * ບໍ່ດັ່ງນັ້ນຕົກໄປໃຊ້ພິກັດໃນທະບຽນລູກຄ້າ (ar_customer_detail).
   * ບ່ອນສົ່ງເຄື່ອງ = ບ່ອນທີ່ຊ່າງຕ້ອງໄປຕິດຕັ້ງ ⇒ ໜ້າເຊື່ອຖືກວ່າທະບຽນ.
   */
  cust_lat: number | null;
  cust_lng: number | null;
  /** ພິກັດນີ້ມາຈາກໃສ — ໃຫ້ໜ້າຈໍບອກຜູ້ໃຊ້ໄດ້ວ່າເຊື່ອໄດ້ຫຼາຍປານໃດ */
  loc_source: "delivery" | "customer" | null;
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
 *
 * ⚠️ ເພີ່ມກຸ່ມ **13** (28-07-2026): ບິນ CAK26009268 ຂາຍ ຈັກຊັກ HITACHI WM-P350XX2
 * ລະຫັດ `130104-0343` ພ້ອມຄ່າຕິດຕັ້ງ 970101-0013 ແຕ່ **ບິນທັງໃບບໍ່ຂຶ້ນມາໃນການຄົ້ນຫາ**
 * ເພາະ 13 ບໍ່ຢູ່ໃນລາຍການນີ້ ⇒ candidate ຫວ່າງ ⇒ CS ເປີດງານໃຫ້ບໍ່ໄດ້ເລີຍ.
 */
const INSTALLABLE_GROUPS =
  "(i.item_code like '11%' or i.item_code like '12%' or i.item_code like '13%')";

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

    /**
     * SQL ອັນດຽວ ໃຊ້ **2 ຮອບ**: ຮອບປົກກະຕິ (ບິນທີ່ມີບໍລິການຕິດຕັ້ງໃນໃບດຽວກັນ)
     * ແລະ ຮອບ fallback (ບິນເຄື່ອງທີ່ຖືກໃບຄ່າຕິດຕັ້ງອ້າງເຖິງ — ເບິ່ງ linkedBills ລຸ່ມນີ້).
     */
    const billsSql = (svcCte: string, custJoin: string, whereClause: string) =>
        `with svc as (
           ${svcCte}
         ),
         candidate as (
           -- ② ຄັດຜູ້ສະໝັກກ່ອນ ດ້ວຍ ic_trans_detail (ມີ index ຢູ່ doc_date)
           select i.doc_no, i.doc_date, i.item_code, i.item_name, i.qty
             from ic_trans_detail i
             join svc on svc.doc_no = i.doc_no
             join ic_inventory inv on inv.code = i.item_code
             ${custJoin}
            where i.trans_flag = 44
              and ${INSTALLABLE_GROUPS}
              and i.item_type in (0,1,3)
              and i.item_name not ilike '%[H]%'   -- ແອ: ຕັດໜ່ວຍນອກສະເໝີ
              ${whereClause}
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
            -- ພິກັດ 0,0 ໃນ ERP = "ຍັງບໍ່ໄດ້ປັກ" ບໍ່ແມ່ນກາງມະຫາສະໝຸດ ⇒ ຖືເປັນ null
            nullif(acd.latitude, 0) as cust_lat,
            nullif(acd.longitude, 0) as cust_lng,
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
          left join ar_customer_detail acd on acd.ar_code = a.cust_code
         group by l.doc_no, l.doc_date, ar.telephone, ar.mobile, ar.address, ar.name, ar2.name_1, ar2.telephone, ar2.address, ar2.code,
                  acd.latitude, acd.longitude
         order by l.doc_date desc, l.doc_no desc`;

    const rows = (
      await queryOdg<BillRow>(
        billsSql(
          /**
           * ບິນທີ່ **ມີບໍລິການຕິດຕັ້ງ** — ຄິດເປັນຊຸດກ່ອນ ແລ້ວຄ່ອຍ join.
           * ໃສ່ເປັນ exists ຕໍ່ແຖວ = 1.6-5.0 ວິນາທີ · ເປັນ CTE ແບບນີ້ = 0.3-0.5 ວິນາທີ.
           */
          `select distinct sv.doc_no
             from ic_trans_detail sv
            where sv.trans_flag = 44 and ${INSTALL_SERVICE_ITEM}
              ${svcWhere}`,
          custCodes.length > 0
            ? "join ic_trans a0 on a0.doc_no = i.doc_no and a0.trans_flag = 44"
            : "",
          where,
        ),
        !q ? [] : custCodes.length > 0 ? [q, custCodes] : [q],
      )
    ).rows;

    /**
     * ── ບິນຄ່າຕິດຕັ້ງທີ່ອອກ **ແຍກໃບ** ──
     * ຮ້ານອອກໃບຄ່າຕິດຕັ້ງເປັນອີກໃບ (ຍອດ 0 ຫຼື ເກັບເງິນຕ່າງຫາກ) ແລ້ວອ້າງບິນເຄື່ອງໄວ້ໃນ
     * `remark` — ເຊັ່ນ CAK26009338 remark = "ຕິດຕັ່ງຂອງບິນ CAK26009256" (ຕູ້ແຊ່ຢູ່ບິນນັ້ນ).
     * ⇒ ທັງສອງໃບຕົກເກນຫຼັກ: ໃບຄ່າຕິດຕັ້ງບໍ່ມີເຄື່ອງ · ໃບເຄື່ອງບໍ່ມີບໍລິການຕິດຕັ້ງ
     * ⇒ CS ເປີດງານບໍ່ໄດ້ເລີຍ (90 ມື້: 3 ບິນຂາຍປົກກະຕິ + ໃບບໍລິການ CAKSV/INKSV ອີກ 27).
     *
     * ວິທີແກ້: ຖ້າຄົ້ນເລກບິນແລ້ວບໍ່ພົບ → ອ່ານເລກບິນທີ່ຢູ່ໃນ remark ແລ້ວດຶງ **ບິນເຄື່ອງ**
     * ນັ້ນມາສະແດງແທນ ພ້ອມຕິດປ້າຍວ່າຄ່າຕິດຕັ້ງມາຈາກໃບໃດ (`service_doc_no`).
     * ບໍ່ບັງຄັບວ່າຕ້ອງເປັນລູກຄ້າຄົນດຽວກັນ — ຂໍ້ມູນຈິງ 2/6 ໃບ ບິນເຄື່ອງເປັນລະຫັດ walk-in.
     */
    if (q && rows.length === 0) {
      const linked = (
        await queryOdg<{ doc_no: string; ref_doc: string }>(
          `select t.doc_no, (regexp_matches(upper(t.remark), '([A-Z]{2,6}[0-9]{6,})'))[1] as ref_doc
             from ic_trans t
            where t.trans_flag = 44
              and t.doc_no like upper($1) || '%'
              and upper(t.remark) ~ '[A-Z]{2,6}[0-9]{6,}'
              and exists (select 1 from ic_trans_detail sv
                           where sv.doc_no = t.doc_no and sv.trans_flag = 44 and ${INSTALL_SERVICE_ITEM})
            limit 5`,
          [q],
        )
      ).rows.filter((row) => row.ref_doc && row.ref_doc !== row.doc_no);

      if (linked.length > 0) {
        const serviceOf = new Map(linked.map((row) => [row.ref_doc, row.doc_no]));
        const refDocs = [...serviceOf.keys()];
        const refRows = (
          await queryOdg<BillRow>(
            // svc CTE ຮອບນີ້ = "ບິນທີ່ຖືກອ້າງ" (ບໍ່ຮຽກຮ້ອງໃຫ້ມີແຖວບໍລິການໃນໃບ)
            billsSql(
              `select distinct sv.doc_no from ic_trans_detail sv
                where sv.trans_flag = 44 and sv.doc_no = any($1::text[])`,
              "",
              "and i.doc_no = any($1::text[])",
            ),
            [refDocs],
          )
        ).rows;

        // ຄ່າຕິດຕັ້ງຢູ່ໃບອື່ນ ⇒ ດຶງແຖວບໍລິການຈາກໃບນັ້ນມາໃສ່ ບໍ່ດັ່ງນັ້ນບັດຈະຂຶ້ນ "ຄ່າຕິດຕັ້ງ 0"
        const services = (
          await queryOdg<{ doc_no: string; item_code: string; item_name: string; qty: number }>(
            `select sv.doc_no, sv.item_code, sv.item_name, sv.qty::float8 as qty
               from ic_trans_detail sv
              where sv.trans_flag = 44 and ${INSTALL_SERVICE_ITEM}
                and sv.doc_no = any($1::text[])
              order by sv.item_code`,
            [linked.map((row) => row.doc_no)],
          )
        ).rows;

        for (const row of refRows) {
          const serviceDoc = serviceOf.get(row.doc_no) ?? null;
          row.service_doc_no = serviceDoc;
          row.services = services
            .filter((service) => service.doc_no === serviceDoc)
            .map(({ item_code, item_name, qty }) => ({ item_code, item_name, qty }));
        }
        rows.push(...refRows);
      }
    }

    /**
     * ສະຖານະການສົ່ງ — **query ນ້ອຍແຍກຕ່າງຫາກ ຢ່າຍັດເຂົ້າ query ຫຼັກ**.
     * bill_tracking_tms (54k ແຖວ) ບໍ່ມີ index ຢູ່ doc_no. ຕອນເອົາໄປໃສ່ເປັນ CTE
     * ໃນ query ຫຼັກ ວັດໄດ້ **221ms → 1168ms** (ຊ້າລົງ 5 ເທົ່າ) ເພາະ planner
     * ໄປແກວ່ງແຜນຂອງທັງ query. ດຶງແຍກດ້ວຍລາຍການ doc_no ທີ່ຄັດແລ້ວ = ~40ms.
     */
    if (rows.length > 0) {
      const docs = rows.map((row) => row.doc_no);
      const ship = (
        await queryOdg<{ doc_no: string; status_ship: string | null; ship_date: string | null }>(
          `select distinct on (doc_no) doc_no, status_ship, to_char(ship_date,'dd/mm/yyyy') as ship_date
             from bill_tracking_tms
            where doc_no = any($1::text[])
            order by doc_no, ship_date desc nulls last`,
          [docs],
        )
      ).rows;
      const byDoc = new Map(ship.map((row) => [row.doc_no, row]));

      /**
       * ພິກັດ**ຈຸດສົ່ງຈິງ**ຈາກລະບົບຂົນສົ່ງ — ນີ້ຄືບ່ອນທີ່ຄົນສົ່ງເຄື່ອງໄປຮອດຈິງ
       * ⇒ ຊ່າງຕິດຕັ້ງກໍ່ຕ້ອງໄປບ່ອນນັ້ນ. ດີກວ່າພິກັດໃນທະບຽນລູກຄ້າ (ມີພຽງ 251/20,788).
       *
       * · `lat`/`lng` ເປັນ **varchar** — ຫວ່າງ ຫຼື '0' = ຍັງບໍ່ໄດ້ປັກ
       * · 1 ບິນ ມີໄດ້ຫຼາຍແຖວ (2,627 ບິນ) ⇒ distinct on ເອົາແຖວ status=1 (ສົ່ງສຳເລັດ) ກ່ອນ
       * · ມີ index ຢູ່ bill_no ⇒ ~10ms
       */
      const delivered = (
        await queryOdg<{ bill_no: string; lat: string; lng: string }>(
          `select distinct on (bill_no) bill_no, lat, lng
             from odg_tms_detail
            where bill_no = any($1::text[])
              and coalesce(lat,'') not in ('','0') and coalesce(lng,'') not in ('','0')
            order by bill_no, (status = 1) desc, sent_end desc nulls last`,
          [docs],
        )
      ).rows;
      const geoByDoc = new Map(delivered.map((row) => [row.bill_no, row]));

      for (const row of rows) {
        const found = byDoc.get(row.doc_no);
        row.ship_status = found?.status_ship ?? null;
        row.ship_date = found?.ship_date ?? null;

        const drop = geoByDoc.get(row.doc_no);
        const lat = Number(drop?.lat);
        const lng = Number(drop?.lng);
        if (drop && Number.isFinite(lat) && Number.isFinite(lng)) {
          row.cust_lat = lat;
          row.cust_lng = lng;
          row.loc_source = "delivery";
        } else {
          row.loc_source = row.cust_lat != null && row.cust_lng != null ? "customer" : null;
        }
      }
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("bill search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
