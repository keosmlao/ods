#!/usr/bin/env bash
#
# ຍິງຕົວກວດ SLA (escalation) — ໃສ່ໃນ crontab ຂອງ server ທຸກ 30 ນາທີ:
#
#   */30 * * * * /ເສັ້ນທາງ/odss-next/scripts/cron-sla.sh >> /var/log/odss-sla.log 2>&1
#
# ດຶງ CRON_KEY ຈາກ env ຫຼື .env.local (ຄ່າດຽວກັບທີ່ແອັບ Next ໃຊ້).
# ທົດສອບກ່ອນ (ບໍ່ push/insert):  ODSS_DRY=1 ./scripts/cron-sla.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${CRON_KEY:-}" ] && [ -f "$DIR/.env.local" ]; then
  CRON_KEY="$(grep -E '^CRON_KEY=' "$DIR/.env.local" | head -1 | cut -d= -f2- | tr -d '"'\''')"
fi
: "${CRON_KEY:?CRON_KEY ບໍ່ໄດ້ຕັ້ງ (env ຫຼື .env.local)}"

HOST="${ODSS_HOST:-http://localhost:3000}"
QS=""
[ "${ODSS_DRY:-0}" = "1" ] && QS="?dry=1"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] cron sla${QS:+ (dry)}"
curl -fsS -H "x-cron-key: $CRON_KEY" "$HOST/api/cron/sla$QS"
echo
