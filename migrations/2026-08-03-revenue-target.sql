-- ═══════════════════════════════════════════════════════════════════
--  ເປົ້າລາຍຮັບລາຍເດືອນ (ບາດ) — ໃຊ້ໃນລາຍງານປະຈຳເດືອນຂອງຜູ້ຈັດການ
--  ຖານ: ODS ເທົ່ານັ້ນ · **ເພີ່ມຢ່າງດຽວ** (ບໍ່ແຕະຂໍ້ມູນເກົ່າ)
--
--  ເມື່ອກ່ອນເປົ້າຢູ່ Excel ຂອງຜູ້ຈັດການ (ຕັ້ງເປັນຍອດລວມຕໍ່ເດືອນ ບໍ່ແຍກໝວດ)
--  ⇒ ເກັບແບບດຽວກັນ: 1 ແຖວ = 1 ເດືອນ. ຢາກແຍກໝວດພາຍຫຼັງຄ່ອຍເພີ່ມຖັນ category.
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists ods_revenue_target (
  year        int not null,
  month       int not null check (month between 1 and 12),
  amount      numeric(18,2) not null default 0,  -- ບາດ
  updated_by  varchar(50),
  updated_at  timestamp not null default localtimestamp(0),
  primary key (year, month)
);

commit;
