alter table tb_product add column if not exists claim_decision varchar(20);
alter table tb_product add column if not exists claim_decided_at timestamp;
alter table tb_product drop constraint if exists tb_product_claim_decision_check;
alter table tb_product add constraint tb_product_claim_decision_check
  check (claim_decision is null or claim_decision in ('repair','stock','purchase','supplier','rejected'));
