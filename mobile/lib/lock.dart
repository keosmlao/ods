import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// **ລັອກແອັບ** (ລາຍນິ້ວມື / ໜ້າ / ລະຫັດເຄື່ອງ).
///
/// ── ເປັນຫຍັງຕ້ອງມີ ──
/// token ຂອງແອັບອາຍຸ **30 ມື້** (ຕັ້ງໃຈ — ຊ່າງບໍ່ຄວນຖືກໄລ່ອອກກາງເຄິ່ງງານ).
/// ຜົນຂ້າງຄຽງ: ມືຖືເສຍ/ຖືກລັກ = ຄົນເກັບໄດ້ເປີດເບິ່ງ **ວຽກ · ຊື່ · ເບີ · ບ່ອນຢູ່
/// ຂອງລູກຄ້າທັງໝົດ** ໄດ້ທັນທີ ໂດຍບໍ່ຕ້ອງຮູ້ລະຫັດຫຍັງເລີຍ.
///
/// ── ຫຼັກການ ──
/// ① **ຜູ້ໃຊ້ເລືອກເອງ** (ບໍ່ບັງຄັບ) — ບັງຄັບທຸກຄົນ = ຊ່າງທີ່ເຄື່ອງບໍ່ມີລາຍນິ້ວມືຕິດ
/// ② ລັອກເມື່ອກັບມາຈາກພື້ນຫຼັງ **ເກີນ 2 ນາທີ** — ຖ່າຍຮູບ/ໂທ ແລ້ວກັບມາບໍ່ຄວນຖືກຖາມຊ້ຳ
/// ③ ປົດບໍ່ໄດ້ (ບໍ່ມີລາຍນິ້ວມື · ຍົກເລີກ) = **ບໍ່ໄລ່ອອກຈາກລະບົບ** ພຽງແຕ່ຄາຢູ່ຈໍລັອກ
abstract final class AppLock {
  static const _storage = FlutterSecureStorage();
  static const _key = 'odss_lock_on';
  static final _auth = LocalAuthentication();

  /// ຢູ່ພື້ນຫຼັງດົນເທົ່າໃດຈຶ່ງລັອກຄືນ
  static const idle = Duration(minutes: 2);

  static bool enabled = false;
  static DateTime? _leftAt;

  /// ອ່ານການຕັ້ງຄ່າຕອນເປີດແອັບ (ລົ້ມ = ຖືວ່າປິດ — ຢ່າລັອກຄົນອອກເພາະ storage ເພ)
  static Future<void> load() async {
    try {
      enabled = await _storage.read(key: _key) == 'on';
    } catch (error) {
      debugPrint('ອ່ານການຕັ້ງຄ່າລັອກບໍ່ໄດ້: $error');
      enabled = false;
    }
  }

  /// ເຄື່ອງນີ້ລັອກໄດ້ບໍ (ມີລາຍນິ້ວມື/ໜ້າ/ລະຫັດເຄື່ອງ)
  static Future<bool> supported() async {
    try {
      return await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  static Future<void> setEnabled(bool value) async {
    enabled = value;
    try {
      await _storage.write(key: _key, value: value ? 'on' : 'off');
    } catch (error) {
      debugPrint('ບັນທຶກການຕັ້ງຄ່າລັອກບໍ່ໄດ້: $error');
    }
  }

  /// ຈື່ເວລາທີ່ອອກໄປພື້ນຫຼັງ
  static void markLeft() => _leftAt = DateTime.now();

  /// ກັບມາແລ້ວຕ້ອງຖາມບໍ
  static bool shouldAsk() {
    if (!enabled) return false;
    final left = _leftAt;
    return left != null && DateTime.now().difference(left) >= idle;
  }

  /// ຖາມລາຍນິ້ວມື — `true` = ຜ່ານ
  static Future<bool> unlock() async {
    try {
      final ok = await _auth.authenticate(
        localizedReason: 'ຢືນຢັນຕົວຕົນ ເພື່ອເປີດແອັບ ODIEN Service',
        options: const AuthenticationOptions(
          stickyAuth: true,
          // ບໍ່ມີລາຍນິ້ວມື ⇒ ໃຊ້ລະຫັດປົດລັອກເຄື່ອງແທນ (ບໍ່ໃຫ້ຄາຢູ່ຈໍລັອກຕະຫຼອດ)
          biometricOnly: false,
        ),
      );
      if (ok) _leftAt = null;
      return ok;
    } catch (error) {
      debugPrint('ປົດລັອກລົ້ມ: $error');
      return false;
    }
  }
}
