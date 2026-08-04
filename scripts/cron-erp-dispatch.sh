#!/usr/bin/env bash
#
# ຍິງຕົວດຶງໃບເບີກ/ໃບຮັບຄືນຈາກ ERP — ໃສ່ໃນ crontab ຂອງ server ທຸກ 5 ນາທີ:
#
#   */5 * * * * /ເສັ້ນທາງ/odss-next/scripts/cron-erp-dispatch.sh >> /var/log/odss-erp-dispatch.log 2>&1
#
# ເຮັດໃຫ້ຮູ້ "ສາງເບີກແລ້ວ" ພາຍໃນບໍ່ເກີນ 5 ນາທີ (ກວດຜ່ານ doc_ref ຂອງ ERP)
# ແລ້ວ push ແຈ້ງຊ່າງເອງ — ບໍ່ຕ້ອງລໍໃຫ້ຄົນເປີດໜ້າຄິວ.
# sync ເປັນ idempotent ⇒ ຍິງຊ້ຳປອດໄພ.
#
# ດຶງ CRON_KEY ຈາກ env ຫຼື .env.local (ຄ່າດຽວກັບທີ່ແອັບ Next ໃຊ້).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${CRON_KEY:-}" ] && [ -f "$DIR/.env.local" ]; then
  CRON_KEY="$(grep -E '^CRON_KEY=' "$DIR/.env.local" | head -1 | cut -d= -f2- | tr -d '"'\''')"
fi
: "${CRON_KEY:?CRON_KEY ບໍ່ໄດ້ຕັ້ງ (env ຫຼື .env.local)}"

HOST="${ODSS_HOST:-http://localhost:3000}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] cron erp-dispatch"
curl -fsS -H "x-cron-key: $CRON_KEY" "$HOST/api/cron/erp-dispatch"
echo
