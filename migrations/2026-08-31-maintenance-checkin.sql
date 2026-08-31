-- ── ເປີດທາງໃຫ້ check-in ໜ້າງານຂອງ **ບຳລຸງຮັກສາ (ລ້າງແອ)** ── 31-08-2026
--
-- ບັນຫາ: ຕາຕະລາງ `ods_job_checkin` ຖືກສ້າງ 12-07-2026 ຕອນມີແຕ່ 2 ສາຍງານ
-- (migrations/2026-07-12-mobile.sql) ⇒ ຄ່າ 'maintenance' ຍັດເຂົ້າບໍ່ໄດ້ 2 ຊັ້ນ:
--   ① `workflow varchar(10)` ແຕ່ 'maintenance' ຍາວ 11 ຕົວ  → error 22001 (ຍາວເກີນ)
--   ② `check (workflow in ('repair','install'))`            → error 23514 (ບໍ່ຜ່ານ)
-- ຟີເຈີ check-in ຂອງບຳລຸງຮັກສາເພີ່ມມາ 07-08-2026 (lib/maintenance-flow) ແຕ່ບໍ່ໄດ້
-- ຂຽນ migration ນຳ ⇒ ຄຳສັ່ງ check-in ຈາກແອັບ **ລົ້ມທຸກຄັ້ງ** ຕັ້ງແຕ່ມື້ນັ້ນ
-- (ວັດຈິງ 31-08-2026: ແຖວ install 184 · repair 118 · maintenance **0**)
-- ແລະ ຍ້ອນ finishMaintenanceOnsite ບັງຄັບໃຫ້ມີ check-in ເປີດຢູ່ກ່ອນ ⇒ ງານບຳລຸງ
-- ທຸກໃບຄາຢູ່ຂັ້ນ "ລໍໄປລ້າງ" ໃນແອັບຖາວອນ.
--
-- ໃຊ້ varchar(12) ໃຫ້ຕົງກັບ `ods_job_tech.workflow` (migrations/2026-08-10-job-helpers.sql)
-- ທີ່ຮັບ 'maintenance' ຢູ່ແລ້ວ — ຄ່າຊຸດດຽວກັນ ຄວນກວ້າງເທົ່າກັນ.
--
-- ບໍ່ແຕະຂໍ້ມູນເກົ່າ: ຂະຫຍາຍຄວາມກວ້າງ (ບໍ່ຫຍໍ້) ແລະ CHECK ໃໝ່ກວ້າງກວ່າອັນເກົ່າ
-- ⇒ 302 ແຖວທີ່ມີຢູ່ຜ່ານໝົດ. ແລ່ນຊ້ຳໄດ້ (idempotent).

alter table ods.ods_job_checkin
  alter column workflow type varchar(12);

alter table ods.ods_job_checkin
  drop constraint if exists ods_job_checkin_workflow;

alter table ods.ods_job_checkin
  add constraint ods_job_checkin_workflow
  check (workflow in ('repair', 'install', 'maintenance'));
