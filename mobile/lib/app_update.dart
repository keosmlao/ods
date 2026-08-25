import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

/// **ບັງຄັບອັບເດດ** — ແອັບບອກເວີຊັນຂອງຕົນໃຫ້ server ທຸກຄຳຂໍ (`x-app-version`),
/// server ຕອບ 426 ເມື່ອເກົ່າກວ່າ APK ທີ່ວາງໃຫ້ໂຫຼດ (src/lib/app-update-gate.ts)
/// ⇒ ແອັບຂຶ້ນໜ້າ "ຕ້ອງອັບເດດ" ທັບທັງແອັບ ຈົນກວ່າຈະຕິດຕັ້ງລຸ້ນໃໝ່.
///
/// ເປັນຫຍັງບໍ່ປ່ອຍໃຫ້ຊ່າງເລືອກເອງ: ແອັບບໍ່ຢູ່ Play Store ⇒ ບໍ່ມີການອັບເດດອັດຕະໂນມັດ.
/// ແອັບເກົ່າຄາໃນມືເປັນເດືອນ = ຂັ້ນຕອນທີ່ເວັບແກ້ໄປແລ້ວຍັງເດີນຜິດຢູ່ໜ້າງານ.

/// ເວີຊັນຂອງແອັບທີ່ກຳລັງແລ່ນ — `"1.11.0+33"` (ຮູບແບບດຽວກັບ pubspec ແລະ
/// ໄຟລ໌ `ods.apk.version` ຝັ່ງ server ⇒ ປຽບທຽບກົງກັນ ບໍ່ຕ້ອງແປງ).
abstract final class AppVersion {
  static String current = '';

  /// ອ່ານຈາກ package info — ລົ້ມກໍ່ບໍ່ເປັນຫຍັງ (ຄືນຄ່າຫວ່າງ = server ຖືວ່າເກົ່າ
  /// ⇒ ບັງຄັບອັບເດດ ເຊິ່ງເປັນຝັ່ງທີ່ປອດໄພກວ່າ ເພາະລຸ້ນເກົ່າແທ້ໆກໍ່ບໍ່ບອກເວີຊັນ).
  static Future<void> load() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final build = info.buildNumber.trim();
      current = build.isEmpty ? info.version : '${info.version}+$build';
    } catch (error) {
      debugPrint('ອ່ານເວີຊັນແອັບບໍ່ໄດ້: $error');
    }
  }
}

/// ນະໂຍບາຍອັບເດດທີ່ server ສົ່ງມາ (ໃນ 426 ຫຼື ໃນຄຳຕອບ login)
class AppUpdateInfo {
  const AppUpdateInfo({
    this.forceUpdate = false,
    this.updateAvailable = false,
    this.minVersion = '',
    this.latestVersion = '',
    this.currentVersion = '',
    this.updateUrl = '',
  });

  /// ເກົ່າກວ່າຂັ້ນຕ່ຳ ແລະ ຜູ້ຈັດການເປີດການບັງຄັບ ⇒ ບລັອກແອັບ
  final bool forceUpdate;

  /// ມີລຸ້ນໃໝ່ ແຕ່ຍັງໃຊ້ຕໍ່ໄດ້ ⇒ ພຽງແຈ້ງ
  final bool updateAvailable;
  final String minVersion;
  final String latestVersion;
  final String currentVersion;
  final String updateUrl;

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    bool flag(dynamic value) => value is bool
        ? value
        : value is num
        ? value != 0
        : value is String && (value == 'true' || value == '1');
    String text(dynamic value) => value == null ? '' : value.toString();

    return AppUpdateInfo(
      forceUpdate: flag(json['force_update']),
      updateAvailable: flag(json['update_available']),
      minVersion: text(json['min_version']),
      latestVersion: text(json['latest_version']),
      currentVersion: text(json['current_version']),
      updateUrl: text(json['update_url']),
    );
  }
}

