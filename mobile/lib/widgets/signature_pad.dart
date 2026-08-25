import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../main.dart';

/// **ແຜ່ນເຊັນຊື່ຂອງລູກຄ້າ** — ຫຼັກຖານຕອນສົ່ງມອບງານ.
///
/// ── ເປັນຫຍັງຕ້ອງມີ ──
/// ຖານຂໍ້ມູນມີ `ods_qc_signature.signature` ແລະ **ເວັບມີແຜ່ນເຊັນຢູ່ແລ້ວ**
/// (app/(app)/qc/.../signature-pad.tsx) ແຕ່ແອັບສົ່ງມາແຕ່ *ຊື່* ⇒ QC ທີ່ຊ່າງ
/// ເຮັດຢູ່ໜ້າງານ (ສ່ວນຫຼາຍ) ບໍ່ມີລາຍເຊັນຈັກໃບ ທັງທີ່ນັ້ນຄືຫຼັກຖານທີ່ຕ້ອງໃຊ້
/// ຕອນລູກຄ້າຄ້ານພາຍຫຼັງ.
///
/// ບໍ່ໃຊ້ package ພາຍນອກ — ເສັ້ນເປັນ `Path` ທຳມະດາ ແລ້ວ export ເປັນ PNG.
class SignaturePad extends StatefulWidget {
  const SignaturePad({super.key, required this.onChanged, this.height = 170});

  /// ຄືນ data-URI ຂອງ PNG (ຫວ່າງ = ຍັງບໍ່ໄດ້ເຊັນ/ລ້າງແລ້ວ)
  final ValueChanged<String> onChanged;
  final double height;

  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class _SignaturePadState extends State<SignaturePad> {
  /// ແຕ່ລະເສັ້ນ = 1 ຄັ້ງທີ່ນິ້ວແຕະຈົນຍົກ
  final _strokes = <List<Offset>>[];
  Size _size = Size.zero;

  bool get _empty => _strokes.every((stroke) => stroke.length < 2);

  Future<void> _export() async {
    if (_empty || _size == Size.zero) {
      widget.onChanged('');
      return;
    }
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    // ພື້ນຂາວສະເໝີ — ລາຍເຊັນຖືກເອົາໄປສະແດງເທິງເຈ້ຍ/ໜ້າຂາວຢູ່ຝັ່ງເວັບ
    canvas.drawRect(Offset.zero & _size, Paint()..color = Colors.white);
    _paint(canvas, Colors.black);
    final picture = recorder.endRecording();
    final image = await picture.toImage(_size.width.round(), _size.height.round());
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    picture.dispose();
    if (data == null) return;
    widget.onChanged('data:image/png;base64,${base64Encode(data.buffer.asUint8List())}');
  }

  void _paint(Canvas canvas, Color color) {
    final pen = Paint()
      ..color = color
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    for (final stroke in _strokes) {
      if (stroke.length < 2) continue;
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (final point in stroke.skip(1)) {
        path.lineTo(point.dx, point.dy);
      }
      canvas.drawPath(path, pen);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          const Expanded(
            child: Text(
              'ລາຍເຊັນລູກຄ້າ',
              style: TextStyle(fontSize: 12.5, color: muted, fontWeight: FontWeight.w700),
            ),
          ),
          if (!_empty)
            TextButton.icon(
              onPressed: () {
                setState(_strokes.clear);
                widget.onChanged('');
              },
              icon: const Icon(Icons.refresh_rounded, size: 17),
              label: const Text('ເຊັນໃໝ່'),
            ),
        ],
      ),
      const SizedBox(height: 6),
      LayoutBuilder(
        builder: (context, constraints) {
          _size = Size(constraints.maxWidth, widget.height);
          return Container(
            height: widget.height,
            decoration: BoxDecoration(
              // ພື້ນຂາວ ຄືເຈ້ຍ — ຄົນຮູ້ທັນທີວ່າຕ້ອງເຊັນຢູ່ນີ້ (ບໍ່ຄືກ່ອງປ້ອນອື່ນ)
              color: Colors.white,
              borderRadius: BorderRadius.circular(kButtonRadius),
              border: Border.all(color: _empty ? lineStrong : teal, width: _empty ? 1 : 1.5),
            ),
            clipBehavior: Clip.antiAlias,
            child: GestureDetector(
              onPanStart: (event) => setState(() => _strokes.add([event.localPosition])),
              onPanUpdate: (event) => setState(() {
                if (_strokes.isNotEmpty) _strokes.last.add(event.localPosition);
              }),
              onPanEnd: (_) => _export(),
              child: CustomPaint(
                painter: _SignaturePainter(_strokes),
                size: Size.infinite,
                child: _empty
                    ? const Center(
                        child: Text(
                          'ໃຫ້ລູກຄ້າເຊັນຢູ່ນີ້',
                          style: TextStyle(color: Color(0xFF9AA8A4), fontSize: 13),
                        ),
                      )
                    : null,
              ),
            ),
          );
        },
      ),
    ],
  );
}

class _SignaturePainter extends CustomPainter {
  const _SignaturePainter(this.strokes);
  final List<List<Offset>> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    final pen = Paint()
      ..color = Colors.black
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    for (final stroke in strokes) {
      if (stroke.length < 2) continue;
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (final point in stroke.skip(1)) {
        path.lineTo(point.dx, point.dy);
      }
      canvas.drawPath(path, pen);
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter old) => true;
}
