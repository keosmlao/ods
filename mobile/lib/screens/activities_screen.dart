import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'login_screen.dart';
import 'manager_kit.dart';
import 'overview_jobs_screen.dart';

/// **ກິດຈະກຳທີ່ນັດໄວ້** — ຜູ້ຈັດການຕິດຕາມສິ່ງທີ່ CS ນັດໃສ່ໃບງານ.
///
/// ແຕ່ກ່ອນແອັບເຫັນ chatter/ກິດຈະກຳ **ສະເພາະຕອນເປີດໃບງານເປັນໃບໆ** ⇒ ຜູ້ຈັດການ
/// ບໍ່ມີບ່ອນເຫັນວ່າ "CS ນັດຫຍັງໄວ້ແດ່ ແລະ ອັນໃດເລີຍກຳນົດ". ໜ້ານີ້ລວມທຸກອັນ
/// ທີ່ຍັງບໍ່ປິດ ພ້ອມ **ຜູ້ຮັບຜິດຊອບທຸກຄົນ** (ກິດຈະກຳມອບໃຫ້ຫຼາຍຄົນໄດ້ແລ້ວ).
class ActivitiesScreen extends StatefulWidget {
  const ActivitiesScreen({super.key});

  @override
  State<ActivitiesScreen> createState() => _ActivitiesScreenState();
}

class _ActivitiesScreenState extends State<ActivitiesScreen> {
  List<PlannedActivity> items = [];
  int late = 0;
  bool loading = true;
  String error = '';
  bool onlyLate = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await Api.activities();
      if (!mounted) return;
      setState(() {
        items = result.items;
        late = result.late;
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
      setState(() { error = failure.message; loading = false; });
    } catch (_) {
      if (mounted) setState(() { error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້'; loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final shown = onlyLate ? items.where((a) => a.daysLeft < 0).toList() : items;

    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ກິດຈະກຳທີ່ນັດໄວ້',
            onBack: () => Navigator.pop(context),
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: loading
                ? null
                : [
                    HeroStat(value: '${items.length}', label: 'ຍັງບໍ່ປິດ'),
                    if (late > 0)
                      HeroStat(value: '$late', label: 'ເລີຍກຳນົດ', color: const Color(0xFFFDA4AF)),
                  ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? ErrorRetry(message: error, onRetry: load)
                : items.isEmpty
                ? const EmptyHint(icon: Icons.event_available, text: 'ບໍ່ມີກິດຈະກຳຄ້າງ')
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                      children: [
                        if (late > 0)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(
                              children: [
                                Switch(
                                  value: onlyLate,
                                  onChanged: (value) => setState(() => onlyLate = value),
                                ),
                                const Text(
                                  'ສະແດງສະເພາະທີ່ເລີຍກຳນົດ',
                                  style: TextStyle(fontSize: 12.5, color: ink),
                                ),
                              ],
                            ),
                          ),
                        MCard(
                          title: '${shown.length} ກິດຈະກຳ',
                          child: Column(
                            children: [
                              for (var i = 0; i < shown.length; i++) ...[
                                if (i > 0) const Divider(height: 1),
                                _ActivityRow(
                                  activity: shown[i],
                                  onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => OverviewJobsScreen(
                                        bucket: 'job:${shown[i].resId}',
                                        title: '#${shown[i].resId}',
                                      ),
                                    ),
                                  ),
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
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.activity, required this.onTap});
  final PlannedActivity activity;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final overdue = activity.daysLeft < 0;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 3.5,
              height: 40,
              margin: const EdgeInsets.only(right: 10, top: 1),
              decoration: BoxDecoration(
                color: overdue ? danger : teal,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          activity.summary,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: ink,
                          ),
                        ),
                      ),
                      Text(
                        overdue ? 'ເລີຍ ${-activity.daysLeft} ມື້' : '${activity.dueDate}',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: overdue ? danger : faint,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '#${activity.resId} · ${activity.jobTitle ?? "-"} · ${activity.customer ?? "-"}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: muted),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    // ຜູ້ຮັບຜິດຊອບອາດມີຫຼາຍຄົນ
                    '${activity.kindLabel} · ມອບໃຫ້ ${activity.assignedTo} · ນັດໂດຍ ${activity.createdBy}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: faint),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
