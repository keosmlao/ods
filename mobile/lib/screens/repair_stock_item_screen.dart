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
  const RepairStockItemScreen({
    super.key,
    required this.code,
    required this.name,
  });
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
    if (mounted) {
      setState(() {
        loading = true;
        error = '';
      });
    }
    try {
      final result = await Api.repairStockItem(widget.code);
      if (!mounted) return;
      setState(() {
        data = result;
        error = '';
        loading = false;
      });
    } on ApiError catch (failure) {
      if (mounted) {
        setState(() {
          error = failure.message;
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້';
          loading = false;
        });
      }
    }
  }

  static String fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  Widget _errorCard() => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFFE6ECEF)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0A0F172A),
          blurRadius: 16,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: Column(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: const BoxDecoration(
            color: Color(0xFFFFF7ED),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.cloud_off_outlined,
            color: Color(0xFFEA580C),
            size: 26,
          ),
        ),
        const SizedBox(height: 13),
        const Text(
          'ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          error,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 12, height: 1.45, color: muted),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: load,
          style: FilledButton.styleFrom(
            backgroundColor: teal,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          icon: const Icon(Icons.refresh_rounded, size: 19),
          label: const Text('ລອງໂຫຼດໃໝ່'),
        ),
      ],
    ),
  );

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
            trailing: [
              HeroIconButton(icon: Icons.refresh_rounded, onTap: load),
            ],
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
                ? ListView(
                    padding: const EdgeInsets.all(16),
                    children: [_errorCard()],
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF0F766E), Color(0xFF258E83)],
                          ),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x241C8077),
                              blurRadius: 18,
                              offset: Offset(0, 7),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    d!.code,
                                    style: const TextStyle(
                                      color: Color(0xFFCCFBF1),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    d.name,
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      height: 1.35,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 14),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: .14),
                                borderRadius: BorderRadius.circular(15),
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    fmt(d.total),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 24,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  Text(
                                    d.unitCode ?? 'ລວມ',
                                    style: const TextStyle(
                                      color: Color(0xFFCCFBF1),
                                      fontSize: 10.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // ① ຂອງຢູ່ໃສ ຈັກອັນ
                      MCard(
                        title: 'ຢູ່ບ່ອນໃດ ຈັກອັນ',
                        child: Column(
                          children: [
                            for (final place in d.places)
                              Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF7FAFC),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 36,
                                      height: 36,
                                      decoration: const BoxDecoration(
                                        color: tealTint,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.warehouse_outlined,
                                        size: 18,
                                        color: teal,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            place.locationName.isEmpty
                                                ? (place.location.isEmpty
                                                      ? '—'
                                                      : place.location)
                                                : place.locationName,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w700,
                                              color: ink,
                                            ),
                                          ),
                                          Text(
                                            '${place.whName}  ·  ${place.location}',
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: muted,
                                            ),
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
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 5,
                                      ),
                                      child: Row(
                                        children: [
                                          SizedBox(
                                            width: 74,
                                            child: Text(
                                              move.docDate ?? '-',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: muted,
                                              ),
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
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
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontSize: 10.5,
                                                    color: muted,
                                                  ),
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
