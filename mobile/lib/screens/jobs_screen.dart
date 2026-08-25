import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../pending.dart';
import 'repair_stock_screen.dart';
import 'stock_balance_screen.dart';
import '../main.dart';
import '../push.dart';
import '../widgets/ui_kit.dart';
import 'notifications_screen.dart';
import 'job_screen.dart';
import 'login_screen.dart';

const actionLabel = {
  'accept': 'ຕ້ອງຮັບງານ',
  'start': 'ພ້ອມເລີ່ມ',
  'finish': 'ກຳລັງເຮັດ',
  'wait_spare': 'ລໍອາໄຫຼ່',
  'wait_other': 'ລໍຂັ້ນຕອນອື່ນ',
};
const actionColor = {
  'accept': danger,
  'start': teal,
  'finish': ok,
  'wait_spare': Color(0xFFD97706),
  'wait_other': Color(0xFF64748B),
};

/// ໄລຍະວຽກຂອງຊ່າງ — ຈັດຫຼາຍໆຂັ້ນ (0-12) ໃຫ້ເປັນ **ໜ້ອຍໆ ອ່ານງ່າຍ** ຕາມທີ່ຊ່າງຄິດ:
/// ໄປຮັບເຄື່ອງ · ລໍຖ້າກວດເຊັກ · ກຳລັງກວດເຊັກ · ຂະບວນການເບີກອາໄຫຼ່ · ລໍຖ້າສ້ອມ · ກຳລັງສ້ອມ …
/// (ຂັ້ນ 3-7 ຂອງສ້ອມ = ສະເໜີລາຄາ/ເບີກ/ສັ່ງຊື້ ⇒ ຮວມເປັນ "ຂະບວນການເບີກອາໄຫຼ່" ດຽວ)
class _Phase {
  final int order;
  final String label;
  final IconData icon;
  final Color color;
  const _Phase(this.order, this.label, this.icon, this.color);
}

const _cAmber = Color(0xFFD97706);
const _cOrange = Color(0xFFEA580C);
const _cBlue = Color(0xFF2563EB);
const _cViolet = Color(0xFF7C3AED);
const _cIndigo = Color(0xFF4F46E5);
const _cPurple = Color(0xFF9333EA);
const _cCyan = Color(0xFF0891B2);

