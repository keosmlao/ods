# 📚 ຄູ່ມືລະບົບບໍລິຫານງານສ້ອມ & ບໍລິການ ODSS — ສາລະບານ & Index

ເອກະສານຊຸດນີ້ແມ່ນ **ຄູ່ມືການໃຊ້ງານ, ມາດຕະຖານການປະຕິບັດງານ (SOP), ບັດຂັ້ນຕອນ (WI) ແລະ ແບບຟອມ (Forms) ຂອງລະບົບບໍລິຫານງານສ້ອມ, ຕິດຕັ້ງ, ເຄລມ, ບຳລຸງຮັກສາ (PM) ແລະ ສັ່ງຊື້ອາໄຫຼ່ ODSS** (Odien Service System) ຄົບທັງລະບົບ — ສຳລັບ **CS (ຮັບແຈ້ງ), ຊ່າງສ້ອມ (Tech), ຝ່າຍສາງ (Stock), ຫົວໜ້າ (Supervisor), ແລະ Admin**.

> 💡 **ຄູ່ມືໃນແອັບ:** ເປີດ **`/manual`** ໃນລະບົບ (ໜ້າຄູ່ມືການໃຊ້ງານ) — 5 Module Tabs (ສ້ອມ · ຕິດຕັ້ງ · ເຄມ · PM · ຈັດຊື້), 12 Stepper Stages, ພິມ SOP/WI ໄດ້. ເອກະສານ markdown ຊຸດນີ້ (`docs/guide/`) ຄື source of truth ລະອຽດ.

---

## 📂 ເອກະສານໃນຊຸດຄູ່ມື ODSS

| # | ເອກະສານ | ອະທິບາຍ & ຂອບເຂດ | ຜູ້ອ່ານຫຼັກ |
|---|---------|-------------------|-------------|
| 1 | [01. ຄູ່ມືການໃຊ້ງານ (User Manual)](01-user-manual.md) | ອະທິບາຍທຸກໜ້າ/ທຸກເມນູ, ວິທີ Login, ສິດ ແລະ ໝວດຟັງຊັນ | ທຸກຄົນ |
| 2 | [02. Workflow — ຂັ້ນຕອນການເຮັດວຽກ](02-workflow.md) | ຂະບວນການ 5 ໝວດງານ: ງານສ້ອມ (12 Stages), ຕິດຕັ້ງ, ເຄລມ, PM, ຂໍຊື້ອາໄຫຼ່ | CS, ຊ່າງ, ຫົວໜ້າ |
| 3 | [03. SOP — ລະບຽບການປະຕິບັດງານ](03-sop.md) | ມາດຕະຖານ 5 ບົດບາດ (CS, Tech, Stock, Supervisor, Admin), Must Rules, SLA | ທຸກໜ້າທີ່ |
| 4 | [04. WI — ຄຳແນະນຳການເຮັດວຽກ 1-2-3](04-work-instructions.md) | ບັດຂັ້ນຕອນ 1-2-3 ເຮັດຕາມໄດ້ທັນທີ (WI-R1..R8, WI-I1..I4, WI-C1..C4, WI-M1..M3, WI-P1..P4, WI-K1..K2, WI-S1..S3, WI-A1..A3) | ພະນັກງານປະຕິບັດງານ |
| 5 | [05. Forms — ແບບຟອມ & ເອກະສານມາດຕະຖານ](05-forms-templates.md) | ແບບຟອມມາດຕະຖານ F-01..F-14 (Job Ticket, Quotation, QC, PR/PO ...) ພ້ອມໂຄງສ້າງຊ່ອງຂໍ້ມູນ ແລະ ຈຸດເຊື່ອມ WI | CS, ຊ່າງ, ສາງ, ຫົວໜ້າ |

---

## 🔧 4 ປະເພດບໍລິການ/ງານສ້ອມ (Service Types)

| ລະຫັດ | ປະເພດບໍລິການ | ອະທິບາຍ | ສະຖານທີ່ / ວິທີປະຕິບັດ |
|:------:|--------------|---------|-------------------------|
| **CI** | Customer In-shop / Walk-in | ລູກຄ້າຖືເຄື່ອງມາສ້ອມຢູ່ສູນບໍລິການ | ຮັບເຄື່ອງຢູ່ counter counter, ເປີດ Job CI |
| **ST** | Site Repair / Field Service | ງານສ້ອມ/ບໍລິການຢູ່ໜ້າງານ/ເຂດລູກຄ້າ | ເດີນທາງໄປໜ້າງານ, ເປີດ Job ST, ເຊັກອິນ GPS |
| **IH** | In-house Maintenance | ງານສ້ອມ/ບຳລຸງຮັກສາອຸປະກອນພາຍໃນບໍລິສັດ | ສ້ອມເຄື່ອງ/ອຸປະກອນຂອງ ODG ພາຍໃນ |
| **PS** | Preventive Maintenance Service | ງານບຳລຸງຮັກສາຕາມຮອບ/ຕາມສັນຍາ | ເຂົ້າບຳລຸງຮັກສາຕາມປະຕິທິນ PM |

