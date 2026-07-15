-- ພະນັກງານຂາຍ: ເຂດຮັບຜິດຊອບ (ຕາມ ແຂວງ/ເມືອງ) + ເກັບ ແຂວງ/ເມືອງ ໃສ່ຄຳແຈ້ງສ້ອມ
--
-- ເປັນຫຍັງ:
--   1. role ໃໝ່ 'sales' ຕິດຕາມງານສ້ອມ **ຕາມເຂດ** ⇒ ຕ້ອງມີ mapping ພະນັກງານ→ແຂວງ/ເມືອງ.
--      ນິຍາມເຂດອ້າງອີງ ar_customer.provine / ar_customer.city (FK province/city ຂອງ ODS).
--   2. ຟອມແຈ້ງສ້ອມ (ລູກຄ້າ/ພະນັກງານຂາຍ) ເກັບ ແຂວງ/ເມືອງ ຂອງລູກຄ້າ ⇒ ພໍ CS ແປງເປັນ
--      ໃບຮັບເຄື່ອງ ຂໍ້ມູນນັ້ນຕົກໄປໃສ່ ar_customer ⇒ ງານໂຜ່ຢູ່ເຂດທີ່ຖືກຕ້ອງ.
-- ການປ່ຽນແປງເປັນການ **ເພີ່ມຢ່າງດຽວ** ⇒ ລະບົບເກົ່າ (ods/Flask) ຍັງແລ່ນຄຽງຄູ່ໄດ້.

-- ── ເຂດຮັບຜິດຊອບຂອງພະນັກງານຂາຍ ─────────────────────────────────────
create table if not exists ods_sales_zone (
  employee_code varchar(32)  not null,      -- odg_employee.employee_code (ຄືກັບ ods_employee_role)
  provine       varchar(32)  not null,      -- ຕົງກັບ ar_customer.provine (ສະກົດຕາມ ERP — ຫ້າມແກ້)
  city          varchar(32),                -- null = ຮັບຜິດຊອບທັງແຂວງ
  created_by    varchar(100) not null,
  created_at    timestamp without time zone not null default localtimestamp(0),
  -- coalesce ໃນ PK ຈຶ່ງ "ທັງແຂວງ" (city=null) ບໍ່ຊ້ຳກັບ "ລະດັບເມືອງ" ແລະ ກັນແຖວຊ້ຳ
  constraint ods_sales_zone_pk primary key (employee_code, provine, city),
  constraint ods_sales_zone_city_ck check (city is null or city <> '')
);
create index if not exists ods_sales_zone_emp_idx on ods_sales_zone (employee_code);

-- ── ແຂວງ/ເມືອງ ຂອງລູກຄ້າ ໃນຄຳແຈ້ງສ້ອມ ───────────────────────────────
-- ຄຳແຈ້ງເກັບຊື່/ເບີ/ອາການ ແຕ່ບໍ່ເຄີຍເກັບບ່ອນຢູ່ເປັນລະຫັດ ⇒ ເພີ່ມ 2 ຄໍລຳ.
alter table tb_product_notice add column if not exists provine varchar(32);
alter table tb_product_notice add column if not exists city    varchar(32);

comment on table ods_sales_zone is
  'Sales staff responsible zones by province/city. Drives /sales/jobs tracking filter.';
