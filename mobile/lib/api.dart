import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'app_update.dart';

/// key ຂອງ Navigator ຫຼັກ (ໃສ່ໃນ MaterialApp) — ໃຫ້ Api ພາໄປໜ້າ login ໄດ້ຈາກທຸກບ່ອນ
/// ເມື່ອ token ໝົດອາຍຸ/ຖືກຖອນ (401) ໂດຍບໍ່ຕ້ອງໃຫ້ແຕ່ລະໜ້າຈັດການເອງ.
final navigatorKey = GlobalKey<NavigatorState>();

/// ຕົວເຊື່ອມກັບ ODSS — ທຸກຄຳຂໍຜ່ານບ່ອນນີ້ບ່ອນດຽວ.
///
/// ⚠️ ແອັບ **ບໍ່ຄິດຂັ້ນຕອນເອງ**: server ສົ່ງ `action` ມາໃຫ້ໃນແຕ່ລະງານ
/// (ເບິ່ງ src/lib/mobile-jobs.ts ຝັ່ງເວັບ) ວ່າຊ່າງກົດຫຍັງໄດ້ດຽວນີ້.
/// ຖ້າແອັບຄິດເອງ ມື້ທີ່ຂັ້ນໄດປ່ຽນ ແອັບເກົ່າທີ່ຄ້າງໃນມືຖືຊ່າງຈະພາງານໄປຜິດຂັ້ນ.
///
/// URL ຂອງ server ໃສ່ຕອນ build:
///   flutter run --dart-define=API_URL=http://192.168.1.51:3000
class Api {
  static const defaultBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://ods.odienmall.com',
  );

  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'odss_token';
  static const _serverKey = 'odss_server_url';
  static const _pendingActionKey = 'odss_pending_actions';
  static String? _sessionToken;
  static bool _syncingActions = false;


  /// ── ອ່ານຄ່າຈາກ secure storage ແບບ **ບໍ່ລົ້ມ** (07-08-2026) ──
  ///
  /// ພົບຈິງຢູ່ໜ້າງານ: `BadPaddingException / BAD_DECRYPT` — ຄີໃນ Android Keystore
  /// ບໍ່ຕົງກັບຂໍ້ມູນທີ່ເຂົ້າລະຫັດໄວ້ (ຕິດຕັ້ງທັບ · ກູ້ backup ຂ້າມເຄື່ອງ · ລ້າງ keystore)
  /// ⇒ ທຸກການອ່ານໂຍນ exception ⇒ ແອັບເປີດບໍ່ໄດ້ເລີຍ ແລະ ຊ່າງແກ້ເອງບໍ່ໄດ້.
  ///
  /// ວິທີແກ້ທີ່ຖືກ: ຂໍ້ມູນນັ້ນ**ກູ້ບໍ່ໄດ້ແລ້ວ** ⇒ ລ້າງຖິ້ມ ແລ້ວຖືວ່າ "ຍັງບໍ່ໄດ້ login"
  /// (ຊ່າງ login ໃໝ່ເທື່ອດຽວ ຈົບ) — ດີກວ່າຄ້າງ ຫຼື ຟ້ອງ stack trace ໃສ່ໜ້າຊ່າງ.
  static Future<String?> _readSafe(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (error) {
      debugPrint('secure storage ອ່ານບໍ່ໄດ້ ($key) — ລ້າງຖິ້ມ: $error');
      try {
        await _storage.deleteAll();
      } catch (_) {
        // ລ້າງບໍ່ໄດ້ກໍ່ບໍ່ເປັນຫຍັງ — ຄືນ null ໃຫ້ໄປໜ້າ login ຢູ່ດີ
      }
      _sessionToken = null;
      return null;
    }
  }

  static Future<String?> token() async => _sessionToken ?? await _readSafe(_tokenKey);
  static Future<void> saveToken(String value, {bool remember = true}) async {
    _sessionToken = value;
    if (remember) {
      await _storage.write(key: _tokenKey, value: value);
    } else {
      await _storage.delete(key: _tokenKey);
    }
  }

  static Future<void> clearToken() async {
    _sessionToken = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _homeKey);
    await _storage.delete(key: _navKey);
    await _storage.delete(key: _userKey);
    await _storage.delete(key: _roleLabelKey);
    await _storage.delete(key: _pendingActionKey);
  }

  // ຊື່ຜູ້ໃຊ້ + ປ້າຍ role — ເກັບໄວ້ໃຫ້ໜ້າ home ທັກທາຍ (ບໍ່ຕ້ອງ login ຄືນ)
  static const _userKey = 'odss_user';
  static const _roleLabelKey = 'odss_role_label';
  static Future<String?> savedUsername() => _readSafe(_userKey);
  static Future<String?> savedRoleLabel() => _readSafe(_roleLabelKey);

  // ໜ້າຕັ້ງຕົ້ນ (jobs/stock-count) — ເກັບໄວ້ໃຫ້ _Gate route ຖືກຕອນເປີດແອັບຄືນ
  static const _homeKey = 'odss_home';
  static Future<String> savedHome() async =>
      (await _readSafe(_homeKey)) ?? 'jobs';
  static Future<void> saveHome(String value) =>
      _storage.write(key: _homeKey, value: value);

  // ແຖບລຸ່ມ (ສ່ວນງານ) ຕາມ role — server ສົ່ງມາຕອນ login, ເກັບໄວ້ໃຫ້ _Gate
  // ປະກອບແອັບຄືນຕອນເປີດໃໝ່ໂດຍບໍ່ຕ້ອງ login ຄືນ (token ອາຍຸ 30 ມື້).
  static const _navKey = 'odss_nav';
  static Future<List<NavTab>> savedTabs() async {
    final raw = await _readSafe(_navKey);
    if (raw == null || raw.isEmpty) {
      // ແອັບອັບເດດ ແຕ່ token ເກົ່າຍັງຄ້າງ (ບໍ່ມີ manifest) — ອະນຸມານຈາກ home ເກົ່າ
      final home = await savedHome();
      return [
        NavTab(key: home, label: home == 'stock-count' ? 'ກວດນັບ' : 'ວຽກ'),
      ];
    }
    return (jsonDecode(raw) as List)
        .map((row) => NavTab.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  static Future<void> saveTabs(List<NavTab> tabs) => _storage.write(
    key: _navKey,
    value: jsonEncode(tabs.map((t) => t.toJson()).toList()),
  );

  /// ດຶງ manifest (role/tab/home) **ໃໝ່** ຈາກ server ຕອນເປີດແອັບ — ບໍ່ຕ້ອງ login ຄືນ.
  /// return false = token ໝົດອາຍຸ/ຖືກຖອນ (ຄວນໄປໜ້າ login) · true = ໃຊ້ຕໍ່ໄດ້.
  /// ⚠️ ເຄືອຂ່າຍລົ້ມ (ບໍ່ແມ່ນ 401) → true + ໃຊ້ tab cache ຕໍ່ (ຢ່າໄລ່ຊ່າງອອກຕອນສັນຍານບໍ່ດີ).
  static Future<bool> refreshSession() async {
    try {
      final result = await _send('GET', '/api/mobile/me');
      final user = MobileUser.fromJson(result['user'] as Map<String, dynamic>);
      await saveHome(user.home);
      await saveTabs(user.tabs);
      await _storage.write(key: _userKey, value: user.username);
      await _storage.write(key: _roleLabelKey, value: user.roleLabel);
      return true;
    } on ApiError catch (failure) {
      if (failure.status == 401) {
        await clearToken();
        return false;
      }
      return true;
    } catch (_) {
      return true;
    }
  }

  static Future<String> serverUrl() async =>
      (await _readSafe(_serverKey)) ?? defaultBaseUrl;
  static Future<void> saveServerUrl(String value) =>
      _storage.write(key: _serverKey, value: normalizeServerUrl(value));
  static Future<void> resetServerUrl() => _storage.delete(key: _serverKey);

  static String normalizeServerUrl(String value) {
    final text = value.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(text);
    if (uri == null ||
        !uri.hasScheme ||
        !uri.hasAuthority ||
        (uri.scheme != 'http' && uri.scheme != 'https')) {
      throw const FormatException('URL ຕ້ອງເລີ່ມດ້ວຍ http:// ຫຼື https://');
    }
    return text;
  }

  static Future<void> testServer(String value) async {
    final base = normalizeServerUrl(value);
    try {
      final response = await http
          .get(Uri.parse('$base/api/mobile/jobs'))
          .timeout(const Duration(seconds: 10));
      // 401 ໝາຍເຖິງ server/API ເຂົ້າເຖິງໄດ້ ແຕ່ຍັງບໍ່ login.
      if (response.statusCode != 401 && response.statusCode != 200) {
        throw ApiError(
          'server ຕອບກັບ HTTP ${response.statusCode}',
          response.statusCode,
        );
      }
    } on TimeoutException {
      throw ApiError('ເຊື່ອມຕໍ່ບໍ່ທັນເວລາ', 408);
    } on http.ClientException {
      throw ApiError('ເຂົ້າເຖິງ server ບໍ່ໄດ້', 0);
    }
  }

  static Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? body,
    bool auth = true,
  }) async {
    final headers = <String, String>{
      'content-type': 'application/json',
      // ── ບອກເວີຊັນຂອງແອັບທຸກຄຳຂໍ (ດ່ານບັງຄັບອັບເດດຝັ່ງ server ອ່ານອັນນີ້) ──
      // ບໍ່ບອກ (ລຸ້ນເກົ່າກ່ອນມີລະບົບນີ້) = server ຖືວ່າເກົ່າ ⇒ ບັງຄັບອັບເດດ
      if (AppVersion.current.isNotEmpty) 'x-app-version': AppVersion.current,
      'x-app-platform': Platform.isIOS ? 'ios' : 'android',
    };
    if (auth) {
      final saved = await token();
      if (saved != null) headers['authorization'] = 'Bearer $saved';
    }

    final uri = Uri.parse('${await serverUrl()}$path');
    late http.Response response;
    try {
      response = await (switch (method) {
        'POST' => http.post(uri, headers: headers, body: jsonEncode(body)),
        'DELETE' => http.delete(uri, headers: headers),
        _ => http.get(uri, headers: headers),
      }).timeout(const Duration(seconds: 25));
    } on TimeoutException {
      throw ApiError(
        'ການເຊື່ອມຕໍ່ໃຊ້ເວລາດົນເກີນໄປ — ກະລຸນາກວດສັນຍານແລ້ວລອງໃໝ່',
        408,
      );
    } on http.ClientException {
      throw ApiError('ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ — ກະລຸນາກວດ internet', 0);
    }

    Map<String, dynamic> decoded;
    try {
      decoded = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiError(
        'server ຕອບກັບບໍ່ຖືກຮູບແບບ (HTTP ${response.statusCode})',
        response.statusCode,
      );
    }

    if (response.statusCode >= 400) {
      /*
        ── 426 = ແອັບເກົ່າເກີນໄປ (src/lib/app-update-gate.ts) ──
        ບອກໃຫ້ທັງແອັບຮູ້ (appUpdate) ⇒ main.dart ທັບຈໍດ້ວຍໜ້າ "ຕ້ອງອັບເດດ"
        ໂດຍທີ່ໜ້າທີ່ຍິງຄຳຂໍບໍ່ຕ້ອງຮູ້ເລື່ອງນີ້ເລີຍ.
      */
      if (response.statusCode == 426) {
        final policy = decoded['app_update'];
        reportAppUpdate(
          policy is Map<String, dynamic>
              ? AppUpdateInfo.fromJson(policy)
              : const AppUpdateInfo(forceUpdate: true),
        );
      }
      // ── token ໝົດອາຍຸ/ຖືກຖອນ ກາງຄັນ ⇒ ພາໄປ login **ຈາກທຸກໜ້າ** (ບໍ່ໃຫ້ຊ່າງຄາ) ──
      // ສະເພາະຄຳຂໍທີ່ຕ້ອງ auth (login ເອງໃຊ້ auth:false ⇒ 401 = ລະຫັດຜິດ, ບໍ່ redirect).
      if (auth && response.statusCode == 401) {
        await _forceLogin();
      }
      /**
       * 404 ຈາກ route ຂອງແອັບ = **server ຍັງເປັນຮຸ່ນເກົ່າ** (ຍັງບໍ່ໄດ້ deploy)
       * ບໍ່ແມ່ນ "ເຊື່ອມຕໍ່ບໍ່ໄດ້". ບອກໃຫ້ຊັດ ບໍ່ດັ່ງນັ້ນຄົນຈະໄລ່ກວດສັນຍານ/ອິນເຕີເນັດ
       * ຢູ່ຫຼາຍຊົ່ວໂມງ ທັງທີ່ບັນຫາຢູ່ຝັ່ງ server.
       */
      throw ApiError(
        (decoded['error'] as String?) ??
            (response.statusCode == 404
                ? 'server ຍັງບໍ່ມີໜ້າທີ່ນີ້ — ຮຸ່ນຂອງ server ເກົ່າກວ່າແອັບ (ຕ້ອງ deploy ກ່ອນ)'
                : 'ເຊື່ອມຕໍ່ບໍ່ໄດ້'),
        response.statusCode,
      );
    }
    return decoded;
  }

  static bool _redirectingToLogin = false;

  /// ລ້າງ token ແລ້ວພາໄປໜ້າ login (ແທນທຸກ route). ກັນຍິງຊ້ຳຕອນຫຼາຍຄຳຂໍ 401 ພ້ອມກັນ.
  static Future<void> _forceLogin() async {
    await clearToken();
    if (_redirectingToLogin) return;
    _redirectingToLogin = true;
    navigatorKey.currentState?.pushNamedAndRemoveUntil('/login', (_) => false);
    Timer(const Duration(seconds: 2), () => _redirectingToLogin = false);
  }

  /* ── ຕົວຕົນ ─────────────────────────────────────────────────── */

  static Future<MobileUser> login(
    String username,
    String password, {
    bool remember = true,
  }) async {
    final result = await _send(
      'POST',
      '/api/mobile/login',
      auth: false,
      body: {'username': username, 'password': password},
    );
    // ນະໂຍບາຍອັບເດດມາພ້ອມ login (login ບໍ່ຖືກບລັອກ ⇒ ຊ່າງລຸ້ນເກົ່າເຂົ້າມາເຫັນ
    // ໜ້າ "ຕ້ອງອັບເດດ" ພ້ອມປຸ່ມໂຫຼດ ແທນທີ່ຈະຄາຢູ່ໜ້າ login ໂດຍບໍ່ຮູ້ສາເຫດ)
    final policy = result['app_update'];
    if (policy is Map<String, dynamic>) {
      reportAppUpdate(AppUpdateInfo.fromJson(policy));
    }
    await saveToken(result['token'] as String, remember: remember);
    final user = MobileUser.fromJson(result['user'] as Map<String, dynamic>);
    await saveHome(user.home);
    await saveTabs(user.tabs);
    await _storage.write(key: _userKey, value: user.username);
    await _storage.write(key: _roleLabelKey, value: user.roleLabel);
    return user;
  }

  /* ── ວຽກ ────────────────────────────────────────────────────── */

  static Future<List<Job>> jobs() async {
    await syncPendingActions();
    final result = await _send('GET', '/api/mobile/jobs');
    return (result['jobs'] as List).map((row) => Job.fromJson(row)).toList();
  }

  /// ຄຳສັ່ງທັງໝົດຂອງງານ: accept · reject · start · finish · checkin · checkout
  static Future<String> command(
    String workflow,
    String code,
    Map<String, dynamic> body,
  ) async {
    final request = <String, dynamic>{
      ...body,
      'client_action_id':
          '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}',
    };
    try {
      final result = await _send(
        'POST',
        '/api/mobile/jobs/$workflow/$code',
        body: request,
      );
      return result['message'] as String;
    } on ApiError catch (error) {
      final hasLargeEvidence =
          request.containsKey('photo') || request.containsKey('photos');
      if ((error.status == 0 || error.status == 408) &&
          workflow != 'maintenance' &&
          !hasLargeEvidence) {
        await _queueAction(workflow, code, request);
        return 'OFFLINE_QUEUED: ເກັບຄຳສັ່ງໄວ້ແລ້ວ — ຈະສົ່ງເມື່ອມີ internet';
      }
      rethrow;
    }
  }

  static Future<void> _queueAction(
    String workflow,
    String code,
    Map<String, dynamic> body,
  ) async {
    final raw = await _readSafe(_pendingActionKey);
    final rows = raw == null || raw.isEmpty
        ? <dynamic>[]
        : (jsonDecode(raw) as List<dynamic>);
    rows.add({'workflow': workflow, 'code': code, 'body': body});
    await _storage.write(key: _pendingActionKey, value: jsonEncode(rows));
  }

  static Future<int> syncPendingActions() async {
    if (_syncingActions) return 0;
    _syncingActions = true;
    try {
      final raw = await _readSafe(_pendingActionKey);
      if (raw == null || raw.isEmpty) return 0;
      final rows = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      final remaining = <Map<String, dynamic>>[];
      var sent = 0;
      for (final row in rows) {
        try {
          await _send(
            'POST',
            '/api/mobile/jobs/${row['workflow']}/${row['code']}',
            body: row['body'],
          );
          sent++;
        } on ApiError catch (error) {
          // 426 = ແອັບເກົ່າເກີນໄປ (ດ່ານບັງຄັບອັບເດດ) — ຄຳສັ່ງເອງບໍ່ໄດ້ຜິດຫຍັງ
          // ⇒ **ຫ້າມຖິ້ມ** (ບໍ່ດັ່ງນັ້ນຮູບຜົນງານ/ການຈົບງານທີ່ຄ້າງໃນຄິວຫາຍໄປງຽບໆ)
          // ເກັບໄວ້ ແລ້ວສົ່ງຄືນຫຼັງຊ່າງອັບເດດແອັບແລ້ວ.
          if (error.status == 0 ||
              error.status == 408 ||
              error.status == 409 ||
              error.status == 426) {
            remaining.add(row);
          }
          // 4xx ອື່ນ = workflow ປ່ຽນໄປແລ້ວ; ຖິ້ມຄຳສັ່ງເກົ່າ.
        }
      }
      if (remaining.isEmpty) {
        await _storage.delete(key: _pendingActionKey);
      } else {
        await _storage.write(
          key: _pendingActionKey,
          value: jsonEncode(remaining),
        );
      }
      return sent;
    } finally {
      _syncingActions = false;
    }
  }

  /* ── ກວດເຊັກ (ຝັ່ງສ້ອມ) ──────────────────────────────────────── */

  static Future<List<DraftLine>> draft(String code) async {
    final result = await _send('GET', '/api/mobile/check/$code');
    return (result['draft'] as List)
        .map((row) => DraftLine.fromJson(row))
        .toList();
  }

  static Future<String> check(String code, Map<String, dynamic> body) async {
    final result = await _send('POST', '/api/mobile/check/$code', body: body);
    return result['message'] as String;
  }

  /// ຮູບຂອງງານ: ຕອນຮັບເຄື່ອງ · ຕອນກວດເຊັກ · ຕອນສ້ອມ/ຕິດຕັ້ງສຳເລັດ (data-URI base64 ທັງໝົດ)
  static Future<JobPhotos> jobPhotos(String workflow, String code) async {
    final result = await _send('GET', '/api/mobile/jobs/$workflow/$code');
    return JobPhotos.fromJson(result['photos'] as Map<String, dynamic>);
  }

  /// ລາຍລະອຽດງານ: ຮູບ + **ເສັ້ນເວລາ** + **ຂໍ້ມູນການສົ່ງເຄື່ອງ** (ຕິດຕັ້ງ)
  /// + **ເຄື່ອງສຳຮອງທີ່ຍັງບໍ່ຄືນ** (ສ້ອມ) + **ລໍໃຜເຮັດຕໍ່/ສະຖານະອາໄຫຼ່** (ສ້ອມ).
  /// GET ດຽວ ໄດ້ໝົດ.
  static Future<
    ({
      JobPhotos photos,
      JobTimelineData? timeline,
      DeliveryInfo? delivery,
      List<LoanerOut> loaners,
      NextActor? nextActor,
      SpareSummary? spares,
    })
  >
  jobDetail(String workflow, String code) async {
    final result = await _send('GET', '/api/mobile/jobs/$workflow/$code');
    final tl = result['timeline'];
    final dv = result['delivery'];
    final ln = result['loaners'] as List<dynamic>? ?? const [];
    final na = result['next_actor'];
    final sp = result['spares'];
    return (
      photos: JobPhotos.fromJson(result['photos'] as Map<String, dynamic>),
      timeline: tl == null
          ? null
          : JobTimelineData.fromJson(tl as Map<String, dynamic>),
      delivery: dv == null
          ? null
          : DeliveryInfo.fromJson(dv as Map<String, dynamic>),
      loaners: ln
          .map((row) => LoanerOut.fromJson(row as Map<String, dynamic>))
          .toList(growable: false),
      nextActor: na == null
          ? null
          : NextActor.fromJson(na as Map<String, dynamic>),
      spares: sp == null
          ? null
          : SpareSummary.fromJson(sp as Map<String, dynamic>),
    );
  }

  /// ບັນຊີອາໄຫຼ່ແບ່ງຕາມຮອບ (ໃບຂໍເບີກ + ໃບຂໍຊື້) — ຊຸດດຽວກັບເວັບ
  static Future<SpareRounds> spareRounds(String workflow, String code) async {
    final result = await _send(
      'GET',
      '/api/mobile/spare-request?code=${Uri.encodeComponent(code)}&workflow=$workflow',
    );
    return SpareRounds.fromJson(result);
  }

  /// ຮູບຕອນຂົນສົ່ງໄປສົ່ງເຄື່ອງ — ດຶງຕອນຊ່າງກົດເບິ່ງເທົ່ານັ້ນ (ຮູບໜັກ 100-200KB ຕໍ່ໃບ)
  static Future<List<String>> deliveryPhotos(String billNo) async {
    final result = await _send(
      'GET',
      '/api/mobile/delivery?bill=${Uri.encodeComponent(billNo)}',
    );
    return (result['data'] as List?)?.map((e) => e as String).toList() ??
        const [];
  }

  /// ຄິວອະນຸມັດ (ຜູ້ຈັດການ)
  static Future<List<ApprovalItem>> approvals() async {
    final result = await _send('GET', '/api/mobile/approvals');
    return (result['items'] as List)
        .map((row) => ApprovalItem.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// ລາຍລະອຽດເຕັມ (native) — ໃບສະເໜີ = ລາຍການ+ລາຄາ · ຂໍຍົກເລີກ = ອາໄຫຼ່ຄ້າງ
  static Future<ApprovalDetail> approvalDetail(String kind, String ref) async {
    final result = await _send(
      'GET',
      '/api/mobile/approvals/$kind/${Uri.encodeComponent(ref)}',
    );
    return ApprovalDetail.fromJson(result);
  }

  /// ອະນຸມັດ / ບໍ່ອະນຸມັດ — action ຄື approve_quote · reject_quote ·
  /// approve_cancellation · reject_cancellation. reason ບັງຄັບສະເພາະ reject.
  static Future<void> decideApproval(
    String action,
    String ref, {
    String reason = '',
  }) => _send(
    'POST',
    '/api/mobile/approvals',
    body: {'action': action, 'ref': ref, 'reason': reason},
  );

  /// ຂໍ URL ອາຍຸສັ້ນເພື່ອເປີດໜ້າ Web ດ້ວຍ session ຂອງແອັບ.
  /// Mobile Bearer token ບໍ່ຖືກສົ່ງໃນ URL; server ອອກ ticket 60 ວິນາທີແທນ.
  static Future<Uri> webSessionUrl(String href) async {
    final result = await _send(
      'POST',
      '/api/mobile/web-session',
      body: {'href': href},
    );
    final value = result['launch_url'] as String?;
    final uri = value == null ? null : Uri.tryParse(value);
    if (uri == null || !uri.hasScheme) {
      throw ApiError('server ບໍ່ສົ່ງ Web URL ທີ່ຖືກຕ້ອງ', 500);
    }
    return uri;
  }

  /* ── Chatter ແລະ ກິດຈະກຳ ────────────────────────────────────── */

  /// ການເຄື່ອນໄຫວຂອງງານ — ຂໍ້ຄວາມ/log ແລະ ກິດຈະກຳທີ່ຍັງຄ້າງ (ຊຸດດຽວກັບເວັບ)
  static Future<JobChatter> chatter(String workflow, String code) async {
    final result = await _send('GET', '/api/mobile/chatter/$workflow/$code');
    return JobChatter.fromJson(result);
  }

  /// ພິມຂໍ້ຄວາມໃສ່ໃບງານ — CS/ຫົວໜ້າ ເຫັນຢູ່ເວັບທັນທີ
  static Future<void> postChatter(String workflow, String code, String body) =>
      _send(
        'POST',
        '/api/mobile/chatter/$workflow/$code',
        body: {'action': 'post', 'body': body},
      );

  /// ກົດວ່າກິດຈະກຳເຮັດແລ້ວ
  static Future<void> completeActivity(
    String workflow,
    String code,
    int id, {
    String note = '',
  }) => _send(
    'POST',
    '/api/mobile/chatter/$workflow/$code',
    body: {'action': 'complete_activity', 'id': id, 'note': note},
  );

  static Future<void> scheduleActivity(
    String workflow,
    String code, {
    required String kind,
    required String summary,
    String note = '',
    required String dueDate,
  }) => _send(
    'POST',
    '/api/mobile/chatter/$workflow/$code',
    body: {
      'action': 'schedule_activity',
      'kind': kind,
      'summary': summary,
      'note': note,
      'due_date': dueDate,
    },
  );

  static Future<List<SpareItem>> searchSpares(
    String query, {
    bool inStock = true,
  }) async {
    final result = await _send(
      'GET',
      '/api/mobile/spares?q=${Uri.encodeQueryComponent(query)}${inStock ? '&in_stock=1' : ''}',
    );
    return (result['items'] as List)
        .map((row) => SpareItem.fromJson(row))
        .toList();
  }

  /// ຜູ້ຊ່ວຍ AI — ແນະນຳອາໄຫຼ່ຕາມຮຸ່ນເຄື່ອງ (ຈາກປະຫວັດການເບີກ)
  static Future<List<SpareSuggestion>> suggestSpares(String code) async {
    final result = await _send(
      'GET',
      '/api/mobile/suggest?code=${Uri.encodeQueryComponent(code)}',
    );
    return (result['spares'] as List)
        .map((row) => SpareSuggestion.fromJson(row))
        .toList();
  }

  /* ── ອາໄຫຼ່: ຂໍເບີກ ແລະ ກົດຮັບ ───────────────────────────────── */

  /// ຕິດຕາມສິນຄ້າຄົງເຫຼືອ — ຄົ້ນອາໄຫຼ່ ໄດ້ຍອດແຍກຕາມສາງ
  static Future<List<StockBalanceItem>> stockBalance(String query) async {
    final result = await _send(
      'GET',
      '/api/mobile/stock-balance?q=${Uri.encodeQueryComponent(query)}',
    );
    return (result['items'] as List)
        .map((row) => StockBalanceItem.fromJson(row))
        .toList();
  }

  static Future<List<PickupDoc>> pickups() async {
    final result = await _send('GET', '/api/mobile/spares?queue=pickup');
    return (result['docs'] as List)
        .map((row) => PickupDoc.fromJson(row))
        .toList();
  }

  static Future<Lookups> lookups() async {
    final result = await _send('GET', '/api/mobile/lookups');
    return Lookups.fromJson(result);
  }

  /* ── ກະຕ່າອາໄຫຼ່ຂອງງານ: ລາຍການ · ເພີ່ມ · ຖອດ · ແກ້ຈຳນວນ ──
     ສ້ອມ = ຂັ້ນ 5-9 (ຄົ້ນ ERP ແລ້ວແຕະເພີ່ມ) · ຕິດຕັ້ງ = ຮັບງານແລ້ວ ຈົນກ່ອນເລີ່ມຕິດຕັ້ງ
     (ຊຸດຕິດຕັ້ງ + ນອກຊຸດຕາມສະວິດ). ດ່ານຢູ່ server: lib/repair-spare · lib/install-spare. */

  static Future<List<RepairSpareLine>> usedSpares(
    String code, {
    String workflow = 'repair',
  }) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {'action': 'used-list', 'code': code, 'workflow': workflow},
    );
    return (result['data'] as List)
        .map((row) => RepairSpareLine.fromJson(row))
        .toList();
  }

  /// ຊຸດຕິດຕັ້ງ (ອາໄຫຼ່ມາດຕະຖານ) ຂອງໃບງານ + ເປີດໃຫ້ຄົ້ນນອກຊຸດບໍ — ສະເພາະຝັ່ງຕິດຕັ້ງ
  static Future<InstallStandards> installStandards(String code) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {'action': 'standards', 'code': code},
    );
    return InstallStandards.fromJson(result);
  }

  static Future<String> addUsedSpare(
    String code,
    SpareItem item,
    int qty, {
    String workflow = 'repair',
  }) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {
        'action': 'add-used',
        'code': code,
        'workflow': workflow,
        'item': {
          'code': item.code,
          'name_1': item.name,
          'unit_code': item.unitCode,
        },
        'qty': qty,
      },
    );
    return result['message'] as String;
  }

  static Future<String> removeUsedSpare(
    String code,
    int roworder, {
    String workflow = 'repair',
  }) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {
        'action': 'remove-used',
        'code': code,
        'workflow': workflow,
        'roworder': roworder,
      },
    );
    return result['message'] as String;
  }

  /// ແກ້ຈຳນວນແຖວກະຕ່າ (ຝັ່ງຕິດຕັ້ງ — ຈຳນວນຕັ້ງຕົ້ນມາຈາກຊຸດ ⇒ ຕ້ອງປັບໄດ້)
  static Future<String> setUsedSpareQty(
    String code,
    int roworder,
    num qty,
  ) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {
        'action': 'set-qty',
        'workflow': 'install',
        'code': code,
        'roworder': roworder,
        'qty': qty,
      },
    );
    return result['message'] as String;
  }

  /// ລາຍການທີ່ຍັງ **ຄ້າງຂໍເບີກ** ຂອງງານ — ໃຫ້ຊ່າງເລືອກວ່າໃບນີ້ເອົາຈັກໜ່ວຍ
  static Future<List<PendingSpareLine>> pendingSpareLines(
    String workflow,
    String code,
  ) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {'action': 'request-lines', 'workflow': workflow, 'code': code},
    );
    return (result['data'] as List)
        .map((row) => PendingSpareLine.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// ອອກໃບຂໍເບີກ — `take` = ລະຫັດອາໄຫຼ່ → ຈຳນວນທີ່ **ໃບນີ້** ຈະເອົາ (1 ສາງ ຕໍ່ 1 ໃບ).
  /// ບໍ່ສົ່ງ = ເອົາຄ້າງທັງໝົດ ຄືເກົ່າ. ຕົວຕັດຈິງຢູ່ server (lib/spare-take.takeQty).
  static Future<String> requestSpares(
    String workflow,
    String code,
    String whCode,
    String shelfCode,
    String remark, {
    Map<String, num>? take,
  }) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {
        'action': 'request',
        'workflow': workflow,
        'code': code,
        'wh_code': whCode,
        'shelf_code': shelfCode,
        'remark': remark,
        if (take != null) 'take': take,
      },
    );
    return result['message'] as String;
  }

  /// ອາໄຫຼ່ທີ່ຄ້າງຢູ່ນຳຊ່າງ (ເບີກອອກແລ້ວ ຍັງບໍ່ໄດ້ຂໍສົ່ງຄືນ)
  static Future<List<OutstandingSpare>> outstandingSpares(
    String workflow,
    String code,
  ) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {'action': 'outstanding', 'workflow': workflow, 'code': code},
    );
    return (result['data'] as List)
        .map((row) => OutstandingSpare.fromJson(row))
        .toList();
  }

  /// ຂໍສົ່ງຄືນອາໄຫຼ່ທີ່ບໍ່ໄດ້ໃຊ້ — ບໍ່ດັ່ງນັ້ນອາໄຫຼ່ຄ້າງຢູ່ນຳຊ່າງໂດຍບໍ່ມີເອກະສານ
  static Future<String> returnSpares(
    String workflow,
    String code,
    List<Map<String, dynamic>> items,
    String remark,
  ) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {
        'action': 'return',
        'workflow': workflow,
        'code': code,
        'items': items,
        'remark': remark,
      },
    );
    return result['message'] as String;
  }

  /* ── ແຈ້ງເຕືອນ (ຕາຕະລາງດຽວກັບເວັບ) ───────────────────────────── */

  /// [before] = id ຂອງແຖວສຸດທ້າຍທີ່ມີຢູ່ແລ້ວ ⇒ ໂຫຼດຕໍ່ (0 = ໜ້າທຳອິດ)
  static Future<(List<AppNotification>, int)> notifications({
    bool unreadOnly = true,
    int before = 0,
  }) async {
    final result = await _send(
      'GET',
      '/api/mobile/notifications?tab=${unreadOnly ? 'unread' : 'all'}'
      '${before > 0 ? '&before=$before' : ''}',
    );
    final rows = ((result['data'] as List?) ?? const [])
        .map((row) => AppNotification.fromJson(row as Map<String, dynamic>))
        .toList();
    return (rows, _asInt(result['unread']));
  }

  static Future<void> markNotificationRead({int? id, bool all = false}) =>
      _send(
        'POST',
        '/api/mobile/notifications',
        body: all ? {'all': true} : {'id': id},
      ).then((_) {});

  static Future<String> pickupSpares(String docRef) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {'action': 'pickup', 'doc_ref': docRef},
    );
    return result['message'] as String;
  }

  /* ── QC (ຫົວໜ້າຊ່າງ / CS) ────────────────────────────────────── */

  static Future<List<QcJob>> qcQueue() async {
    final result = await _send('GET', '/api/mobile/qc');
    return (result['jobs'] as List).map((row) => QcJob.fromJson(row)).toList();
  }

  static Future<QcDetail> qcJob(String workflow, String code) async {
    final result = await _send(
      'GET',
      '/api/mobile/qc?workflow=$workflow&code=$code',
    );
    return QcDetail.fromJson(result);
  }

  static Future<String> saveQc(
    String workflow,
    String code,
    List<Map<String, dynamic>> answers,
    String signerName,
  ) async {
    final result = await _send(
      'POST',
      '/api/mobile/qc',
      body: {
        'workflow': workflow,
        'code': code,
        'answers': answers,
        'signer_name': signerName,
      },
    );
    return result['message'] as String;
  }

  /* ── ລາຍຮັບ ແລະ ແຈ້ງເຕືອນ ────────────────────────────────────── */

  static Future<Income> income() async =>
      Income.fromJson(await _send('GET', '/api/mobile/income'));

  static Future<void> registerPushToken(String token, String platform) => _send(
    'POST',
    '/api/mobile/push-token',
    body: {'token': token, 'platform': platform},
  );

  static Future<void> removePushToken(String token) => _send(
    'DELETE',
    '/api/mobile/push-token?token=${Uri.encodeQueryComponent(token)}',
  );

  /* ── ພາບລວມຜູ້ຈັດການ (ໜ້າຫຼັກ manager) ───────────────────────── */

  static Future<Overview> overview() async =>
      Overview.fromJson(await _send('GET', '/api/mobile/overview'));

  /* ── ຕິດຕາມງານ / ຜົນງານລູກນ້ອງ / ລາຍງານ (manager monitor) ─────── */

  /// ຕິດຕາມງານ — ກຸ່ມທີ່ຕ້ອງລົງມື (ເລີຍ SLA · ຍັງບໍ່ຈັດຊ່າງ · ຄ້າງດົນ)
  static Future<List<MonitorGroup>> monitor() async {
    final result = await _send('GET', '/api/mobile/monitor');
    return ((result['groups'] as List?) ?? [])
        .map((row) => MonitorGroup.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// ກົດຕົວເລກຢູ່ໜ້າພາບລວມ → ລາຍການໃບງານທີ່ຢູ່ໃນຕົວເລກນັ້ນ (ເບິ່ງ lib/manager-drill)
  static Future<({String label, List<MonitorJob> jobs})> overviewJobs(
    String bucket,
  ) async {
    final result = await _send(
      'GET',
      '/api/mobile/overview/jobs?bucket=${Uri.encodeQueryComponent(bucket)}',
    );
    return (
      label: result['label'] as String? ?? '',
      jobs: ((result['jobs'] as List?) ?? [])
          .map((row) => MonitorJob.fromJson(row as Map<String, dynamic>))
          .toList(),
    );
  }

  /// ແຜນທີ່ງານທີ່ຍັງຄ້າງ (ສ້ອມ + ຕິດຕັ້ງ) — ພ້ອມຈຳນວນໃບທີ່ **ຍັງບໍ່ໄດ້ໝາຍພິກັດ**
  static Future<({List<MapPin> pins, int noGpsRepair, int noGpsInstall})>
  mapPending() async {
    final result = await _send('GET', '/api/mobile/map');
    final missing =
        (result['without_gps'] as Map?)?.cast<String, dynamic>() ?? {};
    return (
      pins: ((result['pins'] as List?) ?? [])
          .map((row) => MapPin.fromJson(row as Map<String, dynamic>))
          .toList(),
      noGpsRepair: (missing['repair'] as num?)?.toInt() ?? 0,
      noGpsInstall: (missing['install'] as num?)?.toInt() ?? 0,
    );
  }

  /// ສະຫຼຸບຄ່າຄອມ — [month] `YYYY-MM` (ວ່າງ = ເດືອນນີ້) · [employee] ກອງຄົນດຽວ
  static Future<Commission> commission({
    String month = '',
    String employee = '',
  }) async {
    final query = <String>[
      if (month.isNotEmpty) 'month=${Uri.encodeQueryComponent(month)}',
      if (employee.isNotEmpty) 'employee=${Uri.encodeQueryComponent(employee)}',
    ];
    return Commission.fromJson(
      await _send(
        'GET',
        '/api/mobile/commission${query.isEmpty ? '' : '?${query.join('&')}'}',
      ),
    );
  }

  /// ຄົງເຫຼືອ ສາງສູນບໍລິການ — ຄົ້ນ/ກອງ/ຕັດໜ້າ ຢູ່ server (ຢ່າດຶງ 1,141 ລາຍການລົງມືຖື)
  static Future<RepairStock> repairStock({
    String q = '',
    String wh = '',
    String loc = '',
    int page = 1,
  }) async {
    final query = <String>[
      if (q.isNotEmpty) 'q=${Uri.encodeQueryComponent(q)}',
      if (wh.isNotEmpty) 'wh=${Uri.encodeQueryComponent(wh)}',
      if (loc.isNotEmpty) 'loc=${Uri.encodeQueryComponent(loc)}',
      'page=$page',
    ];
    return RepairStock.fromJson(
      await _send('GET', '/api/mobile/repair-stock?${query.join('&')}'),
    );
  }

  /// ລາຍລະອຽດອາໄຫຼ່ 1 ຕົວ — ຢູ່ສາງ/ທີ່ຈັດເກັບໃດ ຈັກອັນ + ຄວາມເຄື່ອນໄຫວ
  static Future<RepairStockDetail> repairStockItem(String code) async =>
      RepairStockDetail.fromJson(
        await _send(
          'GET',
          '/api/mobile/repair-stock/${Uri.encodeComponent(code)}',
        ),
      );

  /// ກິດຈະກຳທີ່ຍັງບໍ່ປິດ ທັງໝົດ (ຜູ້ຈັດການຕິດຕາມສິ່ງທີ່ CS ນັດໄວ້)
  static Future<({List<PlannedActivity> items, int late})> activities() async {
    final result = await _send('GET', '/api/mobile/activities');
    return (
      items: ((result['items'] as List?) ?? [])
          .map((row) => PlannedActivity.fromJson(row as Map<String, dynamic>))
          .toList(),
      late: (result['late'] as num?)?.toInt() ?? 0,
    );
  }

  /// ຜົນງານລູກນ້ອງ — ລາຍชื่อຊ່າງ + ພາລະ/ຄວາມຊ້າ/ຄ່າຄອມ
  static Future<List<TechRow>> techs() async {
    final result = await _send('GET', '/api/mobile/techs');
    return ((result['techs'] as List?) ?? [])
        .map((row) => TechRow.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  /// ຜົນງານຊ່າງ 1 ຄົນ — ພາລະ · ຜົນຜະລິດ · ຄ່າຄອມ · ງານເປີດ
  static Future<TechDetail> techDetail(String code) async =>
      TechDetail.fromJson(
        await _send('GET', '/api/mobile/techs/${Uri.encodeComponent(code)}'),
      );

  /// ລາຍງານ — ແນວໂນ້ມ 14 ມື້ (ເປີດ/ປິດ) + ຄ່າຄອມເດືອນນີ້
  static Future<Reports> reports() async =>
      Reports.fromJson(await _send('GET', '/api/mobile/reports'));

  /* ── ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ (ບໍ່ແມ່ນຊ່າງ) ────────────────────── */

  static Future<StockCount> stockCount() async {
    final result = await _send('GET', '/api/mobile/stock-count');
    return StockCount(
      jobs: (result['jobs'] as List)
          .map((row) => StockItem.fromJson(row as Map<String, dynamic>))
          .toList(),
      enabled: result['enabled'] as bool? ?? true,
    );
  }

  /// ສົ່ງ code ທີ່ສະແກນພົບ → server ໝາຍ 'ຕ້ອງກວດ' ໃຫ້ອັນທີ່ບໍ່ພົບ. ຄືນ (held, missing).
  static Future<(int, int)> stockCountFinalize(List<String> scanned) async {
    final result = await _send(
      'POST',
      '/api/mobile/stock-count',
      body: {'scanned': scanned},
    );
    return (result['held'] as int? ?? 0, result['missing'] as int? ?? 0);
  }
}

class ApiError implements Exception {
  final String message;
  final int status;
  ApiError(this.message, this.status);
  @override
  String toString() => message;
}

/* ── ຊະນິດຂໍ້ມູນ ─────────────────────────────────────────────────── */

/// 1 tab ຂອງແຖບລຸ່ມ — key ກົງກັບໜ້າຈໍ (ເບິ່ງ NavHost) · label ສະແດງໃຕ້ icon.
/// server ຕັດສິນ (src/lib/mobile-nav.ts) ⇒ ແອັບບໍ່ຄິດ tab ເອງ.
class NavTab {
  final String key;
  final String label;
  NavTab({required this.key, required this.label});

  factory NavTab.fromJson(Map<String, dynamic> json) =>
      NavTab(key: json['key'] as String, label: json['label'] as String? ?? '');

  Map<String, dynamic> toJson() => {'key': key, 'label': label};
}

class MobileUser {
  final String username;
  final String role;
  final String roleLabel;

  /// ໜ້າຕັ້ງຕົ້ນທີ່ server ບອກ = key ຂອງ tab ທຳອິດ (ເຊັ່ນ 'jobs' / 'stock-count')
  final String home;

  /// ແຖບລຸ່ມຕາມ role — ສ່ວນງານທີ່ຄົນນີ້ໃຊ້ໄດ້ (ຢ່າງໜ້ອຍ 1 tab)
  final List<NavTab> tabs;
  MobileUser({
    required this.username,
    required this.role,
    required this.roleLabel,
    required this.home,
    required this.tabs,
  });

  factory MobileUser.fromJson(Map<String, dynamic> json) => MobileUser(
    username: json['username'] as String,
    role: json['role'] as String,
    roleLabel: json['role_label'] as String? ?? '',
    home: json['home'] as String? ?? 'jobs',
    tabs: ((json['tabs'] as List?) ?? [])
        .map((row) => NavTab.fromJson(row as Map<String, dynamic>))
        .toList(),
  );
}

/// ຂັ້ນໜຶ່ງໃນ funnel ງານສ້ອມ (ພາບລວມ)
class OverviewStage {
  final String key;
  final String label;
  final int count;

  /// ເລກຂັ້ນຂອງ STAGE_SQL — ໃຊ້ເປີດລາຍການ `stage:<n>` (server ສົ່ງມາ ບໍ່ໄດ້ຄິດເອງ)
  final int stage;
  OverviewStage({
    required this.key,
    required this.label,
    required this.count,
    required this.stage,
  });
  factory OverviewStage.fromJson(Map<String, dynamic> json) => OverviewStage(
    key: json['key'] as String,
    label: json['label'] as String? ?? '',
    count: (json['count'] as num?)?.toInt() ?? 0,
    stage: (json['stage'] as num?)?.toInt() ?? -1,
  );
}

/// ພາລະງານຂອງຊ່າງ 1 ຄົນ (ພາບລວມ)
class OverviewTech {
  final String tech;
  final int jobs;
  final int oldestSeconds;
  OverviewTech({
    required this.tech,
    required this.jobs,
    required this.oldestSeconds,
  });
  factory OverviewTech.fromJson(Map<String, dynamic> json) => OverviewTech(
    tech: json['tech'] as String? ?? '-',
    jobs: (json['jobs'] as num?)?.toInt() ?? 0,
    oldestSeconds: (json['oldest_seconds'] as num?)?.toInt() ?? 0,
  );
}

/// ຖັງອາຍຸຂອງກອງວຽກ (d7 · d14 · d30 · over30) — ລວມກັນ = ງານເປີດທັງໝົດ
class OverviewAge {
  final String key;
  final int count;
  OverviewAge({required this.key, required this.count});
  factory OverviewAge.fromJson(Map<String, dynamic> json) => OverviewAge(
    key: json['key'] as String? ?? '',
    count: (json['n'] as num?)?.toInt() ?? 0,
  );

  /// ປ້າຍພາສາລາວ — ຄີມາຈາກ server ຈຶ່ງບໍ່ປ່ຽນຕາມພາສາຂອງເຄື່ອງ
  String get label => switch (key) {
    'd7' => 'ບໍ່ເກີນ 7 ມື້',
    'd14' => '8-14 ມື້',
    'd30' => '15-30 ມື້',
    _ => 'ເກີນ 30 ມື້',
  };
}

/// ໃບງານທີ່ຄ້າງດົນສຸດ — ບອກເປັນ "ໃບໃດ ຂອງໃຜ ຄ້າງຂັ້ນໃດ" ບໍ່ແມ່ນຕົວເລກລວມ
class OverviewOldJob {
  final String code;
  final String product;
  final String? custName;
  final String? tech;
  final String stageLabel;
  final int days;
  OverviewOldJob({
    required this.code,
    required this.product,
    required this.custName,
    required this.tech,
    required this.stageLabel,
    required this.days,
  });
  factory OverviewOldJob.fromJson(Map<String, dynamic> json) => OverviewOldJob(
    code: json['code'] as String? ?? '',
    product: json['product'] as String? ?? '',
    custName: json['cust_name'] as String?,
    tech: json['tech'] as String?,
    stageLabel: json['stage_label'] as String? ?? '',
    days: (json['days'] as num?)?.toInt() ?? 0,
  );
}

/// ກອງວຽກຂອງຊ່າງ 1 ຄົນ — `stale` = ຄ້າງເກີນ 30 ມື້ (ຕົວທີ່ບອກບັນຫາຈິງ)
class OverviewBacklog {
  final String tech;

  /// ລະຫັດຊ່າງ — ໃຊ້ຄົ້ນ (`tech:<code>`); `tech` ເປັນຊື່ເຕັມສຳລັບສະແດງ
  final String techCode;
  final int open;
  final int oldestDays;
  final int stale;
  OverviewBacklog({
    required this.tech,
    required this.techCode,
    required this.open,
    required this.oldestDays,
    required this.stale,
  });
  factory OverviewBacklog.fromJson(Map<String, dynamic> json) =>
      OverviewBacklog(
        tech: json['tech'] as String? ?? '-',
        techCode: json['tech_code'] as String? ?? '',
        open: (json['open'] as num?)?.toInt() ?? 0,
        oldestDays: (json['oldest_days'] as num?)?.toInt() ?? 0,
        stale: (json['stale'] as num?)?.toInt() ?? 0,
      );
}

/// ສະຫຼຸບ 1 ສາຍງານ — ເປີດຢູ່ຈັກໃບ ໃນນັ້ນຄ້າງເກີນ 30 ມື້ຈັກໃບ
class WorkflowSummary {
  final String key;
  final String label;
  final int open;
  final int stale;
  final int oldestDays;
  WorkflowSummary({
    required this.key,
    required this.label,
    required this.open,
    required this.stale,
    required this.oldestDays,
  });
  factory WorkflowSummary.fromJson(Map<String, dynamic> json) =>
      WorkflowSummary(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
        open: (json['open'] as num?)?.toInt() ?? 0,
        stale: (json['stale'] as num?)?.toInt() ?? 0,
        oldestDays: (json['oldest_days'] as num?)?.toInt() ?? 0,
      );
}

/// ພາບລວມບໍລິຫານ (ໜ້າຫຼັກຜູ້ຈັດການ) — ຫຍໍ້ຈາກ dashboard ຝັ່ງເວັບ
/// ການເຄື່ອນໄຫວລ່າສຸດ 1 ແຖວ (ຊຸດດຽວກັບກ່ອງແຈ້ງເຕືອນ — ods_notification)
class FeedItem {
  const FeedItem({
    required this.id,
    required this.model,
    required this.resId,
    required this.kind,
    required this.body,
    required this.actor,
    required this.createdAt,
    required this.read,
  });

  final int id;
  final String model;
  final String resId;
  final String kind;
  final String body;
  final String? actor;
  final String createdAt;
  final bool read;

  factory FeedItem.fromJson(Map<String, dynamic> j) => FeedItem(
    id: _asInt(j['id']),
    model: j['model'] as String? ?? '',
    resId: j['res_id']?.toString() ?? '',
    kind: j['kind'] as String? ?? 'log',
    body: j['body'] as String? ?? '',
    actor: j['actor'] as String?,
    createdAt: j['created_at'] as String? ?? '',
    read: j['read'] as bool? ?? false,
  );
}

class Overview {
  final int repairOpen;
  final int installOpen;
  final int overSla;
  final int approvalsTotal;
  final int aQuotes;
  final int aCustomer;
  final int aPurchases;
  final int aCancels;
  final int slaWarning;
  final int slaLate;
  final int slaCritical;
  final int todayAppointments;
  final int todayChecking;
  final int todayRepairing;
  final int todayReceived; // ເບີດງານ (ຮັບເຄື່ອງ) ມື້ນີ້
  final int todayReturned; // ສົ່ງຄືນລູກຄ້າ ມື້ນີ້
  final int unassignedRepair;
  final int unassignedInstall;
  final List<OverviewStage> pipeline;
  final List<OverviewTech> techLoad;
  final List<String> techFree; // ຊ່າງທີ່ວ່າງ (ບໍ່ມີວຽກຄ້າງ)
  final double? feedbackAvg;
  final int feedbackJobs;
  final int feedbackUnhappy;
  // ── ພາກຜູ້ຈັດການ (ອອກແບບໃໝ່ 31-07-2026): ວຽກຄ້າງເທິງ · KPI ລຸ່ມ ──
  final List<OverviewAge> aging;
  final int openTotal;
  final List<OverviewOldJob> oldest;
  final List<OverviewBacklog> techBacklog;
  final int claimsOpen;
  final int claimsWaitDecision;
  final int loaners;
  final int flowOpened;
  final int flowClosed;
  final double moneyQuoted;
  final double moneyPaid;
  final double moneyDue;
  final List<WorkflowSummary> workflows;

  /// ── ການເຄື່ອນໄຫວລ່າສຸດ + ຈຳນວນທີ່ຍັງບໍ່ອ່ານ (07-08-2026) ──
  /// ແຕ່ກ່ອນໜ້ານີ້ມີແຕ່ຮູບກະດິ່ງທີ່ຕິດຈຸດແດງໄວ້ຕາຍຕົວ ⇒ ຜູ້ຈັດການ "ບໍ່ເຫັນ" ການເຄື່ອນໄຫວ
  /// ທັງທີ່ຂໍ້ມູນມີຄົບ. ດຽວນີ້ພາບລວມພາມານຳເລີຍ.
  final int unreadCount;
  final List<FeedItem> feed;

  /// ຄ້າງເກີນ 30 ມື້ຈັກໃບ — ຕົວເລກດຽວທີ່ບອກສຸຂະພາບຂອງສູນໄດ້ດີສຸດ
  int get staleJobs =>
      aging.where((b) => b.key == 'over30').fold(0, (sum, b) => sum + b.count);

  /// ງານຈົບ ລົບ ງານເຂົ້າ — ຕິດລົບ = ກອງວຽກເພີ່ມຂຶ້ນ
  int get flowDelta => flowClosed - flowOpened;

  Overview({
    required this.repairOpen,
    required this.installOpen,
    required this.overSla,
    required this.approvalsTotal,
    required this.aQuotes,
    required this.aCustomer,
    required this.aPurchases,
    required this.aCancels,
    required this.slaWarning,
    required this.slaLate,
    required this.slaCritical,
    required this.todayAppointments,
    required this.todayChecking,
    required this.todayRepairing,
    required this.todayReceived,
    required this.todayReturned,
    required this.unassignedRepair,
    required this.unassignedInstall,
    required this.pipeline,
    required this.techLoad,
    required this.techFree,
    required this.feedbackAvg,
    required this.feedbackJobs,
    required this.feedbackUnhappy,
    required this.aging,
    required this.openTotal,
    required this.oldest,
    required this.techBacklog,
    required this.claimsOpen,
    required this.claimsWaitDecision,
    required this.loaners,
    required this.flowOpened,
    required this.flowClosed,
    required this.moneyQuoted,
    required this.moneyPaid,
    required this.moneyDue,
    required this.workflows,
    this.unreadCount = 0,
    this.feed = const [],
  });

  factory Overview.fromJson(Map<String, dynamic> json) {
    final kpi = (json['kpi'] as Map?)?.cast<String, dynamic>() ?? {};
    final ap = (json['approvals'] as Map?)?.cast<String, dynamic>() ?? {};
    final sla = (json['sla'] as Map?)?.cast<String, dynamic>() ?? {};
    final today = (json['today'] as Map?)?.cast<String, dynamic>() ?? {};
    final un = (json['unassigned'] as Map?)?.cast<String, dynamic>() ?? {};
    final fb = (json['feedback'] as Map?)?.cast<String, dynamic>() ?? {};
    final claims = (json['claims'] as Map?)?.cast<String, dynamic>() ?? {};
    final flow = (json['flow'] as Map?)?.cast<String, dynamic>() ?? {};
    final money = (json['money'] as Map?)?.cast<String, dynamic>() ?? {};
    final notif = (json['notifications'] as Map?)?.cast<String, dynamic>() ?? {};
    int n(Map<String, dynamic> m, String k) => (m[k] as num?)?.toInt() ?? 0;
    double d(Map<String, dynamic> m, String k) =>
        (m[k] as num?)?.toDouble() ?? 0;
    return Overview(
      repairOpen: n(kpi, 'repair_open'),
      installOpen: n(kpi, 'install_open'),
      overSla: n(kpi, 'over_sla'),
      approvalsTotal: n(kpi, 'approvals'),
      aQuotes: n(ap, 'quotes'),
      aCustomer: n(ap, 'customer'),
      aPurchases: n(ap, 'purchases'),
      aCancels: n(ap, 'cancels'),
      slaWarning: n(sla, 'warning'),
      slaLate: n(sla, 'late'),
      slaCritical: n(sla, 'critical'),
      todayAppointments: n(today, 'appointments'),
      todayChecking: n(today, 'checking'),
      todayRepairing: n(today, 'repairing'),
      todayReceived: n(today, 'received'),
      todayReturned: n(today, 'returned'),
      unassignedRepair: n(un, 'repair'),
      unassignedInstall: n(un, 'install'),
      pipeline: ((json['pipeline'] as List?) ?? [])
          .map((row) => OverviewStage.fromJson(row as Map<String, dynamic>))
          .toList(),
      techLoad: ((json['tech_load'] as List?) ?? [])
          .map((row) => OverviewTech.fromJson(row as Map<String, dynamic>))
          .toList(),
      techFree: ((json['tech_free'] as List?) ?? [])
          .map((e) => e.toString())
          .toList(),
      feedbackAvg: (fb['avg'] as num?)?.toDouble(),
      feedbackJobs: n(fb, 'jobs'),
      feedbackUnhappy: n(fb, 'unhappy'),
      aging: ((json['aging'] as List?) ?? [])
          .map((row) => OverviewAge.fromJson(row as Map<String, dynamic>))
          .toList(),
      openTotal: (json['open_total'] as num?)?.toInt() ?? 0,
      oldest: ((json['oldest'] as List?) ?? [])
          .map((row) => OverviewOldJob.fromJson(row as Map<String, dynamic>))
          .toList(),
      techBacklog: ((json['tech_backlog'] as List?) ?? [])
          .map((row) => OverviewBacklog.fromJson(row as Map<String, dynamic>))
          .toList(),
      claimsOpen: n(claims, 'open'),
      claimsWaitDecision: n(claims, 'wait_decision'),
      loaners: (json['loaners'] as num?)?.toInt() ?? 0,
      flowOpened: n(flow, 'opened'),
      flowClosed: n(flow, 'closed'),
      moneyQuoted: d(money, 'quoted'),
      moneyPaid: d(money, 'paid'),
      moneyDue: d(money, 'due'),
      workflows: ((json['workflows'] as List?) ?? [])
          .map((row) => WorkflowSummary.fromJson(row as Map<String, dynamic>))
          .toList(),
      unreadCount: n(notif, 'unread'),
      feed: ((notif['recent'] as List?) ?? [])
          .map((row) => FeedItem.fromJson(row as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// ລາຍການກວດນັບ + ສະຖານະ setting
class StockCount {
  final List<StockItem> jobs;
  final bool enabled;
  StockCount({required this.jobs, required this.enabled});
}

/// ເຄື່ອງທີ່ຕ້ອງນັບ (ຢູ່ສູນ · ຂ້າມ IH)
class StockItem {
  final String code;
  final String? product;
  final String? sn;
  final String? brand;
  final String? customer;
  final String stageLabel;

  /// ປະເພດບໍລິການ — CI/ST/PS (IH ຖືກຂ້າມ)
  final String? serviceType;
  final String serviceTypeLabel;
  StockItem({
    required this.code,
    this.product,
    this.sn,
    this.brand,
    this.customer,
    required this.stageLabel,
    this.serviceType,
    required this.serviceTypeLabel,
  });

  factory StockItem.fromJson(Map<String, dynamic> json) => StockItem(
    code: json['code'] as String,
    product: json['product'] as String?,
    sn: json['sn'] as String?,
    brand: json['brand'] as String?,
    customer: json['customer'] as String?,
    stageLabel: json['stage_label'] as String? ?? '-',
    serviceType: json['service_type'] as String?,
    serviceTypeLabel: json['service_type_label'] as String? ?? '-',
  );
}

/// ແປງເປັນ int ໃຫ້ໄດ້ທັງ number ແລະ string.
///
/// ⚠️ ຖັນ `bigint` (int8) ຂອງ Postgres ຖືກ node-pg ສົ່ງອອກມາເປັນ **string**
/// (ກັນຄ່າເກີນຂອບເຂດ number ຂອງ JS) ⇒ `as num` ຈະ throw
/// "type 'String' is not a subtype of type 'num'".
int _asInt(dynamic value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

/// ລາຍການທີ່ລໍຜູ້ຈັດການອະນຸມັດ
class ApprovalItem {
  final String kind;
  final String kindLabel;
  final String ref;
  final String? title;
  final String? customer;
  final String? amount;
  final String? requestedAt;
  final int waitingSeconds;
  final String href;

  /// ໃບຂໍຊື້: ເລກ job ທີ່ໃບນີ້ອ້າງອີງ (null = ບໍ່ໄດ້ອ້າງອີງ ⇒ ຂຶ້ນປ້າຍເຕືອນ)
  final String? job;

  /// ຜົນທຽບລາຍການໃນໃບ ກັບອາໄຫຼ່ທີ່ຊ່າງຂໍມາ (ໃບຂໍເບີກຂອງ job)
  final String? matchLabel;

  /// true = ຕົງໝົດ · false = ມີບັນຫາ ⇒ ເບິ່ງກ່ອນກົດ · null = ບໍ່ກ່ຽວ
  final bool? matchOk;

  const ApprovalItem({
    required this.kind,
    required this.kindLabel,
    required this.ref,
    this.title,
    this.customer,
    this.amount,
    this.requestedAt,
    required this.waitingSeconds,
    required this.href,
    this.job,
    this.matchLabel,
    this.matchOk,
  });

  int get days => waitingSeconds ~/ 86400;

  /// "ຄ້າງ 5 ມື້" · "ຄ້າງ 3 ຊມ"
  String get waitingLabel {
    if (days > 0) return 'ຄ້າງ $days ມື້';
    final hours = waitingSeconds ~/ 3600;
    return hours > 0 ? 'ຄ້າງ $hours ຊມ' : 'ຫາກໍ່ຂໍ';
  }

  factory ApprovalItem.fromJson(Map<String, dynamic> json) => ApprovalItem(
    kind: json['kind'] as String? ?? '',
    kindLabel: json['kind_label'] as String? ?? '',
    ref: json['ref'] as String? ?? '',
    title: json['title'] as String?,
    customer: json['customer'] as String?,
    amount: json['amount'] as String?,
    requestedAt: json['requested_at'] as String?,
    waitingSeconds: _asInt(json['waiting_seconds']),
    href: json['href'] as String? ?? '',
    job: json['job'] as String?,
    matchLabel: json['match_label'] as String?,
    matchOk: json['match_ok'] as bool?,
  );
}

/// ແຖວລາຍການ (ໃບສະເໜີ = ສິນຄ້າ+ລາຄາ · ຂໍຍົກເລີກ = ອາໄຫຼ່ຄ້າງ)
class ApprovalLine {
  final String? name;
  final String qty;
  final String? unit;
  final String? price;
  final String? total;

  /// ໃບຂໍຊື້ອາໄຫຼ່: ແຖວນີ້ຢູ່ໃນໃບຂໍເບີກຂອງວຽກບໍ (null = ບໍ່ມີເລກ job ⇒ ທຽບບໍ່ໄດ້)
  final bool? requested;

  const ApprovalLine({
    this.name,
    required this.qty,
    this.unit,
    this.price,
    this.total,
    this.requested,
  });

  factory ApprovalLine.fromJson(Map<String, dynamic> j) => ApprovalLine(
    name: j['name'] as String?,
    qty: j['qty']?.toString() ?? '0',
    unit: j['unit'] as String?,
    price: j['price']?.toString(),
    total: j['total']?.toString(),
    requested: j['requested'] as bool?,
  );
}

/// ລາຍລະອຽດເຕັມຂອງລາຍການອະນຸມັດ
class ApprovalDetail {
  final String kind;
  final String ref;
  final String? product;
  final String? brand;
  final String? model;
  final String? sn;
  final String? customer;
  final String? tel;
  final String? warranty;
  final String? symptom;
  final String? diagnosis;
  final String? requestedBy;
  final String? requestedAt;
  final String? amount;
  final String? discount;
  final String? amountKip;
  final String? reason;
  final String? branch;
  final String? supplier;
  final String? jobCode;
  final String? remark;
  final List<ApprovalLine> lines;

  const ApprovalDetail({
    required this.kind,
    required this.ref,
    this.product,
    this.brand,
    this.model,
    this.sn,
    this.customer,
    this.tel,
    this.warranty,
    this.symptom,
    this.diagnosis,
    this.requestedBy,
    this.requestedAt,
    this.amount,
    this.discount,
    this.amountKip,
    this.reason,
    this.branch,
    this.supplier,
    this.jobCode,
    this.remark,
    required this.lines,
  });

  bool get isQuote => kind == 'quotation';

  factory ApprovalDetail.fromJson(Map<String, dynamic> j) => ApprovalDetail(
    kind: j['kind'] as String? ?? 'quotation',
    ref: j['ref'] as String? ?? '',
    product: j['product'] as String?,
    brand: j['brand'] as String?,
    model: j['model'] as String?,
    sn: j['sn'] as String?,
    customer: j['customer'] as String?,
    tel: j['tel'] as String?,
    warranty: j['warranty'] as String?,
    symptom: j['symptom'] as String?,
    diagnosis: j['diagnosis'] as String?,
    requestedBy: j['requestedBy'] as String?,
    requestedAt: j['requestedAt'] as String?,
    amount: j['amount']?.toString(),
    discount: j['discount']?.toString(),
    amountKip: j['amountKip']?.toString(),
    reason: j['reason'] as String?,
    branch: j['branch'] as String?,
    supplier: j['supplier'] as String?,
    jobCode: j['jobCode'] as String?,
    remark: j['remark'] as String?,
    lines: ((j['lines'] as List?) ?? [])
        .map((r) => ApprovalLine.fromJson(r as Map<String, dynamic>))
        .toList(),
  );
}

/// ຂໍ້ຄວາມໃນ chatter — `kind` = 'comment' (ຄົນພິມ) ຫຼື 'log' (ລະບົບບັນທຶກເອງ)
class ChatterMessage {
  final int id;
  final String kind;
  final String body;
  final String author;
  final String createdAt;
  const ChatterMessage({
    required this.id,
    required this.kind,
    required this.body,
    required this.author,
    required this.createdAt,
  });

  bool get isLog => kind == 'log';

  factory ChatterMessage.fromJson(Map<String, dynamic> json) => ChatterMessage(
    id: _asInt(json['id']),
    kind: json['kind'] as String? ?? 'log',
    body: json['body'] as String? ?? '',
    author: json['author'] as String? ?? '-',
    createdAt: json['created_at'] as String? ?? '',
  );
}

/// ກິດຈະກຳທີ່ນັດໄວ້ (todo/call/visit/meeting) — `daysLeft` ຕິດລົບ = ເລີຍກຳນົດ
class JobActivity {
  final int id;
  final String kind;
  final String summary;
  final String? note;
  final String assignedTo;
  final String dueDate;
  final int daysLeft;
  const JobActivity({
    required this.id,
    required this.kind,
    required this.summary,
    this.note,
    required this.assignedTo,
    required this.dueDate,
    required this.daysLeft,
  });

  bool get late => daysLeft < 0;
  bool get today => daysLeft == 0;

  factory JobActivity.fromJson(Map<String, dynamic> json) => JobActivity(
    id: _asInt(json['id']),
    kind: json['kind'] as String? ?? 'todo',
    summary: json['summary'] as String? ?? '',
    note: json['note'] as String?,
    assignedTo: json['assigned_to'] as String? ?? '',
    dueDate: json['due_date'] as String? ?? '',
    daysLeft: _asInt(json['days_left']),
  );
}

class JobChatter {
  final List<ChatterMessage> messages;
  final List<JobActivity> activities;
  const JobChatter({required this.messages, required this.activities});

  factory JobChatter.fromJson(Map<String, dynamic> json) => JobChatter(
    messages: ((json['messages'] as List?) ?? [])
        .map((row) => ChatterMessage.fromJson(row as Map<String, dynamic>))
        .toList(),
    activities: ((json['activities'] as List?) ?? [])
        .map((row) => JobActivity.fromJson(row as Map<String, dynamic>))
        .toList(),
  );
}

/// ຊຸດຮູບຂອງງານ — ທຸກຮູບເປັນ data-URI base64 (render ດ້ວຍ Image.memory)
class JobPhotos {
  final List<String> receive; // ຕອນຮັບເຄື່ອງ
  final List<String> check; // ຕອນກວດເຊັກ
  final List<String> finish; // ຕອນສ້ອມ/ຕິດຕັ້ງສຳເລັດ
  const JobPhotos({
    required this.receive,
    required this.check,
    required this.finish,
  });

  bool get isEmpty => receive.isEmpty && check.isEmpty && finish.isEmpty;

  static List<String> _list(dynamic v) =>
      (v as List?)?.map((e) => e as String).toList() ?? const [];

  factory JobPhotos.fromJson(Map<String, dynamic> json) => JobPhotos(
    receive: _list(json['receive']),
    check: _list(json['check']),
    finish: _list(json['finish']),
  );
}

class Job {
  final String workflow;
  final String code;
  final String? customer;
  final String? tel;
  final String? address;
  final String? product;
  final String? detail;
  // ── ລາຍລະອຽດສິນຄ້າ (ສະເພາະສ້ອມ) ──
  final String? sn; // serial number
  final String? warranty; // ສະຖານະຮັບປະກັນ (ຮັບປະກັນ / ໝົດຮັບປະກັນ)
  // ── ຜົນກວດເຊັກ (ສະເພາະສ້ອມ) ──
  final String? symptom; // ອາການທີ່ລູກຄ້າແຈ້ງ
  final String? diagnosis; // ຜົນວິເຄາະຂອງຊ່າງ
  final String? warrantyReason; // ເຫດຜົນເມື່ອໝົດຮັບປະກັນ
  final bool onsite;

  /// ປະເພດບໍລິການສ້ອມ (CI/ST/IH/PS) — null ຝັ່ງຕິດຕັ້ງ. IH = ໄປສ້ອມບ້ານ ⇒ ນຳເຂົ້າສູນໄດ້
  final String? serviceType;
  final int stage;
  final String stageLabel;
  final int elapsedSeconds;

  /// ວັນ-ເວລາຮັບເຄື່ອງເຂົ້າ · ວິນາທີລວມນັບແຕ່ຮັບເຄື່ອງ · ຜູ້ຮັບເຄື່ອງ
  final String? receivedAt;
  final int? totalSeconds;
  final String? receiver;
  final String? appointment;

  /// ປຸ່ມທີ່ຊ່າງກົດໄດ້ດຽວນີ້ — **server ຄິດໃຫ້** (accept/start/finish/wait_spare/wait_other)
  final String action;
  final bool checkedIn;
  final bool accepted;
  final bool hasCheckedIn;
  final bool hasCheckedOut;
  final bool canCheckIn;

  /// ຕິດຕັ້ງ: ສະແກນ ISN/SN ຮອບ "ກຳລັງຕິດຕັ້ງ" ແລ້ວບໍ (ດ່ານກ່ອນກົດສຳເລັດ)
  /// ເກັບ ISN/SN ຄົບທຸກໜ່ວຍແລ້ວບໍ (ດ່ານກ່ອນກົດຕິດຕັ້ງສຳເລັດ)
  final bool scanDone;

  /// ງານນີ້ມີໜ່ວຍນອກນຳບໍ (ແອ) ⇒ ຕ້ອງເກັບ 2 ເລກ
  final bool needOutdoor;

  /// ເລກທີ່ໃບງານລະບຸ — ໃຫ້ຊ່າງທຽບດ້ວຍຕາກ່ອນຍິງກ້ອງ
  final String? expectSn;
  final String? expectSnOut;
  final bool canCheckOut;

  /// ພິກັດສະຖານທີ່ (ຖ້າ CS ປັກໝຸດໄວ້) — ກົດນຳທາງໄດ້
  final double? lat;
  final double? lng;

  /// ວິນາທີທີ່ຍັງເຫຼືອຈົນຄົບ **24 ຊມ ນັບແຕ່ອອກບິນ** (ຕິດລົບ = ເລີຍກຳນົດ) — ສະເພາະຕິດຕັ້ງ.
  /// ຊ່າງຕ້ອງເຫັນນາລິກາອັນດຽວກັບຜູ້ຈັດການ ບໍ່ດັ່ງນັ້ນ "ດ່ວນ" ຂອງສອງຝ່າຍບໍ່ຕົງກັນ.
  final double? slaLeft;
  final String? undoTo; // ປ້າຍ "ຖອຍໄປຫາ" (null = ຖອຍບໍ່ໄດ້)

  /// ຄົນນີ້ເປັນ **ຫົວໜ້າງານ** ບໍ (false = ຊ່າງຮ່ວມ — 10-08-2026).
  ///
  /// 1 ໃບງານໃສ່ຊ່າງໄດ້ຫຼາຍຄົນ: ຫົວໜ້າ 1 ຄົນ + ຊ່າງຮ່ວມ N ຄົນ. ຊ່າງຮ່ວມ **ເຫັນງານ ·
  /// check-in/out · ຖ່າຍຮູບ · ເກັບ ISN/SN** ໄດ້ ແຕ່ **ຮັບງານ/ຈົບງານບໍ່ໄດ້** (server
  /// ປະຕິເສດ) ⇒ ຕ້ອງເຊື່ອງປຸ່ມ ບໍ່ດັ່ງນັ້ນຊ່າງກົດແລ້ວຄາຢູ່ໜ້າງານ ບໍ່ຮູ້ວ່າຜິດຫຍັງ.
  /// ຄ່າເລີ່ມ `true` — server ຮຸ່ນເກົ່າບໍ່ສົ່ງຖັນນີ້ມາ (ຕອນນັ້ນທຸກຄົນຄືຫົວໜ້າ).
  final bool isLead;

  /// ຊ່າງຄົນອື່ນທີ່ໄປງານນີ້ນຳ (ບໍ່ລວມຕົນເອງ) — ໃຫ້ຮູ້ວ່າມື້ນີ້ໄປກັບໃຜ ບໍ່ຕ້ອງໂທຖາມ
  final List<String> mates;

  /// ຈຳນວນຮອບເຂົ້າໜ້າງານທີ່ຜ່ານມາ — >0 ໝາຍວ່າໃບນີ້ເປັນໃບທີ່ **ກັບໄປ** ບໍ່ແມ່ນໃບໃໝ່
  final int visitRounds;

  Job({
    required this.workflow,
    required this.code,
    required this.customer,
    required this.tel,
    required this.address,
    required this.product,
    required this.detail,
    this.sn,
    this.warranty,
    this.symptom,
    this.diagnosis,
    this.warrantyReason,
    required this.onsite,
    this.serviceType,
    required this.stage,
    required this.stageLabel,
    required this.elapsedSeconds,
    this.receivedAt,
    this.totalSeconds,
    this.receiver,
    required this.appointment,
    required this.action,
    required this.checkedIn,
    required this.accepted,
    required this.hasCheckedIn,
    required this.hasCheckedOut,
    required this.canCheckIn,
    this.scanDone = false,
    this.needOutdoor = false,
    this.expectSn,
    this.expectSnOut,
    required this.canCheckOut,
    this.lat,
    this.lng,
    this.slaLeft,
    this.undoTo,
    this.isLead = true,
    this.mates = const [],
    this.visitRounds = 0,
  });

  factory Job.fromJson(Map<String, dynamic> json) => Job(
    workflow: json['workflow'] as String,
    code: json['code'] as String,
    customer: json['customer'] as String?,
    tel: json['tel'] as String?,
    address: json['address'] as String?,
    product: json['product'] as String?,
    detail: json['detail'] as String?,
    sn: json['sn'] as String?,
    warranty: json['warranty'] as String?,
    symptom: json['symptom'] as String?,
    diagnosis: json['diagnosis'] as String?,
    warrantyReason: json['warranty_reason'] as String?,
    onsite: json['onsite'] as bool? ?? false,
    serviceType: json['service_type'] as String?,
    stage: (json['stage'] as num).toInt(),
    stageLabel: json['stage_label'] as String? ?? '-',
    elapsedSeconds: (json['elapsed_seconds'] as num?)?.toInt() ?? 0,
    receivedAt: json['received_at'] as String?,
    totalSeconds: (json['total_seconds'] as num?)?.toInt(),
    receiver: json['receiver'] as String?,
    appointment: json['appointment'] as String?,
    action: json['action'] as String? ?? 'wait_other',
    checkedIn: json['checked_in'] as bool? ?? false,
    accepted: json['accepted'] as bool? ?? false,
    hasCheckedIn: json['has_checked_in'] as bool? ?? false,
    hasCheckedOut: json['has_checked_out'] as bool? ?? false,
    canCheckIn: json['can_check_in'] as bool? ?? false,
    scanDone: json['scan_done'] as bool? ?? false,
    needOutdoor: json['need_outdoor'] as bool? ?? false,
    expectSn: json['expect_sn'] as String?,
    expectSnOut: json['expect_sn_out'] as String?,
    canCheckOut: json['can_check_out'] as bool? ?? false,
    lat: (json['lat'] as num?)?.toDouble(),
    lng: (json['lng'] as num?)?.toDouble(),
    slaLeft: (json['sla_left'] as num?)?.toDouble(),
    undoTo: json['undo_to'] as String?,
    isLead: json['is_lead'] as bool? ?? true,
    mates: ((json['mates'] as List?) ?? const [])
        .map((value) => '$value')
        .where((value) => value.isNotEmpty)
        .toList(),
    visitRounds: (json['visit_rounds'] as num?)?.toInt() ?? 0,
  );

  /// "ເຫຼືອ 5 ຊມ" · "ເລີຍ 2 ມື້" · null = ບໍ່ມີນາລິກາ (ບິນເກົ່າບໍ່ມີວັນທີ / ງານສ້ອມ)
  String? get slaLabel {
    final left = slaLeft;
    if (left == null) return null;
    final late = left < 0;
    final total = left.abs();
    final days = total ~/ 86400;
    final hours = (total % 86400) ~/ 3600;
    final text = days > 0 ? '$days ມື້ $hours ຊມ' : '$hours ຊມ';
    return late ? 'ເລີຍ $text' : 'ເຫຼືອ $text';
  }

  bool get slaLate => (slaLeft ?? 1) < 0;
  bool get slaSoon => slaLeft != null && slaLeft! >= 0 && slaLeft! < 6 * 3600;

  int get days => elapsedSeconds ~/ 86400;

  /// ເວລາທີ່ໃຊ້ **ລວມ** ນັບແຕ່ຮັບເຄື່ອງເຂົ້າ — "3 ມື້ 5 ຊມ" · "5 ຊມ 20 ນທ"
  String? get totalLabel {
    final total = totalSeconds;
    if (total == null) return null;
    final days = total ~/ 86400;
    final hours = (total % 86400) ~/ 3600;
    final minutes = (total % 3600) ~/ 60;
    if (days > 0) return '$days ມື້ $hours ຊມ';
    if (hours > 0) return '$hours ຊມ $minutes ນທ';
    return '$minutes ນທ';
  }
}

class DraftLine {
  final int roworder;
  final String itemCode;
  final String? itemName;
  final double qty;
  DraftLine({
    required this.roworder,
    required this.itemCode,
    required this.itemName,
    required this.qty,
  });

  factory DraftLine.fromJson(Map<String, dynamic> json) => DraftLine(
    roworder: (json['roworder'] as num).toInt(),
    itemCode: json['item_code'] as String,
    itemName: json['item_name'] as String?,
    qty: (json['qty'] as num).toDouble(),
  );
}

/// ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — locked = ເບີກແລ້ວ (ຖອດບໍ່ໄດ້) · requested = ຢູ່ໃບຂໍເບີກແລ້ວ
class RepairSpareLine {
  final int roworder;
  final String itemCode;
  final String itemName;
  final double qty;
  final String? unitCode;
  final bool requested;
  final bool locked;

  /// ຢູ່ໃນຊຸດຕິດຕັ້ງຂອງໃບງານບໍ (ຝັ່ງຕິດຕັ້ງເທົ່ານັ້ນ — ຝັ່ງສ້ອມບໍ່ມີຊຸດ ⇒ false)
  final bool standard;
  RepairSpareLine({
    required this.roworder,
    required this.itemCode,
    required this.itemName,
    required this.qty,
    required this.unitCode,
    required this.requested,
    required this.locked,
    this.standard = false,
  });

  factory RepairSpareLine.fromJson(Map<String, dynamic> json) =>
      RepairSpareLine(
        roworder: (json['roworder'] as num).toInt(),
        itemCode: json['item_code'] as String,
        itemName: json['item_name'] as String? ?? '',
        qty: (json['qty'] as num).toDouble(),
        unitCode: json['unit_code'] as String?,
        requested: json['requested'] as bool? ?? false,
        locked: json['locked'] as bool? ?? false,
        standard: json['standard'] as bool? ?? false,
      );
}

/// ອາໄຫຼ່ 1 ລາຍການທີ່ຍັງ **ຄ້າງຂໍເບີກ** (ກະຕ່າ ລົບ ບັນຊີເອກະສານ 122/59)
class PendingSpareLine {
  final String itemCode;
  final String itemName;
  final String? unitCode;

  /// ຈຳນວນທີ່ຍັງຄ້າງ — ເພດານຂອງ "ໃບນີ້ເອົາຈັກໜ່ວຍ"
  final double qty;
  PendingSpareLine({
    required this.itemCode,
    required this.itemName,
    required this.unitCode,
    required this.qty,
  });

  factory PendingSpareLine.fromJson(Map<String, dynamic> json) =>
      PendingSpareLine(
        itemCode: json['item_code'] as String,
        itemName: json['item_name'] as String? ?? '',
        unitCode: json['unit_code'] as String?,
        qty: (json['qty'] as num?)?.toDouble() ?? 0,
      );
}

/// ອາໄຫຼ່ 1 ລາຍການໃນ **ຊຸດຕິດຕັ້ງ** ຂອງໃບງານ (used_spare_install ຕາມ install_type)
class InstallStandardSpare {
  final String itemCode;
  final String itemName;
  final String? unitCode;
  final double standardQty;
  final double requestedQty;
  final double remainingQty;
  InstallStandardSpare({
    required this.itemCode,
    required this.itemName,
    required this.unitCode,
    required this.standardQty,
    required this.requestedQty,
    required this.remainingQty,
  });

  factory InstallStandardSpare.fromJson(Map<String, dynamic> json) =>
      InstallStandardSpare(
        itemCode: json['item_code'] as String,
        itemName: json['item_name'] as String? ?? '',
        unitCode: json['unit_code'] as String?,
        standardQty: (json['standard_qty'] as num?)?.toDouble() ?? 0,
        requestedQty: (json['requested_qty'] as num?)?.toDouble() ?? 0,
        remainingQty: (json['remaining_qty'] as num?)?.toDouble() ?? 0,
      );
}

/// ຊຸດຕິດຕັ້ງ + ສະວິດ "ເບີກນອກມາດຕະຖານ" — ປິດແລ້ວແອັບເຊື່ອງຊ່ອງຄົ້ນຫາ
/// (ດ່ານຈິງຢູ່ server: lib/install-standard.blockNonStandard)
class InstallStandards {
  final List<InstallStandardSpare> items;
  final bool freeSearch;
  InstallStandards({required this.items, required this.freeSearch});

  factory InstallStandards.fromJson(Map<String, dynamic> json) =>
      InstallStandards(
        items: ((json['items'] as List?) ?? const [])
            .map(
              (row) =>
                  InstallStandardSpare.fromJson(row as Map<String, dynamic>),
            )
            .toList(),
        freeSearch: json['free_search'] as bool? ?? true,
      );
}

/// ຍອດຄົງເຫຼືອຂອງອາໄຫຼ່ ໃນສາງໜຶ່ງ (ຕິດຕາມສິນຄ້າຄົງເຫຼືອ)
class WhBalance {
  final String code;
  final String name;
  final double qty;
  WhBalance({required this.code, required this.name, required this.qty});
  factory WhBalance.fromJson(Map<String, dynamic> json) => WhBalance(
    code: json['code'] as String,
    name: json['name'] as String? ?? json['code'] as String,
    qty: (json['qty'] as num).toDouble(),
  );
}

class StockBalanceItem {
  final String code;
  final String name;
  final String? brand;
  final String? unitCode;
  final double total;
  final List<WhBalance> warehouses;
  StockBalanceItem({
    required this.code,
    required this.name,
    required this.brand,
    required this.unitCode,
    required this.total,
    required this.warehouses,
  });
  factory StockBalanceItem.fromJson(Map<String, dynamic> json) =>
      StockBalanceItem(
        code: json['code'] as String,
        name: json['name'] as String? ?? '',
        brand: json['brand'] as String?,
        unitCode: json['unit_code'] as String?,
        total: (json['total'] as num?)?.toDouble() ?? 0,
        warehouses: ((json['warehouses'] as List?) ?? [])
            .map((row) => WhBalance.fromJson(row))
            .toList(),
      );
}

/// ອາໄຫຼ່ທີ່ AI ແນະນຳ (ຈາກປະຫວັດການເບີກ ຮຸ່ນເຄື່ອງດຽວກັນ)
class SpareSuggestion {
  final String code;
  final String name;
  final String? unitCode;
  final int balance;
  final int uses;
  final int confidence; // 0–100

  SpareSuggestion({
    required this.code,
    required this.name,
    required this.unitCode,
    required this.balance,
    required this.uses,
    required this.confidence,
  });

  factory SpareSuggestion.fromJson(Map<String, dynamic> json) =>
      SpareSuggestion(
        code: json['code'] as String,
        name: json['name'] as String? ?? json['code'] as String,
        unitCode: json['unit_code'] as String?,
        balance: (json['balance'] as num?)?.toInt() ?? 0,
        uses: (json['uses'] as num?)?.toInt() ?? 0,
        confidence: (json['confidence'] as num?)?.toInt() ?? 0,
      );

  /// ແປງເປັນ SpareItem ເພື່ອສົ່ງ add_spare (check screen ໃຊ້ໂຄງดียวกัน)
  SpareItem toItem() =>
      SpareItem(code: code, name: name, unitCode: unitCode, balance: balance);
}

class SpareItem {
  final String code;
  final String name;
  final String? unitCode;
  final int balance;
  SpareItem({
    required this.code,
    required this.name,
    required this.unitCode,
    required this.balance,
  });

  factory SpareItem.fromJson(Map<String, dynamic> json) => SpareItem(
    code: json['code'] as String,
    name: json['name_1'] as String? ?? '',
    unitCode: json['unit_code'] as String?,
    balance: (json['balance_qty'] as num?)?.toInt() ?? 0,
  );
}

class PickupDoc {
  final String workflow;
  final String docNo;
  final String jobCode;
  final String docDate;
  final int lines;

  /// ຮອບຂອງໃບຂໍເບີກ (SIO) ທີ່ເປັນຕົ້ນເຫດ — ສະເພາະສ້ອມ (ຕິດຕັ້ງ = null)
  final int? round;
  PickupDoc({
    required this.workflow,
    required this.docNo,
    required this.jobCode,
    required this.docDate,
    required this.lines,
    this.round,
  });

  factory PickupDoc.fromJson(Map<String, dynamic> json) => PickupDoc(
    workflow: json['workflow'] as String? ?? 'repair',
    docNo: json['doc_no'] as String,
    jobCode: json['job_code'] as String? ?? '-',
    docDate: json['doc_date'] as String? ?? '-',
    lines: (json['lines'] as num?)?.toInt() ?? 0,
    round: (json['round'] as num?)?.toInt(),
  );
}

class Lookups {
  final List<Map<String, String>> warehouses;
  final List<Map<String, String>> shelves;

  Lookups({required this.warehouses, required this.shelves});

  factory Lookups.fromJson(Map<String, dynamic> json) => Lookups(
    warehouses: (json['warehouses'] as List)
        .map(
          (row) => {
            'code': row['code'] as String,
            'name': row['name'] as String,
          },
        )
        .toList(),
    shelves: (json['shelves'] as List)
        .map(
          (row) => {
            'code': row['code'] as String,
            'name': row['name'] as String,
            'wh_code': row['wh_code'] as String,
          },
        )
        .toList(),
  );
}

class QcJob {
  final String workflow;
  final String code;
  final String? customer;
  final String? item;
  final String? worker;
  final String? finishedAt;
  QcJob({
    required this.workflow,
    required this.code,
    required this.customer,
    required this.item,
    required this.worker,
    required this.finishedAt,
  });

  factory QcJob.fromJson(Map<String, dynamic> json) => QcJob(
    workflow: json['workflow'] as String,
    code: json['code'] as String,
    customer: json['customer'] as String?,
    item: json['item'] as String?,
    worker: json['worker'] as String?,
    finishedAt: json['finished_at'] as String?,
  );
}

class QcItem {
  final int id;
  final String name;
  final bool requirePhoto;
  bool? passed;
  String note;
  String photo;

  QcItem({
    required this.id,
    required this.name,
    required this.requirePhoto,
    this.passed,
    this.note = '',
    this.photo = '',
  });

  factory QcItem.fromJson(Map<String, dynamic> json) => QcItem(
    id: (json['id'] as num).toInt(),
    name: json['name'] as String,
    requirePhoto: json['require_photo'] as bool? ?? false,
    passed: json['passed'] as bool?,
    note: json['note'] as String? ?? '',
    photo: json['photo'] as String? ?? '',
  );
}

class QcDetail {
  final List<QcItem> items;

  /// ຮູບຜົນງານທີ່ **ຊ່າງ** ຖ່າຍໄວ້ຕອນຈົບງານ — ຜູ້ກວດຕ້ອງເຫັນ
  final List<String> photos;
  QcDetail({required this.items, required this.photos});

  factory QcDetail.fromJson(Map<String, dynamic> json) => QcDetail(
    items: (json['items'] as List).map((row) => QcItem.fromJson(row)).toList(),
    photos: (json['photos'] as List)
        .map((row) => row['photo'] as String)
        .toList(),
  );
}

class Income {
  final bool linked;
  final int jobs;
  final double totalThb;
  final List<Map<String, dynamic>> rows;
  Income({
    required this.linked,
    required this.jobs,
    required this.totalThb,
    required this.rows,
  });

  factory Income.fromJson(Map<String, dynamic> json) => Income(
    linked: json['linked'] as bool? ?? false,
    jobs: (json['jobs'] as num?)?.toInt() ?? 0,
    totalThb: (json['total_thb'] as num?)?.toDouble() ?? 0,
    rows: (json['rows'] as List).cast<Map<String, dynamic>>(),
  );
}

/// ແຈ້ງເຕືອນ 1 ລາຍການ (ots ດຽວກັບເວັບ — ods_notification)
class AppNotification {
  final int id;
  final String body;
  final String? actor;
  final String createdAt;
  final bool read;
  final String model;
  final String resId;

  AppNotification({
    required this.id,
    required this.body,
    required this.actor,
    required this.createdAt,
    required this.read,
    required this.model,
    required this.resId,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        // PostgreSQL bigint/int8 ອາດຖືກ serialize ເປັນ String.
        id: _asInt(json['id']),
        body: json['body']?.toString() ?? '',
        actor: json['actor']?.toString(),
        createdAt: json['created_at']?.toString() ?? '',
        read: json['read'] == true || json['read']?.toString() == 'true',
        model: json['model']?.toString() ?? '',
        resId: json['res_id']?.toString() ?? '',
      );
}

/// ອາໄຫຼ່ທີ່ **ຢູ່ນຳຊ່າງ** (ເບີກອອກແລ້ວ ຍັງບໍ່ໄດ້ຂໍສົ່ງຄືນ)
class OutstandingSpare {
  final String docNo;
  final String itemCode;
  final String itemName;
  final double qty;
  final String? unitCode;

  OutstandingSpare({
    required this.docNo,
    required this.itemCode,
    required this.itemName,
    required this.qty,
    required this.unitCode,
  });

  factory OutstandingSpare.fromJson(Map<String, dynamic> json) =>
      OutstandingSpare(
        docNo: json['doc_no'] as String,
        itemCode: json['item_code'] as String,
        itemName: json['item_name'] as String? ?? '',
        qty: double.tryParse('${json['qty']}') ?? 0,
        unitCode: json['unit_code'] as String?,
      );
}

/* ── ຕິດຕາມງານ / ຜົນງານລູກນ້ອງ / ລາຍງານ (manager monitor) ───────────── */

/// 1 ໃບໃນ monitor / ລາຍการงานຂອງຊ່າງ — ພຽງພໍໃຫ້ຜູ້ຈັດການ scan (ບໍ່ແມ່ນໜ້າ operate)
class MonitorJob {
  final String workflow; // repair | install
  final String code;
  final String? product;
  final String? customer;
  final String? tel;
  final String? address;
  final String? detail;
  final String? sn;
  final String? warranty;
  final String? symptom;
  final String? diagnosis;
  final String? receivedAt;
  final String? appointment;
  final String? tech;
  final String? serviceType;
  final String stageLabel;
  final int ageDays;
  final double? slaLeft; // ວິນາທີ; ຕິດລົບ = ເລີຍ SLA

  MonitorJob({
    required this.workflow,
    required this.code,
    required this.product,
    required this.customer,
    this.tel,
    this.address,
    this.detail,
    this.sn,
    this.warranty,
    this.symptom,
    this.diagnosis,
    this.receivedAt,
    this.appointment,
    required this.tech,
    required this.serviceType,
    required this.stageLabel,
    required this.ageDays,
    required this.slaLeft,
  });

  factory MonitorJob.fromJson(Map<String, dynamic> json) => MonitorJob(
    workflow: json['workflow'] as String? ?? 'repair',
    code: '${json['code']}',
    product: json['product'] as String?,
    customer: json['customer'] as String?,
    tel: json['tel'] as String?,
    address: json['address'] as String?,
    detail: json['detail'] as String?,
    sn: json['sn'] as String?,
    warranty: json['warranty'] as String?,
    symptom: json['symptom'] as String?,
    diagnosis: json['diagnosis'] as String?,
    receivedAt: json['received_at'] as String?,
    appointment: json['appointment'] as String?,
    tech: json['tech'] as String?,
    serviceType: json['service_type'] as String?,
    stageLabel: json['stage_label'] as String? ?? '',
    ageDays: (json['age_days'] as num?)?.toInt() ?? 0,
    slaLeft: (json['sla_left'] as num?)?.toDouble(),
  );

  bool get overdue => slaLeft != null && slaLeft! < 0;
}

/// ກຸ່ມໃນ monitor (key: late|unassigned|aging · tone: danger|warn|muted)
class MonitorGroup {
  final String key;
  final String label;
  final String tone;
  final List<MonitorJob> jobs;

  MonitorGroup({
    required this.key,
    required this.label,
    required this.tone,
    required this.jobs,
  });

  factory MonitorGroup.fromJson(Map<String, dynamic> json) => MonitorGroup(
    key: json['key'] as String? ?? '',
    label: json['label'] as String? ?? '',
    tone: json['tone'] as String? ?? 'muted',
    jobs: ((json['jobs'] as List?) ?? [])
        .map((row) => MonitorJob.fromJson(row as Map<String, dynamic>))
        .toList(),
  );
}

/// 1 ແຖວໃນ roster ຜົນງານລູກນ້ອງ
class TechRow {
  final String code;
  final String employeeCode;
  final String name;
  final int openJobs;
  final int oldestDays;
  final int late;
  final int monthJobs;
  final double? monthThb;
  final int rated; // ຈຳນວນປະເມີນ (ງານຕິດຕັ້ງ)
  final int? happyPct; // % ພໍໃຈ (null = ຍັງບໍ່ມີການປະເມີນ)
  final int unhappy; // ບໍ່ພໍໃຈ (points≥3)

  TechRow({
    required this.code,
    required this.employeeCode,
    required this.name,
    required this.openJobs,
    required this.oldestDays,
    required this.late,
    required this.monthJobs,
    required this.monthThb,
    required this.rated,
    required this.happyPct,
    required this.unhappy,
  });

  factory TechRow.fromJson(Map<String, dynamic> json) => TechRow(
    code: '${json['code']}',
    employeeCode: '${json['employee_code'] ?? json['code']}',
    name: json['name'] as String? ?? '-',
    openJobs: (json['open_jobs'] as num?)?.toInt() ?? 0,
    oldestDays: (json['oldest_days'] as num?)?.toInt() ?? 0,
    late: (json['late'] as num?)?.toInt() ?? 0,
    monthJobs: (json['month_jobs'] as num?)?.toInt() ?? 0,
    monthThb: (json['month_thb'] as num?)?.toDouble(),
    rated: (json['rated'] as num?)?.toInt() ?? 0,
    happyPct: (json['happy_pct'] as num?)?.toInt(),
    unhappy: (json['unhappy'] as num?)?.toInt() ?? 0,
  );
}

/// ຜົນງານຊ່າງ 1 ຄົນ (detail)
class TechDetail {
  final String code;
  final String employeeCode;
  final String name;
  final int openJobs;
  final int oldestDays;
  final int late;
  final int monthJobs;
  final double? monthThb;
  final int rated;
  final int? happyPct;
  final int unhappy;
  final int todayClosed;
  final int weekClosed;
  final List<MonitorJob> jobs;

  TechDetail({
    required this.code,
    required this.employeeCode,
    required this.name,
    required this.openJobs,
    required this.oldestDays,
    required this.late,
    required this.monthJobs,
    required this.monthThb,
    required this.rated,
    required this.happyPct,
    required this.unhappy,
    required this.todayClosed,
    required this.weekClosed,
    required this.jobs,
  });

  factory TechDetail.fromJson(Map<String, dynamic> json) => TechDetail(
    code: '${json['code']}',
    employeeCode: '${json['employee_code'] ?? json['code']}',
    name: json['name'] as String? ?? '-',
    openJobs: (json['open_jobs'] as num?)?.toInt() ?? 0,
    oldestDays: (json['oldest_days'] as num?)?.toInt() ?? 0,
    late: (json['late'] as num?)?.toInt() ?? 0,
    monthJobs: (json['month_jobs'] as num?)?.toInt() ?? 0,
    monthThb: (json['month_thb'] as num?)?.toDouble(),
    rated: (json['rated'] as num?)?.toInt() ?? 0,
    happyPct: (json['happy_pct'] as num?)?.toInt(),
    unhappy: (json['unhappy'] as num?)?.toInt() ?? 0,
    todayClosed: (json['today_closed'] as num?)?.toInt() ?? 0,
    weekClosed: (json['week_closed'] as num?)?.toInt() ?? 0,
    jobs: ((json['jobs'] as List?) ?? [])
        .map((row) => MonitorJob.fromJson(row as Map<String, dynamic>))
        .toList(),
  );
}

/// 1 ມື້ໃນ trend ລາຍງານ
class ReportDay {
  final String date; // YYYY-MM-DD
  final int opened;
  final int closed;
  ReportDay({required this.date, required this.opened, required this.closed});
  factory ReportDay.fromJson(Map<String, dynamic> json) => ReportDay(
    date: json['date'] as String? ?? '',
    opened: (json['opened'] as num?)?.toInt() ?? 0,
    closed: (json['closed'] as num?)?.toInt() ?? 0,
  );
}

/// ລາຍງານ (14 ມື້ + ຄ່າຄອມເດືອນນີ້)
class Reports {
  final List<ReportDay> days;
  final int totalOpened;
  final int totalClosed;
  final double? commissionMonthThb;
  final int? commissionMonthJobs;

  Reports({
    required this.days,
    required this.totalOpened,
    required this.totalClosed,
    required this.commissionMonthThb,
    required this.commissionMonthJobs,
  });

  factory Reports.fromJson(Map<String, dynamic> json) => Reports(
    days: ((json['days'] as List?) ?? [])
        .map((row) => ReportDay.fromJson(row as Map<String, dynamic>))
        .toList(),
    totalOpened: (json['total_opened'] as num?)?.toInt() ?? 0,
    totalClosed: (json['total_closed'] as num?)?.toInt() ?? 0,
    commissionMonthThb: (json['commission_month_thb'] as num?)?.toDouble(),
    commissionMonthJobs: (json['commission_month_jobs'] as num?)?.toInt(),
  );
}

/* ── ເສັ້ນເວລາງານສ້ອມ (timeline — ຄືກັບ web /service/[code]) ─────────── */

/// 1 ຂັ້ນໃນເສັ້ນເວລາ — state: done | current | pending
class TimelineStep {
  final int stage;
  final String label;
  final String? at; // ວັນ-ເວລາທີ່ເຂົ້າຂັ້ນ (null = ຍັງບໍ່ຮອດ)
  final int? durationSeconds; // ໄລຍະຢູ່ຂັ້ນນີ້ (current = live · done = ຄົງທີ່)
  final String state;

  TimelineStep({
    required this.stage,
    required this.label,
    required this.at,
    required this.durationSeconds,
    required this.state,
  });

  factory TimelineStep.fromJson(Map<String, dynamic> json) => TimelineStep(
    stage: (json['stage'] as num?)?.toInt() ?? 0,
    label: json['label'] as String? ?? '',
    at: json['at'] as String?,
    durationSeconds: (json['duration_seconds'] as num?)?.toInt(),
    state: json['state'] as String? ?? 'pending',
  );

  bool get isCurrent => state == 'current';
  bool get isDone => state == 'done';
}

/// 1 **ຮອບເຂົ້າໜ້າງານ** (check-in → check-out) — ງານຕິດຕັ້ງ 1 ໃບໄປໄດ້ຫຼາຍຮອບ.
///
/// ຮອບເກີດ**ພາຍໃນຂັ້ນດຽວ** (ລໍຕິດຕັ້ງ / ກຳລັງຕິດຕັ້ງ) ⇒ ເສັ້ນເວລາ 9 ຂັ້ນສະແດງບໍ່ໄດ້
/// ຈຶ່ງມາເປັນລາຍການແຍກ (ນິຍາມດຽວກັບເວັບ — lib/install-visits).
class JobVisit {
  final int n;
  final String? tech;
  final String? at; // ເຂົ້າໜ້າງານ
  final String? out; // ອອກ (null = ຍັງຢູ່ໜ້າງານ)
  final int? minutes;

  /// "ຮອບນີ້ຍັງບໍ່ຈົບຍ້ອນຫຍັງ" — ໃສ່ຕອນນັດຮອບຕໍ່ໄປ (null = ຮອບຈົບປົກກະຕິ ຫຼື ຂໍ້ມູນເກົ່າ)
  final String? reason;

  const JobVisit({
    required this.n,
    required this.tech,
    required this.at,
    required this.out,
    required this.minutes,
    this.reason,
  });

  factory JobVisit.fromJson(Map<String, dynamic> json) => JobVisit(
    n: (json['n'] as num?)?.toInt() ?? 0,
    tech: json['tech'] as String?,
    at: json['at'] as String?,
    out: json['out'] as String?,
    minutes: (json['minutes'] as num?)?.toInt(),
    reason: json['reason'] as String?,
  );

  /// "1 ຊມ 20 ນທ" · "45 ນທ" · "-" (ຄູ່ກັບ minutesLabel ຢູ່ເວັບ)
  String get lengthLabel {
    final value = minutes;
    if (value == null || value == 0) return '-';
    final hours = value ~/ 60;
    final rest = value % 60;
    if (hours == 0) return '$rest ນທ';
    return rest == 0 ? '$hours ຊມ' : '$hours ຊມ $rest ນທ';
  }
}

class JobTimelineData {
  final List<TimelineStep> steps;
  final String? cancelledAt;

  /// ຮອບເຂົ້າໜ້າງານ — ວ່າງສະເໝີສຳລັບງານສ້ອມ/ບຳລຸງ
  final List<JobVisit> visits;

  JobTimelineData({
    required this.steps,
    required this.cancelledAt,
    this.visits = const [],
  });
  factory JobTimelineData.fromJson(Map<String, dynamic> json) =>
      JobTimelineData(
        steps: ((json['steps'] as List?) ?? [])
            .map((row) => TimelineStep.fromJson(row as Map<String, dynamic>))
            .toList(),
        cancelledAt: json['cancelled_at'] as String?,
        visits: ((json['visits'] as List?) ?? [])
            .map((row) => JobVisit.fromJson(row as Map<String, dynamic>))
            .toList(),
      );
}

/// ຂໍ້ມູນການສົ່ງເຄື່ອງຈາກລະບົບຂົນສົ່ງ (odg_tms_detail) — ສະເພາະງານຕິດຕັ້ງ.
///
/// ບ່ອນທີ່ຂົນສົ່ງເອົາເຄື່ອງໄປວາງ = ບ່ອນທີ່ຊ່າງຕ້ອງໄປຕິດຕັ້ງ ⇒ ນຳທາງໄປໄດ້ເລີຍ.
/// `photos` ເປັນ **ຈຳນວນ** ບໍ່ແມ່ນຮູບ — ຮູບໜັກ 100-200KB ຕໍ່ໃບ ຈຶ່ງດຶງຕອນກົດເບິ່ງ
/// ຜ່ານ Api.deliveryPhotos() (ຊ່າງຢູ່ໜ້າງານເນັດຊ້າ ຢ່າໃຫ້ໂຫຼດທຸກຄັ້ງທີ່ເປີດງານ).
class DeliveryInfo {
  final String billNo;
  final double? lat;
  final double? lng;
  final String? sentEnd;
  final String? checkinAt;

  /// ເບີຂອງຄົນທີ່ຮັບເຄື່ອງຈິງ — ບາງເທື່ອບໍ່ແມ່ນຄົນໃນບິນ (ຍາມ · ລູກ · ເພື່ອນບ້ານ)
  final String? telephone;

  /// ໝາຍເຫດຂອງຄົນສົ່ງ (ເຊັ່ນ "ວາງໄວ້ໜ້າບ້ານ")
  final String? remark;
  final int photos;

  const DeliveryInfo({
    required this.billNo,
    required this.lat,
    required this.lng,
    required this.sentEnd,
    required this.checkinAt,
    required this.telephone,
    required this.remark,
    required this.photos,
  });

  bool get hasGeo => lat != null && lng != null;

  static double? _num(dynamic v) => v == null ? null : (v as num).toDouble();

  factory DeliveryInfo.fromJson(Map<String, dynamic> json) => DeliveryInfo(
    billNo: json['bill_no'] as String? ?? '',
    lat: _num(json['lat']),
    lng: _num(json['lng']),
    sentEnd: json['sent_end'] as String?,
    checkinAt: json['checkin_at'] as String?,
    telephone: json['telephone'] as String?,
    remark: json['remark'] as String?,
    photos: (json['photos'] as num?)?.toInt() ?? 0,
  );
}

/// **ເຄື່ອງສຳຮອງທີ່ຍັງບໍ່ຄືນ** ຂອງໃບງານສ້ອມ (ods_loaner) — ອ່ານຢ່າງດຽວຢູ່ແອັບ.
///
/// ຊ່າງທີ່ໄປສົ່ງເຄື່ອງຄືນເຖິງບ້ານ ຄືຄົນທີ່ຕ້ອງເອົາໜ່ວຍສຳຮອງກັບມາ ⇒ ຕ້ອງເຫັນກ່ອນອອກເດີນທາງ.
/// ການ "ໃຫ້ຢືມ/ຮັບຄືນ" ຍັງເຮັດຢູ່ເວັບຝ່າຍບໍລິການ (ດ່ານປິດງານກວດຢູ່ນັ້ນ).
class LoanerOut {
  final String itemName;
  final String isn;
  final int days;

  const LoanerOut({
    required this.itemName,
    required this.isn,
    required this.days,
  });

  factory LoanerOut.fromJson(Map<String, dynamic> json) => LoanerOut(
    itemName: json['item_name'] as String? ?? '',
    isn: json['isn'] as String? ?? '',
    days: (json['days'] as num?)?.toInt() ?? 0,
  );
}

/// "ຕອນນີ້ລໍໃຜເຮັດ" — server ຄິດໃຫ້ (lib/repair-next-action ຕົວດຽວກັບເວັບ)
class NextActor {
  final String actor; // cs | tech | stock | purchase | qc
  final String actorLabel; // ຝ່າຍຮັບ/CS · ຊ່າງ · ສາງ · ຈັດຊື້ · QC
  final String label;
  final String action;

  const NextActor({
    required this.actor,
    required this.actorLabel,
    required this.label,
    required this.action,
  });

  factory NextActor.fromJson(Map<String, dynamic> json) => NextActor(
    actor: json['actor'] as String? ?? '',
    actorLabel: json['actor_label'] as String? ?? '',
    label: json['label'] as String? ?? '',
    action: json['action'] as String? ?? '',
  );
}

/// ສະຖານະອາໄຫຼ່ລະດັບແຖວ (ນິຍາມດຽວກັບເວັບ: ກຳລັງສັ່ງຊື້ = status=5 + arrive_at ຫວ່າງ)
class SpareSummary {
  final int pending; // ຄ້າງເບີກ (status=0)
  final int onOrder; // ກຳລັງສັ່ງຊື້ (status=5 · arrive_at ຫວ່າງ)
  final int arrived; // ມາຮອດແລ້ວ ພ້ອມເບີກ (status=5 · arrive_at ບໍ່ຫວ່າງ)

  const SpareSummary({
    required this.pending,
    required this.onOrder,
    required this.arrived,
  });

  factory SpareSummary.fromJson(Map<String, dynamic> json) => SpareSummary(
    pending: (json['pending'] as num?)?.toInt() ?? 0,
    onOrder: (json['on_order'] as num?)?.toInt() ?? 0,
    arrived: (json['arrived'] as num?)?.toInt() ?? 0,
  );
}

/// ໃບຂໍເບີກ 1 ຮອບ (SIO) + ສະຖານະແຖວຂອງມັນ
class SpareWithdrawRound {
  final int round;
  final String docNo;
  final String docDate;
  final int lines;
  final String? dispatchNo; // ໃບເບີກຂອງສາງ (SWC) — ຫວ່າງ = ສາງຍັງບໍ່ຈ່າຍ
  final String? pickNo; // ໃບຮັບຂອງຊ່າງ (PISP) — ຫວ່າງ = ຍັງບໍ່ກົດຮັບ
  final String state; // requested | dispatched | received
  final String? status; // waiting | partial | purchasing | issued | null
  final int onOrder;
  final int arrived;
  /// ໃບຂໍຄືນຂອງຮອບນີ້ (ລວມທຸກໃບເບີກ) — ຫວ່າງ = ບໍ່ເຄີຍຂໍຄືນ
  final List<SpareReturnDoc> returns;

  /// ໃບເບີກ**ລາຍໃບ** ຂອງຮອບນີ້ — 1 ຮອບຖືກເບີກຫຼາຍໃບໄດ້ (ຄົນລະສາງ/ຄົນລະເທື່ອ)
  final List<SpareDispatchDoc> dispatches;

  const SpareWithdrawRound({
    required this.round,
    required this.docNo,
    required this.docDate,
    required this.lines,
    required this.dispatchNo,
    required this.pickNo,
    required this.state,
    required this.status,
    required this.onOrder,
    required this.arrived,
    this.returns = const [],
    this.dispatches = const [],
  });

  /// ຂໍຄືນໄປແລ້ວບໍ — ຖ້າແລ້ວ **ບໍ່ໃຫ້ຂໍຄືນຊ້ຳ** (ກົດດຽວກັບເວັບ)
  bool get hasReturn => returns.isNotEmpty;

  /// ຍັງລໍສາງຮັບຄືນຢູ່ຈັກໃບ
  int get returnsWaiting => returns.where((r) => r.waitingWarehouse).length;

  /// ໃບເບີກທີ່ **ຍັງບໍ່ໄດ້ກົດຮັບ** — ຕ້ອງເປັນ 0 ຈຶ່ງໄປຂັ້ນຕໍ່ໄປໄດ້
  List<SpareDispatchDoc> get waitingPickup =>
      dispatches.where((d) => !d.received).toList();

  factory SpareWithdrawRound.fromJson(Map<String, dynamic> json) =>
      SpareWithdrawRound(
        round: (json['round'] as num?)?.toInt() ?? 0,
        docNo: json['doc_no'] as String? ?? '',
        docDate: json['doc_date'] as String? ?? '-',
        lines: (json['lines'] as num?)?.toInt() ?? 0,
        dispatchNo: json['dispatch_no'] as String?,
        pickNo: json['pick_no'] as String?,
        state: json['state'] as String? ?? 'requested',
        status: json['status'] as String?,
        onOrder: (json['on_order'] as num?)?.toInt() ?? 0,
        arrived: (json['arrived'] as num?)?.toInt() ?? 0,
        // ໃບຂໍຄືນຢູ່ໃນ dispatches[].returns (ຝັ່ງ server ແຍກເປັນລາຍໃບເບີກ) ⇒ ລວມເປັນລາຍການດຽວ
        returns: ((json['dispatches'] as List?) ?? const [])
            .expand((d) => ((d as Map)['returns'] as List?) ?? const [])
            .map((r) => SpareReturnDoc.fromJson(r as Map<String, dynamic>))
            .toList(),
        dispatches: ((json['dispatches'] as List?) ?? const [])
            .map((d) => SpareDispatchDoc.fromJson(d as Map<String, dynamic>))
            .toList(),
      );
}

/// **ໃບເບີກ (SWC) 1 ໃບ** ຂອງຮອບ — ຊ່າງຕ້ອງ **ກົດຮັບທຸກໃບ** ຈຶ່ງໄປຂັ້ນຕໍ່ໄປໄດ້
/// (ກົດເກນ 06-08-2026) ⇒ ແອັບຕ້ອງໂຊ້ວເປັນລາຍໃບ ພ້ອມປຸ່ມ "ຮັບ" ຂອງໃບນັ້ນ.
class SpareDispatchDoc {
  final String docNo;
  final String? docDate;
  final int lines;

  /// ໃບຮັບ (PISP) ຂອງໃບນີ້ — ຫວ່າງ = ສາງເບີກແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ໄດ້ກົດຮັບ
  final String? pickNo;
  final String? pickDate;

  const SpareDispatchDoc({
    required this.docNo,
    required this.docDate,
    required this.lines,
    required this.pickNo,
    required this.pickDate,
  });

  bool get received => pickNo != null && pickNo!.isNotEmpty;

  factory SpareDispatchDoc.fromJson(Map<String, dynamic> json) => SpareDispatchDoc(
    docNo: json['doc_no'] as String? ?? '',
    docDate: json['doc_date'] as String?,
    lines: ((json['items'] as List?) ?? const []).length,
    pickNo: json['pick_no'] as String?,
    pickDate: json['pick_date'] as String?,
  );
}

/// **ໃບຂໍຄືນອາໄຫຼ່ (SRI)** ຂອງໃບເບີກ — ພ້ອມໃບຮັບຄືນຂອງສາງ (SRT).
///
/// ຮັບຄືນຫວ່າງ = **ຂໍຄືນໄປແລ້ວ ແຕ່ສາງຍັງບໍ່ຮັບເຂົ້າ** ⇒ ຂອງຍັງຄາຢູ່ມືຊ່າງ ແລະ
/// ສະຕັອກຍັງບໍ່ຄືນ (ຝັ່ງເວັບສະແດງເປັນປ້າຍ "ລໍສາງຮັບຄືນ" — ແອັບຕ້ອງບອກຄືກັນ).
class SpareReturnDoc {
  final String docNo;
  final String? docDate;
  final String? receiveNo;
  final String? receiveDate;

  const SpareReturnDoc({
    required this.docNo,
    required this.docDate,
    required this.receiveNo,
    required this.receiveDate,
  });

  bool get waitingWarehouse => receiveNo == null || receiveNo!.isEmpty;

  factory SpareReturnDoc.fromJson(Map<String, dynamic> json) => SpareReturnDoc(
    docNo: json['doc_no'] as String? ?? '',
    docDate: json['doc_date'] as String?,
    receiveNo: json['receive_no'] as String?,
    receiveDate: json['receive_date'] as String?,
  );
}

/// ໃບຂໍຊື້ 1 ຮອບ (RQ)
class SparePurchaseRound {
  final int round;
  final String docNo;
  final String docDate;
  final int lines;
  final String state; // waiting_approve | approved | rejected

  const SparePurchaseRound({
    required this.round,
    required this.docNo,
    required this.docDate,
    required this.lines,
    required this.state,
  });

  factory SparePurchaseRound.fromJson(Map<String, dynamic> json) =>
      SparePurchaseRound(
        round: (json['round'] as num?)?.toInt() ?? 0,
        docNo: json['doc_no'] as String? ?? '',
        docDate: json['doc_date'] as String? ?? '-',
        lines: (json['lines'] as num?)?.toInt() ?? 0,
        state: json['state'] as String? ?? 'waiting_approve',
      );
}

class SpareRounds {
  final List<SpareWithdrawRound> withdrawals;
  final List<SparePurchaseRound> purchases;

  const SpareRounds({required this.withdrawals, required this.purchases});

  factory SpareRounds.fromJson(Map<String, dynamic> json) => SpareRounds(
    withdrawals: (json['withdrawals'] as List<dynamic>? ?? const [])
        .map((row) => SpareWithdrawRound.fromJson(row as Map<String, dynamic>))
        .toList(growable: false),
    purchases: (json['purchases'] as List<dynamic>? ?? const [])
        .map((row) => SparePurchaseRound.fromJson(row as Map<String, dynamic>))
        .toList(growable: false),
  );
}

/// ໝຸດ 1 ອັນເທິງແຜນທີ່ງານຄ້າງ
class MapPin {
  final String workflow; // repair | install
  final String code;
  final double lat;
  final double lng;
  final String title;
  final String? customer;
  final String? tech;
  final String stageLabel;
  final int ageDays;
  final String? serviceType;

  /// job = ພິກັດທີ່ໝາຍຕອນເປີດງານ · checkin = ຈຸດທີ່ຊ່າງໄປຮອດ
  final String source;

  MapPin({
    required this.workflow,
    required this.code,
    required this.lat,
    required this.lng,
    required this.title,
    required this.customer,
    required this.tech,
    required this.stageLabel,
    required this.ageDays,
    required this.serviceType,
    required this.source,
  });

  factory MapPin.fromJson(Map<String, dynamic> json) => MapPin(
    workflow: json['workflow'] as String? ?? 'repair',
    code: '${json['code']}',
    lat: (json['lat'] as num?)?.toDouble() ?? 0,
    lng: (json['lng'] as num?)?.toDouble() ?? 0,
    title: json['title'] as String? ?? '',
    customer: json['customer'] as String?,
    tech: json['tech'] as String?,
    stageLabel: json['stage_label'] as String? ?? '',
    ageDays: (json['age_days'] as num?)?.toInt() ?? 0,
    serviceType: json['service_type'] as String?,
    source: json['source'] as String? ?? 'job',
  );
}

/// ຄ່າຄອມຂອງ 1 ຄົນ (ສະຫຼຸບ)
class CommissionPerson {
  final String employeeCode;
  final String name;
  final int jobs;
  final int lines;
  final double totalThb;
  CommissionPerson({
    required this.employeeCode,
    required this.name,
    required this.jobs,
    required this.lines,
    required this.totalThb,
  });
  factory CommissionPerson.fromJson(Map<String, dynamic> json) =>
      CommissionPerson(
        employeeCode: json['employee_code'] as String? ?? '',
        name: json['name'] as String? ?? '-',
        jobs: (json['jobs'] as num?)?.toInt() ?? 0,
        lines: (json['lines'] as num?)?.toInt() ?? 0,
        totalThb: (json['total_thb'] as num?)?.toDouble() ?? 0,
      );
}

/// 1 ແຖວຄ່າຄອມ — ບອກວ່າ **ເງິນນີ້ມາຈາກໃສ** (ໃບງານ · ອັດຕາ · ຍອດເຕັມ × ເປີເຊັນ)
class CommissionLine {
  final String employeeCode;
  final String name;
  final String jobCode;
  final String workflow;
  final String roleLabel;
  final String? rateLabel;
  final double amountThb;
  final double pct;
  final double payThb;
  final String? closedAt;
  CommissionLine({
    required this.employeeCode,
    required this.name,
    required this.jobCode,
    required this.workflow,
    required this.roleLabel,
    required this.rateLabel,
    required this.amountThb,
    required this.pct,
    required this.payThb,
    required this.closedAt,
  });
  factory CommissionLine.fromJson(Map<String, dynamic> json) => CommissionLine(
    employeeCode: json['employee_code'] as String? ?? '',
    name: json['name'] as String? ?? '-',
    jobCode: '${json['job_code']}',
    workflow: json['workflow'] as String? ?? '',
    roleLabel: json['role_label'] as String? ?? '',
    rateLabel: json['rate_label'] as String?,
    amountThb: (json['amount_thb'] as num?)?.toDouble() ?? 0,
    pct: (json['pct'] as num?)?.toDouble() ?? 0,
    payThb: (json['pay_thb'] as num?)?.toDouble() ?? 0,
    closedAt: json['closed_at'] as String?,
  );
}

/// ສະຫຼຸບຄ່າຄອມ 1 ເດືອນ
class Commission {
  final String month;
  final double totalThb;
  final int jobs;
  final List<CommissionPerson> people;
  final List<CommissionLine> lines;
  Commission({
    required this.month,
    required this.totalThb,
    required this.jobs,
    required this.people,
    required this.lines,
  });
  factory Commission.fromJson(Map<String, dynamic> json) => Commission(
    month: json['month'] as String? ?? '',
    totalThb: (json['total_thb'] as num?)?.toDouble() ?? 0,
    jobs: (json['jobs'] as num?)?.toInt() ?? 0,
    people: ((json['people'] as List?) ?? [])
        .map((row) => CommissionPerson.fromJson(row as Map<String, dynamic>))
        .toList(),
    lines: ((json['lines'] as List?) ?? [])
        .map((row) => CommissionLine.fromJson(row as Map<String, dynamic>))
        .toList(),
  );
}

/// ຍອດຂອງ 1 ອາໄຫຼ່ ໃນ 1 ສູນ
class StockCenterQty {
  final String code;
  final String name;
  final double qty;
  StockCenterQty({required this.code, required this.name, required this.qty});
  factory StockCenterQty.fromJson(Map<String, dynamic> json) => StockCenterQty(
    code: json['code'] as String? ?? '',
    name: json['name'] as String? ?? '',
    qty: (json['qty'] as num?)?.toDouble() ?? 0,
  );
}

/// ຕົວກອງ (ສູນ ຫຼື ທີ່ຈັດເກັບ) + ຈຳນວນອາໄຫຼ່ໃນນັ້ນ
class StockFilter {
  final String code;
  final String name;
  final int items;
  StockFilter({required this.code, required this.name, required this.items});
  factory StockFilter.fromJson(Map<String, dynamic> json) => StockFilter(
    code: json['code'] as String? ?? '',
    name: json['name'] as String? ?? '',
    items: (json['items'] as num?)?.toInt() ?? 0,
  );
}

/// 1 ແຖວໃນລາຍການອາໄຫຼ່
class RepairStockRow {
  final String code;
  final String name;
  final String? unitCode;
  final double total;
  final List<StockCenterQty> centers;
  RepairStockRow({
    required this.code,
    required this.name,
    required this.unitCode,
    required this.total,
    required this.centers,
  });
  factory RepairStockRow.fromJson(Map<String, dynamic> json) => RepairStockRow(
    code: json['code'] as String? ?? '',
    name: json['name'] as String? ?? '',
    unitCode: json['unit_code'] as String?,
    total: (json['total'] as num?)?.toDouble() ?? 0,
    centers: ((json['centers'] as List?) ?? [])
        .map((row) => StockCenterQty.fromJson(row as Map<String, dynamic>))
        .toList(),
  );
}

/// ໜ້າໜຶ່ງຂອງລາຍການອາໄຫຼ່ ສາງສູນບໍລິການ
class RepairStock {
  final List<RepairStockRow> items;
  final int total;
  final int page;
  final int pages;
  final String? refreshedAt;
  final List<StockFilter> centers;
  final List<StockFilter> shelves;
  RepairStock({
    required this.items,
    required this.total,
    required this.page,
    required this.pages,
    required this.refreshedAt,
    required this.centers,
    required this.shelves,
  });
  factory RepairStock.fromJson(Map<String, dynamic> json) => RepairStock(
    items: ((json['items'] as List?) ?? [])
        .map((row) => RepairStockRow.fromJson(row as Map<String, dynamic>))
        .toList(),
    total: (json['total'] as num?)?.toInt() ?? 0,
    page: (json['page'] as num?)?.toInt() ?? 1,
    pages: (json['pages'] as num?)?.toInt() ?? 1,
    refreshedAt: json['refreshed_at'] as String?,
    centers: ((json['centers'] as List?) ?? [])
        .map((row) => StockFilter.fromJson(row as Map<String, dynamic>))
        .toList(),
    shelves: ((json['shelves'] as List?) ?? [])
        .map((row) => StockFilter.fromJson(row as Map<String, dynamic>))
        .toList(),
  );
}

/// ບ່ອນທີ່ອາໄຫຼ່ຢູ່ (ສາງ + ທີ່ຈັດເກັບ)
class StockPlace {
  final String whCode;
  final String whName;
  final String location;
  final String locationName;
  final double qty;
  StockPlace({
    required this.whCode,
    required this.whName,
    required this.location,
    required this.locationName,
    required this.qty,
  });
  factory StockPlace.fromJson(Map<String, dynamic> json) => StockPlace(
    whCode: json['wh_code'] as String? ?? '',
    whName: json['wh_name'] as String? ?? '',
    location: json['location'] as String? ?? '',
    locationName: json['location_name'] as String? ?? '',
    qty: (json['qty'] as num?)?.toDouble() ?? 0,
  );
}

/// ຄວາມເຄື່ອນໄຫວ 1 ແຖວ
class StockMove {
  final String docNo;
  final String? docDate;
  final String kind;
  final double qty;
  final String whCode;
  StockMove({
    required this.docNo,
    required this.docDate,
    required this.kind,
    required this.qty,
    required this.whCode,
  });
  factory StockMove.fromJson(Map<String, dynamic> json) => StockMove(
    docNo: json['doc_no'] as String? ?? '',
    docDate: json['doc_date'] as String?,
    kind: json['kind'] as String? ?? '',
    qty: (json['qty'] as num?)?.toDouble() ?? 0,
    whCode: json['wh_code'] as String? ?? '',
  );
}

/// ລາຍລະອຽດອາໄຫຼ່ 1 ຕົວ
class RepairStockDetail {
  final String code;
  final String name;
  final String? unitCode;
  final double total;
  final List<StockPlace> places;
  final List<StockMove> moves;
  RepairStockDetail({
    required this.code,
    required this.name,
    required this.unitCode,
    required this.total,
    required this.places,
    required this.moves,
  });
  factory RepairStockDetail.fromJson(Map<String, dynamic> json) =>
      RepairStockDetail(
        code: json['code'] as String? ?? '',
        name: json['name'] as String? ?? '',
        unitCode: json['unit_code'] as String?,
        total: (json['total'] as num?)?.toDouble() ?? 0,
        places: ((json['places'] as List?) ?? [])
            .map((row) => StockPlace.fromJson(row as Map<String, dynamic>))
            .toList(),
        moves: ((json['moves'] as List?) ?? [])
            .map((row) => StockMove.fromJson(row as Map<String, dynamic>))
            .toList(),
      );
}

/// 1 ກິດຈະກຳທີ່ນັດໄວ້ໃສ່ໃບງານ (todo · ໂທ · ໄປພົບ · ປະຊຸມ)
///
/// ⚠️ ຊື່ `JobActivity` ຖືກໃຊ້ແລ້ວ (ກິດຈະກຳໃນໜ້າໃບງານຂອງຊ່າງ) ຈຶ່ງໃຊ້ຊື່ນີ້ແທນ.
class PlannedActivity {
  final int id;
  final String resId;
  final String kind;
  final String summary;
  final String? note;

  /// ຜູ້ຮັບຜິດຊອບ **ທຸກຄົນ** ຄັ່ນດ້ວຍ ", "
  final String assignedTo;
  final String? dueDate;
  final String createdBy;

  /// ຕິດລົບ = ເລີຍກຳນົດແລ້ວ
  final int daysLeft;
  final String? jobTitle;
  final String? customer;
  final String workflow;

  PlannedActivity({
    required this.id,
    required this.resId,
    required this.kind,
    required this.summary,
    required this.note,
    required this.assignedTo,
    required this.dueDate,
    required this.createdBy,
    required this.daysLeft,
    required this.jobTitle,
    required this.customer,
    required this.workflow,
  });

  factory PlannedActivity.fromJson(Map<String, dynamic> json) =>
      PlannedActivity(
        id: (json['id'] as num?)?.toInt() ?? 0,
        resId: '${json['res_id']}',
        kind: json['kind'] as String? ?? 'todo',
        summary: json['summary'] as String? ?? '',
        note: json['note'] as String?,
        assignedTo: json['assigned_to'] as String? ?? '-',
        dueDate: json['due_date'] as String?,
        createdBy: json['created_by'] as String? ?? '',
        daysLeft: (json['days_left'] as num?)?.toInt() ?? 0,
        jobTitle: json['job_title'] as String?,
        customer: json['customer'] as String?,
        workflow: json['workflow'] as String? ?? 'repair',
      );

  String get kindLabel => switch (kind) {
    'call' => 'ໂທຫາ',
    'visit' => 'ໄປພົບ',
    'meeting' => 'ປະຊຸມ',
    _ => 'ວຽກຕ້ອງເຮັດ',
  };
}
