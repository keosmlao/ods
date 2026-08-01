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
  String? selectedStatus;

  Map<String, int> get statusCounts {
    final result = <String, int>{};
    for (final job in data?.jobs ?? <MonitorJob>[]) {
      final status = _techStatus(job.stageLabel);
      result[status] = (result[status] ?? 0) + 1;
    }
    return result;
  }

  List<MonitorJob> get visibleJobs {
    final jobs = data?.jobs ?? <MonitorJob>[];
    if (selectedStatus == null) return jobs;
    return jobs
        .where((job) => _techStatus(job.stageLabel) == selectedStatus)
        .toList();
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.techDetail(widget.code);
      if (!mounted) return;
      setState(() {
        data = result;
        if (selectedStatus != null &&
            !result.jobs.any(
              (job) => _techStatus(job.stageLabel) == selectedStatus,
            )) {
          selectedStatus = null;
        }
        error = '';
        loading = false;
      });
    } on ApiError catch (failure) {
      if (!mounted) return;
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
            title: widget.name,
            eyebrow: data == null
                ? 'ຂໍ້ມູນພະນັກງານ'
                : 'ລະຫັດພະນັກງານ · ${data!.employeeCode}',
            inlineBack: true,
            onBack: () => Navigator.pop(context),
            trailing: [
              HeroIconButton(icon: Icons.refresh_rounded, onTap: load),
            ],
            stats: data == null
                ? null
                : [
                    HeroStat(value: '${data!.openJobs}', label: 'ວຽກຄ້າງ'),
                    HeroStat(
                      value: '${data!.late}',
                      label: 'ເລີຍ SLA',
                      color: data!.late > 0 ? const Color(0xFFFDA4AF) : null,
                    ),
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
                              ? const EmptyHint(
                                  icon: Icons.reviews_outlined,
                                  text: 'ຍັງບໍ່ມີການປະເມີນ',
                                )
                              : Row(
                                  children: [
                                    Text(
                                      '${data!.happyPct}%',
                                      style: TextStyle(
                                        fontSize: 34,
                                        fontWeight: FontWeight.w900,
                                        color: _sat(data!.happyPct),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Text(
                                      '😊',
                                      style: TextStyle(fontSize: 20),
                                    ),
                                    const Spacer(),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${data!.rated} ປະເມີນ',
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: ink,
                                          ),
                                        ),
                                        if (data!.unhappy > 0)
                                          Text(
                                            '${data!.unhappy} ບໍ່ພໍໃຈ',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: danger,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
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
                                Text(
                                  '฿${data!.monthThb!.toStringAsFixed(0)}',
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
                                    'ຈາກ ${data!.monthJobs} ໃບ',
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: muted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (data!.jobs.isNotEmpty)
                          _TechStatusSummary(
                            jobs: data!.jobs,
                            counts: statusCounts,
                            selected: selectedStatus,
                            onSelected: (status) =>
                                setState(() => selectedStatus = status),
                          ),
                        MCard(
                          title: selectedStatus == null
                              ? 'ວຽກຄ້າງທັງໝົດ (${visibleJobs.length})'
                              : '$selectedStatus (${visibleJobs.length})',
                          child: data!.jobs.isEmpty
                              ? const EmptyHint(
                                  icon: Icons.check_circle_outline,
                                  text: 'ບໍ່ມີວຽກຄ້າງ',
                                )
                              : visibleJobs.isEmpty
                              ? const EmptyHint(
                                  icon: Icons.inbox_outlined,
                                  text: 'ບໍ່ມີວຽກໃນສະຖານະນີ້',
                                )
                              : Column(
                                  children: [
                                    for (
                                      var i = 0;
                                      i < visibleJobs.length;
                                      i++
                                    ) ...[
                                      if (i > 0) const Divider(height: 1),
                                      MonitorTile(
                                        job: visibleJobs[i],
                                        showTech: false,
                                      ),
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

  Color _sat(int? pct) => pct == null
      ? muted
      : pct >= 90
      ? ok
      : pct >= 70
      ? warn
      : danger;

  Widget _mini(String label, String value) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: muted)),
      ],
    ),
  );
}

class _TechStatusSummary extends StatelessWidget {
  const _TechStatusSummary({
    required this.jobs,
    required this.counts,
    required this.selected,
    required this.onSelected,
  });
  final List<MonitorJob> jobs;
  final Map<String, int> counts;
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final late = jobs.where((job) => (job.slaLeft ?? 1) < 0).length;
    final stale = jobs.where((job) => job.ageDays >= 30).length;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
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
              const Expanded(
                child: Text(
                  'ກຸ່ມວຽກຕາມສະຖານະ',
                  style: TextStyle(
                    fontSize: 13.5,
                    color: ink,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              if (late > 0) _RiskBadge(label: '$late ເກີນ SLA', color: danger),
              if (late > 0 && stale > 0) const SizedBox(width: 5),
              if (stale > 0)
                _RiskBadge(label: '$stale ເກີນ 30ມື້', color: warn),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            '${counts.length} ສະຖານະທີ່ກຳລັງມີວຽກ',
            style: const TextStyle(fontSize: 10.5, color: muted),
          ),
          const SizedBox(height: 11),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _TechStatusChip(
                  label: 'ທັງໝົດ',
                  count: jobs.length,
                  selected: selected == null,
                  dangerCount: late,
                  onTap: () => onSelected(null),
                ),
                for (final entry in counts.entries) ...[
                  const SizedBox(width: 7),
                  _TechStatusChip(
                    label: entry.key,
                    count: entry.value,
                    selected: selected == entry.key,
                    dangerCount: jobs
                        .where(
                          (job) =>
                              _techStatus(job.stageLabel) == entry.key &&
                              (job.slaLeft ?? 1) < 0,
                        )
                        .length,
                    onTap: () => onSelected(entry.key),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _techStatus(String label) => switch (label) {
  'ລໍຖ້າສ້ອມແປງ' => 'ລໍຖ້າສ້ອມ',
  'ກຳລັງສ້ອມແປງ' => 'ກຳລັງສ້ອມ',
  _ => label,
};

class _RiskBadge extends StatelessWidget {
  const _RiskBadge({required this.label, required this.color});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .09),
      borderRadius: BorderRadius.circular(9),
    ),
    child: Text(
      label,
      style: TextStyle(
        fontSize: 8.5,
        color: color,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _TechStatusChip extends StatelessWidget {
  const _TechStatusChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.dangerCount,
    required this.onTap,
  });
  final String label;
  final int count;
  final bool selected;
  final int dangerCount;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: selected ? ink : const Color(0xFFF3F6F5),
    borderRadius: BorderRadius.circular(12),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
        child: Row(
          children: [
            if (dangerCount > 0) ...[
              Container(
                width: 7,
                height: 7,
                decoration: const BoxDecoration(
                  color: danger,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                color: selected ? Colors.white : ink,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(width: 7),
            Container(
              constraints: const BoxConstraints(minWidth: 21),
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: selected
                    ? Colors.white.withValues(alpha: .16)
                    : Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 9.5,
                  color: selected ? Colors.white : muted,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
