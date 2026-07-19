import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// browse ຄົງເຫຼືອ ສາງສ້ອມ (ສູນບໍລິການ 1104/1206) — scroll ເບິ່ງທຸກລາຍການ + ກອງ.
/// ອ່ານຈາກ cache (ໄວ) · ຍອດເປັນ snapshot (refresh ຢູ່ເວັບ/cron).
class RepairStockScreen extends StatefulWidget {
  const RepairStockScreen({super.key});

  @override
  State<RepairStockScreen> createState() => _RepairStockScreenState();
}

class _RepairStockScreenState extends State<RepairStockScreen> {
  final term = TextEditingController();
  List<StockBalanceItem> items = [];
  String? refreshedAt;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    term.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final result = await Api.repairStock(term.text.trim());
      if (mounted) setState(() { items = result.items; refreshedAt = result.refreshedAt; });
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String fmt(double v) => (v == v.roundToDouble()) ? v.toStringAsFixed(0) : v.toStringAsFixed(2);
  double whQty(StockBalanceItem it, String code) =>
      it.warehouses.where((w) => w.code == code).fold(0.0, (s, w) => s + w.qty);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ຄົງເຫຼືອ ສາງສ້ອມ')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: term,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => load(),
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      isDense: true,
                      prefixIcon: Icon(Icons.search),
                      hintText: 'ກອງ: ຊື່ ຫຼື ລະຫັດ...',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: teal, minimumSize: const Size(60, 48)),
                  onPressed: loading ? null : load,
                  child: const Text('ກອງ'),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'ອັບເດດ: ${refreshedAt ?? "—"}   ·   ${items.length} ລາຍການ',
                style: const TextStyle(fontSize: 11.5, color: muted),
              ),
            ),
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : items.isEmpty
                    ? const Center(child: Text('ບໍ່ພົບອາໄຫຼ່ໃນສາງສ້ອມ', style: TextStyle(color: muted)))
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 6),
                        itemBuilder: (_, i) {
                          final it = items[i];
                          final q1104 = whQty(it, '1104');
                          final q1206 = whQty(it, '1206');
                          return Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(it.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                                      const SizedBox(height: 3),
                                      Wrap(
                                        spacing: 6,
                                        children: [
                                          Text(it.code, style: const TextStyle(fontSize: 11, color: muted)),
                                          if (q1104 > 0)
                                            Text('ຂົວຫຼວງ ${fmt(q1104)}', style: const TextStyle(fontSize: 11, color: Color(0xFFB45309))),
                                          if (q1206 > 0)
                                            Text('ດອນຕີ້ວ ${fmt(q1206)}', style: const TextStyle(fontSize: 11, color: Color(0xFFB45309))),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(fmt(it.total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: ok)),
                                    Text(it.unitCode ?? '', style: const TextStyle(fontSize: 10, color: muted)),
                                  ],
                                ),
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
