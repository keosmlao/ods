import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'login_screen.dart';
import 'manager_kit.dart';

/// ລາຍການໃບງານທີ່ຢູ່ເບື້ອງຫຼັງ **ຕົວເລກໜຶ່ງ** ຂອງໜ້າພາບລວມຜູ້ຈັດການ.
///
/// ແຕ່ກ່ອນຕົວເລກຢູ່ໜ້າພາບລວມແຕະບໍ່ໄດ້ ⇒ ຜູ້ຈັດການເຫັນ "ຄ້າງ 46 ໃບ" ແລ້ວກໍ່ຈົນມຸມ:
/// ຕ້ອງໄປເປີດເວັບ ຫຼື ຖາມຄົນອື່ນວ່າແມ່ນໃບໃດແດ່. ດຽວນີ້ທຸກຕົວເລກເປີດລາຍການໄດ້
/// ແລະ ແຕ່ລະແຖວແຕະເບິ່ງລາຍລະອຽດຕໍ່ໄດ້ (MonitorTile ອັນດຽວກັບໜ້າຕິດຕາມງານ).
class OverviewJobsScreen extends StatefulWidget {
  const OverviewJobsScreen({
    super.key,
    required this.bucket,
    required this.title,
  });

  /// ຄີກຸ່ມ — `age:over30` · `unassigned` · `tech:23037` … (ນິຍາມຢູ່ lib/manager-drill)
  final String bucket;

  /// ຫົວຂໍ້ທີ່ຮູ້ຢູ່ແລ້ວຕອນກົດ — ໃຊ້ກ່ອນ server ຕອບ ເພື່ອບໍ່ໃຫ້ຫົວຂໍ້ກະພິບ
  final String title;

  @override
  State<OverviewJobsScreen> createState() => _OverviewJobsScreenState();
}

class _OverviewJobsScreenState extends State<OverviewJobsScreen> {
  List<MonitorJob> jobs = [];
  String label = '';
  bool loading = true;
  String error = '';
  String? selectedStatus;

  bool get splitByStatus => widget.bucket.startsWith('workflow:');

  Map<String, int> get statusCounts {
    final result = <String, int>{};
    for (final job in jobs) {
      result[job.stageLabel] = (result[job.stageLabel] ?? 0) + 1;
    }
    return result;
  }

  List<MonitorJob> get visibleJobs => selectedStatus == null
      ? jobs
      : jobs.where((job) => job.stageLabel == selectedStatus).toList();

  @override
  void initState() {
    super.initState();
    label = widget.title;
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.overviewJobs(widget.bucket);
      if (!mounted) return;
      setState(() {
        jobs = result.jobs;
        if (selectedStatus != null &&
            !result.jobs.any((job) => job.stageLabel == selectedStatus)) {
          selectedStatus = null;
        }
        if (result.label.isNotEmpty) label = result.label;
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
            title: label,
            onBack: () => Navigator.pop(context),
            trailing: [
              HeroIconButton(icon: Icons.refresh_rounded, onTap: load),
            ],
            stats: loading
                ? null
                : [
                    HeroStat(value: '${jobs.length}', label: 'ທັງໝົດ'),
                    if (splitByStatus)
                      HeroStat(
                        value: '${statusCounts.length}',
                        label: 'ສະຖານະ',
                        color: const Color(0xFF6EE7B7),
                      ),
                  ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? ErrorRetry(message: error, onRetry: load)
                : jobs.isEmpty
                ? const EmptyHint(
                    icon: Icons.check_circle_outline,
                    text: 'ບໍ່ມີໃບງານໃນກຸ່ມນີ້',
                  )
                : RefreshIndicator(
                    onRefresh: load,
                    child: CustomScrollView(
                      slivers: [
                        if (splitByStatus)
                          SliverToBoxAdapter(
                            child: _StatusTabs(
                              counts: statusCounts,
                              selected: selectedStatus,
                              total: jobs.length,
                              onSelected: (status) =>
                                  setState(() => selectedStatus = status),
                            ),
                          ),
                        SliverPadding(
                          padding: EdgeInsets.fromLTRB(
                            14,
                            splitByStatus ? 4 : 14,
                            14,
                            28,
                          ),
                          sliver: visibleJobs.isEmpty
                              ? const SliverToBoxAdapter(
                                  child: EmptyHint(
                                    icon: Icons.inbox_outlined,
                                    text: 'ບໍ່ມີໃບງານໃນສະຖານະນີ້',
                                  ),
                                )
                              : SliverToBoxAdapter(
                                  child: MCard(
                                    title: selectedStatus ?? label,
                                    child: Column(
                                      children: [
                                        for (
                                          var i = 0;
                                          i < visibleJobs.length;
                                          i++
                                        ) ...[
                                          if (i > 0) const Divider(height: 1),
                                          MonitorTile(job: visibleJobs[i]),
                                        ],
                                      ],
                                    ),
                                  ),
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
}

class _StatusTabs extends StatelessWidget {
  const _StatusTabs({
    required this.counts,
    required this.selected,
    required this.total,
    required this.onSelected,
  });
  final Map<String, int> counts;
  final String? selected;
  final int total;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) => Container(
    color: surface,
    padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'ແຍກຕາມສະຖານະ',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
        const SizedBox(height: 9),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _StatusChip(
                label: 'ທັງໝົດ',
                count: total,
                selected: selected == null,
                onTap: () => onSelected(null),
              ),
              for (final entry in counts.entries) ...[
                const SizedBox(width: 7),
                _StatusChip(
                  label: entry.key,
                  count: entry.value,
                  selected: selected == entry.key,
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

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final int count;
  final bool selected;
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
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                color: selected ? onAccent : ink,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(width: 7),
            Container(
              constraints: const BoxConstraints(minWidth: 21),
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: selected
                    ? onAccent.withValues(alpha: .16)
                    : onAccent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: selected ? onAccent : muted,
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
