-- ຕັ້ງຄ່າ: ຫຍີ່ຫໍ້ໃด ເກັບເງินค่าสอมกับ supplier ໃด (auto). งานยี่ห้อนี้ ส่งคืนแล้ว → candidate CLM-C.
create table if not exists ods_claim_brand (
  brand_code varchar(30) primary key,
  supplier_code varchar(30),
  active boolean not null default true,
  note varchar(200),
  created_by varchar(50), created_at timestamp default now()
);
