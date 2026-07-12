-- ═══════════════════════════════════════════════════════════════════
--  ດ່ານກວດຮັບຄຸນນະພາບ (QC gate) — ທັງ ສ້ອມແປງ ແລະ ຕິດຕັ້ງ
--  ຖານ: ODS ເທົ່ານັ້ນ · ເພີ່ມຢ່າງດຽວ
--
--  ── ຂັ້ນໄດປ່ຽນ (ນີ້ຄືການປ່ຽນແກນກາງ) ──
--  ຕິດຕັ້ງ  5 ກຳລັງຕິດຕັ້ງ → 6 **ລໍກວດ QC** → 7 ລໍແບບປະເມີນ → 8 ລໍປິດງານ → 9 ປິດແລ້ວ
--  ສ້ອມແປງ 9 ກຳລັງສ້ອມ    → 10 **ລໍກວດ QC** → 11 ລໍສົ່ງຄືນ → 12 ສົ່ງຄືນສຳເລັດ
--
--  ⇒ ງານທີ່ຍັງບໍ່ຜ່ານ QC **ໄປຕໍ່ບໍ່ໄດ້**: ລູກຄ້າຕອບແບບປະເມີນບໍ່ໄດ້ (ຕິດຕັ້ງ)
--    ແລະ ອອກໃບຮັບເງິນ/ສົ່ງຄືນບໍ່ໄດ້ (ສ້ອມ).
--
--  ── ໝາຍເຫດ: ລະບົບເກົ່າເຄີຍເຮັດ QC ແລ້ວ ──
--  ods_install_standard / ods_install_standard_in_job / ods_checkin_checkout_install
--  ມີຢູ່ ແລະ ຖືກໃຊ້ຈິງ 1 ງານ (INST-2516, ຕຸລາ 2024: 4 ລາຍການ + ຮູບ + ລາຍເຊັນ + GPS)
--  ແລ້ວຖືກປະຖິ້ມ. ຕາຕະລາງເກົ່າ **ບໍ່ຖືກແຕະ** (ຂໍ້ມູນປະຫວັດຍັງຢູ່) ແຕ່ບໍ່ໃຊ້ຕໍ່ ເພາະ:
--    · ຮອງຮັບແຕ່ຝັ່ງຕິດຕັ້ງ (ຝັ່ງສ້ອມບໍ່ມີເລີຍ)
--    · ລາຍການ checklist ເປັນຊື່ຫຼອກ ('ມາດຖານ1'…'ມາດຖານ5') ບໍ່ເຄີຍຕັ້ງຈິງ
--    · ບໍ່ແຍກຕາມໝວດສິນຄ້າ (ຕິດຕັ້ງແອ ກັບ ຕິດຕັ້ງໂທລະທັດ ກວດຄົນລະຢ່າງ)
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1) ຖັນຂັ້ນໄດໃໝ່ ───────────────────────────────────────────────
alter table ods_tb_install add column if not exists qc_finish timestamp;
alter table ods_tb_install add column if not exists qc_by     varchar(100);
alter table tb_product     add column if not exists qc_finish timestamp;
alter table tb_product     add column if not exists qc_by     varchar(100);

/**
 * ຂໍ້ມູນເກົ່າ: ງານທີ່ **ຜ່ານຂັ້ນນີ້ໄປແລ້ວ** ຕ້ອງບໍ່ຕົກກັບມາຄ້າງຢູ່ "ລໍກວດ QC"
 * ບໍ່ດັ່ງນັ້ນ ງານທີ່ປິດ/ສົ່ງຄືນໄປແລ້ວ 6,800+ ງານ ຈະເດັ້ງກັບເຂົ້າຄິວ QC ພ້ອມກັນ.
 * ⇒ ປະທັບ qc_finish ຍ້ອນຫຼັງໃຫ້ງານທີ່ໄປໄກກວ່າຂັ້ນ QC ແລ້ວ (ໃຊ້ເວລາຂອງຂັ້ນນັ້ນເອງ).
 */
update ods_tb_install
   set qc_finish = finish_install, qc_by = '(ຂໍ້ມູນເກົ່າ)'
 where qc_finish is null and finish_install is not null
   and (complain_finish is not null or job_finish is not null);

