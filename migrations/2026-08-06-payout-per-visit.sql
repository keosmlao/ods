-- ═══════════════════════════════════════════════════════════════════════════
-- ແບ່ງຄ່າຄອມ **ຕາມຮອບເຂົ້າໜ້າງານ** ໄດ້ (ງານຕິດຕັ້ງທີ່ໄປຫຼາຍມື້ ແລະ ປ່ຽນຊ່າງກາງທາງ)
--
-- ── ບັນຫາ ──
-- `ods_service_payout` ມີດັດຊະນີ UNIQUE (workflow, job_code, role) ⇒ 1 ງານ ມີແຖວ
-- ບົດບາດ "ຊ່າງ" ໄດ້ **ຄົນດຽວ** ⇒ ງານທີ່ຊ່າງ A ໄປ 2 ຮອບ ຊ່າງ B ໄປ 1 ຮອບ
-- ບໍ່ມີບ່ອນເກັບສ່ວນແບ່ງຂອງ B ໄດ້ເລີຍ (ຂໍ້ມູນຈິງ: 24 ໃບເຄີຍປ່ຽນຊ່າງ).
--
-- ── ແກ້ ──
-- ໃສ່ `employee_code` ເຂົ້າໃນກະແຈ ⇒ 1 ບົດບາດ ມີໄດ້ຫຼາຍຄົນ ຄົນລະສ່ວນ.
-- ບົດບາດອື່ນ (ຫົວໜ້າ · CS …) ຍັງເປັນຄົນດຽວຄືເກົ່າ ເພາະ payee ຕັ້ງໄວ້ຄົນດຽວຢູ່ແລ້ວ.
--
-- ⚠️ ບໍ່ແຕະ 148 ແຖວທີ່ມີຢູ່ — ກະແຈໃໝ່ກວ້າງກວ່າເກົ່າ ⇒ ຂໍ້ມູນເກົ່າຍັງຖືກຕ້ອງ.
-- ═══════════════════════════════════════════════════════════════════════════

alter table ods_service_payout
  drop constraint if exists ods_service_payout_workflow_job_code_role_key;

alter table ods_service_payout
  add constraint ods_service_payout_workflow_job_code_role_employee_key
  unique (workflow, job_code, role, employee_code);

-- ຈຳນວນຮອບທີ່ຄິດສ່ວນແບ່ງມາຈາກ (null = ບໍ່ໄດ້ແບ່ງຕາມຮອບ — ຄືເກົ່າ)
alter table ods_service_payout add column if not exists visits int;
