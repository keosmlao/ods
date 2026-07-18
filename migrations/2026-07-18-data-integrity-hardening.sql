-- Repair-service data integrity hardening.
-- Additive/auditable: no legacy row is deleted or renamed by this migration.

begin;

create table if not exists ods_data_quality_issue (
  issue_type  varchar(60) not null,
  record_key  varchar(120) not null,
  detail      jsonb not null,
  detected_at timestamp not null default localtimestamp(0),
  resolved_at timestamp,
  primary key (issue_type, record_key)
);

-- Preserve evidence before backfilling completed, non-cancelled repair jobs that
-- pre-date the enforced QC gate. This makes the correction reversible/auditable.
insert into ods_data_quality_issue(issue_type, record_key, detail)
select 'returned_without_qc', a.code,
       jsonb_build_object(
         'status', a.status,
         'time_finish_repair', a.time_finish_repair,
         'return_complete', a.return_complete,
         'repair_rows', (select count(*) from tb_product x where x.code=a.code)
       )
  from tb_product a
 where a.status <> 6
   and a.return_complete is not null
   and a.time_finish_repair is not null
   and a.qc_finish is null
on conflict (issue_type, record_key) do nothing;

update tb_product a
   set qc_finish = a.time_finish_repair,
       qc_by = '(backfill 2026-07-18)'
 where a.status <> 6
   and a.return_complete is not null
   and a.time_finish_repair is not null
   and a.qc_finish is null
   -- Do not update an ambiguous legacy code until it is manually separated.
   and (select count(*) from tb_product x where x.code=a.code) = 1;

-- Record legacy duplicates and orphan spare rows for controlled cleanup. They
-- remain untouched because their correct owner cannot be inferred safely.
insert into ods_data_quality_issue(issue_type, record_key, detail)
select 'duplicate_repair_code', code,
       jsonb_build_object('rows', count(*), 'oldest', min(time_register), 'newest', max(time_register))
  from tb_product
 group by code
having count(*) > 1
on conflict (issue_type, record_key) do update
set detail=excluded.detail, detected_at=localtimestamp(0), resolved_at=null;

insert into ods_data_quality_issue(issue_type, record_key, detail)
select 'orphan_spare', s.roworder::text,
       jsonb_build_object('product_code', s.product_code, 'item_code', s.item_code, 'qty', s.qty)
  from tb_used_spare s
  left join tb_product p on p.code=s.product_code
  left join ods_tb_install i on i.code=s.product_code
 where p.code is null and i.code is null
on conflict (issue_type, record_key) do nothing;

-- Existing duplicate codes are retained, but new duplicates are rejected even
-- before the legacy duplicate can be manually separated and a UNIQUE index added.
create or replace function ods_guard_unique_repair_code() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from tb_product where code=new.code) then
    raise exception 'duplicate repair code: %', new.code using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists ods_guard_unique_repair_code on tb_product;
create trigger ods_guard_unique_repair_code
before insert on tb_product
for each row execute function ods_guard_unique_repair_code();

commit;

-- Rollback notes:
-- drop trigger if exists ods_guard_unique_repair_code on tb_product;
-- drop function if exists ods_guard_unique_repair_code();
-- update tb_product p set qc_finish=null, qc_by=null
--  from ods_data_quality_issue i
--  where i.issue_type='returned_without_qc' and i.record_key=p.code
--    and p.qc_by='(backfill 2026-07-18)';
