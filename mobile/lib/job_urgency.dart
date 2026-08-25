import 'api.dart';
import 'main.dart';
import 'widgets/ui_kit.dart';

/* ══ ຄວາມຮີບ (v5) ══════════════════════════════════════════════════════════
   ແຕ່ກ່ອນລາຍການຈັດກຸ່ມຕາມ **ໄລຍະ** (ລໍຖ້າກວດ · ກຳລັງສ້ອມ …) ເຊິ່ງເປັນວິທີຄິດຂອງ
   ລະບົບ. ຊ່າງບໍ່ໄດ້ວາງແຜນມື້ຂອງຕົນຈາກໄລຍະ — ລາວວາງແຜນຈາກ **ເວລາ**: ອັນໃດເລີຍກຳນົດ
   ແລ້ວ, ອັນໃດນັດມື້ນີ້, ອັນໃດຍັງບໍ່ຮອດຄິວ. v5 ຈຶ່ງຈັດກຸ່ມຕາມນັ້ນ ແລະ ຍົກໄລຍະລົງໄປ
   ເປັນລາຍລະອຽດໃນກາດ (ຍັງເຫັນຢູ່ ບໍ່ໄດ້ຫາຍໄປ).
   ══════════════════════════════════════════════════════════════════════════ */
enum Urgency { late_, today, act, waitSpare, waitOther }

const urgencyLabel = {
  Urgency.late_: 'ຊ້າແລ້ວ',
  Urgency.today: 'ນັດມື້ນີ້',
  Urgency.act: 'ຕ້ອງລົງມື',
  Urgency.waitSpare: 'ລໍອາໄຫຼ່',
  Urgency.waitOther: 'ລໍຂັ້ນຕອນອື່ນ',
};

const urgencyColor = {
  Urgency.late_: danger,
  Urgency.today: warn,
  Urgency.act: ink,
  Urgency.waitSpare: warn,
  Urgency.waitOther: muted,
};

/// ວັນນັດ — server ສົ່ງເປັນ `DD-MM-YYYY` (mobile-jobs.ts). ອ່ານບໍ່ອອກ = null
/// ⇒ ຖືວ່າ "ບໍ່ມີນັດ" ບໍ່ແມ່ນ "ເລີຍນັດ" (ຢ່າຍ້ອມແດງໃສ່ໃບທີ່ບໍ່ໄດ້ຊ້າ).
DateTime? appointDate(Job job) {
  final raw = job.appointment;
  if (raw == null || raw.length < 10) return null;
  final parts = raw.split('-');
  if (parts.length != 3) return null;
  final day = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  final year = int.tryParse(parts[2]);
  if (day == null || month == null || year == null) return null;
  return DateTime(year, month, day);
}

/// ຈຳນວນມື້ຈາກມື້ນີ້ຫາວັນນັດ (ລົບ = ເລີຍນັດແລ້ວ · null = ບໍ່ມີນັດ)
int? appointIn(Job job) {
  final date = appointDate(job);
  if (date == null) return null;
  final now = DateTime.now();
  return date.difference(DateTime(now.year, now.month, now.day)).inDays;
}

const actionable = {'accept', 'start', 'finish'};

Urgency urgencyOf(Job job) {
  final overdueSla = job.slaLeft != null && job.slaLeft! < 0;
  final due = appointIn(job);
  // ເລີຍກຳນົດ SLA ຫຼື ເລີຍວັນນັດ = ຊ້າ **ບໍ່ວ່າຈະຢູ່ຂັ້ນໃດ** (ຫົວໜ້າຖາມຫາອັນນີ້ກ່ອນ)
  if (overdueSla || (due != null && due < 0)) return Urgency.late_;
  if (due == 0) return Urgency.today;
  if (actionable.contains(job.action)) return Urgency.act;
  return job.action == 'wait_spare' ? Urgency.waitSpare : Urgency.waitOther;
}

/// ຮີບກ່ອນຢູ່ເທິງ: SLA ໜ້ອຍສຸດ → ນັດໃກ້ສຸດ → ຄ້າງດົນສຸດ (ນິຍາມດຽວກັບ order by ຂອງ server)
int byUrgency(Job a, Job b) {
  final sla = (a.slaLeft ?? 1e9).compareTo(b.slaLeft ?? 1e9);
  if (sla != 0) return sla;
  final due = (appointIn(a) ?? 1 << 30).compareTo(appointIn(b) ?? 1 << 30);
  if (due != 0) return due;
  return b.elapsedSeconds.compareTo(a.elapsedSeconds);
}

/// ຄຳສັ່ງທີ່ຈະຂຶ້ນເປັນ **ແຖວທຳອິດ** ຂອງກາດ — ຄຳກິລິຍາ ບໍ່ແມ່ນສະຖານະ.
/// ຂັ້ນທີ່ຊ່າງລົງມືບໍ່ໄດ້ (ລໍຄົນອື່ນ) ໃຊ້ຊື່ໄລຍະ ເພາະນັ້ນຄືຂໍ້ມູນທີ່ມີຄ່າກວ່າ.
/// [phaseLabel] = ຊື່ໄລຍະທີ່ຈະໃຊ້ຕອນຊ່າງລົງມືບໍ່ໄດ້ (ລໍຄົນອື່ນ) — ໜ້າລາຍການສົ່ງ
/// ໄລຍະລະອຽດຂອງຕົນມາ · ໜ້າແຜນທີ່ໃຊ້ `job.stageLabel` ຂອງ server
String actionVerb(Job job, {required String phaseLabel}) => switch (job.action) {
  'accept' => 'ຕ້ອງຮັບງານ',
  'start' => job.onsite && !job.checkedIn ? 'ໄປໜ້າງານ — check-in' : 'ພ້ອມເລີ່ມ',
  'finish' => job.onsite && !job.checkedIn
      ? 'ໄປໜ້າງານ — check-in'
      : 'ກຳລັງເຮັດ — ບັນທຶກຜົນ',
  'wait_spare' => 'ລໍອາໄຫຼ່',
  _ => phaseLabel,
};

/// ຊິບເວລາຂອງກາດ — ອັນດຽວ ບອກສິ່ງທີ່ຮີບທີ່ສຸດ
({String label, TimeTone tone}) timeOf(Job job) {
  final sla = job.slaLeft;
  if (sla != null) {
    final hours = (sla.abs() / 3600).floor();
    if (sla < 0) return (label: 'ເລີຍກຳນົດ $hours ຊມ', tone: TimeTone.late_);
    if (sla < 4 * 3600) return (label: 'ເຫຼືອ $hours ຊມ', tone: TimeTone.soon);
  }
  final due = appointIn(job);
  if (due != null) {
    if (due < 0) return (label: 'ເລີຍນັດ ${-due} ມື້', tone: TimeTone.late_);
    if (due == 0) return (label: 'ນັດມື້ນີ້', tone: TimeTone.soon);
    return (label: 'ນັດ ${job.appointment!.substring(0, 5)}', tone: TimeTone.plain);
  }
  return (
    label: job.totalLabel != null ? 'ໃຊ້ເວລາ ${job.totalLabel}' : 'ຄ້າງ ${job.days} ມື້',
    tone: TimeTone.plain,
  );
}