_Phase _phaseOf(Job job) {
  final s = job.stage;
  if (job.workflow == 'maintenance') {
    switch (s) {
      case 0:
        return const _Phase(1, 'ລໍນັດ+ຈັດຊ່າງ', Icons.event_outlined, _cAmber);
      case 1:
        return const _Phase(
          2,
          'ລໍຖ້າຮັບງານລ້າງ',
          Icons.assignment_ind_outlined,
          _cOrange,
        );
      case 2:
        return const _Phase(
          5,
          'ລໍໄປລ້າງ',
          Icons.local_shipping_outlined,
          _cIndigo,
        );
      case 3:
        return const _Phase(
          6,
          'ກຳລັງລ້າງ',
          Icons.cleaning_services_outlined,
          teal,
        );
      case 4:
        return const _Phase(
          7,
          'ລໍຖ້າກວດ QC',
          Icons.verified_outlined,
          _cPurple,
        );
      case 5:
        return const _Phase(
          8,
          'ລໍເກັບເງິນ / ປິດງານ',
          Icons.payments_outlined,
          _cCyan,
        );
      case -1:
        return const _Phase(98, 'ຍົກເລີກແລ້ວ', Icons.cancel_outlined, danger);
      default:
        return const _Phase(99, 'ສຳເລັດ', Icons.check_circle_outline, muted);
    }
  }
  if (job.workflow == 'install') {
    switch (s) {
      case 0:
      case 1:
        return const _Phase(
          1,
          'ລໍຖ້າຮັບງານຕິດຕັ້ງ',
          Icons.assignment_ind_outlined,
          _cAmber,
        );
      case 2:
      case 3:
        return const _Phase(
          4,
          'ຂະບວນການເບີກອາໄຫຼ່',
          Icons.inventory_2_outlined,
          _cViolet,
        );
      case 4:
        return const _Phase(
          5,
          'ລໍຖ້າຕິດຕັ້ງ',
          Icons.build_circle_outlined,
          _cIndigo,
        );
      case 5:
        return const _Phase(6, 'ກຳລັງຕິດຕັ້ງ', Icons.handyman_outlined, teal);
      case 6:
      case 7:
        return const _Phase(
          7,
          'ລໍກວດ QC ຕິດຕັ້ງ',
          Icons.verified_outlined,
          _cPurple,
        );
      case 8:
        return const _Phase(
          8,
          'ລໍຖ້າປິດງານ',
          Icons.assignment_turned_in_outlined,
          _cCyan,
        );
      case -1:
        return const _Phase(98, 'ຍົກເລີກແລ້ວ', Icons.cancel_outlined, danger);
      default:
        return const _Phase(
          99,
          'ປິດງານແລ້ວ',
          Icons.check_circle_outline,
          muted,
        );
    }
  }
  // ── ສ້ອມແປງ ──
  // IH = ໄປສ້ອມບ້ານລູກຄ້າ (ເຄື່ອງຢູ່ບ້ານ ບໍ່ໄດ້ຢູ່ສູນ) ⇒ ຂັ້ນ 0/11/12 ຄຳຕ່າງຈາກ PS/ທົ່ວໄປ
  // (ບ່ອນດຽວກັບ IH_STAGE_LABEL ຝັ່ງເວັບ). ຂັ້ນ 0 ບໍ່ແມ່ນ "ໄປຮັບເຄື່ອງ" ແຕ່ແມ່ນ "ລໍນັດ/ຈັດຊ່າງ".
  final ih = job.serviceType == 'IH';
  switch (s) {
    case 0:
      return ih
          ? const _Phase(
              0,
              'ລໍນັດ / ຈັດຊ່າງໄປສ້ອມ',
              Icons.event_outlined,
              _cAmber,
            )
          : const _Phase(
              0,
              'ໄປຮັບເຄື່ອງ',
              Icons.local_shipping_outlined,
              _cAmber,
            );
    case 1:
      return const _Phase(
        1,
        'ລໍຖ້າກວດເຊັກ',
        Icons.pending_actions_outlined,
        _cOrange,
      );
    case 2:
      return const _Phase(2, 'ກຳລັງກວດເຊັກ', Icons.fact_check_outlined, _cBlue);
    // ── ຂັ້ນ 3-4 = **ສະເໜີລາຄາ** ບໍ່ແມ່ນອາໄຫຼ່ (ແກ້ 06-08-2026) ──
    // ເມື່ອກ່ອນເອົາ 3-7 ລວມເປັນ "ຂະບວນການເບີກອາໄຫຼ່" ⇒ ວຽກທີ່ລໍ/ກຳລັງສະເໜີລາຄາ
    // ຂຶ້ນວ່າກຳລັງເບີກອາໄຫຼ່ ທັງທີ່ຍັງບໍ່ໄດ້ຂໍເບີກຈັກແຖວ (ຜິດຈາກເວັບ — lib/stage).
    case 3:
      return const _Phase(3, 'ລໍຖ້າສະເໜີລາຄາ', Icons.request_quote_outlined, _cViolet);
    case 4:
      return const _Phase(3, 'ກຳລັງສະເໜີລາຄາ', Icons.request_quote_outlined, _cViolet);
    // 5-7 (ກວດ Stock · ກຳລັງເບີກ · ກຳລັງສັ່ງຊື້) = ຂັ້ນອາໄຫຼ່ — ລວມເປັນກ້ອນດຽວ
    // ຄືກັບເມນູເວັບ ("ອາໄຫຼ່ — ຂໍເບີກ · ສາງເບີກ · ຮັບ · ສັ່ງຊື້" ໃນ lib/navigation)
    case 5:
    case 6:
    case 7:
      return const _Phase(
        4,
        'ຂະບວນການເບີກອາໄຫຼ່',
        Icons.inventory_2_outlined,
        _cViolet,
      );
    case 8:
      return const _Phase(
        5,
        'ລໍຖ້າສ້ອມແປງ',
        Icons.build_circle_outlined,
        _cIndigo,
      );
    case 9:
      return const _Phase(6, 'ກຳລັງສ້ອມແປງ', Icons.handyman_outlined, teal);
    case 10:
      return const _Phase(
        7,
        'ລໍກວດຮັບຄຸນນະພາບ',
        Icons.verified_outlined,
        _cPurple,
      );
    case 11:
      return ih
          ? const _Phase(
              8,
              'ລໍປິດງານ',
              Icons.assignment_turned_in_outlined,
              _cCyan,
            )
          : const _Phase(
              8,
              'ລໍຖ້າສົ່ງຄືນ',
              Icons.assignment_turned_in_outlined,
              _cCyan,
            );
    case 12:
      return ih
          ? const _Phase(
              99,
              'ຈົບງານ (ໜ້າງານ)',
              Icons.check_circle_outline,
              muted,
            )
          : const _Phase(
              99,
              'ສົ່ງຄືນສຳເລັດ',
              Icons.check_circle_outline,
              muted,
            );
    case -1:
      return const _Phase(98, 'ຍົກເລີກ', Icons.cancel_outlined, danger);
    default:
      return _Phase(90, job.stageLabel, Icons.circle_outlined, muted);
  }
}