update tb_product
   set qc_finish = time_finish_repair, qc_by = '(ຂໍ້ມູນເກົ່າ)'
 where qc_finish is null and time_finish_repair is not null
   and return_complete is not null;


-- ── 2) ລາຍການ checklist (master) ─────────────────────────────────
--
-- ແຍກຕາມ **ສາຍງານ** ແລະ (ຖ້າຕ້ອງການ) **ໝວດສິນຄ້າ ERP** — ຕິດຕັ້ງແອ ກັບ
-- ຕິດຕັ້ງໂທລະທັດ ກວດຄົນລະຢ່າງ. category_code ຫວ່າງ = ໃຊ້ກັບທຸກໝວດ.
create table if not exists ods_qc_item (
  id            bigserial primary key,
  workflow      varchar(10) not null,
  category_code varchar(20),                       -- ERP ic_category.code · null = ທຸກໝວດ
  name          varchar(200) not null,
  sort_order    int not null default 0,
  require_photo boolean not null default false,    -- ບັງຄັບແນບຮູບ
  is_active     boolean not null default true,
  updated_by    varchar(100),
  updated_at    timestamp not null default localtimestamp(0),
  constraint ods_qc_item_workflow check (workflow in ('repair','install')));

create index if not exists ods_qc_item_lookup on ods_qc_item(workflow, is_active);


-- ── 3) ຜົນການກວດ ຕໍ່ງານ ຕໍ່ລາຍການ ─────────────────────────────────
--
-- ⚠️ ຮູບເກັບເປັນ **base64 ໃນຖານ** (ຕາມທີ່ຜູ້ຈັດການເລືອກ — ຄືລະບົບເກົ່າ).
-- ຂອງເກົ່າ 200 KB ຕໍ່ຮູບ ⇒ ຝັ່ງແອັບບີບຮູບກ່ອນເກັບ ແລະ ຈຳກັດຂະໜາດ
-- (ເບິ່ງ actions/qc.ts) ບໍ່ດັ່ງນັ້ນຕາຕະລາງນີ້ຈະບວມເປັນ GB ພາຍໃນປີດຽວ.
create table if not exists ods_qc_result (
  id         bigserial primary key,
  workflow   varchar(10) not null,
  job_code   varchar(50) not null,
  item_id    bigint not null references ods_qc_item(id),
  passed     boolean not null,
  note       text,
  photo      text,                                  -- base64 (data URI)
  checked_by varchar(100) not null,
  checked_at timestamp not null default localtimestamp(0),
  unique (workflow, job_code, item_id));

create index if not exists ods_qc_result_job on ods_qc_result(workflow, job_code);


-- ── 4) ລາຍເຊັນລູກຄ້າ (ຮັບມອບງານ) ─────────────────────────────────
create table if not exists ods_qc_signature (
  workflow    varchar(10) not null,
  job_code    varchar(50) not null,
  signer_name varchar(200) not null,
  signer_tel  varchar(50),
  signature   text,                                 -- base64 (data URI)
  signed_at   timestamp not null default localtimestamp(0),
  primary key (workflow, job_code));


-- ── 5) ໃຜກວດ QC ໄດ້ — ຜູ້ຈັດການກຳນົດເອງ ──────────────────────────
--
-- ບໍ່ຝັງ role ໄວ້ໃນໂຄດ ⇒ ປ່ຽນຜູ້ກວດໄດ້ໂດຍບໍ່ຕ້ອງແກ້ໂຄດ.
-- ຕັ້ງຕົ້ນ: ຫົວໜ້າຊ່າງ + ຜູ້ຈັດການ (ຄົນເຮັດບໍ່ໄດ້ກວດຂອງຕົນເອງ — ບັງຄັບຢູ່ actions/qc.ts)
create table if not exists ods_qc_role (
  workflow varchar(10) not null,
  role     varchar(20) not null,
  primary key (workflow, role));

insert into ods_qc_role(workflow, role) values
  ('install','headtechnical'), ('install','manager'),
  ('repair','headtechnical'),  ('repair','manager')
on conflict do nothing;

commit;
