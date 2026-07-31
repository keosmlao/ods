import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import '../widgets/ui_kit.dart';
import 'approvals_screen.dart';
import 'commission_screen.dart';
import 'login_screen.dart';
import 'pending_map_screen.dart';
import 'repair_stock_screen.dart';
import 'notifications_screen.dart';
import 'manager_kit.dart';
import 'overview_jobs_screen.dart';

/// ໜ້າຫຼັກຜູ້ຈັດການ — ພາບລວມບໍລິຫານ (ຕົວເລກລວມທັງບໍລິສັດ ຈາກ /api/mobile/overview).
/// ຂໍ້ມູນມາຈາກ dashboard ຝັ່ງເວັບ ⇒ ຕົວເລກກົງກັນ.
class ManagerScreen extends StatefulWidget {
  const ManagerScreen({super.key});

  @override
  State<ManagerScreen> createState() => _ManagerScreenState();
}

class _ManagerScreenState extends State<ManagerScreen> {
  Overview? data;
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
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
    // ຖອນ push token ພື້ນຫຼັງ (ບໍ່ await) — ບໍ່ໃຫ້ logout ຄ້າງ ~25s ຕອນສັນຍານອ່ອນ
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
          HeroHeader(
            title: 'ພາບລວມຜູ້ຈັດການ',
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
                },
                itemBuilder: (_) => const [
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
            stats: data == null
                ? null
                : [
                    HeroStat(value: '${data!.repairOpen}', label: 'ວຽກສ້ອມຄ້າງ'),
                    HeroStat(value: '${data!.overSla}', label: 'ເລີຍ SLA', color: const Color(0xFFFDA4AF)),
                    HeroStat(value: '${data!.approvalsTotal}', label: 'ລໍອະນຸມັດ', color: const Color(0xFFFDBA74)),
                  ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? _ErrorView(message: error, onRetry: load)
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                      children: _sections(data!),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  /// ເປີດລາຍການໃບງານທີ່ຢູ່ເບື້ອງຫຼັງຕົວເລກນັ້ນ (bucket ນິຍາມຢູ່ lib/manager-drill)
  void _open(String bucket, String title) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => OverviewJobsScreen(bucket: bucket, title: title)),
    );
  }

  /// ── ລຳດັບໜ້າ: **ວຽກຄ້າງກ່ອນ ຜົນງານທີຫຼັງ** (ຕົກລົງກັບຜູ້ໃຊ້ 31-07-2026) ──
  ///
  /// ລຳດັບເກົ່າຂຶ້ນຕົ້ນດ້ວຍ "ມື້ນີ້" ເຊິ່ງເປັນຕົວເລກທີ່ **ບໍ່ຕ້ອງການການຕັດສິນ** ⇒ ຜູ້ຈັດການ
  /// ຕ້ອງເລື່ອນຜ່ານ 3 ບັດກ່ອນຈຶ່ງເຫັນສິ່ງທີ່ຄ້າງ. ດຽວນີ້ສິ່ງທີ່ຄ້າງມາກ່ອນສະເໝີ ແລະ
  /// ບັດທີ່ເປັນ 0 **ບໍ່ສະແດງ** — ໜ້າສັ້ນລົງ = ບໍ່ມີຫຍັງຄ້າງ ເຊິ່ງເປັນຄຳຕອບທີ່ຖືກຕ້ອງ.
  List<Widget> _sections(Overview d) {
    // ບັດອະນຸມັດພາໄປໜ້າອະນຸມັດ (ກົດອະນຸມັດໄດ້ເລີຍ) · ບັດງານພາໄປລາຍການໃບງານ
    void toApprovals() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ApprovalsScreen()),
    );

    final actions = <_ActionItem>[
      _ActionItem('ໃບສະເໜີລາຄາລໍອະນຸມັດ', d.aQuotes, danger, toApprovals),
      _ActionItem('ຮ້ອງຂໍຍົກເລີກງານ', d.aCancels, danger, toApprovals),
      _ActionItem('ໃບຂໍຊື້ລໍອະນຸມັດ', d.aPurchases, const Color(0xFFD97706), toApprovals),
      _ActionItem('ລໍລູກຄ້າຕົກລົງລາຄາ', d.aCustomer, const Color(0xFFD97706), toApprovals),
      _ActionItem('ງານຍັງບໍ່ຈັດຊ່າງ', d.unassignedRepair + d.unassignedInstall, danger,
          () => _open('unassigned', 'ຍັງບໍ່ຈັດຊ່າງ')),
      _ActionItem('ເກີນເວລາທີ່ສັນຍາໄວ້ (SLA)', d.slaLate, danger,
          () => _open('sla-late', 'ເກີນເວລາທີ່ສັນຍາໄວ້ (SLA)')),
      _ActionItem('ງານເຄມລໍຕັດສິນ', d.claimsWaitDecision, const Color(0xFF7C3AED),
          () => _open('claim-decision', 'ງານເຄມລໍຕັດສິນ')),
      _ActionItem('ເຄື່ອງສຳຮອງຄ້າງຄືນ', d.loaners, const Color(0xFFD97706),
          () => _open('loaners', 'ໃບງານທີ່ມີເຄື່ອງສຳຮອງຄ້າງຄືນ')),
      _ActionItem('ລູກຄ້າໃຫ້ຄະແນນຕໍ່າ', d.feedbackUnhappy, const Color(0xFFD97706),
          () => _open('unhappy', 'ລູກຄ້າໃຫ້ຄະແນນຕໍ່າ')),
    ].where((a) => a.value > 0).toList();

    return [
      // ── ① ອາຍຸຂອງກອງວຽກ — ຕົວເລກດຽວທີ່ບອກສຸຂະພາບຂອງສູນໄດ້ດີສຸດ ──
      _Card(
        title: 'ງານຄ້າງເກີນ 30 ມື້',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () => _open('age:over30', 'ຄ້າງເກີນ 30 ມື້'),
              borderRadius: BorderRadius.circular(10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    '${d.staleJobs}',
                    style: TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      color: d.staleJobs > 0 ? danger : ok,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'ຈາກງານທີ່ຍັງເປີດຢູ່ ${d.openTotal} ໃບ',
                    style: const TextStyle(fontSize: 12.5, color: muted),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right, size: 20, color: muted),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // ແຕະປ້າຍຖັງໃດ = ເປີດລາຍການຂອງຖັງນັ້ນ
            _AgeBar(aging: d.aging, total: d.openTotal, onTap: (b) => _open('age:${b.key}', b.label)),
          ],
        ),
      ),

      // ── ② ຕ້ອງລົງມື ──
      _Card(
        title: 'ຕ້ອງລົງມື',
        child: actions.isEmpty
            ? const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Text(
                  'ບໍ່ມີຫຍັງຄ້າງລໍການຕັດສິນ ✓',
                  style: TextStyle(fontSize: 13, color: ok, fontWeight: FontWeight.w700),
                ),
              )
            : Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [for (final a in actions) _ActionChip(item: a)],
              ),
      ),

      // ── ທາງລັດໄປໜ້າໃໝ່ (ແຜນທີ່ · ຄ່າຄອມ) ──
      _Card(
        title: 'ເບິ່ງເພີ່ມ',
        child: Row(
          children: [
            Expanded(
              child: _ShortcutButton(
                icon: Icons.map_outlined,
                label: 'ແຜນທີ່ງານຄ້າງ',
                tone: teal,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PendingMapScreen()),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ShortcutButton(
                icon: Icons.payments_outlined,
                label: 'ສະຫຼຸບຄ່າຄອມ',
                tone: ok,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const CommissionScreen()),
                ),
              ),
            ),
          ],
        ),
      ),

      _Card(
        title: 'ສາງສູນບໍລິການ',
        child: _ShortcutButton(
          icon: Icons.inventory_2_outlined,
          label: 'ຄົງເຫຼືອ ແລະ ລາຍການອາໄຫຼ່',
          tone: const Color(0xFF0891B2),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const RepairStockScreen()),
          ),
        ),
      ),

      // ── ③ ໃບເກົ່າສຸດ — ບອກເປັນ "ໃບໃດ ຂອງໃຜ" ⇒ ຕາມໄດ້ທັນທີ ──
      if (d.oldest.isNotEmpty)
        _Card(
          title: 'ໃບທີ່ຄ້າງດົນສຸດ',
          trailing: InkWell(
            onTap: () => _open('age:over30', 'ຄ້າງເກີນ 30 ມື້'),
            child: const Text(
              'ເບິ່ງທັງໝົດ',
              style: TextStyle(fontSize: 11.5, color: teal, fontWeight: FontWeight.w800),
            ),
          ),
          child: Column(children: [for (final job in d.oldest) _OldJobRow(job: job)]),
        ),

      // ── ④ ຜົນງານ ──
      _Card(
        title: 'ລາຍຮັບງານສ້ອມ ເດືອນນີ້ (ບາດ)',
        child: Row(
          children: [
            _Mini(label: 'ຕົກລົງລາຄາ', valueText: _money(d.moneyQuoted), tone: ink),
            _Mini(label: 'ຮັບແລ້ວ', valueText: _money(d.moneyPaid), tone: ok),
            _Mini(label: 'ຍັງຄ້າງ', valueText: _money(d.moneyDue), tone: const Color(0xFFD97706)),
          ],
        ),
      ),

      _Card(
        title: 'ງານເຂົ້າ ທຽບ ງານຈົບ (30 ມື້)',
        child: Column(
          children: [
            Row(
              children: [
                _Mini(label: 'ຮັບເຂົ້າ', value: d.flowOpened),
                _Mini(label: 'ສົ່ງຄືນສຳເລັດ', value: d.flowClosed, tone: ok),
                _Mini(
                  label: d.flowDelta >= 0 ? 'ກອງວຽກຫຼຸດລົງ' : 'ກອງວຽກເພີ່ມຂຶ້ນ',
                  valueText: '${d.flowDelta > 0 ? '+' : ''}${d.flowDelta}',
                  tone: d.flowDelta >= 0 ? ok : danger,
                ),
              ],
            ),
          ],
        ),
      ),

      // ⚠️ ຄະແນນ **ຕໍ່າ = ດີ** (cust_complain.points 1=ດີຫຼາຍ … 4=ບໍ່ພໍໃຈ) — ຫ້າມສະແດງຄືດາວ
      _Card(
        title: 'ຄວາມພໍໃຈລູກຄ້າ (ທັງໝົດ) · ຕໍ່າ = ດີ',
        child: Row(
          children: [
            _Mini(
              label: 'ຄະແນນສະເລ່ຍ',
              valueText: d.feedbackAvg == null ? '-' : d.feedbackAvg!.toStringAsFixed(2),
              tone: _scoreTone(d.feedbackAvg),
            ),
            _Mini(label: 'ໃບທີ່ປະເມີນ', value: d.feedbackJobs),
            _Mini(
              label: 'ບໍ່ພໍໃຈ',
              value: d.feedbackUnhappy,
              tone: d.feedbackUnhappy > 0 ? danger : muted,
            ),
          ],
        ),
      ),

      // ── ⑤ ຊ່າງ — ລຽງດ້ວຍ "ຄ້າງເກີນ 30 ມື້" ບໍ່ແມ່ນ "ຈຳນວນວຽກ" ──
      if (d.techBacklog.isNotEmpty)
        _Card(
          title: 'ກອງວຽກຂອງແຕ່ລະຊ່າງ (ແດງ = ຄ້າງເກີນ 30 ມື້)',
          child: Column(children: [
            for (final t in d.techBacklog)
              _BacklogRow(row: t, onTap: () => _open('tech:${t.techCode}', '${t.tech} · ວຽກຄ້າງ')),
          ]),
        ),

      if (d.techFree.isNotEmpty)
        _Card(
          title: 'ຊ່າງວ່າງ (${d.techFree.length})',
          child: Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              for (final name in d.techFree)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                  decoration: BoxDecoration(
                    color: ok.withValues(alpha: .10),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: ok.withValues(alpha: .30)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle, size: 14, color: ok),
                      const SizedBox(width: 5),
                      Text(name, style: const TextStyle(fontSize: 12.5, color: ink, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
            ],
          ),
        ),

      // ── ⑥ ຄິວມື້ນີ້ + ຂັ້ນຕອນ — ຂໍ້ມູນປະກອບ ບໍ່ຕ້ອງການການຕັດສິນ ⇒ ຢູ່ທ້າຍ ──
      _Card(
        title: 'ມື້ນີ້',
        child: Column(
          children: [
            Row(
              children: [
                _Mini(label: 'ເບີດງານ', value: d.todayReceived, tone: teal,
                    onTap: () => _open('today:received', 'ຮັບເຄື່ອງເຂົ້າມື້ນີ້')),
                _Mini(label: 'ສົ່ງຄືນ', value: d.todayReturned, tone: ok,
                    onTap: () => _open('today:returned', 'ສົ່ງຄືນລູກຄ້າມື້ນີ້')),
                _Mini(label: 'ນັດໝາຍ', value: d.todayAppointments),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _Mini(label: 'ກຳລັງກວດ', value: d.todayChecking),
                _Mini(label: 'ກຳລັງສ້ອມ', value: d.todayRepairing),
                const Spacer(),
              ],
            ),
          ],
        ),
      ),

      _Card(
        title: 'SLA ງານກວດ',
        child: Row(
          children: [
            _Mini(label: 'ໃກ້ເກີນ', value: d.slaWarning, tone: const Color(0xFFD97706)),
            _Mini(label: 'ເລີຍ', value: d.slaLate, tone: danger,
                onTap: () => _open('sla-late', 'ເກີນເວລາທີ່ສັນຍາໄວ້ (SLA)')),
            _Mini(label: 'ວິກິດ', value: d.slaCritical, tone: danger),
          ],
        ),
      ),

      _Card(
        title: 'ຂັ້ນຕອນງານສ້ອມ (ແຕະຊື່ຂັ້ນເພື່ອເບິ່ງລາຍການ)',
        child: _PipelineChart(
          pipeline: d.pipeline,
          onTap: (stage) => _open('stage:${stage.stage}', stage.label),
        ),
      ),
    ];
  }
}

