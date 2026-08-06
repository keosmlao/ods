import 'dart:async';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../api.dart';
import '../main.dart';
import '../push.dart';
import 'activities_screen.dart';
import 'approvals_screen.dart';
import 'commission_screen.dart';
import 'login_screen.dart';
import 'pending_map_screen.dart';
import 'repair_stock_screen.dart';
import 'notifications_screen.dart';
import 'manager_kit.dart';
import 'overview_jobs_screen.dart';

/// ໜ້າຫຼັກຜູ້ຈັດການ — ອອກແບບໃໝ່ແບບທັນສະໄໝ ດ້ວຍການໃຊ້ສີ ແລະ ການຈັດວາງທີ່ດີຂຶ້ນ
class ManagerScreen extends StatefulWidget {
  const ManagerScreen({super.key});

  @override
  State<ManagerScreen> createState() => _ManagerScreenState();
}

class _ManagerScreenState extends State<ManagerScreen>
    with SingleTickerProviderStateMixin {
  Overview? data;
  bool loading = true;
  String error = '';
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOut,
    );
    load();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = await Api.overview();
      if (!mounted) return;
      setState(() {
        data = result;
        error = '';
        loading = false;
      });
      _animationController.forward(from: 0.0);
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

  Future<void> logout() async {
    unawaited(Push.unregister());
    await Api.clearToken();
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          _ModernHeader(
            title: 'ສະບາຍດີ, ຜູ້ຈັດການ',
            subtitle: 'ພາບລວມສະຖານະການບໍລິຫານ',
            onRefresh: load,
            onLogout: logout,
            onNotifications: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
          Expanded(
            child: loading
                ? _LoadingShimmer()
                : error.isNotEmpty
                ? _ErrorView(message: error, onRetry: load)
                : LayoutBuilder(
                    builder: (context, constraints) => RefreshIndicator(
                      color: teal,
                      onRefresh: load,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(
                          constraints.maxWidth >= 720 ? 24 : 14,
                          16,
                          constraints.maxWidth >= 720 ? 24 : 14,
                          32,
                        ),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 760),
                            child: FadeTransition(
                              opacity: _fadeAnimation,
                              child: Column(children: _sections(data!)),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  void _open(String bucket, String title) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OverviewJobsScreen(bucket: bucket, title: title),
      ),
    );
  }

  /// ສ້າງລາຍການສ່ວນຕ່າງໆ ດ້ວຍການຈັດກຸ່ມທີ່ດີຂຶ້ນ
  List<Widget> _sections(Overview d) {
    void toApprovals() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ApprovalsScreen()),
    );

    /// 🚨 ສ່ວນທີ່ຕ້ອງການການຕັດສິນ (Alerts & Actions)
    final alerts = [
      _AlertItem(
        icon: Icons.pending_actions_rounded,
        label: 'ໃບສະເໜີລາຄາລໍອະນຸມັດ',
        count: d.aQuotes,
        color: danger,
        onTap: toApprovals,
      ),
      _AlertItem(
        icon: Icons.cancel_outlined,
        label: 'ຮ້ອງຂໍຍົກເລີກງານ',
        count: d.aCancels,
        color: danger,
        onTap: toApprovals,
      ),
      _AlertItem(
        icon: Icons.shopping_cart_outlined,
        label: 'ໃບຂໍຊື້ລໍອະນຸມັດ',
        count: d.aPurchases,
        color: const Color(0xFFD97706),
        onTap: toApprovals,
      ),
      _AlertItem(
        icon: Icons.people_outline,
        label: 'ລໍລູກຄ້າຕົກລົງລາຄາ',
        count: d.aCustomer,
        color: const Color(0xFFD97706),
        onTap: toApprovals,
      ),
      _AlertItem(
        icon: Icons.person_off_outlined,
        label: 'ຍັງບໍ່ຈັດຊ່າງ',
        count: d.unassignedRepair + d.unassignedInstall,
        color: danger,
        onTap: () => _open('unassigned', 'ຍັງບໍ່ຈັດຊ່າງ'),
      ),
      _AlertItem(
        icon: Icons.timer_off_outlined,
        label: 'ເກີນ SLA',
        count: d.slaLate,
        color: danger,
        onTap: () => _open('sla-late', 'ເກີນເວລາທີ່ສັນຍາໄວ້'),
      ),
      _AlertItem(
        icon: Icons.gavel_rounded,
        label: 'ງານເຄມລໍຕັດສິນ',
        count: d.claimsWaitDecision,
        color: const Color(0xFF7C3AED),
        onTap: () => _open('claim-decision', 'ງານເຄມລໍຕັດສິນ'),
      ),
      _AlertItem(
        icon: Icons.devices_other_rounded,
        label: 'ເຄື່ອງສຳຮອງຄ້າງຄືນ',
        count: d.loaners,
        color: warn,
        onTap: () => _open('loaners', 'ເຄື່ອງສຳຮອງຄ້າງຄືນ'),
      ),
      _AlertItem(
        icon: Icons.sentiment_dissatisfied_rounded,
        label: 'ລູກຄ້າໃຫ້ຄະແນນຕໍ່າ',
        count: d.feedbackUnhappy,
        color: const Color(0xFFDB2777),
        onTap: () => _open('unhappy', 'ລູກຄ້າໃຫ້ຄະແນນຕໍ່າ'),
      ),
    ].where((a) => a.count > 0).toList();

    return [
      _ExecutiveOverview(
        data: d,
        onOpenJobs: () => _open('workflow:all', 'ງານທີ່ກຳລັງເປີດ'),
        onApprovals: toApprovals,
        onOverdue: () => _open('sla-late', 'ງານເກີນ SLA'),
      ),
      const SizedBox(height: 16),
      _DashboardTitle(
        title: 'ສະຫຼຸບແຕ່ລະສາຍງານ',
        subtitle: 'ເຫັນປະລິມານ, ວຽກເກົ່າ ແລະ ຈຸດສ່ຽງໃນບ່ອນດຽວ',
      ),
      const SizedBox(height: 10),
      _WorkSummaryGrid(
        data: d,
        onOpen: (bucket, title) => _open(bucket, title),
        onApprovals: toApprovals,
      ),
      const SizedBox(height: 18),
      _DashboardTitle(
        title: 'ຕ້ອງຈັດການກ່ອນ',
        subtitle: alerts.isEmpty
            ? 'ບໍ່ມີລາຍການດ່ວນໃນຕອນນີ້'
            : '${alerts.fold<int>(0, (sum, item) => sum + item.count)} ລາຍການລໍການຕັດສິນ',
      ),
      const SizedBox(height: 10),
      if (alerts.isEmpty)
        const _AllClearCard()
      else
        _PriorityActions(items: alerts.take(5).toList()),
      const SizedBox(height: 18),
      _DashboardTitle(
        title: 'ຜົນງານມື້ນີ້',
        subtitle: 'ງານເຂົ້າ, ງານຈົບ ແລະ ກິດຈະກຳຫຼັກ',
      ),
      const SizedBox(height: 10),
      _TodayBrief(data: d),
      const SizedBox(height: 14),
      _AgeDistributionCard(
        staleJobs: d.staleJobs,
        openTotal: d.openTotal,
        aging: d.aging,
        onTap: (bucket) => _open('age:${bucket.key}', bucket.label),
        onTapAll: () => _open('age:over30', 'ຄ້າງເກີນ 30 ມື້'),
      ),
      const SizedBox(height: 14),
      if (d.techBacklog.isNotEmpty)
        _TechBacklogSection(
          techs: d.techBacklog.take(5).toList(),
          freeTechs: d.techFree,
          onTap: (tech) =>
              _open('tech:${tech.techCode}', '${tech.tech} · ວຽກຄ້າງ'),
        ),
      const SizedBox(height: 14),
      /*
        ── ຂັ້ນຕອນງານ (funnel) — **ເອົາກັບມາໂຊ້ວ** (06-08-2026) ──
        `_PipelineSection` ຖືກຂຽນໄວ້ແຕ່ **ບໍ່ເຄີຍຖືກເອີ້ນ** ⇒ ຜູ້ຈັດການເບິ່ງແອັບແລ້ວ
        ບໍ່ເຫັນວ່າວຽກຄາຢູ່ຂັ້ນໃດເລີຍ (ເວັບເຫັນຢູ່ໜ້າພາບລວມ). ຂັ້ນ ແລະ ຊື່ຂັ້ນມາຈາກ
        server (lib/mobile-overview ⇒ dashboard-status ບ່ອນດຽວກັບເວັບ) ⇒ ບໍ່ຫຼົ້ນກັນ.
        ກົດແທ່ງ ⇒ ເປີດລາຍການຂອງຂັ້ນນັ້ນ (`stage:<n>` ຂອງ lib/manager-drill).
      */
      if (d.pipeline.isNotEmpty) ...[
        _PipelineSection(
          pipeline: d.pipeline,
          onTap: (stage) => _open('stage:${stage.stage}', stage.label),
        ),
        const SizedBox(height: 14),
      ],
      _ManagementSnapshot(data: d),
      const SizedBox(height: 18),
      const _DashboardTitle(
        title: 'ເຄື່ອງມືຈັດການ',
        subtitle: 'ເຂົ້າເຖິງວຽກທີ່ໃຊ້ປະຈຳໄດ້ໄວ',
      ),
      const SizedBox(height: 10),
      _QuickActionsSection(
        onMap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const PendingMapScreen()),
        ),
        onCommission: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const CommissionScreen()),
        ),
        onActivities: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const ActivitiesScreen()),
        ),
        onStock: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RepairStockScreen()),
        ),
      ),
    ];
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎨 ຊິ້ນສ່ວນ UI ແບບໃໝ່
// ═══════════════════════════════════════════════════════════════

