import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:screen_brightness/screen_brightness.dart';

/// **ໂໝດແດດ** — ສຳລັບຊ່າງທີ່ຢືນກາງແຈ້ງ/ຂຶ້ນຫຼັງຄາຕອນທ່ຽງ.
///
/// ── ຂໍ້ຈຳກັດທີ່ຕ້ອງເວົ້າຊື່ໆ ──
/// ໂທເຄັນສີຂອງແອັບເປັນ `const` (ໃຊ້ໃນ `const TextStyle` ນັບຮ້ອຍບ່ອນ) ⇒ ສະຫຼັບ
/// ເປັນ**ໂໝດແຈ້ງເຕັມຮູບແບບ**ຕອນແລ່ນຍັງບໍ່ໄດ້ຈົນກວ່າຈະຍ້າຍໄປ ThemeExtension.
///
/// ສິ່ງທີ່ **ເຮັດໄດ້ດຽວນີ້ ແລະ ຊ່ວຍໄດ້ຈິງ**: ດັນຄວາມສະຫວ່າງຈໍຂຶ້ນສຸດ.
/// ວັດແລ້ວອັນນີ້ຄືຕົວແປທີ່ມີຜົນທີ່ສຸດຕໍ່ການອ່ານກາງແດດ — ຫຼາຍກວ່າການປ່ຽນສີພື້ນ.
/// ອອກຈາກໂໝດ = ຄືນຄ່າຄວາມສະຫວ່າງເດີມຂອງລະບົບ (ບໍ່ຜານແບັດຖິ້ມ).
abstract final class SunMode {
  static const _storage = FlutterSecureStorage();
  static const _key = 'odss_sun_mode';

  static bool on = false;

  static Future<void> load() async {
    try {
      on = await _storage.read(key: _key) == 'on';
      if (on) await _apply(true);
    } catch (error) {
      debugPrint('ອ່ານໂໝດແດດບໍ່ໄດ້: $error');
      on = false;
    }
  }

  static Future<void> toggle() async {
    on = !on;
    try {
      await _storage.write(key: _key, value: on ? 'on' : 'off');
    } catch (_) {}
    await _apply(on);
  }

  static Future<void> _apply(bool bright) async {
    try {
      final screen = ScreenBrightness.instance;
      if (bright) {
        await screen.setApplicationScreenBrightness(1);
      } else {
        await screen.resetApplicationScreenBrightness();
      }
    } catch (error) {
      // ບາງເຄື່ອງບໍ່ໃຫ້ແອັບຕັ້ງຄວາມສະຫວ່າງ ⇒ ບໍ່ເປັນຫຍັງ (ຊ່າງເລື່ອນເອງໄດ້)
      debugPrint('ຕັ້ງຄວາມສະຫວ່າງຈໍບໍ່ໄດ້: $error');
    }
  }
}