/// ຄະແນນຄວາມພໍໃຈ **ຕໍ່າ = ດີ** — ກົດດຽວກັບ scoreTone ຂອງ /dashboard ຝັ່ງເວັບ
Color _scoreTone(double? score) {
  if (score == null) return muted;
  if (score >= 2.5) return danger;
  if (score >= 1.5) return const Color(0xFFD97706);
  return ok;
}

/// ຫຍໍ້ຈຳນວນເງິນໃຫ້ພໍດີຈໍມືຖື (62,009 → 62.0K · 1,250,000 → 1.3M)
String _money(double value) {
  if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
  return value.toStringAsFixed(0);
}

/// ປຸ່ມທາງລັດໄປໜ້າອື່ນ (ແຜນທີ່ · ຄ່າຄອມ)
class _ShortcutButton extends StatelessWidget {
  const _ShortcutButton({
    required this.icon,
    required this.label,
    required this.tone,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(14),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tone.withValues(alpha: .28)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 19, color: tone),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: ink),
            ),
          ),
          Icon(Icons.chevron_right, size: 16, color: tone.withValues(alpha: .7)),
        ],
      ),
    ),
  );
}

class _ActionItem {
  const _ActionItem(this.label, this.value, this.tone, this.onTap);
  final String label;
  final int value;
  final Color tone;
  final VoidCallback onTap;
}

