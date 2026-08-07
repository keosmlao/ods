-- ═══════════════════════════════════════════════════════════════════════════
-- **ຕື່ມ ISN/SN ຄືນໃຫ້ໃບງານຕິດຕັ້ງເກົ່າ ຈາກໃບຈ່າຍສິນຄ້າອອກສາງ** (07-08-2026)
--
-- ── ເປັນຫຍັງ ──
-- ໃບງານ 1 ປີຫຼັງ **2,559 ໃບ ຂາດ ISN/SN** (ຫວ່າງ ຫຼື ໃສ່ "-") ⇒ ຮັບປະກັນ/ສ້ອມ
-- ພາຍຫຼັງອ້າງອີງບໍ່ໄດ້ວ່າແມ່ນເຄື່ອງໜ່ວຍໃດ. ຄວາມຈິງມີຢູ່ແລ້ວຢູ່ ERP: ໃບຈ່າຍສິນຄ້າ
-- (`sn_trans_detail` ຂອງໃບ DPC… ທີ່ອ້າງບິນ CAK…) ບອກໄວ້ວ່າຈ່າຍໜ່ວຍໃດໃຫ້ບິນໃດ.
--
-- ── ກົດທີ່ໃຊ້ (ດຽວກັນກັບ lib/install-scan) ──
--   ① ຕື່ມສະເພາະຊ່ອງທີ່**ຫວ່າງ** ("-" ແລະ "N/A" ນັບເປັນຫວ່າງ) — ບໍ່ທັບຂອງທີ່ຄົນໃສ່ໄວ້
--   ② ໜ່ວຍທີ່ຖືກໃຊ້ໄປແລ້ວໃນໃບອື່ນ**ຂອງບິນດຽວກັນ** ບໍ່ເອົາຄືນ — ກັນເລກຊ້ຳ
--      (ຮູເກົ່າ: INST-7213 ກັບ 7214 ໄດ້ເລກອັນດຽວກັນຍ້ອນພິມມື)
--   ③ ແອ: [C] = ໜ່ວຍໃນ · [H] = ໜ່ວຍນອກ (ຜ່ານອົງປະກອບຂອງຊຸດ ic_inventory_set_detail)
--   ④ ເກັບເປັນ **SN ໂຮງງານ** ຖ້າ ERP ຮູ້ ບໍ່ດັ່ງນັ້ນເກັບ ISN — ຄືກັບຄ່າທີ່ຊ່າງຍິງເຂົ້າມາ
--
-- ── ຜົນທີ່ຄາດໄວ້ (ວັດແລ້ວ 07-08-2026) ──
--   ຕື່ມ 1,050 ຊ່ອງ · 986 ໃບງານ (ໃນນັ້ນ 484 ຊ່ອງເປັນໜ່ວຍນອກຂອງແອ)
--   ບໍ່ຍິງແຈ້ງເຕືອນ — ຂຽນລົງ chatter ຢ່າງດຽວ (1,050 × 258 ຄົນ = ຖ້ວມກ່ອງທຸກຄົນ)
--
-- ── ວິທີແລ່ນ ──
--   psql "$DATABASE_URL" -f migrations/2026-08-07-backfill-install-sn.sql
-- ແລ່ນຊ້ຳໄດ້: ຮອບສອງຈະບໍ່ຕື່ມຫຍັງອີກ ເພາະຊ່ອງບໍ່ຫວ່າງແລ້ວ.
-- ═══════════════════════════════════════════════════════════════════════════

