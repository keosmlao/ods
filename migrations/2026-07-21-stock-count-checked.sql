-- "ເຊັກແລ້ວ" (verified) — ຂັ້ນທີ 2 ຫຼັງ "ນັບພົບ": ຢືນຢັນຊ້ຳວ່າກວດແລ້ວ
-- checked_at null = ນັບແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ເຊັກຢືນຢັນ. ເພີ່ມແບບ idempotent.
alter table ods_stock_count add column if not exists checked_at timestamp;
alter table ods_stock_count add column if not exists checked_by varchar;
