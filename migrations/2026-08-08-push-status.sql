-- ── ສະຖານະໃດ ຄວນແຈ້ງໃຜ (Firebase push) ───────────────────────────────────────
-- ຈັດການທີ່ /manage/push-recipients
--
-- ⚠️ ຕາຕະລາງນີ້ເກັບແຕ່ **ອັນທີ່ຜູ້ຈັດການແກ້ເອງ**. ຄ່າຕັ້ງຕົ້ນຢູ່ໃນໂຄ້ດ
--    (`PUSH_STATUS_DEFAULT` — lib/push-status-shared) ⇒ ບໍ່ຕ້ອງ seed, ຖານລົ້ມກໍ່ຍັງໄດ້
--    ພຶດຕິກຳທີ່ຕັ້ງໃຈ, ແລະ ຕອນເພີ່ມຂັ້ນໃໝ່ໃນອະນາຄົດບໍ່ຕ້ອງໄປຕື່ມແຖວໃສ່ຖານ.
--
-- ⚠️ ຄຸມແຕ່ **push ເຂົ້າມືຖື**. ແຖວໃນ `ods_notification` ຍັງຂຽນຄົບ 100% ⇒ ກ່ອງແຈ້ງເຕືອນ
--    ຢູ່ເວັບ/ໃນແອັບເຫັນທຸກຢ່າງຄືເກົ່າ.
create table if not exists ods_push_status (
  workflow varchar(20) not null,   -- install · repair · claim
  stage smallint not null,         -- ຂັ້ນຈາກ STAGE_SQL / INSTALL_STAGE_SQL (-1 = ຍົກເລີກ)
  role varchar(20) not null,       -- manager · headtechnical · admin · stock
  enabled boolean not null,
  updated_by varchar(50),
  updated_at timestamp not null default localtimestamp(0),
  primary key (workflow, stage, role)
);
