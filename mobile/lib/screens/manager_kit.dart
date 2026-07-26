import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ວິດເຈັດຮ່ວມ ຂອງໜ້າ monitor ຜູ້ຈັດການ (ຕິດຕາມ · ລູກນ້ອງ · ລາຍງານ).
/// ຮັກສາໜ້າຕາໃຫ້ຄືກັບ dashboard (MCard · ErrorRetry) ໂດຍບໍ່ຊ້ຳ code ຫຼາຍໄຟລ໌.

/// ກາດຫົວຂໍ້ + ເນື້ອໃນ (ຄືກັບ _Card ຂອງ dashboard)
class MCard extends StatelessWidget {
  const MCard({super.key, required this.title, required this.child, this.trailing});
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
              child: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: ink)),
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
    final accent = job.overdue ? danger : (job.workflow == 'install' ? warn : teal);
    return InkWell(
      onTap: () => showJobSheet(context, job),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(width: 3.5, height: 38, margin: const EdgeInsets.only(right: 10, top: 1),
              decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(3))),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('#${job.code}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: ink)),
                      const SizedBox(width: 6),
                      _pill(workflowBadge(job), accent),
                      const Spacer(),
                      Text(slaText(job),
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800,
                              color: job.overdue ? danger : muted)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(job.product ?? '-', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5, color: ink)),
                  const SizedBox(height: 1),
                  Text(
                    [
                      job.customer ?? '-',
                      job.stageLabel,
                      if (showTech && job.tech != null) '· ${job.tech}',
                    ].join('  ·  '),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
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
    decoration: BoxDecoration(color: c.withValues(alpha: .12), borderRadius: BorderRadius.circular(6)),
    child: Text(text, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: c)),
  );
}

void showJobSheet(BuildContext context, MonitorJob job) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
    builder: (_) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: line, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Row(children: [
            Text('#${job.code}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: ink)),
            const SizedBox(width: 8),
            MonitorTile._pill(workflowBadge(job), job.workflow == 'install' ? warn : teal),
          ]),
          const SizedBox(height: 12),
          _row('ສິນຄ້າ', job.product ?? '-'),
          _row('ລູກຄ້າ', job.customer ?? '-'),
          _row('ຊ່າງ', job.tech ?? 'ຍັງບໍ່ຈັດ'),
          _row('ຂັ້ນ', job.stageLabel),
          _row('ອາຍຸ', '${job.ageDays} ມື້'),
          _row('SLA', slaText(job), tone: job.overdue ? danger : null),
        ],
      ),
    ),
  );
}

Widget _row(String k, String v, {Color? tone}) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 5),
  child: Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(width: 66, child: Text(k, style: const TextStyle(fontSize: 12.5, color: muted))),
      Expanded(child: Text(v, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: tone ?? ink))),
    ],
  ),
);
