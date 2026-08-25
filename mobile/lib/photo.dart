import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_picker/image_picker.dart';

/// **ຖ່າຍ/ເລືອກຮູບ ແລ້ວບີບໃຫ້ພໍດີກັບເພດານຂອງ server** — ບ່ອນດຽວຂອງທັງແອັບ.
///
/// ── ບັນຫາທີ່ແກ້ (26-08-2026) ──
/// server ປະຕິເສດຮູບທີ່ base64 ຍາວເກີນ `MAX_PHOTO_CHARS` = **400,000 ຕົວ**
/// (≈300KB) ດ້ວຍ 413 "ຮູບໃຫຍ່ເກີນໄປ — ກະລຸນາຖ່າຍໃໝ່". ຕັ້ງແຕ່ກ່ອນແອັບຖ່າຍທີ່
/// `imageQuality: 50, maxWidth: 1280` ຊຶ່ງ **ບາງເຄື່ອງ**ໄດ້ໄຟລ໌ 350–600KB
/// (ກ້ອງດີ · ພາບລາຍລະອຽດຫຼາຍ) ⇒ ຖ່າຍແລ້ວເດັ້ງອອກ ໂດຍຊ່າງບໍ່ຮູ້ວ່າຍ້ອນຫຍັງ.
///
/// ດຽວນີ້: ຖ່າຍດ້ວຍຄຸນນະພາບດີກວ່າເກົ່າ ແລ້ວ **ບີບຊ້ຳຈົນກວ່າຈະລົງພາຍໃຕ້ເພດານ**
/// ⇒ ຮູບຊັດຂຶ້ນຕອນມັນນ້ອຍຢູ່ແລ້ວ ແລະ **ບໍ່ມີທາງເກີນ** ຕອນມັນໃຫຍ່.
abstract final class Photo {
  /// ເພດານທີ່ຕັ້ງໄວ້ຕ່ຳກວ່າ server ຈິງ (400,000) — ເຜື່ອສ່ວນຫົວຂອງ data-URI
  /// ແລະ ເຜື່ອວ່າມື້ໜ້າ server ຫຼຸດເພດານລົງ.
  static const maxChars = 300000;

  /// ຄຸນນະພາບທີ່ລອງເທື່ອລະຂັ້ນ — ຢຸດທັນທີທີ່ພໍດີ (ສ່ວນຫຼາຍຈົບຕັ້ງແຕ່ຂັ້ນທຳອິດ)
  static const _steps = [
    (width: 1280, quality: 60),
    (width: 1280, quality: 45),
    (width: 1024, quality: 40),
    (width: 800, quality: 35),
    (width: 640, quality: 30),
  ];

  static final _picker = ImagePicker();

  /// ຖ່າຍຈາກກ້ອງ (ຫຼື ເລືອກຈາກຄັງ) ແລ້ວຄືນເປັນ data-URI ພ້ອມສົ່ງ.
  /// `null` = ຊ່າງກົດຍົກເລີກ. ໂຍນ [PhotoException] ເມື່ອບີບແລ້ວຍັງໃຫຍ່ເກີນ.
  static Future<String?> capture({ImageSource source = ImageSource.camera}) async {
    final shot = await _picker.pickImage(
      source: source,
      // ຖ່າຍໃຫຍ່ໄວ້ກ່ອນ — ຕົວບີບຂ້າງລຸ່ມເປັນຄົນຕັດສິນຂະໜາດສຸດທ້າຍ
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (shot == null) return null;
    return encode(await shot.readAsBytes());
  }

  /// **ກູ້ຮູບທີ່ຫາຍຕອນ Android ຂ້າແອັບ** ຂະນະກ້ອງເປີດຢູ່.
  ///
  /// ເຄື່ອງ RAM ນ້ອຍມັກຂ້າແອັບຖິ້ມຕອນເປີດກ້ອງ ⇒ ຖ່າຍແລ້ວກັບມາ **ບໍ່ມີຮູບ** ແລະ
  /// ບໍ່ມີໃຜຮູ້ວ່າມັນເຄີຍຖືກຖ່າຍ. Android ເກັບຜົນນັ້ນໄວ້ໃຫ້ — ດຶງຄືນໄດ້ດ້ວຍ
  /// `retrieveLostData()`. ບໍ່ມີ/ບໍ່ແມ່ນ Android ⇒ ຄືນ null ງຽບໆ.
  static Future<String?> recoverLost() async {
    try {
      final lost = await _picker.retrieveLostData();
      final file = lost.file;
      if (lost.isEmpty || file == null) return null;
      return encode(await file.readAsBytes());
    } catch (error) {
      debugPrint('ກູ້ຮູບທີ່ຫາຍບໍ່ໄດ້: $error');
      return null;
    }
  }

  /// ບີບຈົນ base64 ລົງພາຍໃຕ້ເພດານ — ໃຊ້ໄດ້ກັບ bytes ຈາກທຸກແຫຼ່ງ
  static Future<String> encode(Uint8List bytes) async {
    var best = bytes;
    for (final step in _steps) {
      final encoded = base64Encode(best);
      if (encoded.length <= maxChars) return 'data:image/jpeg;base64,$encoded';
      try {
        best = await FlutterImageCompress.compressWithList(
          bytes,
          minWidth: step.width,
          minHeight: step.width, // ອັດຕາສ່ວນຄົງເດີມ — ຄ່ານີ້ເປັນພຽງເພດານ
          quality: step.quality,
        );
      } catch (error) {
        // ບີບບໍ່ໄດ້ (ຮູບແປກ/plugin ລົ້ມ) ⇒ ຢຸດລອງ ແລ້ວປ່ອຍໃຫ້ດ່ານລຸ່ມຕັດສິນ
        debugPrint('ບີບຮູບບໍ່ໄດ້: $error');
        break;
      }
    }
    final encoded = base64Encode(best);
    if (encoded.length > maxChars) {
      throw const PhotoException(
        'ຮູບໃຫຍ່ເກີນໄປ ເຖິງບີບແລ້ວ — ລອງຖ່າຍໃໝ່ໃຫ້ໃກ້ຂຶ້ນ ຫຼື ປິດໂໝດຄວາມລະອຽດສູງ',
      );
    }
    return 'data:image/jpeg;base64,$encoded';
  }
}

/// ຖ່າຍ/ບີບບໍ່ສຳເລັດ — [message] ເປັນພາສາລາວ ເອົາຂຶ້ນຈໍໄດ້ເລີຍ
class PhotoException implements Exception {
  const PhotoException(this.message);
  final String message;
  @override
  String toString() => message;
}
