-- One claim of each type per repair job. Empty job references remain allowed.
create unique index if not exists ods_claim_type_ref_job_uq
  on ods_claim (claim_type, ref_job)
  where nullif(trim(ref_job), '') is not null;

-- Claim lines cannot outlive their parent claim.
alter table ods_claim_item
  drop constraint if exists ods_claim_item_claim_no_fkey;
alter table ods_claim_item
  add constraint ods_claim_item_claim_no_fkey
  foreign key (claim_no) references ods_claim(claim_no) on delete cascade;