class _DashboardTitle extends StatelessWidget {
  const _DashboardTitle({required this.title, required this.subtitle});
  final String title;
  final String subtitle;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w900,
          color: ink,
        ),
      ),
      const SizedBox(height: 3),
      Text(
        subtitle,
        style: const TextStyle(fontSize: 11.5, height: 1.35, color: muted),
      ),
    ],
  );
}

class _ExecutiveOverview extends StatelessWidget {
  const _ExecutiveOverview({
    required this.data,
    required this.onOpenJobs,
    required this.onApprovals,
    required this.onOverdue,
  });
  final Overview data;
  final VoidCallback onOpenJobs;
  final VoidCallback onApprovals;
  final VoidCallback onOverdue;

  @override
  Widget build(BuildContext context) {
    final healthy = data.slaLate == 0 && data.staleJobs == 0;
    return Container(
      padding: const EdgeInsets.all(18),
      // v4: flat — ພື້ນ ink ລ້ວນ ບໍ່ມີ gradient/ເງົາ (ປະຢັດ GPU ເຄື່ອງເກົ່າ)
      decoration: BoxDecoration(
        color: hero1,
        borderRadius: BorderRadius.circular(kCardRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(
                      healthy
                          ? Icons.check_circle_rounded
                          : Icons.monitor_heart_rounded,
                      size: 14,
                      color: healthy
                          ? const Color(0xFF5EEAD4)
                          : const Color(0xFFFCD34D),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      healthy ? 'ການດຳເນີນງານປົກກະຕິ' : 'ມີຈຸດທີ່ຕ້ອງຕິດຕາມ',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                'ອັບເດດຫຼ້າສຸດ',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: .55),
                  fontSize: 11.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Text(
            'ພາບລວມສູນບໍລິການ',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
              letterSpacing: -.4,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'ຕົວເລກສຳຄັນທີ່ຕ້ອງຮູ້ກ່ອນເລີ່ມຈັດການວຽກ',
            style: TextStyle(
              color: Colors.white.withValues(alpha: .65),
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _ExecutiveMetric(
                label: 'ງານເປີດ',
                value: data.openTotal,
                tone: const Color(0xFF67E8F9),
                onTap: onOpenJobs,
              ),
              _ExecutiveMetric(
                label: 'ລໍອະນຸມັດ',
                value: data.approvalsTotal,
                tone: const Color(0xFFFCD34D),
                onTap: onApprovals,
              ),
              _ExecutiveMetric(
                label: 'ເກີນ SLA',
                value: data.slaLate,
                tone: const Color(0xFFFDA4AF),
                onTap: onOverdue,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.swap_vert_circle_outlined,
                  color: Colors.white70,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'ເດືອນນີ້ ຮັບເຂົ້າ ${data.flowOpened} · ປິດງານ ${data.flowClosed}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  data.flowDelta >= 0
                      ? '+${data.flowDelta}'
                      : '${data.flowDelta}',
                  style: TextStyle(
                    color: data.flowDelta >= 0
                        ? const Color(0xFF5EEAD4)
                        : const Color(0xFFFDA4AF),
                    fontWeight: FontWeight.w900,
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

class _ExecutiveMetric extends StatelessWidget {
  const _ExecutiveMetric({
    required this.label,
    required this.value,
    required this.tone,
    required this.onTap,
  });
  final String label;
  final int value;
  final Color tone;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$value',
              style: TextStyle(
                color: tone,
                fontSize: 28,
                height: 1,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: .7),
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _WorkSummaryGrid extends StatelessWidget {
  const _WorkSummaryGrid({
    required this.data,
    required this.onOpen,
    required this.onApprovals,
  });
  final Overview data;
  final void Function(String, String) onOpen;
  final VoidCallback onApprovals;
  @override
  Widget build(BuildContext context) {
    final cards = <Widget>[
      _WorkCard(
        title: 'ງານສ້ອມ',
        value: data.repairOpen,
        note: '${data.unassignedRepair} ຍັງບໍ່ຈັດຊ່າງ',
        icon: Icons.handyman_outlined,
        color: const Color(0xFF0F766E),
        onTap: () => onOpen('workflow:repair', 'ງານສ້ອມ'),
      ),
      _WorkCard(
        title: 'ງານຕິດຕັ້ງ',
        value: data.installOpen,
        note: '${data.unassignedInstall} ຍັງບໍ່ຈັດຊ່າງ',
        icon: Icons.home_repair_service_outlined,
        color: const Color(0xFF2563EB),
        onTap: () => onOpen('workflow:install', 'ງານຕິດຕັ້ງ'),
      ),
      _WorkCard(
        title: 'ງານເຄມ',
        value: data.claimsOpen,
        note: '${data.claimsWaitDecision} ລໍຕັດສິນ',
        icon: Icons.verified_user_outlined,
        color: const Color(0xFF7C3AED),
        onTap: () => onOpen('claim-open', 'ງານເຄມ'),
      ),
      _WorkCard(
        title: 'ອະນຸມັດ',
        value: data.approvalsTotal,
        note: '${data.aQuotes} ສະເໜີລາຄາ · ${data.aPurchases} ຈັດຊື້',
        icon: Icons.fact_check_outlined,
        color: const Color(0xFFD97706),
        onTap: onApprovals,
      ),
    ];
    return Column(
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.55,
          children: cards,
        ),
        if (data.workflows.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: line),
            ),
            child: Column(
              children: [
                for (var i = 0; i < data.workflows.length; i++) ...[
                  _WorkflowBrief(
                    item: data.workflows[i],
                    onTap: () => onOpen(
                      'workflow:${data.workflows[i].key}',
                      data.workflows[i].label,
                    ),
                  ),
                  if (i < data.workflows.length - 1)
                    const Divider(height: 1, indent: 14, endIndent: 14),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _WorkCard extends StatelessWidget {
  const _WorkCard({
    required this.title,
    required this.value,
    required this.note,
    required this.icon,
    required this.color,
    required this.onTap,
  });
  final String title;
  final int value;
  final String note;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(18),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: .1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: color, size: 18),
                ),
                const Spacer(),
                const Icon(Icons.arrow_forward_rounded, size: 15, color: faint),
              ],
            ),
            const Spacer(),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '$value',
                  style: const TextStyle(
                    fontSize: 24,
                    height: 1,
                    fontWeight: FontWeight.w900,
                    color: ink,
                  ),
                ),
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              note,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                color: note.startsWith('0 ') ? muted : color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _WorkflowBrief extends StatelessWidget {
  const _WorkflowBrief({required this.item, required this.onTap});
  final WorkflowSummary item;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ListTile(
    onTap: onTap,
    dense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
    leading: Container(
      width: 9,
      height: 9,
      decoration: const BoxDecoration(color: teal, shape: BoxShape.circle),
    ),
    title: Text(
      item.label,
      style: const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w800,
        color: ink,
      ),
    ),
    subtitle: Text(
      'ເກົ່າສຸດ ${item.oldestDays} ມື້',
      style: const TextStyle(fontSize: 11.5, color: faint),
    ),
    trailing: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (item.stale > 0)
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: danger.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '${item.stale} ເກີນ 30ມື້',
              style: const TextStyle(
                fontSize: 11,
                color: danger,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        Text(
          '${item.open}',
          style: const TextStyle(
            fontSize: 16,
            color: ink,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(width: 3),
        const Icon(Icons.chevron_right_rounded, size: 17, color: faint),
      ],
    ),
  );
}

class _PriorityActions extends StatelessWidget {
  const _PriorityActions({required this.items});
  final List<_AlertItem> items;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: line),
    ),
    child: Column(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          _AlertTile(item: items[i]),
          if (i < items.length - 1) const Divider(height: 1, indent: 54),
        ],
      ],
    ),
  );
}

class _AllClearCard extends StatelessWidget {
  const _AllClearCard();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: ok.withValues(alpha: .06),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: ok.withValues(alpha: .2)),
    ),
    child: const Row(
      children: [
        Icon(Icons.task_alt_rounded, color: ok),
        SizedBox(width: 10),
        Expanded(
          child: Text(
            'ທຸກລາຍການສຳຄັນຖືກຈັດການແລ້ວ',
            style: TextStyle(
              color: ink,
              fontWeight: FontWeight.w800,
              fontSize: 12.5,
            ),
          ),
        ),
      ],
    ),
  );
}

class _TodayBrief extends StatelessWidget {
  const _TodayBrief({required this.data});
  final Overview data;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 15),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: line),
    ),
    child: Row(
      children: [
        _TodayMetric(
          label: 'ຮັບເຂົ້າ',
          value: data.todayReceived,
          icon: Icons.call_received_rounded,
          color: const Color(0xFF2563EB),
        ),
        _TodayMetric(
          label: 'ນັດໝາຍ',
          value: data.todayAppointments,
          icon: Icons.event_available_outlined,
          color: const Color(0xFF7C3AED),
        ),
        _TodayMetric(
          label: 'ກຳລັງສ້ອມ',
          value: data.todayRepairing,
          icon: Icons.build_circle_outlined,
          color: const Color(0xFFD97706),
        ),
        _TodayMetric(
          label: 'ສົ່ງຄືນ',
          value: data.todayReturned,
          icon: Icons.task_alt_rounded,
          color: ok,
        ),
      ],
    ),
  );
}