create temporary table fill as
with job as (
  select a.code, a.doc_ref_1 bill, a.item_code,
         nullif(nullif(nullif(upper(trim(a.pro_sn)),''),'-'),'N/A') pro_sn,
         nullif(nullif(nullif(upper(trim(a.pro_sn_out)),''),'-'),'N/A') pro_sn_out
    from ods.ods_tb_install a
   where a.cancel_date is null and coalesce(a.doc_ref_1,'') <> ''
     and a.doc_ref_date >= current_date - 365
), issued as (
  select d.doc_ref bill, d.sn isn, nullif(sni.sn,'') sn,
         (d.item_name like '%[H]%') ນອກ, d.item_code
    from public.sn_trans_detail d
    left join public.sn_inventory sni on sni.isn = d.sn
   where d.trans_flag = 44 and coalesce(d.sn,'') <> ''
     and d.doc_ref in (select distinct bill from job)
), pair as (
  select j.code, j.bill, j.item_code, i.isn, i.sn, i.ນອກ
    from job j join issued i on i.bill = j.bill
   where i.item_code = j.item_code
      or i.item_code in (select sd.ic_code from public.ic_inventory_set_detail sd
                          where sd.ic_set_code = j.item_code)
), used as (
  select distinct j.bill, upper(replace(replace(v,' ',''),'-','')) val
    from job j, lateral (values (j.pro_sn), (j.pro_sn_out)) t(v) where v is not null
), free_unit as (
  select p.*, row_number() over (partition by p.bill, p.item_code, p.ນອກ order by p.isn) rn
    from (select distinct bill, item_code, isn, sn, ນອກ from pair) p
   where upper(replace(replace(p.isn,' ',''),'-','')) not in (select val from used u where u.bill = p.bill)
     and upper(replace(replace(coalesce(p.sn,'~'),' ',''),'-','')) not in (select val from used u where u.bill = p.bill)
), need as (
  select j.code, j.bill, j.item_code, false ນອກ,
         row_number() over (partition by j.bill, j.item_code order by j.code) rn
    from job j where j.pro_sn is null
   union all
  select j.code, j.bill, j.item_code, true,
         row_number() over (partition by j.bill, j.item_code order by j.code)
    from job j where j.pro_sn_out is null
)
select n.code, n.ນອກ, f.isn, coalesce(f.sn, f.isn) as ຄ່າໃໝ່
  from need n
  join free_unit f on f.bill = n.bill and f.item_code = n.item_code
                  and f.ນອກ = n.ນອກ and f.rn = n.rn;

select count(*) as ຈະຕື່ມ_ຊ່ອງ, count(distinct code) as ໃບງານ,
       count(*) filter (where ນອກ) as ໜ່ວຍນອກ from fill;

begin;

update ods.ods_tb_install a
   set pro_sn = f.ຄ່າໃໝ່, user_edit = 'ລະບົບ (ຕື່ມຈາກໃບຈ່າຍ)'
  from fill f
 where f.code = a.code and not f.ນອກ
   and nullif(nullif(nullif(upper(trim(a.pro_sn)),''),'-'),'N/A') is null;

update ods.ods_tb_install a
   set pro_sn_out = f.ຄ່າໃໝ່, user_edit = 'ລະບົບ (ຕື່ມຈາກໃບຈ່າຍ)'
  from fill f
 where f.code = a.code and f.ນອກ
   and nullif(nullif(nullif(upper(trim(a.pro_sn_out)),''),'-'),'N/A') is null;

-- ປະຫວັດຂອງແຕ່ລະໃບ — ບອກໃຫ້ຊັດວ່າ **ລະບົບ**ຕື່ມ ບໍ່ແມ່ນຄົນພິມ (ກວດຍ້ອນຫຼັງໄດ້)
insert into ods.ods_chatter_message(model, res_id, kind, body, author, created_at)
select 'ods_tb_install', f.code, 'log',
       'ຕື່ມ ' || case when f.ນອກ then 'ໜ່ວຍນອກ' else 'ໜ່ວຍໃນ' end || ': ' || f.ຄ່າໃໝ່ ||
       ' (ISN ' || f.isn || ') — ດຶງຈາກໃບຈ່າຍສິນຄ້າຂອງບິນ ໂດຍລະບົບ',
       'ລະບົບ', localtimestamp(0)
  from fill f;

commit;

-- ຢືນຢັນຫຼັງແລ່ນ
select count(*) filter (where nullif(nullif(nullif(upper(trim(pro_sn)),''),'-'),'N/A') is not null) as ມີໜ່ວຍໃນ,
       count(*) filter (where nullif(nullif(nullif(upper(trim(pro_sn_out)),''),'-'),'N/A') is not null) as ມີໜ່ວຍນອກ,
       count(*) as ໃບທີ່ແຕະ
  from ods.ods_tb_install where code in (select code from fill);
