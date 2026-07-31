import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'manager_kit.dart';

/// ລາຍລະອຽດອາໄຫຼ່ 1 ຕົວ ໃນສາງສູນບໍລິການ.
///
/// ຕອບ 2 ຄຳຖາມທີ່ຄົນເປີດລາຍການແລ້ວຢາກຮູ້ຕໍ່:
///   ① **ຂອງຢູ່ໃສ ຈັກອັນ** — ແຍກເຖິງລະດັບ *ທີ່ຈັດເກັບ* (ສາງສ້ອມແປງ · AREA 2-ຫ້ອງສ້ອມ …)
///   ② **ເຄື່ອນໄຫວຫຍັງມາແດ່** — ເບີກອອກ/ຮັບເຂົ້າ/ໂອນ ລ່າສຸດ (ຈາກ ERP)
class RepairStockItemScreen extends StatefulWidget {
  const RepairStockItemScreen({super.key, required this.code, required this.name});
  final String code;
  final String name;

  @override
  State<RepairStockItemScreen> createState() => _RepairStockItemScreenState();
}

class _RepairStockItemScreenState extends State<RepairStockItemScreen> {
  RepairStockDetail? data;
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.repairStockItem(widget.code);
      if (!mounted) return;
      setState(() {
        data = result;
        error = '';
        loading = false;
      });
    } on ApiError catch (failure) {
      if (mounted) setState(() { error = failure.message; loading = false; });
    } catch (_) {
      if (mounted) setState(() { error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້'; loading = false; });
    }
  }

  static String fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) {
    final d = data;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: widget.name,
            onBack: () => Navigator.pop(context),
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: d == null
                ? null
                : [
                    HeroStat(value: fmt(d.total), label: d.unitCode ?? 'ລວມ'),
                    HeroStat(value: '${d.places.length}', label: 'ບ່ອນຈັດເກັບ'),
                  ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? ErrorRetry(message: error, onRetry: load)
                : ListView(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                    children: [
                      MCard(
                        title: 'ລະຫັດ ${d!.code}',
                        child: Text(
                          d.name,
                          style: const TextStyle(fontSize: 13.5, color: ink, height: 1.4),
                        ),
                      ),

                      // ① ຂອງຢູ່ໃສ ຈັກອັນ
                      MCard(
                        title: 'ຢູ່ບ່ອນໃດ ຈັກອັນ',
                        child: Column(
                          children: [
                            for (final place in d.places)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            place.locationName.isEmpty
                                                ? (place.location.isEmpty ? '—' : place.location)
                                                : place.locationName,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w700,
                                              color: ink,
                                            ),
                                          ),
                                          Text(
                                            '${place.whName}  ·  ${place.location}',
                                            style: const TextStyle(fontSize: 11, color: muted),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(
                                      fmt(place.qty),
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w900,
                                        color: ok,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),

                      // ② ເຄື່ອນໄຫວລ່າສຸດ
                      MCard(
                        title: 'ຄວາມເຄື່ອນໄຫວລ່າສຸດ',
                        child: d.moves.isEmpty
                            ? const Text(
                                'ບໍ່ມີຄວາມເຄື່ອນໄຫວ (ຫຼື ອ່ານ ERP ບໍ່ໄດ້)',
                                style: TextStyle(fontSize: 12, color: muted),
                              )
                            : Column(
                                children: [
                                  for (final move in d.moves)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 5),
                                      child: Row(
                                        children: [
                                          SizedBox(
                                            width: 74,
                                            child: Text(
                                              move.docDate ?? '-',
                                              style: const TextStyle(fontSize: 11, color: muted),
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  move.kind,
                                                  style: const TextStyle(
                                                    fontSize: 12.5,
                                                    fontWeight: FontWeight.w700,
                                                    color: ink,
                                                  ),
                                                ),
                                                Text(
                                                  '${move.docNo}  ·  ສາງ ${move.whCode}',
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: const TextStyle(fontSize: 10.5, color: muted),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Text(
                                            fmt(move.qty),
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                              color: ink,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
