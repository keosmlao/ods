-- ══════════════════════════════════════════════════════════════════════════════
--  ວຽກສ້ອມທີ່ **ເລີ່ມສ້ອມແລ້ວ ແຕ່ບໍ່ເຄີຍມີບັນທຶກການຮັບງານ**
-- ══════════════════════════════════════════════════════════════════════════════
--  ຫຼັງລວມປຸ່ມ "ເລີ່ມສ້ອມ" ເຂົ້າກັບການກົດຮັບ (docs/repair-redesign.md) ວຽກສາມາດມີ
--  `time_repair` ໂດຍ `repair_confirm` ຍັງຫວ່າງ ⇒ ຂໍ້ມູນບອກວ່າ "ຍັງບໍ່ຮັບງານ"
--  ທັງໆທີ່ສ້ອມໄປແລ້ວ/ຈົບໄປແລ້ວ.
--
--  ວັດ 04-08-2026: 45 ວຽກ (ຈົບແລ້ວ 41 · ຍັງເປີດ 4)
--
--  ຕື່ມ `repair_confirm = time_repair` ⇒ ເວລາຮັບງານ = ເວລາທີ່ລົງມືຈິງ (ອະນຸລັກຄວາມຈິງ:
--  ຄົນຜູ້ນັ້ນລົງມືສ້ອມ ຈຶ່ງຖືວ່າຮັບງານແລ້ວ). **ບໍ່ກະທົບຂັ້ນ (stage)** ເພາະ STAGE_SQL
--  ບໍ່ໄດ້ອ່ານ repair_confirm ເລີຍ — ກະທົບແຕ່ປຸ່ມ "ຮັບງານ" ແລະ ຄິວລໍຮັບ.
--
--  ⚠️ ບໍ່ແຕະໃບ PISP (ຊ່າງເຊັນຮັບອາໄຫຼ່) — ໃບນັ້ນເປັນເອກະສານສາງ ການສ້າງຍ້ອນຫຼັງ
--  2,441 ໃບຈະກະທົບຍອດສາງ ⇒ ຕ້ອງໃຫ້ເຈົ້າຂອງລະບົບຕັດສິນແຍກ.
--
--  ຍ້ອນກັບ:  update ods.tb_product set repair_confirm = null
--              where code in (<ລາຍການທີ່ພິມອອກຕອນແລ່ນ>);
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ① ເກັບລາຍການທີ່ຈະແກ້ໄວ້ກ່ອນ (ໃຫ້ຍ້ອນກັບໄດ້)
create table if not exists ods.fix_repair_confirm_20260804 (
  code varchar primary key,
  set_to timestamp,
  fixed_at timestamp default now()
);

insert into ods.fix_repair_confirm_20260804 (code, set_to)
select a.code, a.time_repair
  from ods.tb_product a
 where coalesce(a.job_kind, 'repair') = 'repair'
   and a.repair_confirm is null
   and a.time_repair is not null
on conflict (code) do nothing;

-- ② ຕື່ມຄ່າ
update ods.tb_product a
   set repair_confirm = a.time_repair
 where coalesce(a.job_kind, 'repair') = 'repair'
   and a.repair_confirm is null
   and a.time_repair is not null;

commit;
