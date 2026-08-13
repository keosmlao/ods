import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import 'repair_stock_screen.dart';
import 'stock_balance_screen.dart';
import '../main.dart';
import '../push.dart';
import '../widgets/ui_kit.dart';
import 'notifications_screen.dart';
import 'job_screen.dart';
import 'login_screen.dart';

const actionLabel = {
  'accept': 'ຕ້ອງຮັບງານ',
  'start': 'ພ້ອມເລີ່ມ',
  'finish': 'ກຳລັງເຮັດ',
  'wait_spare': 'ລໍອາໄຫຼ່',
  'wait_other': 'ລໍຂັ້ນຕອນອື່ນ',
};
const actionColor = {
  'accept': danger,
  'start': teal,
  'finish': ok,
  'wait_spare': Color(0xFFD97706),
  'wait_other': Color(0xFF64748B),
};

/// ໄລຍະວຽກຂອງຊ່າງ — ຈັດຫຼາຍໆຂັ້ນ (0-12) ໃຫ້ເປັນ **ໜ້ອຍໆ ອ່ານງ່າຍ** ຕາມທີ່ຊ່າງຄິດ:
/// ໄປຮັບເຄື່ອງ · ລໍຖ້າກວດເຊັກ · ກຳລັງກວດເຊັກ · ຂະບວນການເບີກອາໄຫຼ່ · ລໍຖ້າສ້ອມ · ກຳລັງສ້ອມ …
/// (ຂັ້ນ 3-7 ຂອງສ້ອມ = ສະເໜີລາຄາ/ເບີກ/ສັ່ງຊື້ ⇒ ຮວມເປັນ "ຂະບວນການເບີກອາໄຫຼ່" ດຽວ)
class _Phase {
  final int order;
  final String label;
  final IconData icon;
  final Color color;
  const _Phase(this.order, this.label, this.icon, this.color);
}

const _cAmber = Color(0xFFD97706);
const _cOrange = Color(0xFFEA580C);
const _cBlue = Color(0xFF2563EB);
const _cViolet = Color(0xFF7C3AED);
const _cIndigo = Color(0xFF4F46E5);
const _cPurple = Color(0xFF9333EA);
const _cCyan = Color(0xFF0891B2);

