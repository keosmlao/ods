import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/main.dart';

/// ກັບດັກທີ່ພົບຈິງ (25-08-2026): theme ຕັ້ງ `minimumSize: Size.fromHeight(kMinTouch)`
/// ຊຶ່ງ **ກວ້າງ = infinity**. ດີສຳລັບປຸ່ມເຕັມແຖວໃນ Column ແຕ່ພໍເອົາປຸ່ມໄປວາງເປັນ
/// ລູກໂດຍກົງຂອງ Row ມັນກິນຄວາມກວ້າງໝົດ ⇒ `Expanded` ຂ້າງໆເຫຼືອເກືອບສູນ
/// ⇒ ຂໍ້ຄວາມແຕກເປັນ **1 ຕົວອັກສອນຕໍ່ແຖວ** (ແຖວໃບເບີກໃນໜ້າໃບງານ).
const _doc = 'SWC260801411 · 1 ລາຍການ';

Widget _row({required ButtonStyle? style}) => MaterialApp(
  theme: odssTheme(),
  home: Scaffold(
    body: SizedBox(
      width: 360,
      child: Row(
        children: [
          const Expanded(child: Text(_doc)),
          FilledButton(style: style, onPressed: () {}, child: const Text('ຮັບ')),
        ],
      ),
    ),
  ),
);

void main() {
  // ໝາຍເຫດ: ກໍລະນີ**ຜິດ** (ບໍ່ໃສ່ minimumSize) ບໍ່ໄດ້ຂຽນເປັນເທສ ເພາະມັນລົ້ມ
  // ຕັ້ງແຕ່ຂັ້ນ layout (RenderBox ບໍ່ມີ size) ⇒ ຈັບເປັນ exception ບໍ່ແມ່ນຄ່າທີ່ວັດໄດ້.
  // ເທສລຸ່ມນີ້ຄືດ່ານ: ຖອນການແກ້ອອກເມື່ອໃດ ມັນລົ້ມທັນທີ.
  testWidgets('ໃສ່ minimumSize: Size(0, kMinTouch) ⇒ ຂໍ້ຄວາມໄດ້ຄວາມກວ້າງຄືນ', (tester) async {
    await tester.pumpWidget(
      _row(style: FilledButton.styleFrom(minimumSize: const Size(0, kMinTouch))),
    );
    final width = tester.getSize(find.text(_doc)).width;
    expect(width, greaterThan(200));
    // ປຸ່ມຍັງສູງພໍໃຫ້ນິ້ວໂປ້ກົດ (ບໍ່ໄດ້ແກ້ໂດຍການເຮັດໃຫ້ປຸ່ມນ້ອຍລົງ)
    expect(tester.getSize(find.widgetWithText(FilledButton, 'ຮັບ')).height,
        greaterThanOrEqualTo(kMinTouch));
  });
}
