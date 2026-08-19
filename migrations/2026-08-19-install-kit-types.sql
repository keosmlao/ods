-- ═══════════════════════════════════════════════════════════════════════════
-- **ໝວດຊຸດອາໄຫຼ່ມາດຕະຖານງານຕິດຕັ້ງ** (`ods.install_kit_type`) — 19-08-2026 ຕາມຄຳສັ່ງ
--
-- ── ເປັນຫຍັງ ──
-- 5 ໝວດ (9900-0016 … 9900-0020) ເຄີຍ **ຝັງຢູ່ໃນໂຄ້ດ** (`INSTALL_KIT_TYPES` ຂອງ
-- lib/install-kit) ⇒ ຢາກເພີ່ມໝວດທີ 6 ຕ້ອງແກ້ໂຄ້ດ ແລະ deploy ໃໝ່. ຕາຕະລາງ
-- `used_spare_install` ເກັບແຕ່ **ລາຍການ**ຂອງແຕ່ລະໝວດ ບໍ່ມີບ່ອນເກັບຕົວໝວດເອງ
-- ⇒ ໝວດທີ່ຍັງບໍ່ມີລາຍການ "ບໍ່ມີຕົວຕົນ" ໃນຖານເລີຍ.
--
-- ── ໝວດແບ່ງຕາມຫຍັງ ──
-- ຕາມ **ຂະໜາດ BTU** ຂອງແອ. ຄີທີ່ແທ້ຈິງຂອງການແບ່ງແມ່ນ `ic_inventory.item_size`
-- ຂອງ ERP ຊຶ່ງ join ໄປ `ic_size` ແລ້ວໄດ້ຊື່ທີ່ **ເປັນຊ່ວງ BTU ພ້ອມແລ້ວ**
-- ("11,000-14,999 btu." — ເບິ່ງ lib/commission) ⇒ ຕາຕະລາງນີ້ຈຶ່ງເກັບຄູ່
-- `install_type` ↔ `ic_size` ໄວ້ ແລ້ວຕອນອ່ານບິນລະບົບແປງໃຫ້ອັດຕະໂນມັດ.
--
-- ⚠️ `ic_size` ຢູ່ **ຖານ ERP** (ODG_DATABASE_URL) ຄົນລະຖານກັບ `ods` ⇒ join ຂ້າມຖານ
-- ບໍ່ໄດ້. lib/install-kit ຈຶ່ງອ່ານຄູ່ນີ້ອອກມາແລ້ວ**ສ້າງ `case ... end`** ໃສ່ SQL ຂອງ
-- ບິນ (api/installations/bills). ນີ້ຄືເຫດຜົນທີ່ຄູ່ນີ້ຕ້ອງເປັນຄ່າສັ້ນ/ສະອາດ —
-- ໂຄ້ດກວດ regex ກ່ອນຕໍ່ເຂົ້າ SQL.
--
-- ⚠️ **ໝວດທີ່ບໍ່ໄດ້ຜູກ `ic_size`** (null) = ບໍ່ຖືກຈັບຄູ່ອັດຕະໂນມັດຕອນອ່ານບິນ.
-- ຍັງມີປະໂຫຍດ (ຕັ້ງໄວ້ລ່ວງໜ້າ · ຕິດຕັ້ງປະເພດອື່ນທີ່ຈັດຊຸດເອງ) ແຕ່ໜ້າຈັດການ
-- ຕ້ອງເຕືອນ ບໍ່ດັ່ງນັ້ນຄົນສ້າງໝວດແລ້ວລໍວ່າເປັນຫຍັງງານໃໝ່ບໍ່ໄດ້ຊຸດ.
--
-- ── ວິທີແລ່ນ ──
--   psql "$DATABASE_URL" -f migrations/2026-08-19-install-kit-types.sql
-- ແລ່ນຊ້ຳໄດ້ (if not exists / on conflict do nothing).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists ods.install_kit_type (
  -- ລະຫັດໝວດ = ຄ່າທີ່ໄປລົງ `ods_tb_install.install_type` ແລະ `used_spare_install.install_type`
  install_type varchar(25) primary key,
  -- ຊື່ທີ່ຄົນອ່ານ — ຕັ້ງຕົ້ນເປັນຊ່ວງ BTU ("20,000-29,999 btu.")
  name_1       varchar(255) not null default '',
  -- `ic_size.code` ຂອງ ERP ທີ່ໝວດນີ້ຄຸມ. null = ບໍ່ຈັບຄູ່ອັດຕະໂນມັດ (ເບິ່ງຄຳເຕືອນເທິງ)
  ic_size      varchar(25),
  -- ລຳດັບທີ່ສະແດງຢູ່ໜ້າຈັດການ (ໃຫຍ່ → ນ້ອຍ ຕາມ BTU)
  sort_order   integer not null default 0,
  -- 0 = ເຊົາໃຊ້ (ບໍ່ຈັບຄູ່ບິນໃໝ່ອີກ) ແຕ່ **ບໍ່ລົບ** ⇒ ງານເກົ່າທີ່ອ້າງອີງຢູ່ຍັງອ່ານໄດ້
  active       smallint not null default 1,
  create_date_time_now timestamp default localtimestamp(0)
);

comment on table ods.install_kit_type is
  'ໝວດຊຸດອາໄຫຼ່ມາດຕະຖານງານຕິດຕັ້ງ — ຄູ່ install_type ↔ ic_size ຂອງ ERP (ເຄີຍ hardcode ໃນ lib/install-kit)';

/**
 * ໝວດ**ທີ່ໃຊ້ງານຢູ່** ຜູກ `ic_size` ດຽວກັນສອງໝວດບໍ່ໄດ້ — `case ... end` ທີ່ສ້າງຈາກ
 * ຕາຕະລາງນີ້ຈະຈັບອັນທຳອິດທີ່ຕົງ ⇒ ຊຸດທີສອງບໍ່ມີວັນຖືກໃຊ້ ແລະ ຄົນຕັ້ງຄ່າຫາສາເຫດບໍ່ພົບ.
 * ໝວດທີ່ປິດແລ້ວ (active=0) ບໍ່ນັບ — ປ່ຽນໝວດໃໝ່ມາຮັບ ic_size ເກົ່າໄດ້.
 */
create unique index if not exists uq_install_kit_type_size
  on ods.install_kit_type (ic_size)
  where ic_size is not null and active = 1;

-- ── ຂໍ້ມູນຕັ້ງຕົ້ນ = 5 ໝວດທີ່ເຄີຍຝັງຢູ່ໃນໂຄ້ດ (ຄູ່ ic_size ຄືເກົ່າ 100%) ──
-- `sort_order` ໃຫຍ່ = BTU ສູງ ⇒ ໜ້າຈັດການລຽງ 30,000+ ລົງມາ 8,000
insert into ods.install_kit_type (install_type, name_1, ic_size, sort_order, active) values
  ('9900-0016', 'ຕັ້ງແຕ່ 30,000 btu. ຂຶ້ນໄປ', '121', 50, 1),
  ('9900-0017', '20,000-29,999 btu.',        '051', 40, 1),
  ('9900-0018', '15,000-19,999 btu.',        '033', 30, 1),
  ('9900-0019', '11,000-14,999 btu.',        '023', 20, 1),
  ('9900-0020', '8,000-10,999 btu.',         '112', 10, 1)
on conflict (install_type) do nothing;
