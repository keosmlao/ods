#!/usr/bin/env bash
#
# ── ແກ້ ODS_UPLOADS_DIR ຢູ່ server ໃຫ້ຊີ້ໂຟນເດີຮູບຈິງ ─────────────────────────
#
# ອາການທີ່ແກ້: `EACCES: permission denied, mkdir '/Users'` ⇒ **ຮັບເຄື່ອງບໍ່ໄດ້ທັງລະບົບ**
# ສາເຫດ: .env.local ຢູ່ server ຍັງເປັນ path ຂອງເຄື່ອງ Mac (/Users/mac/...)
#
# ແລ່ນເທິງ server:   bash ~/ods/scripts/fix-uploads-dir.sh
# ບໍ່ລຶບຫຍັງ — ສຳຮອງ .env.local ໄວ້ ແລະ ຍ້າຍໄຟລ໌ດ້ວຍ mv -n (ບໍ່ທັບຂອງເກົ່າ).
set -euo pipefail

APP_DIR="${ODSS_DIR:-$HOME/ods}"
SERVICE="${ODSS_SERVICE:-ods}"
# ຮູບເກົ່າທີ່ຕ້ອງມີຢູ່ໂຟນເດີຈິງ (ຈາກຖານ: product_image ກ່ອນ 07-2026)
PROBE_OLD="7399_0_125354.jpg"
# ຮູບຫຼ້າສຸດ — ໃຊ້ກວດຫຼັງຍ້າຍ
PROBE_NEW="7616_0_LINE_20260804_092333.jpg"

cd "$APP_DIR"
echo "▶ ໂປຣເຈັກ: $(pwd)"

# ① ຫາໂຟນເດີຮູບຈິງ ─────────────────────────────────────────────────────────
CANDIDATES=$(
  { ls -d /home/*/boq/app/static/uploads /home/*/boq/public/static/uploads 2>/dev/null || true
    find /home /var/www /opt -maxdepth 6 -type d -path '*static*' -name uploads 2>/dev/null || true
  } | sort -u
)
[ -n "$CANDIDATES" ] || { echo "✗ ຫາໂຟນເດີ uploads ບໍ່ພົບເລີຍ — ຕ້ອງບອກ path ເອງ"; exit 1; }

echo "▶ ໂຟນເດີທີ່ພົບ:"
while read -r d; do
  [ -d "$d" ] && printf '   %-50s %6s ໄຟລ໌%s\n' "$d" "$(ls "$d" 2>/dev/null | wc -l)" \
    "$([ -f "$d/$PROBE_OLD" ] && echo '  ← ມີຮູບເກົ່າ (ບ່ອນຈິງ)')"
done <<< "$CANDIDATES"

DIR=""
while read -r d; do [ -f "$d/$PROBE_OLD" ] && DIR="$d" && break; done <<< "$CANDIDATES"
# ບໍ່ພົບຮູບຕົວຢ່າງ ⇒ ເອົາອັນທີ່ມີໄຟລ໌ຫຼາຍສຸດ (ຍັງດີກວ່າ path ຂອງ Mac)
if [ -z "$DIR" ]; then
  DIR=$(while read -r d; do [ -d "$d" ] && echo "$(ls "$d" 2>/dev/null | wc -l) $d"; done <<< "$CANDIDATES" |
        sort -rn | head -1 | cut -d' ' -f2-)
  echo "⚠️ ບໍ່ພົບ $PROBE_OLD ຢູ່ໂຟນເດີໃດ — ເລືອກອັນທີ່ມີໄຟລ໌ຫຼາຍສຸດແທນ"
fi
echo "▶ ເລືອກ: $DIR"

# ② ຕ້ອງຂຽນໄດ້ ─────────────────────────────────────────────────────────────
if touch "$DIR/.ods_probe" 2>/dev/null; then
  rm -f "$DIR/.ods_probe"; echo "✓ ຂຽນໄດ້"
else
  echo "✗ ຂຽນບໍ່ໄດ້ — ແລ່ນອັນນີ້ກ່ອນ ແລ້ວຄ່ອຍແລ່ນສະຄິບຄືນ:"
  echo "    sudo chown -R $(id -un): $DIR"
  exit 1
fi

# ③ ຕັ້ງຄ່າ (ສຳຮອງໄວ້ກ່ອນ) ────────────────────────────────────────────────
cp -a .env.local ".env.local.bak.$(date +%F_%H%M)"
if grep -q '^ODS_UPLOADS_DIR=' .env.local; then
  sed -i "s|^ODS_UPLOADS_DIR=.*|ODS_UPLOADS_DIR=$DIR|" .env.local
else
  echo "ODS_UPLOADS_DIR=$DIR" >> .env.local
fi
echo "▶ ຄ່າໃໝ່: $(grep '^ODS_UPLOADS_DIR=' .env.local)"

# ④ ຍ້າຍຮູບທີ່ຕົກຄ້າງຢູ່ var/uploads ກັບເຂົ້າບ່ອນຈິງ ────────────────────────
if [ -d var/uploads ] && [ "$(ls -A var/uploads 2>/dev/null | wc -l)" -gt 0 ]; then
  n=$(ls var/uploads | wc -l)
  echo "▶ ພົບຮູບຕົກຄ້າງ $n ໄຟລ໌ ຢູ່ var/uploads — ຍ້າຍໄປ $DIR"
  mv -n var/uploads/* "$DIR"/ || true
  echo "  ເຫຼືອ: $(ls -A var/uploads 2>/dev/null | wc -l) ໄຟລ໌"
else
  echo "▶ ບໍ່ມີຮູບຕົກຄ້າງຢູ່ var/uploads"
fi

# ⑤ restart + ກວດ ──────────────────────────────────────────────────────────
echo "▶ restart $SERVICE ..."
sudo systemctl restart "$SERVICE"
sleep 5
echo "▶ ສະຖານະ: $(systemctl is-active "$SERVICE")"
PORT=$(grep -oP '(?<=-p )\d+' /etc/systemd/system/"$SERVICE".service 2>/dev/null | head -1 || echo 3007)
echo "▶ /login → $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/login")  (ຄາດ 200)"
ls -l "$DIR/$PROBE_NEW" 2>/dev/null || echo "  (ຍັງບໍ່ມີ $PROBE_NEW — ຮູບນັ້ນອາດຍັງບໍ່ເຄີຍຂຽນລົງ disk)"
if sudo journalctl -u "$SERVICE" --since "2 min ago" 2>/dev/null | grep -q EACCES; then
  echo "✗ ຍັງມີ EACCES ໃນ log — ກວດສິດຂອງ $DIR"
else
  echo "✓ ບໍ່ມີ EACCES ໃນ log ແລ້ວ"
fi

cat <<EOF

── ຕໍ່ໄປໃຫ້ທົດລອງໃນເວັບ ──
  1. ຮັບເຄື່ອງໃໝ່ 1 ໃບ ພ້ອມແນບຮູບ  → ຕ້ອງບັນທຶກຜ່ານ
  2. ເປີດຮູບຂອງໃບເກົ່າ (ເຊັ່ນ /service/7616 → ຮູບຮັບເຄື່ອງ) → ຕ້ອງເຫັນຮູບ ບໍ່ແມ່ນ 404
EOF
