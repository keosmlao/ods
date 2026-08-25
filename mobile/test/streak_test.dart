import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/streak.dart';

void main() {
  final now = DateTime(2026, 8, 25);
  DateTime d(int day) => DateTime(2026, 8, day);

  test('ປິດງານ 3 ມື້ຕິດຮອດມື້ນີ້ = 3', () {
    expect(streakDays([d(23), d(24), d(25)], now: now), 3);
  });

  test('ມື້ນີ້ຍັງບໍ່ໄດ້ປິດໃບໃດ ແຕ່ມື້ວານປິດ ⇒ ຍັງນັບຕໍ່ (ບໍ່ໃຫ້ຕົກສູນຕອນເຊົ້າ)', () {
    expect(streakDays([d(23), d(24)], now: now), 2);
  });

  test('ຂາດ 2 ມື້ = ຂາດຈິງ', () {
    expect(streakDays([d(20), d(21), d(22)], now: now), 0);
  });

  test('ວັນຊ້ຳໃນມື້ດຽວກັນ ນັບເປັນມື້ດຽວ', () {
    expect(streakDays([d(25), d(25), d(24)], now: now), 2);
  });

  test('ບໍ່ມີຂໍ້ມູນ = 0', () => expect(streakDays(const [], now: now), 0));

  test('ນັບໃບທີ່ປິດມື້ນີ້ — ໃບຊ້ຳນັບເທື່ອດຽວ', () {
    final rows = [
      {'job_code': 'SRV-1', 'closed_at': '25-08-2026 09:10'},
      {'job_code': 'SRV-1', 'closed_at': '25-08-2026 09:10'}, // ຄ່າຄອມ 2 ແຖວ ໃບດຽວ
      {'job_code': 'SRV-2', 'closed_at': '25-08-2026 14:02'},
      {'job_code': 'SRV-3', 'closed_at': '24-08-2026 16:40'},
    ];
    expect(closedToday(rows, now: now), 2);
  });

  test('closed_at ອ່ານບໍ່ອອກ = ຂ້າມ ບໍ່ແມ່ນລົ້ມ', () {
    expect(parseClosedAt('ບໍ່ແມ່ນວັນທີ'), isNull);
    expect(closedToday([{'job_code': 'X', 'closed_at': null}], now: now), 0);
  });
}
