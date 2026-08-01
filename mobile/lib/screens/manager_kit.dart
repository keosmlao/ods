import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ວິດເຈັດຮ່ວມ ຂອງໜ້າ monitor ຜູ້ຈັດການ (ຕິດຕາມ · ລູກນ້ອງ · ລາຍງານ).
/// ຮັກສາໜ້າຕາໃຫ້ຄືກັບ dashboard (MCard · ErrorRetry) ໂດຍບໍ່ຊ້ຳ code ຫຼາຍໄຟລ໌.

/// ກາດຫົວຂໍ້ + ເນື້ອໃນ (ຄືກັບ _Card ຂອງ dashboard)
class MCard extends StatelessWidget {
  const MCard({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
  });
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 12),
    padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE2E8F0)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: ink,
                ),
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
        const SizedBox(height: 12),
        child,
      ],
    ),
  );
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.cloud_off_rounded, size: 44, color: muted),
        const SizedBox(height: 12),
        Text(message, style: const TextStyle(color: muted)),
        const SizedBox(height: 12),
        FilledButton(onPressed: onRetry, child: const Text('ລອງໃໝ່')),
      ],
    ),
  );
}

class EmptyHint extends StatelessWidget {
  const EmptyHint({super.key, required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 34),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: faint),
          const SizedBox(height: 10),
          Text(text, style: const TextStyle(color: muted)),
        ],
      ),
    ),
  );
}

Color toneColor(String tone) => switch (tone) {
  'danger' => danger,
  'warn' => warn,
  _ => muted,
};

/// ຂໍ້ຄວາມ SLA/ອາຍຸ ຈາກ 1 ໃບ
String slaText(MonitorJob j) {
  final s = j.slaLeft;
  if (s == null) return 'ອາຍຸ ${j.ageDays} ມື້';
  final overdue = s < 0;
  final hrs = (s.abs() / 3600).floor();
  final label = hrs >= 24 ? '${(hrs / 24).floor()} ມື້' : '$hrs ຊມ';
  return overdue ? 'ເລີຍ $label' : 'ເຫຼືອ $label';
}

/// ປ້າຍສາຍງານ (ສ້ອມ IH/PS/CI/ST · ຕິດຕັ້ງ)
String workflowBadge(MonitorJob j) {
  if (j.workflow == 'install') return 'ຕິດຕັ້ງ';
  return switch (j.serviceType) {
    'IH' => 'ສ້ອມ·ນອກ',
    'PS' => 'ສ້ອມ·PS',
    _ => 'ສ້ອມ',
  };
}

/// ແຖວ 1 ໃບໃນ monitor — ແຕະ = ເປີດ sheet ລາຍລະອຽດ (ຜູ້ຈັດການ scan, ບໍ່ operate)
class MonitorTile extends StatelessWidget {
  const MonitorTile({super.key, required this.job, this.showTech = true});
  final MonitorJob job;
  final bool showTech;

  @override
  Widget build(BuildContext context) {
    final accent = job.overdue
        ? danger
        : (job.workflow == 'install' ? warn : teal);
    return InkWell(
      onTap: () => showJobSheet(context, job),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 3.5,
              height: 38,
              margin: const EdgeInsets.only(right: 10, top: 1),
              decoration: BoxDecoration(
                color: accent,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        '#${job.code}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          color: ink,
                        ),
                      ),
                      const SizedBox(width: 6),
                      _pill(workflowBadge(job), accent),
                      const Spacer(),
                      Text(
                        slaText(job),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: job.overdue ? danger : muted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    job.product ?? '-',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, color: ink),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    [
                      job.customer ?? '-',
                      job.stageLabel,
                      if (showTech && job.tech != null) '· ${job.tech}',
                    ].join('  ·  '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _pill(String text, Color c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: c.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      text,
      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: c),
    ),
  );
}

