alter table tb_product
  add column if not exists job_kind varchar(12) not null default 'repair';
alter table tb_product drop constraint if exists tb_product_job_kind_check;
alter table tb_product
  add constraint tb_product_job_kind_check check (job_kind in ('repair','claim'));
update tb_product p
   set job_kind='claim'
 where exists (
   select 1 from ods_claim c
    where c.claim_type='B' and c.ref_job=p.code
 );
create index if not exists tb_product_job_kind_time_idx
  on tb_product(job_kind, time_register desc);

alter table ods_claim
  add column if not exists fulfillment_source varchar(20);
alter table ods_claim drop constraint if exists ods_claim_fulfillment_source_check;
alter table ods_claim
  add constraint ods_claim_fulfillment_source_check
  check (fulfillment_source is null or fulfillment_source in ('stock','purchase','supplier'));
