import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../main.dart';

/// ຄ່າທີ່ໄດ້ຈາກໜ້ານີ້ — ພ້ອມບອກວ່າມາຈາກ**ກ້ອງ**ຫຼື**ພິມເອງ**.
///
/// ຕ້ອງແຍກໃຫ້ຮູ້ ເພາະຫຼັກຖານສອງແບບນີ້ໜັກບໍ່ເທົ່າກັນ: ຍິງກ້ອງ = ຢູ່ຕໍ່ໜ້າເຄື່ອງຈິງ,
/// ພິມເອງ = ເຊື່ອຄົນພິມ ⇒ ບັນທຶກໄວ້ໃນ chatter ຄົນລະຄຳ ໃຫ້ກວດຍ້ອນຫຼັງໄດ້.
class SerialInput {
  const SerialInput(this.value, {this.manual = false});

  final String value;
  final bool manual;
}

/// **ອ່ານ ISN / SN ດ້ວຍກ້ອງ ຫຼື ພິມເອງ** — ງານຕິດຕັ້ງ (07-08-2026).
///
/// ຊ່າງບໍ່ຕ້ອງພິມເລກຍາວ 20 ກວ່າຕົວ (ພິມຜິດ 1 ຕົວ = ໃບງານໄດ້ເລກຜິດ ແລະ ບໍ່ມີໃຜຮູ້)
/// ⇒ **ກ້ອງເປັນທາງຫຼັກ**. ແຕ່ບັງຄັບຍິງຢ່າງດຽວບໍ່ໄດ້: ປ້າຍຈືດ · ຕິດຢູ່ບ່ອນຈໍ້ກ້ອງບໍ່ເຖິງ
/// (ໜ່ວຍນອກຢູ່ສູງ) · ບາໂຄດຂາດ ⇒ ຊ່າງຈະຄາຢູ່ໜ້າງານ ປິດງານບໍ່ໄດ້ (ຄຳສັ່ງ 07-08-2026)
/// ⇒ ມີຊ່ອງ **ພິມເລກເອງ** ໄວ້ນຳ.
///
/// ບໍ່ວ່າທາງໃດ ຄ່າຖືກສົ່ງໃຫ້ server **ບັນທຶກໃສ່ໃບງານຕົງໆ** (lib/install-scan) —
/// ບໍ່ໄປທຽບກັບໃບງານ/ບິນ/ERP ອີກແລ້ວ (08-08-2026): ເລກຢູ່ປ້າຍເຄື່ອງທີ່ຕິດຈິງ =
/// ຄວາມຈິງ ⇒ ລົງເລີຍ ແລ້ວເກັບ**ປະຫວັດການອັບເດດ** (ຄ່າເກົ່າ → ຄ່າໃໝ່ · ໃຜ · ເມື່ອໃດ ·
/// ຍິງ ຫຼື ພິມ) ໄວ້ໃຫ້ຜູ້ຈັດການຕາມກວດຍ້ອນຫຼັງແທນ. ⇒ ຍິງແລ້ວໄດ້ຄຳຕອບທັນທີ.
class ScanSerialScreen extends StatefulWidget {
  const ScanSerialScreen({super.key, required this.title, this.hint});

  final String title;

  /// ເລກທີ່ເກັບໄວ້ແລ້ວ (ໃຫ້ຊ່າງຮູ້ວ່າຍັງຂາດໜ່ວຍໃດ)
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
  final _typed = TextEditingController();
  bool _done = false;

  /// ຊ່ອງພິມເປີດຢູ່ບໍ — ເລີ່ມຕົ້ນປິດ ເພື່ອໃຫ້ກ້ອງຍັງເປັນທາງທຳອິດທີ່ຕາເຫັນ
  bool _manual = false;

  @override
  void dispose() {
    _controller.dispose();
    _typed.dispose();
    super.dispose();
  }

  void _found(BarcodeCapture capture) {
    if (_done) return;
    final value = capture.barcodes
        .map((b) => b.rawValue?.trim() ?? '')
        .firstWhere((v) => v.isNotEmpty, orElse: () => '');
    if (value.isEmpty) return;
    _done = true;
    Navigator.pop(context, SerialInput(value));
  }

  void _submitTyped() {
    final value = _typed.text.trim();
    if (value.isEmpty || _done) return;
    _done = true;
    Navigator.pop(context, SerialInput(value, manual: true));
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
            color: surface,
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
                    'ເກັບແລ້ວ: ${widget.hint}',
                    style: const TextStyle(color: muted, fontSize: 12.5),
                  ),
                ],
                const SizedBox(height: 4),
                const Text(
                  'ບໍ່ຈຳເປັນຕ້ອງຕົງກັບໃບງານ — ເອົາຕາມເຄື່ອງທີ່ຕິດຈິງ',
                  style: TextStyle(color: muted, fontSize: 12),
                ),

                // ── ທາງສຳຮອງ: ປ້າຍຍິງບໍ່ອອກ ⇒ ພິມເລກເອງໄດ້ (ບັນທຶກຄືກັນ ພຽງແຕ່ໝາຍໄວ້) ──
                if (!_manual)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => setState(() => _manual = true),
                      icon: const Icon(Icons.keyboard_alt_outlined, size: 18),
                      label: const Text('ຍິງບໍ່ອອກ? ພິມເລກເອງ'),
                    ),
                  )
                else ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _typed,
                    autofocus: true,
                    textCapitalization: TextCapitalization.characters,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submitTyped(),
                    decoration: const InputDecoration(
                      labelText: 'ພິມ ISN ຫຼື SN ຈາກປ້າຍ',
                      hintText: 'ຕົວຢ່າງ: ISN0012345 ຫຼື SN ໂຮງງານ',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _submitTyped,
                          icon: const Icon(Icons.check_rounded, size: 18),
                          label: const Text('ໃຊ້ເລກນີ້'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: () => setState(() => _manual = false),
                        child: const Text('ກັບໄປຍິງ'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'ພິມເອງຈະຖືກໝາຍໄວ້ໃນປະຫວັດໃບງານວ່າ “ປ້ອນເລກເອງ”',
                    style: TextStyle(color: muted, fontSize: 11.5),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
