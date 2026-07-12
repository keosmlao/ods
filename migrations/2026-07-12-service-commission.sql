-- ═══════════════════════════════════════════════════════════════════
--  ຄ່າບໍລິການ ແລະ ຄ່າຄອມຂອງຊ່າງ (technician service commission)
--  ຖານ: ODS (odservice) ເທົ່ານັ້ນ · ບໍ່ແຕະ ERP
--  ລັກສະນະ: **ເພີ່ມຢ່າງດຽວ** — ບໍ່ລຶບ, ບໍ່ແກ້ຂໍ້ມູນເກົ່າ, ບໍ່ປ່ຽນຖັນທີ່ມີຢູ່
--           ⇒ ລະບົບເກົ່າ (ods / Flask) ຍັງແລ່ນຄຽງຄູ່ໄດ້ໂດຍບໍ່ພັງ
--
--  ຂໍ້ມູນອ້າງອີງມາຈາກ ERP (ອ່ານຢ່າງດຽວ):
--    ic_inventory.item_category → ic_category   (99.6% ຂອງສິນຄ້າມີ)
--    ic_inventory.item_design   → ic_design     (45%)  ແອຕິດຝາ/ແອແຄັດເສັດ/ແອຕູ້ຕັ້ງ
--    ic_inventory.item_size     → ic_size       (70%)  "11,000-14,999 btu." ເປັນຊ່ວງພ້ອມແລ້ວ
--  ສະກຸນເງິນ: THB (ຢືນຢັນຈາກ ERP app_incentive_config.currency_code = 'THB')
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1) ສາຍເຊື່ອມທີ່ຂາດ: ໃບຮັບເຄື່ອງສ້ອມ → ສິນຄ້າ ERP ───────────────
--
-- ໜ້າ /service/new ຄົ້ນສິນຄ້າ ERP ຢູ່ແລ້ວ (/api/products ຄືນ item_code ມາ)
-- ແຕ່ createService **ບໍ່ໄດ້ບັນທຶກ** ⇒ tb_product ໄປຫາ ic_size/ic_design ບໍ່ໄດ້
-- (master_product ຫວ່າງ 0/5,066 · ຕາຕະລາງ serial ຂອງ ERP ວ່າງເປົ່າ)
--
-- ງານເກົ່າ 5,066 ໃບຈະບໍ່ມີຄ່ານີ້ — ຮັບໄດ້ ເພາະຄ່າຄອມຄິດໄປຂ້າງໜ້າ.
alter table tb_product add column if not exists item_code varchar;


-- ── 2) ຕາຕະລາງອັດຕາຄ່າບໍລິການ ─────────────────────────────────────
--
-- null = "ທຸກອັນ" ⇒ ຕອນຈັບຄູ່ ແຖວທີ່ລະບຸລະອຽດກວ່າຊະນະ (ໃຫ້ຄະແນນ).
-- service_type ຮອງຮັບ ໃນສະຖານທີ່ / ນອກສະຖານທີ່ (CI/ST/IH/PS) — ຕາຕະລາງໃນຮູບ
-- ມີແຖວທີ່ເງື່ອນໄຂຄືກັນແຕ່ລາຄາຕ່າງກັນ ຈຶ່ງຕ້ອງມີມິຕິນີ້.
create table if not exists ods_service_rate (
  id             bigserial primary key,
  workflow       varchar(10)  not null,        -- repair | install
  service_type   varchar(10),                  -- CI/ST/IH/PS · null = ທຸກປະເພດ
  category_code  varchar(20),                  -- ERP ic_category.code
  design_code    varchar(20),                  -- ERP ic_design.code
  size_code      varchar(20),                  -- ERP ic_size.code
  label          varchar(200) not null,        -- ຄຳອະທິບາຍໃຫ້ຄົນອ່ານ
  amount_thb     numeric(12,2) not null,       -- ບາທ
  effective_from date not null default current_date,
  effective_to   date,
  is_active      boolean not null default true,
  updated_by     varchar(100),
  updated_at     timestamp not null default localtimestamp(0),
  constraint ods_service_rate_workflow check (workflow in ('repair','install')),
  constraint ods_service_rate_amount   check (amount_thb >= 0));

