-- ═══════════════════════════════════════════════════════════════════════════
--  **ບັນທຶກຊີ້ແຈງ ງານສ້ອມທີ່ຜິດປົກກະຕິ** — ໜ້າ /reports/repair-audit
--  ຖານ: ODS ເທົ່ານັ້ນ · **ຕາຕະລາງໃໝ່ 2 ອັນ** (ບໍ່ແຕະ tb_product ເລີຍ)
--
--  ── ເປັນຫຍັງຕ້ອງມີ ──
--  ລາຍງານກວດສອບບອກໄດ້ວ່າ "ໃບນີ້ຄ້າງຢູ່ຂັ້ນ 6 ດົນກວ່າ SLA 8 ເທົ່າ" ແລະ "ໃບນີ້ສົ່ງຄືນ
--  ໂດຍບໍ່ຜ່ານ QC" — ແຕ່ **ຄອມພິວເຕີບອກສາເຫດບໍ່ໄດ້**. ສາເຫດຢູ່ໃນຫົວຄົນ (ລູກຄ້າບໍ່ຕອບ ·
--  ອາໄຫຼ່ບໍ່ມີຂາຍ · ຊ່າງລືມກົດ). ຖ້າບໍ່ມີບ່ອນເກັບຄຳຊີ້ແຈງ ຄຳຕອບຈະຢູ່ໃນກຸ່ມແຊັດ ແລ້ວ
--  ເດືອນຕໍ່ໄປກໍ່ຖາມຄືນອີກໃບເກົ່ານັ້ນ. ເກັບໄວ້ ⇒ ນັບເປັນຕົວເລກໄດ້ ("ຄ້າງຍ້ອນອາໄຫຼ່ 40%")
--  ແລະ ຮູ້ໄດ້ວ່າ **ງານຜິດປົກກະຕິທີ່ຍັງບໍ່ມີໃຜຊີ້ແຈງ** ຍັງເຫຼືອຈັກໃບ.
--
--  ── ⚠️ ເປັນຫຍັງບໍ່ໃຊ້ ods_job_hold ທີ່ມີຢູ່ແລ້ວ ──
--  ods_job_hold ເປັນ **ທຸງທີ່ຢຸດນາລິກາ KPI** ⇒ ໝາຍແລ້ວເວລາຢຸດເດີນ ແລະ ວຽກແຍກແທັບ
--  (ເບິ່ງ src/lib/job-hold.ts). ການ **ຊີ້ແຈງຫຼັງເຫດການ** ບໍ່ຄວນຢຸດນາລິກາ ແລະ ບໍ່ຄວນ
--  ຍ້າຍວຽກອອກຈາກຄິວ — ບໍ່ດັ່ງນັ້ນການ "ຕອບຄຳຖາມຫົວໜ້າ" ຈະກາຍເປັນເຄື່ອງມືລ້າງຕົວເລກ
--  ຂອງໂຕເອງ. ສອງເລື່ອງນີ້ຢູ່ຄົນລະຕາຕະລາງ ແລະ ໃຊ້ຮ່ວມກັນໄດ້ (1 ໃບມີທັງທຸງ ແລະ ຄຳຊີ້ແຈງ).
--
--  ── ໄຟລ໌ແນບ ──
--  ບໍ່ໃຊ້ product_image ຮ່ວມ ເພາະຕາຕະລາງນັ້ນຄື **ຮູບຂອງເຄື່ອງ** (ໜ້າງານ/ໜ້າພິມດຶງໄປໃຊ້)
--  ⇒ ໃສ່ໃບເກັບເງິນ/ໃບແຈ້ງຂອງ supplier ລົງໄປ ຈະໄປປາກົດຢູ່ໜ້າອື່ນທີ່ບໍ່ຄາດ. ແຍກຕາຕະລາງ
--  ⇒ ລຶບບັນທຶກແລ້ວໄຟລ໌ຫຼົ່ນຕາມ (on delete cascade) ແລະ ຮັບ pdf ໄດ້ (ຮູບບໍ່ພຽງພໍ
--  ສຳລັບການຊີ້ແຈງ — ໃບສະເໜີລາຄາ/ອີເມວ supplier ເປັນ pdf).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists ods_repair_audit (
  id           bigserial primary key,
  /** ລະຫັດໃບຮັບເຄື່ອງ (tb_product.code) */
  job_code     varchar(50)  not null,
  /** ຂັ້ນທີ່ວຽກຢູ່ຕອນຂຽນຄຳຊີ້ແຈງ — ໄວ້ເບິ່ງຍ້ອນຫຼັງວ່າຕອນນັ້ນຄາຢູ່ໃສ */
  stage_at     smallint,
  /** ໝວດສາເຫດ — ຄ່າຕ້ອງຢູ່ໃນ AUDIT_CAUSE_LABEL (src/lib/repair-audit-check.ts) */
  cause        varchar(30)  not null,
  /** ຄຳຊີ້ແຈງ — ບັງຄັບ: ບັນທຶກທີ່ບໍ່ບອກເຫດຜົນ ບໍ່ຕ່າງກັບບໍ່ມີບັນທຶກ */
  reason       text         not null check (btrim(reason) <> ''),
  /** ຝ່າຍ/ໜ່ວຍງານທີ່ຮັບຜິດຊອບງານນີ້ຢູ່ສະຖານະປັດຈຸບັນ */
  owner_dept   varchar(60),
  /** ຄົນທີ່ຮັບຜິດຊອບ (ຊື່ ຫຼື ລະຫັດພະນັກງານ) */
  owner_person varchar(100),
  created_by   varchar(100) not null,
  created_at   timestamp    not null default localtimestamp(0),
  /** ປິດບັນທຶກ = ບັນຫາຖືກແກ້ແລ້ວ (ປະຫວັດຍັງຢູ່ — ບໍ່ລຶບ) */
  resolved_at  timestamp,
  resolved_by  varchar(100),
  resolved_note text
);

