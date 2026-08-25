import 'package:flutter/foundation.dart';

import 'store.dart';

/// **ຄິວຄຳສັ່ງທີ່ຍັງສົ່ງບໍ່ໄດ້** (ບໍ່ມີສັນຍານຢູ່ໜ້າງານ) — ລວມຄຳສັ່ງທີ່**ມີຮູບ**.
///
/// ── ເປັນຫຍັງຕ້ອງຮັບຮູບນຳ ──
/// ຄິວເກົ່າເກັບຢູ່ secure storage ຈຶ່ງ**ຂ້າມ**ຄຳສັ່ງທີ່ມີຮູບ (ໃຫຍ່ເກີນ) ⇒ ສອງຄຳສັ່ງ
/// ທີ່ສຳຄັນທີ່ສຸດຂອງຊ່າງ (check-in ແລະ ຈົບງານ — ທັງສອງບັງຄັບຮູບ) ໃຊ້ບໍ່ໄດ້ເລີຍ
/// ຕອນບໍ່ມີເນັດ. ຊ່າງຕ້ອງຢືນລໍສັນຍານ ຫຼື ຈື່ໄວ້ມາກົດຄືນເອງ (ແລ້ວກໍ່ລືມ).
/// ດຽວນີ້ຄິວຢູ່ໃນໄຟລ໌ ⇒ ຮູບໄປນຳໄດ້.
///
/// ── ຂອບເຂດ ──
/// ຈຳກັດ 25 ຄຳສັ່ງ / 40MB — ເກີນນັ້ນຄືອາການຜິດປົກກະຕິ (ບໍ່ມີເນັດຫຼາຍມື້) ຈຶ່ງບອກ
/// ຊ່າງໃຫ້ຊັດວ່າສົ່ງບໍ່ໄດ້ ດີກວ່າກືນໄວ້ຈົນເຄື່ອງເຕັມ.
abstract final class Pending {
  static final _file = JsonFile('pending_actions.json');

  static const maxActions = 25;
  static const maxBytes = 40 * 1024 * 1024;

  static Future<void> load() => _file.load();

  static List<Map<String, dynamic>> all() {
    final rows = _file.data['actions'];
    return rows is List
        ? rows.whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList()
        : <Map<String, dynamic>>[];
  }

  /// ຈຳນວນທີ່ຍັງລໍສົ່ງ — ໜ້າຈໍເອົາໄປສະແດງໃຫ້ຊ່າງເຫັນວ່າຍັງມີເລື່ອງຄ້າງ
  static int get count => all().length;

  /// ໃສ່ຄິວ — `false` = ເຕັມແລ້ວ (ຜູ້ເອີ້ນຕ້ອງບອກຊ່າງວ່າສົ່ງບໍ່ໄດ້ຈິງ)
  static bool add(String workflow, String code, Map<String, dynamic> body) {
    final rows = all();
    if (rows.length >= maxActions || _file.approximateBytes > maxBytes) {
      debugPrint('ຄິວ offline ເຕັມ (${rows.length} ລາຍການ)');
      return false;
    }
    rows.add({'workflow': workflow, 'code': code, 'body': body});
    _write(rows);
    return true;
  }

  static void replace(List<Map<String, dynamic>> rows) => _write(rows);

  static void clear() => _write(const []);

  static void _write(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) {
      _file.data.remove('actions');
    } else {
      _file.data['actions'] = rows;
    }
    _file.save();
  }
}

/// **ລາຍການວຽກທີ່ເກັບໄວ້ໃນເຄື່ອງ** — ບໍ່ມີສັນຍານກໍ່ຍັງເປີດເບິ່ງໄດ້.
///
/// ຊ່າງຂັບໄປຮອດບ້ານລູກຄ້າແລ້ວເປີດແອັບເບິ່ງ **ທີ່ຢູ່ · ເບີໂທ · ອາການ** — ຖ້າບ່ອນນັ້ນ
/// ບໍ່ມີສັນຍານ ແອັບເຄີຍຂຶ້ນແຕ່ "ເຊື່ອມຕໍ່ບໍ່ໄດ້" ⇒ ຂໍ້ມູນທີ່ຕ້ອງໃຊ້ຢູ່ໃນມືແທ້ໆ ແຕ່ເບິ່ງບໍ່ໄດ້.
abstract final class JobCache {
  static final _file = JsonFile('jobs_cache.json');

  static Future<void> load() => _file.load();

  /// ຂໍ້ມູນດິບຂອງລາຍການວຽກ (ຮູບແບບດຽວກັບທີ່ server ສົ່ງມາ)
  static List<dynamic> get rows {
    final saved = _file.data['jobs'];
    return saved is List ? saved : const [];
  }

  /// ເກັບໄວ້ຕອນໃດ — ໜ້າຈໍເອົາໄປບອກວ່າ "ຂໍ້ມູນເມື່ອ 10:20" ⇒ ຊ່າງຮູ້ວ່າອາດເກົ່າ
  static DateTime? get savedAt {
    final at = _file.data['at'];
    return at is int ? DateTime.fromMillisecondsSinceEpoch(at) : null;
  }

  static void save(List<dynamic> jobs) {
    _file.data['jobs'] = jobs;
    _file.data['at'] = DateTime.now().millisecondsSinceEpoch;
    _file.save();
  }

  static void clear() {
    _file.data.clear();
    _file.save();
  }
}
