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

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.reports();
      if (!mounted) return;
      setState(() { data = result; error = ''; loading = false; });
    } on ApiError catch (failure) {
      if (!mounted) return;
      if (failure.status == 401) {
        await Api.clearToken();
        if (!mounted) return;
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
        return;
      }
      setState(() { error = failure.message; loading = false; });
    } catch (_) {
      if (mounted) setState(() { error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້'; loading = false; });
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
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: data == null
                ? null
                : [
                    HeroStat(value: '${data!.totalOpened}', label: 'ເປີດ 14ມື້'),
                    HeroStat(value: '${data!.totalClosed}', label: 'ປິດ 14ມື້', color: const Color(0xFF6EE7B7)),
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
                        MCard(
                          title: 'ເປີດ vs ປິດ (14 ມື້)',
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
                              _TrendChart(days: data!.days),
                            ],
                          ),
                        ),
                        MCard(
                          title: 'ຄ່າຄອມຈ່າຍ (ເດືອນນີ້ · ບໍລິສັດ)',
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('฿${data!.commissionMonthThb.toStringAsFixed(0)}',
                                  style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: teal)),
                              const SizedBox(width: 8),
                              Padding(
                                padding: const EdgeInsets.only(bottom: 5),
                                child: Text('ຈາກ ${data!.commissionMonthJobs} ໃບປິດ',
                                    style: const TextStyle(fontSize: 12.5, color: muted)),
                              ),
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
      Container(width: 10, height: 10, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(3))),
      const SizedBox(width: 5),
      Text(label, style: const TextStyle(fontSize: 11.5, color: muted, fontWeight: FontWeight.w700)),
    ],
  );
}

class _TrendChart extends StatelessWidget {
  const _TrendChart({required this.days});
  final List<ReportDay> days;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox(height: 40);
    double maxV = 1;
    for (final d in days) {
      maxV = [maxV, d.opened.toDouble(), d.closed.toDouble()].reduce((a, b) => a > b ? a : b);
    }
    final step = (days.length / 5).ceil();
    return SizedBox(
      height: 190,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: maxV * 1.2,
          gridData: FlGridData(
            show: true, drawVerticalLine: false,
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
                reservedSize: 24,
                interval: 1,
                getTitlesWidget: (value, meta) {
                  final i = value.toInt();
                  if (i < 0 || i >= days.length || i % step != 0) return const SizedBox.shrink();
                  final parts = days[i].date.split('-'); // YYYY-MM-DD
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text('${parts[2]}/${parts[1]}',
                        style: const TextStyle(fontSize: 9, color: muted)),
                  );
                },
              ),
            ),
          ),
          lineTouchData: const LineTouchData(enabled: false),
          lineBarsData: [
            _line([for (var i = 0; i < days.length; i++) FlSpot(i.toDouble(), days[i].opened.toDouble())], teal),
            _line([for (var i = 0; i < days.length; i++) FlSpot(i.toDouble(), days[i].closed.toDouble())], tealBright),
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
