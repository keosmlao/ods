import 'dart:convert';
import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

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
  static String? _sessionToken;

  static Future<String?> token() async =>
      _sessionToken ?? await _storage.read(key: _tokenKey);
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
  }

  // ຊື່ຜູ້ໃຊ້ + ປ້າຍ role — ເກັບໄວ້ໃຫ້ໜ້າ home ທັກທາຍ (ບໍ່ຕ້ອງ login ຄືນ)
  static const _userKey = 'odss_user';
  static const _roleLabelKey = 'odss_role_label';
  static Future<String?> savedUsername() => _storage.read(key: _userKey);
  static Future<String?> savedRoleLabel() => _storage.read(key: _roleLabelKey);

  // ໜ້າຕັ້ງຕົ້ນ (jobs/stock-count) — ເກັບໄວ້ໃຫ້ _Gate route ຖືກຕອນເປີດແອັບຄືນ
  static const _homeKey = 'odss_home';
  static Future<String> savedHome() async =>
      (await _storage.read(key: _homeKey)) ?? 'jobs';
  static Future<void> saveHome(String value) =>
      _storage.write(key: _homeKey, value: value);

  // ແຖບລຸ່ມ (ສ່ວນງານ) ຕາມ role — server ສົ່ງມາຕອນ login, ເກັບໄວ້ໃຫ້ _Gate
  // ປະກອບແອັບຄືນຕອນເປີດໃໝ່ໂດຍບໍ່ຕ້ອງ login ຄືນ (token ອາຍຸ 30 ມື້).
  static const _navKey = 'odss_nav';
  static Future<List<NavTab>> savedTabs() async {
    final raw = await _storage.read(key: _navKey);
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

  static Future<String> serverUrl() async =>
      (await _storage.read(key: _serverKey)) ?? defaultBaseUrl;
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
    final headers = <String, String>{'content-type': 'application/json'};
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
      throw ApiError(
        (decoded['error'] as String?) ?? 'ເຊື່ອມຕໍ່ບໍ່ໄດ້',
        response.statusCode,
      );
    }
    return decoded;
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
    final result = await _send('GET', '/api/mobile/jobs');
    return (result['jobs'] as List).map((row) => Job.fromJson(row)).toList();
  }

  /// ຄຳສັ່ງທັງໝົດຂອງງານ: accept · reject · start · finish · checkin · checkout
  static Future<String> command(
    String workflow,
    String code,
    Map<String, dynamic> body,
  ) async {
    final result = await _send(
      'POST',
      '/api/mobile/jobs/$workflow/$code',
      body: body,
    );
    return result['message'] as String;
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
  }) => _send('POST', '/api/mobile/approvals', body: {
    'action': action,
    'ref': ref,
    'reason': reason,
  });

  /* ── Chatter ແລະ ກິດຈະກຳ ────────────────────────────────────── */

  /// ການເຄື່ອນໄຫວຂອງງານ — ຂໍ້ຄວາມ/log ແລະ ກິດຈະກຳທີ່ຍັງຄ້າງ (ຊຸດດຽວກັບເວັບ)
  static Future<JobChatter> chatter(String workflow, String code) async {
    final result = await _send('GET', '/api/mobile/chatter/$workflow/$code');
    return JobChatter.fromJson(result);
  }

  /// ພິມຂໍ້ຄວາມໃສ່ໃບງານ — CS/ຫົວໜ້າ ເຫັນຢູ່ເວັບທັນທີ
  static Future<void> postChatter(String workflow, String code, String body) =>
      _send('POST', '/api/mobile/chatter/$workflow/$code', body: {
        'action': 'post',
        'body': body,
      });

  /// ກົດວ່າກິດຈະກຳເຮັດແລ້ວ
  static Future<void> completeActivity(
    String workflow,
    String code,
    int id, {
    String note = '',
  }) => _send('POST', '/api/mobile/chatter/$workflow/$code', body: {
    'action': 'complete_activity',
    'id': id,
    'note': note,
  });

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

  /// browse ຄົງເຫຼືອ ສາງສ້ອມ (1104/1206) ຈາກ cache — ໄວ. q = ກອງ.
  static Future<({List<StockBalanceItem> items, String? refreshedAt})> repairStock(String query) async {
    final result = await _send(
      'GET',
      '/api/mobile/repair-stock?q=${Uri.encodeQueryComponent(query)}',
    );
    final items = (result['items'] as List)
        .map((row) => StockBalanceItem.fromJson(row))
        .toList();
    return (items: items, refreshedAt: result['refreshed_at'] as String?);
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

  /* ── ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9): ລາຍການ · ເພີ່ມ · ຖອດ ── */

  static Future<List<RepairSpareLine>> usedSpares(String code) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {'action': 'used-list', 'code': code},
    );
    return (result['data'] as List)
        .map((row) => RepairSpareLine.fromJson(row))
        .toList();
  }

  static Future<String> addUsedSpare(String code, SpareItem item, int qty) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {
        'action': 'add-used',
        'code': code,
        'item': {'code': item.code, 'name_1': item.name, 'unit_code': item.unitCode},
        'qty': qty,
      },
    );
    return result['message'] as String;
  }

  static Future<String> removeUsedSpare(String code, int roworder) async {
    final result = await _send(
      'POST',
      '/api/mobile/spare-request',
      body: {'action': 'remove-used', 'code': code, 'roworder': roworder},
    );
    return result['message'] as String;
  }

  static Future<String> requestSpares(
    String workflow,
    String code,
    String whCode,
    String shelfCode,
    String remark,
  ) async {
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

  static Future<(List<AppNotification>, int)> notifications({
    bool unreadOnly = true,
  }) async {
    final result = await _send(
      'GET',
      '/api/mobile/notifications?tab=${unreadOnly ? 'unread' : 'all'}',
    );
    final rows = (result['data'] as List)
        .map((row) => AppNotification.fromJson(row))
        .toList();
    return (rows, (result['unread'] as num?)?.toInt() ?? 0);
  }

  static Future<void> markNotificationRead({int? id, bool all = false}) => _send(
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
  OverviewStage({required this.key, required this.label, required this.count});
  factory OverviewStage.fromJson(Map<String, dynamic> json) => OverviewStage(
    key: json['key'] as String,
    label: json['label'] as String? ?? '',
    count: (json['count'] as num?)?.toInt() ?? 0,
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

/// ພາບລວມບໍລິຫານ (ໜ້າຫຼັກຜູ້ຈັດການ) — ຫຍໍ້ຈາກ dashboard ຝັ່ງເວັບ
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
  final int unassignedRepair;
  final int unassignedInstall;
  final List<OverviewStage> pipeline;
  final List<OverviewTech> techLoad;
  final List<String> techFree; // ຊ່າງທີ່ວ່າງ (ບໍ່ມີວຽກຄ້າງ)
  final double? feedbackAvg;
  final int feedbackJobs;
  final int feedbackUnhappy;

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
    required this.unassignedRepair,
    required this.unassignedInstall,
    required this.pipeline,
    required this.techLoad,
    required this.techFree,
    required this.feedbackAvg,
    required this.feedbackJobs,
    required this.feedbackUnhappy,
  });

  factory Overview.fromJson(Map<String, dynamic> json) {
    final kpi = (json['kpi'] as Map?)?.cast<String, dynamic>() ?? {};
    final ap = (json['approvals'] as Map?)?.cast<String, dynamic>() ?? {};
    final sla = (json['sla'] as Map?)?.cast<String, dynamic>() ?? {};
    final today = (json['today'] as Map?)?.cast<String, dynamic>() ?? {};
    final un = (json['unassigned'] as Map?)?.cast<String, dynamic>() ?? {};
    final fb = (json['feedback'] as Map?)?.cast<String, dynamic>() ?? {};
    int n(Map<String, dynamic> m, String k) => (m[k] as num?)?.toInt() ?? 0;
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
      unassignedRepair: n(un, 'repair'),
      unassignedInstall: n(un, 'install'),
      pipeline: ((json['pipeline'] as List?) ?? [])
          .map((row) => OverviewStage.fromJson(row as Map<String, dynamic>))
          .toList(),
      techLoad: ((json['tech_load'] as List?) ?? [])
          .map((row) => OverviewTech.fromJson(row as Map<String, dynamic>))
          .toList(),
      techFree: ((json['tech_free'] as List?) ?? []).map((e) => e.toString()).toList(),
      feedbackAvg: (fb['avg'] as num?)?.toDouble(),
      feedbackJobs: n(fb, 'jobs'),
      feedbackUnhappy: n(fb, 'unhappy'),
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
  );
}