/* ── ພາກໃຫຍ່: ກວດເຊັກ · ສ້ອມແປງ · ຕິດຕັ້ງ ────────────────────────
   ວຽກ "ກວດເຊັກ" ກັບ "ສ້ອມແປງ" ເປັນຄົນລະຫົວວຽກ ⇒ ແຍກເປັນພາກ ບໍ່ໃຫ້ປົນກັນ.
   ງານຕິດຕັ້ງເປັນອີກສາຍງານໜຶ່ງ (ບໍ່ມີຂັ້ນກວດເຊັກ) ຈຶ່ງແຍກພາກຂອງມັນເອງ. */
enum _Band { check, repair, install, maintenance }

class _BandMeta {
  final String label;
  final IconData icon;
  const _BandMeta(this.label, this.icon);
}

/// ປ້າຍສັ້ນສຳລັບ **tab** (ບ່ອນແຄບ) — ບຳລຸງຮັກສາ / ລ້າງແອ ຍາວເກີນ ⇒ ໃຊ້ "ລ້າງແອ"
const _bandTabLabel = {
  _Band.check: 'ກວດເຊັກ',
  _Band.repair: 'ສ້ອມແປງ',
  _Band.install: 'ຕິດຕັ້ງ',
  _Band.maintenance: 'ລ້າງແອ',
};

const _bandMeta = {
  _Band.check: _BandMeta('ກວດເຊັກ', Icons.fact_check_outlined),
  _Band.repair: _BandMeta('ສ້ອມແປງ', Icons.handyman_outlined),
  _Band.install: _BandMeta('ຕິດຕັ້ງ', Icons.construction_outlined),
  _Band.maintenance: _BandMeta(
    'ບຳລຸງຮັກສາ / ລ້າງແອ',
    Icons.cleaning_services_outlined,
  ),
};

/// ຂັ້ນ 0-2 (ໄປຮັບເຄື່ອງ · ລໍຖ້າກວດ · ກຳລັງກວດ) = ກວດເຊັກ · ທີ່ເຫຼືອ = ສ້ອມແປງ
_Band _bandOf(Job job) {
  if (job.workflow == 'maintenance') return _Band.maintenance;
  if (job.workflow == 'install') return _Band.install;
  final s = job.stage;
  return (s >= 0 && s <= 2) ? _Band.check : _Band.repair;
}

/* ══ ຄວາມຮີບ (v5) ══════════════════════════════════════════════════════════
   ແຕ່ກ່ອນລາຍການຈັດກຸ່ມຕາມ **ໄລຍະ** (ລໍຖ້າກວດ · ກຳລັງສ້ອມ …) ເຊິ່ງເປັນວິທີຄິດຂອງ
   ລະບົບ. ຊ່າງບໍ່ໄດ້ວາງແຜນມື້ຂອງຕົນຈາກໄລຍະ — ລາວວາງແຜນຈາກ **ເວລາ**: ອັນໃດເລີຍກຳນົດ
   ແລ້ວ, ອັນໃດນັດມື້ນີ້, ອັນໃດຍັງບໍ່ຮອດຄິວ. v5 ຈຶ່ງຈັດກຸ່ມຕາມນັ້ນ ແລະ ຍົກໄລຍະລົງໄປ
   ເປັນລາຍລະອຽດໃນກາດ (ຍັງເຫັນຢູ່ ບໍ່ໄດ້ຫາຍໄປ).
   ══════════════════════════════════════════════════════════════════════════ */
enum _Urgency { late_, today, act, waitSpare, waitOther }

const _urgencyLabel = {
  _Urgency.late_: 'ຊ້າແລ້ວ',
  _Urgency.today: 'ນັດມື້ນີ້',
  _Urgency.act: 'ຕ້ອງລົງມື',
  _Urgency.waitSpare: 'ລໍອາໄຫຼ່',
  _Urgency.waitOther: 'ລໍຂັ້ນຕອນອື່ນ',
};

const _urgencyColor = {
  _Urgency.late_: danger,
  _Urgency.today: warn,
  _Urgency.act: ink,
  _Urgency.waitSpare: warn,
  _Urgency.waitOther: muted,
};

