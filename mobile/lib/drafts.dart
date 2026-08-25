import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import 'package:path_provider/path_provider.dart';

/// ຮ່າງທີ່ຍັງບໍ່ທັນສົ່ງຂອງແຕ່ລະໜ້າຈໍ (ຮູບຖ່າຍ ແລະ ຄ່າທີ່ພິມແລ້ວ).
///
/// ເປັນຫຍັງຕ້ອງມີ: ຮູບທີ່ຖ່າຍແລ້ວຢູ່ໃນ `State` ຂອງໜ້າຈໍເທົ່ານັ້ນ ⇒ ຊ່າງກົດກັບຄືນ
/// ແລ້ວເຂົ້າມາໃໝ່ (ຫຼື Android ຂ້າ process ຖິ້ມຕອນກ້ອງເປີດຢູ່ໜ້າ — ເກີດປະຈຳຢູ່ເຄື່ອງ
/// RAM ນ້ອຍ) ⇒ ຮູບຫາຍໝົດ ຕ້ອງຖ່າຍໃໝ່ ທັງທີ່ບາງເທື່ອເຄື່ອງລູກຄ້າຖືກປະກອບຄືນແລ້ວ.
///
/// ⇒ ເກັບໄວ້ **ທັງໃນ RAM ແລະ ໃນໄຟລ໌** (JSON ຢູ່ບ່ອນເກັບຂອງແອັບ): ຄືນໃຫ້ອັດຕະໂນມັດ
/// ຕອນເປີດໜ້າຈໍນັ້ນຄືນ ແລະ ລຶບຖິ້ມທັນທີເມື່ອສົ່ງສຳເລັດ.
///
/// ບໍ່ແມ່ນ cache ຂໍ້ມູນ server — ເກັບແຕ່ສິ່ງທີ່ຊ່າງພິມ/ຖ່າຍເອງ ແລະ **ຍັງບໍ່ໄດ້ສົ່ງ**.
class Drafts {
  Drafts._();

  /// ຮ່າງທີ່ຄ້າງເກີນນີ້ = ງານເກົ່າ/ຖືກຍົກເລີກໄປແລ້ວ ⇒ ລຶບຖິ້ມຕອນເປີດແອັບ
  /// (ຮູບ base64 ກິນເນື້ອທີ່ — ບໍ່ໃຫ້ໄຟລ໌ໃຫຍ່ຂຶ້ນເລື້ອຍໆໂດຍບໍ່ມີໃຜລຶບ).
  static const _keepFor = Duration(days: 7);

  static final Map<String, Map<String, dynamic>> _memory = {};
  static File? _file;

  /// ກຳລັງຂຽນຢູ່ບໍ + ມີການປ່ຽນລໍຢູ່ບໍ — ຖ່າຍ 6 ຮູບຕິດກັນບໍ່ໃຫ້ຍິງ write ຊ້ອນກັນ
  static bool _writing = false;
  static bool _dirty = false;

  /// ໂຫຼດຮ່າງຈາກໄຟລ໌ — ເອີ້ນຄັ້ງດຽວຕອນເປີດແອັບ (ກ່ອນ `runApp`) ໃຫ້ໜ້າຈໍອ່ານໄດ້ທັນທີ.
  /// ລົ້ມກໍ່ບໍ່ເປັນຫຍັງ — ພຽງແຕ່ບໍ່ມີຮ່າງເກົ່າ (ດີກວ່າເປີດແອັບບໍ່ຂຶ້ນ).
  /// [folder] ໃສ່ໄດ້ໃນເທສເທົ່ານັ້ນ (ແອັບຈິງໃຫ້ລະບົບເລືອກບ່ອນເກັບເອງ)
  static Future<void> load({Directory? folder}) async {
    try {
      final dir = folder ?? await getApplicationSupportDirectory();
      final file = File('${dir.path}/drafts.json');
      _file = file;
      if (!await file.exists()) return;
      final raw = jsonDecode(await file.readAsString());
      if (raw is! Map) return;
      final cutoff = DateTime.now().subtract(_keepFor).millisecondsSinceEpoch;
      var pruned = false;
      raw.forEach((key, value) {
        if (key is! String || value is! Map) return;
        final saved = Map<String, dynamic>.from(value);
        final at = saved['at'];
        if (at is int && at < cutoff) {
          pruned = true;
          return;
        }
        _memory[key] = saved;
      });
      if (pruned) _flush();
    } catch (_) {
      // ອ່ານບໍ່ໄດ້/ໄຟລ໌ເພ ⇒ ເລີ່ມຈາກຫວ່າງ
    }
  }

  /// ລືມທຸກຢ່າງທີ່ຢູ່ໃນ RAM (ບໍ່ແຕະໄຟລ໌) — ໃຊ້ໃນເທສເພື່ອຈຳລອງ "ເປີດແອັບໃໝ່"
  @visibleForTesting
  static void forgetInMemory() => _memory.clear();

  /// ຮ່າງຂອງໜ້າຈໍນີ້ (ຫວ່າງ = ຍັງບໍ່ມີ) — ອ່ານແບບ sync ໄດ້ເລີຍໃນ `initState`
  static Map<String, dynamic> read(String key) =>
      Map<String, dynamic>.from(_memory[key] ?? const {});

  /// ຮູບທີ່ຖ່າຍຄ້າງໄວ້ຂອງໜ້າຈໍນີ້ (data-URI base64)
  static List<String> photos(String key) {
    final saved = _memory[key]?['photos'];
    return saved is List ? saved.whereType<String>().toList() : const [];
  }

  /// ບັນທຶກຮ່າງ — ຂຽນລົງໄຟລ໌ເປັນເບື້ອງຫຼັງ (ບໍ່ໃຫ້ຈໍຄ້າງຕອນຖ່າຍຮູບ)
  static void write(String key, Map<String, dynamic> data) {
    final empty = data.values.every(
      (value) =>
          value == null ||
          (value is String && value.isEmpty) ||
          (value is Iterable && value.isEmpty) ||
          (value is Map && value.isEmpty),
    );
    if (empty) {
      clear(key);
      return;
    }
    _memory[key] = {...data, 'at': DateTime.now().millisecondsSinceEpoch};
    _flush();
  }

  /// ສົ່ງສຳເລັດແລ້ວ (ຫຼື ຊ່າງລຶບຮູບອອກໝົດ) ⇒ ຖິ້ມຮ່າງ
  static void clear(String key) {
    if (_memory.remove(key) == null) return;
    _flush();
  }

  /// ລໍໃຫ້ການຂຽນທີ່ຄ້າງຢູ່ລົງດິສຈົບ — ໃຊ້ໃນເທສ (ແອັບຈິງບໍ່ຕ້ອງລໍ)
  @visibleForTesting
  static Future<void> flushForTest() async {
    _flush();
    while (_writing || _dirty) {
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
  }

  static void _flush() {
    _dirty = true;
    if (_writing) return;
    _writing = true;
    Future(() async {
      try {
        while (_dirty) {
          _dirty = false;
          final file = _file;
          if (file == null) return;
          await file.writeAsString(jsonEncode(_memory));
        }
      } catch (_) {
        // ຂຽນບໍ່ໄດ້ (ບ່ອນເກັບເຕັມ) ⇒ ຮ່າງຍັງຢູ່ໃນ RAM ຢູ່ດີ
      } finally {
        _writing = false;
      }
    });
  }
}
