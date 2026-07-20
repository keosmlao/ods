-- IH (ໄປສ້ອມບ້ານລູກຄ້າ): ວັນນັດ "ໄປສ້ອມ ຮອບ 2" — ຫຼັງລູກຄ້າຕົກລົງລາຄາ.
-- ແຍກຈາກ appoint_date (ຮອບ 1 = ໄປກວດເຊັກ) ເພື່ອບໍ່ໃຫ້ທັບກັນ ແລະ ຮັກສາປະຫວັດ 2 ຮອບ.
-- add-only, idempotent — ບໍ່ແຕະຂໍ້ມູນເກົ່າ.
alter table tb_product add column if not exists repair_appoint_date date;
comment on column tb_product.repair_appoint_date is
  'IH: ວັນນັດໄປສ້ອມ ຮອບ 2 (ຫຼັງອະນຸມັດລາຄາ). appoint_date = ຮອບ 1 ໄປກວດ.';
