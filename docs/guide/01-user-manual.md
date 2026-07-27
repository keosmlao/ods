# 📖 ຄູ່ມືການໃຊ້ງານ ODSS (User Manual)

ເອກະສານນີ້ອະທິບາຍ **ທຸກໜ້າ / ທຸກເມນູ / ທຸກຟັງຊັນ** ຂອງລະບົບບໍລິຫານງານສ້ອມ ODSS (Odien Service System).

---

## 1. ການເຂົ້າສູ່ລະບົບ (Login & Session)

1. ເປີດ Browser ໄປທີ່ URL ລະບົບ ODSS (ເຊັ່ນ `https://odss.odien.net`).
2. ປ້ອນ **ຊື່ຜູ້ໃຊ້ (Username)** ແລະ **ລະຫັດຜ່ານ (Password)** (ບັນຊີ ODG Enterprise).
3. ກົດ **ເຂົ້າສູ່ລະບົບ**.
4. ເມື່ອ Login ສຳເລັດ ລະບົບຈະພາໄປໜ້າ **Dashboard** ຕາມສິດ 5 Roles.

> 🔒 **Security Notice:** Session ໃຊ້ໄດ້ 8 ຊົ່ວໂມງ. ຖ້າບໍ່ມີກິດຈະກຳເກີນ 30 ນາທີ ລະບົບຈະ Auto-lock ໃຫ້ປ້ອນລະຫັດຜ່ານໃໝ່.

---

## 2. ໜ້າຫຼັກ (Dashboard Overview)

- **Job Status Counters:** ສະຫຼຸບຈຳນວນ Job (ຮັບໃໝ່, ກຳລັງວິເຄາະ, ລໍອະນຸມັດ Quotation, ລໍອາໄຫຼ່, ກຳລັງສ້ອມ, ລໍ QC, ພ້ອມສົ່ງມອບ).
- **Service Map:** ແຜນທີ່ສະແດງຕຳແໜ່ງຊ່າງ Site Repair (ST) ແລະ ງານຕິດຕັ້ງ Realtime.
- **Urgent Alerts & SLA Warnings:** ແຈ້ງເຕືອນ Job ໃກ້ເກີນ SLA 24h/48h.

---

## 3. ໝວດ "ງານສ້ອມແປງ" (Repair Management)

### 3.1 ຮັບແຈ້ງສ້ອມ (`/repair/new`)
- ປ້ອນຂໍ້ມູນລູກຄ້າ, ຂໍ້ມູນອຸປະກອນ (Serial No, Model, ຍີ່ຫໍ້), ອາການເສຍ (Symptom), ແລະ ປະເພດບໍລິການ (CI, ST, IH, PS).
- ລະບົບສ້າງເລກ Job ອັດຕະໂນມັດ (ເຊັ່ນ `JOB-2026-00123`) ພ້ອມພິມ **ໃບຮັບແຈ້ງສ້ອມ/ບັດຕິດຕາມ**.

### 3.2 ວິເຄາະອາການ & ເຄື່ອງປະເມີນ (`/repair/diagnose`)
- ຊ່າງປ້ອນຜົນການວິເຄາະ (Root Cause Analysis), ລະບຸອາໄຫຼ່ທີ່ຕ້ອງໃຊ້ (Spare Parts List) ແລະ ປະເມີນຄ່າສ້ອມ.

### 3.3 ໃບສະເໜີລາຄາ Quotation (`/quotations`)
- CS/ອານຸມັດ ສ້າງໃບສະເໜີລາຄາ ➔ ສົ່ງໃຫ້ລູກຄ້າ (WhatsApp / Email / SMS) ➔ ບັນທຶກຜົນ (ລູກຄ້າອະນຸມັດ / ປະຕິເສດ).

### 3.4 ດຳເນີນການສ້ອມ & ເບີກອາໄຫຼ່ (`/repair/progress`)
- ຊ່າງກົດ **ເລີ່ມສ້ອມ**, ເຮັດໃບເບີກອາໄຫຼ່ ➔ ຝ່າຍສາງອະນຸມັດ ➔ ຊ່າງປ່ຽນອາໄຫຼ່ + ຖ່າຍຮູບ ກ່ອນ/ຫຼັງສ້ອມ.

### 3.5 QC & ສົ່ງມອບ (`/qc` & `/repair/deliver`)
- ຫົວໜ້າ/QC ກວດສອບ 10-point Quality Checklist ➔ ຜ່ານ QC ➔ ພິມ **ໃບສົ່ງມອບ/ລູກຄ້າເຊັກອິນ** ➔ ປິດ Job.

---

## 4. ໝວດ "ງານຕິດຕັ້ງ" (Installations Module)

- **ລາຍການງານຕິດຕັ້ງ (`/installations`)**: ລວມ Order ຕິດຕັ້ງອຸປະກອນ/ລະບົບໃໝ່.
- **ສຳຫຼວດໜ້າງານ (Site Survey)**: ຊ່າງບັນທຶກຜົນການສຳຫຼວດ + ຮູບໜ້າງານ.
- **ດຳເນີນການຕິດຕັ້ງ & Sign-off**: ຊ່າງຕິດຕັ້ງ ➔ ທົດສອບ System ➔ ລູກຄ້າລາຍເຊັນ digital sign-off ເທິງມືຖື.

