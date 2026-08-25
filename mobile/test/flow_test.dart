import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/api.dart';
import 'package:odss_tech/main.dart';
import 'package:odss_tech/pending.dart';
import 'package:odss_tech/screens/jobs_screen.dart';

/// **ເທສ flow ໜ້າງານ** — ພິສູດວ່າ ວຽກທີ່ server ສົ່ງມາ ໄປປາກົດຢູ່ຈໍຖືກຕ້ອງ
/// ແລະ ປຸ່ມທີ່ຂຶ້ນ **ຕົງກັບ `job.action` ຂອງ server** ບໍ່ແມ່ນແອັບຄິດເອງ.
///
/// ໃຊ້ຮູຮັບຕົວປອມ `Api.sendOverride` ⇒ ບໍ່ຕິດ server ຈິງ ແລະ ແລ່ນໃນ CI ໄດ້.
Map<String, dynamic> _job({
  required String code,
  required String action,
  String workflow = 'repair',
  String? appointment,
  int elapsed = 3600,
  bool onsite = true,
  bool checkedIn = false,
}) => {
  'workflow': workflow,
  'code': code,
  'customer': 'ນາງ ຄຳຫຼ້າ',
  'tel': '02055512345',
  'address': 'ບ້ານໂພນສະຫວ່າງ',
  'product': 'ແອກເຊັນ 9000 BTU',
  'detail': null,
  'onsite': onsite,
  'stage': 1,
  'stage_label': 'ລໍຖ້າກວດເຊັກ',
  'elapsed_seconds': elapsed,
  'appointment': appointment,
  'action': action,
  'checked_in': checkedIn,
  'accepted': action != 'accept',
  'has_checked_in': checkedIn,
  'has_checked_out': false,
  'can_check_in': !checkedIn,
  'can_check_out': checkedIn,
  'is_lead': true,
};

void main() {
  setUp(() {
    Api.jobsFromCacheAt = null;
    // cache ເປັນ static ⇒ ຄ້າງຂ້າມເທສ ຖ້າບໍ່ລ້າງ (ພົບຕອນຂຽນເທສນີ້ເອງ)
    JobCache.clear();
  });

  tearDown(() => Api.sendOverride = null);

  Future<void> pumpJobs(WidgetTester tester, List<Map<String, dynamic>> jobs) async {
    Api.sendOverride = (method, path, {body, auth = true}) async {
      if (path == '/api/mobile/jobs') return {'jobs': jobs};
      if (path == '/api/mobile/income') {
        return {'linked': true, 'jobs': 0, 'total_thb': 0, 'rows': []};
      }
      return <String, dynamic>{};
    };
    await tester.pumpWidget(
      MaterialApp(theme: odssTheme(), home: const JobsScreen()),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('ວຽກຈາກ server ຂຶ້ນຈໍ ພ້ອມຄຳສັ່ງທີ່ຕ້ອງເຮັດ', (tester) async {
    await pumpJobs(tester, [_job(code: 'SRV-0012', action: 'accept')]);

    expect(find.text('SRV-0012'), findsOneWidget);
    // ແຖວທຳອິດຕ້ອງເປັນ **ຄຳສັ່ງ** ບໍ່ແມ່ນຊື່ສິນຄ້າ (ຫຼັກການ v5)
    expect(find.text('ຕ້ອງຮັບງານ'), findsOneWidget);
  });

  testWidgets('ໃບທີ່ຍັງບໍ່ check-in ⇒ ຄຳສັ່ງຄື "ໄປໜ້າງານ"', (tester) async {
    await pumpJobs(tester, [
      _job(code: 'SRV-0100', action: 'start', onsite: true, checkedIn: false),
    ]);
    expect(find.text('ໄປໜ້າງານ — check-in'), findsOneWidget);
  });

  testWidgets('ໃບຊ້າ ຢູ່ກຸ່ມ "ຊ້າແລ້ວ" ແລະ ຂຶ້ນກ່ອນໃບປົກກະຕິ', (tester) async {
    await pumpJobs(tester, [
      _job(code: 'SRV-NORMAL', action: 'finish', checkedIn: true),
      _job(code: 'SRV-LATE', action: 'finish', appointment: '01-01-2020', checkedIn: true),
    ]);

    expect(find.text('ຊ້າແລ້ວ'), findsWidgets);
    final late_ = tester.getTopLeft(find.text('SRV-LATE')).dy;
    final normal = tester.getTopLeft(find.text('SRV-NORMAL')).dy;
    expect(late_, lessThan(normal), reason: 'ໃບຊ້າຕ້ອງຢູ່ເທິງ');
  });

  testWidgets('ຄົ້ນຫາ ກອງດ້ວຍເລກໃບ', (tester) async {
    await pumpJobs(tester, [
      _job(code: 'SRV-0012', action: 'accept'),
      _job(code: 'SRV-9999', action: 'accept'),
    ]);

    // ເປີດຊ່ອງຄົ້ນ (ພັບໄວ້ເປັນຄ່າຕັ້ງຕົ້ນ) ແລ້ວພິມ
    await tester.tap(find.byIcon(Icons.search_rounded));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '9999');
    await tester.pumpAndSettle();

    expect(find.text('SRV-9999'), findsOneWidget);
    expect(find.text('SRV-0012'), findsNothing);
  });

  testWidgets('server ລົ້ມ + ບໍ່ມີ cache ⇒ ບອກເຫດຜົນ ບໍ່ແມ່ນຈໍຫວ່າງ', (tester) async {
    Api.sendOverride = (method, path, {body, auth = true}) async {
      throw ApiError('ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ — ກະລຸນາກວດ internet', 0);
    };
    await tester.pumpWidget(
      MaterialApp(theme: odssTheme(), home: const JobsScreen()),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('ເຊື່ອມຕໍ່'), findsWidgets);
  });

  testWidgets('ບໍ່ມີສັນຍານ ແຕ່ມີ cache ⇒ ສະແດງວຽກເກົ່າ + ປ້າຍເຕືອນ', (tester) async {
    // ຮອບທຳອິດ: ໂຫຼດສຳເລັດ ⇒ ເກັບລົງ cache
    await pumpJobs(tester, [_job(code: 'SRV-0012', action: 'accept')]);
    expect(find.text('SRV-0012'), findsOneWidget);

    // ຮອບສອງ: ເນັດຂາດ ⇒ ຕ້ອງຍັງເຫັນວຽກ ພ້ອມບອກວ່າຂໍ້ມູນເກົ່າ
    Api.sendOverride = (method, path, {body, auth = true}) async {
      throw ApiError('ເຊື່ອມຕໍ່ server ບໍ່ໄດ້', 0);
    };
    // ຕ້ອງໃສ່ key ໃໝ່ — ບໍ່ດັ່ງນັ້ນ Flutter ໃຊ້ State ເກົ່າຄືນ ແລ້ວ initState ບໍ່ແລ່ນ
    await tester.pumpWidget(
      MaterialApp(theme: odssTheme(), home: JobsScreen(key: UniqueKey())),
    );
    await tester.pumpAndSettle();

    expect(find.text('SRV-0012'), findsOneWidget);
    expect(find.textContaining('ບໍ່ມີສັນຍານ'), findsOneWidget);
  });
}
