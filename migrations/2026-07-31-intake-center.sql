-- ── ບ່ອນຮັບເຄື່ອງ (intake_center) ຂອງໃບງານສ້ອມ ────────────────────────────────
--
-- ບັນຫາ: ສູນມີ 2 ບ່ອນ (ຂົວຫຼວງ 1104 · ດອນຕີ້ວ 1206) ແລະ ເຄື່ອງໂອນໄປສ້ອມຂ້າມສູນໄດ້
-- (ods_job_transfer + tb_product.service_center ມີມາແຕ່ກ່ອນ) ແຕ່ **ບໍ່ມີບ່ອນເກັບວ່າ
-- ໃບນີ້ຮັບເຄື່ອງເຂົ້າຢູ່ບ່ອນໃດ** ⇒ ສ້ອມແລ້ວບໍ່ຮູ້ວ່າຕ້ອງສົ່ງກັບບ່ອນໃດໃຫ້ລູກຄ້າມາຮັບ.
-- (ຂໍ້ມູນຈິງ 31-07-2026: service_center ຫວ່າງທັງ 5,167 ໃບ · ods_job_transfer 0 ແຖວ)
--
--   intake_center  = ບ່ອນ**ຮັບເຄື່ອງເຂົ້າ** (ບໍ່ປ່ຽນ — ລູກຄ້າມາຮັບຄືນບ່ອນນີ້)
--   service_center = ບ່ອນທີ່ເຄື່ອງ**ຢູ່ດຽວນີ້** (ປ່ຽນຕາມການໂອນ)
--
-- ສອງຄ່ານີ້ບໍ່ຕົງກັນ = ເຄື່ອງຍັງຢູ່ອີກສູນ ⇒ ສົ່ງຄືນລູກຄ້າບໍ່ໄດ້ (ເບິ່ງ lib/job-center).
-- ໃບເກົ່າຄ່າຫວ່າງ = ບໍ່ຖືກກວດ (ບໍ່ backfill — ບໍ່ຮູ້ຄວາມຈິງຍ້ອນຫຼັງ).

alter table tb_product add column if not exists intake_center varchar(10);

comment on column tb_product.intake_center is
  'ບ່ອນຮັບເຄື່ອງເຂົ້າ (1104=ຂົວຫຼວງ · 1206=ດອນຕີ້ວ) — ລູກຄ້າມາຮັບຄືນບ່ອນນີ້';

-- ຄິວ "ລໍຮັບໂອນ" ຖາມດ້ວຍ received_at is null ທຸກເທື່ອ
create index if not exists ods_job_transfer_pending_idx
  on ods_job_transfer (received_at) where received_at is null;
