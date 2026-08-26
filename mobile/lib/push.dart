import 'dart:convert';
import 'dart:io';
import 'dart:ui' show Color;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api.dart';
import 'app_links.dart';

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

  /// ── ຊ່ອງແຈ້ງເຕືອນ — **ຕ້ອງຕົງກັບ `channel_id` ທີ່ server ສົ່ງມາ** (lib/push.ts) ──
  /// ບໍ່ດັ່ງນັ້ນ Android ຈະຕົກໄປໃຊ້ channel ຕັ້ງຕົ້ນ ແລະ ຄວາມສຳຄັນ/ສຽງບໍ່ຕາມທີ່ຕັ້ງ.
  ///
  /// ແຍກ 3 ຊ່ອງ (26-08-2026) ເພື່ອໃຫ້ຊ່າງ**ປິດສະເພາະອັນທີ່ດັງເກີນ**ໄດ້ໃນຕັ້ງຄ່າຂອງ
  /// ເຄື່ອງ ໂດຍທີ່ງານຂອງຕົນຍັງດັງຢູ່ — ແຕ່ກ່ອນມີຊ່ອງດຽວ ⇒ ຮຳຄານແລ້ວປິດໝົດ ⇒ ພາດງານ.
  ///
  /// ⚠️ ຊ່ອງ Android **ສ້າງແລ້ວແກ້ບໍ່ໄດ້** — ຜູ້ໃຊ້ເປັນເຈົ້າຂອງການຕັ້ງຄ່າ. ຈະປ່ຽນສຽງ
  /// ຫຼື ຄວາມແຮງພາຍຫຼັງ ຕ້ອງໃຊ້ id ໃໝ່ (ຊ່ອງເກົ່າຕ້ອງລຶບຖິ້ມ ບໍ່ດັ່ງນັ້ນຄ້າງໃນຕັ້ງຄ່າ).
  static const _jobs = AndroidNotificationChannel(
    'jobs',
    'ງານຂອງຂ້ອຍ',
    description: 'ມີງານມອບໃຫ້ທ່ານ ຫຼື ມີຄົນເວົ້າເຖິງທ່ານໃນໃບງານ',
    importance: Importance.high,
  );

  /// ສະຫຼຸບຄວາມເຄື່ອນໄຫວ — **ງຽບ**: ຂຶ້ນໃນ tray ແຕ່ບໍ່ສັ່ນ ບໍ່ມີສຽງ ບໍ່ປຸກຈໍ.
  /// ວັດຈິງ 60,000–88,000 ແຖວ/ມື້ ທັງລະບົບ ⇒ ອັນນີ້ດັງບໍ່ໄດ້ເດັດຂາດ.
  static const _digest = AndroidNotificationChannel(
    'digest',
    'ຄວາມເຄື່ອນໄຫວ (ສະຫຼຸບ)',
    description: 'ສະຫຼຸບການເຄື່ອນໄຫວຂອງເອກະສານ — ບໍ່ມີສຽງ',
    importance: Importance.low,
  );

  /// ເລື່ອງລະບົບທີ່ຕ້ອງຮູ້ — ນັດມື້ນີ້ · ໃກ້ຄົບ SLA · ມີເວີຊັນໃໝ່
  static const _alert = AndroidNotificationChannel(
    'alert',
    'ເລື່ອງສຳຄັນ',
    description: 'ນັດມື້ນີ້ · ໃກ້ຄົບກຳນົດ · ມີເວີຊັນໃໝ່ໃຫ້ອັບເດດ',
    importance: Importance.high,
  );

  static const _channels = [_jobs, _digest, _alert];

  /// ສີກະແຈໃນ tray — ມີ້ນ v6 (ຕ້ອງຕົງກັບ `color` ທີ່ server ສົ່ງມາ)
  static const _brand = Color(0xFF14B8A6);

  /// **ໄອຄອນໃນ tray** — ຕ້ອງຕົງກັບ `iconFor` ຢູ່ server (lib/push.ts) ບໍ່ດັ່ງນັ້ນ
  /// ຂໍ້ຄວາມອັນດຽວກັນຈະຄົນລະຮູບ ລະຫວ່າງຕອນເປີດແອັບຢູ່ (ອັນນີ້ແຕ້ມ) ກັບຕອນປິດ
  /// (Android ແຕ້ມຈາກ payload ຂອງ server).
  ///
  /// ⚠️ ຊື່ຕ້ອງມີຢູ່ໃນ android/app/src/main/res/drawable/ ແລະ ຖືກກັນໄວ້ໃນ
  /// res/raw/keep.xml — ບໍ່ດັ່ງນັ້ນ R8 ລຶບຖິ້ມ (ບໍ່ມີບ່ອນໃດອ້າງເປັນ R.drawable).
  static String _iconFor(Map<String, dynamic> data) {
    final kind = '${data['kind'] ?? data['type'] ?? ''}'.toLowerCase();
    return switch (kind) {
      'assign' => '@drawable/ic_notif_job',
      'comment' => '@drawable/ic_notif_chat',
      'digest' || 'log' => '@drawable/ic_notif_digest',
      'app_update' => '@drawable/ic_notif_update',
      'day_brief' => '@drawable/ic_notif_today',
      'sla' => '@drawable/ic_notif_sla',
      _ => '@drawable/ic_notification',
    };
  }

  /// ເລືອກຊ່ອງຈາກ payload — ຫຼັກການດຽວກັບ `channelFor` ຢູ່ server (lib/push.ts).
  /// ບໍ່ຮູ້ຈັກ ⇒ `jobs` (ດັງ): ຜິດພາດໄປທາງໃຫ້ຄົນເຫັນ ດີກວ່າມິດງຽບແລ້ວພາດງານ.
  static AndroidNotificationChannel _channelFor(Map<String, dynamic> data) {
    final forced = '${data['channel'] ?? ''}'.toLowerCase();
    if (forced == 'digest') return _digest;
    if (forced == 'alert') return _alert;
    if (forced == 'jobs') return _jobs;
    final kind = '${data['kind'] ?? data['type'] ?? ''}'.toLowerCase();
    if (kind == 'digest' || kind == 'log') return _digest;
    if (kind == 'app_update' || kind == 'day_brief' || kind == 'sla') return _alert;
    return _jobs;
  }

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
          android: AndroidInitializationSettings('@drawable/ic_notification'),
          iOS: DarwinInitializationSettings(),
        ),
        onDidReceiveNotificationResponse: (response) {
          final raw = response.payload;
          if (raw == null || raw.isEmpty) return;
          try {
            AppLinks.openPushData(jsonDecode(raw) as Map<String, dynamic>);
          } catch (_) {}
        },
      );
      final android = _local
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      for (final channel in _channels) {
        await android?.createNotificationChannel(channel);
      }

      // ② ແອັບຖືກຂ້າ / ຢູ່ພື້ນຫຼັງ — ລະບົບຂຶ້ນເອງ
      FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

      /*
        ③ **ເປີດແອັບຢູ່ (foreground)** — Android ບໍ່ຂຶ້ນໃຫ້ອັດຕະໂນມັດ
        ⇒ ຕ້ອງສະແດງເອງ ບໍ່ດັ່ງນັ້ນຊ່າງທີ່ກຳລັງເປີດແອັບຢູ່ຈະ **ບໍ່ຮູ້ວ່າມີງານໃໝ່ເຂົ້າ**.
      */
      FirebaseMessaging.onMessage.listen(_showForeground);
      FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => AppLinks.openPushData(message.data),
      );
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) await AppLinks.openPushData(initial.data);

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
      final channel = _channelFor(message.data);
      final quiet = channel.id == _digest.id;
      /*
        `tag` = ອັນໃໝ່**ແທນ**ອັນເກົ່າ (ບໍ່ກອງເປັນຕັ້ງ) — ໃຊ້ກັບສະຫຼຸບ ແລະ ເລື່ອງລະບົບ
        ທີ່ອັນລ່າສຸດອັນດຽວກໍ່ພຽງພໍ. ງານທີ່ມອບໃຫ້ **ບໍ່ໃສ່** tag: 2 ໃບຄື 2 ເລື່ອງ.
        ຕ້ອງຕົງກັບ `tagFor` ຢູ່ server ບໍ່ດັ່ງນັ້ນ tray ຈະມີທັງອັນເກົ່າ ແລະ ອັນໃໝ່.
      */
      final tag = channel.id == _jobs.id ? null : channel.id;
      await _local.show(
        // ໃຊ້ id ຄົງທີ່ຕໍ່ຊ່ອງສຳລັບອັນທີ່ມີ tag ⇒ ຕອນເປີດແອັບຢູ່ກໍ່ທັບອັນເກົ່າຄືກັນ
        id: tag == null ? message.hashCode : channel.id.hashCode,
        title: info.title,
        body: info.body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            channel.id,
            channel.name,
            channelDescription: channel.description,
            importance: channel.importance,
            priority: quiet ? Priority.low : Priority.high,
            tag: tag,
            playSound: !quiet,
            enableVibration: !quiet,
            // ຮູບຕາມປະເພດ (ເງົາຂາວ) — ບໍ່ຮູ້ຈັກ ⇒ ກະແຈ ຄືກັບ default ໃນ manifest
            icon: _iconFor(message.data),
            color: _brand,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: jsonEncode(message.data),
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
