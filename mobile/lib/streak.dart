/// **ມື້ຕິດ (streak)** — ຈຳນວນມື້ຕິດຕໍ່ກັນທີ່ຊ່າງປິດງານໄດ້ຢ່າງໜ້ອຍ 1 ໃບ.
///
/// ຄິດຢູ່ **ຝັ່ງແອັບ** ຈາກແຖວຄ່າຄອມຂອງເດືອນນີ້ (`Api.income().rows` ມີ `closed_at`)
/// ⇒ ບໍ່ຕ້ອງເພີ່ມ endpoint ໃໝ່ ແລະ ຕົວເລກມາຈາກແຫຼ່ງດຽວກັບເງິນທີ່ຊ່າງເຫັນ.
///
/// ── ຂໍ້ຈຳກັດທີ່ຮູ້ຕົວ ──
/// ຂໍ້ມູນມີແຕ່ເດືອນປັດຈຸບັນ ⇒ ຕົ້ນເດືອນ streak ຈະຖືກຕັດ (ວັນທີ 1 ສູງສຸດ = 1).
/// ຮັບໄດ້: ຈຸດປະສົງຄືແຮງຈູງໃຈລະຫວ່າງເດືອນ ບໍ່ແມ່ນສະຖິຕິທາງການ.
library;

/// `closed_at` ມາເປັນ `DD-MM-YYYY` (mobile-jobs.ts) — ອ່ານບໍ່ອອກ = ຂ້າມແຖວນັ້ນ
DateTime? parseClosedAt(String? raw) {
  final text = (raw ?? '').trim();
  if (text.length < 10) return null;
  final parts = text.substring(0, 10).split('-');
  if (parts.length != 3) return null;
  final day = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  final year = int.tryParse(parts[2]);
  if (day == null || month == null || year == null) return null;
  return DateTime(year, month, day);
}

/// ນັບມື້ຕິດ ໂດຍນັບຖອຍຫຼັງຈາກ **ມື້ນີ້** (ຫຼື ມື້ວານ ຖ້າມື້ນີ້ຍັງບໍ່ໄດ້ປິດໃບໃດ).
///
/// ເປັນຫຍັງຍອມໃຫ້ເລີ່ມທີ່ມື້ວານ: ຕອນເຊົ້າກ່ອນປິດໃບທຳອິດ streak ບໍ່ຄວນເປັນ 0
/// ແລ້ວກະໂດດກັບມາ 8 ຕອນສວາຍ — ມັນຈະເບິ່ງຄືພັງ. ຂາດ 2 ມື້ຈຶ່ງຂາດຈິງ.
int streakDays(Iterable<DateTime> closedDays, {DateTime? now}) {
  final today = now ?? DateTime.now();
  final days = closedDays
      .map((d) => DateTime(d.year, d.month, d.day))
      .toSet();
  if (days.isEmpty) return 0;

  var cursor = DateTime(today.year, today.month, today.day);
  if (!days.contains(cursor)) {
    cursor = cursor.subtract(const Duration(days: 1));
    if (!days.contains(cursor)) return 0;
  }
  var count = 0;
  while (days.contains(cursor)) {
    count += 1;
    cursor = cursor.subtract(const Duration(days: 1));
  }
  return count;
}

/// ນັບໃບທີ່ປິດ **ມື້ນີ້** (ນັບໃບບໍ່ຊ້ຳ — 1 ໃບອາດມີຫຼາຍແຖວຄ່າຄອມ)
int closedToday(List<Map<String, dynamic>> rows, {DateTime? now}) {
  final today = now ?? DateTime.now();
  final key = DateTime(today.year, today.month, today.day);
  final jobs = <String>{};
  for (final row in rows) {
    final at = parseClosedAt(row['closed_at'] as String?);
    if (at != null && at == key) jobs.add('${row['job_code']}');
  }
  return jobs.length;
}
