import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ຕິດຕາມສິນຄ້າຄົງເຫຼືອ — ຊ່າງຄົ້ນອາໄຫຼ່ ແລ້ວເຫັນຍອດຄົງເຫຼືອ **ແຍກຕາມສາງ** (ຈາກ ERP).
/// ໃຊ້ກ່ອນຂໍເບີກ ເພື່ອຮູ້ວ່າມີຂອງບໍ ແລະ ຢູ່ສາງໃດ.
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
    setState(() => busy = true);
    try {
      final rows = await Api.stockBalance(term.text.trim());
      if (mounted) setState(() { items = rows; searched = true; });
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String fmt(double v) => (v == v.roundToDouble()) ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ສິນຄ້າຄົງເຫຼືອ')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: term,
                    autofocus: true,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => search(),
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      isDense: true,
                      prefixIcon: Icon(Icons.search),
                      hintText: 'ຊື່ ຫຼື ລະຫັດອາໄຫຼ່...',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: teal, minimumSize: const Size(64, 48)),
                  onPressed: busy ? null : search,
                  child: busy
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('ຄົ້ນ'),
                ),
              ],
            ),
          ),
          Expanded(
            child: !searched
                ? const Center(child: Text('ພິມຊື່/ລະຫັດ ແລ້ວກົດ ຄົ້ນ', style: TextStyle(color: muted)))
                : items.isEmpty
                    ? const Center(child: Text('ບໍ່ພົບອາໄຫຼ່', style: TextStyle(color: muted)))
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final it = items[i];
                          final inStock = it.total > 0;
                          return Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            padding: const EdgeInsets.all(14),
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
                                          Text(it.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                          const SizedBox(height: 2),
                                          Text(
                                            [it.code, it.brand].where((x) => (x ?? '').isNotEmpty).join(' · '),
                                            style: const TextStyle(fontSize: 11.5, color: muted),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          fmt(it.total),
                                          style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 20,
                                            color: inStock ? ok : danger,
                                          ),
                                        ),
                                        Text(it.unitCode ?? '', style: const TextStyle(fontSize: 10.5, color: muted)),
                                      ],
                                    ),
                                  ],
                                ),
                                if (it.warehouses.isNotEmpty) ...[
                                  const Divider(height: 18),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: it.warehouses
                                        .map(
                                          (w) => Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF1F5F9),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              '${w.name}  ${fmt(w.qty)}',
                                              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: ink),
                                            ),
                                          ),
                                        )
                                        .toList(),
                                  ),
                                ] else if (!inStock) ...[
                                  const SizedBox(height: 8),
                                  const Text('ບໍ່ມີໃນສາງໃດ', style: TextStyle(fontSize: 12, color: danger)),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
