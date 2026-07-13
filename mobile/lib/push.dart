import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';

/// ແຈ້ງເຕືອນຫາມືຖືຊ່າງ — **FCM** (Firebase Cloud Messaging).
///
/// ── ເປັນຫຍັງ FCM ──
/// ຮຸ່ນກ່ອນຂອງແອັບເປັນ Expo ຈຶ່ງໃຊ້ Expo Push ໄດ້. Flutter ໃຊ້ອັນນັ້ນບໍ່ໄດ້
/// ⇒ ຍ້າຍມາ FCM ໂດຍກົງ (server ຝັ່ງເວັບກໍ່ຍິງຜ່ານ FCM ແລ້ວ — src/lib/push.ts).
///
/// ── ບໍ່ໃຫ້ລົ້ມແອັບ ──
/// ຖ້າຍັງບໍ່ໄດ້ `flutterfire configure` (ບໍ່ມີ google-services.json) Firebase ຈະ init
/// ບໍ່ໄດ້ ⇒ **ຈັບ error ໄວ້ໝົດ** ແລະ ແອັບຍັງໃຊ້ໄດ້ປົກກະຕິ ພຽງແຕ່ບໍ່ມີແຈ້ງເຕືອນ.
/// ຄືກັນກັບຝັ່ງ server: push ລົ້ມ **ຫ້າມ** ເຮັດໃຫ້ການມອບໝາຍງານລົ້ມ.
class Push {
  static bool ready = false;

  static Future<void> init() async {
    try {
      await Firebase.initializeApp();
      ready = true;
    } catch (error) {
      debugPrint(
        'Firebase ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ — ແອັບແລ່ນຕໍ່ ແຕ່ບໍ່ມີແຈ້ງເຕືອນ ($error)',
      );
    }
  }

  /// ເອີ້ນຫຼັງ login ສຳເລັດ — ຂໍສິດ ແລ້ວສົ່ງ token ໄປໃຫ້ server
  static Future<void> register() async {
    if (!ready) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      final token = await messaging.getToken();
      if (token == null) return;
      await Api.registerPushToken(token, Platform.isIOS ? 'ios' : 'android');

      // token ປ່ຽນເອງໄດ້ (ຕິດຕັ້ງໃໝ່, ລ້າງຂໍ້ມູນ) ⇒ ອັບເດດໃຫ້ server ທຸກຄັ້ງ
      messaging.onTokenRefresh.listen((fresh) {
        Api.registerPushToken(
          fresh,
          Platform.isIOS ? 'ios' : 'android',
        ).catchError((_) {});
      });
    } catch (error) {
      debugPrint('ລົງທະບຽນແຈ້ງເຕືອນບໍ່ສຳເລັດ: $error');
    }
  }

  static Future<void> unregister() async {
    if (!ready) return;
    try {
      final messaging = FirebaseMessaging.instance;
      final token = await messaging.getToken();
      if (token != null) await Api.removePushToken(token);
      await messaging.deleteToken();
    } catch (error) {
      debugPrint('ຖອນ push token ບໍ່ສຳເລັດ: $error');
    }
  }
}
