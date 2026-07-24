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
        return const _Phase(2, 'ລໍຖ້າຮັບງານລ້າງ', Icons.assignment_ind_outlined, _cOrange);
      case 2:
        return const _Phase(5, 'ລໍໄປລ້າງ', Icons.local_shipping_outlined, _cIndigo);
      case 3:
        return const _Phase(6, 'ກຳລັງລ້າງ', Icons.cleaning_services_outlined, teal);
      case 4:
        return const _Phase(7, 'ລໍຖ້າກວດ QC', Icons.verified_outlined, _cPurple);
      case 5:
        return const _Phase(8, 'ລໍເກັບເງິນ / ປິດງານ', Icons.payments_outlined, _cCyan);
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
        return const _Phase(1, 'ລໍຖ້າຮັບງານຕິດຕັ້ງ', Icons.assignment_ind_outlined, _cAmber);
      case 2:
      case 3:
        return const _Phase(4, 'ຂະບວນການເບີກອາໄຫຼ່', Icons.inventory_2_outlined, _cViolet);
      case 4:
        return const _Phase(5, 'ລໍຖ້າຕິດຕັ້ງ', Icons.build_circle_outlined, _cIndigo);
      case 5:
        return const _Phase(6, 'ກຳລັງຕິດຕັ້ງ', Icons.handyman_outlined, teal);
      case 6:
      case 7:
        return const _Phase(7, 'ລໍກວດ QC ຕິດຕັ້ງ', Icons.verified_outlined, _cPurple);
      case 8:
        return const _Phase(8, 'ລໍຖ້າປິດງານ', Icons.assignment_turned_in_outlined, _cCyan);
      case -1:
        return const _Phase(98, 'ຍົກເລີກແລ້ວ', Icons.cancel_outlined, danger);
      default:
        return const _Phase(99, 'ປິດງານແລ້ວ', Icons.check_circle_outline, muted);
    }
  }
  // ── ສ້ອມແປງ ──
  switch (s) {
    case 0:
      return const _Phase(0, 'ໄປຮັບເຄື່ອງ', Icons.local_shipping_outlined, _cAmber);
    case 1:
      return const _Phase(1, 'ລໍຖ້າກວດເຊັກ', Icons.pending_actions_outlined, _cOrange);
    case 2:
      return const _Phase(2, 'ກຳລັງກວດເຊັກ', Icons.fact_check_outlined, _cBlue);
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      return const _Phase(4, 'ຂະບວນການເບີກອາໄຫຼ່', Icons.inventory_2_outlined, _cViolet);
    case 8:
      return const _Phase(5, 'ລໍຖ້າສ້ອມແປງ', Icons.build_circle_outlined, _cIndigo);
    case 9:
      return const _Phase(6, 'ກຳລັງສ້ອມແປງ', Icons.handyman_outlined, teal);
    case 10:
      return const _Phase(7, 'ລໍກວດຮັບຄຸນນະພາບ', Icons.verified_outlined, _cPurple);
    case 11:
      return const _Phase(8, 'ລໍຖ້າສົ່ງຄືນ', Icons.assignment_turned_in_outlined, _cCyan);
    case 12:
      return const _Phase(99, 'ສົ່ງຄືນສຳເລັດ', Icons.check_circle_outline, muted);
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
  final List<Color> gradient;
  const _BandMeta(this.label, this.icon, this.gradient);
}

