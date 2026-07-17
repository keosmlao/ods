-- ═══════════════════════════════════════════════════════════════════
--  ການຊຳລະຄ່າສ້ອມ + ປະເພດລູກຄ້າ (ຮ້ານຄ້າ / ທົ່ວໄປ)
--  ຖານ: ODS ເທົ່ານັ້ນ · **ເພີ່ມຢ່າງດຽວ** (ບໍ່ລຶບ ບໍ່ແກ້ຂໍ້ມູນເກົ່າ)
--
--  ── ບັນຫາ 1: ບໍ່ມີບ່ອນເກັບ "ລູກຄ້າຈ່າຍເງິນແລ້ວ" ເລີຍ ──
--  ວັດຈາກຂໍ້ມູນຈິງ (17-07-2026):
--    ໃບສະເໜີລາຄາ (ic_trans trans_flag=17)  1,089 ໃບອະນຸມັດ = 3,362,569 ບາດ  ← ເງິນຢູ່ນີ້
--    ໃບຮັບເງິນ (ic_trans trans_flag=44)     4,456 ໃບ · **ຍອດ 0.00 ທຸກໃບ**   ← ບໍ່ເຄີຍໃສ່ລາຄາ
--    ແຖວຂອງໃບຮັບເງິນ (ic_trans_detail)      price 0 · sum_amount 0 ທຸກແຖວ
--    ໃບ SIN **ບໍ່ເຄີຍໄປຮອດ ERP** (ຫາໃນ ERP ບໍ່ພົບຈັກໃບ) ແລະ ລູກຄ້າສ້ອມສ່ວນຫຼາຍ
--    ບໍ່ມີ ref_code ຜູກກັບ ERP ⇒ ໜີ້ບໍ່ໄດ້ຢູ່ລະບົບບັນຊີ ERP ຄືກັນ.
--  ⇒ ຄຳຖາມ "ໃຜຍັງບໍ່ຈ່າຍ" ຕອບບໍ່ໄດ້ ເພາະບໍ່ມີໃຜເຄີຍບັນທຶກວ່າໃຜຈ່າຍ.
--
--  ── ບັນຫາ 2: ບໍ່ມີຖັນ "ຮ້ານຄ້າ ຫຼື ລູກຄ້າທົ່ວໄປ" ──
--  ODS ar_customer.ar_type: null 10,040 ແຖວ (ມີຄ່າແຕ່ 5 ແຖວ: erp/walkin) ⇒ ໃຊ້ບໍ່ໄດ້.
--  ERP ar_customer.ar_type ເປັນປະເພດ**ບັນຊີ** (01 ລູກໜີ້ການຄ້າ = 20,371/20,611) ບໍ່ແມ່ນ
--  ປະເພດຮ້ານ ແລະ ລູກຄ້າສ້ອມສ່ວນຫຼາຍບໍ່ມີໃນ ERP ຢູ່ແລ້ວ.
--  ຈັບຈາກຊື່ໄດ້ພຽງບາງສ່ວນ (ຮ້ານ%/ບໍລິສັດ% = 625/2,123 ງານ = 29%) ແຕ່ "ນ້ອຍ · 13 ງານ"
--  ຫຼື "LTH · 9 ງານ" ແຍກບໍ່ອອກ ⇒ ຕ້ອງໃຫ້ຄົນລະບຸເອງ ແລະ ແກ້ໄດ້.
--
--  ── ວິທີ ──
--  ① ຕາຕະລາງໃໝ່ `ods_service_payment` — 1 ງານ ຈ່າຍໄດ້**ຫຼາຍງວດ** (ມັດຈຳ + ຈ່າຍຄົບ)
--     ຈຶ່ງເປັນຕາຕະລາງ ບໍ່ແມ່ນຖັນໃນ tb_product. ຄ້າງຊຳລະ = ຍອດ QT ອະນຸມັດ − ຜົນລວມທີ່ຈ່າຍ.
--  ② ຖັນ `ar_customer.cust_kind` — 'shop' / 'general' · null = ຍັງບໍ່ລະບຸ
--     **ບໍ່ເດົາໃສ່ໃຫ້ອັດຕະໂນມັດ** — ລາຍງານຈະສະແດງ "ຍັງບໍ່ລະບຸ" ໃຫ້ຄົນມາລະບຸເອງ
--     (ເດົາຈາກຊື່ແລ້ວຂຽນລົງຖານ = ຂໍ້ມູນຜິດທີ່ບໍ່ມີໃຜຮູ້ວ່າຜິດ).
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ① ການຊຳລະຄ່າສ້ອມ ───────────────────────────────────────────────
create table if not exists ods_service_payment (
  id            bigserial primary key,
  /** ລະຫັດງານສ້ອມ (tb_product.code) */
  job_code      varchar(50) not null,
  /** ຍອດທີ່ຮັບ — ສະກຸນບາດ ຄືກັບໃບສະເໜີລາຄາ (ic_trans.total_amount) */
  amount_thb    numeric(18,2) not null check (amount_thb > 0),
  /** ວັນທີຮັບເງິນ (ອາດບໍ່ແມ່ນມື້ບັນທຶກ) */
  paid_on       date not null default current_date,
  /** ຮັບເປັນຫຍັງ: cash · transfer · other */
  method        varchar(20) not null default 'cash',
  /** ເລກອ້າງອີງ (ສະລິບໂອນ / ເລກໃບຮັບເງິນ) */
  reference     varchar(100),
  note          varchar(300),
  /** ຜູ້ບັນທຶກ (users.username) */
  created_by    varchar(50) not null,
  created_at    timestamp not null default localtimestamp(0)
);

create index if not exists ods_service_payment_job_idx on ods_service_payment (job_code);
create index if not exists ods_service_payment_paid_on_idx on ods_service_payment (paid_on);

comment on table ods_service_payment is
  'ການຊຳລະຄ່າສ້ອມຂອງລູກຄ້າ — ບ່ອນດຽວທີ່ບັນທຶກເງິນເຂົ້າຂອງງານສ້ອມ. ໃບຮັບເງິນເກົ່າ (ic_trans trans_flag=44, SIN) ຍອດ 0 ທຸກໃບ ຈຶ່ງໃຊ້ບໍ່ໄດ້. ຄ້າງຊຳລະ = ຍອດໃບສະເໜີລາຄາທີ່ອະນຸມັດ (trans_flag=17, aprove_status=1) ລົບ ຜົນລວມຂອງຕາຕະລາງນີ້. 1 ງານມີໄດ້ຫຼາຍງວດ.';

-- ② ປະເພດລູກຄ້າ ──────────────────────────────────────────────────
alter table ar_customer add column if not exists cust_kind varchar(10);

alter table ar_customer drop constraint if exists ar_customer_cust_kind_check;
alter table ar_customer add constraint ar_customer_cust_kind_check
  check (cust_kind is null or cust_kind in ('shop', 'general'));

comment on column ar_customer.cust_kind is
  'ປະເພດລູກຄ້າສຳລັບລາຍງານງານສ້ອມ: shop = ຮ້ານຄ້າ/ບໍລິສັດ (ສ້ອມເພື່ອຂາຍຕໍ່/ໃຊ້ໃນກິດຈະການ) · general = ລູກຄ້າທົ່ວໄປ · null = ຍັງບໍ່ໄດ້ລະບຸ. ບໍ່ backfill ຈາກຊື່ — ໃຫ້ຄົນລະບຸເອງຢູ່ໜ້າລູກຄ້າ.';

commit;
