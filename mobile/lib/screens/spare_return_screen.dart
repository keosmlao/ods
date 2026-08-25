import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// **ຂໍສົ່ງຄືນອາໄຫຼ່ທີ່ບໍ່ໄດ້ໃຊ້** (ໃບ SRI).
///
/// ── ເປັນຫຍັງຕ້ອງມີໃນແອັບ ──
/// ເມື່ອກ່ອນເຮັດໄດ້ **ແຕ່ຢູ່ເວັບ** ⇒ ຊ່າງທີ່ຢູ່ໜ້າງານເຮັດບໍ່ໄດ້ ແລ້ວອາໄຫຼ່ທີ່ເບີກໄປ
/// ແຕ່ບໍ່ໄດ້ໃຊ້ **ຄ້າງຢູ່ນຳຊ່າງໂດຍບໍ່ມີເອກະສານ** (ຂໍ້ມູນຈິງ: ງານທີ່ຍົກເລີກແລ້ວມີອາໄຫຼ່
/// 36 ແຖວ ທີ່ບໍ່ເຄີຍມີໃບສົ່ງຄືນຈັກໃບ ⇒ ອາໄຫຼ່ຫາຍຈາກສາງ).
///
/// ສາງຈະ **ຮັບຄືນຢູ່ ERP** ແລ້ວລະບົບດຶງກັບມາເອງ (ນະໂຍບາຍ 13-07-2026).
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
///   ① ກາດຕໍ່ລາຍການ (ຊື່ເດັ່ນ · ຈຳນວນເປັນຕົວເລກໃຫຍ່ · ໃບເບີກຕົ້ນທາງ) ແທນ CheckboxListTile
///   ② ມີ **ເລືອກທັງໝົດ** — ຊ່າງທີ່ຄືນທັງໃບບໍ່ຕ້ອງຕິກເທື່ອລະແຖວ
///   ③ ແຖບລຸ່ມບອກ **ຈຳນວນລາຍການ + ຍອດລວມ** ທີ່ຈະຄືນ ກ່ອນກົດ
///   ④ ໂຫຼດບໍ່ສຳເລັດ = ກາດ + ລອງໃໝ່ (ແຕ່ກ່ອນເປັນຂໍ້ຄວາມແດງລອຍໆ)
class SpareReturnScreen extends StatefulWidget {
  const SpareReturnScreen({
    super.key,
    required this.workflow,
    required this.code,
  });

  final String workflow;
  final String code;

  @override
  State<SpareReturnScreen> createState() => _SpareReturnScreenState();
}

