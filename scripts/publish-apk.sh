#!/usr/bin/env bash
# ── ວາງ APK ແອັບຊ່າງໃຫ້ໂຫຼດ + ຂຶ້ນເວີຊັນຂັ້ນຕ່ຳ ──────────────────────────────
#
# ວາງ 2 ໄຟລ໌ຄູ່ກັນສະເໝີ:
#   public/downloads/ods.apk           ໄຟລ໌ທີ່ຊ່າງໂຫຼດ (ໜ້າ /download + ປຸ່ມອັບເດດໃນແອັບ)
#   public/downloads/ods.apk.version   ເວີຊັນຂອງໄຟລ໌ນັ້ນ (ເຊັ່ນ 1.11.0+33)
#
# ໄຟລ໌ `.version` ຄືສິ່ງທີ່ **ດ່ານບັງຄັບອັບເດດ** (src/lib/app-update-gate.ts) ອ່ານ:
# ວາງ APK ໃໝ່ = ແອັບເກົ່າໃນມືຊ່າງຖືກບັງຄັບໃຫ້ອັບເດດເອງ ໂດຍບໍ່ຕ້ອງໄປພິມເລກໃສ່ບ່ອນໃດ.
# ⇒ ຢ່າ copy APK ດ້ວຍມືໂດຍບໍ່ຂຽນ .version (ຈະກາຍເປັນ APK ໃໝ່ ແຕ່ບໍ່ມີໃຜຖືກບັງຄັບ).
#
# ໃຊ້:  ./scripts/publish-apk.sh            (build ໃໝ່ແລ້ວວາງ)
#       ./scripts/publish-apk.sh --no-build (ວາງໄຟລ໌ທີ່ build ໄວ້ແລ້ວ)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
apk="$root/mobile/build/app/outputs/flutter-apk/app-release.apk"
target="$root/public/downloads/ods.apk"

if [ "${1:-}" != "--no-build" ]; then
  echo "▶ build APK (release)…"
  (cd "$root/mobile" && flutter build apk --release)
fi

[ -f "$apk" ] || { echo "✗ ບໍ່ພົບ $apk — build ກ່ອນ"; exit 1; }

# ເວີຊັນເອົາຈາກ pubspec (ບ່ອນດຽວກັບທີ່ແອັບເອົາໄປໃສ່ header x-app-version)
version="$(grep -m1 '^version:' "$root/mobile/pubspec.yaml" | awk '{print $2}')"
[ -n "$version" ] || { echo "✗ ອ່ານ version ຈາກ pubspec.yaml ບໍ່ໄດ້"; exit 1; }

mkdir -p "$(dirname "$target")"
cp "$apk" "$target"
printf '%s\n' "$version" > "$target.version"

echo "✅ ວາງແລ້ວ: $target  ($version)"
echo "   ຊ່າງທີ່ຖືແອັບເກົ່າກວ່ານີ້ ຈະຖືກບັງຄັບໃຫ້ອັບເດດ (ຖ້າຕັ້ງຄ່າ 'ບັງຄັບອັບເດດ' ເປີດຢູ່)"