-- 1 ໃບງານ = ບັນທຶກ**ເປີດ**ໄດ້ອັນດຽວ (ປະຫວັດທີ່ປິດແລ້ວ ເກັບໄດ້ຫຼາຍອັນ) — ຄືກັບ ods_job_hold
create unique index if not exists ods_repair_audit_open
  on ods_repair_audit(job_code) where resolved_at is null;

-- ລາຍງານດຶງ "ບັນທຶກເປີດຂອງແຕ່ລະໃບ" ທຸກແຖວ ⇒ ຕ້ອງໄວ
create index if not exists ods_repair_audit_job
  on ods_repair_audit(job_code, created_at desc);

create table if not exists ods_repair_audit_file (
  id            bigserial primary key,
  audit_id      bigint       not null references ods_repair_audit(id) on delete cascade,
  /** ຊື່ໄຟລ໌ໃນ ODS_UPLOADS_DIR (ຕັ້ງເອງ ກັນຊື່ຊ້ຳ) */
  stored_name   varchar(200) not null,
  /** ຊື່ທີ່ຜູ້ໃຊ້ອັບຂຶ້ນ — ສະແດງໃຫ້ຄົນເຫັນ */
  original_name varchar(200) not null,
  bytes         integer      not null,
  uploaded_by   varchar(100) not null,
  uploaded_at   timestamp    not null default localtimestamp(0)
);

create index if not exists ods_repair_audit_file_audit
  on ods_repair_audit_file(audit_id);

comment on table ods_repair_audit is
  'ຄຳຊີ້ແຈງງານສ້ອມທີ່ຜິດປົກກະຕິ/ເກີນ SLA — ໜ້າ /reports/repair-audit (src/lib/repair-audit.ts)';
comment on table ods_repair_audit_file is
  'ໄຟລ໌ແນບຂອງຄຳຊີ້ແຈງ — ໄຟລ໌ຈິງຢູ່ ODS_UPLOADS_DIR, ອ່ານຜ່ານ /api/uploads/[file]';

commit;
