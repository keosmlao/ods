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
  const OverviewJobsScreen({super.key, required this.bucket, required this.title});

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
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: loading ? null : [HeroStat(value: '${jobs.length}', label: 'ໃບ')],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? ErrorRetry(message: error, onRetry: load)
                : jobs.isEmpty
                ? const EmptyHint(icon: Icons.check_circle_outline, text: 'ບໍ່ມີໃບງານໃນກຸ່ມນີ້')
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                      children: [
                        MCard(
                          title: label,
                          child: Column(
                            children: [
                              for (var i = 0; i < jobs.length; i++) ...[
                                if (i > 0) const Divider(height: 1),
                                MonitorTile(job: jobs[i]),
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