_Phase _phaseOf(Job job) {
  final s = job.stage;
  if (job.workflow == 'maintenance') {
    switch (s) {
      case 0:
        return const _Phase(1, 'ລໍນັດ+ຈັດຊ່າງ', Icons.event_outlined, _cAmber);
      case 1:
        return const _Phase(
          2,
          'ລໍຖ້າຮັບງານລ້າງ',
          Icons.assignment_ind_outlined,
          _cOrange,
        );
      case 2:
        return const _Phase(
          5,
          'ລໍໄປລ້າງ',
          Icons.local_shipping_outlined,
          _cIndigo,
        );
      case 3:
        return const _Phase(
          6,
          'ກຳລັງລ້າງ',
          Icons.cleaning_services_outlined,
          teal,
        );
      case 4:
        return const _Phase(
          7,
          'ລໍຖ້າກວດ QC',
          Icons.verified_outlined,
          _cPurple,
        );
      case 5:
        return const _Phase(
          8,
          'ລໍເກັບເງິນ / ປິດງານ',
          Icons.payments_outlined,
          _cCyan,
        );
      case -1:
        return const _Phase(98, 'ຍົກເລີກແລ້ວ', Icons.cancel_outlined, danger);
      default:
        return const _Phase(99, 'ສຳເລັດ', Icons.check_circle_outline, muted);
    }
  }
  if (job.workflow == 'install') {
    switch (s) {
      case 0:
      case 1:
        return const _Phase(
          1,
          'ລໍຖ້າຮັບງານຕິດຕັ້ງ',
          Icons.assignment_ind_outlined,
          _cAmber,
        );
      case 2:
      case 3:
        return const _Phase(
          4,
          'ຂະບວນການເບີກອາໄຫຼ່',
          Icons.inventory_2_outlined,
          _cViolet,
        );
      case 4:
        return const _Phase(
          5,
          'ລໍຖ້າຕິດຕັ້ງ',
          Icons.build_circle_outlined,
          _cIndigo,
        );
      case 5:
        return const _Phase(6, 'ກຳລັງຕິດຕັ້ງ', Icons.handyman_outlined, teal);
      case 6:
      case 7:
        return const _Phase(
          7,
          'ລໍກວດ QC ຕິດຕັ້ງ',
          Icons.verified_outlined,
          _cPurple,
        );
      case 8:
        return const _Phase(
          8,
          'ລໍຖ້າປິດງານ',
          Icons.assignment_turned_in_outlined,
          _cCyan,
        );
      case -1:
        return const _Phase(98, 'ຍົກເລີກແລ້ວ', Icons.cancel_outlined, danger);
      default:
        return const _Phase(
          99,
          'ປິດງານແລ້ວ',
          Icons.check_circle_outline,
          muted,
        );
    }
  }
  // ── ສ້ອມແປງ ──
  // IH = ໄປສ້ອມບ້ານລູກຄ້າ (ເຄື່ອງຢູ່ບ້ານ ບໍ່ໄດ້ຢູ່ສູນ) ⇒ ຂັ້ນ 0/11/12 ຄຳຕ່າງຈາກ PS/ທົ່ວໄປ
  // (ບ່ອນດຽວກັບ IH_STAGE_LABEL ຝັ່ງເວັບ). ຂັ້ນ 0 ບໍ່ແມ່ນ "ໄປຮັບເຄື່ອງ" ແຕ່ແມ່ນ "ລໍນັດ/ຈັດຊ່າງ".
  final ih = job.serviceType == 'IH';
  switch (s) {
    case 0:
      return ih
          ? const _Phase(
              0,
              'ລໍນັດ / ຈັດຊ່າງໄປສ້ອມ',
              Icons.event_outlined,
              _cAmber,
            )
          : const _Phase(
              0,
              'ໄປຮັບເຄື່ອງ',
              Icons.local_shipping_outlined,
              _cAmber,
            );
    case 1:
      return const _Phase(
        1,
        'ລໍຖ້າກວດເຊັກ',
        Icons.pending_actions_outlined,
        _cOrange,
      );
    case 2:
      return const _Phase(2, 'ກຳລັງກວດເຊັກ', Icons.fact_check_outlined, _cBlue);
    // ── ຂັ້ນ 3-4 = **ສະເໜີລາຄາ** ບໍ່ແມ່ນອາໄຫຼ່ (ແກ້ 06-08-2026) ──
    // ເມື່ອກ່ອນເອົາ 3-7 ລວມເປັນ "ຂະບວນການເບີກອາໄຫຼ່" ⇒ ວຽກທີ່ລໍ/ກຳລັງສະເໜີລາຄາ
    // ຂຶ້ນວ່າກຳລັງເບີກອາໄຫຼ່ ທັງທີ່ຍັງບໍ່ໄດ້ຂໍເບີກຈັກແຖວ (ຜິດຈາກເວັບ — lib/stage).
    case 3:
      return const _Phase(3, 'ລໍຖ້າສະເໜີລາຄາ', Icons.request_quote_outlined, _cViolet);
    case 4:
      return const _Phase(3, 'ກຳລັງສະເໜີລາຄາ', Icons.request_quote_outlined, _cViolet);
    // 5-7 (ກວດ Stock · ກຳລັງເບີກ · ກຳລັງສັ່ງຊື້) = ຂັ້ນອາໄຫຼ່ — ລວມເປັນກ້ອນດຽວ
    // ຄືກັບເມນູເວັບ ("ອາໄຫຼ່ — ຂໍເບີກ · ສາງເບີກ · ຮັບ · ສັ່ງຊື້" ໃນ lib/navigation)
    case 5:
    case 6:
    case 7:
      return const _Phase(
        4,
        'ຂະບວນການເບີກອາໄຫຼ່',
        Icons.inventory_2_outlined,
        _cViolet,
      );
    case 8:
      return const _Phase(
        5,
        'ລໍຖ້າສ້ອມແປງ',
        Icons.build_circle_outlined,
        _cIndigo,
      );
    case 9:
      return const _Phase(6, 'ກຳລັງສ້ອມແປງ', Icons.handyman_outlined, teal);
    case 10:
      return const _Phase(
        7,
        'ລໍກວດຮັບຄຸນນະພາບ',
        Icons.verified_outlined,
        _cPurple,
      );
    case 11:
      return ih
          ? const _Phase(
              8,
              'ລໍປິດງານ',
              Icons.assignment_turned_in_outlined,
              _cCyan,
            )
          : const _Phase(
              8,
              'ລໍຖ້າສົ່ງຄືນ',
              Icons.assignment_turned_in_outlined,
              _cCyan,
            );
    case 12:
      return ih
          ? const _Phase(
              99,
              'ຈົບງານ (ໜ້າງານ)',
              Icons.check_circle_outline,
              muted,
            )
          : const _Phase(
              99,
              'ສົ່ງຄືນສຳເລັດ',
              Icons.check_circle_outline,
              muted,
            );
    case -1:
      return const _Phase(98, 'ຍົກເລີກ', Icons.cancel_outlined, danger);
    default:
      return _Phase(90, job.stageLabel, Icons.circle_outlined, muted);
  }
}