class _TodayMetric extends StatelessWidget {
  const _TodayMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label;
  final int value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(height: 7),
        Text(
          '$value',
          style: const TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: muted,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _ManagementSnapshot extends StatelessWidget {
  const _ManagementSnapshot({required this.data});
  final Overview data;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'ພາບລວມທາງບໍລິຫານ',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
        const SizedBox(height: 14),
        _SnapshotRow(
          label: 'ລາຍຮັບທີ່ຊຳລະແລ້ວ',
          value: _money(data.moneyPaid),
          color: ok,
        ),
        _SnapshotRow(
          label: 'ຍອດຄ້າງຊຳລະ',
          value: _money(data.moneyDue),
          color: data.moneyDue > 0 ? danger : muted,
        ),
        _SnapshotRow(
          label: 'ຄວາມພໍໃຈລູກຄ້າ',
          value: data.feedbackAvg == null
              ? '-'
              : '${data.feedbackAvg!.toStringAsFixed(1)} / 5',
          color: _scoreTone(data.feedbackAvg),
        ),
        _SnapshotRow(
          label: 'ຊ່າງວ່າງພ້ອມຮັບງານ',
          value: '${data.techFree.length} ຄົນ',
          color: teal,
          last: true,
        ),
      ],
    ),
  );
}

