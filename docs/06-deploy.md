# Deploy ຂຶ້ນ server

## ຄຳສັ່ງດຽວ

ເຂົ້າ server → ໄປໂຟນເດີໂປຣເຈັກ → ແລ່ນ:

```bash
bash scripts/deploy.sh
```

ສະຄິບເຮັດ: ດຶງໂຄດ (`git pull`) → `npm ci` → **ພິມລາຍການ migration ໃໝ່** → `npm run build` → restart (pm2 ຫຼື systemd).

ຖ້າຊື່ process ບໍ່ແມ່ນ `odss`:

```bash
ODSS_PM2_NAME=ຊື່ຂອງທ່ານ bash scripts/deploy.sh
# ຫຼື
ODSS_SERVICE=ຊື່ service bash scripts/deploy.sh
```

## Migration — ຕ້ອງແລ່ນເອງ

ລະບົບ**ບໍ່ມີຕາຕະລາງບັນທຶກ migration** ⇒ ສະຄິບພຽງແຕ່**ບອກ**ວ່າມີໄຟລ໌ໃໝ່ ບໍ່ໄດ້ແລ່ນໃຫ້
(ແລ່ນຊ້ຳໂດຍບໍ່ຕັ້ງໃຈ = ອັນຕະລາຍກວ່າ). ແລ່ນເອງ:

```bash
psql "$DATABASE_URL" -f migrations/2026-07-31-xxxx.sql
```

ທຸກໄຟລ໌ຂຽນແບບ `if not exists` ⇒ ແລ່ນຊ້ຳບໍ່ພັງ ແຕ່ໃຫ້ກວດກ່ອນສະເໝີ.

**ຮອບ 31-07-2026** (ແລ່ນໃສ່ຖານແລ້ວຈາກເຄື່ອງພັດທະນາ — ຢືນຢັນກ່ອນແລ່ນຊ້ຳ):

| ໄຟລ໌ | ເຮັດຫຍັງ |
|---|---|
| `2026-07-31-service-loaner.sql` | ຕາຕະລາງ `ods_loaner` (ເຄື່ອງສຳຮອງໃຫ້ລູກຄ້າໃຊ້ກ່ອນ) |
| `2026-07-31-intake-center.sql` | ຖັນ `tb_product.intake_center` (ບ່ອນຮັບເຄື່ອງ) + index ຄິວລໍຮັບໂອນ |

## ສິ່ງທີ່ **ບໍ່ຢູ່ໃນ git** ⇒ deploy ບໍ່ໄດ້ເອົາໄປໃຫ້

| ຂອງ | ຕ້ອງເຮັດ |
|---|---|
| **APK ແອັບຊ່າງ** | copy ໄປວາງທີ່ `public/downloads/odss-tech.apk` (ໃຫຍ່ 24MB ⇒ ຢູ່ນອກ git) |
| **ໄຟລ໌ upload** | `ODS_UPLOADS_DIR` ຕ້ອງຊີ້ບ່ອນເກົ່າ (ຮູບຮັບເຄື່ອງ · ຮູບຜົນງານ) |
| **.env.local** | ບໍ່ຢູ່ໃນ git — ຢູ່ server ຂອງມັນເອງ |

ບໍ່ copy APK = ຊ່າງໂຫຼດໄດ້**ຕົວເກົ່າ** ໂດຍທີ່ໜ້າເວັບບອກວ່າອັບເດດແລ້ວ.

## ກວດຫຼັງ deploy

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login    # ຄາດ 200
```

ແລ້ວເປີດເວັບກວດ 3 ໜ້າທີ່ປ່ຽນຮອບນີ້:
`/service/loaners` · `/service/transfers` · `/installations/spare-requests/<ເລກງານ>`
