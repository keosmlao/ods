-- ── IH: ເວລາ "ນັດ/ຈັດຊ່າງ" (dispatch_at) — 19-07-2026 ──
-- appoint_date ເປັນ **date** (ວັນນັດ) ບໍ່ບອກວ່າ CS ຈັດຊ່າງ **ເມື່ອໃດ** ⇒ ວັດ "ໄວການນັດ" ບໍ່ໄດ້.
-- dispatch_at = timestamp ຕອນຕັ້ງວັນນັດ+ຈັດຊ່າງຄັ້ງທຳອິດ ⇒ ວັດ register→dispatch (KPI front-stage).
-- ເກັບຈາກນີ້ໄປ (ໃບເກົ່າ null). PS ໃຊ້ pickup_start/pickup_at ທີ່ມີແລ້ວ.

alter table tb_product add column if not exists dispatch_at timestamp;
