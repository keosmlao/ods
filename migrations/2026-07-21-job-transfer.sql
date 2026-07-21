-- ໂອນງານສ້ອມໄປສູນອື່ນ — ເປີດ job ບ່ອນນຶ່ງ ແລ້ວ ສົ່ງໄປສ້ອມສູນອື່ນ.
-- service_center = ສູນທີ່ເຄື່ອງຢູ່ປັດຈຸບັນ (null = ຍັງບໍ່ລະບຸ/ສູນຫຼັກ).
alter table tb_product add column if not exists service_center varchar;

-- ບັນທຶກການໂອນ (audit) — received_at null = ກຳລັງໂອນ (ລໍສູນປາຍທາງຮັບ).
create table if not exists ods_job_transfer (
  id           serial primary key,
  job_code     varchar not null,
  from_center  varchar,
  to_center    varchar not null,
  reason       varchar not null,
  created_by   varchar,
  created_at   timestamp not null default now(),
  received_at  timestamp,
  received_by  varchar
);
-- 1 ງານ = 1 ການໂອນທີ່ຍັງບໍ່ຮັບ
create unique index if not exists ods_job_transfer_open
  on ods_job_transfer (job_code) where received_at is null;
create index if not exists ods_job_transfer_lookup on ods_job_transfer (job_code, received_at);
