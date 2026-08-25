import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'login_screen.dart';
import 'manager_kit.dart';

/// ແຜນທີ່ **ງານທີ່ຍັງຄ້າງ** (ສ້ອມ + ຕິດຕັ້ງ) ສຳລັບຜູ້ຈັດການ.
///
/// ໃຊ້ tile ຂອງ OpenStreetMap ⇒ ບໍ່ຕ້ອງມີ API key / ບັນຊີເກັບເງິນຄື Google Maps.
///
/// ⚠️ ໝຸດຈະຂຶ້ນສະເພາະງານທີ່ **ມີພິກັດ**. ວັດຂໍ້ມູນຈິງ 31-07-2026: ງານສ້ອມທີ່ເປີດຢູ່
/// 124 ໃບບໍ່ມີພິກັດຈັກໃບ · ຕິດຕັ້ງ 39 ໃບ ມີພຽງ 6 ໃບ ⇒ ໜ້ານີ້ຈຶ່ງ **ບອກຈຳນວນທີ່ຂາດ**
/// ໄວ້ເທິງສຸດ ບໍ່ດັ່ງນັ້ນຄົນເປີດມາເຫັນແຜນທີ່ວ່າງແລ້ວຄິດວ່າລະບົບພັງ.
class PendingMapScreen extends StatefulWidget {
  const PendingMapScreen({super.key});

  @override
  State<PendingMapScreen> createState() => _PendingMapScreenState();
}

class _PendingMapScreenState extends State<PendingMapScreen> {
  List<MapPin> pins = [];
  int noGpsRepair = 0;
  int noGpsInstall = 0;
  bool loading = true;
  String error = '';
  String filter = 'all'; // all | repair | install

  /// ນະຄອນຫຼວງວຽງຈັນ — ຈຸດເລີ່ມເມື່ອບໍ່ມີໝຸດຈັກອັນ
  static const _fallback = LatLng(17.9757, 102.6331);

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.mapPending();
      if (!mounted) return;
      setState(() {
        pins = result.pins;
        noGpsRepair = result.noGpsRepair;
        noGpsInstall = result.noGpsInstall;
        error = '';
        loading = false;
      });
    } on ApiError catch (failure) {
      if (!mounted) return;
      if (failure.status == 401) {
        await Api.clearToken();
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
        return;
      }
      setState(() {
        error = failure.message;
        loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້';
          loading = false;
        });
      }
    }
  }

  List<MapPin> get shown =>
      filter == 'all' ? pins : pins.where((p) => p.workflow == filter).toList();

  Color _tone(MapPin pin) {
    if (pin.ageDays > 30) return danger;
    return pin.workflow == 'install' ? warn : teal;
  }

  void _openPin(MapPin pin) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: line, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Text(
                  '#${pin.code}',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: ink),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: _tone(pin).withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    pin.workflow == 'install' ? 'ຕິດຕັ້ງ' : 'ສ້ອມ${pin.serviceType != null ? '·${pin.serviceType}' : ''}',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _tone(pin)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _sheetRow('ສິນຄ້າ', pin.title),
            _sheetRow('ລູກຄ້າ', pin.customer ?? '-'),
            _sheetRow('ຊ່າງ', pin.tech ?? 'ຍັງບໍ່ຈັດ'),
            _sheetRow('ຂັ້ນ', pin.stageLabel),
            _sheetRow('ອາຍຸ', '${pin.ageDays} ມື້', tone: pin.ageDays > 30 ? danger : null),
            // ບອກທີ່ມາຂອງພິກັດ — ຈຸດ check-in ບໍ່ແມ່ນບ່ອນທີ່ໝາຍໄວ້ຕອນເປີດງານ
            _sheetRow(
              'ພິກັດຈາກ',
              pin.source == 'checkin' ? 'ຈຸດທີ່ຊ່າງ check-in' : 'ໝາຍຕອນເປີດງານ',
            ),
          ],
        ),
      ),
    );
  }

  static Widget _sheetRow(String key, String value, {Color? tone}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 84,
          child: Text(key, style: const TextStyle(fontSize: 12.5, color: muted)),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: tone ?? ink,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _filterChip(String key, String label, int n) => Padding(
    padding: const EdgeInsets.only(right: 7),
    child: InkWell(
      onTap: () => setState(() => filter = key),
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: filter == key ? ink : surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: filter == key ? ink : line),
        ),
        child: Text(
          '$label $n',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: filter == key ? onAccent : muted,
          ),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final list = shown;
    final center = list.isEmpty
        ? _fallback
        : LatLng(
            list.map((p) => p.lat).reduce((a, b) => a + b) / list.length,
            list.map((p) => p.lng).reduce((a, b) => a + b) / list.length,
          );
    final noGps = noGpsRepair + noGpsInstall;

    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ແຜນທີ່ງານຄ້າງ',
            onBack: () => Navigator.pop(context),
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: loading
                ? null
                : [
                    HeroStat(value: '${pins.length}', label: 'ມີພິກັດ'),
                    if (noGps > 0)
                      HeroStat(
                        value: '$noGps',
                        label: 'ບໍ່ມີພິກັດ',
                        color: const Color(0xFFFDBA74),
                      ),
                  ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? ErrorRetry(message: error, onRetry: load)
                : Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
                        child: Row(
                          children: [
                            _filterChip('all', 'ທັງໝົດ', pins.length),
                            _filterChip('repair', 'ສ້ອມ',
                                pins.where((p) => p.workflow == 'repair').length),
                            _filterChip('install', 'ຕິດຕັ້ງ',
                                pins.where((p) => p.workflow == 'install').length),
                          ],
                        ),
                      ),
                      // ⚠️ ບອກໃຫ້ຮູ້ວ່າແຜນທີ່ **ບໍ່ຄົບ** — ບໍ່ດັ່ງນັ້ນຄິດວ່າງານມີແຕ່ເທົ່ານີ້
                      if (noGps > 0)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                            decoration: BoxDecoration(
                              color: warn.withValues(alpha: .08),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: warn.withValues(alpha: .28)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.info_outline, size: 15, color: warn),
                                const SizedBox(width: 7),
                                Expanded(
                                  child: Text(
                                    'ຍັງມີງານຄ້າງອີກ $noGps ໃບ (ສ້ອມ $noGpsRepair · ຕິດຕັ້ງ $noGpsInstall) '
                                    'ທີ່ບໍ່ໄດ້ໝາຍພິກັດຕອນເປີດງານ ⇒ ບໍ່ຂຶ້ນແຜນທີ່',
                                    style: const TextStyle(fontSize: 11, color: ink, height: 1.35),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                          child: FlutterMap(
                            options: MapOptions(
                              initialCenter: center,
                              initialZoom: list.length <= 1 ? 13 : 11,
                            ),
                            children: [
                              TileLayer(
                                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                userAgentPackageName: 'net.odien.odss',
                              ),
                              MarkerLayer(
                                markers: [
                                  for (final pin in list)
                                    Marker(
                                      point: LatLng(pin.lat, pin.lng),
                                      width: 40,
                                      height: 40,
                                      child: GestureDetector(
                                        onTap: () => _openPin(pin),
                                        child: Container(
                                          decoration: BoxDecoration(
                                            color: _tone(pin),
                                            shape: BoxShape.circle,
                                            border: Border.all(color: surface, width: 2),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withValues(alpha: .25),
                                                blurRadius: 4,
                                              ),
                                            ],
                                          ),
                                          child: Center(
                                            child: Text(
                                              '${pin.ageDays}',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w900,
                                                color: surface,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
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
