-- ── ປິດງານສ້ອມ (job_close) ────────────────────────────────────────────────────
--
-- ຝັ່ງ**ຕິດຕັ້ງ** ມີຂັ້ນປິດງານມາແຕ່ຕົ້ນ (`ods_tb_install.job_finish` → ຂັ້ນ 9) ແຕ່ຝັ່ງ
-- **ສ້ອມ** ຈົບຢູ່ "ສົ່ງຄືນສຳເລັດ" (ຂັ້ນ 12 = `return_complete` ມີຄ່າ) ແລ້ວບໍ່ມີບ່ອນໝາຍວ່າ
-- ໃບນັ້ນ **ປິດແລ້ວ** ⇒ ບໍ່ມີທາງແຍກ "ສົ່ງຄືນແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ກວດປິດ" ອອກຈາກ
-- "ປິດຮຽບຮ້ອຍແລ້ວ" (04-08-2026 ມີ 5,082 ໃບທີ່ສົ່ງຄືນແລ້ວ).
--
-- ຖັນນີ້ **ບໍ່ໄດ້ຢູ່ໃນ STAGE_SQL** — ຂັ້ນຂອງໃບຍັງເປັນ 12 ຄືເກົ່າ ⇒ ຄິວ/ລາຍງານ/KPI ທັງໝົດ
-- ບໍ່ຂະຫຍັບ. ໃຊ້ພຽງເປັນຕົວກອງຂອງໜ້າ "ປິດງານ" (/close-jobs).
--
-- ໃບເກົ່າປະ null ໄວ້ (= ຍັງບໍ່ປິດ) — ບໍ່ backfill ເພາະບໍ່ຮູ້ວ່າໃບໃດຖືກກວດປິດແທ້.

alter table tb_product add column if not exists job_close timestamp;
alter table tb_product add column if not exists job_close_by varchar(50);

comment on column tb_product.job_close is
  'ເວລາປິດງານສ້ອມ (ຫຼັງສົ່ງຄືນລູກຄ້າ) — null = ຍັງຢູ່ຄິວ /close-jobs';
comment on column tb_product.job_close_by is 'ຜູ້ກົດປິດງານ';

-- ຄິວປິດງານຖາມ "ສົ່ງຄືນແລ້ວ ແຕ່ຍັງບໍ່ປິດ" ທຸກເທື່ອ ⇒ index ສະເພາະແຖວທີ່ຍັງບໍ່ປິດ
create index if not exists tb_product_close_queue_idx
  on tb_product (return_complete desc)
  where job_close is null;
