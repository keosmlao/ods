#!/usr/bin/env bash
#
# ແຈ້ງເຕືອນຊ່າງເມື່ອອອກແອັບເວີຊັນໃໝ່ — ໃສ່ໃນ crontab ທຸກ 10 ນາທີ:
#
#   */10 * * * * /ເສັ້ນທາງ/odss-next/scripts/cron-app-update.sh >> /home/odg/ods/logs/app-update.log 2>&1
#
# ຍິງເທື່ອດຽວຕໍ່ 1 ເວີຊັນ (ຈື່ໄວ້ໃນ ods_setting) ⇒ ແລ່ນຖີ່ບໍ່ເປັນຫຍັງ.
# ທົດສອບກ່ອນ (ບໍ່ຍິງ/ບໍ່ຈື່):  ODSS_DRY=1 ./scripts/cron-app-update.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${CRON_KEY:-}" ] && [ -f "$DIR/.env.local" ]; then
  CRON_KEY="$(grep -E '^CRON_KEY=' "$DIR/.env.local" | head -1 | cut -d= -f2- | tr -d '"'\''')"
fi
: "${CRON_KEY:?CRON_KEY ບໍ່ໄດ້ຕັ້ງ (env ຫຼື .env.local)}"

# ພອດຈິງຂອງ production = 3007 (ເບິ່ງ ods.service) — ປ່ຽນໄດ້ດ້ວຍ ODSS_HOST
HOST="${ODSS_HOST:-http://localhost:3007}"
QS=""
[ "${ODSS_DRY:-0}" = "1" ] && QS="?dry=1"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] cron app-update${QS:+ (dry)}"
curl -fsS -H "x-cron-key: $CRON_KEY" "$HOST/api/cron/app-update$QS"
echo
