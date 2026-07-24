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

  /// ຈັດກຸ່ມงานตามไลยะ (phase) — ในกลุ่มเรียง action เร่งด่วนก่อน · กลุ่มเรียงตามลำดับ flow
  List<_Group> get grouped {
    final byLabel = <String, List<Job>>{};
    final phaseOf = <String, _Phase>{};
    for (final j in jobs) {
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
                          for (final group in grouped) ...[
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

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job, required this.accent, required this.onDone});
  final Job job;
  final Color accent;
  final Future<void> Function() onDone;

  @override
  Widget build(BuildContext context) {
    final install = job.workflow == 'install';
    final typeColor = install ? const Color(0xFF6D4AFF) : teal;
    final statusColor = actionColor[job.action] ?? muted;

    void open() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => JobScreen(job: job)),
    ).then((_) => onDone());

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFDDE6E3)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D0F172A),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: open,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── ແຖບສີໄລຍະ (ຜູກກາດກັບຫົວກຸ່ມ ⇒ ກວາດຕາອ່ານໄວ) ──
                Container(width: 5, color: accent),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 14, 15, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: typeColor.withValues(alpha: .10),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    install
                                        ? Icons.handyman_outlined
                                        : Icons.build_outlined,
                                    size: 14,
                                    color: typeColor,
                                  ),
                                  const SizedBox(width: 5),
                                  Text(
                                    install ? 'ຕິດຕັ້ງ' : 'ສ້ອມແປງ',
                                    style: TextStyle(
                                      color: typeColor,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                job.code,
                                style: const TextStyle(
                                  color: ink,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: .10),
                                borderRadius: BorderRadius.circular(99),
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
                        const SizedBox(height: 13),
                        Text(
                          job.product ?? '-',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: ink,
                            fontSize: 16,
                            height: 1.25,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          job.stageLabel,
                          style: const TextStyle(color: muted, fontSize: 11),
                        ),
                        // ຮັບເຄື່ອງເມື່ອໃດ + ໃຊ້ເວລາລວມມາເທົ່າໃດ (ອາຍຸງານທັງໝົດ)
                        if (job.receivedAt != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            'ຮັບເຄື່ອງ ${job.receivedAt}'
                            '${job.totalLabel != null ? ' · ໃຊ້ເວລາ ${job.totalLabel}' : ''}',
                            style: const TextStyle(color: faint, fontSize: 10.5),
                          ),
                        ],
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(11),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF6F8F7),
                            borderRadius: BorderRadius.circular(13),
                          ),
                          child: Column(
                            children: [
                              _InfoLine(
                                icon: Icons.person_outline_rounded,
                                text: job.customer ?? '-',
                              ),
                              if ((job.address ?? '').isNotEmpty) ...[
                                const SizedBox(height: 6),
                                _InfoLine(
                                  icon: Icons.location_on_outlined,
                                  text: job.address!,
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            if (job.checkedIn)
                              const _Mini(
                                icon: Icons.location_on,
                                text: 'ຢູ່ໜ້າງານ',
                                color: ok,
                              ),
                            if (job.appointment != null)
                              _Mini(
                                icon: Icons.event_outlined,
                                text: job.appointment!,
                                color: teal,
                              ),
                            if (!job.checkedIn && job.appointment == null)
                              Text(
                                'ຄ້າງ ${job.days} ມື້',
                                style: TextStyle(
                                  color: job.days > 7 ? danger : muted,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            const Spacer(),
                            InkWell(
                              onTap: open,
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 11,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDDF4EE),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Row(
                                  children: [
                                    Text(
                                      'ເບິ່ງວຽກ',
                                      style: TextStyle(
                                        color: teal,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    SizedBox(width: 3),
                                    Icon(
                                      Icons.arrow_forward_rounded,
                                      color: teal,
                                      size: 14,
                                    ),
                                  ],
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
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 16, color: muted),
      const SizedBox(width: 7),
      Expanded(
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Color(0xFF475569), fontSize: 11),
        ),
      ),
    ],
  );
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
