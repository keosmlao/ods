import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// **ວຽກທີ່ຂ້ອຍຈົບແລ້ວ** (30 ມື້ຫຼ້າສຸດ).
///
/// ລາຍການວຽກປົກກະຕິສະແດງແຕ່ໃບທີ່ **ຍັງເປີດ** ⇒ ໃບທີ່ຈົບແລ້ວຫາຍໄປຈາກຈໍທັນທີ.
/// ພໍລູກຄ້າ/ຫົວໜ້າຖາມວ່າ "ໃບນັ້ນເຮັດແລ້ວບໍ · ມື້ໃດ" ຊ່າງພິສູດເອງບໍ່ໄດ້.
/// ໜ້ານີ້ອ່ານຢ່າງດຽວ — ບໍ່ມີປຸ່ມ ບໍ່ປ່ຽນຂັ້ນຫຍັງ.
class DoneJobsScreen extends StatefulWidget {
  const DoneJobsScreen({super.key});

  @override
  State<DoneJobsScreen> createState() => _DoneJobsScreenState();
}

class _DoneJobsScreenState extends State<DoneJobsScreen> {
  List<DoneJob>? jobs;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final rows = await Api.doneJobs();
      if (mounted) setState(() { jobs = rows; error = ''; });
    } on ApiError catch (failure) {
      if (mounted) setState(() { error = failure.message; jobs = const []; });
    } catch (_) {
      if (mounted) setState(() { error = 'ໂຫຼດປະຫວັດບໍ່ສຳເລັດ'; jobs = const []; });
    }
  }

  static const _kind = {
    'repair': ('ສ້ອມແປງ', Icons.handyman_outlined),
    'install': ('ຕິດຕັ້ງ', Icons.construction_outlined),
    'maintenance': ('ລ້າງແອ', Icons.cleaning_services_outlined),
  };

  @override
  Widget build(BuildContext context) {
    final rows = jobs;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            inlineBack: true,
            eyebrow: '30 ມື້ຫຼ້າສຸດ',
            title: 'ວຽກທີ່ຈົບແລ້ວ',
            onBack: () => Navigator.pop(context),
          ),
          Expanded(
            child: rows == null
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? StateBlock(
                    icon: Icons.cloud_off_rounded,
                    message: error,
                    action: FilledButton(onPressed: load, child: const Text('ລອງໃໝ່')),
                  )
                : rows.isEmpty
                ? const StateBlock(
                    icon: Icons.history_rounded,
                    message: 'ຍັງບໍ່ມີໃບທີ່ຈົບໃນ 30 ມື້ຜ່ານມາ',
                    detail: 'ໃບທີ່ຈົບແລ້ວຈະມາລວມຢູ່ນີ້ ໃຫ້ອ້າງອີງໄດ້ພາຍຫຼັງ',
                  )
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                      itemCount: rows.length + 1,
                      separatorBuilder: (_, _) => const SizedBox(height: 9),
                      itemBuilder: (_, i) => i == rows.length
                          ? Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'ລວມ ${rows.length} ໃບ',
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: faint, fontSize: 12),
                              ),
                            )
                          : _row(rows[i]),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _row(DoneJob job) {
    final kind = _kind[job.workflow] ?? ('ວຽກ', Icons.work_outline);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
      decoration: cardDecoration(color: surface, borderRadius: 16),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: okTint, borderRadius: BorderRadius.circular(11)),
            child: Icon(kind.$2, size: 18, color: ok),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      job.code,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: teal,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        job.product ?? '-',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, color: ink, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    kind.$1,
                    if ((job.customer ?? '').trim().isNotEmpty) job.customer!.trim(),
                    if (!job.lead) 'ຊ່າງຮ່ວມ',
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, color: faint),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            job.finishedAt ?? '-',
            textAlign: TextAlign.right,
            style: const TextStyle(fontSize: 11, color: muted, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