create index if not exists ods_service_rate_lookup
  on ods_service_rate(workflow, category_code, is_active);


-- ── 3) ການແບ່ງເປີເຊັນຕາມບົດບາດ ─────────────────────────────────────
create table if not exists ods_service_commission_split (
  workflow varchar(10)  not null,
  role     varchar(20)  not null,   -- supervisor | team_lead | admin | technician
  pct      numeric(5,2) not null,
  primary key (workflow, role),
  constraint ods_split_pct check (pct >= 0 and pct <= 100));

-- ຄ່າຈາກຮູບຂອງຜູ້ໃຊ້ (ລວມ 100% ທັງສອງສາຍງານ)
insert into ods_service_commission_split(workflow, role, pct) values
  ('repair',  'supervisor',   5),
  ('repair',  'team_lead',   32),
  ('repair',  'admin',       11),
  ('repair',  'technician',  52),
  ('install', 'supervisor',   0),
  ('install', 'team_lead',    0),
  ('install', 'admin',        7),
  ('install', 'technician',  93)
on conflict (workflow, role) do nothing;


-- ── 4) ໃຜຮັບເງິນຂອງແຕ່ລະບົດບາດ (ຜູ້ຈັດການກຳນົດ) ────────────────────
--
-- ຊ່າງ (technician) **ບໍ່ຕ້ອງກຳນົດ** — ເອົາຈາກງານເອງ:
--   ຕິດຕັ້ງ → ods_tb_install.tech_code  ·  ສ້ອມ → tb_product.emp_code
-- ບົດບາດອື່ນ (ຜູ້ຄຸມ/ຫົວໜ້າທີມ/Admin) ລະບົບບໍ່ຮູ້ວ່າແມ່ນໃຜ ⇒ ໃຫ້ຜູ້ຈັດການລະບຸ.
-- ຖ້າຍັງບໍ່ລະບຸ ສ່ວນແບ່ງນັ້ນຈະຖືກບັນທຶກແຕ່ **ບໍ່ຜູກກັບໃຜ** (employee_code = null)
-- ⇒ ບໍ່ມີທາງຈ່າຍຜິດຄົນ.
create table if not exists ods_service_commission_payee (
  workflow      varchar(10) not null,
  role          varchar(20) not null,
  employee_code varchar(50) not null,
  updated_by    varchar(100),
  updated_at    timestamp not null default localtimestamp(0),
  primary key (workflow, role));


-- ── 5) ເງິນທີ່ຄິດແລ້ວ — **ແຊ່ໄວ້ຕອນປິດງານ** ─────────────────────────
--
-- ຫ້າມຄິດສົດທຸກຄັ້ງທີ່ເປີດລາຍງານ: ພໍປ່ຽນອັດຕາເດືອນໜ້າ ເງິນຂອງເດືອນ
-- ທີ່ຈ່າຍໄປແລ້ວຈະປ່ຽນຕາມ. ຈຶ່ງແຊ່ຕົວເລກ (ອັດຕາ · %  · ຈຳນວນ) ໄວ້ຕອນປິດງານ.
create table if not exists ods_service_payout (
  id            bigserial primary key,
  workflow      varchar(10)  not null,
  job_code      varchar(50)  not null,
  rate_id       bigint,
  rate_label    varchar(200),
  amount_thb    numeric(12,2) not null,   -- ຄ່າບໍລິການເຕັມຂອງງານ
  role          varchar(20)  not null,
  employee_code varchar(50),              -- null = ຍັງບໍ່ໄດ້ກຳນົດຜູ້ຮັບ
  pct           numeric(5,2) not null,
  pay_thb       numeric(12,2) not null,   -- ສ່ວນແບ່ງຂອງບົດບາດນີ້
  closed_at     timestamp,                -- ເວລາປິດງານ (ໃຊ້ຈັດເດືອນ)
  computed_at   timestamp not null default localtimestamp(0),
  unique (workflow, job_code, role));

create index if not exists ods_service_payout_emp
  on ods_service_payout(employee_code, closed_at);

commit;
