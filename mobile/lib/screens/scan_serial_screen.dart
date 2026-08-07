import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../main.dart';

/// **ສະແກນ ISN / SN ດ້ວຍກ້ອງ** — ງານຕິດຕັ້ງ (07-08-2026).
///
/// ຊ່າງບໍ່ຕ້ອງພິມເລກຍາວ 20 ກວ່າຕົວ (ພິມຜິດ 1 ຕົວ = ທຽບບໍ່ຕົງ ແລ້ວເສຍເວລາຢູ່ໜ້າງານ).
/// ຍິງແລ້ວ pop ຄ່າດິບກັບໄປໃຫ້ໜ້າທີ່ເອີ້ນ ⇒ ໜ້ານັ້ນສົ່ງໃຫ້ server ທຽບກັບໃບງານ
/// (lib/install-scan — ຮັບໄດ້ທັງ ISN ແລະ SN ໂຮງງານ).
///
/// ບໍ່ມີຊ່ອງພິມ **ໂດຍເຈດຕະນາ**: ຄຳສັ່ງແມ່ນ "ບໍ່ຕ້ອງປ້ອນຂໍ້ມູນ" ⇒ ຫຼັກຖານຕ້ອງມາຈາກ
/// ປ້າຍຈິງເທົ່ານັ້ນ ບໍ່ແມ່ນຄວາມຈຳ.
class ScanSerialScreen extends StatefulWidget {
  const ScanSerialScreen({super.key, required this.title, this.hint});

  final String title;

  /// ບອກວ່າໃບງານລໍໜ່ວຍໃດ (ໃຫ້ຊ່າງທຽບດ້ວຍຕາໄດ້ກ່ອນຍິງ)
  final String? hint;

  @override
  State<ScanSerialScreen> createState() => _ScanSerialScreenState();
}

class _ScanSerialScreenState extends State<ScanSerialScreen> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    // ປ້າຍເຄື່ອງໃຊ້ໄຟຟ້າສ່ວນຫຼາຍເປັນບາໂຄດເສັ້ນ — ເປີດ QR ໄວ້ນຳ ເພາະບາງຍີ່ຫໍ້ໃຊ້
    formats: const [BarcodeFormat.all],
  );
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _found(BarcodeCapture capture) {
    if (_done) return;
    final value = capture.barcodes
        .map((b) => b.rawValue?.trim() ?? '')
        .firstWhere((v) => v.isNotEmpty, orElse: () => '');
    if (value.isEmpty) return;
    _done = true;
    Navigator.pop(context, value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            tooltip: 'ໄຟ',
            onPressed: () => _controller.toggleTorch(),
            icon: const Icon(Icons.flashlight_on_outlined),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: MobileScanner(controller: _controller, onDetect: _found)),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ຈໍ່ກ້ອງໃສ່ປ້າຍ ISN ຫຼື SN ຂອງເຄື່ອງ',
                  style: TextStyle(fontWeight: FontWeight.w700, color: ink),
                ),
                if (widget.hint != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'ໃບງານນີ້ຕ້ອງເປັນ: ${widget.hint}',
                    style: const TextStyle(color: muted, fontSize: 12.5),
                  ),
                ],
                const SizedBox(height: 4),
                const Text(
                  'ລະບົບຈະທຽບກັບໃບງານໃຫ້ເອງ — ບໍ່ຕ້ອງພິມ',
                  style: TextStyle(color: muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
