import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import 'login_screen.dart';
import 'manager_kit.dart';
import 'tech_detail_screen.dart';

/// ຜົນງານລູກນ້ອງ (ຜູ້ຈັດການ) — ລາຍชื่อຊ່າງ ພ້ອມພາລະ/ຄວາມຊ້າ/ຄ່າຄອມ. ແຕະ = ລາຍລະອຽດ.
class TechsScreen extends StatefulWidget {
  const TechsScreen({super.key});

  @override
  State<TechsScreen> createState() => _TechsScreenState();
}

class _TechsScreenState extends State<TechsScreen> {
  List<TechRow>? techs;
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.techs();
      if (!mounted) return;
      setState(() {
        techs = result;
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
    final busy = techs?.where((t) => t.openJobs > 0).length ?? 0;
    final free = (techs?.length ?? 0) - busy;
    return Scaffold(
      backgroundColor: ground,
      body: SafeArea(
        child: Column(
          children: [
            _TeamAppBar(onRefresh: load),
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator(color: teal))
                  : error.isNotEmpty
                  ? ErrorRetry(message: error, onRetry: load)
                  : _TeamTabs(
                      techs: techs!,
                      busy: busy,
                      free: free,
                      onRefresh: load,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TeamAppBar extends StatelessWidget {
  const _TeamAppBar({required this.onRefresh});
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
            color: const Color(0xFFEDE9FE),
            borderRadius: BorderRadius.circular(13),
          ),
          child: const Icon(
            Icons.groups_2_rounded,
            color: Color(0xFF7C3AED),
            size: 23,
          ),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ທີມງານ',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: ink,
                ),
              ),
              Text(
                'ພາລະວຽກ ແລະ ຜົນງານລູກນ້ອງ',
                style: TextStyle(
                  fontSize: 11.5,
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

class _TeamTabs extends StatelessWidget {
  const _TeamTabs({
    required this.techs,
    required this.busy,
    required this.free,
    required this.onRefresh,
  });
  final List<TechRow> techs;
  final int busy;
  final int free;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final lists = <List<TechRow>>[
      techs,
      techs.where((t) => t.openJobs > 0).toList(),
      techs.where((t) => t.openJobs == 0).toList(),
    ];
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            child: _TeamSummary(total: techs.length, busy: busy, free: free),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 14),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: surfaceAlt,
              borderRadius: BorderRadius.circular(14),
            ),
            child: TabBar(
              dividerColor: Colors.transparent,
              indicatorSize: TabBarIndicatorSize.tab,
              // v4: flat — ຂອບແທນເງົາ
              indicator: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: lineStrong),
              ),
              labelColor: ink,
              unselectedLabelColor: muted,
              labelStyle: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w900,
              ),
              tabs: [
                Tab(text: 'ທັງໝົດ ${techs.length}'),
                Tab(text: 'ມີວຽກ $busy'),
                Tab(text: 'ວ່າງ $free'),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: TabBarView(
              children: [
                for (var i = 0; i < lists.length; i++)
                  RefreshIndicator(
                    color: teal,
                    onRefresh: onRefresh,
                    child: lists[i].isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 70),
                              EmptyHint(
                                icon: Icons.person_search_rounded,
                                text: 'ບໍ່ມີລາຍຊື່ໃນກຸ່ມນີ້',
                              ),
                            ],
                          )
                        : ListView.builder(
                            key: PageStorageKey('team-$i'),
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(14, 4, 14, 28),
                            itemCount: lists[i].length,
                            itemBuilder: (_, index) =>
                                _TechCard(tech: lists[i][index]),
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

class _TeamSummary extends StatelessWidget {
  const _TeamSummary({
    required this.total,
    required this.busy,
    required this.free,
  });
  final int total;
  final int busy;
  final int free;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(17),
    // v4: flat — ພື້ນ ink ລ້ວນ ບໍ່ມີ gradient/ເງົາ (ປະຢັດ GPU ເຄື່ອງເກົ່າ)
    decoration: BoxDecoration(
      color: hero1,
      borderRadius: BorderRadius.circular(kCardRadius),
      border: Border.all(color: const Color(0xFF334155)),
    ),
    child: Row(
      children: [
        Expanded(
          child: _TeamStat(
            value: '$total',
            label: 'ທັງໝົດ',
            icon: Icons.groups_rounded,
          ),
        ),
        _summaryDivider(),
        Expanded(
          child: _TeamStat(
            value: '$busy',
            label: 'ມີວຽກ',
            icon: Icons.engineering_rounded,
          ),
        ),
        _summaryDivider(),
        Expanded(
          child: _TeamStat(
            value: '$free',
            label: 'ວ່າງ',
            icon: Icons.check_circle_outline_rounded,
            color: const Color(0xFF86EFAC),
          ),
        ),
      ],
    ),
  );

  Widget _summaryDivider() => Container(
    width: 1,
    height: 42,
    color: Colors.white.withValues(alpha: .14),
  );
}

class _TeamStat extends StatelessWidget {
  const _TeamStat({
    required this.value,
    required this.label,
    required this.icon,
    this.color = Colors.white,
  });
  final String value;
  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Icon(icon, color: color.withValues(alpha: .85), size: 18),
      const SizedBox(height: 4),
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 22,
          height: 1,
          fontWeight: FontWeight.w900,
        ),
      ),
      const SizedBox(height: 3),
      Text(
        label,
        style: TextStyle(
          color: Colors.white.withValues(alpha: .65),
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _TechCard extends StatelessWidget {
  const _TechCard({required this.tech});
  final TechRow tech;

  @override
  Widget build(BuildContext context) {
    final idle = tech.openJobs == 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TechDetailScreen(code: tech.code, name: tech.name),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: (idle ? ok : teal).withValues(alpha: .12),
                child: Text(
                  tech.name.characters.take(1).toString(),
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: idle ? ok : teal,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tech.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        const Icon(
                          Icons.badge_outlined,
                          size: 12,
                          color: faint,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'ລະຫັດ ${tech.employeeCode}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: muted,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 6,
                      runSpacing: 5,
                      children: [
                        _chip(
                          '${tech.openJobs} ຄ້າງ',
                          tech.openJobs > 0 ? teal : faint,
                        ),
                        if (tech.late > 0)
                          _chip('${tech.late} ເລີຍ SLA', danger),
                        if (tech.oldestDays > 0)
                          _chip('ເກົ່າ ${tech.oldestDays}ມື້', muted),
                        if (tech.rated > 0)
                          _chip(
                            '😊 ${tech.happyPct}%',
                            _satColor(tech.happyPct),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${tech.monthJobs}',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: ink,
                    ),
                  ),
                  const Text(
                    'ຈົບ/ເດືອນ',
                    style: TextStyle(fontSize: 11, color: muted),
                  ),
                  if (tech.monthThb != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      '฿${tech.monthThb!.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: teal,
                      ),
                    ),
                  ],
                ],
              ),
              const Icon(Icons.chevron_right_rounded, color: faint),
            ],
          ),
        ),
      ),
    );
  }

  static Color _satColor(int? pct) => pct == null
      ? muted
      : pct >= 90
      ? ok
      : pct >= 70
      ? warn
      : danger;

  static Widget _chip(String text, Color c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: c.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      text,
      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: c),
    ),
  );
}
