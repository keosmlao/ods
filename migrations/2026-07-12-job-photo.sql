-- ═══════════════════════════════════════════════════════════════════
--  ຮູບຜົນງານຂອງຊ່າງ — ຖ່າຍຕອນ "ຈົບງານ" (ກ່ອນຜົນງານຈະຖືກສົ່ງໄປກວດ QC)
--  ຖານ: ODS ເທົ່ານັ້ນ · ເພີ່ມຢ່າງດຽວ
--
--  ── ເປັນຫຍັງຕ້ອງມີ ──
--  ດຽວນີ້ຮູບມີພຽງ 2 ບ່ອນ: ຮູບ QC (ຫົວໜ້າຊ່າງຖ່າຍຕອນກວດຮັບ) ແລະ ຮູບ check-in
--  (ຕອນໄປຮອດໜ້າງານ — ຄືສະພາບ **ກ່ອນ** ເຮັດ). ຊ່າງເອງບໍ່ໄດ້ຖ່າຍຮູບ **ຜົນງານ**
--  ຕອນຈົບ ⇒ ຖ້າລູກຄ້າຄ້ານພາຍຫຼັງ ຫຼື QC ບໍ່ຜ່ານ ບໍ່ມີຫຼັກຖານວ່າຕອນຊ່າງອອກຈາກໜ້າງານ
--  ວຽກຢູ່ໃນສະພາບໃດ.
--
--  ⚠️ ຮູບເປັນ base64 ຄືກັບ QC ແລະ check-in ⇒ ບີບຮູບກ່ອນສົ່ງ (ແອັບ/ເວັບ)
--  ແລະ ຈຳກັດຂະໜາດຢູ່ຝັ່ງ server (MAX_PHOTO_CHARS).
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists ods_job_photo (
  id         bigserial primary key,
  workflow   varchar(10) not null,
  job_code   varchar(50) not null,
  -- 'finish' = ຜົນງານຕອນຈົບ · ເປີດຊ່ອງໄວ້ໃຫ້ 'before'/'issue' ພາຍຫຼັງ ໂດຍບໍ່ຕ້ອງແກ້ schema
  kind       varchar(20) not null default 'finish',
  photo      text not null,                       -- base64 (data URI)
  note       text,
  created_by varchar(100) not null,
  created_at timestamp not null default localtimestamp(0),
  constraint ods_job_photo_workflow check (workflow in ('repair','install')));

create index if not exists ods_job_photo_job on ods_job_photo(workflow, job_code);

commit;