/// ບັດ "ຕ້ອງລົງມື" 1 ອັນ — ຕົວເລກເດັ່ນ ປ້າຍນ້ອຍ
class _ActionChip extends StatelessWidget {
  const _ActionChip({required this.item});
  final _ActionItem item;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: item.onTap,
    borderRadius: BorderRadius.circular(14),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: item.tone.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: item.tone.withValues(alpha: .28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '${item.value}',
            style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: item.tone),
          ),
          const SizedBox(width: 7),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 150),
            child: Text(
              item.label,
              style: const TextStyle(fontSize: 12, color: ink, fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 2),
          Icon(Icons.chevron_right, size: 15, color: item.tone.withValues(alpha: .7)),
        ],
      ),
    ),
  );
}

/// ແຖບອາຍຸ 4 ຖັງ — ບໍ່ຫຼົ້ນກັນ ລວມ = ງານເປີດທັງໝົດ
class _AgeBar extends StatelessWidget {
  const _AgeBar({required this.aging, required this.total, required this.onTap});
  final List<OverviewAge> aging;
  final int total;
  final void Function(OverviewAge) onTap;

  static const _colors = {
    'd7': ok,
    'd14': Color(0xFFFDE047),
    'd30': Color(0xFFFBBF24),
    'over30': danger,
  };

