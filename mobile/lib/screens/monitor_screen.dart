import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
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
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
        return;
      }
      setState(() {
        error = failure.message;
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() { error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້'; loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = groups?.fold<int>(0, (s, g) => s + g.jobs.length) ?? 0;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ຕິດຕາມງານ',
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: groups == null
                ? null
                : [
                    for (final g in groups!)
                      HeroStat(
                        value: '${g.jobs.length}',
                        label: g.label,
                        color: g.tone == 'danger'
                            ? const Color(0xFFFDA4AF)
                            : g.tone == 'warn'
                            ? const Color(0xFFFDBA74)
                            : null,
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
                    child: total == 0
                        ? ListView(children: const [
                            SizedBox(height: 80),
                            EmptyHint(icon: Icons.verified_rounded, text: 'ບໍ່ມີງານຄ້າງທີ່ຕ້ອງລົງມື 🎉'),
                          ])
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(14, 6, 14, 28),
                            children: [
                              for (final g in groups!)
                                MCard(
                                  title: '${g.label}  ·  ${g.jobs.length}',
                                  trailing: Icon(
                                    g.tone == 'danger' ? Icons.error_rounded
                                        : g.tone == 'warn' ? Icons.person_off_rounded
                                        : Icons.hourglass_bottom_rounded,
                                    size: 18, color: toneColor(g.tone),
                                  ),
                                  child: Column(
                                    children: [
                                      for (var i = 0; i < g.jobs.length; i++) ...[
                                        if (i > 0) const Divider(height: 1),
                                        MonitorTile(job: g.jobs[i]),
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
}
