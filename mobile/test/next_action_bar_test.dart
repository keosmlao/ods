import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/widgets/ui_kit.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(bottomNavigationBar: child));

void main() {
  testWidgets('ມີເຫດຜົນທີ່ກົດບໍ່ໄດ້ ⇒ ບອກເຫດຜົນ ແລະ ກົດບໍ່ໄດ້ຈິງ', (tester) async {
    var pressed = 0;
    await tester.pumpWidget(
      _host(
        NextActionBar(
          label: 'ບັນທຶກຜົນກວດ',
          blocker: 'ຕ້ອງເລືອກຜົນຕັດສິນກ່ອນ',
          onPressed: () => pressed++,
        ),
      ),
    );
    expect(find.text('ຕ້ອງເລືອກຜົນຕັດສິນກ່ອນ'), findsOneWidget);
    await tester.tap(find.text('ບັນທຶກຜົນກວດ'));
    await tester.pump();
    // ປຸ່ມສີເທົາທີ່ຍັງກົດໄດ້ = ຊ່າງກົດແລ້ວບໍ່ມີຫຍັງເກີດ ແລະ ບໍ່ຮູ້ວ່າຜິດຫຍັງ
    expect(pressed, 0);
  });

  testWidgets('ບໍ່ມີເຫດຜົນກັ້ນ ⇒ ຂຶ້ນປ້າຍ "ຂັ້ນຕໍ່ໄປ" ແລະ ກົດໄດ້', (tester) async {
    var pressed = 0;
    await tester.pumpWidget(
      _host(NextActionBar(label: 'ຮັບງານ', onPressed: () => pressed++)),
    );
    expect(find.text('ຂັ້ນຕໍ່ໄປ'), findsOneWidget);
    await tester.tap(find.text('ຮັບງານ'));
    await tester.pump();
    expect(pressed, 1);
  });

  testWidgets('ກຳລັງສົ່ງຢູ່ ⇒ ກົດຊ້ຳບໍ່ໄດ້ (ກັນຄຳສັ່ງຊ້ຳ)', (tester) async {
    var pressed = 0;
    await tester.pumpWidget(
      _host(NextActionBar(label: 'ຈົບງານ', busy: true, onPressed: () => pressed++)),
    );
    await tester.tap(find.text('ຈົບງານ'));
    await tester.pump();
    expect(pressed, 0);
  });

  testWidgets('ຂັ້ນທີ່ຜ່ານແລ້ວພັບໄວ້ · ຂັ້ນປັດຈຸບັນເປີດ', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: const [
              StepCard(
                step: 1,
                title: 'ຮັບງານ',
                state: JobStepState.done,
                child: Text('ເນື້ອໃນຂັ້ນ 1'),
              ),
              StepCard(
                step: 2,
                title: 'ກວດເຊັກ',
                state: JobStepState.current,
                child: Text('ເນື້ອໃນຂັ້ນ 2'),
              ),
            ],
          ),
        ),
      ),
    );
    expect(find.text('ເນື້ອໃນຂັ້ນ 1'), findsNothing);
    expect(find.text('ເນື້ອໃນຂັ້ນ 2'), findsOneWidget);

    // ຫຼັກຖານຂັ້ນເກົ່າຍັງເປີດເບິ່ງໄດ້ (ພັບ ບໍ່ແມ່ນລຶບ)
    await tester.tap(find.text('ຮັບງານ'));
    await tester.pumpAndSettle();
    expect(find.text('ເນື້ອໃນຂັ້ນ 1'), findsOneWidget);
  });
}
