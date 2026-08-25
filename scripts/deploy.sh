#!/usr/bin/env bash
#
# ── Deploy ODSS ຂຶ້ນ server ─────────────────────────────────────────────────
#
# ແລ່ນ **ເທິງ server** ຢູ່ໂຟນເດີໂປຣເຈັກ:
#     bash scripts/deploy.sh
#
# ເຮັດ 5 ຂັ້ນ: ດຶງໂຄດ → ຕິດຕັ້ງ package → ເຕືອນ migration ທີ່ຍັງບໍ່ໄດ້ແລ່ນ → build → restart
# ບໍ່ແຕະຖານຂໍ້ມູນເອງ (migration ຄົນແລ່ນເອງ — ເບິ່ງລາຍການທີ່ພິມອອກມາ).
#
# ⚠️ ຂັ້ນ restart ພະຍາຍາມຫາ pm2 ຫຼື systemd ໃຫ້; ຫາບໍ່ພົບຈະພິມຄຳສັ່ງໃຫ້ເຮັດເອງ.
set -euo pipefail

cd "$(dirname "$0")/.."
echo "▶ ໂຟນເດີ: $(pwd)"

# ① ດຶງໂຄດ ────────────────────────────────────────────────────────────────
before=$(git rev-parse HEAD)
echo "▶ ດຶງໂຄດຈາກ origin/main..."
git pull --ff-only origin main
after=$(git rev-parse HEAD)

if [ "$before" = "$after" ]; then
  echo "  (ບໍ່ມີໂຄດໃໝ່ — ຢູ່ $after ແລ້ວ)"
else
  echo "  $before → $after"
  git --no-pager log --oneline "$before..$after" | sed 's/^/    /'
fi

# ② package ────────────────────────────────────────────────────────────────
echo "▶ ຕິດຕັ້ງ package (npm ci)..."
npm ci

# ③ migration ທີ່ອາດຍັງບໍ່ໄດ້ແລ່ນ ──────────────────────────────────────────
# ບໍ່ມີຕາຕະລາງບັນທຶກ migration ⇒ ພິມອັນທີ່ **ໃໝ່ກວ່າໂຄດເກົ່າ** ໃຫ້ຄົນຕັດສິນເອງ.
if [ "$before" != "$after" ]; then
  changed=$(git diff --name-only "$before..$after" -- migrations/ || true)
  if [ -n "$changed" ]; then
    echo "▶ ⚠️ migration ໃໝ່ໃນຮອບນີ້ — ຕ້ອງແລ່ນໃສ່ຖານເອງ ຖ້າຍັງບໍ່ໄດ້ແລ່ນ:"
    echo "$changed" | sed 's/^/    psql "$DATABASE_URL" -f /'
  fi
fi

# ④ build ─────────────────────────────────────────────────────────────────
echo "▶ build..."
npm run build

# ⑤ restart ───────────────────────────────────────────────────────────────
# ຊື່ຈິງຢູ່ production = `ods` (systemd unit ods.service, PORT 3007) — ບໍ່ແມ່ນ `odss`
APP_NAME="${ODSS_PM2_NAME:-ods}"
SERVICE="${ODSS_SERVICE:-ods}"
if command -v pm2 >/dev/null 2>&1 && pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "▶ restart ຜ່ານ pm2 ($APP_NAME)..."
  pm2 restart "$APP_NAME" --update-env
elif systemctl list-units --type=service --all 2>/dev/null | grep -q "$SERVICE.service"; then
  echo "▶ restart ຜ່ານ systemd ($SERVICE)..."
  sudo systemctl restart "$SERVICE"
else
  echo "▶ ຫາ pm2/systemd ບໍ່ພົບ — restart ເອງດ້ວຍວິທີທີ່ໃຊ້ຢູ່ ເຊັ່ນ:"
  echo "    pm2 restart $APP_NAME    ຫຼື    sudo systemctl restart $SERVICE"
fi

# ── ເຕືອນສິ່ງທີ່ລືມເລື້ອຍ ────────────────────────────────────────────────
cat <<'REMINDER'

▶ ຢ່າລືມ (ບໍ່ໄດ້ຢູ່ໃນ git ⇒ deploy ບໍ່ໄດ້ເອົາໄປໃຫ້):
    · APK ແອັບຊ່າງ  → ./scripts/publish-apk.sh   (ວາງ ods.apk + ods.apk.version
                       — ໄຟລ໌ .version ຄືຕົວທີ່ບັງຄັບໃຫ້ແອັບເກົ່າອັບເດດ)
    · ໄຟລ໌ upload    → ODS_UPLOADS_DIR ຕ້ອງຊີ້ບ່ອນເກົ່າ (ຮູບຮັບເຄື່ອງ/ຜົນງານ)

▶ ກວດຫຼັງ deploy:
    curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3007/login    # ຄາດ 200
REMINDER
echo "✅ ແລ້ວ"
