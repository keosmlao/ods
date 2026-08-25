import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// **ພິມດ້ວຍສຽງ** — ໃຊ້ໃນຊ່ອງທີ່ຕ້ອງພິມຫຼາຍ ("ອາການທີ່ພົບ" · ບັນທຶກຜົນງານ).
///
/// ── ເປັນຫຍັງ ──
/// ຊ່າງພິມພາສາລາວຢູ່ມືຖືຊ້າ ⇒ ຂຽນສັ້ນທີ່ສຸດເທົ່າທີ່ຈະໄດ້ ("ເສຍ", "ບໍ່ຕິດ")
/// ⇒ ຄົນທີ່ອ່ານຕໍ່ (ຫົວໜ້າ · ຊ່າງຄົນຕໍ່ໄປ · CS ຕອບລູກຄ້າ) ບໍ່ໄດ້ຄວາມຫຍັງ.
/// ເວົ້າ 10 ວິນາທີ ໄດ້ຂໍ້ຄວາມຍາວກວ່າພິມ 2 ນາທີ.
///
/// ⚠️ ບໍ່ແມ່ນທຸກເຄື່ອງມີ engine ຮັບຮູ້ສຽງ ແລະ ບໍ່ແມ່ນທຸກ engine ຮັບພາສາລາວ —
/// ໃຊ້ບໍ່ໄດ້ = **ເຊື່ອງປຸ່ມ** ບໍ່ແມ່ນຂຶ້ນ error (ຊ່ອງພິມມືຍັງໃຊ້ໄດ້ຢູ່ແລ້ວ).
class Voice {
  static final _speech = SpeechToText();
  static bool _ready = false;
  static bool _checked = false;

  /// ເຄື່ອງນີ້ຮັບຮູ້ສຽງໄດ້ບໍ — ກວດເທື່ອດຽວ ແລ້ວຈື່
  static Future<bool> available() async {
    if (_checked) return _ready;
    _checked = true;
    try {
      _ready = await _speech.initialize(
        onError: (error) => debugPrint('ຮັບຮູ້ສຽງລົ້ມ: ${error.errorMsg}'),
      );
    } catch (error) {
      debugPrint('ເປີດຕົວຮັບຮູ້ສຽງບໍ່ໄດ້: $error');
      _ready = false;
    }
    return _ready;
  }

  static bool get listening => _speech.isListening;

  /// ເລີ່ມຟັງ — ສົ່ງຂໍ້ຄວາມກັບທຸກຄັ້ງທີ່ມີການປ່ຽນ (ໃຫ້ຈໍສະແດງສົດ)
  static Future<void> listen({
    required void Function(String text, bool finished) onText,
  }) async {
    if (!await available()) return;
    await _speech.listen(
      listenOptions: SpeechListenOptions(
        // ລາວກ່ອນ — ບໍ່ຮອງຮັບ ⇒ engine ຕົກໄປໃຊ້ພາສາຕັ້ງຕົ້ນຂອງເຄື່ອງເອງ
        localeId: 'lo_LA',
        listenMode: ListenMode.dictation,
        partialResults: true,
        cancelOnError: true,
        // ຢຸດເອງເມື່ອງຽບ — ຊ່າງບໍ່ຕ້ອງກົດຢຸດ (ມືເປື້ອນ/ຖືເຄື່ອງມືຢູ່)
        pauseFor: const Duration(seconds: 3),
        listenFor: const Duration(seconds: 60),
      ),
      onResult: (result) => onText(result.recognizedWords, result.finalResult),
    );
  }

  static Future<void> stop() => _speech.stop();
}
