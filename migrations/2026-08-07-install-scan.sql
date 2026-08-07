-- ═══════════════════════════════════════════════════════════════════════════
-- **ສະແກນ ISN/SN ຂອງງານຕິດຕັ້ງ** — 2 ຈຸດ: ຕອນກຳລັງຕິດຕັ້ງ ແລະ ຕອນກົດຕິດຕັ້ງສຳເລັດ
--
-- ── ເປັນຫຍັງ ──
-- ໃບງານຮູ້ຢູ່ແລ້ວວ່າ**ຄວນ**ຕິດເຄື່ອງເລກໃດ (`pro_sn` ໜ່ວຍໃນ · `pro_sn_out` ໜ່ວຍນອກ —
-- ດຶງມາຈາກ ISN ທີ່ຂາຍໃນບິນຕອນເປີດງານ) ແຕ່**ບໍ່ເຄີຍມີການພິສູດ**ວ່າເຄື່ອງທີ່ຕິດຈິງແມ່ນໜ່ວຍນັ້ນ
-- ⇒ ສັບໜ່ວຍກັນ · ຕິດຜິດບ້ານ ຮູ້ພາຍຫຼັງຕອນລູກຄ້າມາເຄມ.
-- ດຽວນີ້ຊ່າງສະແກນປ້າຍດ້ວຍກ້ອງ (ບໍ່ຕ້ອງພິມ) ແລ້ວລະບົບທຽບກັບໃບງານໃຫ້ທັນທີ.
--
-- ຮັບໄດ້ທັງ **ISN** (ປ້າຍ ODIEN) ແລະ **SN ໂຮງງານ** — ແປງຫາກັນຜ່ານ ERP `sn_inventory`.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists ods_install_scan (
  id          serial primary key,
  job_code    varchar(30) not null,
  -- 'install' = ຕອນກຳລັງຕິດຕັ້ງ · 'finish' = ຕອນກົດຕິດຕັ້ງສຳເລັດ
  phase       varchar(10) not null,
  -- ຄ່າດິບທີ່ສະແກນມາ (ISN ຫຼື SN — ເກັບໄວ້ຕາມທີ່ຍິງມາ ເພື່ອສືບຍ້ອນຫຼັງໄດ້)
  scanned     varchar(60) not null,
  -- ຜົນການທຽບ: 'indoor' = ຕົງ pro_sn · 'outdoor' = ຕົງ pro_sn_out
  matched     varchar(10) not null,
  isn         varchar(60),
  sn          varchar(60),
  tech_code   varchar(50),
  scanned_at  timestamp not null default localtimestamp
);

create index if not exists idx_install_scan_job on ods_install_scan (job_code, phase);