class _SpareReturnScreenState extends State<SpareReturnScreen> {
  List<OutstandingSpare> rows = [];
  final Set<String> picked = {};
  final remark = TextEditingController();
  bool loading = true;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    remark.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await Api.outstandingSpares(widget.workflow, widget.code);
      if (!mounted) return;
      setState(() {
        rows = list;
        loading = false;
        error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e is ApiError ? e.message : '$e';
        loading = false;
      });
    }
  }

  Future<void> _submit() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final items = rows
          .where((row) => picked.contains(row.itemCode))
          .map((row) => {'item_code': row.itemCode, 'qty': row.qty})
          .toList();
      final message = await Api.returnSpares(
        widget.workflow,
        widget.code,
        items,
        remark.text.trim(),
      );
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(message), backgroundColor: ok),
      );
      navigator.pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e is ApiError ? e.message : '$e';
        saving = false;
      });
    }
  }

  static String _qty(double value) =>
      value == value.roundToDouble() ? value.toStringAsFixed(0) : value.toStringAsFixed(2);

  double get pickedQty => rows
      .where((row) => picked.contains(row.itemCode))
      .fold<double>(0, (sum, row) => sum + row.qty);

  @override
  Widget build(BuildContext context) => HeroScaffold(
    title: 'ສົ່ງຄືນອາໄຫຼ່',
    onBack: () => Navigator.pop(context),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : error != null && rows.isEmpty
        ? _errorCard()
        : rows.isEmpty
        ? _empty()
        : Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 18),
                  children: [
                    _header(),
                    const SizedBox(height: 12),
                    for (final row in rows) _item(row),
                    const SizedBox(height: 6),
                    const SectionLabel('ໝາຍເຫດ'),
                    TextField(
                      controller: remark,
                      maxLines: 3,
                      style: const TextStyle(fontSize: 13.5, color: ink),
                      decoration: InputDecoration(
                        hintText: 'ເຊັ່ນ: ບໍ່ໄດ້ໃຊ້, ຜິດລຸ້ນ, ເຫຼືອຈາກງານ',
                        hintStyle: const TextStyle(fontSize: 12.5, color: faint),
                        filled: true,
                        fillColor: onAccent,
                        contentPadding: const EdgeInsets.all(13),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: line),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: line),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: teal),
                        ),
                      ),
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF1F2),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFECDD3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline_rounded,
                              size: 18,
                              color: danger,
                            ),
                            const SizedBox(width: 9),
                            Expanded(
                              child: Text(
                                error!,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: danger,
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              _bottomBar(),
            ],
          ),
  );

  /// ຫົວ: ໃບງານ + ຍອດຄ້າງ + ປຸ່ມເລືອກທັງໝົດ
  Widget _header() {
    final all = rows.length == picked.length && rows.isNotEmpty;
    final totalQty = rows.fold<double>(0, (sum, row) => sum + row.qty);

    return Container(
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
      decoration: cardDecoration(),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.assignment_return_rounded,
                  size: 19,
                  color: Color(0xFFB45309),
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.code,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ຄ້າງຢູ່ນຳທ່ານ ${rows.length} ລາຍການ · ລວມ ${_qty(totalQty)}',
                      style: const TextStyle(fontSize: 11.5, color: muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => setState(() {
                if (all) {
                  picked.clear();
                } else {
                  picked
                    ..clear()
                    ..addAll(rows.map((row) => row.itemCode));
                }
              }),
              style: OutlinedButton.styleFrom(
                foregroundColor: teal,
                side: const BorderSide(color: line),
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
              ),
              icon: Icon(
                all ? Icons.remove_done_rounded : Icons.done_all_rounded,
                size: 18,
              ),
              label: Text(
                all ? 'ບໍ່ເລືອກທັງໝົດ' : 'ເລືອກທັງໝົດ',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _item(OutstandingSpare row) {
    final chosen = picked.contains(row.itemCode);
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => setState(() {
          if (chosen) {
            picked.remove(row.itemCode);
          } else {
            picked.add(row.itemCode);
          }
        }),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 12, 13, 12),
          decoration: cardDecoration(
            border: chosen ? teal : const Color(0xFFF1F5F9),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                margin: const EdgeInsets.only(top: 2),
                decoration: BoxDecoration(
                  color: chosen ? teal : surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: chosen ? teal : line, width: 1.5),
                ),
                child: chosen
                    ? const Icon(
                        Icons.check_rounded,
                        size: 16,
                        color: onAccent,
                      )
                    : null,
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.itemName.isEmpty ? row.itemCode : row.itemName,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: ink,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 6,
                      runSpacing: 5,
                      children: [
                        _tag(row.itemCode),
                        _tag('ໃບເບີກ ${row.docNo}'),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 9),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _qty(row.qty),
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: ink,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  Text(
                    row.unitCode ?? 'ຫົວໜ່ວຍ',
                    style: const TextStyle(fontSize: 11, color: faint),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _tag(String text) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: surfaceAlt,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w700,
        color: muted,
      ),
    ),
  );

  Widget _bottomBar() => Container(
    padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
    decoration: const BoxDecoration(
      color: surface,
      border: Border(top: BorderSide(color: line)),
    ),
    child: SafeArea(
      top: false,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  picked.isEmpty
                      ? 'ຍັງບໍ່ໄດ້ເລືອກລາຍການ'
                      : 'ເລືອກ ${picked.length} ລາຍການ',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: picked.isEmpty ? faint : ink,
                  ),
                ),
                if (picked.isNotEmpty)
                  Text(
                    'ລວມ ${_qty(pickedQty)} ຫົວໜ່ວຍ',
                    style: const TextStyle(fontSize: 11.5, color: muted),
                  ),
              ],
            ),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: teal,
              disabledBackgroundColor: surfaceAlt,
              // ລູກໂດຍກົງຂອງ Row ⇒ ກວ້າງເທົ່າເນື້ອໃນ (ເບິ່ງ main.dart ⚠️)
              minimumSize: const Size(0, kMinTouch),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            onPressed: picked.isEmpty || saving ? null : _submit,
            icon: saving
                ? const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: onAccent,
                    ),
                  )
                : const Icon(Icons.assignment_return_rounded, size: 18),
            label: Text(
              saving ? 'ກຳລັງບັນທຶກ...' : 'ຂໍສົ່ງຄືນ',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                color: picked.isEmpty && !saving ? faint : onAccent,
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _empty() => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: const BoxDecoration(
            color: surfaceAlt,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.inventory_2_outlined,
            size: 28,
            color: faint,
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'ບໍ່ມີອາໄຫຼ່ຄ້າງຢູ່ນຳທ່ານ',
          style: TextStyle(fontWeight: FontWeight.w800, color: ink),
        ),
        const SizedBox(height: 4),
        const Text(
          'ອາໄຫຼ່ທີ່ເບີກໄປ ຖືກໃຊ້ ຫຼື ຄືນໝົດແລ້ວ',
          style: TextStyle(fontSize: 12, color: faint),
        ),
      ],
    ),
  );

  Widget _errorCard() => Center(
    child: Padding(
      padding: const EdgeInsets.all(22),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: cardDecoration(border: const Color(0xFFFECDD3)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 34, color: danger),
            const SizedBox(height: 10),
            const Text(
              'ໂຫຼດອາໄຫຼ່ຄ້າງບໍ່ສຳເລັດ',
              style: TextStyle(fontWeight: FontWeight.w800, color: ink),
            ),
            const SizedBox(height: 5),
            Text(
              error ?? '',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: muted, height: 1.5),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: teal),
              onPressed: () {
                setState(() {
                  loading = true;
                  error = null;
                });
                _load();
              },
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('ລອງໃໝ່'),
            ),
          ],
        ),
      ),
    ),
  );
}
