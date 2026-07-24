import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import '../widgets/ui_kit.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';

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
    await Push.unregister();
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

  List<Widget> _sections(Overview d) => [
    // ── ຄິວງານມື້ນີ້ ──
    _Card(
      title: 'ມື້ນີ້',
      child: Row(
        children: [
          _Mini(label: 'ນັດໝາຍ', value: d.todayAppointments),
          _Mini(label: 'ກຳລັງກວດ', value: d.todayChecking),
          _Mini(label: 'ກຳລັງສ້ອມ', value: d.todayRepairing),
        ],
      ),
    ),

    // ── ຍັງບໍ່ມອບໝາຍ ──
    if (d.unassignedRepair + d.unassignedInstall > 0)
      _Card(
        title: 'ຍັງບໍ່ມອບໝາຍຊ່າງ',
        child: Row(
          children: [
            _Mini(label: 'ສ້ອມ', value: d.unassignedRepair, tone: danger),
            _Mini(label: 'ຕິດຕັ້ງ', value: d.unassignedInstall, tone: danger),
          ],
        ),
      ),

    // ── ຂັ້ນຕອນງານສ້ອມ (funnel) ──
    _Card(
      title: 'ຂັ້ນຕອນງານສ້ອມ',
      child: Column(
        children: [
          for (final s in d.pipeline) _Bar(label: s.label, value: s.count),
        ],
      ),
    ),

    // ── ລໍອະນຸມັດ ──
    _Card(
      title: 'ລໍອະນຸມັດ',
      child: Column(
        children: [
          _Line(label: 'ໃບສະເໜີລາຄາ (Quotation)', value: d.aQuotes),
          _Line(label: 'ລູກຄ້າອະນຸມັດ', value: d.aCustomer),
          _Line(label: 'ຂໍຊື້ (PR/PO)', value: d.aPurchases),
          _Line(label: 'ຂໍຍົກເລີກ', value: d.aCancels),
        ],
      ),
    ),

    // ── SLA ──
    _Card(
      title: 'SLA ງານກວດ',
      child: Row(
        children: [
          _Mini(
            label: 'ໃກ້ເກີນ',
            value: d.slaWarning,
            tone: const Color(0xFFD97706),
          ),
          _Mini(label: 'ເລີຍ', value: d.slaLate, tone: danger),
          _Mini(label: 'ວິກິດ', value: d.slaCritical, tone: danger),
        ],
      ),
    ),

    // ── ພາລະງານຊ່າງ ──
    if (d.techLoad.isNotEmpty)
      _Card(
        title: 'ພາລະງານຊ່າງ',
        child: Column(
          children: [
            for (final t in d.techLoad)
              _Line(
                label: t.tech,
                value: t.jobs,
                hint: t.oldestSeconds > 0
                    ? 'ເກົ່າສຸດ ${t.oldestSeconds ~/ 86400} ມື້'
                    : null,
              ),
          ],
        ),
      ),

    // ── ຄວາມພໍໃຈລູກຄ້າ ──
    _Card(
      title: 'ຄວາມພໍໃຈລູກຄ້າ (30 ມື້)',
      child: Row(
        children: [
          _Mini(
            label: 'ຄະແນນສະເລ່ຍ',
            valueText: d.feedbackAvg == null
                ? '-'
                : d.feedbackAvg!.toStringAsFixed(1),
            tone: ok,
          ),
          _Mini(label: 'ຈຳນວນ', value: d.feedbackJobs),
          _Mini(
            label: 'ບໍ່ພໍໃຈ',
            value: d.feedbackUnhappy,
            tone: d.feedbackUnhappy > 0 ? danger : muted,
          ),
        ],
      ),
    ),
  ];
}

/* ── ຊິ້ນສ່ວນ UI ─────────────────────────────────────────────────── */

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child});
  final String title;
  final Widget child;

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
        Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
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
  });
  final String label;
  final int? value;
  final String? valueText;
  final Color tone;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          valueText ?? '${value ?? 0}',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: tone,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, color: muted),
        ),
      ],
    ),
  );
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value, this.hint});
  final String label;
  final int value;
  final String? hint;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 13, color: ink),
                overflow: TextOverflow.ellipsis,
              ),
              if (hint != null)
                Text(
                  hint!,
                  style: const TextStyle(fontSize: 10, color: muted),
                ),
            ],
          ),
        ),
        Text(
          '$value',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
      ],
    ),
  );
}

/// ແຖບແນວນອນ — ຄວາມຍາວທຽບກັບຄ່າສູງສຸດໃນ funnel
class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    // ຄ່າສູງສຸດ 20 = ເຕັມແຖບ (ພຽງເພື່ອສາຍຕາ — ບໍ່ແມ່ນສະເກນແທ້)
    final ratio = (value / 20).clamp(0.04, 1.0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: ink),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 10,
                backgroundColor: const Color(0xFFEEF2F1),
                valueColor: const AlwaysStoppedAnimation(teal),
              ),
            ),
          ),
          SizedBox(
            width: 34,
            child: Text(
              '$value',
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
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