  @override
  Widget build(BuildContext context) {
    if (total <= 0) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: SizedBox(
            height: 10,
            child: Row(
              children: [
                for (final bucket in aging)
                  if (bucket.count > 0)
                    Expanded(
                      flex: bucket.count,
                      child: ColoredBox(color: _colors[bucket.key] ?? muted),
                    ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 14,
          runSpacing: 4,
          children: [
            for (final bucket in aging)
              InkWell(
                onTap: () => onTap(bucket),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: _colors[bucket.key] ?? muted,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${bucket.count} · ${bucket.label}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: ink,
                          decoration: TextDecoration.underline,
                          decorationColor: faint,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// 1 ແຖວຂອງ "ໃບທີ່ຄ້າງດົນສຸດ"
class _OldJobRow extends StatelessWidget {
  const _OldJobRow({required this.job});
  final OverviewOldJob job;

  @override
  Widget build(BuildContext context) => InkWell(
    /**
     * ແປງເປັນ MonitorJob ແລ້ວເປີດ sheet ອັນດຽວກັບໜ້າຕິດຕາມງານ ⇒ ຜູ້ຈັດການເຫັນ
     * ລາຍລະອຽດແບບດຽວກັນທຸກບ່ອນ. ບໍ່ມີ SLA ຢູ່ບັດນີ້ ⇒ sla_left = null (ຈະສະແດງອາຍຸແທນ).
     */
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
    borderRadius: BorderRadius.circular(10),
    child: Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 44,
          child: Text(
            '${job.days}',
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: job.days > 30 ? danger : ink,
            ),
          ),
        ),
        const SizedBox(width: 4),
        const Padding(
          padding: EdgeInsets.only(top: 4),
          child: Text('ມື້', style: TextStyle(fontSize: 10, color: muted)),
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
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ink),
              ),
              Text(
                '${job.custName ?? '-'} · ${job.stageLabel} · ${job.tech ?? 'ຍັງບໍ່ມີຊ່າງ'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: muted),
              ),
            ],
          ),
        ),
        const Icon(Icons.chevron_right, size: 17, color: faint),
      ],
    ),
    ),
  );
}

