-- ບັນທຶກວ່າ **ຍິງສະຫຼຸບຕອນເຊົ້າໃຫ້ໃຜໄປແລ້ວແດ່ໃນມື້ນັ້ນ** (ກັນຍິງຊ້ຳ)
--
-- cron ແລ່ນທຸກໆ 30 ນາທີກໍ່ໄດ້ ໂດຍຊ່າງບໍ່ຖືກລົບກວນຊ້ຳ — ດ່ານກັນຊ້ຳຢູ່ຕາຕະລາງນີ້
-- ບໍ່ແມ່ນຢູ່ຕາຕະລາງເວລາຂອງ cron (cron ພາດໄດ້ · server restart ໄດ້).
create table if not exists ods_day_brief (
  tech_code varchar(100) not null,
  sent_on   date         not null,
  jobs      int          not null default 0,
  sent_at   timestamp    not null default localtimestamp(0),
  primary key (tech_code, sent_on)
);

comment on table ods_day_brief is
  'ສະຫຼຸບນັດຕອນເຊົ້າທີ່ຍິງໄປແລ້ວ — 1 ແຖວ = 1 ຄົນ/1 ມື້ (lib/day-brief.ts)';
