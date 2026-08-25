import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ຕິດຕາມສິນຄ້າຄົງເຫຼືອ — ຊ່າງຄົ້ນອາໄຫຼ່ ແລ້ວເຫັນຍອດຄົງເຫຼືອ **ແຍກຕາມສາງ** (ຈາກ ERP).
/// ໃຊ້ກ່ອນຂໍເບີກ ເພື່ອຮູ້ວ່າມີຂອງບໍ ແລະ ຢູ່ສາງໃດ.
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
///   ① ຊ່ອງຄົ້ນຫາ ແລະ ກາດ ໃຊ້ຊຸດອອກແບບດຽວກັບໜ້າອາໄຫຼ່ອື່ນ
///   ② ມີ **ປ້າຍມີ/ໝົດ** ຢູ່ຫົວກາດ ⇒ ຮູ້ຜົນທັນທີບໍ່ຕ້ອງອ່ານຕົວເລກ
///   ③ ສະຖານະ "ຍັງບໍ່ໄດ້ຄົ້ນ" ແລະ "ບໍ່ພົບ" ເປັນພາບ ບໍ່ແມ່ນຂໍ້ຄວາມສີເທົາລອຍໆ
class StockBalanceScreen extends StatefulWidget {
  const StockBalanceScreen({super.key});

  @override
  State<StockBalanceScreen> createState() => _StockBalanceScreenState();
}

class _StockBalanceScreenState extends State<StockBalanceScreen> {
  final term = TextEditingController();
  List<StockBalanceItem> items = [];
  bool busy = false;
  bool searched = false;

  @override
  void dispose() {
    term.dispose();
    super.dispose();
  }

  Future<void> search() async {
    if (term.text.trim().isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => busy = true);
    try {
      final rows = await Api.stockBalance(term.text.trim());
      if (mounted) {
        setState(() {
          items = rows;
          searched = true;
        });
      }
    } on ApiError catch (failure) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  static String fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) => HeroScaffold(
    title: 'ສິນຄ້າຄົງເຫຼືອ',
    onBack: () => Navigator.pop(context),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: line),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search_rounded, size: 18, color: faint),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: term,
                          autofocus: true,
                          textInputAction: TextInputAction.search,
                          onSubmitted: (_) => search(),
                          style: const TextStyle(fontSize: 13.5, color: ink),
                          decoration: const InputDecoration(
                            isDense: true,
                            border: InputBorder.none,
                            hintText: 'ຊື່ ຫຼື ລະຫັດອາໄຫຼ່...',
                            hintStyle: TextStyle(fontSize: 13, color: faint),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 44,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: teal,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: busy ? null : search,
                  child: busy
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: onAccent,
                          ),
                        )
                      : const Icon(Icons.search_rounded, size: 20),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: !searched
              ? _hint(
                  Icons.inventory_2_outlined,
                  'ພິມຊື່ ຫຼື ລະຫັດອາໄຫຼ່',
                  'ແລ້ວກົດຄົ້ນ — ຈະບອກຍອດແຍກຕາມສາງ',
                )
              : items.isEmpty
              ? _hint(
                  Icons.search_off_rounded,
                  'ບໍ່ພົບອາໄຫຼ່',
                  'ລອງພິມສັ້ນລົງ ຫຼື ໃຊ້ລະຫັດແທນຊື່',
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(14, 6, 14, 20),
                  itemCount: items.length,
                  itemBuilder: (_, index) => _card(items[index]),
                ),
        ),
      ],
    ),
  );

  Widget _card(StockBalanceItem item) {
    final inStock = item.total > 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name.isEmpty ? item.code : item.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13.5,
                          color: ink,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              [
                                item.code,
                                item.brand,
                              ].where((x) => (x ?? '').isNotEmpty).join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: muted,
                              ),
                            ),
                          ),
                          const SizedBox(width: 7),
                          StageTag(
                            inStock ? 'ມີເຫຼືອ' : 'ໝົດສາງ',
                            color: inStock ? ok : danger,
                            bg: inStock
                                ? const Color(0xFFE1F5EC)
                                : const Color(0xFFFCE4EA),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      fmt(item.total),
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 21,
                        height: 1,
                        color: inStock ? ok : danger,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.unitCode ?? '',
                      style: const TextStyle(fontSize: 11.5, color: faint),
                    ),
                  ],
                ),
              ],
            ),
            if (item.warehouses.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(height: 1, color: surfaceAlt),
              const SizedBox(height: 10),
              Wrap(
                spacing: 7,
                runSpacing: 7,
                children: [
                  for (final w in item.warehouses)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: surfaceAlt,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.warehouse_rounded,
                            size: 13,
                            color: faint,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            w.name,
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: muted,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            fmt(w.qty),
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w900,
                              color: ink,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ] else if (!inStock) ...[
              const SizedBox(height: 9),
              const Text(
                'ບໍ່ມີໃນສາງໃດ',
                style: TextStyle(fontSize: 12, color: danger),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _hint(IconData icon, String title, String sub) => Center(
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
          child: Icon(icon, size: 28, color: faint),
        ),
        const SizedBox(height: 12),
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w800, color: ink),
        ),
        const SizedBox(height: 4),
        Text(sub, style: const TextStyle(fontSize: 12, color: faint)),
      ],
    ),
  );
}