/// 1 ແຖວຂອງ "ກອງວຽກຂອງແຕ່ລະຊ່າງ" — ແດງ = ຄ້າງເກີນ 30 ມື້
class _BacklogRow extends StatelessWidget {
  const _BacklogRow({required this.row, required this.onTap});
  final OverviewBacklog row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(10),
    child: Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        SizedBox(
          width: 84,
          child: Text(
            row.tech,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: ink),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: SizedBox(
              height: 8,
              child: Row(
                children: [
                  if (row.stale > 0) Expanded(flex: row.stale, child: const ColoredBox(color: danger)),
                  if (row.open - row.stale > 0)
                    Expanded(flex: row.open - row.stale, child: const ColoredBox(color: teal)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 96,
          child: Text(
            row.stale > 0
                ? '${row.open} ໃບ · ຄ້າງ ${row.stale}'
                : '${row.open} ໃບ · ${row.oldestDays} ມື້',
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 11,
              color: row.stale > 0 ? danger : muted,
              fontWeight: row.stale > 0 ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ),
        const Icon(Icons.chevron_right, size: 17, color: faint),
      ],
    ),
    ),
  );
}

/* ── ຊິ້ນສ່ວນ UI ─────────────────────────────────────────────────── */

/// chart ຂັ້ນຕອນງານສ້ອມ — bar ຕໍ່ຂັ້ນ (ຕົວເລກຢູ່ເທິງແທ່ງ · ຊື່ຂັ້ນຢູ່ລຸ່ມ)
class _PipelineChart extends StatelessWidget {
  const _PipelineChart({required this.pipeline, required this.onTap});
  final List<OverviewStage> pipeline;
  final void Function(OverviewStage) onTap;

