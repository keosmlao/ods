import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../streak.dart';
import '../widgets/ui_kit.dart';
import 'job_screen.dart';
import 'notifications_screen.dart';

/// **ໜ້າ "ມື້ນີ້"** — ໜ້າທຳອິດຂອງຊ່າງ (v6 NIGHT).
///
/// ── ເປັນຫຍັງມີໜ້ານີ້ ──
/// ແຕ່ກ່ອນເປີດແອັບມາຮອດ**ລາຍການວຽກ**ເລີຍ — ຄືເປີດກ່ອງໜ້າວຽກຂອງບໍລິສັດ.
/// ໜ້ານີ້ຕອບຄຳຖາມທີ່ຊ່າງຖາມຕົນເອງທຸກມື້ແທນ: *ມື້ນີ້ຂ້ອຍໄປຮອດໃສແລ້ວ ແລະ ໄດ້ເທົ່າໃດ*.
/// ທຸກຕົວເລກມາຈາກສິ່ງທີ່ລະບົບເກັບຢູ່ແລ້ວ (ຄ່າຄອມທີ່ແຊ່ຕອນປິດງານ + ຄິວວຽກ) —
/// ບໍ່ມີການປະດິດຕົວຊີ້ວັດໃໝ່.
class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  List<Job> jobs = const [];
  Income? income;
  String username = '';
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    Api.savedUsername().then((name) {
      if (mounted && name != null) setState(() => username = name);
    });
    load();
  }

  Future<void> load() async {
    try {
      // ວຽກ = ຫົວໃຈຂອງໜ້າ · ລາຍຮັບ = ເສີມ ⇒ ລາຍຮັບລົ້ມກໍ່ຍັງສະແດງໜ້າໄດ້
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

  /// ໃບທີ່ຍັງຕ້ອງລົງມື (server ບອກຜ່ານ `action`)
  List<Job> get _actionable =>
      jobs.where((j) => const {'accept', 'start', 'finish'}.contains(j.action)).toList();

  int get _doneToday => closedToday(income?.rows ?? const [], );

  int get _streak => streakDays(
        (income?.rows ?? const [])
            .map((row) => parseClosedAt(row['closed_at'] as String?))
            .whereType<DateTime>(),
      );

  @override
  Widget build(BuildContext context) {
    final done = _doneToday;
    final left = _actionable.length;
    final target = math.max(done + left, 1);

    return Scaffold(
      backgroundColor: ground,
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
          children: [
            SafeArea(bottom: false, child: _greeting()),
            const SizedBox(height: 12),
            if (loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              )
            else ...[
              if (error.isNotEmpty) ...[
                _errorNote(),
                const SizedBox(height: 12),
              ],
              _todayCard(done: done, left: left, target: target),
              const SizedBox(height: 12),
              _moneyCard(),
              const SizedBox(height: 16),
              if (_actionable.isEmpty)
                _allDone()
              else ...[
                BandHeader('ຕ້ອງເຮັດຕໍ່', count: left, color: ink),
                const SizedBox(height: 8),
                // ສະແດງແຕ່ 3 ໃບ — ໜ້ານີ້ບອກ "ອັນຕໍ່ໄປ" ບໍ່ແມ່ນລາຍການທັງໝົດ
                for (final job in _actionable.take(3)) ...[
                  _nextJob(job),
                  const SizedBox(height: 10),
                ],
                if (left > 3)
                  Text(
                    'ອີກ ${left - 3} ໃບ ຢູ່ແທັບ “ວຽກ”',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: faint, fontSize: 12),
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _greeting() => Padding(
    padding: const EdgeInsets.fromLTRB(2, 10, 0, 0),
    child: Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: teal, borderRadius: BorderRadius.circular(999)),
          alignment: Alignment.center,
          child: Text(
            username.isEmpty ? '·' : username.characters.first.toUpperCase(),
            style: const TextStyle(color: onAccent, fontWeight: FontWeight.w900, fontSize: 17),
          ),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                username.isEmpty ? 'ສະບາຍດີ' : 'ສະບາຍດີ, $username',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: ink),
              ),
              const Text('ມື້ນີ້ເຮັດຫຍັງແດ່', style: TextStyle(fontSize: 11.5, color: faint)),
            ],
          ),
        ),
        if (_streak > 0) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
            decoration: BoxDecoration(
              color: warnTint,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: warn.withValues(alpha: .4)),
            ),
            child: Text(
              '🔥 $_streak',
              style: const TextStyle(color: warn, fontWeight: FontWeight.w900, fontSize: 13),
            ),
          ),
          const SizedBox(width: 8),
        ],
        RoundIconButton(
          icon: Icons.notifications_none,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const NotificationsScreen()),
          ),
        ),
      ],
    ),
  );

  Widget _todayCard({required int done, required int left, required int target}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: cardDecoration(color: surface, borderRadius: 22),
    child: Row(
      children: [
        SizedBox(
          width: 92,
          height: 92,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 92,
                height: 92,
                child: CircularProgressIndicator(
                  value: done / target,
                  strokeWidth: 9,
                  backgroundColor: surfaceAlt,
                  color: tealBright,
                  strokeCap: StrokeCap.round,
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$done/$target',
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                      color: ink,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  const Text('ມື້ນີ້', style: TextStyle(fontSize: 10.5, color: faint)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _line(ok, 'ຈົບແລ້ວມື້ນີ້', done),
              _line(teal, 'ຍັງຕ້ອງລົງມື', left),
              _line(warn, 'ລໍຄົນອື່ນ', jobs.length - left),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _line(Color color, String label, int value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3.5),
    child: Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text(label, style: const TextStyle(fontSize: 12.5, color: body)),
        ),
        Text(
          '$value',
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w900,
            color: ink,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      ],
    ),
  );

  Widget _moneyCard() {
    final money = income;
    // ຍັງບໍ່ເຊື່ອມ ERP = ບອກໃຫ້ໄປຫາຜູ້ຈັດການ (ຢ່າສະແດງ 0 ງຽບໆ ⇒ ຊ່າງເຂົ້າໃຈວ່າບໍ່ໄດ້ເງິນ)
    if (money != null && !money.linked) {
      return Container(
        padding: const EdgeInsets.all(15),
        decoration: cardDecoration(color: surface, borderRadius: 22),
        child: const Row(
          children: [
            Icon(Icons.link_off_rounded, size: 18, color: warn),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'ຍັງບໍ່ໄດ້ເຊື່ອມລະຫັດພະນັກງານ — ແຈ້ງຜູ້ຈັດການ ຈຶ່ງຈະເຫັນຄ່າຄອມ',
                style: TextStyle(fontSize: 12.5, color: body),
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 15),
      decoration: cardDecoration(color: surface, borderRadius: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('ຄ່າຄອມເດືອນນີ້', style: TextStyle(fontSize: 12, color: faint)),
              const Spacer(),
              Text(
                '${money?.jobs ?? 0} ໃບ',
                style: const TextStyle(fontSize: 12, color: faint),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _thb(money?.totalThb ?? 0),
                style: const TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  color: tealBright,
                  letterSpacing: -.5,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 6),
              const Text('ບາທ', style: TextStyle(fontSize: 13, color: faint)),
            ],
          ),
        ],
      ),
    );
  }

  static String _thb(double value) {
    final whole = value.round().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
      buffer.write(whole[i]);
    }
    return buffer.toString();
  }

  Widget _nextJob(Job job) => Container(
    decoration: cardDecoration(color: surface, borderRadius: 18),
    padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          job.product ?? job.code,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: ink),
        ),
        const SizedBox(height: 3),
        Text(
          [job.code, if ((job.customer ?? '').trim().isNotEmpty) job.customer!.trim()].join(' · '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12, color: muted),
        ),
        const SizedBox(height: 11),
        SizedBox(
          height: kPrimaryTouch,
          child: FilledButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => JobScreen(job: job)),
            ).then((_) => load()),
            icon: const Icon(Icons.play_arrow_rounded, size: 21),
            label: const Text('ເລີ່ມເລີຍ', style: TextStyle(fontWeight: FontWeight.w900)),
          ),
        ),
      ],
    ),
  );

  Widget _allDone() => Container(
    padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 18),
    decoration: cardDecoration(color: surface, borderRadius: 22),
    child: const Column(
      children: [
        Text('🎯', style: TextStyle(fontSize: 34)),
        SizedBox(height: 10),
        Text(
          'ບໍ່ມີວຽກຄ້າງລໍເຈົ້າດຽວນີ້',
          style: TextStyle(fontWeight: FontWeight.w900, color: ink, fontSize: 15),
        ),
        SizedBox(height: 4),
        Text(
          'ໃບທີ່ເຫຼືອກຳລັງລໍຄົນອື່ນຢູ່',
          style: TextStyle(color: faint, fontSize: 12.5),
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
