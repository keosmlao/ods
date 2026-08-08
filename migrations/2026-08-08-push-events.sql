-- ── ຍິງອັນໃດເຂົ້າແອັບ (Firebase push) ທີ່ຜູ້ຈັດການເປີດ/ປິດເອງ ────────────────────
-- ຈັດການທີ່ /manage/push-recipients
--
-- ກົດ: **ບໍ່ມີແຖວ = ເປີດ** (ຄືພຶດຕິກຳກ່ອນມີໜ້ານີ້) ⇒ ເກັບສະເພາະອັນທີ່ຖືກ**ປິດ**ກໍ່ພໍ
--      ແຕ່ເກັບ enabled ໄວ້ນຳ ເພື່ອໃຫ້ເຫັນວ່າ "ຕັ້ງໃຈເປີດ" ຕ່າງຈາກ "ຍັງບໍ່ເຄີຍແຕະ".
--
-- ⚠️ ຄຸມແຕ່ **push ເຂົ້າມືຖື**. ແຖວໃນ `ods_notification` ຍັງຂຽນຄົບ 100% ⇒ ກ່ອງແຈ້ງເຕືອນ
--    ຢູ່ເວັບ/ໃນແອັບເຫັນທຸກຢ່າງຄືເກົ່າ ແລະ ໄລ່ຫາຫຼັງໄດ້. ອັນນີ້ຄຸມສຽງເອີ້ນຢ່າງດຽວ.
create table if not exists ods_push_event (
  model varchar(40) not null,       -- ods_notification.model — ods_tb_install · tb_product · ...
  kind varchar(20) not null,        -- ods_notification.kind  — log · assign · comment
  enabled boolean not null default true,
  updated_by varchar(50),
  updated_at timestamp not null default localtimestamp(0),
  primary key (model, kind)
);