class _SnapshotRow extends StatelessWidget {
  const _SnapshotRow({
    required this.label,
    required this.value,
    required this.color,
    this.last = false,
  });
  final String label;
  final String value;
  final Color color;
  final bool last;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 10),
    decoration: BoxDecoration(
      border: last ? null : const Border(bottom: BorderSide(color: line)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 11.5,
              color: muted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            color: color,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );
}

/// ── Header ແບບທັນສະໄໝ ──
class _ModernHeader extends StatelessWidget {
  const _ModernHeader({
    required this.title,
    required this.subtitle,
    required this.onRefresh,
    required this.onLogout,
    required this.onNotifications,
  });

  final String title;
  final String subtitle;
  final VoidCallback onRefresh;
  final VoidCallback onLogout;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: line)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 10, 12, 10),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: ink,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(
                  Icons.grid_view_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: ink,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: ok,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: muted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              _HeaderIconButton(
                icon: Icons.notifications_none_rounded,
                onTap: onNotifications,
                showBadge: true,
              ),
              const SizedBox(width: 5),
              _HeaderIconButton(icon: Icons.refresh_rounded, onTap: onRefresh),
              const SizedBox(width: 5),
              _HeaderIconButton(
                icon: Icons.more_horiz_rounded,
                onTap: () => _showMenu(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.logout_rounded, color: danger),
              title: const Text(
                'ອອກຈາກລະບົບ',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              onTap: () {
                Navigator.pop(context);
                onLogout();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.onTap,
    this.showBadge = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: surfaceAlt,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: line),
        ),
        child: Stack(
          children: [
            Center(child: Icon(icon, size: 20, color: ink)),
            if (showBadge)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFFF43F5E),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// ພາບລວມສັ້ນໆທີ່ຜູ້ຈັດການເຫັນທັນທີເມື່ອເປີດໜ້າ.
// ignore: unused_element
class _CommandHero extends StatelessWidget {
  const _CommandHero({
    required this.openJobs,
    required this.overdue,
    required this.approvals,
  });

  final int openJobs;
  final int overdue;
  final int approvals;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      // v4: flat — ບໍ່ມີເງົາ (ປະຢັດ GPU ເຄື່ອງເກົ່າ)
      decoration: BoxDecoration(
        color: ink,
        borderRadius: BorderRadius.circular(kCardRadius),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -38,
            top: -52,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: tealBright.withValues(alpha: 0.24),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'LIVE OVERVIEW',
                      style: TextStyle(
                        color: Color(0xFF99F6E4),
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ),
                  const Spacer(),
                  const Icon(
                    Icons.insights_rounded,
                    color: Color(0xFF5EEAD4),
                    size: 24,
                  ),
                ],
              ),
              const SizedBox(height: 22),
              const Text(
                'ງານທີ່ກຳລັງດຳເນີນ',
                style: TextStyle(
                  color: onHeroDim,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$openJobs',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 42,
                  height: 1.1,
                  fontWeight: FontWeight.w900,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  _HeroFact(
                    icon: Icons.timer_off_outlined,
                    label: 'ເກີນ SLA',
                    value: '$overdue',
                    tone: const Color(0xFFFDA4AF),
                  ),
                  Container(
                    width: 1,
                    height: 32,
                    margin: const EdgeInsets.symmetric(horizontal: 18),
                    color: Colors.white.withValues(alpha: 0.12),
                  ),
                  _HeroFact(
                    icon: Icons.fact_check_outlined,
                    label: 'ລໍອະນຸມັດ',
                    value: '$approvals',
                    tone: const Color(0xFFFDE68A),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroFact extends StatelessWidget {
  const _HeroFact({
    required this.icon,
    required this.label,
    required this.value,
    required this.tone,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Row(
      children: [
        Icon(icon, size: 18, color: tone),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: TextStyle(
                color: tone,
                fontSize: 17,
                fontWeight: FontWeight.w900,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                color: onHeroDim,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

/// ── KPI Grid ──
class _KPIMetric {
  const _KPIMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    // ignore: unused_element_parameter
    this.detail,
    // ignore: unused_element_parameter
    this.isDecimal = false,
    // ignore: unused_element_parameter
    this.isMoney = false,
  });

  final String label;
  final double value;
  final IconData icon;
  final Color color;
  final String? detail;
  final bool isDecimal;
  final bool isMoney;
}

// ignore: unused_element
class _KPIGrid extends StatelessWidget {
  const _KPIGrid({required this.metrics});

  final List<_KPIMetric> metrics;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'ຕົວຊີ້ວັດສຳຄັນ',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 142,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: metrics.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final m = metrics[index];
              return SizedBox(
                width: 170,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: line),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: m.color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(9),
                            ),
                            child: Icon(m.icon, size: 17, color: m.color),
                          ),
                          const Spacer(),
                          if (m.detail != null)
                            Text(
                              m.detail!,
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade400,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        m.isMoney
                            ? _money(m.value)
                            : m.isDecimal
                            ? m.value.toStringAsFixed(1)
                            : m.value.toInt().toString(),
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: m.color,
                          fontFeatures: const [FontFeature.tabularFigures()],
                          height: 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        m.label,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Colors.grey.shade600,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ignore: unused_element
class _OperationsHealth extends StatelessWidget {
  const _OperationsHealth({
    required this.repairOpen,
    required this.installOpen,
    required this.claimsOpen,
    required this.loaners,
    required this.onClaims,
    required this.onLoaners,
  });

  final int repairOpen;
  final int installOpen;
  final int claimsOpen;
  final int loaners;
  final VoidCallback onClaims;
  final VoidCallback onLoaners;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.monitor_heart_outlined, color: teal, size: 20),
            SizedBox(width: 8),
            Text(
              'ສຸຂະພາບການດຳເນີນງານ',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: ink,
              ),
            ),
          ],
        ),
        const SizedBox(height: 13),
        Row(
          children: [
            Expanded(
              child: _HealthTile(
                label: 'ງານສ້ອມ',
                value: repairOpen,
                icon: Icons.build_circle_outlined,
                color: teal,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _HealthTile(
                label: 'ງານຕິດຕັ້ງ',
                value: installOpen,
                icon: Icons.home_repair_service_outlined,
                color: const Color(0xFF0284C7),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _HealthTile(
                label: 'ເຄມເປີດ',
                value: claimsOpen,
                icon: Icons.policy_outlined,
                color: const Color(0xFF7C3AED),
                onTap: onClaims,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _HealthTile(
                label: 'ເຄື່ອງສຳຮອງ',
                value: loaners,
                icon: Icons.devices_other_outlined,
                color: warn,
                onTap: onLoaners,
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _HealthTile extends StatelessWidget {
  const _HealthTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: color.withValues(alpha: .065),
    borderRadius: BorderRadius.circular(14),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$value',
                    style: TextStyle(
                      fontSize: 18,
                      height: 1,
                      fontWeight: FontWeight.w900,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: muted,
                    ),
                  ),
                ],
              ),
            ),
            if (onTap != null)
              const Icon(Icons.chevron_right_rounded, size: 17, color: faint),
          ],
        ),
      ),
    ),
  );
}

String _money(double value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
  return value.toStringAsFixed(0);
}

/// ── Alert Section ──
class _AlertItem {
  const _AlertItem({
    required this.icon,
    required this.label,
    required this.count,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final int count;
  final Color color;
  final VoidCallback onTap;
}

// ignore: unused_element
class _AlertSection extends StatelessWidget {
  const _AlertSection({
    required this.title,
    required this.alerts,
    required this.totalAlerts,
  });

  final String title;
  final List<_AlertItem> alerts;
  final int totalAlerts;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7F8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: danger.withValues(alpha: 0.16)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: danger.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.bolt_rounded, color: danger, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: danger,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '$totalAlerts',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...alerts.map((alert) => _AlertTile(item: alert)),
        ],
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.item});
  final _AlertItem item;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: item.onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: line),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: item.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(item.icon, size: 18, color: item.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                item.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: ink,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: item.color,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '${item.count}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Colors.grey.shade400,
            ),
          ],
        ),
      ),
    );
  }
}

