import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api.dart';

/// ຮັບຂໍ້ຄວາມຕອນແອັບຖືກຂ້າ/ພື້ນຫຼັງ — ຕ້ອງເປັນ **top-level function**
/// (Flutter ເອີ້ນມັນຢູ່ isolate ຕ່າງຫາກ ຈຶ່ງໃຊ້ closure ຫຼື method ຂອງ class ບໍ່ໄດ້).
/// ບໍ່ຕ້ອງສະແດງເອງ: payload ມີ `notification` ⇒ Android ຂຶ້ນໃຫ້ໃນ tray ອັດຕະໂນມັດ.
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {}

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

  static final _local = FlutterLocalNotificationsPlugin();

  /// ຊ່ອງແຈ້ງເຕືອນ — **ຕ້ອງຕົງກັບ `channel_id` ທີ່ server ສົ່ງມາ** (lib/push.ts = 'jobs')
  /// ບໍ່ດັ່ງນັ້ນ Android ຈະຕົກໄປໃຊ້ channel ຕັ້ງຕົ້ນ ແລະ ຄວາມສຳຄັນ/ສຽງບໍ່ຕາມທີ່ຕັ້ງ.
  static const _channel = AndroidNotificationChannel(
    'jobs',
    'ງານທີ່ມອບໝາຍ',
    description: 'ແຈ້ງເຕືອນເມື່ອມີງານໃໝ່ ຫຼື ງານມີການເຄື່ອນໄຫວ',
    importance: Importance.high,
  );

  static Future<void> init() async {
    try {
      await Firebase.initializeApp();
      ready = true;
    } catch (error) {
      debugPrint(
        'Firebase ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ — ແອັບແລ່ນຕໍ່ ແຕ່ບໍ່ມີແຈ້ງເຕືອນ ($error)',
      );
      return;
    }

    try {
      // ① ຕັ້ງ channel + ຕົວສະແດງແຈ້ງເຕືອນພາຍໃນເຄື່ອງ
      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(),
        ),
      );
      await _local
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(_channel);

      // ② ແອັບຖືກຂ້າ / ຢູ່ພື້ນຫຼັງ — ລະບົບຂຶ້ນເອງ
      FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

      /*
        ③ **ເປີດແອັບຢູ່ (foreground)** — Android ບໍ່ຂຶ້ນໃຫ້ອັດຕະໂນມັດ
        ⇒ ຕ້ອງສະແດງເອງ ບໍ່ດັ່ງນັ້ນຊ່າງທີ່ກຳລັງເປີດແອັບຢູ່ຈະ **ບໍ່ຮູ້ວ່າມີງານໃໝ່ເຂົ້າ**.
      */
      FirebaseMessaging.onMessage.listen(_showForeground);

      // iOS ຕ້ອງບອກແຍກຕ່າງຫາກ ຈຶ່ງຈະຂຶ້ນ banner ຕອນເປີດແອັບຢູ່
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );
    } catch (error) {
      debugPrint('ຕັ້ງຄ່າການສະແດງແຈ້ງເຕືອນບໍ່ສຳເລັດ: $error');
    }
  }

  /// ສະແດງແຈ້ງເຕືອນຕອນແອັບເປີດຢູ່
  static Future<void> _showForeground(RemoteMessage message) async {
    final info = message.notification;
    if (info == null) return;
    try {
      await _local.show(
        id: message.hashCode,
        title: info.title,
        body: info.body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _channel.id,
            _channel.name,
            channelDescription: _channel.description,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
          iOS: const DarwinNotificationDetails(),
        ),
      );
    } catch (error) {
      debugPrint('ສະແດງແຈ້ງເຕືອນບໍ່ສຳເລັດ: $error');
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