/// ແຖວລາຍການ (ໃບສະເໜີ = ສິນຄ້າ+ລາຄາ · ຂໍຍົກເລີກ = ອາໄຫຼ່ຄ້າງ)
class ApprovalLine {
  final String? name;
  final String qty;
  final String? unit;
  final String? price;
  final String? total;
  const ApprovalLine({this.name, required this.qty, this.unit, this.price, this.total});

  factory ApprovalLine.fromJson(Map<String, dynamic> j) => ApprovalLine(
    name: j['name'] as String?,
    qty: j['qty']?.toString() ?? '0',
    unit: j['unit'] as String?,
    price: j['price']?.toString(),
    total: j['total']?.toString(),
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
  final bool canCheckOut;

  /// ພິກັດສະຖານທີ່ (ຖ້າ CS ປັກໝຸດໄວ້) — ກົດນຳທາງໄດ້
  final double? lat;
  final double? lng;

  /// ວິນາທີທີ່ຍັງເຫຼືອຈົນຄົບ **24 ຊມ ນັບແຕ່ອອກບິນ** (ຕິດລົບ = ເລີຍກຳນົດ) — ສະເພາະຕິດຕັ້ງ.
  /// ຊ່າງຕ້ອງເຫັນນາລິກາອັນດຽວກັບຜູ້ຈັດການ ບໍ່ດັ່ງນັ້ນ "ດ່ວນ" ຂອງສອງຝ່າຍບໍ່ຕົງກັນ.
  final double? slaLeft;
  final String? undoTo; // ປ້າຍ "ຖອຍໄປຫາ" (null = ຖອຍບໍ່ໄດ້)

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
    required this.canCheckOut,
    this.lat,
    this.lng,
    this.slaLeft,
    this.undoTo,
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
    canCheckOut: json['can_check_out'] as bool? ?? false,
    lat: (json['lat'] as num?)?.toDouble(),
    lng: (json['lng'] as num?)?.toDouble(),
    slaLeft: (json['sla_left'] as num?)?.toDouble(),
    undoTo: json['undo_to'] as String?,
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
  RepairSpareLine({
    required this.roworder,
    required this.itemCode,
    required this.itemName,
    required this.qty,
    required this.unitCode,
    required this.requested,
    required this.locked,
  });

  factory RepairSpareLine.fromJson(Map<String, dynamic> json) => RepairSpareLine(
    roworder: (json['roworder'] as num).toInt(),
    itemCode: json['item_code'] as String,
    itemName: json['item_name'] as String? ?? '',
    qty: (json['qty'] as num).toDouble(),
    unitCode: json['unit_code'] as String?,
    requested: json['requested'] as bool? ?? false,
    locked: json['locked'] as bool? ?? false,
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
  factory StockBalanceItem.fromJson(Map<String, dynamic> json) => StockBalanceItem(
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

  factory SpareSuggestion.fromJson(Map<String, dynamic> json) => SpareSuggestion(
    code: json['code'] as String,
    name: json['name'] as String? ?? json['code'] as String,
    unitCode: json['unit_code'] as String?,
    balance: (json['balance'] as num?)?.toInt() ?? 0,
    uses: (json['uses'] as num?)?.toInt() ?? 0,
    confidence: (json['confidence'] as num?)?.toInt() ?? 0,
  );

  /// ແປງເປັນ SpareItem ເພື່ອສົ່ງ add_spare (check screen ໃຊ້ໂຄງดียวกัน)
  SpareItem toItem() => SpareItem(
    code: code,
    name: name,
    unitCode: unitCode,
    balance: balance,
  );
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
  PickupDoc({
    required this.workflow,
    required this.docNo,
    required this.jobCode,
    required this.docDate,
    required this.lines,
  });

  factory PickupDoc.fromJson(Map<String, dynamic> json) => PickupDoc(
    workflow: json['workflow'] as String? ?? 'repair',
    docNo: json['doc_no'] as String,
    jobCode: json['job_code'] as String? ?? '-',
    docDate: json['doc_date'] as String? ?? '-',
    lines: (json['lines'] as num?)?.toInt() ?? 0,
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

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
    id: (json['id'] as num).toInt(),
    body: json['body'] as String? ?? '',
    actor: json['actor'] as String?,
    createdAt: json['created_at'] as String? ?? '',
    read: json['read'] as bool? ?? false,
    model: json['model'] as String? ?? '',
    resId: json['res_id'] as String? ?? '',
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

  factory OutstandingSpare.fromJson(Map<String, dynamic> json) => OutstandingSpare(
    docNo: json['doc_no'] as String,
    itemCode: json['item_code'] as String,
    itemName: json['item_name'] as String? ?? '',
    qty: double.tryParse('${json['qty']}') ?? 0,
    unitCode: json['unit_code'] as String?,
  );
}
