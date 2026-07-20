-- ກວດນັບສະຕັອກ: ບັນທຶກ "ນັບແລ້ວ" ລົງ DB (ແທນ localStorage) ⇒ ແບ່ງກັນຫຼາຍຄົນ/ເຄື່ອງ + ເຮັດລາຍງານໄດ້.
-- 1 ແຖວ = 1 ເຄື່ອງທີ່ນັບພົບ (ຕົວຕໍ່ຕົວ). ໝາຍ = insert · ຍົກເລີກ = delete · ລ້າງ = truncate.
-- add-only, idempotent. ບໍ່ແຕະ tb_product/ERP.
create table if not exists ods_stock_count (
  job_code    varchar(30) primary key,
  counted_at  timestamp not null default now(),
  counted_by  varchar(50)
);
