import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import 'income_screen.dart';
import 'job_screen.dart';
import 'login_screen.dart';
import 'pickup_screen.dart';

const actionLabel = {
  'accept': 'ຕ້ອງຮັບງານ',
  'start': 'ພ້ອມເລີ່ມ',
  'finish': 'ກຳລັງເຮັດ',
  'wait_spare': 'ລໍອາໄຫຼ່',
  'wait_other': 'ລໍຂັ້ນຕອນອື່ນ',
};
const actionColor = {
  'accept': danger,
  'start': teal,
  'finish': ok,
  'wait_spare': Color(0xFFD97706),
  'wait_other': Color(0xFF64748B),
};

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});
  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<Job> jobs = [];
  bool loading = true;
  String error = '';
  String filter = 'all';

  Future<void> load() async {
    try {
      final rows = await Api.jobs();
      if (!mounted) return;
      setState(() {
        jobs = rows;
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
  void initState() {
    super.initState();
    load();
  }

  Future<void> logout() async {
    await Push.unregister();
    await Api.clearToken();
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  List<Job> get shown => filter == 'all'
      ? jobs
      : filter == 'action'
      ? jobs
            .where((j) => ['accept', 'start', 'finish'].contains(j.action))
            .toList()
      : jobs.where((j) => j.action == 'wait_spare').toList();

  Future<void> openPage(Widget page) async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => page));
    await load();
  }

  @override
  Widget build(BuildContext context) {
    final actionCount = jobs
        .where((j) => ['accept', 'start', 'finish'].contains(j.action))
        .length;
    final onsiteCount = jobs.where((j) => j.onsite).length;
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 68,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'ODIEN SERVICE',
              style: TextStyle(
                fontSize: 11,
                letterSpacing: 1.6,
                color: Color(0xFF5EEAD4),
              ),
            ),
            Text(
              'ວຽກຂອງຂ້ອຍ',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        actions: [
          IconButton(onPressed: load, icon: const Icon(Icons.refresh_rounded)),
          IconButton(onPressed: logout, icon: const Icon(Icons.logout_rounded)),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        onDestinationSelected: (i) {
          if (i == 1) openPage(const PickupScreen());
          if (i == 2) openPage(const IncomeScreen());
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.work_outline_rounded),
            selectedIcon: Icon(Icons.work_rounded),
            label: 'ວຽກ',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            label: 'ອາໄຫຼ່',
          ),
          NavigationDestination(
            icon: Icon(Icons.payments_outlined),
            label: 'ລາຍຮັບ',
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
                      decoration: const BoxDecoration(
                        color: ink,
                        borderRadius: BorderRadius.vertical(
                          bottom: Radius.circular(28),
                        ),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              _Metric(
                                label: 'ວຽກທັງໝົດ',
                                value: jobs.length,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 10),
                              _Metric(
                                label: 'ຕ້ອງລົງມື',
                                value: actionCount,
                                color: const Color(0xFFFBBF24),
                              ),
                              const SizedBox(width: 10),
                              _Metric(
                                label: 'ວຽກໜ້າງານ',
                                value: onsiteCount,
                                color: const Color(0xFF5EEAD4),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _Filter(
                                  label: 'ທັງໝົດ',
                                  value: 'all',
                                  selected: filter,
                                  count: jobs.length,
                                  onTap: (v) => setState(() => filter = v),
                                ),
                                _Filter(
                                  label: 'ຕ້ອງລົງມື',
                                  value: 'action',
                                  selected: filter,
                                  count: actionCount,
                                  onTap: (v) => setState(() => filter = v),
                                ),
                                _Filter(
                                  label: 'ລໍອາໄຫຼ່',
                                  value: 'wait_spare',
                                  selected: filter,
                                  count: jobs
                                      .where((j) => j.action == 'wait_spare')
                                      .length,
                                  onTap: (v) => setState(() => filter = v),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (error.isNotEmpty)
                    SliverFillRemaining(
                      child: _Empty(
                        icon: Icons.cloud_off_rounded,
                        title: error,
                        action: load,
                      ),
                    ),
                  if (error.isEmpty && shown.isEmpty)
                    SliverFillRemaining(
                      child: _Empty(
                        icon: Icons.task_alt_rounded,
                        title: 'ບໍ່ມີວຽກໃນຄິວນີ້',
                        action: load,
                      ),
                    ),
                  if (error.isEmpty && shown.isNotEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.all(14),
                      sliver: SliverList.separated(
                        itemCount: shown.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (_, i) =>
                            _JobCard(job: shown[i], onDone: load),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final int value;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: .08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$value',
            style: TextStyle(
              color: color,
              fontSize: 25,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 10),
          ),
        ],
      ),
    ),
  );
}

class _Filter extends StatelessWidget {
  const _Filter({
    required this.label,
    required this.value,
    required this.selected,
    required this.count,
    required this.onTap,
  });
  final String label, value, selected;
  final int count;
  final ValueChanged<String> onTap;
  @override
  Widget build(BuildContext context) {
    final active = value == selected;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: () => onTap(value),
        borderRadius: BorderRadius.circular(99),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            color: active ? teal : Colors.white.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            '$label  $count',
            style: TextStyle(
              color: active ? Colors.white : const Color(0xFFCBD5E1),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job, required this.onDone});
  final Job job;
  final Future<void> Function() onDone;
  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => JobScreen(job: job)),
      ).then((_) => onDone()),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: job.workflow == 'install'
                        ? const Color(0xFFEDE9FE)
                        : const Color(0xFFCCFBF1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    job.workflow == 'install'
                        ? Icons.handyman_rounded
                        : Icons.build_rounded,
                    size: 19,
                    color: job.workflow == 'install'
                        ? const Color(0xFF7C3AED)
                        : teal,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        job.code,
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          color: ink,
                        ),
                      ),
                      Text(
                        job.stageLabel,
                        style: const TextStyle(fontSize: 11, color: muted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: actionColor[job.action]?.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    actionLabel[job.action] ?? '-',
                    style: TextStyle(
                      color: actionColor[job.action],
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              job.product ?? '-',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: ink,
              ),
            ),
            const SizedBox(height: 3),
            Row(
              children: [
                const Icon(
                  Icons.person_outline_rounded,
                  size: 15,
                  color: muted,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    job.customer ?? '-',
                    style: const TextStyle(color: muted, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            if ((job.address ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 15,
                      color: muted,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        job.address!,
                        style: const TextStyle(color: muted, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 13),
            const Divider(height: 1),
            const SizedBox(height: 11),
            Row(
              children: [
                if (job.checkedIn)
                  const _Mini(
                    icon: Icons.location_on,
                    text: 'ຢູ່ໜ້າງານ',
                    color: ok,
                  ),
                if (job.appointment != null)
                  _Mini(
                    icon: Icons.event_outlined,
                    text: job.appointment!,
                    color: teal,
                  ),
                const Spacer(),
                Text(
                  'ຄ້າງ ${job.days} ມື້',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: job.days > 7 ? danger : muted,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 18, color: muted),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class _Mini extends StatelessWidget {
  const _Mini({required this.icon, required this.text, required this.color});
  final IconData icon;
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 10),
    child: Row(
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 3),
        Text(
          text,
          style: TextStyle(
            fontSize: 10,
            color: color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.action});
  final IconData icon;
  final String title;
  final Future<void> Function() action;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 54, color: const Color(0xFFCBD5E1)),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: action,
            icon: const Icon(Icons.refresh),
            label: const Text('ລອງໃໝ່'),
          ),
        ],
      ),
    ),
  );
}
