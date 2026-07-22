-- ⚠️ ຕາຕະລາງນີ້ RUN ໃສ່ **SML (odg / ODG_DATABASE_URL)** — ບໍ່ແມ່ນ ODS ຄືໄຟລ໌ migration ອື່ນ.
--
-- ສ້າງ **ລູກຄ້າສູນບໍລິການໂຕດຽວ** ໃນທະບຽນ SML ໃຫ້ໃບຮັບເງິນ SIN… (cb_trans) ລົງບັນຊີໃສ່.
-- ລູກຄ້າຈິງ (ນິທູນາ…) ດຶງຈາກ job ໄປຢູ່ description/remark ຂອງໃບ — ບໍ່ສ້າງລູກຄ້າຮ້ອຍພັນໂຕໃນ SML.
-- ລະຫັດ 01-3435 = ໂຕຖັດໄປທີ່ຫວ່າງ (ສູງສຸດປັດຈຸບັນ 01-3434). ຕ້ອງກົງກັບ RECEIPT.AR_CODE ໃນ src/lib/erp-receipt.ts.
--
-- ⚠️ ຕ້ອງ run ໄຟລ໌ນີ້ **ກ່ອນ** deploy ໂຄ້ດ erp-receipt — ບໍ່ດັ່ງນັ້ນໃບຮັບເງິນຈະ rollback (SML ບໍ່ຮູ້ຈັກ ap_ar_code).

insert into ar_customer (code, name_1, name_2, ar_type, status, price_level, remark)
values ('01-3435', 'ລູກຄ້າສູນບໍລິການ (ODSS)', 'ODSS Service Center Customer', '01', 0, 0,
        'ລູກຄ້າລວມຂອງໃບຮັບເງິນສູນບໍລິການ — ຊື່ລູກຄ້າຈິງຢູ່ description/remark ຂອງແຕ່ລະໃບ')
on conflict (code) do nothing;
