import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../api.dart';
import '../job_urgency.dart';
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

  /// ໃບທີ່ຍັງຕ້ອງລົງມື (server ບອກຜ່ານ `action`) — **ຮີບກ່ອນຢູ່ເທິງ**
  /// ໃຊ້ນິຍາມຄວາມຮີບອັນດຽວກັບໜ້າລາຍການວຽກ (lib/job_urgency.dart)
  List<Job> get _actionable =>
      jobs.where((j) => actionable.contains(j.action)).toList()..sort(byUrgency);

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
                /*
                  ── ໜຶ່ງບັດເດັ່ນ + ແຖວກະທັດຮັດ (ແກ້ 25-08-2026) ──
                  ແຕ່ກ່ອນ 3 ບັດໃຫຍ່ ແຕ່ລະບັດມີປຸ່ມ "ເລີ່ມເລີຍ" ເຕັມແຖວ ⇒ ປຸ່ມມິ້ນ
                  ຊ້ຳກັນ 3 ເທື່ອກິນຈໍໝົດ, ບໍ່ມີອັນໃດເດັ່ນກວ່າອັນໃດ ແລະ **ບໍ່ບອກເລີຍ
                  ວ່າອັນໃດຮີບ**. ດຽວນີ້: ໃບທຳອິດ (ຮີບສຸດ) ເປັນບັດມີປຸ່ມອັນດຽວ ·
                  ທີ່ເຫຼືອເປັນແຖວບາງໆ ມີຊິບເວລາ ⇒ ເຫັນໄດ້ 5 ໃບໃນເນື້ອທີ່ເກົ່າຂອງ 2 ໃບ.
                */
                BandHeader('ຕໍ່ໄປ', count: left, color: ink),
                const SizedBox(height: 8),
                _heroJob(_actionable.first),
                if (left > 1) ...[
                  const SizedBox(height: 14),
                  const BandHeader('ຖັດຈາກນັ້ນ'),
                  const SizedBox(height: 6),
                  for (final job in _actionable.skip(1).take(4)) ...[
                    _compactJob(job),
                    const SizedBox(height: 7),
                  ],
                ],
                if (left > 5)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      'ອີກ ${left - 5} ໃບ ຢູ່ແທັບ “ວຽກ”',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: faint, fontSize: 12),
                    ),
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
    padding: const EdgeInsets.all(20),
    decoration: cardDecoration(color: surface, borderRadius: 24),
    child: Row(
      children: [
        SizedBox(
          width: 116,
          height: 116,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 116,
                height: 116,
                child: CircularProgressIndicator(
                  value: done / target,
                  strokeWidth: 12,
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
                      fontSize: 27,
                      fontWeight: FontWeight.w900,
                      color: ink,
                      height: 1.1,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  const Text('ມື້ນີ້', style: TextStyle(fontSize: 12, color: faint)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 18),
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
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14.5, color: body, fontWeight: FontWeight.w600),
          ),
        ),
        Text(
          '$value',
          style: const TextStyle(
            fontSize: 17,
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
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
      decoration: cardDecoration(color: surface, borderRadius: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('ຄ່າຄອມເດືອນນີ້', style: TextStyle(fontSize: 13.5, color: faint)),
              const Spacer(),
              Text(
                '${money?.jobs ?? 0} ໃບ',
                style: const TextStyle(fontSize: 13.5, color: faint),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _thb(money?.totalThb ?? 0),
                style: const TextStyle(
                  fontSize: 40,
                  fontWeight: FontWeight.w900,
                  color: tealBright,
                  letterSpacing: -1,
                  height: 1.1,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 7),
              const Text('ບາທ', style: TextStyle(fontSize: 15, color: faint)),
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

  void _open(Job job) => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => JobScreen(job: job)),
      ).then((_) => load());

  /// ລູກຄ້າ · ບ່ອນຢູ່ — ຄ່າ "." / "-" ຂອງຂໍ້ມູນເກົ່າ ບໍ່ໄດ້ບອກຫຍັງ ⇒ ຢ່າເອົາມາກິນເນື້ອທີ່
  String _who(Job job) {
    bool real(String? value) {
      final text = (value ?? '').trim();
      return text.isNotEmpty && text != '.' && text != '-';
    }

    return [
      if (real(job.customer)) job.customer!.trim(),
      if (real(job.address)) job.address!.trim(),
    ].join(' · ');
  }

  Color _tone(Job job) => switch (urgencyOf(job)) {
        Urgency.late_ => danger,
        Urgency.today => warn,
        _ => teal,
      };

  /// ໃບ **ຮີບສຸດ** — ອັນດຽວທີ່ມີປຸ່ມ. ບອກຄຳສັ່ງ (ບໍ່ແມ່ນຊື່ສິນຄ້າ) ເປັນແຖວທຳອິດ
  /// ແລະ ຊິບເວລາຢູ່ຂວາ ⇒ ຮູ້ທັນທີວ່າ "ເລີ່ມເລີຍ" ນີ້ໝາຍເຖິງເຮັດຫຍັງ ແລະ ຮີບປານໃດ.
  Widget _heroJob(Job job) {
    final time = timeOf(job);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: cardDecoration(color: surface, borderRadius: 18),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 5, color: _tone(job)),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(13, 12, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            actionVerb(job, phaseLabel: job.stageLabel),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: ink,
                              letterSpacing: -.2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        TimeChip(time.label, tone: time.tone),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        job.product ?? '-',
                        job.code,
                        if ((job.customer ?? '').trim().isNotEmpty) job.customer!.trim(),
                      ].join(' · '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: muted, height: 1.4),
                    ),
                    const SizedBox(height: 11),
                    SizedBox(
                      height: kPrimaryTouch,
                      child: FilledButton.icon(
                        onPressed: () => _open(job),
                        icon: const Icon(Icons.play_arrow_rounded, size: 21),
                        label: const Text(
                          'ເລີ່ມເລີຍ',
                          style: TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// ໃບຖັດໄປ — ແຖວບາງໆ ບໍ່ມີປຸ່ມ (ກົດແຖວ = ເປີດ). ໃສ່ໄດ້ 4 ໃບໃນເນື້ອທີ່ຂອງບັດດຽວ.
  Widget _compactJob(Job job) {
    final time = timeOf(job);
    return Material(
      color: surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () => _open(job),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.fromLTRB(11, 10, 10, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(color: _tone(job), shape: BoxShape.circle),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ແຖວ 1: ຄຳສັ່ງ + ເວລາ
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            actionVerb(job, phaseLabel: job.stageLabel),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: ink,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        TimeChip(time.label, tone: time.tone),
                        const Icon(Icons.chevron_right_rounded, size: 20, color: faint),
                      ],
                    ),
                    const SizedBox(height: 3),
                    // ແຖວ 2: ເລກໃບ + ສິນຄ້າ
                    Row(
                      children: [
                        Text(
                          job.code,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                            color: teal,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            job.product ?? '-',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12.5, color: body),
                          ),
                        ),
                      ],
                    ),
                    // ແຖວ 3: ລູກຄ້າ + ບ່ອນຢູ່ (ຂໍ້ມູນທີ່ຕ້ອງໃຊ້ຕອນຕັດສິນວ່າຈະໄປໃສກ່ອນ)
                    if (_who(job).isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        _who(job),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5, color: faint),
                      ),
                    ],
                    // ແຖວ 4: ປ້າຍພິເສດ — ຮອບທີ່ກັບໄປ · check-in ຄ້າງ · ໜ້າງານ
                    if (job.visitRounds > 0 || job.checkedIn || job.onsite) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          if (job.checkedIn) ...[
                            const Icon(Icons.location_on, size: 13, color: ok),
                            const SizedBox(width: 3),
                            const Text(
                              'check-in ແລ້ວ',
                              style: TextStyle(fontSize: 10.5, color: ok, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(width: 9),
                          ] else if (job.onsite) ...[
                            const Icon(Icons.home_work_outlined, size: 13, color: faint),
                            const SizedBox(width: 3),
                            const Text(
                              'ໜ້າງານ',
                              style: TextStyle(fontSize: 10.5, color: faint, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(width: 9),
                          ],
                          if (job.visitRounds > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: tealTint,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'ຮອບທີ ${job.checkedIn ? job.visitRounds : job.visitRounds + 1}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  color: teal,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

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
