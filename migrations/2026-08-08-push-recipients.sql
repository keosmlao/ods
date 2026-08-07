-- ── ຜູ້ຮັບແຈ້ງເຕືອນເຂົ້າມືຖື (push) ທີ່ຜູ້ຈັດການກຳນົດເອງ ─────────────────────────
-- ຈັດການທີ່ /manage/push-recipients
--
-- ກົດ (ຄືກັນກັບ ods_setting): **ບໍ່ມີແຖວ = ບໍ່ໄດ້ກຳນົດ ⇒ ສົ່ງຕາມ role ຄືເກົ່າ**
--   active = true   ⇒ ຕື່ມຄົນນີ້ເຂົ້າ (ເຖິງ role ຂອງລາວຈະບໍ່ຢູ່ໃນຄ່າຕັ້ງຕົ້ນ)
--   active = false  ⇒ ຕັດຄົນນີ້ອອກ (ເຖິງ role ຂອງລາວຈະຢູ່ໃນຄ່າຕັ້ງຕົ້ນ)
-- ⇒ ຜົນຈິງ = (ຄ່າຕັ້ງຕົ້ນຕາມ role ∪ ຄົນທີ່ເປີດ) − ຄົນທີ່ປິດ  (ເບິ່ງ lib/push-recipient)
--
-- ⚠️ `username` ຕ້ອງເປັນ **session.username** (ລະຫັດພະນັກງານ ຖ້າເຊື່ອມແລ້ວ, ບໍ່ດັ່ງນັ້ນຊື່ຫຼິ້ນ)
--    ຄືກັນກັບ ods_push_token.user_code — ເບິ່ງ lib/session-identity. ໃສ່ຊື່ຜິດຮູບແບບ = ບໍ່ມີຜົນຫຍັງ.
create table if not exists ods_push_recipient (
  kind varchar(20) not null,          -- 'approval' = ລໍອະນຸມັດ · 'digest' = ສະຫຼຸບການເຄື່ອນໄຫວ
  username varchar(100) not null,
  active boolean not null default true,
  updated_by varchar(50),
  updated_at timestamp not null default localtimestamp(0),
  primary key (kind, username)
);
