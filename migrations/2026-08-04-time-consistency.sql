-- ══════════════════════════════════════════════════════════════════════════════
--  ຕື່ມເວລາ "ເລີ່ມ" ທີ່ຫາຍ ທັງໆທີ່ມີເວລາ "ຈົບ" ແລ້ວ
-- ══════════════════════════════════════════════════════════════════════════════
--  ວັດ 04-08-2026 (ວຽກສ້ອມ):
--    16 ວຽກ  time_finish_repair ມີ ແຕ່ time_repair ຫວ່າງ   (ຈົບໂດຍບໍ່ເຄີຍເລີ່ມ)
--     1 ວຽກ  time_finish_check  ມີ ແຕ່ time_check  ຫວ່າງ
--     3 ວຽກ  spare_finish       ມີ ແຕ່ spare_reg   ຫວ່າງ
--  (ຝັ່ງຕິດຕັ້ງກວດແລ້ວສະອາດ — finish/close ບໍ່ມີກໍລະນີແບບນີ້)
--
--  ບໍ່ກະທົບຂັ້ນ: STAGE_SQL ກວດ "ຈົບ" ກ່ອນ "ເລີ່ມ" ຢູ່ແລ້ວ ⇒ ຂັ້ນຖືກຢູ່ກ່ອນໜ້ານີ້.
--  ແຕ່ລາຍງານທີ່ຄິດໄລ່ໄລຍະເວລາ (ຈົບ − ເລີ່ມ) ຈະໄດ້ null ⇒ ຕົກຈາກການນັບ.
--  ຕື່ມໃຫ້ເທົ່າກັບເວລາ "ຈົບ" ⇒ ໄລຍະເວລາ = 0 (ບອກວ່າ "ບໍ່ຮູ້" ຢ່າງຊື່ສັດ ດີກວ່າ null ຫາຍ).
--
--  ຍ້ອນກັບໄດ້ — ຄ່າເກົ່າ (null) ບັນທຶກໄວ້ ods.fix_time_consistency_20260804
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists ods.fix_time_consistency_20260804 (
  code varchar,
  col varchar,
  set_to timestamp,
  fixed_at timestamp default now(),
  primary key (code, col)
);

insert into ods.fix_time_consistency_20260804 (code, col, set_to)
select a.code, 'time_repair', a.time_finish_repair
  from ods.tb_product a
 where coalesce(a.job_kind,'repair') = 'repair'
   and a.time_finish_repair is not null and a.time_repair is null
union all
select a.code, 'time_check', a.time_finish_check
  from ods.tb_product a
 where coalesce(a.job_kind,'repair') = 'repair'
   and a.time_finish_check is not null and a.time_check is null
union all
select a.code, 'spare_reg', a.spare_finish
  from ods.tb_product a
 where coalesce(a.job_kind,'repair') = 'repair'
   and a.spare_finish is not null and a.spare_reg is null
on conflict (code, col) do nothing;

update ods.tb_product a set time_repair = a.time_finish_repair
 where coalesce(a.job_kind,'repair') = 'repair'
   and a.time_finish_repair is not null and a.time_repair is null;

update ods.tb_product a set time_check = a.time_finish_check
 where coalesce(a.job_kind,'repair') = 'repair'
   and a.time_finish_check is not null and a.time_check is null;

update ods.tb_product a set spare_reg = a.spare_finish
 where coalesce(a.job_kind,'repair') = 'repair'
   and a.spare_finish is not null and a.spare_reg is null;

commit;