  @override
  Widget build(BuildContext context) {
    if (pipeline.isEmpty) return const SizedBox.shrink();
    final maxV = pipeline.map((s) => s.count).fold<int>(0, (a, b) => a > b ? a : b);
    final maxY = (maxV <= 0 ? 1 : maxV).toDouble();
    return SizedBox(
      height: 180,
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
                const TextStyle(color: ink, fontSize: 10.5, fontWeight: FontWeight.w900),
              ),
            ),
          ),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (v) => const FlLine(color: Color(0xFFECF1EF), strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 40,
                getTitlesWidget: (value, meta) {
                  final i = value.toInt();
                  if (i < 0 || i >= pipeline.length) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: SizedBox(
                      width: 46,
                      child: InkWell(
                        onTap: () => onTap(pipeline[i]),
                        child: Text(
                          pipeline[i].label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 8.5,
                            color: ink,
                            height: 1.1,
                            decoration: TextDecoration.underline,
                            decorationColor: faint,
                          ),
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
                    color: teal,
                    width: 15,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  /// ປຸ່ມນ້ອຍມູມຂວາຂອງຫົວກາດ (ເຊັ່ນ "ເບິ່ງທັງໝົດ")
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 12),
    padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE2E8F0)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: ink),
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

class _Mini extends StatelessWidget {
  const _Mini({
    required this.label,
    this.value,
    this.valueText,
    this.tone = ink,
    this.onTap,
  });
  final String label;
  final int? value;
  final String? valueText;
  final Color tone;
  /// ມີ = ແຕະເປີດລາຍການໄດ້ (ຂີດກ້ອງປ້າຍໃຫ້ຮູ້ວ່າກົດໄດ້)
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Column(
        children: [
          Text(
            valueText ?? '${value ?? 0}',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: tone),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              color: muted,
              decoration: onTap == null ? null : TextDecoration.underline,
              decorationColor: faint,
            ),
          ),
        ],
      ),
    ),
  );
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.cloud_off_rounded, size: 44, color: muted),
        const SizedBox(height: 12),
        Text(message, style: const TextStyle(color: muted)),
        const SizedBox(height: 12),
        FilledButton(onPressed: onRetry, child: const Text('ລອງໃໝ່')),
      ],
    ),
  );
}
