import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'manager_kit.dart';

/// ຜົນງານຊ່າງ 1 ຄົນ — ພາລະ · ຜົນຜະລິດ (ມື້/ອາທິດ/ເດືອນ) · ຄ່າຄອມ · ງານເປີດ.
class TechDetailScreen extends StatefulWidget {
  const TechDetailScreen({super.key, required this.code, required this.name});
  final String code;
  final String name;

  @override
  State<TechDetailScreen> createState() => _TechDetailScreenState();
}

class _TechDetailScreenState extends State<TechDetailScreen> {
  TechDetail? data;
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.techDetail(widget.code);
      if (!mounted) return;
      setState(() { data = result; error = ''; loading = false; });
    } on ApiError catch (failure) {
      if (!mounted) return;
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
            title: widget.name,
            inlineBack: true,
            onBack: () => Navigator.pop(context),
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: data == null
                ? null
                : [
                    HeroStat(value: '${data!.openJobs}', label: 'ວຽກຄ້າງ'),
                    HeroStat(value: '${data!.late}', label: 'ເລີຍ SLA',
                        color: data!.late > 0 ? const Color(0xFFFDA4AF) : null),
                    HeroStat(value: '${data!.monthJobs}', label: 'ຈົບ/ເດືອນ'),
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
                          title: 'ຜົນຜະລິດ (ປິດງານ)',
                          child: Row(
                            children: [
                              _mini('ມື້ນີ້', '${data!.todayClosed}'),
                              _mini('ອາທິດນີ້', '${data!.weekClosed}'),
                              _mini('ເດືອນນີ້', '${data!.monthJobs}'),
                            ],
                          ),
                        ),
                        MCard(
                          title: 'ຄວາມພໍໃຈລູກຄ້າ (ງານຕິດຕັ້ງ)',
                          child: data!.rated == 0
                              ? const EmptyHint(icon: Icons.reviews_outlined, text: 'ຍັງບໍ່ມີການປະເມີນ')
                              : Row(
                                  children: [
                                    Text('${data!.happyPct}%',
                                        style: TextStyle(
                                            fontSize: 34, fontWeight: FontWeight.w900,
                                            color: _sat(data!.happyPct))),
                                    const SizedBox(width: 4),
                                    const Text('😊', style: TextStyle(fontSize: 20)),
                                    const Spacer(),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text('${data!.rated} ປະເມີນ',
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ink)),
                                        if (data!.unhappy > 0)
                                          Text('${data!.unhappy} ບໍ່ພໍໃຈ',
                                              style: const TextStyle(fontSize: 12, color: danger, fontWeight: FontWeight.w700)),
                                      ],
                                    ),
                                  ],
                                ),
                        ),
                        if (data!.monthThb != null)
                          MCard(
                            title: 'ຄ່າຄອມເດືອນນີ້',
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('฿${data!.monthThb!.toStringAsFixed(0)}',
                                    style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: teal)),
                                const SizedBox(width: 8),
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 5),
                                  child: Text('ຈາກ ${data!.monthJobs} ໃບ',
                                      style: const TextStyle(fontSize: 12.5, color: muted)),
                                ),
                              ],
                            ),
                          ),
                        MCard(
                          title: 'ວຽກຄ້າງ (${data!.jobs.length})',
                          child: data!.jobs.isEmpty
                              ? const EmptyHint(icon: Icons.check_circle_outline, text: 'ບໍ່ມີວຽກຄ້າງ')
                              : Column(
                                  children: [
                                    for (var i = 0; i < data!.jobs.length; i++) ...[
                                      if (i > 0) const Divider(height: 1),
                                      MonitorTile(job: data!.jobs[i], showTech: false),
                                    ],
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

  Color _sat(int? pct) => pct == null ? muted : pct >= 90 ? ok : pct >= 70 ? warn : danger;

  Widget _mini(String label, String value) => Expanded(
    child: Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: ink)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: muted)),
      ],
    ),
  );
}
