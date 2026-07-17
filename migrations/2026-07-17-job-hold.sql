-- ═══════════════════════════════════════════════════════════════════
--  ໝາຍວຽກທີ່ "ມີບັນຫາ" — ທຸງ (flag) ບໍ່ແມ່ນ ຂັ້ນ (stage)
--  ຖານ: ODS ເທົ່ານັ້ນ · **ຕາຕະລາງໃໝ່** (ບໍ່ແຕະ tb_product ເລີຍ)
--
--  ── ເປັນຫຍັງຕ້ອງມີ ──
--  ວຽກບາງໜ່ວຍຄາຢູ່ຂັ້ນດຽວດົນໆ ດ້ວຍເຫດຜົນທີ່ຄິວແກ້ບໍ່ໄດ້ (ລໍອາໄຫຼ່ນອກ,
--  ລູກຄ້າບໍ່ຕອບ, ອາໄຫຼ່ບໍ່ມີຂາຍ) ແລ້ວມັນນອນປົນຢູ່ກັບວຽກທີ່ເຮັດໄດ້ແທ້.
--  ຂໍ້ມູນຈິງ (17-07-2026): ຂັ້ນ 6 ຄ້າງ 27 ໜ່ວຍ **ເກົ່າສຸດ 332 ມື້** ·
--  ຂັ້ນ 8 ຄ້າງ 14 ໜ່ວຍ 147 ມື້ · ຂັ້ນ 7 ຄ້າງ 4 ໜ່ວຍ 107 ມື້.
--
--  ── ⚠️ ເປັນຫຍັງບໍ່ເຮັດເປັນ "ຂັ້ນ 13" ──
--  ເຄີຍພາດມາແລ້ວກັບ "ຍົກເລີກ": ຕອນມັນເປັນຂັ້ນ ວຽກ **570 ໜ່ວຍຫຼົບອອກຈາກທຸກຄິວ**
--  ທັງທີ່ເຄື່ອງລູກຄ້າຍັງນອນຢູ່ຮ້ານ (ເກົ່າສຸດ 925 ມື້) ແລະ ບໍ່ມີໃຜເຝົ້າ —
--  ແກ້ໄປແລ້ວວັນທີ 17-07-2026 (ເບິ່ງ STAGE_SQL ໃນ src/lib/stage.ts).
--  ວຽກທີ່ມີບັນຫາຄືວຽກທີ່ **ຕ້ອງການຄົນເບິ່ງຫຼາຍທີ່ສຸດ** ບໍ່ແມ່ນໜ້ອຍທີ່ສຸດ
--  ⇒ ເປັນທຸງ: ວຽກຍັງຢູ່ຂັ້ນຈິງຂອງມັນ ພຽງແຕ່ຄິວແຍກແທັບ ແລະ ຢຸດນາລິກາໃຫ້.
--
--  ── ເປັນຫຍັງເປັນຕາຕະລາງ ບໍ່ແມ່ນຖັນ boolean ໃນ tb_product ──
--  ① tb_product ເປັນຕາຕະລາງເກົ່າທີ່ ODS python ຍັງໃຊ້ຮ່ວມ — ຢ່າແຕະ
--  ② ຕ້ອງການ **ປະຫວັດ**: ໃຜໝາຍ · ຍ້ອນຫຍັງ · ປົດເມື່ອໃດ (true/false ບອກບໍ່ໄດ້)
--  ③ ນາລິກາຢຸດຕ້ອງຮູ້ວ່າ **ຢຸດຕັ້ງແຕ່ຈັກໂມງ** ⇒ ຕ້ອງມີ created_at
--  ຮູບແບບຕາມ ods_job_reject ທີ່ມີຢູ່ແລ້ວ (ເກັບເຫດຜົນຕອນຊ່າງປະຕິເສດງານ).
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists ods_job_hold (
  id          bigserial primary key,
  /** 'repair' (tb_product.code) · 'install' (ods_tb_install.code) — ຄືກັບ ods_job_reject */
  workflow    varchar(20)  not null,
  /** ລະຫັດງານ */
  job_code    varchar(50)  not null,
  /** ປະເພດບັນຫາ: spare_wait · customer_wait · no_stock · other */
  kind        varchar(20)  not null default 'other',
  /** ຍ້ອນຫຍັງ — ບັງຄັບ: ທຸງທີ່ບໍ່ບອກເຫດຜົນ ຄືທຸງທີ່ບໍ່ມີໃຜແກ້ໄດ້ */
  reason      varchar(200) not null check (btrim(reason) <> ''),
  /** ຂັ້ນທີ່ວຽກຢູ່ຕອນຖືກໝາຍ — ໄວ້ເບິ່ງຍ້ອນຫຼັງວ່າຄາຢູ່ໃສ (ບໍ່ໄດ້ໃຊ້ຄິດຂັ້ນ) */
  stage_at    smallint,
  created_by  varchar(100) not null,
  created_at  timestamp    not null default localtimestamp(0),
  /** ປົດທຸງແລ້ວ = ວຽກກັບເຂົ້າຄິວປົກກະຕິ ແລະ ນາລິກາເດີນຕໍ່ */
  resolved_at timestamp,
  resolved_by varchar(100),
  resolved_note varchar(200)
);

-- 1 ງານ = ທຸງເປີດໄດ້ **ອັນດຽວ** (ປະຫວັດເກົ່າທີ່ປົດແລ້ວ ເກັບໄວ້ໄດ້ຫຼາຍອັນ)
create unique index if not exists ods_job_hold_open
  on ods_job_hold(workflow, job_code) where resolved_at is null;

-- ຄິວ/ນາລິກາຖາມ "ງານນີ້ມີທຸງເປີດບໍ່" ທຸກແຖວ ⇒ ຕ້ອງໄວ
create index if not exists ods_job_hold_lookup
  on ods_job_hold(workflow, job_code, resolved_at);

comment on table ods_job_hold is
  'ທຸງ "ວຽກມີບັນຫາ" — ວຽກຍັງຢູ່ຂັ້ນເດີມ ແຕ່ແຍກແທັບ ແລະ ນາລິກາຂັ້ນຢຸດ (src/lib/job-hold.ts)';

commit;