/// ── Age Distribution Card ──
class _AgeDistributionCard extends StatelessWidget {
  const _AgeDistributionCard({
    required this.staleJobs,
    required this.openTotal,
    required this.aging,
    required this.onTap,
    required this.onTapAll,
  });

  final int staleJobs;
  final int openTotal;
  final List<OverviewAge> aging;
  final void Function(OverviewAge) onTap;
  final VoidCallback onTapAll;

  static const _colors = {
    'd7': Color(0xFF10B981),
    'd14': Color(0xFFEAB308),
    'd30': Color(0xFFF97316),
    'over30': Color(0xFFF43F5E),
  };

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ອາຍຸກອງວຽກ',
      badge: openTotal > 0
          ? '${staleJobs > 0 ? '⚠️ ' : ''}$openTotal ໃບ'
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (openTotal > 0) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Container(
                height: 8,
                color: Colors.grey.shade100,
                child: Row(
                  children: aging.where((a) => a.count > 0).map((bucket) {
                    return Expanded(
                      flex: bucket.count,
                      child: ColoredBox(
                        color: _colors[bucket.key] ?? Colors.grey,
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 14,
              runSpacing: 6,
              children: aging.where((a) => a.count > 0).map((bucket) {
                return InkWell(
                  onTap: () => onTap(bucket),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color:
                          _colors[bucket.key]?.withValues(alpha: 0.1) ??
                          Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: _colors[bucket.key] ?? Colors.grey,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${bucket.count} · ${bucket.label}',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            color: _colors[bucket.key] ?? Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ] else ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                '✨ ບໍ່ມີງານຄ້າງ',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: ok,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// ── Workflow Section ──
// ignore: unused_element
class _WorkflowSection extends StatelessWidget {
  const _WorkflowSection({required this.workflows});
  final List<WorkflowSummary> workflows;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ແຍກຕາມສາຍງານ',
      child: Column(
        children: workflows.map((w) => _WorkflowRow(row: w)).toList(),
      ),
    );
  }
}

class _WorkflowRow extends StatelessWidget {
  const _WorkflowRow({required this.row});
  final WorkflowSummary row;

  @override
  Widget build(BuildContext context) {
    final total = row.open;
    if (total == 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 76,
            child: Text(
              row.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: ink,
              ),
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Container(
                height: 6,
                color: Colors.grey.shade100,
                child: Row(
                  children: [
                    if (row.stale > 0)
                      Expanded(
                        flex: row.stale,
                        child: const ColoredBox(color: danger),
                      ),
                    if (row.open - row.stale > 0)
                      Expanded(
                        flex: row.open - row.stale,
                        child: const ColoredBox(color: teal),
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            row.stale > 0
                ? '${row.open} ໃບ · ຄ້າງ ${row.stale}'
                : '${row.open} ໃບ${row.oldestDays > 0 ? ' · ${row.oldestDays}ມື້' : ''}',
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 11,
              color: row.stale > 0 ? danger : Colors.grey.shade500,
              fontWeight: row.stale > 0 ? FontWeight.w700 : FontWeight.w500,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// ── Tech Backlog Section ──
class _TechBacklogSection extends StatelessWidget {
  const _TechBacklogSection({
    required this.techs,
    required this.freeTechs,
    required this.onTap,
  });

  final List<OverviewBacklog> techs;
  final List<String> freeTechs;
  final void Function(OverviewBacklog) onTap;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ກອງວຽກຊ່າງ',
      badge: '${techs.length} ຄົນ',
      child: Column(
        children: [
          for (final t in techs) _TechBacklogRow(row: t, onTap: () => onTap(t)),
          if (freeTechs.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: freeTechs.map((name) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: ok.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: ok.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle, size: 12, color: ok),
                      const SizedBox(width: 4),
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: ink,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _TechBacklogRow extends StatelessWidget {
  const _TechBacklogRow({required this.row, required this.onTap});
  final OverviewBacklog row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          children: [
            SizedBox(
              width: 80,
              child: Text(
                row.tech,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: ink,
                ),
              ),
            ),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  height: 6,
                  color: Colors.grey.shade100,
                  child: Row(
                    children: [
                      if (row.stale > 0)
                        Expanded(
                          flex: row.stale,
                          child: const ColoredBox(color: danger),
                        ),
                      if (row.open - row.stale > 0)
                        Expanded(
                          flex: row.open - row.stale,
                          child: const ColoredBox(color: teal),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 72,
              child: Text(
                row.stale > 0
                    ? '${row.open} · 🔴${row.stale}'
                    : '${row.open} · ${row.oldestDays}d',
                textAlign: TextAlign.right,
                style: TextStyle(
                  fontSize: 11,
                  color: row.stale > 0 ? danger : Colors.grey.shade500,
                  fontWeight: row.stale > 0 ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
            const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}

/// ── Old Jobs Section ──
// ignore: unused_element
class _OldJobsSection extends StatelessWidget {
  const _OldJobsSection({required this.jobs, required this.onTapAll});

  final List<OverviewOldJob> jobs;
  final VoidCallback onTapAll;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ຄ້າງດົນສຸດ',
      trailing: TextButton(
        onPressed: onTapAll,
        style: TextButton.styleFrom(
          padding: EdgeInsets.zero,
          minimumSize: const Size(0, 0),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: const Text(
          'ເບິ່ງທັງໝົດ →',
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: teal,
          ),
        ),
      ),
      child: Column(
        children: jobs.take(3).map((job) => _OldJobRow(job: job)).toList(),
      ),
    );
  }
}

class _OldJobRow extends StatelessWidget {
  const _OldJobRow({required this.job});
  final OverviewOldJob job;

  @override
  Widget build(BuildContext context) {
    final isOver30 = job.days > 30;
    return InkWell(
      onTap: () => showJobSheet(
        context,
        MonitorJob(
          workflow: 'repair',
          code: job.code,
          product: job.product,
          customer: job.custName,
          tech: job.tech,
          serviceType: null,
          stageLabel: job.stageLabel,
          ageDays: job.days,
          slaLeft: null,
        ),
      ),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isOver30
              ? danger.withValues(alpha: 0.05)
              : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isOver30
                ? danger.withValues(alpha: 0.2)
                : Colors.grey.shade200,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              padding: const EdgeInsets.symmetric(vertical: 4),
              decoration: BoxDecoration(
                color: (isOver30 ? danger : teal).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  Text(
                    '${job.days}',
                    style: TextStyle(
                      fontSize: 16,
                      height: 1,
                      fontWeight: FontWeight.w900,
                      color: isOver30 ? danger : teal,
                    ),
                  ),
                  const Text(
                    'ມື້',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${job.code} · ${job.product}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                  Text(
                    '${job.custName ?? '-'} · ${job.stageLabel}${job.tech != null ? ' · ${job.tech}' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: Colors.grey),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Colors.grey.shade300,
            ),
          ],
        ),
      ),
    );
  }
}

/// ── Pipeline Section ──
// ignore: unused_element
class _PipelineSection extends StatelessWidget {
  const _PipelineSection({required this.pipeline, required this.onTap});

  final List<OverviewStage> pipeline;
  final void Function(OverviewStage) onTap;

  @override
  Widget build(BuildContext context) {
    if (pipeline.isEmpty) return const SizedBox.shrink();

    final maxV = pipeline
        .map((s) => s.count)
        .fold<int>(0, (a, b) => a > b ? a : b);
    final maxY = (maxV <= 0 ? 1 : maxV).toDouble();

    return _Card(
      title: 'ຂັ້ນຕອນງານ',
      child: SizedBox(
        height: 160,
        child: BarChart(
          BarChartData(
            alignment: BarChartAlignment.spaceAround,
            maxY: maxY * 1.25,
            barTouchData: BarTouchData(
              enabled: false,
              touchTooltipData: BarTouchTooltipData(
                getTooltipColor: (_) => Colors.transparent,
                tooltipPadding: EdgeInsets.zero,
                tooltipMargin: 2,
                getTooltipItem: (group, gi, rod, ri) => BarTooltipItem(
                  '${rod.toY.toInt()}',
                  const TextStyle(
                    color: ink,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              getDrawingHorizontalLine: (v) =>
                  const FlLine(color: Color(0xFFECF1EF), strokeWidth: 1),
            ),
            borderData: FlBorderData(show: false),
            titlesData: FlTitlesData(
              leftTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              rightTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              topTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  getTitlesWidget: (value, meta) {
                    final i = value.toInt();
                    if (i < 0 || i >= pipeline.length) {
                      return const SizedBox.shrink();
                    }
                    return Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: InkWell(
                        onTap: () => onTap(pipeline[i]),
                        child: Text(
                          pipeline[i].label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 8.5,
                            color: ink,
                            height: 1.1,
                            decoration: TextDecoration.underline,
                            decorationColor: Colors.grey.shade300,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            barGroups: [
              for (var i = 0; i < pipeline.length; i++)
                BarChartGroupData(
                  x: i,
                  showingTooltipIndicators: pipeline[i].count > 0 ? [0] : [],
                  barRods: [
                    BarChartRodData(
                      toY: pipeline[i].count.toDouble(),
                      color: pipeline[i].count > 0
                          ? teal
                          : Colors.grey.shade200,
                      width: 18,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(4),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ── Revenue Section ──
// ignore: unused_element
class _RevenueSection extends StatelessWidget {
  const _RevenueSection({
    required this.quoted,
    required this.paid,
    required this.due,
  });

  final double quoted;
  final double paid;
  final double due;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ລາຍຮັບເດືອນ',
      child: Row(
        children: [
          _MiniStat(label: 'ຕົກລົງ', value: _money(quoted), color: ink),
          _MiniStat(label: 'ຮັບແລ້ວ', value: _money(paid), color: ok),
          _MiniStat(
            label: 'ຄ້າງຮັບ',
            value: _money(due),
            color: due > 0 ? const Color(0xFFD97706) : Colors.grey,
          ),
        ],
      ),
    );
  }
}

/// ── Flow Section ──
// ignore: unused_element
class _FlowSection extends StatelessWidget {
  const _FlowSection({
    required this.opened,
    required this.closed,
    required this.delta,
  });

  final int opened;
  final int closed;
  final int delta;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ງານເຂົ້າ-ຈົບ (30 ມື້)',
      child: Row(
        children: [
          _MiniStat(label: 'ເຂົ້າ', value: '$opened', color: teal),
          _MiniStat(label: 'ຈົບ', value: '$closed', color: ok),
          _MiniStat(
            label: delta >= 0 ? 'ກອງວຽກຫຼຸດ' : 'ກອງວຽກເພີ່ມ',
            value: '${delta > 0 ? '+' : ''}$delta',
            color: delta >= 0 ? ok : danger,
          ),
        ],
      ),
    );
  }
}

/// ── Quick Actions ──
class _QuickActionsSection extends StatelessWidget {
  const _QuickActionsSection({
    required this.onMap,
    required this.onCommission,
    required this.onActivities,
    required this.onStock,
  });

  final VoidCallback onMap;
  final VoidCallback onCommission;
  final VoidCallback onActivities;
  final VoidCallback onStock;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ເຄື່ອງມືຊ່ວຍເຫຼືອ',
      child: Row(
        children: [
          _QuickActionTile(
            action: _QuickAction(
              icon: Icons.map_rounded,
              label: 'ແຜນທີ່',
              color: teal,
              onTap: onMap,
            ),
          ),
          _QuickActionTile(
            action: _QuickAction(
              icon: Icons.payments_rounded,
              label: 'ຄ່າຄອມ',
              color: ok,
              onTap: onCommission,
            ),
          ),
          _QuickActionTile(
            action: _QuickAction(
              icon: Icons.event_rounded,
              label: 'ກິດຈະກຳ',
              color: const Color(0xFF7C3AED),
              onTap: onActivities,
            ),
          ),
          _QuickActionTile(
            action: _QuickAction(
              icon: Icons.inventory_rounded,
              label: 'ສາງ',
              color: const Color(0xFF0891B2),
              onTap: onStock,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAction {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({required this.action});
  final _QuickAction action;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: action.onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 2),
          child: Column(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: action.color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(action.icon, size: 21, color: action.color),
              ),
              const SizedBox(height: 7),
              Text(
                action.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ── Today Section ──
// ignore: unused_element
class _TodaySection extends StatelessWidget {
  const _TodaySection({
    required this.received,
    required this.returned,
    required this.appointments,
    required this.checking,
    required this.repairing,
    required this.onReceived,
    required this.onReturned,
  });

  final int received;
  final int returned;
  final int appointments;
  final int checking;
  final int repairing;
  final VoidCallback onReceived;
  final VoidCallback onReturned;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ມື້ນີ້',
      child: Column(
        children: [
          Row(
            children: [
              _MiniStat(
                label: 'ເຂົ້າ',
                value: '$received',
                color: teal,
                onTap: onReceived,
              ),
              _MiniStat(
                label: 'ຈົບ',
                value: '$returned',
                color: ok,
                onTap: onReturned,
              ),
              _MiniStat(
                label: 'ນັດໝາຍ',
                value: '$appointments',
                color: const Color(0xFF7C3AED),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _MiniStat(
                label: 'ກວດ',
                value: '$checking',
                color: const Color(0xFFEAB308),
              ),
              _MiniStat(
                label: 'ສ້ອມ',
                value: '$repairing',
                color: const Color(0xFFF97316),
              ),
              const Expanded(child: SizedBox()),
            ],
          ),
        ],
      ),
    );
  }
}

/// ── SLA Section ──
// ignore: unused_element
class _SLASection extends StatelessWidget {
  const _SLASection({
    required this.warning,
    required this.late,
    required this.critical,
    required this.onTapLate,
  });

  final int warning;
  final int late;
  final int critical;
  final VoidCallback onTapLate;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'SLA',
      child: Row(
        children: [
          _MiniStat(
            label: 'ໃກ້ເກີນ',
            value: '$warning',
            color: const Color(0xFFD97706),
          ),
          _MiniStat(
            label: 'ເກີນ',
            value: '$late',
            color: danger,
            onTap: late > 0 ? onTapLate : null,
          ),
          _MiniStat(label: 'ວິກິດ', value: '$critical', color: danger),
        ],
      ),
    );
  }
}

/// ── Satisfaction Section ──
// ignore: unused_element
class _SatisfactionSection extends StatelessWidget {
  const _SatisfactionSection({
    required this.avg,
    required this.total,
    required this.unhappy,
  });

  final double? avg;
  final int total;
  final int unhappy;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: 'ຄວາມພໍໃຈລູກຄ້າ',
      subtitle: 'ຄະແນນຕໍ່າ = ດີ',
      child: Row(
        children: [
          _MiniStat(
            label: 'ຄ່າສະເລ່ຍ',
            value: avg == null ? '-' : avg!.toStringAsFixed(2),
            color: _scoreTone(avg),
          ),
          _MiniStat(label: 'ທັງໝົດ', value: '$total', color: Colors.grey),
          _MiniStat(
            label: 'ບໍ່ພໍໃຈ',
            value: '$unhappy',
            color: unhappy > 0 ? danger : Colors.grey,
          ),
        ],
      ),
    );
  }
}

/// ── Mini Stat Component ──
class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
    this.onTap,
  });

  final String label;
  final String value;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.12)),
          ),
          child: Column(
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: color,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey.shade500,
                  decoration: onTap != null ? TextDecoration.underline : null,
                  decorationColor: color.withValues(alpha: 0.4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ── Card Component ──
class _Card extends StatelessWidget {
  const _Card({
    required this.title,
    required this.child,
    this.subtitle,
    this.badge,
    this.trailing,
  });

  final String title;
  final Widget child;
  final String? subtitle;
  final String? badge;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      // v4: flat — ຂອບແທນເງົາ
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(kCardRadius),
        border: Border.all(color: line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 3.5,
                height: 16,
                margin: const EdgeInsets.only(right: 10),
                decoration: BoxDecoration(
                  color: teal,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: ink,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Colors.grey.shade500,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: teal.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    badge!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: teal,
                    ),
                  ),
                ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

/// ── Loading Shimmer ──
class _LoadingShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(
            'ກຳລັງໂຫຼດຂໍ້ມູນ...',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// ── Error View ──
class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: danger.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.cloud_off_rounded, size: 36, color: danger),
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              fontSize: 15,
              color: Colors.grey.shade600,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: onRetry,
            style: FilledButton.styleFrom(
              backgroundColor: teal,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: const Text('ລອງໃໝ່'),
          ),
        ],
      ),
    );
  }
}

/// ── Helper Functions ──
Color _scoreTone(double? score) {
  if (score == null) return Colors.grey;
  if (score >= 2.5) return danger;
  if (score >= 1.5) return const Color(0xFFD97706);
  return ok;
}