/// ວັນນັດ — server ສົ່ງເປັນ `DD-MM-YYYY` (mobile-jobs.ts). ອ່ານບໍ່ອອກ = null
/// ⇒ ຖືວ່າ "ບໍ່ມີນັດ" ບໍ່ແມ່ນ "ເລີຍນັດ" (ຢ່າຍ້ອມແດງໃສ່ໃບທີ່ບໍ່ໄດ້ຊ້າ).
DateTime? _appointDate(Job job) {
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
int? _appointIn(Job job) {
  final date = _appointDate(job);
  if (date == null) return null;
  final now = DateTime.now();
  return date.difference(DateTime(now.year, now.month, now.day)).inDays;
}

const _actionable = {'accept', 'start', 'finish'};

_Urgency _urgencyOf(Job job) {
  final overdueSla = job.slaLeft != null && job.slaLeft! < 0;
  final due = _appointIn(job);
  // ເລີຍກຳນົດ SLA ຫຼື ເລີຍວັນນັດ = ຊ້າ **ບໍ່ວ່າຈະຢູ່ຂັ້ນໃດ** (ຫົວໜ້າຖາມຫາອັນນີ້ກ່ອນ)
  if (overdueSla || (due != null && due < 0)) return _Urgency.late_;
  if (due == 0) return _Urgency.today;
  if (_actionable.contains(job.action)) return _Urgency.act;
  return job.action == 'wait_spare' ? _Urgency.waitSpare : _Urgency.waitOther;
}

/// ຮີບກ່ອນຢູ່ເທິງ: SLA ໜ້ອຍສຸດ → ນັດໃກ້ສຸດ → ຄ້າງດົນສຸດ (ນິຍາມດຽວກັບ order by ຂອງ server)
int _byUrgency(Job a, Job b) {
  final sla = (a.slaLeft ?? 1e9).compareTo(b.slaLeft ?? 1e9);
  if (sla != 0) return sla;
  final due = (_appointIn(a) ?? 1 << 30).compareTo(_appointIn(b) ?? 1 << 30);
  if (due != 0) return due;
  return b.elapsedSeconds.compareTo(a.elapsedSeconds);
}

/// ຄຳສັ່ງທີ່ຈະຂຶ້ນເປັນ **ແຖວທຳອິດ** ຂອງກາດ — ຄຳກິລິຍາ ບໍ່ແມ່ນສະຖານະ.
/// ຂັ້ນທີ່ຊ່າງລົງມືບໍ່ໄດ້ (ລໍຄົນອື່ນ) ໃຊ້ຊື່ໄລຍະ ເພາະນັ້ນຄືຂໍ້ມູນທີ່ມີຄ່າກວ່າ.
String _actionVerb(Job job) => switch (job.action) {
  'accept' => 'ຕ້ອງຮັບງານ',
  'start' => job.onsite && !job.checkedIn ? 'ໄປໜ້າງານ — check-in' : 'ພ້ອມເລີ່ມ',
  'finish' => job.onsite && !job.checkedIn
      ? 'ໄປໜ້າງານ — check-in'
      : 'ກຳລັງເຮັດ — ບັນທຶກຜົນ',
  'wait_spare' => 'ລໍອາໄຫຼ່',
  _ => _phaseOf(job).label,
};

/// ຊິບເວລາຂອງກາດ — ອັນດຽວ ບອກສິ່ງທີ່ຮີບທີ່ສຸດ
({String label, TimeTone tone}) _timeOf(Job job) {
  final sla = job.slaLeft;
  if (sla != null) {
    final hours = (sla.abs() / 3600).floor();
    if (sla < 0) return (label: 'ເລີຍກຳນົດ $hours ຊມ', tone: TimeTone.late_);
    if (sla < 4 * 3600) return (label: 'ເຫຼືອ $hours ຊມ', tone: TimeTone.soon);
  }
  final due = _appointIn(job);
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

class _UrgencyGroup {
  final _Urgency urgency;
  final List<Job> jobs;
  const _UrgencyGroup(this.urgency, this.jobs);
}

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});
  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<Job> jobs = [];
  bool loading = true;
  String error = '';
  String username = ''; // ຊື່ຜູ້ໃຊ້ — ໃຫ້ hero ທັກທາຍ

  Future<void> load() async {
    try {
      final rows = await Api.jobs();
      if (!mounted) return;
      setState(() {
        jobs = rows;
        error = '';
        loading = false;
        cachedAt = Api.jobsFromCacheAt;
        pendingCount = Pending.count;
      });
    } on ApiError catch (failure) {
      if (!mounted) return;
      if (failure.status == 401) {
        await Api.clearToken();
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
        return;
      }
      setState(() {
        error = failure.message;
        loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້';
          loading = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    load();
    Api.savedUsername().then((name) {
      if (mounted && name != null) setState(() => username = name);
    });
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> logout() async {
    // ຖອນ push token = ຍິງ FCM/server (ຊ້າ/ອາດ timeout) ⇒ ຢ່າ block logout ດ້ວຍມັນ.
    // ລ້າງ token ໃນເຄື່ອງ (ໄວ) ແລ້ວໄປໜ້າ login ທັນທີ; unregister ແລ່ນพื้นหลัง.
    unawaited(Push.unregister());
    await Api.clearToken();
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  /// ຄຳຄົ້ນ — ຊ່າງທີ່ມີ 30-40 ໃບ ຫາເລກໃບ/ຊື່ລູກຄ້າດ້ວຍການເລື່ອນບໍ່ໄຫວ
  final search = TextEditingController();

  /// ຂໍ້ມູນມາຈາກ cache ຕອນໃດ (null = ສົດ) + ຈຳນວນຄຳສັ່ງທີ່ຍັງລໍສົ່ງ
  DateTime? cachedAt;
  int pendingCount = 0;

  /// ພາກທີ່ຖືກເລືອກ (null = ທັງໝົດ) — v5 ໃຊ້ຊິບແທນ tab ຈຶ່ງມີ "ທັງໝົດ" ໄດ້
  /// (ແຕ່ກ່ອນ tab ບັງຄັບໃຫ້ເບິ່ງເທື່ອລະພາກ ⇒ ຊ່າງທີ່ມີທັງງານສ້ອມ ແລະ ຕິດຕັ້ງ
  /// ຕ້ອງສະຫຼັບ tab ໄປມາ ຈຶ່ງຮູ້ວ່າມື້ນີ້ຕ້ອງໄປໃສກ່ອນ).
  _Band? filter;

  /// ວຽກຫຼັງກອງພາກ ແລະ ຄຳຄົ້ນ
  List<Job> get _visible {
    final term = search.text.trim().toLowerCase();
    return jobs.where((job) {
      if (filter != null && _bandOf(job) != filter) return false;
      if (term.isEmpty) return true;
      // ຄົ້ນສິ່ງທີ່ຊ່າງຈື່ໄດ້: ເລກໃບ · ຊື່ລູກຄ້າ · ສິນຄ້າ · ທີ່ຢູ່ · ເບີໂທ
      return [
        job.code,
        job.customer,
        job.product,
        job.address,
        job.tel,
      ].any((value) => (value ?? '').toLowerCase().contains(term));
    }).toList();
  }

  /// ຈຳນວນຕໍ່ພາກ — ໃສ່ໃນຊິບ ⇒ ຮູ້ປະລິມານກ່ອນກົດ
  Map<_Band, int> get _bandCounts {
    final out = <_Band, int>{};
    for (final j in jobs) {
      out.update(_bandOf(j), (v) => v + 1, ifAbsent: () => 1);
    }
    return out;
  }

  /// ຈັດກຸ່ມຕາມ **ຄວາມຮີບ** — ກຸ່ມຫວ່າງບໍ່ສະແດງ (ບໍ່ໃຫ້ຫົວລອຍ)
  List<_UrgencyGroup> get _groups {
    final byUrgency = <_Urgency, List<Job>>{};
    for (final j in _visible) {
      (byUrgency[_urgencyOf(j)] ??= []).add(j);
    }
    final out = <_UrgencyGroup>[];
    for (final urgency in _Urgency.values) {
      final list = byUrgency[urgency];
      if (list == null || list.isEmpty) continue;
      list.sort(_byUrgency);
      out.add(_UrgencyGroup(urgency, list));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final actionCount = jobs.where((j) => _actionable.contains(j.action)).length;
    final lateCount = jobs.where((j) => _urgencyOf(j) == _Urgency.late_).length;
    final todayCount = jobs.where((j) => _urgencyOf(j) == _Urgency.today).length;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            // ທັກທາຍດ້ວຍຊື່ຜູ້ໃຊ້ (ຫວ່າງ = ຍັງໂຫຼດບໍ່ທັນ ⇒ ໃຊ້ eyebrow ຕັ້ງຕົ້ນ)
            eyebrow: username.isNotEmpty
                ? 'ສະບາຍດີ, $username'
                : 'ODIEN SERVICE',
            title: 'ວຽກຂອງຂ້ອຍ',
            trailing: [
              HeroIconButton(
                icon: Icons.notifications_none,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const NotificationsScreen(),
                  ),
                ),
              ),
              HeroIconButton(icon: Icons.refresh_rounded, onTap: load),
              PopupMenuButton<String>(
                tooltip: 'ເມນູ',
                onSelected: (value) {
                  if (value == 'logout') logout();
                  if (value == 'stock-balance') {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const StockBalanceScreen(),
                      ),
                    );
                  }
                  if (value == 'repair-stock') {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const RepairStockScreen(),
                      ),
                    );
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(
                    value: 'stock-balance',
                    child: Row(
                      children: [
                        Icon(Icons.inventory_2_outlined, size: 19),
                        SizedBox(width: 10),
                        Text('ສິນຄ້າຄົງເຫຼືອ'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'repair-stock',
                    child: Row(
                      children: [
                        Icon(Icons.warehouse_outlined, size: 19),
                        SizedBox(width: 10),
                        Text('ຄົງເຫຼືອ ສາງສ້ອມ'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'logout',
                    child: Row(
                      children: [
                        Icon(Icons.logout_rounded, size: 19),
                        SizedBox(width: 10),
                        Text('ອອກຈາກລະບົບ'),
                      ],
                    ),
                  ),
                ],
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: hero2,
                    borderRadius: BorderRadius.circular(kButtonRadius),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: const Icon(Icons.more_vert, size: 21, color: onHero),
                ),
              ),
            ],
            // v5: ສະຖິຕິບອກ **ຄວາມຮີບ** ບໍ່ແມ່ນປະລິມານ — "ວຽກໜ້າງານ 12" ບໍ່ໄດ້ບອກ
            // ວ່າຕ້ອງເຮັດຫຍັງກ່ອນ, ແຕ່ "ຊ້າແລ້ວ 2" ບອກ.
            stats: [
              HeroStat(
                value: '$lateCount',
                label: 'ຊ້າແລ້ວ',
                color: lateCount > 0 ? const Color(0xFFFDA4AF) : null,
              ),
              HeroStat(
                value: '$todayCount',
                label: 'ນັດມື້ນີ້',
                color: todayCount > 0 ? const Color(0xFFFDBA74) : null,
              ),
              HeroStat(value: '$actionCount', label: 'ຕ້ອງລົງມື'),
            ],
          ),
          if (!loading && error.isEmpty && jobs.isNotEmpty) ...[
            _offlineBanner(),
            _searchBox(),
            _filterPills(),
          ],
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? _Empty(
                    icon: Icons.cloud_off_rounded,
                    title: error,
                    action: load,
                  )
                : jobs.isEmpty
                ? _Empty(
                    icon: Icons.task_alt_rounded,
                    title: 'ບໍ່ມີວຽກ',
                    action: load,
                  )
                : _urgencyList(),
          ),
        ],
      ),
    );
  }

  /// ປ້າຍບອກວ່າ **ຂໍ້ມູນນີ້ເກົ່າ** / ມີຄຳສັ່ງລໍສົ່ງ — ບໍ່ດັ່ງນັ້ນຊ່າງເບິ່ງລາຍການ
  /// ທີ່ໂຫຼດຕອນເຊົ້າແລ້ວເຂົ້າໃຈວ່າແມ່ນຂອງດຽວນີ້ (ຫົວໜ້າອາດຈັດງານໃໝ່ໄປແລ້ວ)
  Widget _offlineBanner() {
    final at = cachedAt;
    if (at == null && pendingCount == 0) return const SizedBox.shrink();
    String two(int n) => n.toString().padLeft(2, '0');
    final parts = [
      if (at != null) 'ຂໍ້ມູນເມື່ອ ${two(at.hour)}:${two(at.minute)} (ບໍ່ມີສັນຍານ)',
      if (pendingCount > 0) 'ມີ $pendingCount ລາຍການລໍສົ່ງ',
    ].join(' · ');
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: warnTint,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 15, color: warn),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              parts,
              style: const TextStyle(fontSize: 11.5, color: warn, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  /// ຄົ້ນຫາ — ພິມແລ້ວກອງທັນທີ (ບໍ່ຕ້ອງກົດຄົ້ນ) ເພາະລາຍການຢູ່ໃນເຄື່ອງແລ້ວ
  Widget _searchBox() => Padding(
    padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
    child: TextField(
      controller: search,
      onChanged: (_) => setState(() {}),
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: surface,
        hintText: 'ຄົ້ນ ເລກໃບ · ລູກຄ້າ · ສິນຄ້າ · ທີ່ຢູ່',
        hintStyle: const TextStyle(fontSize: 13, color: faint),
        prefixIcon: const Icon(Icons.search_rounded, size: 20, color: faint),
        suffixIcon: search.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close_rounded, size: 19),
                onPressed: () => setState(search.clear),
                tooltip: 'ລ້າງ',
              ),
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(kButtonRadius),
          borderSide: const BorderSide(color: lineStrong),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(kButtonRadius),
          borderSide: const BorderSide(color: lineStrong),
        ),
      ),
    ),
  );

  /// ── ຊິບກອງພາກ (ແທນ tab v4) ──
  /// ຊິບເລື່ອນໄດ້ ⇒ ໃສ່ "ທັງໝົດ" ໄດ້ ແລະ ບອກຈຳນວນຕໍ່ພາກ. ພາກທີ່ບໍ່ມີວຽກ ບໍ່ຂຶ້ນ.
  Widget _filterPills() {
    final counts = _bandCounts;
    final bands = [_Band.check, _Band.repair, _Band.install, _Band.maintenance]
        .where((b) => (counts[b] ?? 0) > 0)
        .toList();
    // ມີພາກດຽວ = ບໍ່ມີຫຍັງໃຫ້ກອງ ⇒ ບໍ່ຕ້ອງກິນເນື້ອທີ່ຈໍ
    if (bands.length < 2) return const SizedBox.shrink();
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
        children: [
          _pill(label: 'ທັງໝົດ', count: jobs.length, band: null),
          for (final band in bands)
            _pill(
              label: _bandTabLabel[band] ?? _bandMeta[band]!.label,
              count: counts[band] ?? 0,
              band: band,
              icon: _bandMeta[band]!.icon,
            ),
        ],
      ),
    );
  }

  Widget _pill({
    required String label,
    required int count,
    required _Band? band,
    IconData? icon,
  }) {
    final on = filter == band;
    return Padding(
      padding: const EdgeInsets.only(right: 7),
      child: Material(
        color: on ? teal : surface,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: () => setState(() => filter = band),
          borderRadius: BorderRadius.circular(999),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 13),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: on ? teal : lineStrong),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 14, color: on ? onAccent : muted),
                  const SizedBox(width: 5),
                ],
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: on ? onAccent : body,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    color: on ? onAccent : faint,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// ລາຍການວຽກ — ຈັດກຸ່ມຕາມຄວາມຮີບ (ຊ້າ · ນັດມື້ນີ້ · ຕ້ອງລົງມື · ລໍ…)
  Widget _urgencyList() {
    final groups = _groups;
    if (groups.isEmpty) {
      final searching = search.text.trim().isNotEmpty;
      return _Empty(
        icon: searching ? Icons.search_off_rounded : Icons.filter_alt_off_rounded,
        title: searching
            ? 'ບໍ່ພົບ "${search.text.trim()}"'
            : 'ບໍ່ມີວຽກໃນພາກນີ້',
        action: () async => setState(() {
          filter = null;
          search.clear();
        }),
      );
    }
    return RefreshIndicator(
      onRefresh: load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 20),
        // ແຖວ = ຫົວກຸ່ມ + ກາດຂອງກຸ່ມນັ້ນ (ນັບລວມກັນເປັນ index ດຽວ)
        itemCount: groups.fold<int>(0, (n, g) => n + g.jobs.length + 1),
        itemBuilder: (_, index) {
          var i = index;
          for (final group in groups) {
            if (i == 0) {
              return Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 6),
                child: BandHeader(
                  _urgencyLabel[group.urgency]!,
                  count: group.jobs.length,
                  color: _urgencyColor[group.urgency]!,
                ),
              );
            }
            if (i <= group.jobs.length) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _JobCard(job: group.jobs[i - 1], onDone: load),
              );
            }
            i -= group.jobs.length + 1;
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }
}

