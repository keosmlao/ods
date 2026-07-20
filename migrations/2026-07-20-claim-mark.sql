-- ໝາຍงาน "ເຄມເງิน supplier" ເອງ (ตอนรับ/ก่อนส่งคืน). ຫຼัງ return_complete + ໝາຍ = candidate CLM-C.
create table if not exists ods_claim_mark (
  job_code varchar(30) primary key,
  marked_by varchar(50), marked_at timestamp default now(), note varchar(200)
);