class _Group {
  final _Phase phase;
  final List<Job> jobs;
  const _Group(this.phase, this.jobs);
}

/* ── ພາກໃຫຍ່: ກວດເຊັກ · ສ້ອມແປງ · ຕິດຕັ້ງ ────────────────────────
   ວຽກ "ກວດເຊັກ" ກັບ "ສ້ອມແປງ" ເປັນຄົນລະຫົວວຽກ ⇒ ແຍກເປັນພາກ ບໍ່ໃຫ້ປົນກັນ.
   ງານຕິດຕັ້ງເປັນອີກສາຍງານໜຶ່ງ (ບໍ່ມີຂັ້ນກວດເຊັກ) ຈຶ່ງແຍກພາກຂອງມັນເອງ. */
enum _Band { check, repair, install, maintenance }

class _BandMeta {
  final String label;
  final IconData icon;
  const _BandMeta(this.label, this.icon);
}

/// ປ້າຍສັ້ນສຳລັບ **tab** (ບ່ອນແຄບ) — ບຳລຸງຮັກສາ / ລ້າງແອ ຍາວເກີນ ⇒ ໃຊ້ "ລ້າງແອ"
const _bandTabLabel = {
  _Band.check: 'ກວດເຊັກ',
  _Band.repair: 'ສ້ອມແປງ',
  _Band.install: 'ຕິດຕັ້ງ',
  _Band.maintenance: 'ລ້າງແອ',
};

const _bandMeta = {
  _Band.check: _BandMeta('ກວດເຊັກ', Icons.fact_check_outlined),
  _Band.repair: _BandMeta('ສ້ອມແປງ', Icons.handyman_outlined),
  _Band.install: _BandMeta('ຕິດຕັ້ງ', Icons.construction_outlined),
  _Band.maintenance: _BandMeta(
    'ບຳລຸງຮັກສາ / ລ້າງແອ',
    Icons.cleaning_services_outlined,
  ),
};

/// ຂັ້ນ 0-2 (ໄປຮັບເຄື່ອງ · ລໍຖ້າກວດ · ກຳລັງກວດ) = ກວດເຊັກ · ທີ່ເຫຼືອ = ສ້ອມແປງ
_Band _bandOf(Job job) {
  if (job.workflow == 'maintenance') return _Band.maintenance;
  if (job.workflow == 'install') return _Band.install;
  final s = job.stage;
  return (s >= 0 && s <= 2) ? _Band.check : _Band.repair;
}

