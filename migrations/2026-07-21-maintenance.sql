-- ລະບົບ "ສ້ອມບໍລຸງ" (maintenance) — ແຍກເປັນອີກລະບົບ ຄຽງຄູ່ ສ້ອມແປງ/ຕິດຕັ້ງ.
-- ເຊັ່ນ ລ້າງແອ · ລ້າງເຄື່ອງຊັກຜ້າ · ລ້າງຕູ້ເຢັນ. ໄປລ້າງໜ້າງານ (on-site) ເປັນຫຼັກ,
-- ໃຊ້ຊ່າງທີມດຽວກັບສ້ອມ (emp_code). ຂັ້ນຄິດຈາກ timestamp (lib/maintenance-stage STAGE_SQL).

-- ── ໃບງານສ້ອມບໍລຸງ ─────────────────────────────────────────────────
create table if not exists ods_tb_maintenance (
  code          varchar primary key,               -- ລະຫັດໃບງານ (ສ້າງໃນ actions/maintenance)
  cust_code     varchar,                            -- ລູກຄ້າ ERP (null = walk-in)
  cust_name     varchar,                            -- ຊື່ລູກຄ້າ (denormalize ສຳລັບ walk-in)
  cust_tel      varchar,                            -- ເບີໂທ
  location      varchar,                            -- ທີ່ຢູ່ໜ້າງານ (on-site)
  emp_code      varchar,                            -- ຊ່າງ (ທີມດຽວກັບສ້ອມ)
  appoint_date  timestamp,                          -- ວັນນັດ
  remark        varchar,
  total         numeric default 0,                  -- ລວມຄ່າບໍລິການ (ຈາກ detail)
  status        int default 0,                      -- ສຳຮອງ (0 = ປົກກະຕິ)
  next_due      date,                               -- ຮອບບໍລຸງຄັ້ງໜ້າ (ໃສ່ແຈ້ງເຕືອນໄດ້ພາຍຫຼັງ)
  -- ── ຖັນເວລາທີ່ຂັບຂັ້ນ (STAGE_SQL) ──
  time_register timestamp not null default now(),   -- ເປີດງານ
  tech_confirm  timestamp,                          -- ຊ່າງຮັບງານ
  start_clean   timestamp,                          -- ເລີ່ມລ້າງ (ໜ້າງານ)
  finish_clean  timestamp,                          -- ລ້າງສຳເລັດ
  qc_finish     timestamp,                          -- ຜ່ານ QC
  paid_at       timestamp,                          -- ເກັບເງິນແລ້ວ
  job_finish    timestamp,                          -- ປິດງານ
  cancel_date   timestamp,                          -- ຍົກເລີກ
  created_by    varchar
);
create index if not exists ods_tb_maintenance_emp   on ods_tb_maintenance (emp_code);
create index if not exists ods_tb_maintenance_cust  on ods_tb_maintenance (cust_code);
create index if not exists ods_tb_maintenance_open  on ods_tb_maintenance (cancel_date, job_finish);

-- ── catalog ບໍລິການ (ຕັ້ງລາຄາໄວ້ · ແກ້ຕໍ່ງານໄດ້) ──────────────────
create table if not exists ods_maintenance_service (
  code          varchar primary key,
  name          varchar not null,
  default_price numeric default 0,
  active        boolean default true,
  sort          int default 0
);

-- ── ລາຍການບໍລິການຕໍ່ 1 ໃບງານ ───────────────────────────────────
create table if not exists ods_tb_maintenance_detail (
  id            serial primary key,
  job_code      varchar not null references ods_tb_maintenance(code) on delete cascade,
  service_code  varchar,
  name          varchar not null,
  qty           int default 1,
  price         numeric default 0
);
create index if not exists ods_tb_maintenance_detail_job on ods_tb_maintenance_detail (job_code);

-- ── seed catalog ເບື້ອງຕົ້ນ (ແກ້/ເພີ່ມໄດ້ພາຍຫຼັງ) ─────────────────
insert into ods_maintenance_service (code, name, default_price, sort) values
  ('MC-AIR',   'ລ້າງແອ', 0, 1),
  ('MC-WASH',  'ລ້າງເຄື່ອງຊັກຜ້າ', 0, 2),
  ('MC-FRIDGE','ລ້າງຕູ້ເຢັນ', 0, 3),
  ('MC-OTHER', 'ອື່ນໆ', 0, 99)
on conflict (code) do nothing;
