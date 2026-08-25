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
  final scroll = ScrollController();
  RepairStock? data;
  final List<RepairStockRow> items = [];
  bool loading = true;
  bool loadingMore = false;
  String wh = ''; // ສູນທີ່ເລືອກ — ວ່າງ = ທຸກສູນ
  String loc = ''; // ທີ່ຈັດເກັບທີ່ເລືອກ
  int page = 1;
  int visibleCount = 10;

  @override
  void initState() {
    super.initState();
    scroll.addListener(_onScroll);
    load();
  }

  @override
  void dispose() {
    term.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> load({bool append = false}) async {
    setState(() {
      if (append) {
        loadingMore = true;
      } else {
        loading = true;
      }
    });
    try {
      final result = await Api.repairStock(
        q: term.text.trim(),
        wh: wh,
        loc: loc,
        page: page,
      );
      if (mounted) {
        setState(() {
          data = result;
          if (append) {
            items.addAll(result.items);
            visibleCount = (visibleCount + 5).clamp(0, items.length);
          } else {
            items
              ..clear()
              ..addAll(result.items);
            visibleCount = items.length < 10 ? items.length : 10;
          }
        });
      }
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          loading = false;
          loadingMore = false;
        });
      }
    }
  }

  void _onScroll() {
    if (!scroll.hasClients ||
        scroll.position.extentAfter > 180 ||
        loading ||
        loadingMore) {
      return;
    }
    if (visibleCount < items.length) {
      setState(() => visibleCount = (visibleCount + 5).clamp(0, items.length));
      return;
    }
    final d = data;
    if (d != null && page < d.pages) {
      page += 1;
      load(append: true);
    }
  }

  /// ປ່ຽນຕົວກອງ ⇒ ກັບໄປໜ້າ 1 ສະເໝີ (ບໍ່ດັ່ງນັ້ນຄ້າງຢູ່ໜ້າ 20 ຂອງລາຍການທີ່ສັ້ນລົງ)
  void _refilter(void Function() change) {
    setState(() {
      change();
      page = 1;
      visibleCount = 10;
      items.clear();
    });
    if (scroll.hasClients) scroll.jumpTo(0);
    load();
  }

  static String fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  Widget _chip(String label, int n, bool active, VoidCallback onTap) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.fromLTRB(11, 7, 8, 7),
        decoration: BoxDecoration(
          color: active ? teal : const Color(0xFFF7FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? teal : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            if (active) ...[
              const Icon(Icons.check_rounded, size: 14, color: onAccent),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
                color: active ? onAccent : ink,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: active
                    ? onAccent.withValues(alpha: .18)
                    : onAccent,
                borderRadius: BorderRadius.circular(7),
              ),
              child: Text(
                '$n',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: active ? onAccent : muted,
                ),
              ),
            ),
          ],
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
          Container(
            margin: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            padding: const EdgeInsets.all(12),
            // v4: flat — ຂອບແທນເງົາ
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(kCardRadius),
              border: Border.all(color: line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: term,
                        textInputAction: TextInputAction.search,
                        onSubmitted: (_) => _refilter(() {}),
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: const Color(0xFFF7FAFC),
                          isDense: true,
                          prefixIcon: const Icon(
                            Icons.search_rounded,
                            size: 20,
                          ),
                          hintText: 'ຄົ້ນຊື່ ຫຼື ລະຫັດສິນຄ້າ',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      tooltip: 'ຄົ້ນຫາ',
                      style: IconButton.styleFrom(
                        backgroundColor: teal,
                        foregroundColor: onAccent,
                        minimumSize: const Size(48, 48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      onPressed: loading ? null : () => _refilter(() {}),
                      icon: const Icon(Icons.arrow_forward_rounded),
                    ),
                  ],
                ),
                if (d != null) ...[
                  const SizedBox(height: 13),
                  const Text(
                    'ສູນບໍລິການ',
                    style: TextStyle(
                      color: muted,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 7),
                  SizedBox(
                    height: 38,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _chip(
                          'ທຸກສູນ',
                          d.total,
                          wh.isEmpty,
                          () => _refilter(() {
                            wh = '';
                            loc = '';
                          }),
                        ),
                        for (final center in d.centers)
                          _chip(
                            center.name,
                            center.items,
                            wh == center.code,
                            () => _refilter(() {
                              wh = center.code;
                              loc = '';
                            }),
                          ),
                      ],
                    ),
                  ),
                ],
                if (d != null && wh.isNotEmpty && d.shelves.isNotEmpty) ...[
                  const SizedBox(height: 11),
                  const Text(
                    'ບ່ອນຈັດເກັບ',
                    style: TextStyle(
                      color: muted,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 7),
                  SizedBox(
                    height: 38,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _chip(
                          'ທຸກທີ່',
                          d.total,
                          loc.isEmpty,
                          () => _refilter(() => loc = ''),
                        ),
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
                ],
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 2),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'ອັບເດດ: ${d?.refreshedAt ?? "—"}   ·   ${d?.total ?? 0} ລາຍການ'
                '   ·   ສະແດງ ${visibleCount.clamp(0, items.length)}',
                style: const TextStyle(fontSize: 11.5, color: muted),
              ),
            ),
          ),

          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : d == null || items.isEmpty
                ? const Center(
                    child: Text(
                      'ບໍ່ພົບອາໄຫຼ່ໃນສາງສູນບໍລິການ',
                      style: TextStyle(color: muted),
                    ),
                  )
                : ListView.separated(
                    controller: scroll,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                    itemCount:
                        visibleCount.clamp(0, items.length) +
                        (loadingMore ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (_, i) {
                      final shown = visibleCount.clamp(0, items.length);
                      if (i == shown) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 14),
                          child: Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          ),
                        );
                      }
                      final item = items[i];
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
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          // v4: flat — ຂອບແທນເງົາ
                          decoration: BoxDecoration(
                            color: surface,
                            borderRadius: BorderRadius.circular(kCardRadius),
                            border: Border.all(color: line),
                          ),
                          padding: const EdgeInsets.all(14),
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
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: muted,
                                          ),
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
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: muted,
                                    ),
                                  ),
                                ],
                              ),
                              const Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: faint,
                              ),
                            ],
                          ),
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
