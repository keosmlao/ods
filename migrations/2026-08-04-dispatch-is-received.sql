-- ══════════════════════════════════════════════════════════════════════════════
--  ສາງເບີກແລ້ວ = ຮັບແລ້ວ — ປົດວຽກຕິດຕັ້ງທີ່ຄ້າງລໍ "ຊ່າງກົດຮັບ"
-- ══════════════════════════════════════════════════════════════════════════════
--  ຕັດສິນໃຈ 04-08-2026: "ສາງກໍ່ໄດ້ເບີກແລ້ວ ຊ່າງບໍ່ຕ້ອງຮັບ ໃຫ້ໄປຂັ້ນຕອນຕໍ່ໄປເລີຍ"
--
--  ຫຼັກຖານ: ໃບສາງເບີກ (SWC) 2,508 ໃບ ບໍ່ເຄີຍມີໃບຮັບ (PISP)
--    ├ 2,441 ໃບ (97%) ວຽກເລີ່ມສ້ອມ/ຕິດຕັ້ງໄປແລ້ວ
--    └ 2,436 ໃບ ຈົບໄປແລ້ວ
--  ⇒ ຂັ້ນ "ຊ່າງກົດຮັບ" ບໍ່ໄດ້ຖືກໃຊ້ຈິງ ພຽງແຕ່ກັກວຽກໄວ້ໃນຄິວ
--
--  ໂຄດປ່ຽນແລ້ວ (lib/erp-dispatch: ເບີກຄົບ ⇒ ຕື່ມ pick_finish ພ້ອມ reg_finish)
--  ໄຟລ໌ນີ້ເອົາກົດເກນໃໝ່ໄປໃສ່ວຽກເກົ່າທີ່ຄ້າງຢູ່ກ່ອນແກ້ໂຄດ.
--
--  ⚠️ ບໍ່ສ້າງໃບ PISP ຍ້ອນຫຼັງ — ບໍ່ແຕະບັນຊີສາງ. ຕື່ມແຕ່ວັນທີ່ໃນ ods_tb_install
--     ເພື່ອໃຫ້ຂັ້ນຕອນເດີນຕໍ່.
--
--  ຍ້ອນກັບ: update ods.ods_tb_install set pick_finish = null
--             where code in (select code from ods.fix_pick_finish_20260804);
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists ods.fix_pick_finish_20260804 (
  code varchar primary key,
  set_to timestamp,
  fixed_at timestamp default now()
);

-- ວຽກທີ່ຍັງເປີດ · ສາງເບີກຄົບແລ້ວ (reg_finish ມີ) ແຕ່ຄ້າງລໍຊ່າງກົດຮັບ
insert into ods.fix_pick_finish_20260804 (code, set_to)
select a.code, a.reg_finish
  from ods.ods_tb_install a
 where a.cancel_date is null
   and a.job_finish is null
   and a.reg_finish is not null
   and a.pick_finish is null
on conflict (code) do nothing;

update ods.ods_tb_install a
   set pick_finish = a.reg_finish
 where a.cancel_date is null
   and a.job_finish is null
   and a.reg_finish is not null
   and a.pick_finish is null;

commit;
