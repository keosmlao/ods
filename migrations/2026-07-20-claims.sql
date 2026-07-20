-- ລະບົບເຄມ (Claim) Phase 1 — CLM-A (supplier) / CLM-B (ຮ້ານ, ຈົບຢູ່ສູນ) / CLM-C (ເກັບເງິນ, phase ຕໍ່).
-- ບໍ່ແຕະ ERP — ຕາຕะລาง ods_* (supplier_code→ap_supplier, brand_code→ic_brand ໃນ ERP).
create table if not exists ods_claim (
  id serial primary key,
  claim_no varchar(30) unique,
  claim_type char(1) not null,            -- A=supplier-part, B=shop-in, C=reimburse
  supplier_code varchar(30), brand_code varchar(30), customer_code varchar(30),
  ref_job varchar(30), erp_doc_no varchar(30),
  status varchar(24) not null default 'draft',
  reason text, amount numeric(18,2) default 0,
  created_by varchar(50), created_at timestamp default now(),
  sent_at timestamp, result_at timestamp, closed_at timestamp, remark text
);
create table if not exists ods_claim_item (
  id serial primary key, claim_no varchar(30) not null,
  item_code varchar(30), item_name varchar(200),
  qty numeric(18,2) default 1, unit varchar(20), amount numeric(18,2) default 0, note varchar(200)
);
create table if not exists ods_claim_log (
  id serial primary key, claim_no varchar(30) not null,
  at timestamp default now(), by_user varchar(50), event varchar(40), detail text
);
create index if not exists ods_claim_type_status on ods_claim(claim_type, status);
