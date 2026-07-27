alter table tb_product add column if not exists claim_scope varchar(12);
alter table tb_product add column if not exists claim_part_code varchar(50);
alter table tb_product add column if not exists claim_part_name varchar(255);
alter table tb_product add column if not exists claim_part_sn varchar(100);
alter table tb_product add column if not exists claim_part_qty numeric(18,2);
alter table tb_product drop constraint if exists tb_product_claim_scope_check;
alter table tb_product add constraint tb_product_claim_scope_check
  check (claim_scope is null or claim_scope in ('whole','part'));

alter table ods_claim add column if not exists claim_scope varchar(12);
alter table ods_claim drop constraint if exists ods_claim_scope_check;
alter table ods_claim add constraint ods_claim_scope_check
  check (claim_scope is null or claim_scope in ('whole','part'));
