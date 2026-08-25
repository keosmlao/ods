import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../job_urgency.dart';
import '../main.dart';
import '../streak.dart';
import '../widgets/ui_kit.dart';
import 'job_screen.dart';
import 'notifications_screen.dart';

/// **ໜ້າ "ມື້ນີ້" — ແຜນທີ່ນຳ** (v6, ແບບ E).
///
/// ── ເປັນຫຍັງແຜນທີ່ ──
/// ຊ່າງພາກສະໜາມແລ່ນ 3–6 ຈຸດຕໍ່ມື້. ຄຳຖາມທຳອິດຂອງລາວບໍ່ແມ່ນ "ມີວຽກຫຍັງແດ່"
/// ແຕ່ແມ່ນ **"ໄປທາງໃດກ່ອນຈຶ່ງບໍ່ເສຍທ່ຽວ"** — ຄຳຖາມນັ້ນລາຍການຕອບບໍ່ໄດ້ ແຕ່ແຜນທີ່ຕອບໄດ້.
/// ໝຸດຮຽງເປັນເລກ 1·2·3 ຕາມໄລຍະທາງຈາກຈຸດທີ່ຢືນຢູ່ ⇒ ເສັ້ນທາງມື້ນັ້ນເຫັນໃນຈໍດຽວ.
///
/// ── ຫຼັກທີ່ບໍ່ປ່ຽນ ──
/// ບໍ່ຂໍສິດພິກັດເອງຕອນເປີດແອັບ (ຄຳຂໍທີ່ໂຜ່ມາລອຍໆ ຄົນກົດປະຕິເສດ) — ສະແດງໝຸດກ່ອນ
/// ແລ້ວມີປຸ່ມ "ຮຽງຕາມໄລຍະທາງ" ໃຫ້ກົດເອງ. ໃບທີ່**ບໍ່ມີພິກັດ**ບໍ່ຫາຍໄປ: ຢູ່ທ້າຍລາຍການ.
class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  /// ວຽງຈັນ — ໃຊ້ຕອນຍັງບໍ່ຮູ້ພິກັດຈັກອັນ (ບໍ່ໃຫ້ແຜນທີ່ເປີດກາງມະຫາສະໝຸດ)
  static const _fallback = LatLng(17.9757, 102.6331);

  final _map = MapController();
  List<Job> jobs = const [];
  Income? income;
  Position? me;
  bool loading = true;
  bool locating = false;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
    _useLastKnownPosition();
  }

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final rows = await Api.jobs();
      Income? money;
      try {
        money = await Api.income();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        jobs = rows;
        income = money;
        error = '';
        loading = false;
      });
    } on ApiError catch (failure) {
      if (mounted) setState(() { error = failure.message; loading = false; });
    } catch (_) {
      if (mounted) setState(() { error = 'ເຊື່ອມຕໍ່ບໍ່ໄດ້'; loading = false; });
    }
  }

  /// ພິກັດຈຸດສຸດທ້າຍທີ່ລະບົບຈື່ໄວ້ — **ບໍ່ເປີດ GPS ແລະ ບໍ່ຂໍສິດ**
  /// ⇒ ຄົນທີ່ເຄີຍ check-in ມາແລ້ວ ໄດ້ໄລຍະທາງທັນທີໂດຍບໍ່ຖືກຖາມຫຍັງ
  Future<void> _useLastKnownPosition() async {
    try {
      if (await Geolocator.checkPermission() == LocationPermission.denied) return;
      final last = await Geolocator.getLastKnownPosition();
      if (last != null && mounted) setState(() => me = last);
    } catch (_) {}
  }

  /// ກົດເອງ ⇒ ຂໍສິດ + ຈັບພິກັດສົດ
  Future<void> _locate() async {
    setState(() => locating = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('ຕ້ອງອະນຸຍາດພິກັດ ຈຶ່ງຮຽງຕາມໄລຍະທາງໄດ້')),
          );
        }
        return;
      }
      final now = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
      );
      if (!mounted) return;
      setState(() => me = now);
      _map.move(LatLng(now.latitude, now.longitude), 12.5);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ຈັບພິກັດບໍ່ໄດ້ — ອອກໄປບ່ອນໂລ່ງແລ້ວລອງໃໝ່')),
        );
      }
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  /// ໃບທີ່ຊ່າງລົງມືໄດ້ດຽວນີ້ (server ບອກຜ່ານ `action`) — ໜ້ານີ້ບໍ່ສະແດງໃບທີ່ລໍຄົນອື່ນ
  List<Job> get _mine =>
      jobs.where((j) => actionable.contains(j.action)).toList()..sort(byUrgency);

  List<Job> get _pinned =>
      _mine.where((j) => j.lat != null && j.lng != null).toList();

  List<Job> get _noPin => _mine.where((j) => j.lat == null || j.lng == null).toList();

  /// ລຳດັບການໄປ: ໃກ້ສຸດກ່ອນ (ຮູ້ພິກັດຕົນ) ບໍ່ດັ່ງນັ້ນຕາມຄວາມຮີບ
  List<Job> get _route {
    final list = [..._pinned];
    final here = me;
    if (here != null) {
      list.sort((a, b) => _metres(here, a).compareTo(_metres(here, b)));
    }
    return list;
  }

  double _metres(Position from, Job job) => Geolocator.distanceBetween(
        from.latitude,
        from.longitude,
        job.lat!,
        job.lng!,
      );

  String? _km(Job job) {
    final here = me;
    if (here == null || job.lat == null) return null;
    final km = _metres(here, job) / 1000;
    return km < 10 ? km.toStringAsFixed(1) : km.round().toString();
  }

  Color _tone(Job job) => switch (urgencyOf(job)) {
        Urgency.late_ => danger,
        Urgency.today => warn,
        _ => teal,
      };

  int get _doneToday => closedToday(income?.rows ?? const []);

  int get _streak => streakDays(
        (income?.rows ?? const [])
            .map((row) => parseClosedAt(row['closed_at'] as String?))
            .whereType<DateTime>(),
      );

  Future<void> _navigate(Job job) async {
    final destination = job.lat != null && job.lng != null
        ? '${job.lat},${job.lng}'
        : (job.address ?? '').trim();
    if (destination.isEmpty) return;
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'destination': destination,
    });
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ບໍ່ສາມາດເປີດແຜນທີ່ໄດ້')),
      );
    }
  }

  void _open(Job job) => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => JobScreen(job: job)),
      ).then((_) => load());

  @override
  Widget build(BuildContext context) {
    final route = _route;
    final centre = route.isNotEmpty
        ? LatLng(route.first.lat!, route.first.lng!)
        : (me != null ? LatLng(me!.latitude, me!.longitude) : _fallback);

    return Scaffold(
      backgroundColor: ground,
      body: Stack(
        children: [
          Positioned.fill(child: _mapView(route, centre)),
          SafeArea(child: _topBar()),
          _sheet(route),
        ],
      ),
    );
  }

  Widget _mapView(List<Job> route, LatLng centre) => FlutterMap(
    mapController: _map,
    options: MapOptions(initialCenter: centre, initialZoom: route.length <= 1 ? 13 : 11.5),
    children: [
      TileLayer(
        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        userAgentPackageName: 'net.odien.odss',
      ),
      MarkerLayer(
        markers: [
          for (var i = 0; i < route.length; i++)
            Marker(
              point: LatLng(route[i].lat!, route[i].lng!),
              width: 36,
              height: 36,
              child: GestureDetector(
                onTap: () => _open(route[i]),
                child: Container(
                  decoration: BoxDecoration(
                    color: _tone(route[i]),
                    shape: BoxShape.circle,
                    border: Border.all(color: ground, width: 2),
                  ),
                  child: Center(
                    child: Text(
                      '${i + 1}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: onAccent,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          if (me != null)
            Marker(
              point: LatLng(me!.latitude, me!.longitude),
              width: 18,
              height: 18,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF38BDF8),
                  shape: BoxShape.circle,
                  border: Border.all(color: ground, width: 3),
                ),
              ),
            ),
        ],
      ),
    ],
  );

  Widget _topBar() => Padding(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: line),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'ມື້ນີ້ $_doneToday/${_doneToday + _mine.length}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: ink,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              if (_streak > 0) ...[
                const SizedBox(width: 9),
                Text('🔥 $_streak', style: const TextStyle(fontSize: 12.5, color: warn)),
              ],
            ],
          ),
        ),
        const Spacer(),
        _roundButton(
          icon: locating ? Icons.hourglass_bottom_rounded : Icons.my_location_rounded,
          onTap: locating ? null : _locate,
        ),
        const SizedBox(width: 8),
        _roundButton(
          icon: Icons.notifications_none_rounded,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const NotificationsScreen()),
          ),
        ),
      ],
    ),
  );

  Widget _roundButton({required IconData icon, VoidCallback? onTap}) => Material(
    color: surface,
    shape: CircleBorder(side: BorderSide(color: line)),
    child: InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: SizedBox(
        width: 42,
        height: 42,
        child: Icon(icon, size: 20, color: onTap == null ? faint : ink),
      ),
    ),
  );

  Widget _sheet(List<Job> route) => DraggableScrollableSheet(
    initialChildSize: .46,
    minChildSize: .24,
    maxChildSize: .88,
    builder: (context, controller) => Container(
      decoration: BoxDecoration(
        color: surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: line)),
      ),
      child: Column(
        children: [
          Container(
            width: 38,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: lineStrong,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    controller: controller,
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 20),
                    children: [
                      if (error.isNotEmpty) ...[_errorNote(), const SizedBox(height: 12)],
                      if (_mine.isEmpty)
                        _empty()
                      else ...[
                        for (var i = 0; i < route.length; i++) ...[
                          _row(route[i], i + 1),
                          const SizedBox(height: 9),
                        ],
                        if (_noPin.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          const BandHeader('ບໍ່ມີພິກັດ (ໂທຖາມທາງ)'),
                          const SizedBox(height: 8),
                          for (final job in _noPin) ...[
                            _row(job, null),
                            const SizedBox(height: 9),
                          ],
                        ],
                        if (route.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          SizedBox(
                            height: kPrimaryTouch,
                            child: FilledButton.icon(
                              onPressed: () => _navigate(route.first),
                              icon: const Icon(Icons.navigation_rounded, size: 20),
                              label: Text(
                                'ນຳທາງໄປໝຸດ 1${_km(route.first) == null ? '' : ' · ${_km(route.first)} km'}',
                                style: const TextStyle(fontWeight: FontWeight.w900),
                              ),
                            ),
                          ),
                        ],
                        if (me == null) ...[
                          const SizedBox(height: 10),
                          Center(
                            child: TextButton.icon(
                              onPressed: _locate,
                              icon: const Icon(Icons.my_location_rounded, size: 17),
                              label: const Text('ຮຽງຕາມໄລຍະທາງຈາກຈຸດຂອງຂ້ອຍ'),
                            ),
                          ),
                        ],
                      ],
                    ],
                  ),
          ),
        ],
      ),
    ),
  );

  Widget _row(Job job, int? number) {
    final time = timeOf(job);
    final km = _km(job);
    return Material(
      color: ground,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => _open(job),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(11, 11, 11, 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: line),
          ),
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: number == null ? surfaceAlt : _tone(job),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: number == null
                    ? const Icon(Icons.help_outline_rounded, size: 16, color: faint)
                    : Text(
                        '$number',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: onAccent,
                        ),
                      ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      actionVerb(job, phaseLabel: job.stageLabel),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [job.code, if ((job.customer ?? '').trim().isNotEmpty) job.customer!.trim()]
                          .join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, color: muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  TimeChip(time.label, tone: time.tone),
                  if (km != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '$km km',
                      style: const TextStyle(
                        fontSize: 11,
                        color: faint,
                        fontWeight: FontWeight.w700,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _empty() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 26),
    child: Column(
      children: [
        const Text('🎯', style: TextStyle(fontSize: 32)),
        const SizedBox(height: 10),
        const Text(
          'ບໍ່ມີວຽກຄ້າງລໍເຈົ້າດຽວນີ້',
          style: TextStyle(fontWeight: FontWeight.w900, color: ink, fontSize: 15),
        ),
        const SizedBox(height: 4),
        Text(
          'ໃບທີ່ເຫຼືອ ${jobs.length - _mine.length} ໃບ ກຳລັງລໍຄົນອື່ນຢູ່',
          style: const TextStyle(color: faint, fontSize: 12.5),
        ),
      ],
    ),
  );

  Widget _errorNote() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(color: warnTint, borderRadius: BorderRadius.circular(12)),
    child: Row(
      children: [
        const Icon(Icons.cloud_off_rounded, size: 16, color: warn),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            error,
            style: const TextStyle(fontSize: 12, color: warn, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );
}