void showJobSheet(BuildContext context, MonitorJob job) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .82,
      minChildSize: .55,
      maxChildSize: .96,
      builder: (context, controller) => Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: line,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 10, 12),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: (job.workflow == 'install' ? warn : teal).withValues(
                      alpha: .1,
                    ),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(
                    job.workflow == 'install'
                        ? Icons.home_repair_service_rounded
                        : Icons.build_circle_outlined,
                    color: job.workflow == 'install' ? warn : teal,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '#${job.code}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        job.stageLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: muted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded, color: muted),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                _statusPanel(job),
                const SizedBox(height: 14),
                _detailSection(
                  icon: Icons.inventory_2_outlined,
                  title: 'ຂໍ້ມູນງານ',
                  children: [
                    _detailRow('ສິນຄ້າ', job.product),
                    _detailRow('ຍີ່ຫໍ້ / ຮຸ່ນ', job.detail),
                    _detailRow('Serial No.', job.sn),
                    _detailRow('ຮັບປະກັນ', job.warranty),
                    _detailRow('ປະເພດບໍລິການ', workflowBadge(job)),
                    _detailRow('ວັນຮັບເຂົ້າ', job.receivedAt),
                    _detailRow(
                      'ວັນນັດໝາຍ',
                      job.appointment,
                      tone: job.appointment == null ? null : warn,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _detailSection(
                  icon: Icons.person_outline_rounded,
                  title: 'ລູກຄ້າ ແລະ ຜູ້ຮັບຜິດຊອບ',
                  children: [
                    _detailRow('ລູກຄ້າ', job.customer),
                    _detailRow('ເບີໂທ', job.tel),
                    _detailRow('ທີ່ຢູ່', job.address),
                    _detailRow(
                      'ຊ່າງ',
                      job.tech ?? 'ຍັງບໍ່ຈັດ',
                      tone: job.tech == null ? danger : null,
                    ),
                  ],
                ),
                if ((job.symptom ?? '').trim().isNotEmpty ||
                    (job.diagnosis ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _detailSection(
                    icon: Icons.fact_check_outlined,
                    title: 'ອາການ ແລະ ຜົນກວດ',
                    children: [
                      _detailRow('ອາການແຈ້ງ', job.symptom),
                      _detailRow('ຜົນວິເຄາະ', job.diagnosis),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _statusPanel(MonitorJob job) => Container(
  padding: const EdgeInsets.all(14),
  decoration: BoxDecoration(
    color: surfaceAlt,
    borderRadius: BorderRadius.circular(16),
  ),
  child: Row(
    children: [
      Expanded(
        child: _statusValue(
          'ອາຍຸວຽກ',
          '${job.ageDays} ມື້',
          job.ageDays >= 30 ? danger : ink,
        ),
      ),
      Container(width: 1, height: 36, color: line),
      Expanded(
        child: _statusValue('SLA', slaText(job), job.overdue ? danger : teal),
      ),
      Container(width: 1, height: 36, color: line),
      Expanded(child: _statusValue('ສະຖານະ', job.stageLabel, ink)),
    ],
  ),
);

Widget _statusValue(String label, String value, Color color) => Padding(
  padding: const EdgeInsets.symmetric(horizontal: 5),
  child: Column(
    children: [
      Text(
        value,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w900,
          color: color,
        ),
      ),
      const SizedBox(height: 3),
      Text(
        label,
        style: const TextStyle(
          fontSize: 9.5,
          color: muted,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  ),
);

Widget _detailSection({
  required IconData icon,
  required String title,
  required List<Widget> children,
}) => Container(
  padding: const EdgeInsets.all(14),
  decoration: BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(16),
    border: Border.all(color: line),
  ),
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Icon(icon, size: 18, color: teal),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: ink,
            ),
          ),
        ],
      ),
      const SizedBox(height: 11),
      ...children,
    ],
  ),
);

Widget _detailRow(String k, String? value, {Color? tone}) {
  final text = (value ?? '').trim();
  if (text.isEmpty) return const SizedBox.shrink();
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 94,
          child: Text(
            k,
            style: const TextStyle(
              fontSize: 11.5,
              color: muted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.35,
              fontWeight: FontWeight.w700,
              color: tone ?? ink,
            ),
          ),
        ),
      ],
    ),
  );
}