---

## 👥 Role Access Matrix (ຕາຕະລາງສິດການເຂົ້າເຖິງ 5 ບົດບາດ)

| ບົດບາດ (Role) | ຂອບເຂດເມນູຫຼັກ | ວຽກຮັບຜິດຊອບຫຼັກ | SLA ເປົ້າໝາຍ |
|---------------|----------------|-------------------|--------------|
| **CS / ຮັບແຈ້ງ (Customer Service)** | Dashboard, Repair, Installations, Claims, Customers | ຮັບແຈ້ງສ້ອມ, ເປີດ Job, ຕິດຕໍ່ລູກຄ້າ, ແຈ້ງໃບສະເໜີລາຄາ (Quotation), ສົ່ງມອບເຄື່ອງ | ເປີດ Job < 15 ນາທີ |
| **Tech / ຊ່າງສ້ອມ (Technicians)** | Repair, Installations, Maintenance, QC, Mobile App | ວິເຄາະອາການ, ປະເມີນອາໄຫຼ່, ດຳເນີນການສ້ອມ/ຕິດຕັ້ງ/PM, ຖ່າຍຮູບ, ບັນທຶກຜົນ | ວິເຄາະ < 24h |
| **Stock / ຝ່າຍສາງອາໄຫຼ່ (Warehouse)** | Spare Parts, Stock, Purchase Requests/Orders | ຈັດການ Master ອາໄຫຼ່, ອະນຸມັດເບີກ, ເຮັດ PR ຂໍຊື້ອາໄຫຼ່, ຮັບເຄື່ອງເຂົ້າສາງ (Stock In) | ເບີກອາໄຫຼ່ < 30m |
| **Supervisor / ຫົວໜ້າ (Manager)** | Approvals, QC, Reports, Dashboard, PR/PO | ອະນຸມັດ Job/Quotation, ອະນຸມັດ PR/PO, ກວດ QC, ຕິດຕາມ KPI & Reports | ອະນຸມັດ < 2h |
| **Admin / ຜູ້ດູແລລະບົບ** | Manage, Master Data, Users, Audit Log | Master Data, ສິດ 5 Roles, Audit Log, Backup, System Security | 24/7 Availability |

---

## 📖 ຄຳສັບຫຍໍ້ ແລະ ຄວາມໝາຍ (Glossary)

| ຄຳສັບ | ຄວາມໝາຍ |
|-------|---------|
| **Job / Service Ticket** | ໃບງານສ້ອມ/ບໍລິການ 1 ລາຍການ |
| **CI / ST / IH / PS** | ປະເພດບໍລິການ (Customer In-shop, Site Repair, In-house, Preventive Maintenance) |
| **Quotation / ໃບສະເໜີລາຄາ** | ໃບສະເໜີຄ່າສ້ອມ/ຄ່າອາໄຫຼ່ ໃຫ້ລູກຄ້າອະນຸມັດກ່ອນສ້ອມ |
| **Spare Parts Request / ໃບເບີກອາໄຫຼ່** | ໃບຂໍເບີກອາໄຫຼ່ຈາກສາງເພື່ອໃຊ້ໃນງານສ້ອມ |
| **QC Checksheet** | ໃບກວດສອບຄຸນນະພາບ ຫຼັງສ້ອມ/ຕິດຕັ້ງສຳເລັດ |
| **PR (Purchase Request)** | ໃບຂໍຊື້ອາໄຫຼ່/ອຸປະກອນ |
| **PO (Purchase Order)** | ໃບສັ່ງຊື້ອາໄຫຼ່/ອຸປະກອນ ຫາ Vendor |
| **Claim / ໃບເຄມ** | ເອກະສານການຄ້າທີ່ຫ້ອຍຢູ່ກັບໃບงານສ້ອມ (ຜູກ `ref_job`) — 3 ປະເພດ: **B** ຮ້ານສົ່ງມາເຄມ (ຈົບຢູ່ສູນ) · **A** ຂໍອາໄຫຼ່ກັບ supplier · **C** ເກັບເງິນຄ່າສ້ອມ ນຳ supplier |
| **claim_scope** | ຂອບເຂດ CLM-B: `whole` ທັງໜ່ວຍ · `part` ສະເພາະອາໄຫຼ່ |
| **fulfillment_source** | ວິທີປ່ຽນ CLM-B: `stock` ຈາກສາງສູນ · `purchase` ສັ່ງຊື້ · `supplier` ເຄມຕໍ່ supplier |

---
_ຮັກສາເອກະສານນີ້ໃຫ້ທັນສະໄໝຢູ່ສະເໝີ. ເມື່ອມີການປ່ຽນແປງຂະບວນການ ໃຫ້ອັບເດດເອກະສານທີ່ກ່ຽວຂ້ອງທັນທີ._
