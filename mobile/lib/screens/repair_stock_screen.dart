import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'repair_stock_item_screen.dart';

/// **ຄົງເຫຼືອ ສາງສູນບໍລິການ** (1104 ຂົວຫຼວງ · 1206 ດອນຕີ້ວ) — ຄົ້ນ · ກອງ · ເປີດລາຍລະອຽດ.
///
/// ອ່ານ cache ອັນດຽວກັບໜ້າເວັບ ⇒ ຕົວເລກ 2 ຝັ່ງບໍ່ຫຼົ້ນກັນ ແລະ ບໍ່ຕ້ອງລໍ ERP ຄິດຍອດ.
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ ──
/// ລຸ້ນກ່ອນດຶງ **ທັງ 1,141 ລາຍການ** ລົງມືຖືທຸກເທື່ອ ແລ້ວສະແດງເປັນລາຍການຍາວດຽວ
/// ໂດຍບໍ່ມີທາງກອງຕາມສູນ/ທີ່ຈັດເກັບ ແລະ ແຕະບໍ່ໄດ້. ດຽວນີ້ຕັດໜ້າ 30 ຢູ່ server ·
/// ກອງໄດ້ · ແລະ ແຕ່ລະຕົວມີໜ້າລາຍລະອຽດ (ຢູ່ບ່ອນໃດ ຈັກອັນ + ຄວາມເຄື່ອນໄຫວ).
class RepairStockScreen extends StatefulWidget {
  const RepairStockScreen({super.key});

  @override
  State<RepairStockScreen> createState() => _RepairStockScreenState();
}

class _RepairStockScreenState extends State<RepairStockScreen> {
  final term = TextEditingController();
  RepairStock? data;
  bool loading = true;
  String wh = ''; // ສູນທີ່ເລືອກ — ວ່າງ = ທຸກສູນ
  String loc = ''; // ທີ່ຈັດເກັບທີ່ເລືອກ
  int page = 1;

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
      final result = await Api.repairStock(
        q: term.text.trim(),
        wh: wh,
        loc: loc,
        page: page,
      );
      if (mounted) setState(() => data = result);
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

  /// ປ່ຽນຕົວກອງ ⇒ ກັບໄປໜ້າ 1 ສະເໝີ (ບໍ່ດັ່ງນັ້ນຄ້າງຢູ່ໜ້າ 20 ຂອງລາຍການທີ່ສັ້ນລົງ)
  void _refilter(void Function() change) {
    setState(() {
      change();
      page = 1;
    });
    load();
  }

  static String fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  Widget _chip(String label, int n, bool active, VoidCallback onTap) => Padding(
    padding: const EdgeInsets.only(right: 7),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: active ? ink : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? ink : line),
        ),
        child: Text(
          '$label $n',
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: active ? Colors.white : muted,
          ),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final d = data;
    return HeroScaffold(
      title: 'ຄົງເຫຼືອ ສາງສູນບໍລິການ',
      onBack: () => Navigator.pop(context),
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
                    onSubmitted: (_) => _refilter(() {}),
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      isDense: true,
                      prefixIcon: Icon(Icons.search),
                      hintText: 'ຄົ້ນ: ຊື່ ຫຼື ລະຫັດ...',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: teal,
                    minimumSize: const Size(60, 48),
                  ),
                  onPressed: loading ? null : () => _refilter(() {}),
                  child: const Text('ຄົ້ນ'),
                ),
              ],
            ),
          ),

          // ── ກອງຕາມສູນ ──
          if (d != null)
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _chip('ທຸກສູນ', d.total, wh.isEmpty, () => _refilter(() { wh = ''; loc = ''; })),
                  for (final center in d.centers)
                    _chip(center.name, center.items, wh == center.code,
                        () => _refilter(() { wh = center.code; loc = ''; })),
                ],
              ),
            ),

          // ── ກອງຕາມທີ່ຈັດເກັບ (ສະເພາະເມື່ອເລືອກສູນແລ້ວ) ──
          if (d != null && wh.isNotEmpty && d.shelves.isNotEmpty)
            SizedBox(
              height: 34,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _chip('ທຸກທີ່', d.total, loc.isEmpty, () => _refilter(() => loc = '')),
                  for (final shelf in d.shelves)
                    _chip(
                      shelf.name.isEmpty ? shelf.code : shelf.name,
                      shelf.items,
                      loc == shelf.code,
                      () => _refilter(() => loc = shelf.code),
                    ),
                ],
              ),
            ),

          Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 2),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'ອັບເດດ: ${d?.refreshedAt ?? "—"}   ·   ${d?.total ?? 0} ລາຍການ'
                '${(d?.pages ?? 1) > 1 ? "   ·   ໜ້າ ${d!.page}/${d.pages}" : ""}',
                style: const TextStyle(fontSize: 11.5, color: muted),
              ),
            ),
          ),

          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : d == null || d.items.isEmpty
                ? const Center(
                    child: Text('ບໍ່ພົບອາໄຫຼ່ໃນສາງສູນບໍລິການ', style: TextStyle(color: muted)),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
                    itemCount: d.items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (_, i) {
                      final item = d.items[i];
                      return InkWell(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => RepairStockItemScreen(
                              code: item.code,
                              name: item.name,
                            ),
                          ),
                        ),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
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
                                    Text(
                                      item.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13.5,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Wrap(
                                      spacing: 6,
                                      children: [
                                        Text(
                                          item.code,
                                          style: const TextStyle(fontSize: 11, color: muted),
                                        ),
                                        for (final center in item.centers)
                                          if (center.qty > 0)
                                            Text(
                                              '${center.name} ${fmt(center.qty)}',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: Color(0xFFB45309),
                                              ),
                                            ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    fmt(item.total),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 17,
                                      color: ok,
                                    ),
                                  ),
                                  Text(
                                    item.unitCode ?? '',
                                    style: const TextStyle(fontSize: 10, color: muted),
                                  ),
                                ],
                              ),
                              const Icon(Icons.chevron_right, size: 18, color: faint),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),

          // ── ປ່ຽນໜ້າ ──
          if (d != null && d.pages > 1)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    onPressed: d.page <= 1
                        ? null
                        : () {
                            setState(() => page = d.page - 1);
                            load();
                          },
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Text(
                    '${d.page} / ${d.pages}',
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: ink),
                  ),
                  IconButton(
                    onPressed: d.page >= d.pages
                        ? null
                        : () {
                            setState(() => page = d.page + 1);
                            load();
                          },
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