/// ນະໂຍບາຍລ່າສຸດທີ່ຮູ້ — ຕັ້ງຄ່າຈາກ 426 ຫຼື ຈາກ login. main.dart ຟັງຄ່ານີ້
/// ແລ້ວທັບໜ້າຈໍທັງໝົດດ້ວຍ UpdateRequiredScreen ເມື່ອ `forceUpdate` ເປັນຈິງ.
///
/// **ຂຶ້ນຢ່າງດຽວ**: ຮູ້ແລ້ວວ່າຕ້ອງອັບເດດ ຄຳຕອບຕໍ່ມາ (ເຊັ່ນຈາກ cache/route ອື່ນ)
/// ຈະປົດການບລັອກບໍ່ໄດ້ — ບໍ່ດັ່ງນັ້ນໜ້າຈໍຈະກະພິບເຂົ້າ-ອອກ.
final ValueNotifier<AppUpdateInfo?> appUpdate = ValueNotifier(null);

void reportAppUpdate(AppUpdateInfo info) {
  if (appUpdate.value?.forceUpdate == true && !info.forceUpdate) return;
  appUpdate.value = info;
}

/// ໂຫຼດບໍ່ໄດ້/ຕິດຕັ້ງບໍ່ໄດ້ — [message] ເປັນພາສາລາວ ເອົາຂຶ້ນຈໍໄດ້ເລີຍ
class AppUpdateException implements Exception {
  const AppUpdateException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// ໂຫຼດ APK ແລ້ວສົ່ງໃຫ້ຕົວຕິດຕັ້ງຂອງລະບົບ — **ໃນຕົວແອັບ**.
///
/// ເປັນຫຍັງບໍ່ໂຍນລິ້ງໃສ່ browser: ຊ່າງໂຫຼດແລ້ວຫາໄຟລ໌ໃນ Files ບໍ່ພົບ ⇒ ການອັບເດດ
/// ຄ້າງຢູ່ບ່ອນນັ້ນ. ໂຫຼດເອງ + ແຖບຄວາມຄືບໜ້າ + ເປີດຕົວຕິດຕັ້ງໃຫ້ເລີຍ ຈົບໃນຈໍດຽວ.
abstract final class AppUpdater {
  static const String apkMimeType = 'application/vnd.android.package-archive';

  /// ມີແຕ່ Android ທີ່ຕິດຕັ້ງ APK ໄດ້ (iOS ໃຫ້ເປີດລິ້ງແທນ)
  static bool get canInstallInApp => Platform.isAndroid;

