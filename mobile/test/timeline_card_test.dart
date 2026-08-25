import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/api.dart';
import 'package:odss_tech/main.dart';
import 'package:odss_tech/screens/job/job_timeline_card.dart';

/// ເສັ້ນເວລາຖືກແຍກອອກມາເປັນ widget ຢືນຢູ່ໄດ້ເອງ (ຮອບ "ຫັ່ນ job_screen")
/// ⇒ ເທສໄດ້ໂດຍບໍ່ຕ້ອງເປີດໜ້າໃບງານທັງໜ້າ ແລະ ບໍ່ຕ້ອງມີ server.
void main() {
  JobTimelineData data() => JobTimelineData.fromJson({
    'steps': [
      {
        'stage': 1,
        'label': 'ລໍຖ້າກວດເຊັກ',
        'at': '18-08-2026 09:00',
        'duration_seconds': 3600,
        'state': 'done',
      },
      {
        'stage': 2,
        'label': 'ກຳລັງກວດເຊັກ',
        'at': '18-08-2026 10:00',
        'duration_seconds': 90061,
        'state': 'current',
      },
    ],
    'visits': [],
  });

  testWidgets('ສະແດງທຸກຂັ້ນ ພ້ອມເວລາທີ່ໃຊ້', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: odssTheme(),
        home: Scaffold(body: SingleChildScrollView(child: JobTimelineCard(timeline: data()))),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ເສັ້ນເວລາ'), findsOneWidget);
    expect(find.text('ລໍຖ້າກວດເຊັກ'), findsOneWidget);
    expect(find.text('ກຳລັງກວດເຊັກ'), findsOneWidget);
    // 90,061 ວິ = 1 ມື້ 01:01:01 — ຮູບແບບດຽວກັບເວັບ
    expect(find.textContaining('1 ມື້ 01:01:01'), findsOneWidget);
  });
}
