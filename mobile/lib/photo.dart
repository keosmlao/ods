import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
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
  ///
  /// [stamp] = ຂໍ້ຄວາມລາຍນ້ຳ (ເລກໃບ) — ວັນທີ+ເວລາຖືກຕໍ່ໃຫ້ເອງ.
  static Future<String?> capture({
    ImageSource source = ImageSource.camera,
    String? stamp,
  }) async {
    final shot = await _picker.pickImage(
      source: source,
      // ຖ່າຍໃຫຍ່ໄວ້ກ່ອນ — ຕົວບີບຂ້າງລຸ່ມເປັນຄົນຕັດສິນຂະໜາດສຸດທ້າຍ
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (shot == null) return null;
    var bytes = await shot.readAsBytes();
    if (stamp != null) bytes = await _stamp(bytes, stamp);
    return encode(bytes);
  }

  /// **ຂຽນລາຍນ້ຳ ວັນທີ · ເວລາ · ເລກໃບ ໃສ່ຮູບ**.
  ///
  /// ເປັນຫຍັງ: ຮູບ check-in ແລະ ຮູບຜົນງານເປັນ JPEG ເປົ່າ — ພິສູດບໍ່ໄດ້ວ່າຖ່າຍມື້ໃດ
  /// ຂອງໃບໃດ. ຕອນລູກຄ້າຄ້ານ ("ຊ່າງບໍ່ເຄີຍມາ" · "ຮູບນີ້ຂອງໃບອື່ນ") ຫຼັກຖານທີ່ບໍ່ມີ
  /// ວັນທີໃນຕົວຮູບ ໃຊ້ຢືນຢັນຍາກ. ຂຽນລົງໃນຮູບເລີຍ ⇒ ຕັດອອກບໍ່ໄດ້ໂດຍບໍ່ເຫັນຮ່ອງຮອຍ.
  ///
  /// ລົ້ມ = ຄືນຮູບເດີມ (ຢ່າໃຫ້ຊ່າງຖ່າຍຮູບບໍ່ໄດ້ ເພາະລາຍນ້ຳ).
  static Future<Uint8List> _stamp(Uint8List bytes, String label) async {
    try {
      final codec = await ui.instantiateImageCodec(bytes);
      final image = (await codec.getNextFrame()).image;
      final width = image.width.toDouble();
      final height = image.height.toDouble();

      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      canvas.drawImage(image, Offset.zero, Paint());

      final now = DateTime.now();
      String two(int n) => n.toString().padLeft(2, '0');
      final text =
          '${two(now.day)}-${two(now.month)}-${now.year}  ${two(now.hour)}:${two(now.minute)}'
          '   ·   $label';

      // ຂະໜາດຕົວອັກສອນອີງຄວາມກວ້າງຮູບ ⇒ ອ່ານອອກທັງຮູບໃຫຍ່ ແລະ ຮູບນ້ອຍ
      final fontSize = (width * 0.032).clamp(14.0, 46.0);
      final painter = TextPainter(
        text: TextSpan(
          text: text,
          style: TextStyle(
            color: const Color(0xFFFFFFFF),
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            shadows: const [Shadow(color: Color(0xCC000000), blurRadius: 4)],
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: width * 0.94);

      final barHeight = painter.height + fontSize * 0.9;
      canvas.drawRect(
        Rect.fromLTWH(0, height - barHeight, width, barHeight),
        Paint()..color = const Color(0x99000000),
      );
      painter.paint(
        canvas,
        Offset(width * 0.03, height - barHeight + fontSize * 0.45),
      );

      final stamped = await recorder.endRecording().toImage(image.width, image.height);
      final data = await stamped.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      stamped.dispose();
      return data?.buffer.asUint8List() ?? bytes;
    } catch (error) {
      debugPrint('ຂຽນລາຍນ້ຳໃສ່ຮູບບໍ່ໄດ້: $error');
      return bytes;
    }
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
