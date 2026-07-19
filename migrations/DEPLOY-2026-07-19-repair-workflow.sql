-- ══════════════════════════════════════════════════════════════════════════
-- DEPLOY — Repair workflow + stock + KPI + audit (session 18–19/07/2026)
-- ══════════════════════════════════════════════════════════════════════════
-- ລວມ migration ທັງໝົດຂອງ session ນີ້ໄວ້ບ່ອນດຽວ (idempotent — run ຊ້ຳໄດ້ ບໍ່ພັງ).
-- Run ໃນ ODS database (DATABASE_URL). ບໍ່ແຕະ ERP (odg).
--
-- ຫຼັງ run ນີ້: ຕັ້ງ env CRON_KEY + cron 2 ອັນ (ເບິ່ງ DEPLOY-runbook).
-- ══════════════════════════════════════════════════════════════════════════

-- ① PS ໄປຮັບເຄື່ອງ + IH ໄປສ້ອມບ້ານ (ຂັ້ນ 0)
alter table tb_product add column if not exists pickup_at   timestamp;  -- PS: ຮັບເຂົ້າສູນ
alter table tb_product add column if not exists pickup_start timestamp;  -- PS: ອອກໄປຮັບ
alter table tb_product add column if not exists dispatch_at timestamp;   -- IH: ນັດ/ຈັດຊ່າງ

create index if not exists idx_tb_product_ps_pickup
  on tb_product (service_type, pickup_at) where service_type = 'PS';

-- ② ຕິດຕາມການເຂົ້າລະບົບ (login audit)
create table if not exists ods_login_log (
  id          bigserial primary key,
  username    varchar not null,
  source      varchar not null default 'web',
  ip          varchar,
  user_agent  varchar,
  logged_at   timestamp not null default localtimestamp(0)
);
create index if not exists idx_ods_login_log_time on ods_login_log (logged_at desc);
create index if not exists idx_ods_login_log_user on ods_login_log (username, logged_at desc);

-- ③ Cache ຄົງເຫຼືອ ສາງສ້ອມ (browse ໄວ)
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