/// ມີເນື້ອຫາແທ້ບໍ — ຂໍ້ມູນຈິງມີຄ່າ "." / "-" ທີ່ບໍ່ໄດ້ບອກຫຍັງ ຢ່າເອົາມາກິນເນື້ອທີ່
bool _hasText(String? value) {
  final text = (value ?? '').trim();
  return text.isNotEmpty && text != '.' && text != '-';
}

({String label, IconData icon, Color color})? _serviceKind(Job job) {
  if (job.workflow == 'install') {
    return (
      label: 'ຕິດຕັ້ງ',
      icon: Icons.construction_outlined,
      color: Color(0xFF7C3AED),
    );
  }
  if (job.workflow == 'maintenance') {
    return (
      label: 'ລ້າງແອ',
      icon: Icons.cleaning_services_outlined,
      color: Color(0xFF0284C7),
    );
  }
  switch (job.serviceType) {
    case 'IH':
      return (
        label: 'ໄປສ້ອມບ້ານ',
        icon: Icons.home_outlined,
        color: Color(0xFFB45309),
      );
    case 'PS':
      return (
        label: 'ໄປຮັບ-ສ້ອມສູນ',
        icon: Icons.local_shipping_outlined,
        color: Color(0xFF4F46E5),
      );
    case 'CI':
      return (
        label: 'ນຳເຂົ້າສູນ',
        icon: Icons.store_mall_directory_outlined,
        color: Color(0xFF0891B2),
      );
    case 'ST':
      return (
        label: 'ສ້ອມໜ້າງານ',
        icon: Icons.build_outlined,
        color: Color(0xFF0D9488),
      );
    default:
      return (
        label: 'ສ້ອມແປງ',
        icon: Icons.handyman_outlined,
        color: Color(0xFF0D9488),
      );
  }
}