class _BandGroup {
  final _Band band;
  final List<_Group> groups;
  final int total;
  final int actionCount;
  const _BandGroup(this.band, this.groups, this.total, this.actionCount);
}

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});
  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<Job> jobs = [];
  bool loading = true;
  String error = '';
  String username = ''; // ຊື່ຜູ້ໃຊ້ — ໃຫ້ hero ທັກທາຍ

  Future<void> load() async {
    try {
      final rows = await Api.jobs();
      if (!mounted) return;
      setState(() {
        jobs = rows;
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

  @override
  void initState() {
    super.initState();
    load();
    Api.savedUsername().then((name) {
      if (mounted && name != null) setState(() => username = name);
    });
  }

  Future<void> logout() async {
    // ຖອນ push token = ຍິງ FCM/server (ຊ້າ/ອາດ timeout) ⇒ ຢ່າ block logout ດ້ວຍມັນ.
    // ລ້າງ token ໃນເຄື່ອງ (ໄວ) ແລ້ວໄປໜ້າ login ທັນທີ; unregister ແລ່ນพื้นหลัง.
    unawaited(Push.unregister());
    await Api.clearToken();
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  /// ຈັດກຸ່ມຕາມໄລຍະ (phase) — ໃນກຸ່ມຮຽງ action ດ່ວນກ່ອນ · ກຸ່ມຮຽງຕາມລຳດັບ flow
  List<_Group> _groupPhases(List<Job> list) {
    final byLabel = <String, List<Job>>{};
    final phaseOf = <String, _Phase>{};
    for (final j in list) {
      final p = _phaseOf(j);
      (byLabel[p.label] ??= []).add(j);
      phaseOf[p.label] = p;
    }
    const priority = {'accept': 0, 'start': 1, 'finish': 2, 'wait_spare': 3};
    final groups = byLabel.entries.map((e) {
      e.value.sort(
        (a, b) => (priority[a.action] ?? 4).compareTo(priority[b.action] ?? 4),
      );
      return _Group(phaseOf[e.key]!, e.value);
    }).toList();
    groups.sort((a, b) {
      final c = a.phase.order.compareTo(b.phase.order);
      return c != 0 ? c : a.phase.label.compareTo(b.phase.label);
    });
    return groups;
  }

  /// ແບ່ງເປັນພາກໃຫຍ່ກ່ອນ (ກວດເຊັກ / ສ້ອມແປງ / ຕິດຕັ້ງ) ແລ້ວຈຶ່ງແບ່ງໄລຍະພາຍໃນ.
  /// ພາກທີ່ບໍ່ມີວຽກ ບໍ່ສະແດງ (ບໍ່ໃຫ້ຫົວຫວ່າງລອຍ)
  List<_BandGroup> get bands {
    final byBand = <_Band, List<Job>>{};
    for (final j in jobs) {
      (byBand[_bandOf(j)] ??= []).add(j);
    }
    const urgent = {'accept', 'start', 'finish'};
    final out = <_BandGroup>[];
    for (final band in [
      _Band.check,
      _Band.repair,
      _Band.install,
      _Band.maintenance,
    ]) {
      final list = byBand[band];
      if (list == null || list.isEmpty) continue;
      out.add(
        _BandGroup(
          band,
          _groupPhases(list),
          list.length,
          list.where((j) => urgent.contains(j.action)).length,
        ),
      );
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final actionCount = jobs
        .where((j) => ['accept', 'start', 'finish'].contains(j.action))
        .length;
    final onsiteCount = jobs.where((j) => j.onsite).length;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            // ທັກທາຍດ້ວຍຊື່ຜູ້ໃຊ້ (ຫວ່າງ = ຍັງໂຫຼດບໍ່ທັນ ⇒ ໃຊ້ eyebrow ຕັ້ງຕົ້ນ)
            eyebrow: username.isNotEmpty
                ? 'ສະບາຍດີ, $username'
                : 'ODIEN SERVICE',
            title: 'ວຽກຂອງຂ້ອຍ',
            trailing: [
              HeroIconButton(
                icon: Icons.notifications_none,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const NotificationsScreen(),
                  ),
                ),
              ),
              HeroIconButton(icon: Icons.refresh_rounded, onTap: load),
              PopupMenuButton<String>(
                tooltip: 'ເມນູ',
                onSelected: (value) {
                  if (value == 'logout') logout();
                  if (value == 'stock-balance') {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const StockBalanceScreen(),
                      ),
                    );
                  }
                  if (value == 'repair-stock') {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const RepairStockScreen(),
                      ),
                    );
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(
                    value: 'stock-balance',
                    child: Row(
                      children: [
                        Icon(Icons.inventory_2_outlined, size: 19),
                        SizedBox(width: 10),
                        Text('ສິນຄ້າຄົງເຫຼືອ'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'repair-stock',
                    child: Row(
                      children: [
                        Icon(Icons.warehouse_outlined, size: 19),
                        SizedBox(width: 10),
                        Text('ຄົງເຫຼືອ ສາງສ້ອມ'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'logout',
                    child: Row(
                      children: [
                        Icon(Icons.logout_rounded, size: 19),
                        SizedBox(width: 10),
                        Text('ອອກຈາກລະບົບ'),
                      ],
                    ),
                  ),
                ],
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: hero2,
                    borderRadius: BorderRadius.circular(kButtonRadius),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: const Icon(Icons.more_vert, size: 21, color: onHero),
                ),
              ),
            ],
            stats: [
              HeroStat(value: '${jobs.length}', label: 'ວຽກທັງໝົດ'),
              HeroStat(
                value: '$actionCount',
                label: 'ຕ້ອງລົງມື',
                color: const Color(0xFFFDBA74),
              ),
              HeroStat(
                value: '$onsiteCount',
                label: 'ວຽກໜ້າງານ',
                color: const Color(0xFF6EE7B7),
              ),
            ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? _Empty(
                    icon: Icons.cloud_off_rounded,
                    title: error,
                    action: load,
                  )
                : jobs.isEmpty
                ? _Empty(
                    icon: Icons.task_alt_rounded,
                    title: 'ບໍ່ມີວຽກ',
                    action: load,
                  )
                : _tabbedBands(),
          ),
        ],
      ),
    );
  }

  /// ── ແຍກ tab ຕໍ່ພາກໃຫຍ່ (ກວດເຊັກ · ສ້ອມແປງ · ຕິດຕັ້ງ · ລ້າງແອ) ──
  /// ວຽກກວດເຊັກ ກັບ ສ້ອມແປງ ເປັນຄົນລະຫົວ ⇒ ຢູ່ຄົນລະ tab ບໍ່ໃຫ້ເລື່ອນປົນກັນ.
  /// tab ມີສະເພາະພາກທີ່ມີວຽກ (key ຕາມຊຸດພາກ ⇒ ສ້າງ controller ໃໝ່ເມື່ອພາກປ່ຽນ).
  Widget _tabbedBands() {
    final bs = bands;
    return DefaultTabController(
      key: ValueKey(bs.map((b) => b.band.name).join(',')),
      length: bs.length,
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: surfaceAlt,
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: line),
            ),
            child: TabBar(
              isScrollable: bs.length > 2,
              tabAlignment: bs.length > 2
                  ? TabAlignment.start
                  : TabAlignment.fill,
              labelColor: ink,
              unselectedLabelColor: muted,
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              // v4: flat — ຂອບແທນເງົາ
              indicator: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: lineStrong),
              ),
              labelStyle: const TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
              tabs: [for (final b in bs) _bandTab(b)],
            ),
          ),
          Expanded(
            child: TabBarView(children: [for (final b in bs) _bandView(b)]),
          ),
        ],
      ),
    );
  }

  /// ຫົວ tab — ໄອຄອນ + ຊື່ພາກ + ຈຳນວນ (ແດງ = ມີວຽກຕ້ອງລົງມື)
  Widget _bandTab(_BandGroup band) {
    final meta = _bandMeta[band.band]!;
    final urgent = band.actionCount > 0;
    return Tab(
      height: 43,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(meta.icon, size: 15),
          const SizedBox(width: 5),
          Text(_bandTabLabel[band.band] ?? meta.label),
          const SizedBox(width: 5),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: urgent
                  ? danger.withValues(alpha: .12)
                  : const Color(0xFF64748B).withValues(alpha: .12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '${band.total}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: urgent ? danger : const Color(0xFF64748B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// ເນື້ອໃນ tab ໜຶ່ງພາກ — ຈັດໄລຍະ (phase) + ບັດງານ (ບໍ່ຕ້ອງມີ banner ຊ້ຳຊື່ພາກ)
  Widget _bandView(_BandGroup band) {
    return RefreshIndicator(
      onRefresh: load,
      child: CustomScrollView(
        slivers: [
          for (final group in band.groups) ...[
            SliverPersistentHeader(
              pinned: true,
              delegate: _PhaseHeader(
                phase: group.phase,
                count: group.jobs.length,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 5, 14, 10),
              sliver: SliverList.separated(
                itemCount: group.jobs.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (_, i) => _JobCard(
                  job: group.jobs[i],
                  accent: group.phase.color,
                  onDone: load,
                ),
              ),
            ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: 14)),
        ],
      ),
    );
  }
}

/// ຫົວກຸ່ມໄລຍະ **ຕິດຄ້າງ** (pinned) — ຮູບໄອຄອນສີ + ຊື່ໄລຍະ + ຈຳນວນ.
/// ຕິດຄ້າງເທິງສຸດຂະນະເລື່ອນ ⇒ ຊ່າງຮູ້ສະເໝີວ່າກຳລັງເບິ່ງໄລຍະໃດ.
class _PhaseHeader extends SliverPersistentHeaderDelegate {
  const _PhaseHeader({required this.phase, required this.count});
  final _Phase phase;
  final int count;

  @override
  double get minExtent => 58;
  @override
  double get maxExtent => 58;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      color: ground,
      padding: const EdgeInsets.fromLTRB(14, 11, 14, 7),
      alignment: Alignment.centerLeft,
      child: Row(
        children: [
          Container(
            width: 35,
            height: 35,
            decoration: BoxDecoration(
              color: phase.color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(phase.icon, size: 19, color: phase.color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              phase.label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: ink,
                letterSpacing: -.2,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: phase.color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$count',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w900,
                color: phase.color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_PhaseHeader old) =>
      old.count != count || old.phase.label != phase.label;
}

/// ມີເນື້ອຫາແທ້ບໍ — ຂໍ້ມູນຈິງມີຄ່າ "." / "-" ທີ່ບໍ່ໄດ້ບອກຫຍັງ ຢ່າເອົາມາກິນເນື້ອທີ່
bool _hasText(String? value) {
  final text = (value ?? '').trim();
  return text.isNotEmpty && text != '.' && text != '-';
}

/// ບັດງານ **ແບບໃບງານ (ticket)** — ແຖບສີໄລຍະເທິງສຸດ · ເລກໃບເດັ່ນ · ເສັ້ນປະແບ່ງສ່ວນ
/// ປະເພດບໍລິການສ້ອມ (CI/ST/IH/PS) — ປ້າຍເດັ່ນໆໃນบัตร (ໃຫ້ຮູ້ທັນທີວ່າໄປໜ້າງານ/ຢູ່ສູນ).
({String label, IconData icon, Color color})? _serviceKind(Job job) {
  if (job.workflow == 'install') {
    return (
      label: 'ຕິດຕັ້ງ',
      icon: Icons.construction_outlined,
      color: Color(0xFF7C3AED),
    );
  }
  if (job.workflow == 'maintenance') {
    return (
      label: 'ລ້າງແອ',
      icon: Icons.cleaning_services_outlined,
      color: Color(0xFF0284C7),
    );
  }
  switch (job.serviceType) {
    case 'IH':
      return (
        label: 'ໄປສ້ອມບ້ານ',
        icon: Icons.home_outlined,
        color: Color(0xFFB45309),
      );
    case 'PS':
      return (
        label: 'ໄປຮັບ-ສ້ອມສູນ',
        icon: Icons.local_shipping_outlined,
        color: Color(0xFF4F46E5),
      );
    case 'CI':
      return (
        label: 'ນຳເຂົ້າສູນ',
        icon: Icons.store_mall_directory_outlined,
        color: Color(0xFF0891B2),
      );
    case 'ST':
      return (
        label: 'ສ້ອມໜ້າງານ',
        icon: Icons.build_outlined,
        color: Color(0xFF0D9488),
      );
    default:
      return (
        label: 'ສ້ອມແປງ',
        icon: Icons.handyman_outlined,
        color: Color(0xFF0D9488),
      );
  }
}

class _JobCard extends StatelessWidget {
  const _JobCard({
    required this.job,
    required this.accent,
    required this.onDone,
  });
  final Job job;
  final Color accent;
  final Future<void> Function() onDone;

  @override
  Widget build(BuildContext context) {
    final kind = _serviceKind(job);
    final statusColor = actionColor[job.action] ?? muted;
    final who = [
      if (_hasText(job.customer)) job.customer!.trim(),
      if (_hasText(job.address)) job.address!.trim(),
    ].join(' · ');
    void open() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => JobScreen(job: job)),
    ).then((_) => onDone());

    return RepaintBoundary(
      child: Container(
        clipBehavior: Clip.antiAlias,
        // v4: flat — ບໍ່ມີເງົາ (list ຍາວ render ໄວຂຶ້ນເທິງເຄື່ອງເກົ່າ)
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(kCardRadius),
          border: Border.all(color: line),
        ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: open,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ແຖບສີໄລຍະ ດ້ານຊ້າຍ (ຜູກບັດກັບໄລຍະ) — ບາງ ບໍ່ກິນເນື້ອທີ່
                Container(width: 5, color: accent),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(13, 12, 11, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // ── ຫົວ: ເລກ + ປະເພດ + ສະຖານະ ──
                        Row(
                          children: [
                            Text(
                              '#${job.code}',
                              style: const TextStyle(
                                color: ink,
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -.3,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (kind != null)
                              Flexible(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: kind.color.withValues(alpha: .12),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        kind.icon,
                                        size: 12,
                                        color: kind.color,
                                      ),
                                      const SizedBox(width: 3),
                                      Flexible(
                                        child: Text(
                                          kind.label,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: kind.color,
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            const SizedBox(width: 6),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: .1),
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: Text(
                                actionLabel[job.action] ?? '-',
                                style: TextStyle(
                                  color: statusColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 9),
                        // ── ຊື່ສິນຄ້າ (1 ແຖວ) ──
                        Text(
                          job.product ?? '-',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (who.isNotEmpty) ...[
                          const SizedBox(height: 5),
                          Row(
                            children: [
                              const Icon(
                                Icons.person_outline_rounded,
                                size: 14,
                                color: faint,
                              ),
                              const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  who,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: muted,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 8),
                        const Divider(height: 1),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            if (job.checkedIn) ...[
                              const Icon(
                                Icons.location_on,
                                size: 12,
                                color: ok,
                              ),
                              const SizedBox(width: 3),
                            ],
                            /*
                              ── ໃບທີ່ຕ້ອງກັບໄປອີກຮອບ (12-08-2026) ──
                              ຊ່າງບໍ່ສົນວ່າ "ຄ້າງ 48 ມື້" (ຕົວເລກຂອງຫົວໜ້າ) — ລາວສົນວ່າ
                              ໃບນີ້ເຄີຍໄປແລ້ວບໍ ແລະ ນັດວັນໃດ. ຮອບ > 0 ⇒ ຂຶ້ນປ້າຍນຳໜ້າ.
                            */
                            if (job.visitRounds > 0) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: tealTint,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  // ຍັງ check-in ຄ້າງ = ກຳລັງເຮັດຮອບນັ້ນຢູ່ ⇒ ບໍ່ບວກເພີ່ມ
                                  'ຮອບທີ ${job.checkedIn ? job.visitRounds : job.visitRounds + 1}',
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w900,
                                    color: teal,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                            ],
                            Expanded(
                              child: Text(
                                [
                                  job.totalLabel != null
                                      ? 'ໃຊ້ເວລາ ${job.totalLabel}'
                                      : 'ຄ້າງ ${job.days} ມື້',
                                  if (job.appointment != null)
                                    'ນັດ ${job.appointment}',
                                ].join('  ·  '),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: muted,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              width: 27,
                              height: 27,
                              decoration: BoxDecoration(
                                color: accent.withValues(alpha: .09),
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: Icon(
                                Icons.arrow_forward_rounded,
                                color: accent,
                                size: 15,
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
        ),
      ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.action});
  final IconData icon;
  final String title;
  final Future<void> Function() action;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 54, color: const Color(0xFFCBD5E1)),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: action,
            icon: const Icon(Icons.refresh),
            label: const Text('ລອງໃໝ່'),
          ),
        ],
      ),
    ),
  );
}
