import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'login_screen.dart';
import 'manager_kit.dart';

/// ລາຍງານ (ຜູ້ຈັດການ) — ແນວໂນ້ມ 14 ມື້ (ເປີດ vs ປິດ) + ຄ່າຄອມເດືອນນີ້.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Reports? data;
  bool loading = true;
  String error = '';
  int selectedDays = 14;

  List<ReportDay> get visibleDays {
    final rows = data?.days ?? [];
    if (rows.length <= selectedDays) return rows;
    return rows.sublist(rows.length - selectedDays);
  }

  int get opened => visibleDays.fold(0, (sum, day) => sum + day.opened);
  int get closed => visibleDays.fold(0, (sum, day) => sum + day.closed);

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.reports();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ລາຍງານ',
            trailing: [
              HeroIconButton(icon: Icons.refresh_rounded, onTap: load),
            ],
            stats: data == null
                ? null
                : [
                    HeroStat(value: '$opened', label: 'ງານເຂົ້າ'),
                    HeroStat(
                      value: '$closed',
                      label: 'ງານຈົບ',
                      color: const Color(0xFF6EE7B7),
                    ),
                  ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? ErrorRetry(message: error, onRetry: load)
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(14, 6, 14, 28),
                      children: [
                        _PeriodSelector(
                          value: selectedDays,
                          onChanged: (value) =>
                              setState(() => selectedDays = value),
                        ),
                        const SizedBox(height: 14),
                        _ReportSummary(days: visibleDays),
                        const SizedBox(height: 14),
                        MCard(
                          title: 'ແນວໂນ້ມງານ $selectedDays ມື້',
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  _legend('ເປີດ', teal),
                                  const SizedBox(width: 14),
                                  _legend('ປິດ', tealBright),
                                ],
                              ),
                              const SizedBox(height: 10),
                              _TrendChart(days: visibleDays),
                            ],
                          ),
                        ),
                        _PerformanceInsight(days: visibleDays),
                        if (data!.commissionMonthThb != null)
                          MCard(
                            title: 'ຄ່າຄອມຈ່າຍ (ເດືອນນີ້ · ບໍລິສັດ)',
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '฿${_number(data!.commissionMonthThb!)}',
                                  style: const TextStyle(
                                    fontSize: 30,
                                    fontWeight: FontWeight.w900,
                                    color: teal,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 5),
                                  child: Text(
                                    'ຈາກ ${data!.commissionMonthJobs} ໃບປິດ',
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: muted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        MCard(
                          title: 'ຜົນງານລາຍວັນ',
                          child: Column(
                            children: [
                              for (final day in visibleDays.reversed.take(7))
                                _DayRow(day: day),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _legend(String label, Color c) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: c,
          borderRadius: BorderRadius.circular(3),
        ),
      ),
      const SizedBox(width: 5),
      Text(
        label,
        style: const TextStyle(
          fontSize: 11.5,
          color: muted,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _PeriodSelector extends StatelessWidget {
  const _PeriodSelector({required this.value, required this.onChanged});
  final int value;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: const Color(0xFFE8EFED),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      children: [
        _PeriodButton(
          label: '7 ມື້',
          selected: value == 7,
          onTap: () => onChanged(7),
        ),
        _PeriodButton(
          label: '14 ມື້',
          selected: value == 14,
          onTap: () => onChanged(14),
        ),
      ],
    ),
  );
}

class _PeriodButton extends StatelessWidget {
  const _PeriodButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(11),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(11),
          boxShadow: selected
              ? [BoxShadow(color: ink.withValues(alpha: .07), blurRadius: 8)]
              : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            color: selected ? ink : muted,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    ),
  );
}

class _ReportSummary extends StatelessWidget {
  const _ReportSummary({required this.days});
  final List<ReportDay> days;
  @override
  Widget build(BuildContext context) {
    final opened = days.fold<int>(0, (sum, d) => sum + d.opened);
    final closed = days.fold<int>(0, (sum, d) => sum + d.closed);
    final rate = opened == 0 ? 0 : (closed * 100 / opened).round();
    final balance = closed - opened;
    return Column(
      children: [
        Row(
          children: [
            _SummaryCard(
              label: 'ງານເຂົ້າ',
              value: '$opened',
              note:
                  'ສະເລ່ຍ ${(opened / (days.isEmpty ? 1 : days.length)).toStringAsFixed(1)}/ມື້',
              icon: Icons.south_west_rounded,
              color: teal,
            ),
            const SizedBox(width: 10),
            _SummaryCard(
              label: 'ງານຈົບ',
              value: '$closed',
              note:
                  'ສະເລ່ຍ ${(closed / (days.isEmpty ? 1 : days.length)).toStringAsFixed(1)}/ມື້',
              icon: Icons.task_alt_rounded,
              color: ok,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _SummaryCard(
              label: 'ອັດຕາປິດ',
              value: '$rate%',
              note: rate >= 100 ? 'ປິດທັນງານເຂົ້າ' : 'ຍັງຕ່ຳກວ່າງານເຂົ້າ',
              icon: Icons.speed_rounded,
              color: rate >= 100 ? ok : warn,
            ),
            const SizedBox(width: 10),
            _SummaryCard(
              label: 'ດຸນກອງວຽກ',
              value: balance > 0 ? '+$balance' : '$balance',
              note: balance >= 0 ? 'ກອງວຽກຫຼຸດລົງ' : 'ກອງວຽກເພີ່ມຂຶ້ນ',
              icon: balance >= 0
                  ? Icons.trending_down_rounded
                  : Icons.trending_up_rounded,
              color: balance >= 0 ? ok : danger,
            ),
          ],
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.note,
    required this.icon,
    required this.color,
  });
  final String label;
  final String value;
  final String note;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 18),
              const Spacer(),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10.5,
                  color: muted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 13),
          Text(
            value,
            style: TextStyle(
              fontSize: 25,
              height: 1,
              color: color,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            note,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 9.5,
              color: faint,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );
}

class _PerformanceInsight extends StatelessWidget {
  const _PerformanceInsight({required this.days});
  final List<ReportDay> days;
  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox.shrink();
    final best = days.reduce((a, b) => a.closed >= b.closed ? a : b);
    final opened = days.fold<int>(0, (sum, d) => sum + d.opened);
    final closed = days.fold<int>(0, (sum, d) => sum + d.closed);
    final improving = closed >= opened;
    return MCard(
      title: 'ຂໍ້ສະຫຼຸບ',
      child: Column(
        children: [
          _InsightRow(
            icon: improving
                ? Icons.thumb_up_alt_outlined
                : Icons.warning_amber_rounded,
            color: improving ? ok : warn,
            title: improving ? 'ຄວບຄຸມກອງວຽກໄດ້ດີ' : 'ກອງວຽກກຳລັງເພີ່ມ',
            detail: improving
                ? 'ຈຳນວນງານຈົບບໍ່ຕ່ຳກວ່າງານເຂົ້າ'
                : 'ຄວນເລັ່ງປິດງານ ຫຼື ຈັດສັນກຳລັງຊ່າງເພີ່ມ',
          ),
          const Divider(height: 22),
          _InsightRow(
            icon: Icons.emoji_events_outlined,
            color: const Color(0xFFD97706),
            title: 'ມື້ທີ່ປິດງານໄດ້ສູງສຸດ',
            detail: '${_shortDate(best.date)} · ${best.closed} ງານ',
          ),
        ],
      ),
    );
  }
}

class _InsightRow extends StatelessWidget {
  const _InsightRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.detail,
  });
  final IconData icon;
  final Color color;
  final String title;
  final String detail;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: color.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Icon(icon, color: color, size: 19),
      ),
      const SizedBox(width: 11),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 12.5,
                color: ink,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              detail,
              style: const TextStyle(
                fontSize: 10.5,
                height: 1.35,
                color: muted,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class _DayRow extends StatelessWidget {
  const _DayRow({required this.day});
  final ReportDay day;
  @override
  Widget build(BuildContext context) {
    final delta = day.closed - day.opened;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: line)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              _shortDate(day.date),
              style: const TextStyle(
                fontSize: 11.5,
                color: ink,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          _DayValue(label: 'ເຂົ້າ', value: day.opened, color: teal),
          const SizedBox(width: 16),
          _DayValue(label: 'ຈົບ', value: day.closed, color: ok),
          const SizedBox(width: 14),
          SizedBox(
            width: 36,
            child: Text(
              delta > 0 ? '+$delta' : '$delta',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 11.5,
                color: delta >= 0 ? ok : danger,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DayValue extends StatelessWidget {
  const _DayValue({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final int value;
  final Color color;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.end,
    children: [
      Text(
        '$value',
        style: TextStyle(
          fontSize: 13,
          color: color,
          fontWeight: FontWeight.w900,
        ),
      ),
      Text(label, style: const TextStyle(fontSize: 8.5, color: faint)),
    ],
  );
}

String _shortDate(String value) {
  final parts = value.split('-');
  return parts.length == 3
      ? '${parts[2]}/${parts[1]}/${parts[0].substring(2)}'
      : value;
}

String _number(num value) {
  final digits = value.round().toString();
  return digits.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
}

class _TrendChart extends StatelessWidget {
  const _TrendChart({required this.days});
  final List<ReportDay> days;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox(height: 40);
    double maxV = 1;
    for (final d in days) {
      maxV = [
        maxV,
        d.opened.toDouble(),
        d.closed.toDouble(),
      ].reduce((a, b) => a > b ? a : b);
    }
    final step = (days.length / 5).ceil();
    return SizedBox(
      height: 190,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: maxV * 1.2,
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
                reservedSize: 24,
                interval: 1,
                getTitlesWidget: (value, meta) {
                  final i = value.toInt();
                  if (i < 0 || i >= days.length || i % step != 0) {
                    return const SizedBox.shrink();
                  }
                  final parts = days[i].date.split('-'); // YYYY-MM-DD
                  if (parts.length < 3) {
                    return const SizedBox.shrink(); // ວັນທີວ່າງ/ຜິດຮູບ ⇒ ຢ່າ throw
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '${parts[2]}/${parts[1]}',
                      style: const TextStyle(fontSize: 9, color: muted),
                    ),
                  );
                },
              ),
            ),
          ),
          lineTouchData: const LineTouchData(enabled: false),
          lineBarsData: [
            _line([
              for (var i = 0; i < days.length; i++)
                FlSpot(i.toDouble(), days[i].opened.toDouble()),
            ], teal),
            _line([
              for (var i = 0; i < days.length; i++)
                FlSpot(i.toDouble(), days[i].closed.toDouble()),
            ], tealBright),
          ],
        ),
      ),
    );
  }

  LineChartBarData _line(List<FlSpot> spots, Color c) => LineChartBarData(
    spots: spots,
    isCurved: true,
    curveSmoothness: 0.25,
    color: c,
    barWidth: 2.5,
    dotData: const FlDotData(show: false),
    belowBarData: BarAreaData(show: true, color: c.withValues(alpha: .08)),
  );
}