/// ກາດວຽກ v5 — **ຄຳສັ່ງມາກ່ອນ**.
///
/// v4 ວາງ `#SRV-0012` ເປັນແຖວທຳອິດ ແລ້ວປ່ອຍໃຫ້ຕາໄລ່ຫາປ້າຍສະຖານະຢູ່ມຸມຂວາ.
/// ແຕ່ເລກໃບບໍ່ໄດ້ບອກວ່າຕ້ອງເຮັດຫຍັງ — ມັນມີຄ່າຕອນຄຸຍໂທລະສັບເທົ່ານັ້ນ.
/// v5 ຈຶ່ງເອົາ**ຄຳກິລິຍາ** (ໄປໜ້າງານ · ບັນທຶກຜົນ · ຮັບງານ) ຂຶ້ນແຖວໃຫຍ່ ແລະ
/// ຫຼຸດເລກໃບລົງເປັນແຖວສອງ (ຍັງອ່ານ/ບອກຕໍ່ໄດ້ຢູ່).
class _JobCard extends StatelessWidget {
  const _JobCard({required this.job, required this.onDone});
  final Job job;
  final Future<void> Function() onDone;

  @override
  Widget build(BuildContext context) {
    final phase = _phaseOf(job);
    final kind = _serviceKind(job);
    final time = _timeOf(job);
    final who = [
      if (_hasText(job.customer)) job.customer!.trim(),
      if (_hasText(job.address)) job.address!.trim(),
    ].join(' · ');
    void open() => Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => JobScreen(job: job)),
    ).then((_) => onDone());

    return RepaintBoundary(
      child: Container(
        clipBehavior: Clip.antiAlias,
        // flat — ບໍ່ມີເງົາ (list ຍາວ render ໄວຂຶ້ນເທິງເຄື່ອງເກົ່າ)
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(kCardRadius),
          border: Border.all(color: line),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: open,
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ແຖບສີໄລຍະດ້ານຊ້າຍ — ຍັງເປັນຕົວບອກ "ຢູ່ຂັ້ນໃດຂອງ flow"
                  Container(width: 5, color: phase.color),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 11, 11, 11),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // ── ① ຄຳສັ່ງ + ເວລາ ──
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: phase.color,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 7),
                              Expanded(
                                child: Text(
                                  _actionVerb(job),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: ink,
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -.2,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              TimeChip(time.label, tone: time.tone),
                            ],
                          ),
                          const SizedBox(height: 7),
                          // ── ② ເລກໃບ + ສິນຄ້າ ──
                          Row(
                            children: [
                              Text(
                                job.code,
                                style: const TextStyle(
                                  color: teal,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  job.product ?? '-',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: body,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              if (kind != null) ...[
                                const SizedBox(width: 6),
                                Icon(kind.icon, size: 13, color: kind.color),
                              ],
                            ],
                          ),
                          if (who.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              who,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: muted,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                          const SizedBox(height: 8),
                          const Divider(height: 1),
                          const SizedBox(height: 8),
                          // ── ③ ໄລຍະ + ປ້າຍພິເສດ ──
                          Row(
                            children: [
                              if (job.checkedIn) ...[
                                const Icon(Icons.location_on, size: 13, color: ok),
                                const SizedBox(width: 3),
                              ],
                              /*
                                ── ໃບທີ່ຕ້ອງກັບໄປອີກຮອບ (12-08-2026) ──
                                ຊ່າງບໍ່ສົນວ່າ "ຄ້າງ 48 ມື້" — ລາວສົນວ່າໃບນີ້ເຄີຍໄປແລ້ວບໍ.
                              */
                              if (job.visitRounds > 0) ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: tealTint,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    'ຮອບທີ ${job.checkedIn ? job.visitRounds : job.visitRounds + 1}',
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w900,
                                      color: teal,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ],
                              Expanded(
                                child: Text(
                                  phase.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: faint,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                width: 27,
                                height: 27,
                                decoration: BoxDecoration(
                                  color: phase.color.withValues(alpha: .09),
                                  borderRadius: BorderRadius.circular(9),
                                ),
                                child: Icon(
                                  Icons.arrow_forward_rounded,
                                  color: phase.color,
                                  size: 15,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.action});
  final IconData icon;
  final String title;
  final Future<void> Function() action;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 54, color: const Color(0xFFCBD5E1)),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: action,
            icon: const Icon(Icons.refresh),
            label: const Text('ລອງໃໝ່'),
          ),
        ],
      ),
    ),
  );
}
