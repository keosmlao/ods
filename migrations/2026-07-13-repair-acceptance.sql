-- ການຮັບງານສ້ອມຂອງຊ່າງ — ໃຫ້ workflow ກົງກັບງານຕິດຕັ້ງ
-- null = ຍັງບໍ່ຮັບ; timestamp = ຮັບແລ້ວ.
begin;

alter table tb_product
  add column if not exists repair_confirm timestamp;

comment on column tb_product.repair_confirm is
  'ເວລາທີ່ຊ່າງກົດຮັບງານສ້ອມ; ຕ້ອງມີກ່ອນ check-in/ກວດເຊັກ';

-- ວຽກເກົ່າທີ່ເລີ່ມກວດ/ສ້ອມໄປແລ້ວ ຖືວ່າຮັບແລ້ວຕາມຄວາມຈິງ.
-- ຖ້າບໍ່ backfill ປຸ່ມຈະບອກໃຫ້ຮັບ ແຕ່ state ເກົ່າບໍ່ຢູ່ຂັ້ນ 1 ແລ້ວ.
update tb_product
   set repair_confirm = coalesce(time_check, time_register, localtimestamp(0))
 where repair_confirm is null
   and nullif(trim(emp_code),'') is not null
   and (
     time_check is not null or time_finish_check is not null or
     qt_start is not null or qt_finish is not null or
     spare_reg is not null or spare_finish is not null or
     time_repair is not null or time_finish_repair is not null
   );

commit;
