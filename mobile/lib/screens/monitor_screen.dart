import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import 'login_screen.dart';
import 'manager_kit.dart';

/// ຕິດຕາມງານ (ຜູ້ຈັດການ) — ລາຍการงานที่ต้องลงมือ ຈັດເປັນກຸ່ມຄວາມດ່ວນ.
class MonitorScreen extends StatefulWidget {
  const MonitorScreen({super.key});

  @override
  State<MonitorScreen> createState() => _MonitorScreenState();
}

class _MonitorScreenState extends State<MonitorScreen> {
  List<MonitorGroup>? groups;
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.monitor();
      if (!mounted) return;
      setState(() {
        groups = result;
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
    final total = groups?.fold<int>(0, (s, g) => s + g.jobs.length) ?? 0;
    return Scaffold(
      backgroundColor: ground,
      body: SafeArea(
        child: Column(
          children: [
            _MonitorAppBar(onRefresh: load),
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator(color: teal))
                  : error.isNotEmpty
                  ? ErrorRetry(message: error, onRetry: load)
                  : total == 0
                  ? RefreshIndicator(
                      color: teal,
                      onRefresh: load,
                      child: ListView(
                        padding: const EdgeInsets.all(20),
                        children: const [SizedBox(height: 70), _AllClearView()],
                      ),
                    )
                  : _MonitorTabs(
                      groups: groups!,
                      total: total,
                      onRefresh: load,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MonitorTabs extends StatelessWidget {
  const _MonitorTabs({
    required this.groups,
    required this.total,
    required this.onRefresh,
  });

  final List<MonitorGroup> groups;
  final int total;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final visible = groups.where((group) => group.jobs.isNotEmpty).toList();
    return DefaultTabController(
      length: visible.length,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            child: _MonitorSummary(total: total, groups: groups),
          ),
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              dividerColor: Colors.transparent,
              indicatorSize: TabBarIndicatorSize.tab,
              labelPadding: EdgeInsets.zero,
              indicator: BoxDecoration(
                color: ink,
                borderRadius: BorderRadius.circular(12),
              ),
              labelColor: Colors.white,
              unselectedLabelColor: muted,
              splashBorderRadius: BorderRadius.circular(12),
              tabs: [
                for (final group in visible)
                  Tab(child: _MonitorTabLabel(group: group)),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: TabBarView(
              children: [
                for (final group in visible)
                  RefreshIndicator(
                    color: teal,
                    onRefresh: onRefresh,
                    child: ListView(
                      key: PageStorageKey(group.key),
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 30),
                      children: [
                        _MonitorGroupCard(group: group, showHeader: false),
                      ],
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

class _MonitorTabLabel extends StatelessWidget {
  const _MonitorTabLabel({required this.group});
  final MonitorGroup group;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          group.label,
          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800),
        ),
        const SizedBox(width: 7),
        Container(
          constraints: const BoxConstraints(minWidth: 20),
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .16),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '${group.jobs.length}',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900),
          ),
        ),
      ],
    ),
  );
}

class _MonitorAppBar extends StatelessWidget {
  const _MonitorAppBar({required this.onRefresh});
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(18, 10, 12, 10),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: line)),
    ),
    child: Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: tealTint,
            borderRadius: BorderRadius.circular(13),
          ),
          child: const Icon(Icons.radar_rounded, color: teal, size: 22),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ຕິດຕາມງານ',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: ink,
                ),
              ),
              Text(
                'ວຽກທີ່ຕ້ອງກວດສອບ ແລະ ລົງມື',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: muted,
                ),
              ),
            ],
          ),
        ),
        IconButton.filledTonal(
          onPressed: onRefresh,
          tooltip: 'ໂຫຼດໃໝ່',
          style: IconButton.styleFrom(
            backgroundColor: surfaceAlt,
            foregroundColor: ink,
          ),
          icon: const Icon(Icons.refresh_rounded, size: 20),
        ),
      ],
    ),
  );
}

class _MonitorSummary extends StatelessWidget {
  const _MonitorSummary({required this.total, required this.groups});
  final int total;
  final List<MonitorGroup> groups;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF0F172A), Color(0xFF134E4A)],
      ),
      borderRadius: BorderRadius.circular(22),
      boxShadow: [
        BoxShadow(
          color: ink.withValues(alpha: .14),
          blurRadius: 20,
          offset: const Offset(0, 8),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ວຽກທີ່ຕ້ອງສົນໃຈ',
                  style: TextStyle(
                    color: onHeroDim,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  '$total',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 38,
                    height: 1.1,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.track_changes_rounded,
                color: Color(0xFF5EEAD4),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final group in groups) ...[
                _SummaryPill(group: group),
                const SizedBox(width: 7),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({required this.group});
  final MonitorGroup group;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .09),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      '${group.jobs.length}  ${group.label}',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 10.5,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

class _MonitorGroupCard extends StatelessWidget {
  const _MonitorGroupCard({required this.group, this.showHeader = true});
  final MonitorGroup group;
  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    final color = toneColor(group.tone);
    final icon = group.tone == 'danger'
        ? Icons.timer_off_rounded
        : group.tone == 'warn'
        ? Icons.person_search_rounded
        : Icons.history_rounded;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          if (showHeader)
            Container(
              padding: const EdgeInsets.all(14),
              color: color.withValues(alpha: .065),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Icon(icon, color: color, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      group.label,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w900,
                        color: ink,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${group.jobs.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
            child: Column(
              children: [
                for (var i = 0; i < group.jobs.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  MonitorTile(job: group.jobs[i]),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AllClearView extends StatelessWidget {
  const _AllClearView();

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      children: [
        Container(
          width: 82,
          height: 82,
          decoration: const BoxDecoration(
            color: Color(0xFFDCFCE7),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.task_alt_rounded, color: ok, size: 42),
        ),
        const SizedBox(height: 18),
        const Text(
          'ທຸກຢ່າງຮຽບຮ້ອຍ',
          style: TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w900,
            color: ink,
          ),
        ),
        const SizedBox(height: 5),
        const Text(
          'ບໍ່ມີວຽກຄ້າງທີ່ຕ້ອງລົງມື',
          style: TextStyle(fontSize: 12.5, color: muted),
        ),
      ],
    ),
  );
}