const _bandMeta = {
  _Band.check: _BandMeta('ກວດເຊັກ', Icons.fact_check_outlined, [
    Color(0xFFF59E0B),
    Color(0xFFEA580C),
  ]),
  _Band.repair: _BandMeta('ສ້ອມແປງ', Icons.handyman_outlined, [
    Color(0xFF059669),
    Color(0xFF0E7490),
  ]),
  _Band.install: _BandMeta('ຕິດຕັ້ງ', Icons.construction_outlined, [
    Color(0xFF6D4AFF),
    Color(0xFF9333EA),
  ]),
  _Band.maintenance: _BandMeta('ບຳລຸງຮັກສາ / ລ້າງແອ', Icons.cleaning_services_outlined, [
    Color(0xFF0284C7),
    Color(0xFF0891B2),
  ]),
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
  }

  Future<void> logout() async {
    await Push.unregister();
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
      out.add(_BandGroup(
        band,
        _groupPhases(list),
        list.length,
        list.where((j) => urgent.contains(j.action)).length,
      ));
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
            title: 'ວຽກຂອງຂ້ອຍ',
            trailing: [
              HeroIconButton(
                icon: Icons.notifications_none,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const NotificationsScreen()),
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
                      MaterialPageRoute(builder: (_) => const StockBalanceScreen()),
                    );
                  }
                  if (value == 'repair-stock') {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const RepairStockScreen()),
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
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white.withValues(alpha: .14)),
                  ),
                  child: const Icon(Icons.more_vert, size: 20, color: onHero),
                ),
              ),
            ],
            stats: [
              HeroStat(value: '${jobs.length}', label: 'ວຽກທັງໝົດ'),
              HeroStat(value: '$actionCount', label: 'ຕ້ອງລົງມື', color: const Color(0xFFFDBA74)),
              HeroStat(value: '$onsiteCount', label: 'ວຽກໜ້າງານ', color: const Color(0xFF6EE7B7)),
            ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: load,
                    child: CustomScrollView(
                      slivers: [
                        if (error.isNotEmpty)
                          SliverFillRemaining(
                            child: _Empty(
                              icon: Icons.cloud_off_rounded,
                              title: error,
                              action: load,
                            ),
                          ),
                        if (error.isEmpty && jobs.isEmpty)
                          SliverFillRemaining(
                            child: _Empty(
                              icon: Icons.task_alt_rounded,
                              title: 'ບໍ່ມີວຽກ',
                              action: load,
                            ),
                          ),
                        if (error.isEmpty && jobs.isNotEmpty)
                          for (final band in bands) ...[
                            SliverToBoxAdapter(
                              child: _BandBanner(
                                meta: _bandMeta[band.band]!,
                                total: band.total,
                                actionCount: band.actionCount,
                              ),
                            ),
                            for (final group in band.groups) ...[
                              SliverPersistentHeader(
                                pinned: true,
                                delegate: _PhaseHeader(
                                  phase: group.phase,
                                  count: group.jobs.length,
                                ),
                              ),
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(14, 4, 14, 6),
                                sliver: SliverList.separated(
                                  itemCount: group.jobs.length,
                                  separatorBuilder: (_, _) =>
                                      const SizedBox(height: 10),
                                  itemBuilder: (_, i) => _JobCard(
                                    job: group.jobs[i],
                                    accent: group.phase.color,
                                    onDone: load,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        const SliverToBoxAdapter(child: SizedBox(height: 14)),
                      ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// ຫົວ **ພາກໃຫຍ່** (ກວດເຊັກ / ສ້ອມແປງ / ຕິດຕັ້ງ) — ແຖບສີໄລ່ ເຫັນແຕ່ໄກວ່າປ່ຽນຫົວວຽກແລ້ວ
class _BandBanner extends StatelessWidget {
  const _BandBanner({
    required this.meta,
    required this.total,
    required this.actionCount,
  });
  final _BandMeta meta;
  final int total;
  final int actionCount;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 16, 14, 2),
    child: Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: meta.gradient,
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: meta.gradient.first.withValues(alpha: .28),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(meta.icon, size: 20, color: Colors.white),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  meta.label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -.2,
                  ),
                ),
                if (actionCount > 0)
                  Text(
                    'ຕ້ອງລົງມື $actionCount ໃບ',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: .85),
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .22),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$total',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13.5,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

/// ຫົວກຸ່ມໄລຍະ **ຕິດຄ້າງ** (pinned) — ຮູບໄອຄອນສີ + ຊື່ໄລຍະ + ຈຳນວນ.
/// ຕິດຄ້າງເທິງສຸດຂະນະເລື່ອນ ⇒ ຊ່າງຮູ້ສະເໝີວ່າກຳລັງເບິ່ງໄລຍະໃດ.
class _PhaseHeader extends SliverPersistentHeaderDelegate {
  const _PhaseHeader({required this.phase, required this.count});
  final _Phase phase;
  final int count;

  @override
  double get minExtent => 54;
  @override
  double get maxExtent => 54;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: ground,
      padding: const EdgeInsets.fromLTRB(14, 9, 14, 7),
      alignment: Alignment.centerLeft,
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: phase.color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(phase.icon, size: 18, color: phase.color),
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

/// ເສັ້ນປະ + ຮອຍບຸ້ມສອງຂ້າງ — ໃຫ້ບັດເບິ່ງຄື "ໃບງານ" ຈິງ (ຮອຍສີກໃບ)
class _Perforation extends StatelessWidget {
  const _Perforation();

  @override
  Widget build(BuildContext context) => Row(
    children: [
      // Transform ບໍ່ກິນເນື້ອທີ່ layout ⇒ ວົງມົນເຄິ່ງໜຶ່ງລົ້ນອອກນອກບັດແລ້ວຖືກ clip = ຮອຍບຸ້ມ
      Transform.translate(offset: const Offset(-7, 0), child: const _Notch()),
      const Expanded(child: _DashedLine()),
      Transform.translate(offset: const Offset(7, 0), child: const _Notch()),
    ],
  );
}

class _Notch extends StatelessWidget {
  const _Notch();
  @override
  Widget build(BuildContext context) => Container(
    width: 14,
    height: 14,
    decoration: const BoxDecoration(color: ground, shape: BoxShape.circle),
  );
}

class _DashedLine extends StatelessWidget {
  const _DashedLine();
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (_, size) {
      const dash = 5.0, gap = 4.0;
      final count = (size.maxWidth / (dash + gap)).floor().clamp(1, 200);
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(
          count,
          (_) => Container(width: dash, height: 1.1, color: const Color(0xFFDCE5E2)),
        ),
      );
    },
  );
}

/// ແຖວ ປ້າຍ/ຄ່າ ແບບໃບບິນ — ປ້າຍຊ້າຍຈາງ ຄ່າຂວາເນັ້ນ
class _TicketLine extends StatelessWidget {
  const _TicketLine({required this.label, required this.value, this.strong = false});
  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 62,
          child: Text(label, style: const TextStyle(fontSize: 10.5, color: faint)),
        ),
        Expanded(
          child: Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              height: 1.3,
              color: strong ? ink : muted,
              fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ],
    ),
  );
}

