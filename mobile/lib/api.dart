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
    defaultValue: 'https://service.odien.net',
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
  }

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
    return MobileUser.fromJson(result['user'] as Map<String, dynamic>);
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

  /* ── ອາໄຫຼ່: ຂໍເບີກ ແລະ ກົດຮັບ ───────────────────────────────── */

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

  static Future<String> requestSpares(
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
        'code': code,
        'wh_code': whCode,
        'shelf_code': shelfCode,
        'remark': remark,
      },
    );
    return result['message'] as String;
  }

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
}

class ApiError implements Exception {
  final String message;
  final int status;
  ApiError(this.message, this.status);
  @override
  String toString() => message;
}

/* ── ຊະນິດຂໍ້ມູນ ─────────────────────────────────────────────────── */

class MobileUser {
  final String username;
  final String role;
  final String roleLabel;
  MobileUser({
    required this.username,
    required this.role,
    required this.roleLabel,
  });

  factory MobileUser.fromJson(Map<String, dynamic> json) => MobileUser(
    username: json['username'] as String,
    role: json['role'] as String,
    roleLabel: json['role_label'] as String? ?? '',
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
  final bool onsite;
  final int stage;
  final String stageLabel;
  final int elapsedSeconds;
  final String? appointment;

  /// ປຸ່ມທີ່ຊ່າງກົດໄດ້ດຽວນີ້ — **server ຄິດໃຫ້** (accept/start/finish/wait_spare/wait_other)
  final String action;
  final bool checkedIn;

  Job({
    required this.workflow,
    required this.code,
    required this.customer,
    required this.tel,
    required this.address,
    required this.product,
    required this.detail,
    required this.onsite,
    required this.stage,
    required this.stageLabel,
    required this.elapsedSeconds,
    required this.appointment,
    required this.action,
    required this.checkedIn,
  });

  factory Job.fromJson(Map<String, dynamic> json) => Job(
    workflow: json['workflow'] as String,
    code: json['code'] as String,
    customer: json['customer'] as String?,
    tel: json['tel'] as String?,
    address: json['address'] as String?,
    product: json['product'] as String?,
    detail: json['detail'] as String?,
    onsite: json['onsite'] as bool? ?? false,
    stage: (json['stage'] as num).toInt(),
    stageLabel: json['stage_label'] as String? ?? '-',
    elapsedSeconds: (json['elapsed_seconds'] as num?)?.toInt() ?? 0,
    appointment: json['appointment'] as String?,
    action: json['action'] as String? ?? 'wait_other',
    checkedIn: json['checked_in'] as bool? ?? false,
  );

  int get days => elapsedSeconds ~/ 86400;
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
  final String docNo;
  final String jobCode;
  final String docDate;
  final int lines;
  PickupDoc({
    required this.docNo,
    required this.jobCode,
    required this.docDate,
    required this.lines,
  });

  factory PickupDoc.fromJson(Map<String, dynamic> json) => PickupDoc(
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
