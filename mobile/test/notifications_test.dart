import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/api.dart';
import 'package:odss_tech/main.dart';
import 'package:odss_tech/screens/notifications_screen.dart';

/// **ເທສກ່ອງແຈ້ງເຕືອນ** — ພິສູດ 3 ຢ່າງທີ່ຮຸ່ນເກົ່າເຮັດຜິດ:
///   ① ປະເພດມາຈາກ `kind` ຂອງຖານ ບໍ່ແມ່ນເດົາຈາກຄຳໃນຂໍ້ຄວາມ
///   ② ຂໍ້ຄວາມຊ້ຳຕິດກັນ ຫຍໍ້ເປັນແຖວດຽວ "×N" (ຂອງຈິງພົບຊ້ຳ 8 ແຖວ)
///   ③ ເວລາ "ຫາກໍ່/15 ນາທີກ່ອນ" ມາຈາກ **ອາຍຸທີ່ຖານຄິດໃຫ້** ⇒ ບໍ່ຜິດ 7 ຊົ່ວໂມງ
Map<String, dynamic> _row({
  required int id,
  required String kind,
  required String body,
  String model = 'tb_product',
  String resId = 'SRV-0001',
  int age = 90,
  int dayOffset = 0,
}) => {
  'id': id,
  'model': model,
  'res_id': resId,
  'kind': kind,
  'body': body,
  'actor': 'ແອັດມິນ',
  'created_at': '26-08-2026 09:00',
  'age_seconds': age,
  'day_offset': dayOffset,
  'read': false,
};

void main() {
  tearDown(() => Api.sendOverride = null);

  Future<void> pump(WidgetTester tester, List<Map<String, dynamic>> rows) async {
    Api.sendOverride = (method, path, {body, auth = true}) async => {
      'data': rows,
      'unread': 9923,
      'unread_todo': 2,
    };
    await tester.pumpWidget(
      MaterialApp(
        theme: odssTheme(),
        home: NotificationsScreen(key: UniqueKey()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('ປະເພດມາຈາກ kind ບໍ່ແມ່ນເດົາຈາກຄຳໃນຂໍ້ຄວາມ', (tester) async {
    // ຂໍ້ຄວາມມີຄຳວ່າ "ແລ້ວ" ຊຶ່ງຮຸ່ນເກົ່າຈະຕີເປັນ "ສຳເລັດ" ທັງທີ່ເປັນການມອບງານ
    await pump(tester, [
      _row(id: 2, kind: 'assign', body: 'ມອບງານໃຫ້ທ່ານແລ້ວ'),
      _row(id: 1, kind: 'comment', body: 'ຝາກເບິ່ງໃຫ້ແດ່ເດີ້'),
    ]);
    expect(find.text('ມອບໝາຍໃຫ້ທ່ານ'), findsOneWidget);
    expect(find.text('ມີຄົນເວົ້າເຖິງ'), findsOneWidget);
  });

  testWidgets('ຂໍ້ຄວາມຊ້ຳຕິດກັນ ຫຍໍ້ເປັນແຖວດຽວ', (tester) async {
    await pump(tester, [
      for (var index = 0; index < 8; index++)
        _row(id: 100 - index, kind: 'log', body: 'ບັນທຶກຜົນກວດເຊັກ: ນ້ຳຮົ່ວ'),
    ]);
    expect(find.text('ບັນທຶກຜົນກວດເຊັກ: ນ້ຳຮົ່ວ'), findsOneWidget);
    expect(find.text('×8'), findsOneWidget);
  });

  testWidgets('ຫົວກຸ່ມຕາມມື້ ແລະ ເວລາທີ່ຖານຄິດໃຫ້', (tester) async {
    await pump(tester, [
      _row(id: 3, kind: 'assign', body: 'ງານໃໝ່', age: 30),
      _row(id: 2, kind: 'assign', body: 'ງານມື້ວານ', age: 90000, dayOffset: 1),
    ]);
    expect(find.text('ມື້ນີ້'), findsOneWidget);
    expect(find.text('ວານນີ້'), findsOneWidget);
    expect(find.text('ຫາກໍ່'), findsOneWidget);
    expect(find.text('1 ມື້ກ່ອນ'), findsOneWidget);
  });

  testWidgets('ປ້າຍນັບສະເພາະເລື່ອງທີ່ຮຽກຫາຕົນ ບໍ່ແມ່ນ 9,923', (tester) async {
    await pump(tester, [_row(id: 1, kind: 'assign', body: 'ງານໃໝ່')]);
    expect(find.text('2 ເລື່ອງຮຽກຫາທ່ານ'), findsOneWidget);
    expect(find.textContaining('9923'), findsNothing);
  });
}
