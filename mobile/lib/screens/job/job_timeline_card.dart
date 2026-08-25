import 'package:flutter/material.dart';

import '../../api.dart';
import '../../main.dart';
import '../../widgets/ui_kit.dart';

/// **ເສັ້ນເວລາຂອງໃບງານ** — ແຕ່ລະຂັ້ນ · ເວລາທີ່ໃຊ້ · ຮອບເຂົ້າໜ້າງານ.
///
/// ແຍກອອກມາຈາກ `job_screen.dart` (ເຄີຍ 3,764 ແຖວ) ເພາະສ່ວນນີ້ເປັນ **ການສະແດງ
/// ຢ່າງດຽວ**: ຮັບຂໍ້ມູນມາແລ້ວແຕ້ມ ບໍ່ແຕະສະຖານະ ຫຼື ຍິງຄຳສັ່ງໃດ ⇒ ຍ້າຍໄດ້ໂດຍ
/// ບໍ່ມີຄວາມສ່ຽງ ແລະ ເອົາໄປໃຊ້ຄືນ/ເທສແຍກໄດ້.
///
/// ຂໍ້ມູນຄິດຢູ່ server (lib/repair-timeline.ts) ອັນດຽວກັບໜ້າເວັບ.
class JobTimelineCard extends StatelessWidget {
  const JobTimelineCard({super.key, required this.timeline});

  final JobTimelineData timeline;

  @override
  Widget build(BuildContext context) => _card();

  Widget _card() {
    final data = timeline;
    final steps = data.steps;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: cardDecoration(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.timeline_rounded, size: 18, color: teal),
            const SizedBox(width: 7),
            const Text(
              'ເສັ້ນເວລາ',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: ink,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < steps.length; i++)
          _step(steps[i], isLast: i == steps.length - 1 && data.cancelledAt == null),
        if (data.cancelledAt != null)
          _step(
            TimelineStep(
              stage: -1,
              label: 'ຂໍຍົກເລີກ',
              at: data.cancelledAt,
              durationSeconds: null,
              state: 'done',
            ),
            isLast: true,
            cancelled: true,
          ),
        // ຮອບເຂົ້າໜ້າງານ — ຮອບເກີດພາຍໃນຂັ້ນດຽວ ⇒ ເສັ້ນເວລາຂ້າງເທິງສະແດງບໍ່ໄດ້
        if (data.visits.isNotEmpty) ...[
          const SizedBox(height: 4),
          const Divider(height: 18, color: line),
          Row(
            children: [
              const Icon(Icons.place_outlined, size: 16, color: teal),
              const SizedBox(width: 6),
              Text(
                'ຮອບເຂົ້າໜ້າງານ (${data.visits.length})',
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: teal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          for (final visit in data.visits) _visit(visit),
        ],
      ],
      ),
    );
  }

  /// ໄລຍະເວລາແບບອ່ານງ່າຍ — "48 ມື້ 08:32:24" · "01:20:05" (ຮູບແບບດຽວກັບເວັບ)
  String _elapsedLabel(int seconds) {
    final safe = seconds < 0 ? 0 : seconds;
    final days = safe ~/ 86400;
    final rest = safe % 86400;
    final clock = [rest ~/ 3600, (rest % 3600) ~/ 60, rest % 60]
        .map((part) => part.toString().padLeft(2, '0'))
        .join(':');
    return days > 0 ? '$days ມື້ $clock' : clock;
  }

  Widget _step(TimelineStep step, {required bool isLast, bool cancelled = false}) {
    final done = step.isDone;
    final current = step.isCurrent;
    final dotColor = cancelled
        ? danger
        : current
        ? teal
        : done
        ? teal
        : surface;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 14,
                height: 14,
                margin: const EdgeInsets.only(top: 2),
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: done || current || cancelled ? teal : lineStrong,
                    width: 2,
                  ),
                ),
                child: done && !cancelled
                    ? const Icon(Icons.check, size: 8, color: onAccent)
                    : null,
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 2),
                    color: done ? teal.withValues(alpha: 0.35) : line,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          step.label,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: current ? FontWeight.w900 : FontWeight.w700,
                            color: cancelled
                                ? danger
                                : current
                                ? teal
                                : done
                                ? body
                                : faint,
                          ),
                        ),
                      ),
                      if (step.at != null)
                        Text(
                          step.at!,
                          style: const TextStyle(fontSize: 10.5, color: faint),
                        ),
                    ],
                  ),
                  if (step.durationSeconds != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Text(
                        '${current ? "ຄ້າງມາ" : "ໃຊ້ເວລາ"} ${_elapsedLabel(step.durationSeconds!)}',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: current ? FontWeight.w700 : FontWeight.w400,
                          color: current ? warn : muted,
                        ),
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

  Widget _visit(JobVisit visit) {
    final open = visit.out == null;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: open ? warnTint : tealWash,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ຮອບ ${visit.n}',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w900,
              color: open ? warn : teal,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  open
                      ? '${visit.at ?? "-"} · ຍັງຢູ່ໜ້າງານ'
                      : '${visit.at ?? "-"} → ${visit.out} (${visit.lengthLabel})',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: open ? warn : body,
                  ),
                ),
                if ((visit.tech ?? '').isNotEmpty)
                  Text(
                    'ຊ່າງ ${visit.tech}',
                    style: const TextStyle(fontSize: 10, color: faint),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
