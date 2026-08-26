-- ═══════════════════════════════════════════════════════════════════════════
-- `ods_qc_round` + `ods_qc_result.round` — **ຕົກ QC ແລ້ວຢ່າໃຫ້ປະຫວັດຫາຍ**
-- (26-08-2026 ຕາມຄຳສັ່ງ "ຕ້ອງເກັບປະຫວັດທຸກຢ່າງ")
--
-- ── ຫາຍຫຍັງແດ່ຕອນ QC ສົ່ງງານກັບ ──
-- ① **ເວລາເຮັດວຽກຮອບນັ້ນ** — ສົ່ງກັບ = ລ້າງ time_repair / time_finish_repair
--    (ຝັ່ງຕິດຕັ້ງ: finish_install) ⇒ ຮອບທຳອິດ **ບໍ່ເຫຼືອຮ່ອງຮອຍ**: ໃຜສ້ອມ ·
--    ແຕ່ໃສ ຫາ ໃສ · ໃຊ້ເວລາເທົ່າໃດ. ລາຍງານ KPI ຈະນັບແຕ່ຮອບສຸດທ້າຍ ຄືກັບວ່າ
--    ຮອບທຳອິດບໍ່ເຄີຍເກີດ.
-- ② **ຄຳຕອບ QC ຂໍ້ຕໍ່ຂໍ້ຂອງຮອບນັ້ນ** — `ods_qc_result` ເປັນ upsert ຕາມ
--    (workflow, job_code, item_id) ⇒ ພໍກວດຮອບ 2 ຄຳຕອບ+ຮູບຂອງຮອບ 1 ຖືກຂຽນທັບ.
--
-- ── ວິທີເກັບ ──
-- `ods_qc_round` = 1 ແຖວຕໍ່ 1 ຮອບທີ່ **ຖືກ QC ສົ່ງກັບ** (ຮອບທີ່ຜ່ານບໍ່ຕ້ອງເກັບ —
-- ເວລາຂອງມັນຍັງນອນຢູ່ໃນໃບງານຄືເກົ່າ). ບັນທຶກກ່ອນລ້າງຖັນ ຢູ່ transaction ດຽວກັນ
-- ⇒ ບໍ່ມີຊ່ອງທີ່ຂໍ້ມູນຫາຍ.
-- `ods_qc_result.round` = ຮອບຂອງຄຳຕອບນັ້ນ (ຮອບປັດຈຸບັນ = ຈຳນວນຮອບທີ່ຖືກສົ່ງກັບ + 1)
-- ⇒ ຮອບໃໝ່ **ເພີ່ມແຖວ** ບໍ່ແມ່ນຂຽນທັບ. ຂໍ້ມູນເກົ່າທັງໝົດເປັນຮອບ 1.
--
-- ⚠️ unique ເກົ່າ (workflow, job_code, item_id) ຕ້ອງຖືກແທນດ້ວຍຕົວທີ່ມີ round
-- ບໍ່ດັ່ງນັ້ນ insert ຂອງຮອບ 2 ຈະຊົນກັບແຖວຮອບ 1.
--
-- ⚠️ ໂໝດ single-db (odg + schema ods) ຕ້ອງແລ່ນດ້ວຍ search_path=ods:
--   PGOPTIONS="-c search_path=ods" psql "$DATABASE_URL" -f <ໄຟລ໌ນີ້>
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists ods_qc_round (
  id          bigserial primary key,
  workflow    varchar(10)  not null,
  job_code    varchar(50)  not null,
  -- ຮອບທີ່ເທົ່າໃດ (1 = ຮອບທຳອິດ) — ນັບຕໍ່ໃບງານ
  round       int          not null,
  -- ຄົນທີ່ເຮັດຮອບນັ້ນ (emp_code ຂອງສ້ອມ · tech_code ຂອງຕິດຕັ້ງ) ຕອນຖືກສົ່ງກັບ
  worker      varchar(100),
  -- ເວລາເຮັດວຽກຂອງຮອບນັ້ນ — **ຄ່າທີ່ກຳລັງຈະຖືກລ້າງ** ອອກຈາກໃບງານ
  started_at  timestamp,
  finished_at timestamp,
  -- ໃຜສົ່ງກັບ ເມື່ອໃດ ແລະ ຍ້ອນຫຍັງ (ຊື່ຂໍ້ທີ່ຕົກ + ໝາຍເຫດ — ຂໍ້ຄວາມດຽວກັບ chatter)
  rejected_at timestamp    not null default localtimestamp(0),
  rejected_by varchar(100) not null,
  failed      int          not null default 0,
  checked     int          not null default 0,
  reason      text,
  unique (workflow, job_code, round)
);

create index if not exists ods_qc_round_job on ods_qc_round(workflow, job_code);

alter table ods_qc_result add column if not exists round int not null default 1;

-- ແທນ unique ເກົ່າດ້ວຍຕົວທີ່ແຍກຮອບ (ຊື່ constraint ຕາມທີ່ postgres ຕັ້ງໃຫ້ຕອນສ້າງ)
alter table ods_qc_result drop constraint if exists ods_qc_result_workflow_job_code_item_id_key;
drop index if exists ods_qc_result_workflow_job_code_item_id_key;
create unique index if not exists ods_qc_result_round_item
  on ods_qc_result(workflow, job_code, round, item_id);

commit;
