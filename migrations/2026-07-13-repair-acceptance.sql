-- ການຮັບງານສ້ອມຂອງຊ່າງ — ໃຫ້ workflow ກົງກັບງານຕິດຕັ້ງ
-- null = ຍັງບໍ່ຮັບ; timestamp = ຮັບແລ້ວ.
begin;

alter table tb_product
  add column if not exists repair_confirm timestamp;

comment on column tb_product.repair_confirm is
  'ເວລາທີ່ຊ່າງກົດຮັບງານສ້ອມ; ຕ້ອງມີກ່ອນ check-in/ກວດເຊັກ';

commit;