  /// ລິ້ງອັບເດດ — ຄ່າທີ່ server ສົ່ງມາເປັນ path ("/downloads/ods.apk") ⇒ ຕໍ່ກັບ
  /// server ທີ່ແອັບກຳລັງຄຸຍນຳ (ຊ່າງບາງຄົນຊີ້ server ພາຍໃນ)
  static Uri? resolveUrl(String url, {required String baseUrl}) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) return null;
    final target = Uri.tryParse(trimmed);
    if (target == null) return null;
    if (target.hasScheme) return target;
    final base = Uri.tryParse(baseUrl.trim());
    if (base == null || !base.hasScheme) return null;
    return base.resolveUri(target);
  }

  /// ດຶງ APK ລົງບ່ອນເກັບຊົ່ວຄາວ. [onProgress] ໃຫ້ 0..1 ຫຼື -1 ເມື່ອບໍ່ຮູ້ຂະໜາດ
  /// (server ບໍ່ບອກ Content-Length) ⇒ ຈໍສະແດງແຖບແບບບໍ່ຮູ້ຈຸດຈົບແທນແຖບຄ້າງ 0%.
  static Future<File> download(
    Uri url, {
    void Function(double progress, int received, int total)? onProgress,
    http.Client? client,
  }) async {
    final httpClient = client ?? http.Client();
    try {
      final response = await httpClient
          .send(http.Request('GET', url))
          .timeout(const Duration(minutes: 5));
      if (response.statusCode != 200) {
        throw AppUpdateException(
          'ໂຫຼດໄຟລ໌ອັບເດດບໍ່ໄດ້ (${response.statusCode}) — ກະລຸນາແຈ້ງ IT',
        );
      }
      final total = response.contentLength ?? 0;
      final folder = await getTemporaryDirectory();
      final target = File('${folder.path}/ods-update.apk');
      // ໂຫຼດໃສ່ຊື່ .part ກ່ອນແລ້ວປ່ຽນຊື່ຕອນຄົບ ⇒ ໄຟລ໌ທີ່ໂຫຼດຄ້າງກາງທາງ
      // ຈະບໍ່ຖືກສົ່ງໃຫ້ຕົວຕິດຕັ້ງຄືວ່າເປັນໄຟລ໌ເຕັມ (ຕິດຕັ້ງແລ້ວແອັບພັງ)
      final part = File('${target.path}.part');
      if (await part.exists()) await part.delete();
      if (await target.exists()) await target.delete();

      final sink = part.openWrite();
      var received = 0;
      try {
        await for (final chunk in response.stream) {
          sink.add(chunk);
          received += chunk.length;
          onProgress?.call(total > 0 ? received / total : -1, received, total);
        }
        await sink.flush();
      } finally {
        await sink.close();
      }
      if (total > 0 && received < total) {
        await part.delete();
        throw const AppUpdateException(
          'ໄຟລ໌ອັບເດດໂຫຼດບໍ່ຄົບ — ກວດອິນເຕີເນັດ ແລ້ວລອງໃໝ່',
        );
      }
      await part.rename(target.path);
      return target;
    } on AppUpdateException {
      rethrow;
    } on TimeoutException {
      throw const AppUpdateException(
        'ໂຫຼດອັບເດດຊ້າເກີນໄປ — ກວດອິນເຕີເນັດ ແລ້ວລອງໃໝ່',
      );
    } on SocketException {
      throw const AppUpdateException(
        'ຕິດຕໍ່ server ບໍ່ໄດ້ — ກວດອິນເຕີເນັດ ແລ້ວລອງໃໝ່',
      );
    } on http.ClientException {
      throw const AppUpdateException(
        'ຕິດຕໍ່ server ບໍ່ໄດ້ — ກວດອິນເຕີເນັດ ແລ້ວລອງໃໝ່',
      );
    } finally {
      if (client == null) httpClient.close();
    }
  }

  /// ສົ່ງ APK ໃຫ້ຕົວຕິດຕັ້ງຂອງລະບົບ.
  ///
  /// Android 8 ຂຶ້ນໄປຕ້ອງໃຫ້ສິດ "ຕິດຕັ້ງແອັບຈາກແຫຼ່ງນີ້" ກ່ອນ ⇒ ຂໍກ່ອນເລີຍ
  /// ບໍ່ດັ່ງນັ້ນລະບົບຈະປະຕິເສດຢ່າງງຽບໆ ແລະ ຊ່າງບໍ່ຮູ້ວ່າຕິດຢູ່ຫຍັງ.
  static Future<void> install(File apk) async {
    if (!await apk.exists()) {
      throw const AppUpdateException('ບໍ່ພົບໄຟລ໌ອັບເດດ — ກະລຸນາໂຫຼດໃໝ່');
    }
    final status = await Permission.requestInstallPackages.request();
    if (!status.isGranted) {
      throw const AppUpdateException(
        'ຕ້ອງອະນຸຍາດ "ຕິດຕັ້ງແອັບຈາກແຫຼ່ງນີ້" ໃນການຕັ້ງຄ່າກ່ອນ ຈຶ່ງຈະອັບເດດໄດ້',
      );
    }
    final result = await OpenFilex.open(apk.path, type: apkMimeType);
    if (result.type != ResultType.done) {
      throw AppUpdateException('ເປີດຕົວຕິດຕັ້ງບໍ່ໄດ້ — ${result.message}');
    }
  }
}
