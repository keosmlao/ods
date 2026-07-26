import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
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
      setState(() { techs = result; error = ''; loading = false; });
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
    final busy = techs?.where((t) => t.openJobs > 0).length ?? 0;
    final free = (techs?.length ?? 0) - busy;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ຜົນງານລູກນ້ອງ',
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: techs == null
                ? null
                : [
                    HeroStat(value: '${techs!.length}', label: 'ຊ່າງທັງໝົດ'),
                    HeroStat(value: '$busy', label: 'ມີວຽກ'),
                    HeroStat(value: '$free', label: 'ວ່າງ', color: const Color(0xFF6EE7B7)),
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
                      padding: const EdgeInsets.fromLTRB(14, 10, 14, 28),
                      children: [
                        for (final t in techs!) _TechCard(tech: t),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
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
          MaterialPageRoute(builder: (_) => TechDetailScreen(code: tech.code, name: tech.name)),
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
                  style: TextStyle(fontWeight: FontWeight.w900, color: idle ? ok : teal, fontSize: 16),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tech.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: ink)),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        _chip('${tech.openJobs} ຄ້າງ', tech.openJobs > 0 ? teal : faint),
                        if (tech.late > 0) ...[
                          const SizedBox(width: 6),
                          _chip('${tech.late} ເລີຍ SLA', danger),
                        ],
                        if (tech.oldestDays > 0) ...[
                          const SizedBox(width: 6),
                          _chip('ເກົ່າ ${tech.oldestDays}ມື້', muted),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${tech.monthJobs}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: ink)),
                  const Text('ຈົບ/ເດືອນ', style: TextStyle(fontSize: 9.5, color: muted)),
                  const SizedBox(height: 3),
                  Text('฿${tech.monthThb.toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: teal)),
                ],
              ),
              const Icon(Icons.chevron_right_rounded, color: faint),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _chip(String text, Color c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(color: c.withValues(alpha: .12), borderRadius: BorderRadius.circular(6)),
    child: Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: c)),
  );
}
