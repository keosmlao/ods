import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// **ຕົວວັດການໃຊ້ງານ** — ໃຫ້ຮູ້ວ່າແອັບຖືກໃຊ້ແນວໃດຈິງ ບໍ່ແມ່ນເດົາ.
///
/// ── ຄຳຖາມທີ່ຢາກຕອບ ──
/// · ຈາກ check-in ຫາ ຈົບງານ ໃຊ້ເວລາສະເລ່ຍເທົ່າໃດ (ແລະ ໃບໃດຄ້າງຜິດປົກກະຕິ)
/// · ຊ່າງຄາຢູ່ຂັ້ນໃດຫຼາຍທີ່ສຸດ
/// · ຄວາມສາມາດໃໝ່ (ພິມດ້ວຍສຽງ · ອັນດັບ · ວຽກທີ່ຈົບແລ້ວ) ມີຄົນໃຊ້ບໍ
///
/// ⚠️ **ບໍ່ສົ່ງຂໍ້ມູນລູກຄ້າ** — ສົ່ງແຕ່ຊື່ເຫດການ · ສາຍງານ · ຈຳນວນວິນາທີ.
/// ⚠️ Firebase init ບໍ່ໄດ້ = ງຽບ (ຫຼັກການດຽວກັບ Push/Crashlytics: ເຄື່ອງມືເສີມ
///    ຫ້າມລົ້ມແອັບ).
abstract final class Metrics {
  static FirebaseAnalytics? _analytics;

  static void init() {
    try {
      _analytics = FirebaseAnalytics.instance;
    } catch (error) {
      debugPrint('ຕັ້ງຕົວວັດບໍ່ໄດ້: $error');
    }
  }

  static Future<void> _log(String name, Map<String, Object> params) async {
    try {
      await _analytics?.logEvent(name: name, parameters: params);
    } catch (_) {
      // ວັດບໍ່ໄດ້ ບໍ່ແມ່ນເລື່ອງທີ່ຕ້ອງລົບກວນຊ່າງ
    }
  }

  /// ຄຳສັ່ງທີ່ຊ່າງກົດສຳເລັດ (accept · start · checkin · finish …)
  static Future<void> jobAction(String workflow, String action, {int photos = 0}) =>
      _log('job_action', {'workflow': workflow, 'action': action, 'photos': photos});

  /// ໜ້າຈໍທີ່ຖືກເປີດ — ບອກວ່າຄວາມສາມາດໃໝ່ມີຄົນໃຊ້ບໍ
  static Future<void> screen(String name) => _log('screen_open', {'screen': name});

  /// ໃຊ້ຄວາມສາມາດໃດໜຶ່ງ (ພິມດ້ວຍສຽງ · ກູ້ຮູບ · ຄິວ offline …)
  static Future<void> feature(String name) => _log('feature_use', {'feature': name});
}
