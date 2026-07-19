-- ── Cache ຄົງເຫຼືອ ສາງສ້ອມ (ສູນບໍລິການ 1104/1206) — 19-07-2026 ──
-- ERP ຄິດຍອດຕໍ່ສາງຊ້າ (browse 1338 ລາຍການ = ~25 ວິ) ⇒ ເກັບ snapshot ໄວ້ໃນ ODS,
-- ໜ້າ browse ອ່ານ cache (ໄວ). ຜູ້ໃຊ້ກົດ "ດຶງໃໝ່" ເພື່ອ refresh (~25ວິ). ບໍ່ແມ່ນຍອດ real-time.

create table if not exists ods_repair_stock_cache (
  wh_code      varchar not null,
  item_code    varchar not null,
  item_name    varchar,
  unit_code    varchar,
  qty          numeric not null default 0,
  refreshed_at timestamp not null default localtimestamp(0),
  primary key (wh_code, item_code)
);

create index if not exists idx_repair_stock_cache_name on ods_repair_stock_cache (item_name);
