-- ══════════════════════════════════════════════════════════════════════════════
--  ຕິດຕັ້ງ: ສາງເບີກແລ້ວ = ຜ່ານ — ປົດວຽກທີ່ຄ້າງລໍ "ຊ່າງກົດຮັບ"
-- ══════════════════════════════════════════════════════════════════════════════
--  ຢືນຢັນ 04-08-2026. ຫຼັກຖານ: ໃບສາງເບີກ (SWC) 2,508 ໃບບໍ່ເຄີຍມີໃບຮັບ (PISP)
--  — 2,441 ໃບ (97%) ວຽກເລີ່ມໄປແລ້ວ ⇒ ຂັ້ນນັ້ນບໍ່ໄດ້ຖືກໃຊ້ຈິງ ພຽງແຕ່ກັກວຽກ.
--
--  ໂຄດປ່ຽນແລ້ວ (lib/erp-dispatch: ເບີກຄົບ ⇒ ຕື່ມ pick_finish ພ້ອມ reg_finish)
--  ໄຟລ໌ນີ້ເອົາກົດເກນໃໝ່ໄປໃສ່ວຽກເກົ່າທີ່ຄ້າງຢູ່ກ່ອນແກ້ໂຄດ.
--
--  ⚠️ ບໍ່ສ້າງໃບ PISP ຍ້ອນຫຼັງ — ບໍ່ແຕະບັນຊີສາງ. ຕື່ມແຕ່ວັນທີ່ໃນ ods_tb_install.
--
--  ຍ້ອນກັບ: update ods.ods_tb_install set pick_finish = null
--             where code in (select code from ods.fix_install_pick_20260804);
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists ods.fix_install_pick_20260804 (
  code varchar primary key,
  set_to timestamp,
  fixed_at timestamp default now()
);

insert into ods.fix_install_pick_20260804 (code, set_to)
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