---

## 5. ໝວດ "ງານເຄມ" (Claims Module) — 3 ໜ້າ

> ໃບເຄມ **ຫ້ອຍຢູ່ກັບໃບงານສ້ອມ** (ຜູກ `ref_job`). ເຄື່ອງເຂົ້າ **ລະບົບສ້ອມກ່ອນ** ແລ້ວຈຶ່ງ ແຕກໃບເຄມ. ສະເພາະ CLAIM_SIDE ສ້າງ/ຈັດການ.

- **ຮັບເຄມຈາກຮ້ານ — CLM-B (`/claims/shop`)**: ໃບແມ່. ກົດ "ຮັບເຄື່ອງເຄມ" → intake (`/service/new?kind=claim`) ➔ ດຶງບິນ ERP + ກວດປະກັນ + ເລືອກຂອບເຂດ (ທັງໜ່ວຍ/ອາໄຫຼ່). ຂັ້ນ: ຮັບ → ກວດ/ຕັດສິນ (ປ່ຽນ/ສ້ອມ) → ຄືນຮ້ານ → ປິດ. ມີ card ສະຫຼຸບ scope + fulfillment (stock/ສັ່ງຊື້/supplier).
- **ເຄມອາໄຫຼ່ກັບ supplier — CLM-A (`/claims/supplier`)**: ຂໍອາໄຫຼ່/ປ່ຽນ ຈາກ supplier ຕອນກຳລັງສ້ອມ. ຂັ້ນ: ຮ່າງ → ສົ່ງ supplier (email) → ກວດ → ອະນຸມັດ → ຮັບຂອງໃໝ່ → ປິດ.
- **ເກັບເງິນຄ່າສ້ອມ ນຳ supplier — CLM-C (`/claims/reimburse`)**: ສ້ອມໃນປະກັນຟຣີໃຫ້ລູກຄ້າ ແລ້ວເກັບເງິນ supplier. ໄດ້ຫຼັງສົ່ງເຄື່ອງສຳເລັດ. ຂັ້ນ: ລໍແຈ້ງ → ແຈ້ງແລ້ວ → ຊຳລະແລ້ວ (ຜູກ COB · ສ່ງ email · ໝາຍຊຳລະ).
- **ແຕກໃບເຄມ ຈາກໃບงານ**: ຢູ່ໜ້າໃບงານສ້ອມ ມີປຸ່ມ ແຕກເຄມ A (ຕອນສ້ອມ) / C (ຫຼັງສົ່ງເຄື່ອງ). ລາຍการໃບงານ ຂຶ້ນ badge 🧾 ເຄມ.

---

## 6. ໝວດ "ງານບຳລຸງຮັກສາ PM" (Preventive Maintenance)

- **ແຜນ PM ປະຈຳປີ/ເດືອນ (`/maintenance/schedule`)**: ຕັ້ງ Schedule ຮອບ PM ຕາມສັນຍາລູກຄ້າ.
- **PM Checklist & Inspection (`/maintenance/checklists`)**: ຊ່າງເຂົ້າ PM ➔ ຕິກ Checklist ເອເລັກໂຕຣນິກ ➔ ອອກລາຍງານ PM Report.

---

## 7. ໝວດ "ຂໍຊື້ອາໄຫຼ່ & ສາງ" (Spare Parts & PR/PO)

- **ຄັງອາໄຫຼ່ (`/spare-parts` & `/stock`)**: ກວດ Stock ອາໄຫຼ່, Minimum Stock Alert, Location ຫ້ອງສາງ.
- **ໃບຂໍຊື້ອາໄຫຼ່ PR (`/purchase-requests`)**: ສ້າງ PR ຂໍຊື້ອາໄຫຼ່ ➔ ສົ່ງໃຫ້ຫົວໜ້າອະນຸມັດ.
- **ໃບສັ່ງຊື້ PO (`/purchase-orders`)**: ຫົວໜ້າ/ສາງ ສ້າງ PO ຫາ Supplier/Vendor ➔ ຮັບອາໄຫຼ່ເຂົ້າສາງ (Stock In).

---

## 8. ໝວດ "ລາຍງານ & Analytics" (Reports Module)

- **ລາຍງານຜົນງານສ້ອມ (Repair Efficiency)**: ສະຫຼຸບຈຳນວນ Job, Turnaround Time, First-Time Fix Rate.
- **ລາຍງານນຳໃຊ້ອາໄຫຼ່ (Spare Parts Usage)**: ສະຫຼຸບອາໄຫຼ່ທີ່ໃຊ້ຫຼາຍ, ມູນຄ່າ Stock.
- **ລາຍງານ KPI ຊ່າງ & Leaderboard**: ຈັດອັນດັບຜົນງານຊ່າງສ້ອມ ແລະ ຄະແນນດາວຈາກລູກຄ້າ.

---

## 9. ໜ້າຕິດຕາມສາທາລະນະ (`/track` & `/report-repair`)

- **`https://odss.odien.net/track`**: ລູກຄ້າເປີດ ໃສ່ເລກ Job ➔ ເບິ່ງສະຖານະງານສ້ອມ Realtime.
- **`https://odss.odien.net/report-repair`**: ລູກຄ້າແຈ້ງສ້ອມອອນໄລນ໌ໄດ້ 24/7.
