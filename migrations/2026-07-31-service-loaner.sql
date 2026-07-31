-- ── ເຄື່ອງສຳຮອງ (loaner) ຂອງງານສ້ອມ ──────────────────────────────────────
--
-- ບັນຫາ: ລູກຄ້າບາງລາຍຕ້ອງມີເຄື່ອງໃຊ້ລະຫວ່າງລໍສ້ອມ ⇒ ສູນເອົາ "ເຄື່ອງສຳຮອງ" ໃຫ້ໄປໃຊ້ກ່ອນ.
-- ແຕ່ກ່ອນລະບົບບໍ່ມີບ່ອນບັນທຶກ ⇒ ຂຽນໃສ່ໝາຍເຫດເອົາ ຫຼື ຈື່ເອົາ ⇒ ບໍ່ຮູ້ວ່າໜ່ວຍໃດຢູ່ບ້ານໃຜ
-- ແລະ ບໍ່ຮູ້ວ່າຄືນຫຼືຍັງ. ຕາຕະລາງນີ້ຄືທະບຽນ "ໃຫ້ຢືມ → ຮັບຄືນ" ຂອງແຕ່ລະໃບງານ.
--
-- ຂອບເຂດ (ຕົກລົງ 31-07-2026):
--   · ເຄື່ອງສຳຮອງເປັນ **ຊັບສິນຂອງສູນ** ບໍ່ແມ່ນສິນຄ້າຂາຍ ⇒ **ບໍ່ຕັດສະຕັອກ ERP**
--     (ບໍ່ມີເອກະສານເບີກ/ຄືນ — ທະບຽນນີ້ຄືຄວາມຈິງບ່ອນດຽວ)
--   · ຜູກ **ISN** ຂອງໜ່ວຍທີ່ໃຫ້ຢືມ ⇒ ຮູ້ວ່າໜ່ວຍໃດຢູ່ໃສ ແລະ ກັນໃຫ້ຢືມຊ້ອນກັນ
--   · ຍັງບໍ່ຮັບຄືນ ⇒ **ສົ່ງເຄື່ອງຄືນລູກຄ້າ/ປິດງານບໍ່ໄດ້** (ດ່ານຢູ່ actions/return.ts)

create table if not exists ods_loaner (
  id          serial primary key,
  /** ໃບງານສ້ອມ (tb_product.code) */
  job_code    varchar(50) not null,
  /** ລະຫັດສິນຄ້າ ERP ຂອງໜ່ວຍທີ່ໃຫ້ຢືມ (ຮູ້ຈາກ ISN — ບໍ່ບັງຄັບ) */
  item_code   varchar(50),
  item_name   varchar(255) not null,
  /** ເລກປ້າຍ (ISN) — ບັງຄັບ: ບໍ່ມີເລກ = ຕິດຕາມໜ່ວຍບໍ່ໄດ້ */
  isn         varchar(100) not null,
  /** ເລກໂຮງງານ (ຖ້າ ERP ຮູ້) */
  sn          varchar(100),
  lend_time   timestamp not null default localtimestamp(0),
  lend_by     varchar(100) not null,
  lend_note   varchar(255),
  return_time timestamp,
  return_by   varchar(100),
  return_note varchar(255)
);

create index if not exists ods_loaner_job_idx on ods_loaner (job_code);
create index if not exists ods_loaner_open_idx on ods_loaner (return_time) where return_time is null;

-- ໜ່ວຍນຶ່ງໃຫ້ຢືມໄດ້ບ່ອນດຽວໃນເວລາດຽວ — ກັນ "ISN ດຽວຢູ່ 2 ບ້ານ"
create unique index if not exists ods_loaner_isn_open_uniq
  on ods_loaner (isn) where return_time is null;