/// ບັດງານ **ແບບໃບງານ (ticket)** — ແຖບສີໄລຍະເທິງສຸດ · ເລກໃບເດັ່ນ · ເສັ້ນປະແບ່ງສ່ວນ
class _JobCard extends StatelessWidget {
  const _JobCard({required this.job, required this.accent, required this.onDone});
  final Job job;
  final Color accent;
  final Future<void> Function() onDone;

  @override
  Widget build(BuildContext context) {
    final install = job.workflow == 'install';
    final statusColor = actionColor[job.action] ?? muted;
    final who = [
      if (_hasText(job.customer)) job.customer!.trim(),
      if (_hasText(job.address)) job.address!.trim(),
    ].join(' · ');

    void open() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => JobScreen(job: job)),
    ).then((_) => onDone());

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDDE6E3)),
        boxShadow: const [
          BoxShadow(color: Color(0x0D0F172A), blurRadius: 14, offset: Offset(0, 5)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: open,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ແຖບສີໄລຍະ — ຜູກບັດກັບຫົວກຸ່ມ
              Container(height: 4, color: accent),

              // ── ຫົວໃບ: ເລກໃບ + ສະຖານະ ──
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 11, 14, 10),
                child: Row(
                  children: [
                    Text(
                      '#${job.code}',
                      style: const TextStyle(
                        color: ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -.3,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      job.workflow == 'maintenance'
                          ? 'ລ້າງແອ'
                          : install
                          ? 'ຕິດຕັ້ງ'
                          : 'ສ້ອມແປງ',
                      style: const TextStyle(
                        color: faint,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: .11),
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Text(
                        actionLabel[job.action] ?? '-',
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const _Perforation(),

              // ── ຕົວສິນຄ້າ ──
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
                child: Text(
                  job.product ?? '-',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: ink,
                    fontSize: 14.5,
                    height: 1.3,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),

              const _Perforation(),

              // ── ລາຍລະອຽດແບບໃບບິນ ──
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 11, 14, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (job.receivedAt != null)
                      _TicketLine(label: 'ຮັບເຄື່ອງ', value: job.receivedAt!),
                    if (job.totalLabel != null)
                      _TicketLine(
                        label: 'ໃຊ້ເວລາ',
                        value: job.totalLabel!,
                        strong: job.days > 7,
                      ),
                    if (job.receivedAt == null)
                      _TicketLine(label: 'ຄ້າງມາ', value: '${job.days} ມື້'),
                    if (who.isNotEmpty) _TicketLine(label: 'ລູກຄ້າ', value: who),
                    if (job.appointment != null)
                      _TicketLine(label: 'ວັນນັດ', value: job.appointment!),
                  ],
                ),
              ),

              // ── ທ້າຍໃບ ──
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 12, 11),
                child: Row(
                  children: [
                    if (job.checkedIn)
                      const _Mini(
                        icon: Icons.location_on,
                        text: 'ຢູ່ໜ້າງານ',
                        color: ok,
                      ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: .10),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Row(
                        children: [
                          Text(
                            'ເບິ່ງວຽກ',
                            style: TextStyle(
                              color: accent,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(width: 3),
                          Icon(Icons.arrow_forward_rounded, color: accent, size: 14),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini({required this.icon, required this.text, required this.color});
  final IconData icon;
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 10),
    child: Row(
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 3),
        Text(
          text,
          style: TextStyle(
            fontSize: 10,
            color: color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
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
