-- ໝາຍວ່າ ສ່ງ email ໃບເຄມ ແລ້ວ (per-claim notify)
alter table ods_claim add column if not exists email_sent_at timestamp;
