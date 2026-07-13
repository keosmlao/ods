import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import 'income_screen.dart';
import 'job_screen.dart';
import 'login_screen.dart';
import 'pickup_screen.dart';
import 'qc_screen.dart';

/// ຄິວວຽກຂອງຊ່າງ — **ຕິດຕັ້ງ ແລະ ສ້ອມແປງ ຢູ່ບ່ອນດຽວ** (ຄືວຽກຈິງຂອງຊ່າງ).
/// ປ້າຍ "ຕ້ອງລົງມື" ມາຈາກ server (`action`) — ແອັບບໍ່ຄິດຂັ້ນຕອນເອງ.
class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

const actionLabel = {
  'accept': 'ຮັບ / ປະຕິເສດ',
  'start': 'ເລີ່ມລົງມື',
  'finish': 'ບັນທຶກສຳເລັດ',
  'wait_spare': 'ລໍອາໄຫຼ່ຈາກສາງ',
  'wait_other': 'ລໍຂັ້ນຕອນອື່ນ',
};

const actionColor = {
  'accept': danger,
  'start': teal,
  'finish': ok,
  'wait_spare': Color(0xFFD97706),
  'wait_other': Color(0xFF94A3B8),
};

class _JobsScreenState extends State<JobsScreen> {
  List<Job> jobs = [];
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

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
      // token ໝົດອາຍຸ → ກັບໄປ login (ບໍ່ໃຫ້ຄ້າງຢູ່ໜ້າຫວ່າງ)
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

  Future<void> logout() async {
    await Push.unregister();
    await Api.clearToken();
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('ວຽກຂອງຂ້ອຍ (${jobs.length})'),
        actions: [
          IconButton(
            tooltip: 'ຮັບອາໄຫຼ່',
            icon: const Icon(Icons.inventory_2_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const PickupScreen()),
            ).then((_) => load()),
          ),
          IconButton(
            tooltip: 'ກວດຮັບຄຸນນະພາບ (QC)',
            icon: const Icon(Icons.verified_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const QcScreen()),
            ),
          ),
          IconButton(
            tooltip: 'ລາຍຮັບຂອງຂ້ອຍ',
            icon: const Icon(Icons.payments_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const IncomeScreen()),
            ),
          ),
          IconButton(
            tooltip: 'ອອກຈາກລະບົບ',
            icon: const Icon(Icons.logout),
            onPressed: logout,
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: error.isNotEmpty
                  ? ListView(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            error,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: danger,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    )
                  : jobs.isEmpty
                  ? ListView(
                      children: const [
                        Padding(
                          padding: EdgeInsets.all(40),
                          child: Text(
                            'ບໍ່ມີງານຄ້າງ',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: muted),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: jobs.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) =>
                          _JobCard(job: jobs[index], onDone: load),
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
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => JobScreen(job: job)),
      ).then((_) => onDone()),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${job.workflow == 'install' ? 'ຕິດຕັ້ງ' : 'ສ້ອມ'} · ${job.code}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: actionColor[job.action],
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    actionLabel[job.action] ?? '-',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              job.product ?? '-',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: ink,
              ),
            ),
            Text(
              job.customer ?? '-',
              style: const TextStyle(color: muted, fontSize: 12),
            ),
            if ((job.address ?? '').isNotEmpty)
              Text(
                job.address!,
                style: const TextStyle(color: muted, fontSize: 12),
              ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  job.stageLabel,
                  style: const TextStyle(
                    color: teal,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
                Text(
                  '${job.checkedIn ? '🟢 ຢູ່ໜ້າງານ · ' : ''}'
                  '${job.appointment != null ? 'ນັດ ${job.appointment} · ' : ''}'
                  'ຄ້າງ ${job.days} ມື້',
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
