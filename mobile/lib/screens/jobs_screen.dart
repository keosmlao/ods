import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import '../widgets/service_bottom_nav.dart';
import 'notifications_screen.dart';
import 'job_screen.dart';
import 'login_screen.dart';

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

  List<Job> get shown {
    final rows = filter == 'all'
        ? [...jobs]
        : filter == 'action'
        ? jobs
              .where((j) => ['accept', 'start', 'finish'].contains(j.action))
              .toList()
        : jobs.where((j) => j.action == 'wait_spare').toList();
    const priority = {'accept': 0, 'finish': 1, 'start': 2, 'wait_spare': 3};
    rows.sort(
      (a, b) => (priority[a.action] ?? 4).compareTo(priority[b.action] ?? 4),
    );
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    final actionCount = jobs
        .where((j) => ['accept', 'start', 'finish'].contains(j.action))
        .length;
    final onsiteCount = jobs.where((j) => j.onsite).length;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: ink,
        surfaceTintColor: Colors.white,
        elevation: 0,
        toolbarHeight: 72,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'ODIEN SERVICE',
              style: TextStyle(
                fontSize: 11,
                letterSpacing: 1.6,
                color: Color(0xFF0F766E),
              ),
            ),
            Text(
              'ວຽກຂອງຂ້ອຍ',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        actions: [
          // ກ່ອງແຈ້ງເຕືອນ — push ທີ່ຖືກປັດຖິ້ມ / ມືຖືປິດ ຍັງອ່ານໄດ້ຢູ່ນີ້
          IconButton(
            tooltip: 'ແຈ້ງເຕືອນ',
            icon: const Icon(Icons.notifications_none),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
          IconButton(
            tooltip: 'ໂຫຼດຄືນໃໝ່',
            onPressed: load,
            icon: const Icon(Icons.refresh_rounded),
          ),
          PopupMenuButton<String>(
            tooltip: 'ເມນູ',
            onSelected: (value) {
              if (value == 'logout') logout();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded, size: 19),
                    SizedBox(width: 10),
                    Text('ອອກຈາກລະບົບ'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: ServiceBottomNav(
        selectedIndex: 0,
        onSelected: (i) {
          if (i == 1) Navigator.pushReplacementNamed(context, '/pickup');
          if (i == 2) Navigator.pushReplacementNamed(context, '/income');
        },
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
                      color: Colors.white,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ພາບລວມມື້ນີ້',
                            style: TextStyle(
                              color: ink,
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 3),
                          const Text(
                            'ສະແດງສະເພາະວຽກທີ່ມອບໝາຍໃຫ້ທ່ານ',
                            style: TextStyle(color: muted, fontSize: 11),
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              _Metric(
                                label: 'ວຽກທັງໝົດ',
                                value: jobs.length,
                                color: ink,
                                icon: Icons.work_outline_rounded,
                              ),
                              const SizedBox(width: 10),
                              _Metric(
                                label: 'ຕ້ອງລົງມື',
                                value: actionCount,
                                color: const Color(0xFFD97706),
                                icon: Icons.bolt_rounded,
                              ),
                              const SizedBox(width: 10),
                              _Metric(
                                label: 'ວຽກໜ້າງານ',
                                value: onsiteCount,
                                color: const Color(0xFF0F766E),
                                icon: Icons.location_on_outlined,
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),
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
    required this.icon,
  });
  final String label;
  final int value;
  final Color color;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: .13)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const Spacer(),
              Text(
                '$value',
                style: TextStyle(
                  color: color,
                  fontSize: 23,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          Text(
            label,
            maxLines: 1,
            style: const TextStyle(color: muted, fontSize: 10),
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
            color: active ? teal : const Color(0xFFF1F5F4),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: active ? teal : const Color(0xFFDCE5E2)),
          ),
          child: Text(
            '$label  $count',
            style: TextStyle(
              color: active ? Colors.white : const Color(0xFF475569),
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
  Widget build(BuildContext context) {
    final install = job.workflow == 'install';
    final typeColor = install ? const Color(0xFF6D4AFF) : teal;
    final statusColor = actionColor[job.action] ?? muted;

    void open() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => JobScreen(job: job)),
    ).then((_) => onDone());

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFDDE6E3)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D0F172A),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: open,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(height: 4, color: statusColor),
              Padding(
                padding: const EdgeInsets.fromLTRB(15, 13, 15, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: typeColor.withValues(alpha: .10),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                install
                                    ? Icons.handyman_outlined
                                    : Icons.build_outlined,
                                size: 14,
                                color: typeColor,
                              ),
                              const SizedBox(width: 5),
                              Text(
                                install ? 'ຕິດຕັ້ງ' : 'ສ້ອມແປງ',
                                style: TextStyle(
                                  color: typeColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            job.code,
                            style: const TextStyle(
                              color: ink,
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: .10),
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            actionLabel[job.action] ?? '-',
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 13),
                    Text(
                      job.product ?? '-',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: ink,
                        fontSize: 16,
                        height: 1.25,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      job.stageLabel,
                      style: const TextStyle(color: muted, fontSize: 11),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF6F8F7),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Column(
                        children: [
                          _InfoLine(
                            icon: Icons.person_outline_rounded,
                            text: job.customer ?? '-',
                          ),
                          if ((job.address ?? '').isNotEmpty) ...[
                            const SizedBox(height: 6),
                            _InfoLine(
                              icon: Icons.location_on_outlined,
                              text: job.address!,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
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
                        if (!job.checkedIn && job.appointment == null)
                          Text(
                            'ຄ້າງ ${job.days} ມື້',
                            style: TextStyle(
                              color: job.days > 7 ? danger : muted,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        const Spacer(),
                        InkWell(
                          onTap: open,
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 11,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDDF4EE),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Row(
                              children: [
                                Text(
                                  'ເບິ່ງວຽກ',
                                  style: TextStyle(
                                    color: teal,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                SizedBox(width: 3),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  color: teal,
                                  size: 14,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 16, color: muted),
      const SizedBox(width: 7),
      Expanded(
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Color(0xFF475569), fontSize: 11),
        ),
      ),
    ],
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
