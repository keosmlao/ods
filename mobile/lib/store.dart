import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// ບ່ອນເກັບ JSON ໃນເຄື່ອງ — ໃຊ້ຮ່ວມກັນລະຫວ່າງ ຮ່າງ · ຄິວ offline · cache ວຽກ.
///
/// ເປັນຫຍັງບໍ່ໃຊ້ secure storage: ຂໍ້ມູນເຫຼົ່ານີ້ **ໃຫຍ່** (ຮູບ base64 ໃບລະ ~200KB)
/// ແລະ ບໍ່ແມ່ນຄວາມລັບລະດັບ token. secure storage ຂອງ Android ເປັນ SharedPreferences
/// ທີ່ເຂົ້າລະຫັດ ⇒ ຂຽນຂໍ້ມູນໃຫຍ່ຊ້ຳໆ ຊ້າ ແລະ ມີເພດານ.
///
/// ຫຼັກການ: ອ່ານຄັ້ງດຽວຕອນເປີດແອັບ (`load`) ⇒ ຫຼັງຈາກນັ້ນອ່ານຈາກ RAM ໄດ້ແບບ sync
/// (ໜ້າຈໍໃຊ້ໃນ `initState` ໄດ້ ບໍ່ຕ້ອງລໍ) · ຂຽນລົງດິສເປັນເບື້ອງຫຼັງ.
class JsonFile {
  JsonFile(this.name);

  /// ຊື່ໄຟລ໌ໃນໂຟນເດີຂອງແອັບ (ເຊັ່ນ `drafts.json`)
  final String name;

  Map<String, dynamic> data = <String, dynamic>{};
  File? _file;
  bool _writing = false;
  bool _dirty = false;

  /// ອ່ານຈາກດິສ — ລົ້ມ/ໄຟລ໌ເພ ⇒ ເລີ່ມຈາກຫວ່າງ (ຢ່າໃຫ້ແອັບເປີດບໍ່ຂຶ້ນ)
  Future<void> load() async {
    try {
      final folder = await getApplicationSupportDirectory();
      final file = File('${folder.path}/$name');
      _file = file;
      if (!await file.exists()) return;
      final raw = jsonDecode(await file.readAsString());
      if (raw is Map) data = Map<String, dynamic>.from(raw);
    } catch (error) {
      debugPrint('ອ່ານ $name ບໍ່ໄດ້ — ເລີ່ມຈາກຫວ່າງ: $error');
      data = <String, dynamic>{};
    }
  }

  /// ຂຽນລົງດິສ — ຮວມການຂຽນທີ່ຕິດກັນເປັນຮອບດຽວ (ຖ່າຍ 6 ຮູບຕິດກັນ = ບໍ່ຂຽນ 6 ເທື່ອ)
  void save() {
    _dirty = true;
    if (_writing) return;
    _writing = true;
    Future(() async {
      try {
        while (_dirty) {
          _dirty = false;
          final file = _file;
          if (file == null) return;
          await file.writeAsString(jsonEncode(data));
        }
      } catch (error) {
        // ຂຽນບໍ່ໄດ້ (ບ່ອນເກັບເຕັມ) ⇒ ຂໍ້ມູນຍັງຢູ່ໃນ RAM ຢູ່ດີ
        debugPrint('ຂຽນ $name ບໍ່ໄດ້: $error');
      } finally {
        _writing = false;
      }
    });
  }

  /// ຂະໜາດປະມານຂອງເນື້ອຫາ (ໄບຕ໌) — ໃຊ້ຄຸມບໍ່ໃຫ້ຄິວໃຫຍ່ເກີນ
  int get approximateBytes {
    try {
      return jsonEncode(data).length;
    } catch (_) {
      return 0;
    }
  }
}
