import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../drafts.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'check_screen.dart';
import 'finished_screen.dart';
import 'pickup_screen.dart';
import 'job_spare_screen.dart';
import 'scan_serial_screen.dart';
import 'spare_request_screen.dart';
import 'spare_return_screen.dart';

/// ໜ້າງານດຽວ — ປຸ່ມທີ່ສະແດງ **ມາຈາກ server** (`job.action`) ບໍ່ແມ່ນແອັບຄິດເອງ.
///
/// ຮູບຜົນງານ: ຈົບງານ **ຕິດຕັ້ງ** ຕ້ອງແນບຢ່າງໜ້ອຍ 1 ຮູບ (server ບັງຄັບອີກຊັ້ນ) —
/// ຮູບ check-in ຄືສະພາບ "ກ່ອນເຮັດ" ແລະ ຮູບ QC ຖ່າຍໂດຍຄົນອື່ນໃນມື້ຕໍ່ມາ
/// ⇒ ບໍ່ມີຫຼັກຖານວ່າຕອນຊ່າງອອກຈາກໜ້າງານ ວຽກຢູ່ໃນສະພາບໃດ.
class JobScreen extends StatefulWidget {
  const JobScreen({super.key, required this.job});
  final Job job;

  @override
  State<JobScreen> createState() => _JobScreenState();
}

class _JobScreenState extends State<JobScreen> {
  late Job job = widget.job;

  /// ຮອບຂໍເບີກຂອງງານນີ້ (ພ້ອມໃບເບີກລາຍໃບ) — ໂຫຼດຕອນຢູ່ຂັ້ນອາໄຫຼ່
  List<SpareWithdrawRound> _rounds = const [];
  final note = TextEditingController();
  final reason = TextEditingController();
  final photos = <String>[];
  bool busy = false;
  bool rejecting = false;

  /// ຈຳນວນອາໄຫຼ່ທີ່ **ເບີກມາແລ້ວ ຍັງບໍ່ໄດ້ສົ່ງຄືນ** — ປຸ່ມ "ສົ່ງຄືນ" ຂຶ້ນສະເພາະເມື່ອ > 0
  int outstandingSpares = 0;

  /// ຮູບເກົ່າຂອງງານ (ຮັບເຄື່ອງ · ກວດເຊັກ · ສ້ອມສຳເລັດ) — ໂຫຼດຈາກ server
  JobPhotos? gallery;

  /// ຂໍ້ມູນການສົ່ງເຄື່ອງ (ສະເພາະຕິດຕັ້ງ) — ພິກັດຈຸດສົ່ງ · ເບີຄົນຮັບ · ຮູບ
  DeliveryInfo? delivery;

  /// ເສັ້ນເວລາ + ຮອບເຂົ້າໜ້າງານ — server ຄິດໃຫ້ (ນິຍາມດຽວກັບເວັບ)
  JobTimelineData? timeline;

  /// ເຄື່ອງສຳຮອງທີ່ລູກຄ້າຍັງຖືຢູ່ (ສະເພາະສ້ອມ) — ຕ້ອງເອົາຄືນຕອນສົ່ງເຄື່ອງ
  List<LoanerOut> loaners = const [];

  /// "ຕອນນີ້ລໍໃຜເຮັດ" + ສະຖານະອາໄຫຼ່ (ສະເພາະສ້ອມ) — server ຄິດໃຫ້ ນິຍາມດຽວກັບເວັບ
  NextActor? nextActor;
  SpareSummary? spareSummary;

  /// ຮູບຕອນສົ່ງ — null = ຍັງບໍ່ໄດ້ກົດເບິ່ງ (ບໍ່ໂຫຼດມາພ້ອມໜ້າ ເພາະໜັກ)
  List<String>? deliveryPhotos;
  bool loadingDeliveryPhotos = false;

  /// ການເຄື່ອນໄຫວ (ຂໍ້ຄວາມ/log + ກິດຈະກຳ) — ຊຸດດຽວກັບ chatter ຢູ່ເວັບ
  JobChatter? chatter;
  String chatterError = '';
  final chatInput = TextEditingController();
  bool sending = false;

  final picker = ImagePicker();

  /// ບ່ອນເກັບຮ່າງຂອງໃບງານນີ້ — ຮູບຜົນງານ/ຮູບ check-in/ບັນທຶກ ທີ່ຍັງບໍ່ໄດ້ສົ່ງ
  String get _draftKey => 'job:${job.workflow}:${job.code}';

  void _saveDraft() => Drafts.write(_draftKey, {
        'photos': photos,
        'note': note.text,
        'checkin': _retainedCheckinPhoto,
      });

  @override
  void initState() {
    super.initState();
    // ຄືນຮ່າງຮອບກ່ອນ (ອອກຈາກໜ້າຈໍ ຫຼື ແອັບຖືກຂ້າຕອນກ້ອງເປີດ) — ຢ່າໃຫ້ຖ່າຍໃໝ່
    final saved = Drafts.read(_draftKey);
    photos.addAll(Drafts.photos(_draftKey));
    note.text = (saved['note'] as String?) ?? '';
    _retainedCheckinPhoto = saved['checkin'] as String?;
    note.addListener(_saveDraft);
    loadOutstanding();
    loadGallery();
    loadChatter();
  }

  /// ໂຫຼດຮູບເກົ່າ + ເສັ້ນເວລາ — ລົ້ມກໍ່ບໍ່ເປັນຫຍັງ (ພຽງບໍ່ສະແດງ)
  Future<void> loadGallery() async {
    try {
      final detail = await Api.jobDetail(job.workflow, job.code);
      if (mounted) {
        setState(() {
          gallery = detail.photos;
          delivery = detail.delivery;
          timeline = detail.timeline;
          loaners = detail.loaners;
          nextActor = detail.nextActor;
          spareSummary = detail.spares;
        });
      }
    } catch (_) {
      // ບໍ່ໃຫ້ລົ້ມໜ້າງານ
    }
  }

  /// ໂຫຼດການເຄື່ອນໄຫວ (ຂໍ້ຄວາມ + ກິດຈະກຳ) — ລົ້ມກໍ່ບໍ່ກະທົບການເຮັດວຽກ
  ///
  /// ⚠️ ຕ້ອງເກັບ error ໄວ້ **ບອກຜູ້ໃຊ້** ບໍ່ແມ່ນກືນງຽບໆ: ຖ້າກືນແລ້ວປ່ອຍ chatter = null
  /// ໜ້າຈໍຈະ **ໝູນຄ້າງຕະຫຼອດ** ໂດຍທີ່ຊ່າງບໍ່ຮູ້ວ່າມັນລົ້ມ (ເຊັ່ນ server ຍັງບໍ່ທັນ deploy).
  Future<void> loadChatter() async {
    if (mounted) setState(() => chatterError = '');
    try {
      final data = await Api.chatter(job.workflow, job.code);
      if (mounted) setState(() => chatter = data);
    } on ApiError catch (failure) {
      if (mounted) setState(() => chatterError = failure.message);
    } catch (caught) {
      if (mounted) setState(() => chatterError = '$caught');
    }
  }

  /// ສົ່ງຂໍ້ຄວາມຫາ CS/ຫົວໜ້າ (ເຂົ້າ chatter ອັນດຽວກັບເວັບ)
  Future<void> sendMessage() async {
    final text = chatInput.text.trim();
    if (text.isEmpty) return;
    setState(() => sending = true);
    try {
      await Api.postChatter(job.workflow, job.code, text);
      chatInput.clear();
      await loadChatter();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('ສົ່ງຂໍ້ຄວາມແລ້ວ')));
      }
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> finishActivity(JobActivity activity) async {
    try {
      await Api.completeActivity(job.workflow, job.code, activity.id);
      await loadChatter();
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    }
  }

  Future<void> scheduleActivity() async {
    final summary = TextEditingController();
    final noteInput = TextEditingController();
    var kind = 'todo';
    var due = DateTime.now().add(const Duration(days: 1));
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('ນັດກິດຈະກຳ'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: kind,
                  items: const [
                    DropdownMenuItem(
                      value: 'todo',
                      child: Text('ວຽກທີ່ຕ້ອງເຮັດ'),
                    ),
                    DropdownMenuItem(value: 'call', child: Text('ໂທຫາ')),
                    DropdownMenuItem(value: 'visit', child: Text('ເຂົ້າພົບ')),
                    DropdownMenuItem(value: 'meeting', child: Text('ປະຊຸມ')),
                  ],
                  onChanged: (value) => kind = value ?? 'todo',
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: summary,
                  decoration: const InputDecoration(labelText: 'ຫົວຂໍ້ *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: noteInput,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'ໝາຍເຫດ'),
                ),
                const SizedBox(height: 10),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(
                    '${due.day.toString().padLeft(2, '0')}-${due.month.toString().padLeft(2, '0')}-${due.year}',
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: dialog,
                      initialDate: due,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setDialogState(() => due = picked);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: const Text('ຍົກເລີກ'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.pop(dialog, summary.text.trim().isNotEmpty),
              child: const Text('ບັນທຶກ'),
            ),
          ],
        ),
      ),
    );
    if (saved != true) {
      summary.dispose();
      noteInput.dispose();
      return;
    }
    final dueDate =
        '${due.year}-${due.month.toString().padLeft(2, '0')}-${due.day.toString().padLeft(2, '0')}';
    try {
      await Api.scheduleActivity(
        job.workflow,
        job.code,
        kind: kind,
        summary: summary.text,
        note: noteInput.text,
        dueDate: dueDate,
      );
      await loadChatter();
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      summary.dispose();
      noteInput.dispose();
    }
  }

  /// ໂຫຼດຈຳນວນອາໄຫຼ່ຄ້າງນຳຊ່າງ — ລົ້ມກໍ່ບໍ່ເປັນຫຍັງ (ພຽງເຊື່ອງປຸ່ມ)
  /// ຮອບຂໍເບີກ + ໃບເບີກລາຍໃບ — ໃຫ້ຊ່າງເຫັນວ່າ **ໃບໃດຍັງບໍ່ໄດ້ຮັບ** ແລະ ກົດຮັບໄດ້ຈາກໜ້ານີ້ເລີຍ
  /// (ກົດເກນ 06-08-2026: ຕ້ອງກົດຮັບ**ທຸກໃບ** ຈຶ່ງໄປຂັ້ນຕໍ່ໄປ ⇒ ບໍ່ເຫັນລາຍໃບ = ຕິດ)
  Future<void> loadRounds() async {
    if (job.action != 'wait_spare') return;
    try {
      final data = await Api.spareRounds(job.workflow, job.code);
      if (mounted) setState(() => _rounds = data.withdrawals);
    } catch (_) {
      // ບໍ່ໃຫ້ລົ້ມໜ້າງານ — ຍັງມີປຸ່ມ "ໄປໜ້າ ຮັບອາໄຫຼ່" ເປັນທາງສຳຮອງ
    }
  }

  Future<void> loadOutstanding() async {
    loadRounds();
    try {
      final rows = await Api.outstandingSpares(job.workflow, job.code);
      if (mounted) setState(() => outstandingSpares = rows.length);
    } catch (_) {
      // ບໍ່ໃຫ້ລົ້ມໜ້າງານ
    }
  }

  @override
  void dispose() {
    note.removeListener(_saveDraft);
    note.dispose();
    reason.dispose();
    chatInput.dispose();
    super.dispose();
  }

  Future<void> reload() async {
    final rows = await Api.jobs();
    final fresh = rows.where(
      (row) => row.workflow == job.workflow && row.code == job.code,
    );
    if (!mounted) return;
    if (fresh.isEmpty) {
      Navigator.pop(context);
      return;
    }
    setState(() => job = fresh.first);
    loadOutstanding();
    loadGallery();
    loadChatter();
  }

  Future<void> run(Map<String, dynamic> body, {bool pop = false}) async {
    setState(() => busy = true);
    try {
      final message = await Api.command(job.workflow, job.code, body);
      // ຮູບ/ບັນທຶກ ໄປຮອດ server (ຫຼື ເຂົ້າຄິວ offline ພ້ອມ body) ແລ້ວ ⇒ ຮ່າງບໍ່ຈຳເປັນອີກ
      final finished = body['action'] == 'finish';
      if (body.containsKey('photos')) {
        photos.clear();
        note.clear();
        Drafts.clear(_draftKey);
      }
      if (!mounted) return;
      /*
        ── ຈົບງານ = ຈຸດສິ້ນສຸດທີ່ຮູ້ສຶກໄດ້ (v6) ──
        ແທນແຖບຂໍ້ຄວາມນ້ອຍໆທີ່ຫາຍໄປໃນ 3 ວິ — ຂຶ້ນຈໍສະຫຼອງພ້ອມຕົວເລກ
        (ໃບເດືອນນີ້ · ຄ່າຄອມ · ມື້ຕິດ) ແລ້ວຈຶ່ງກັບຄືນລາຍການວຽກ.
        ຄິວ offline (OFFLINE_QUEUED) ບໍ່ສະຫຼອງ — ຍັງບໍ່ຮູ້ວ່າ server ຮັບຫຼືບໍ່.
      */
      if (finished && !message.startsWith('OFFLINE_QUEUED:')) {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => FinishedScreen(jobCode: job.code, workflow: job.workflow),
          ),
        );
        if (!mounted) return;
        Navigator.of(context).pop();
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message.replaceFirst('OFFLINE_QUEUED: ', ''))),
      );
      if (message.startsWith('OFFLINE_QUEUED:')) {
        if (pop) Navigator.pop(context);
        return;
      }
      if (pop) {
        Navigator.pop(context);
      } else {
        await reload();
      }
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
          rejecting = false;
        });
      }
    }
  }

  /// ຮູບ base64 — ບີບໄວ້ (ກວ້າງ ≤1280, ຄຸນນະພາບ 50) ເພາະຮູບເກັບໃນຖານຂໍ້ມູນ
  /// ກຳລັງເປີດກ້ອງ / ອ່ານຮູບຢູ່ບໍ.
  ///
  /// ຮູບ 12MP ອ່ານເປັນ bytes ແລ້ວແປງເປັນ base64 ໃຊ້ເວລາ 1-3 ວິ ຢູ່ເຄື່ອງເກົ່າ ແລະ
  /// ເຮັດຢູ່ isolate ຫຼັກ ⇒ ໜ້າຈໍຍັງກົດໄດ້ ⇒ **ຊ່າງກົດຊ້ຳຕອນຮູບທຳອິດຍັງ load ບໍ່ທັນແລ້ວ**
  /// ⇒ ກ້ອງເປີດຊ້ອນກັນ ຫຼື ໄດ້ຮູບຊ້ຳ 2 ໃບ. ທຸງນີ້ກັ້ນໄວ້ບ່ອນດຽວ (ໃນ `shoot()` ເອງ)
  /// ⇒ ທຸກປຸ່ມທີ່ເອີ້ນມັນຖືກກັນຄືກັນ ບໍ່ຕ້ອງໄປແກ້ແຕ່ລະບ່ອນ.
  bool shooting = false;

  Future<String?> shoot() async {
    if (shooting) return null; // ກົດຊ້ຳລະຫວ່າງກຳລັງດຳເນີນ ⇒ ບໍ່ເປີດກ້ອງອີກ
    if (mounted) setState(() => shooting = true);
    try {
      return await _shoot();
    } finally {
      if (mounted) setState(() => shooting = false);
    }
  }

  Future<String?> _shoot() async {
    XFile? shot;
    try {
      shot = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 50,
        maxWidth: 1280,
      );
    } catch (error) {
      // ບໍ່ມີສິດກ້ອງ (camera_access_denied) ເຄີຍ throw ອອກໄປໂດຍບໍ່ມີໃຜຈັບ
      // ⇒ ຊ່າງກົດແລ້ວງຽບ ບໍ່ຮູ້ວ່າຕ້ອງໄປເປີດສິດ (ແກ້ 06-08-2026).
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('ເປີດກ້ອງບໍ່ໄດ້ — ກະລຸນາອະນຸຍາດສິດກ້ອງໃຫ້ແອັບ ແລ້ວລອງໃໝ່'),
          ),
        );
      }
      return null;
    }
    if (shot == null) return null;
    final bytes = await shot.readAsBytes();
    return 'data:image/jpeg;base64,${base64Encode(bytes)}';
  }

  /// ພິກັດ — ບໍ່ມີສິດ = check-in ບໍ່ໄດ້ (ຫຼັກຖານຂາດ ບໍ່ມີຄວາມໝາຍ)
  Future<Position?> coordinates() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('check-in ຕ້ອງໃຊ້ພິກັດ — ເປັນຫຼັກຖານວ່າໄປຮອດໜ້າງານ'),
          ),
        );
      }
      return null;
    }
    /*
      ── ບອກເຫດຜົນທຸກທາງທີ່ລົ້ມ (ແກ້ 06-08-2026) ──
      ແຕ່ກ່ອນ `getCurrentPosition()` ບໍ່ຖືກຫຸ້ມ ແລະ ບໍ່ໄດ້ກວດວ່າ GPS ເປີດບໍ ⇒ ເຄື່ອງທີ່ປິດ
      ບໍລິການທີ່ຕັ້ງ ຫຼື ຈັບສັນຍານບໍ່ໄດ້ ຈະ throw ອອກໄປງຽບໆ ⇒ ຊ່າງກົດແລ້ວ "ບໍ່ມີຫຍັງເກີດຂຶ້ນ"
      ແລ້ວແຈ້ງວ່າ "ປຸ່ມກົດບໍ່ໄດ້" ທັງທີ່ບັນຫາຢູ່ເຄື່ອງ.
    */
    if (!await Geolocator.isLocationServiceEnabled()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('GPS ປິດຢູ່ — ກະລຸນາເປີດບໍລິການທີ່ຕັ້ງ ແລ້ວກົດ check-in ຄືນ'),
          ),
        );
      }
      return null;
    }
    try {
      return await Geolocator.getCurrentPosition();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('ຈັບພິກັດບໍ່ໄດ້ — ອອກໄປບ່ອນໂລ່ງແລ້ວລອງໃໝ່ ($error)')),
        );
      }
      return null;
    }
  }

  /// ຮູບ check-in ທີ່ຖ່າຍໄວ້ແຕ່ command ລົ້ມ (offline/500) — ເກັບໄວ້ retry ໂດຍ **ບໍ່ຖ່າຍໃໝ່**
  String? _retainedCheckinPhoto;

  Future<void> checkIn() async {
    // ກົດຊ້ຳຕອນຮູບໃບກ່ອນຍັງ load ຢູ່ ⇒ ອອກງຽບໆ (ຢ່າໄປຟ້ອງ "ຕ້ອງຖ່າຍຮູບກ່ອນ"
    // ຊຶ່ງເປັນຄຳຕອບຂອງການ**ຍົກເລີກ**ກ້ອງ ບໍ່ແມ່ນຂອງການກົດຊ້ຳ)
    if (busy || shooting) return;
    final point = await coordinates();
    if (point == null) return;
    // ມີຮູບຄ້າງຈາກຄັ້ງກ່ອນ (command ລົ້ມ) ⇒ ໃຊ້ຄືນ, ບໍ່ໃຫ້ຊ່າງຖ່າຍໜ້າງານໃໝ່
    final photo = _retainedCheckinPhoto ?? await shoot();
    if (photo == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ຕ້ອງຖ່າຍຮູບໜ້າງານກ່ອນ check-in')),
        );
      }
      return;
    }

    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => busy = true);
    try {
      final message = await Api.command(job.workflow, job.code, {
        'action': 'checkin',
        'lat': point.latitude,
        'lng': point.longitude,
        'photo': photo,
      });
      _retainedCheckinPhoto = null; // ສຳເລັດ ⇒ ຖິ້ມຮູບຄ້າງ
      _saveDraft();
      messenger.showSnackBar(SnackBar(content: Text(message)));
    } on ApiError catch (failure) {
      _retainedCheckinPhoto =
          photo; // ເກັບຮູບໄວ້ ⇒ ກົດ check-in ຄືນ ບໍ່ຕ້ອງຖ່າຍໃໝ່
      _saveDraft(); // ລົງໄຟລ໌ນຳ — ອອກຈາກໜ້າຈໍ/ແອັບຖືກຂ້າ ຮູບກໍ່ຍັງຢູ່
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            '${failure.message} — ຮູບຍັງເກັບໄວ້, ກົດ check-in ຄືນໄດ້ເລີຍ',
          ),
          backgroundColor: danger,
        ),
      );
      if (mounted) setState(() => busy = false);
      return;
    }

    // ── ກົດ check-in ແລ້ວ → ເລີ່ມກວດເຊັກທັນທີ ──
    // ສະເພາະງານສ້ອມທີ່ຍັງລໍຖ້າກວດ (ຂັ້ນ 1): ໝາຍ time_check ແລ້ວເປີດໜ້າກວດເຊັກເລີຍ.
    // ງານຕິດຕັ້ງ (ບໍ່ມີຂັ້ນກວດ) = check-in ໝາຍໄປຮອດໜ້າງານເສີຍໆ.
    if (job.workflow == 'repair' && job.stage == 1) {
      try {
        await Api.check(job.code, {'action': 'start'});
      } on ApiError catch (failure) {
        // ເລີ່ມກວດບໍ່ໄດ້ ⇒ check-in ສຳເລັດແລ້ວ, reload ໃຫ້ເຫັນປຸ່ມ "ເລີ່ມກວດເຊັກ"
        messenger.showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
        if (mounted) {
          setState(() => busy = false);
          await reload();
        }
        return;
      }
      if (mounted) setState(() => busy = false);
      await _openCheck();
      return;
    }

    if (mounted) {
      setState(() => busy = false);
      await reload();
    }
  }

  /// ເປີດໜ້າກວດເຊັກ ແລ້ວຈັດການ **ຜົນຕັດສິນ** ທີ່ຊ່າງເລືອກ (CheckOutcome ທີ່ pop ຄືນ):
  ///   repair  → ເລີ່ມສ້ອມເລີຍ (ໃນປະກັນ) · bringIn → ເປີດ dialog ນຳເຂົ້າສູນ · ອື່ນ → reload
  Future<void> _openCheck() async {
    final result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CheckScreen(
          code: job.code,
          serviceType: job.serviceType,
          outOfWarranty: job.warranty == 'ໝົດຮັບປະກັນ',
        ),
      ),
    );
    if (!mounted) return;
    if (result == CheckOutcome.repair) {
      // ຊ່າງເລືອກ "ເລີ່ມສ້ອມເລີຍ" ⇒ ພະຍາຍາມ start (ໃນປະກັນ). ນອກປະກັນ/ຕ້ອງລາຄາ ⇒
      // start ຕົກຂັ້ນ ⇒ catch ໄວ້ ບໍ່ toast ແດງ. (checkOnly ຄືນ null ⇒ ບໍ່ start.)
      final messenger = ScaffoldMessenger.of(context);
      try {
        final message = await Api.command(job.workflow, job.code, {
          'action': 'start',
        });
        messenger.showSnackBar(SnackBar(content: Text(message)));
      } on ApiError catch (_) {
        // ນອກປະກັນ/ຕ້ອງອາໄຫຼ່ — ບໍ່ແມ່ນ error, ໄປຕໍ່ຕາມຂັ້ນ
      }
      if (mounted) await reload();
    } else if (result == CheckOutcome.bringIn) {
      await bringIn();
    } else {
      await reload();
    }
  }

  // checkout ອັດຕະໂນມັດຕອນຈົບງານ (job-flow) — ບໍ່ມີປຸ່ມ checkout ເອງອີກຕໍ່ໄປ.

  /// ຖອຍຫຼັງ 1 ຂັ້ນ — ຢືนยัน ແລ້ວຍິງ action 'undo' (server ຍົກເລີກ action ຫຼ້າສຸດ)
  Future<void> _undo() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('ຖອຍຫຼັງ 1 ຂັ້ນ?'),
        content: Text('ຈະຍົກເລີກຂັ້ນຫຼ້າສຸດ ໃຫ້ວຽກກັບໄປ "${job.undoTo}".'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('ຍົກເລີກ'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('ຖອຍຄືນ'),
          ),
        ],
      ),
    );
    if (ok == true) await run({'action': 'undo'});
  }

  /// IH ສ້ອມໜ້າງານບໍ່ໄດ້ ⇒ ນຳເຄື່ອງເຂົ້າສູນ (ແປງເປັນ PS). ຕ້ອງໃສ່ເຫດຜົນ +
  /// ເລືອກວິທີເອົາເຂົ້າ: **ເອົາກັບພ້ອມ** (ຊ່າງຫອບກັບເອງ) ຫຼື **ຂົນສົ່ງມາຮັບ** (ໃຫ້ຂົນສົ່ງໄປຮັບ).
  Future<void> bringIn() async {
    reason.clear();
    // ຄືນຄ່າ mode ທີ່ຊ່າງກົດ ('carry' | 'pickup') ຫຼື null ຖ້າຍົກເລີກ.
    final mode = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('ສ້ອມໜ້າງານບໍ່ໄດ້ — ນຳເຂົ້າສູນ'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'ໃສ່ເຫດຜົນທີ່ສ້ອມໜ້າງານບໍ່ໄດ້ ໃຫ້ຊ່າງສູນ/CS ເຫັນ ແລ້ວເລືອກວິທີເອົາເຄື່ອງເຂົ້າສູນ:',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: reason,
              maxLines: 2,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'ຕ້ອງໃຊ້ເຄື່ອງມືສູນ, ອາການໜັກ, ຕ້ອງກວດເລິກ...',
              ),
            ),
          ],
        ),
        actionsOverflowDirection: VerticalDirection.down,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, null),
            child: const Text('ຍົກເລີກ'),
          ),
          // ໃຫ້ຂົນສົ່ງໄປຮັບ — ເຄື່ອງຍັງຢູ່ບ້ານລູກຄ້າ, ເຂົ້າຄິວ "ລໍໄປຮັບເຄື່ອງ"
          OutlinedButton.icon(
            onPressed: () => Navigator.pop(dialogContext, 'pickup'),
            icon: const Icon(Icons.local_shipping_outlined, size: 18),
            label: const Text('ຂົນສົ່ງມາຮັບ'),
          ),
          // ຊ່າງເອົາກັບພ້ອມ — ຫອບເຄື່ອງເຂົ້າສູນເອງ, ຂ້າມຄິວໄປຮັບ
          FilledButton.icon(
            onPressed: () => Navigator.pop(dialogContext, 'carry'),
            icon: const Icon(Icons.directions_car_outlined, size: 18),
            label: const Text('ເອົາກັບພ້ອມ'),
          ),
        ],
      ),
    );
    if (mode == null) return;
    if (reason.text.trim().isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('ຕ້ອງໃສ່ເຫດຜົນກ່ອນ')));
      }
      return;
    }
    await run({
      'action': 'bring-in',
      'mode': mode,
      'reason': reason.text.trim(),
    });
  }

  Future<void> openMap() async {
    final destination = job.lat != null && job.lng != null
        ? '${job.lat},${job.lng}'
        : (job.address ?? '').trim();
    if (destination.isEmpty) return;
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'destination': destination,
    });
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('ບໍ່ສາມາດເປີດແຜນທີ່ໄດ້')));
    }
  }

  /// ນຳທາງໄປ **ຈຸດທີ່ຂົນສົ່ງເອົາເຄື່ອງໄປວາງ** — ບໍ່ແມ່ນທີ່ຢູ່ໃນໃບງານ
  /// (ທີ່ຢູ່ພິມມືມັກບໍ່ຊັດ ແຕ່ຈຸດສົ່ງແມ່ນພິກັດຈິງທີ່ຄົນສົ່ງໄປຮອດ).
  Future<void> openDeliveryMap() async {
    final info = delivery;
    if (info == null || !info.hasGeo) return;
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'destination': '${info.lat},${info.lng}',
    });
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('ບໍ່ສາມາດເປີດແຜນທີ່ໄດ້')));
    }
  }

  /// ໂທຫາ **ຄົນທີ່ຮັບເຄື່ອງຈິງ** — ບາງເທື່ອບໍ່ແມ່ນຄົນໃນໃບງານ
  Future<void> callReceiver() async {
    final phone = (delivery?.telephone ?? '').replaceAll(
      RegExp(r'[^0-9+]'),
      '',
    );
    if (phone.isEmpty) return;
    final opened = await launchUrl(Uri(scheme: 'tel', path: phone));
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ອຸປະກອນນີ້ບໍ່ສາມາດໂທອອກໄດ້')),
      );
    }
  }

  /// ດຶງຮູບຕອນສົ່ງ — ກົດເທື່ອດຽວ ແລ້ວເກັບໄວ້ (ຮູບໜັກ ຢູ່ໜ້າງານເນັດຊ້າ)
  Future<void> loadDeliveryPhotos() async {
    final info = delivery;
    if (info == null || loadingDeliveryPhotos) return;
    setState(() => loadingDeliveryPhotos = true);
    try {
      final list = await Api.deliveryPhotos(info.billNo);
      if (mounted) setState(() => deliveryPhotos = list);
    } catch (_) {
      if (mounted) setState(() => deliveryPhotos = const []);
    } finally {
      if (mounted) setState(() => loadingDeliveryPhotos = false);
    }
  }

  Future<void> callCustomer() async {
    final phone = (job.tel ?? '').replaceAll(RegExp(r'[^0-9+]'), '');
    if (phone.isEmpty) return;
    final opened = await launchUrl(Uri(scheme: 'tel', path: phone));
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ອຸປະກອນນີ້ບໍ່ສາມາດໂທອອກໄດ້')),
      );
    }
  }

  /// ເບີສາກົນ (ບໍ່ມີ +) ສຳລັບ wa.me — ລາວ = 856. ຕັດ 0 ນຳ · ຖ້າມີ 856 ແລ້ວຄົງໄວ້
  String _waNumber(String tel) {
    var n = tel.replaceAll(RegExp(r'[^0-9]'), '');
    if (n.startsWith('856')) return n;
    if (n.startsWith('0')) n = n.substring(1);
    return '856$n';
  }

  Future<void> whatsapp() async {
    final tel = (job.tel ?? '').trim();
    if (tel.isEmpty) return;
    final uri = Uri.parse('https://wa.me/${_waNumber(tel)}');
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('ເປີດ WhatsApp ບໍ່ໄດ້')));
    }
  }

  /// ປຸ່ມຕິດຕໍ່ຫຍໍ້ (ໄອຄອນເທິງ · ຄຳລຸ່ມ) — ໃຊ້ໃນແຖວ 3 ຖັນ
  Widget _contactBtn(
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) => OutlinedButton(
    onPressed: onTap,
    style: OutlinedButton.styleFrom(
      foregroundColor: color,
      backgroundColor: color.withValues(alpha: .07),
      minimumSize: const Size.fromHeight(62),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      side: BorderSide(color: color.withValues(alpha: .18)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 20, color: color),
        const SizedBox(height: 3),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );

  /// ໜ້າສົນທະນາແບບ chat — ຂໍ້ຄວາມເລື່ອນໄດ້ ແລະ composer ຢູ່ລຸ່ມສະເໝີ.
  Widget _chatterView() => Column(
    children: [
      Container(
        margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: line),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: tealTint,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.forum_outlined, size: 19, color: teal),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ສົນທະນາກັບທີມງານ',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: ink,
                      fontSize: 13.5,
                    ),
                  ),
                  Text(
                    '${chatter?.messages.length ?? 0} ຂໍ້ຄວາມ',
                    style: const TextStyle(color: muted, fontSize: 11),
                  ),
                ],
              ),
            ),
            IconButton.filledTonal(
              tooltip: 'ນັດກິດຈະກຳ',
              onPressed: scheduleActivity,
              style: IconButton.styleFrom(
                backgroundColor: tealTint,
                foregroundColor: teal,
              ),
              icon: const Icon(Icons.event_available_outlined, size: 20),
            ),
          ],
        ),
      ),
      Expanded(
        child: chatterError.isNotEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.cloud_off_rounded,
                        size: 40,
                        color: faint,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        chatterError,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: muted),
                      ),
                      TextButton(
                        onPressed: loadChatter,
                        child: const Text('ລອງໃໝ່'),
                      ),
                    ],
                  ),
                ),
              )
            : chatter == null
            ? const Center(child: CircularProgressIndicator())
            : chatter!.messages.isEmpty
            ? const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.chat_bubble_outline_rounded,
                      size: 46,
                      color: faint,
                    ),
                    SizedBox(height: 12),
                    Text(
                      'ເລີ່ມການສົນທະນາ',
                      style: TextStyle(fontWeight: FontWeight.w800, color: ink),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'ສົ່ງຂໍ້ຄວາມຫາ CS ຫຼື ຫົວໜ້າ',
                      style: TextStyle(color: muted, fontSize: 12),
                    ),
                  ],
                ),
              )
            : ListView.builder(
                reverse: true,
                padding: const EdgeInsets.fromLTRB(14, 16, 14, 12),
                itemCount: chatter!.messages.take(30).length,
                itemBuilder: (_, index) {
                  final messages = chatter!.messages.take(30).toList();
                  return _MessageRow(
                    message: messages[messages.length - 1 - index],
                  );
                },
              ),
      ),
      SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          decoration: const BoxDecoration(
            color: surface,
            border: Border(top: BorderSide(color: line)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: chatInput,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => sendMessage(),
                  decoration: InputDecoration(
                    hintText: 'ພິມຂໍ້ຄວາມ...',
                    hintStyle: const TextStyle(fontSize: 13, color: faint),
                    filled: true,
                    fillColor: surfaceAlt,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 13,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: sending ? null : sendMessage,
                style: IconButton.styleFrom(
                  backgroundColor: teal,
                  foregroundColor: onAccent,
                  minimumSize: const Size(48, 48),
                ),
                icon: sending
                    ? const SizedBox(
                        width: 17,
                        height: 17,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: onAccent,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 20),
              ),
            ],
          ),
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    // ບຳລຸງຮັກສາບໍ່ໄດ້ເກັບຮູບຜົນງານ (server ບໍ່ຮັບ) ⇒ ຢ່າບັງຄັບ ບໍ່ດັ່ງນັ້ນຊ່າງກົດຈົບບໍ່ໄດ້
    final evidenceRequired =
        job.workflow != 'maintenance' &&
        (job.workflow == 'install' || job.onsite) &&
        photos.isEmpty;

    return Scaffold(
      backgroundColor: ground,
      // v5: ປຸ່ມທີ່ຕ້ອງກົດ ຢູ່ໃນໄລຍະນິ້ວໂປ້ສະເໝີ (ນິຍາມຢູ່ `_nextAction`)
      bottomNavigationBar: _nextActionBar(),
      body: DefaultTabController(
        length: 2,
        child: Column(
          children: [
            HeroHeader(
              inlineBack: true,
              title:
                  '${job.workflow == 'install'
                      ? 'ຕິດຕັ້ງ'
                      : job.workflow == 'maintenance'
                      ? 'ລ້າງແອ'
                      : 'ສ້ອມແປງ'} · ${job.code}',
              onBack: () => Navigator.pop(context),
            ),
            Container(
              color: surface,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: TabBar(
                dividerColor: Colors.transparent,
                labelColor: ink,
                unselectedLabelColor: muted,
                indicator: BoxDecoration(
                  color: tealTint,
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: teal.withValues(alpha: .18)),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                labelStyle: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
                tabs: const [
                  Tab(height: 42, text: 'ລາຍລະອຽດ'),
                  Tab(height: 42, text: 'ການເຄື່ອນໄຫວ'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  ListView(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                    children: [
                      _Card(
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: tealTint,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.build_circle_outlined,
                                  color: teal,
                                  size: 21,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'ສະຖານະປັດຈຸບັນ',
                                      style: TextStyle(
                                        color: muted,
                                        fontSize: 11,
                                      ),
                                    ),
                                    Text(
                                      job.stageLabel,
                                      style: const TextStyle(
                                        color: teal,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // ນາລິກາ 24 ຊມ ນັບແຕ່ອອກບິນ — ຊ່າງຕ້ອງເຫັນອັນດຽວກັບຜູ້ຈັດການ
                              if (job.slaLabel != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: job.slaLate
                                        ? const Color(0xFFFEE2E2)
                                        : job.slaSoon
                                        ? const Color(0xFFFEF3C7)
                                        : const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    job.slaLabel!,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: job.slaLate
                                          ? const Color(0xFFB91C1C)
                                          : job.slaSoon
                                          ? const Color(0xFF92400E)
                                          : const Color(0xFF047857),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(13),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7FAFC),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  job.customer ?? '-',
                                  style: const TextStyle(
                                    color: ink,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(
                                      Icons.inventory_2_outlined,
                                      size: 15,
                                      color: muted,
                                    ),
                                    const SizedBox(width: 7),
                                    Expanded(
                                      child: Text(
                                        job.product ?? '-',
                                        style: const TextStyle(
                                          color: muted,
                                          fontSize: 12.5,
                                          height: 1.35,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          if ((job.detail ?? '').trim().isNotEmpty)
                            _row('ຍີ່ຫໍ້/ລຸ້ນ', job.detail),
                          if ((job.sn ?? '').trim().isNotEmpty)
                            _row('SN', job.sn),
                          if (job.workflow == 'repair' &&
                              (job.serviceType ?? '').isNotEmpty)
                            _row('ປະເພດ', _serviceLabel(job.serviceType)),
                          if ((job.warranty ?? '').trim().isNotEmpty)
                            _row('ຮັບປະກັນ', job.warranty),
                          _row('ບ່ອນຢູ່', job.address),
                          _row('ວັນນັດ', job.appointment),
                          // ຮັບເຄື່ອງເມື່ອໃດ · ໃຊ້ເວລາລວມມາເທົ່າໃດ (ເດີນທຸກວິນາທີ) · ໃຜເປັນຄົນຮັບ
                          _row('ຮັບເຄື່ອງ', job.receivedAt),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(
                                  width: 78,
                                  child: Text(
                                    'ເວລາທີ່ໃຊ້',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: muted,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: LiveElapsed(
                                    seconds: job.totalSeconds,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: ink,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          _row('ຜູ້ຮັບ', job.receiver),
                          // ── ຕິດຕໍ່ · ນຳທາງ — 3 ຖັນ (ນຳທາງ · ໂທ · WhatsApp) ──
                          // ນຳທາງສະເພາະສ້ອມນອກສະຖານທີ່; ໂທ/WhatsApp ສະເພາະມີເບີ
                          if (() {
                            final canMap =
                                job.onsite &&
                                ((job.lat != null && job.lng != null) ||
                                    (job.address ?? '').trim().isNotEmpty);
                            final hasTel = (job.tel ?? '').trim().isNotEmpty;
                            return canMap || hasTel;
                          }()) ...[
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                if (job.onsite &&
                                    ((job.lat != null && job.lng != null) ||
                                        (job.address ?? '')
                                            .trim()
                                            .isNotEmpty)) ...[
                                  Expanded(
                                    child: _contactBtn(
                                      Icons.navigation_outlined,
                                      'ນຳທາງ',
                                      teal,
                                      openMap,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                if ((job.tel ?? '').trim().isNotEmpty) ...[
                                  Expanded(
                                    child: _contactBtn(
                                      Icons.phone,
                                      'ໂທ',
                                      ok,
                                      callCustomer,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: _contactBtn(
                                      Icons.chat,
                                      'WhatsApp',
                                      const Color(0xFF25D366),
                                      whatsapp,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                          /*
                ── ສົ່ງຄືນອາໄຫຼ່ທີ່ບໍ່ໄດ້ໃຊ້ ──
                ເມື່ອກ່ອນເຮັດໄດ້ແຕ່ຢູ່ເວັບ ⇒ ອາໄຫຼ່ຄ້າງຢູ່ນຳຊ່າງໂດຍບໍ່ມີເອກະສານ
                (ງານທີ່ຍົກເລີກແລ້ວມີອາໄຫຼ່ 36 ແຖວ ທີ່ບໍ່ເຄີຍມີໃບສົ່ງຄືນຈັກໃບ).
                ⚠️ ຂຶ້ນສະເພາະເມື່ອ **ມີອາໄຫຼ່ທີ່ເບີກມາແລ້ວ** ຄ້າງນຳຊ່າງ (outstandingSpares > 0).
              */
                          if (outstandingSpares > 0) ...[
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              icon: const Icon(
                                Icons.assignment_return,
                                color: muted,
                              ),
                              label: Text(
                                'ສົ່ງຄືນອາໄຫຼ່ທີ່ບໍ່ໄດ້ໃຊ້ ($outstandingSpares)',
                                style: const TextStyle(color: muted),
                              ),
                              onPressed: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => SpareReturnScreen(
                                      workflow: job.workflow,
                                      code: job.code,
                                    ),
                                  ),
                                );
                                if (mounted) await reload();
                              },
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 12),

                      /*
                        ── ແຖບ "ຮອບນີ້ຄືຮອບທີ N" (12-08-2026) ──
                        ວາງ **ເທິງສຸດ ກ່ອນປຸ່ມໃດໆ** ໂດຍເຈດຕະນາ: ຊ່າງທີ່ໄປຮອບ 3 ອາດເປັນ
                        ຄົນລະຄົນກັບຮອບ 1 ⇒ ຕ້ອງຮູ້ວ່າຮອບກ່ອນຄ້າງຍ້ອນຫຍັງ **ກ່ອນອອກລົດ**
                        ບໍ່ແມ່ນຫຼັງໄປຮອດ. ຂໍ້ຄວາມດຽວກັບແຖບຢູ່ເວັບ (installations/[code]).
                      */
                      if (_roundBanner() != null) ...[
                        _roundBanner()!,
                        const SizedBox(height: 12),
                      ],

                      // ── "ຕອນນີ້ລໍໃຜເຮັດ" (ສ້ອມ) — ຄຳຕອບດຽວກັບເວັບ + ສະຖານະອາໄຫຼ່ ──
                      if (nextActor != null) ...[
                        _nextActorCard(),
                        const SizedBox(height: 12),
                      ],

                      // ── ເຄື່ອງສຳຮອງທີ່ຕ້ອງເອົາຄືນ (ສ້ອມ) — ບອກກ່ອນອອກໜ້າງານ ບໍ່ແມ່ນຕອນປິດງານ ──
                      if (loaners.isNotEmpty) ...[
                        _loanerCard(),
                        const SizedBox(height: 12),
                      ],

                      // ── ການສົ່ງເຄື່ອງ (ຕິດຕັ້ງ) — ຈຸດທີ່ເຄື່ອງຖືກສົ່ງໄປແທ້ + ເບີຄົນຮັບ + ຮູບ ──
                      if (delivery != null) ...[
                        _deliveryCard(),
                        const SizedBox(height: 12),
                      ],

                      // ── ເສັ້ນເວລາ + ຮອບເຂົ້າໜ້າງານ — ຊຸດດຽວກັບເວັບ (server ຄິດໃຫ້) ──
                      if ((timeline?.steps.isNotEmpty ?? false)) ...[
                        _timelineCard(),
                        const SizedBox(height: 12),
                      ],

                      // ── ຜົນກວດເຊັກ (ສະເພາະສ້ອມ · ຂຶ້ນຫຼັງຊ່າງວິເຄາະ) ──
                      if (job.workflow == 'repair' &&
                          (job.diagnosis ?? '').trim().isNotEmpty) ...[
                        _Card(
                          children: [
                            const Row(
                              children: [
                                Icon(
                                  Icons.fact_check_outlined,
                                  size: 18,
                                  color: teal,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'ຜົນກວດເຊັກ',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: ink,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            if ((job.symptom ?? '').trim().isNotEmpty)
                              _row('ອາການແຈ້ງ', job.symptom),
                            _row('ຜົນວິເຄາະ', job.diagnosis),
                            if ((job.warrantyReason ?? '').trim().isNotEmpty)
                              _row('ໝົດປະກັນ', job.warrantyReason),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],

                      // ── ຮູບຂອງງານ (ຮັບເຄື່ອງ · ກວດເຊັກ · ສ້ອມສຳເລັດ) ──
                      if (gallery != null && !gallery!.isEmpty) ...[
                        FoldCard(
                          title: 'ຮູບຂອງງານນີ້',
                          icon: Icons.photo_library_outlined,
                          meta: '${gallery!.receive.length + gallery!.check.length + gallery!.finish.length} ຮູບ',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                            if (gallery!.receive.isNotEmpty)
                              _photoRow(
                                'ຮູບຕອນຮັບເຄື່ອງ',
                                Icons.inventory_2_outlined,
                                gallery!.receive,
                              ),
                            if (gallery!.check.isNotEmpty)
                              _photoRow(
                                'ຮູບຕອນກວດເຊັກ',
                                Icons.fact_check_outlined,
                                gallery!.check,
                              ),
                            if (gallery!.finish.isNotEmpty)
                              _photoRow(
                                job.workflow == 'install'
                                    ? 'ຮູບຕິດຕັ້ງສຳເລັດ'
                                    : 'ຮູບສ້ອມສຳເລັດ',
                                Icons.verified_outlined,
                                gallery!.finish,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // ── ກິດຈະກຳທີ່ນັດໄວ້ (ຍັງບໍ່ເຮັດ) ──
                      if ((chatter?.activities.isNotEmpty ?? false)) ...[
                        _Card(
                          children: [
                            const Row(
                              children: [
                                Icon(
                                  Icons.event_available_outlined,
                                  size: 18,
                                  color: warn,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'ກິດຈະກຳທີ່ຕ້ອງເຮັດ',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: ink,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            for (final activity in chatter!.activities)
                              _ActivityRow(
                                activity: activity,
                                onDone: () => finishActivity(activity),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],

                      /* ── ຂັ້ນຕອນ — ປຸ່ມມາຈາກ server ── */
                      _Card(
                        children: [
                          // ── ຖອຍຫຼັງ 1 ຂັ້ນ (ຍົກເລີກ action ຫຼ້າສຸດ) — server ຄິດປ້າຍ undoTo ໃຫ້ ──
                          if (job.undoTo != null) ...[
                            _ghostAction(
                              'ຖອຍຄືນ: ${job.undoTo}',
                              Icons.undo_rounded,
                              const Color(0xFF64748B),
                              _undo,
                              height: 42,
                            ),
                            const SizedBox(height: 10),
                          ],
                          /*
                ── ລຳດັບຄວາມສຳຄັນ ──
                "ຮັບງານ" = ສິ່ງທີ່ຄວນເຮັດ ⇒ ປຸ່ມຖົມສີເຕັມ ເນັ້ນສຸດ.
                "ປະຕິເສດ" = ທາງເລືອກທີ່ນານໆເຮັດເທື່ອ ⇒ ເສັ້ນຂອບບາງໆ ບໍ່ຖົມສີ
                ບໍ່ດັ່ງນັ້ນສອງປຸ່ມແຍ້ງກັນ ແລະ ກົດຜິດງ່າຍ.
              */
                          /*
                            ── ຊ່າງຮ່ວມ (10-08-2026) ──
                            1 ໃບງານໃສ່ຊ່າງໄດ້ຫຼາຍຄົນ ແຕ່ "ຮັບງານ/ຈົບງານ" ເປັນຂອງ
                            **ຫົວໜ້າຄົນດຽວ** (server ປະຕິເສດຄົນອື່ນຢູ່ແລ້ວ) ⇒ ເຊື່ອງປຸ່ມ
                            ໄປເລີຍ ດີກວ່າໃຫ້ກົດແລ້ວຄາຢູ່ໜ້າງານ ບໍ່ຮູ້ວ່າຜິດຫຍັງ.
                          */
                          if (!job.isLead || job.mates.isNotEmpty) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(11),
                              decoration: BoxDecoration(
                                color: tealTint,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: line),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.groups_2_outlined, size: 17, color: teal),
                                      const SizedBox(width: 8),
                                      Text(
                                        job.isLead
                                            ? 'ທ່ານເປັນຫົວໜ້າງານນີ້'
                                            : 'ທ່ານເປັນຊ່າງຮ່ວມຂອງງານນີ້',
                                        style: const TextStyle(fontWeight: FontWeight.w700, color: ink),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    job.isLead
                                        ? 'ໄປນຳ: ${job.mates.join(" · ")} — ທຸກຄົນ check-in ເອງ '
                                              '(ຄ່າຄອມແບ່ງຕາມຄົນທີ່ check-in ຈິງ)'
                                        : 'check-in/out ແລະ ຖ່າຍຮູບ ໄດ້ຄືກັນ — '
                                              '"ຮັບງານ · ຈົບງານ · ເກັບ ISN/SN" ຫົວໜ້າງານເປັນຄົນເຮັດ'
                                              '${job.mates.isEmpty ? "" : " · ທີມ: ${job.mates.join(" · ")}"}',
                                    style: const TextStyle(color: muted, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),
                          ],

                          if (job.isLead && job.action == 'accept' && !rejecting) ...[
                            Row(
                              children: [
                                const Icon(
                                  Icons.assignment_ind_outlined,
                                  size: 17,
                                  color: teal,
                                ),
                                const SizedBox(width: 7),
                                Expanded(
                                  child: Text(
                                    job.accepted
                                        ? 'ວຽກນີ້ຮັບແລ້ວ'
                                        : 'ວຽກໃໝ່ — ຕ້ອງຮັບງານກ່ອນຈຶ່ງເລີ່ມໄດ້',
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: muted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            // "ຮັບງານ" ຍ້າຍໄປແຖບລຸ່ມ (v5) ⇒ ຢູ່ນີ້ເຫຼືອແຕ່ທາງເລືອກ
                            // ທີ່ **ບໍ່ຄວນກົດງ່າຍ**: ປະຕິເສດງານ.
                            _ghostAction(
                              'ປະຕິເສດງານນີ້',
                              Icons.close_rounded,
                              danger,
                              () => setState(() => rejecting = true),
                              height: 46,
                            ),
                          ],

                          if (rejecting) ...[
                            const Text(
                              'ເຫດຜົນທີ່ປະຕິເສດ (CS ຈະເຫັນ)',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: reason,
                              maxLines: 2,
                              decoration: const InputDecoration(
                                border: OutlineInputBorder(),
                                hintText:
                                    'ຕິດງານອື່ນ, ຢູ່ໄກ, ບໍ່ຖະນັດງານນີ້...',
                              ),
                            ),
                            const SizedBox(height: 10),
                            // ຢູ່ຂັ້ນນີ້ "ຢືນຢັນປະຕິເສດ" ກາຍເປັນປຸ່ມຫຼັກ ⇒ ຖົມສີແດງ · "ຍົກເລີກ" ຖອຍລົງເປັນຮອງ
                            _primaryAction(
                              'ຢືນຢັນການປະຕິເສດ',
                              Icons.block_rounded,
                              danger,
                              () => run({
                                'action': 'reject',
                                'reason': reason.text,
                              }, pop: true),
                            ),
                            const SizedBox(height: 10),
                            _ghostAction(
                              'ຍົກເລີກ',
                              Icons.arrow_back_rounded,
                              muted,
                              () => setState(() => rejecting = false),
                            ),
                          ],

                          // ── ໜ້າງານ (IH/PS): ຮັບງານແລ້ວ ⇒ ປຸ່ມ check-in ດຽວ ──
                          // ກົດ check-in ແລ້ວ **ເລີ່ມກວດເຊັກເອງ** ⇒ ບໍ່ຕ້ອງໂຊ້ປຸ່ມ "ເລີ່ມກວດ" ຊ້ຳ
                          // (ແຕ່ກ່ອນມີ 2 ປຸ່ມ: check-in + "ຕ້ອງ check-in ກ່ອນ" ຈາງໆ ⇒ ຊ້ຳຊ້ອນ).

                          /*
                            ── ຕິດຕັ້ງ: ປຸ່ມ check-in ຂອງຕົນເອງ (ແກ້ 06-08-2026) ──
                            ເມື່ອກ່ອນເງື່ອນໄຂຂ້າງເທິງບັງຄັບ `workflow == 'repair'` ⇒ **ງານຕິດຕັ້ງ
                            ບໍ່ມີປຸ່ມ check-in ເລີຍ** ໃນຂະນະທີ່ປຸ່ມ "ເລີ່ມຕິດຕັ້ງ" ຂ້າງລຸ່ມ
                            ຖືກ disable ຕາບໃດຍັງບໍ່ check-in (ຕິດຕັ້ງ onsite=true ສະເໝີ)
                            ⇒ ຊ່າງເຫັນແຕ່ປຸ່ມສີເທົາ "ຕ້ອງ check-in ກ່ອນເລີ່ມງານ" ແລ້ວຕັນ.

                            ເຊື່ອ `canCheckIn` ຂອງ server ບ່ອນດຽວ — ຢ່າຂຽນເງື່ອນໄຂຂັ້ນຊ້ຳຢູ່ນີ້
                            (ຮອບເຂົ້າໜ້າງານຮອບ 2 ຢູ່ຂັ້ນ 5 ກໍ່ຜ່ານ flag ດຽວກັນ ໂດຍບໍ່ຕ້ອງແກ້ແອັບອີກ).
                          */

                          // ງານສ້ອມຂັ້ນ 1-2 = ກວດເຊັກ (ບໍ່ແມ່ນ "ເລີ່ມສ້ອມ" ຂອງຂັ້ນ 8).
                          // ໜ້າງານທີ່ຍັງບໍ່ check-in ໃຊ້ປຸ່ມ check-in ດ້ານເທິງແທນ.

                          /*
                            ── ຝັ່ງຕິດຕັ້ງ: check-in = ເລີ່ມຕິດຕັ້ງ (07-08-2026) ──
                            ⇒ ບໍ່ຕ້ອງໂຊ້ປຸ່ມ "ເລີ່ມຕິດຕັ້ງ" ຄຽງກັບປຸ່ມ check-in ອີກ
                            (ເມື່ອກ່ອນເປັນປຸ່ມສີເທົາ "ຕ້ອງ check-in ກ່ອນເລີ່ມງານ" ⇒ ຄົນສັບສົນ).
                            ຝັ່ງສ້ອມຄືເກົ່າ · ຕິດຕັ້ງທີ່ຖືກ CS ເລີ່ມໃຫ້ຈາກເວັບ ກໍ່ຂ້າມມາຂັ້ນ 5 ຢູ່ແລ້ວ.
                          */

                          // "ສ້ອມໜ້າງານບໍ່ໄດ້ → ນຳເຂົ້າສູນ" = **ຕັດສິນຕອນກວດເຊັກ** (CheckScreen outcome)
                          // ບ່ອນດຽວ. ຫຼັງກວດເຊັກແລ້ວ (ເລືອກ ສ້ອມ/ສຳເລັດການກວດ) = ຕົກລົງສ້ອມແລ້ວ ⇒ ບໍ່ໂຊ້ຢູ່ນີ້.

                          /*
                            ── ຂໍເບີກ / ປ່ຽນ ອາໄຫຼ່ ──
                            ສ້ອມ  : **ຂັ້ນ 5-9** (ຫຼັງກວດເຊັກ ຈົນກ່ອນຈົບສ້ອມ)
                              ແຕ່ກ່ອນເປີດສະເພາະຂັ້ນ 9 ⇒ ຊ່າງທີ່ "ກຳລັງເບີກອາໄຫຼ່" (ຂັ້ນ 6) ຫຼື
                              "ລໍຖ້າສ້ອມ" (ຂັ້ນ 8) ຂໍເບີກ**ເພີ່ມ**ບໍ່ໄດ້ ທັງທີ່ນັ້ນຄືຈັງຫວະທີ່ພົບຫຼາຍສຸດ
                              (399 ໃບງານຂໍເບີກຫຼາຍກວ່າ 1 ຮອບ).
                            ຕິດຕັ້ງ: **ຂັ້ນ 2-4** (ຮັບງານແລ້ວ ຈົນກ່ອນເລີ່ມຕິດຕັ້ງ) — 13-08-2026.
                              ຂັ້ນ 1 = ຍັງບໍ່ທັນຮັບງານ (tech_confirm ຫວ່າງ) ⇒ server ປະຕິເສດ
                              ຢູ່ແລ້ວ ("ຕ້ອງຮັບງານກ່ອນເພີ່ມອາໄຫຼ່") ຈຶ່ງບໍ່ໂຊ້ວປຸ່ມໃຫ້ກົດລ້າໆ.
                              ງານທີ່ບໍ່ໃຊ້ອາໄຫຼ່ຂ້າມ 2-3 ໄປຢູ່ຂັ້ນ 4 ⇒ ຕ້ອງລວມ 4 ນຳ
                              ບໍ່ດັ່ງນັ້ນຊ່າງທີ່ພົບວ່າຕ້ອງໃຊ້ອາໄຫຼ່ຕອນຮອດໜ້າງານກໍ່ຕັນອີກ.

                            ⚠️ **ບັກທີ່ແກ້**: ເງື່ອນໄຂນີ້ເຄີຍເປັນ `workflow == 'repair'` ຢ່າງດຽວ
                            ⇒ ຝັ່ງຕິດຕັ້ງ **ບໍ່ເຫັນປຸ່ມເຂົ້າໄປເລືອກລາຍການອາໄຫຼ່ຈັກເທື່ອ** ເຫັນແຕ່
                            "ອອກໃບຂໍເບີກອາໄຫຼ່" ທີ່ຂໍທັງກະຕ່າ (ກະຕ່າຖືກຕື່ມຕອນເປີດງານເທົ່ານັ້ນ)
                            ⇒ ຢາກປ່ຽນຂອງແທນກັນ ຫຼື ງານທີ່ບໍ່ມີຊຸດ ຕ້ອງກັບໄປໃຊ້ເວັບ.
                            ດ່ານຈິງຢູ່ server (lib/repair-spare · lib/install-spare).
                          */
                          if ((job.workflow == 'repair' &&
                                  job.stage >= 5 &&
                                  job.stage <= 9) ||
                              (job.workflow == 'install' &&
                                  job.stage >= 2 &&
                                  job.stage <= 4)) ...[
                            _ghostAction(
                              job.workflow == 'install'
                                  ? 'ເລືອກ / ແກ້ ລາຍການອາໄຫຼ່'
                                  : 'ຂໍເບີກ / ປ່ຽນ ອາໄຫຼ່',
                              Icons.inventory_2_outlined,
                              const Color(0xFF7C3AED),
                              () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => JobSpareScreen(
                                      code: job.code,
                                      workflow: job.workflow,
                                    ),
                                  ),
                                );
                                if (mounted) await reload();
                              },
                            ),
                            const SizedBox(height: 14),
                          ],

                          /*
                ── ຈົບງານ: ຈັດເປັນ "ໃບງານ" ມີລຳດັບຂັ້ນ ──
                ແຕ່ກ່ອນເປັນປຸ່ມເຂັ້ມ 3 ປຸ່ມຊ້ອນກັນ ບໍ່ຮູ້ວ່າອັນໃດເປັນອັນຫຼັກ ແລະ ສີບໍ່ເຂົ້າກັບແບຣນ.
                ດຽວນີ້: ເລກຂັ້ນ ①② ນຳທາງ · ເສັ້ນປະແບ່ງ · ປຸ່ມຫຼັກອັນດຽວຢູ່ທ້າຍ.
              */
                          if (job.action == 'finish') ...[
                            Row(
                              children: [
                                const Icon(
                                  Icons.assignment_turned_in_outlined,
                                  size: 18,
                                  color: ok,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  job.workflow == 'install'
                                      ? 'ຈົບງານຕິດຕັ້ງ'
                                      : 'ຈົບງານສ້ອມ',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: ink,
                                    fontSize: 14.5,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            if (job.workflow == 'repair') ...[
                              const _StepLabel(
                                step: '1',
                                text: 'ບັນທຶກວິທີແກ້ໄຂ',
                              ),
                              const SizedBox(height: 7),
                              TextField(
                                controller: note,
                                maxLines: 3,
                                decoration: InputDecoration(
                                  isDense: true,
                                  hintText: 'ປ່ຽນອາໄຫຼ່ຫຍັງ · ແກ້ແນວໃດ...',
                                  hintStyle: const TextStyle(
                                    fontSize: 12.5,
                                    color: faint,
                                  ),
                                  filled: true,
                                  fillColor: surfaceAlt,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide.none,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              const _JobDashed(),
                              const SizedBox(height: 14),
                            ],

                            _StepLabel(
                              step: job.workflow == 'repair' ? '2' : '1',
                              text: 'ຮູບຜົນງານ',
                              hint: photos.isNotEmpty
                                  ? '${photos.length} ຮູບ'
                                  : (job.workflow == 'install' || job.onsite)
                                  ? 'ບັງຄັບຢ່າງໜ້ອຍ 1 ຮູບ'
                                  : 'ບໍ່ບັງຄັບ',
                              hintColor: evidenceRequired ? danger : faint,
                            ),
                            const SizedBox(height: 9),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (var i = 0; i < photos.length; i++)
                                  Stack(
                                    children: [
                                      GestureDetector(
                                        onTap: () => showDialog<void>(
                                          context: context,
                                          builder: (_) => Dialog(
                                            child: Stack(
                                              children: [
                                                InteractiveViewer(
                                                  child: Image.memory(
                                                    base64Decode(
                                                      photos[i].split(',').last,
                                                    ),
                                                    // ຈຳກັດ 1800px — ພໍສຳລັບ zoom ເຕັມຈໍ
                                                    // ແຕ່ບໍ່ decode ຮູບ 12MP ເຕັມ (ເຄື່ອງເກົ່າ RAM ໜ້ອຍ)
                                                    cacheWidth: 1800,
                                                  ),
                                                ),
                                                Positioned(
                                                  right: 4,
                                                  top: 4,
                                                  child: IconButton.filled(
                                                    tooltip: 'ປິດ',
                                                    onPressed: () =>
                                                        Navigator.pop(context),
                                                    icon: const Icon(
                                                      Icons.close,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          // cacheWidth — ຮູບກ້ອງໃໝ່ 12MP ຖອດລະຫັດເຕັມ
                                          // ຈະກິນ RAM ເຄື່ອງເກົ່າ (ເບິ່ງ _photoRow)
                                          child: Image.memory(
                                            base64Decode(
                                              photos[i].split(',').last,
                                            ),
                                            width: 78,
                                            height: 78,
                                            fit: BoxFit.cover,
                                            cacheWidth: (78 * MediaQuery.of(context).devicePixelRatio).round(),
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        right: -6,
                                        top: -6,
                                        child: IconButton(
                                          icon: const Icon(
                                            Icons.cancel,
                                            size: 20,
                                            color: danger,
                                          ),
                                          onPressed: busy
                                              ? null
                                              : () {
                                                  setState(
                                                    () => photos.removeAt(i),
                                                  );
                                                  _saveDraft();
                                                },
                                        ),
                                      ),
                                    ],
                                  ),
                                InkWell(
                                  // ກຳລັງອ່ານຮູບໃບກ່ອນຢູ່ ⇒ ກົດບໍ່ໄດ້ (ກັນໄດ້ຮູບຊ້ຳ)
                                  onTap: busy || shooting
                                      ? null
                                      : () async {
                                          final photo = await shoot();
                                          if (photo != null) {
                                            setState(() => photos.add(photo));
                                            _saveDraft();
                                          }
                                        },
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    width: 78,
                                    height: 78,
                                    decoration: BoxDecoration(
                                      color: tealTint,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: line),
                                    ),
                                    // ບອກໃຫ້ຮູ້ວ່າ**ກຳລັງດຳເນີນຢູ່** ບໍ່ແມ່ນກົດບໍ່ຕິດ
                                    child: shooting
                                        ? const Center(
                                            child: SizedBox(
                                              width: 20,
                                              height: 20,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: teal,
                                              ),
                                            ),
                                          )
                                        : const Icon(
                                            Icons.add_a_photo_outlined,
                                            color: teal,
                                          ),
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(height: 14),
                            const _JobDashed(),
                            const SizedBox(height: 14),

                            if (evidenceRequired)
                              const Padding(
                                padding: EdgeInsets.only(bottom: 8),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.error_outline,
                                      size: 15,
                                      color: faint,
                                    ),
                                    SizedBox(width: 6),
                                    Text(
                                      'ຕ້ອງແນບຮູບຜົນງານກ່ອນຈຶ່ງບັນທຶກໄດ້',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: faint,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            // ເກັບ ISN/SN = ຫົວໜ້າຄົນດຽວ (10-08-2026) — ເລກຜູກກັບການຮັບປະກັນ
                            if (job.workflow == 'install' && job.isLead) ...[
                              _serialCollector(),
                              const SizedBox(height: 10),
                            ],

                            // ຈົບງານ = ຫົວໜ້າຄົນດຽວ — ປຸ່ມຢູ່ແຖບລຸ່ມ (v5).
                            // ຊ່າງຮ່ວມບໍ່ມີແຖບນັ້ນ ⇒ ຕ້ອງບອກວ່າຮູບທີ່ຖ່າຍໄປແລ້ວບໍ່ໄດ້ເສຍເປົ່າ.
                            if (!job.isLead)
                              const Text(
                                'ຮູບທີ່ທ່ານຖ່າຍ ຖືກແນບໃສ່ໃບງານແລ້ວ — '
                                'ປຸ່ມ "ບັນທຶກສຳເລັດ" ແລະ ການເກັບ ISN/SN ຢູ່ນຳຫົວໜ້າງານ',
                                style: TextStyle(color: muted, fontSize: 12),
                              ),
                            if (job.workflow == 'install' && !job.scanDone) ...[
                              const SizedBox(height: 6),
                              Text(
                                'ຕ້ອງເກັບ ISN/SN ${_missingUnit()} ກ່ອນ ຈຶ່ງກົດສຳເລັດໄດ້',
                                style: const TextStyle(color: muted, fontSize: 11.5),
                              ),
                            ],

                            /*
                              ── 1 ໃບງານ = ຫຼາຍຮອບເຂົ້າໜ້າງານ (06-08-2026) ──
                              ຕິດຕັ້ງບໍ່ຈົບໃນມື້ດຽວ (ລໍງານໄຟຟ້າ · ຝົນຕົກ · ຂາດອາໄຫຼ່) ເປັນເລື່ອງປົກກະຕິ
                              — ວັດແລ້ວ 65 ໃບ/ປີ ຈົບຄົນລະວັນກັບວັນເລີ່ມ. ແຕ່ກ່ອນຊ່າງມີແຕ່ 2 ທາງ:
                              ກົດ "ຈົບງານ" ຫຼອກ (QC ແລະ ການປະເມີນຂອງລູກຄ້າແລ່ນຜິດ) ຫຼື ປະໄວ້ງຽບໆ.
                              ປຸ່ມນີ້ປິດຮອບປັດຈຸບັນ + ໃສ່ວັນນັດ ⇒ ງານຄາຢູ່ຂັ້ນເດີມ ແລະ ຂຶ້ນຄິວມື້ນັ້ນເອງ.
                            */
                            if (job.workflow == 'maintenance') ...[
                              const SizedBox(height: 14),
                              const Divider(height: 1),
                              const SizedBox(height: 12),
                              const Text(
                                'ຍັງບໍ່ຈົບຮອບນີ້?',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: ink,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 8),
                              // ລ້າງແອບໍ່ຈົບຮອບດຽວກໍ່ມີ (ນ້ຳບໍ່ມາ · ລູກຄ້າຂໍເລື່ອນ) ⇒ ຊຸດດຽວກັບສາຍງານອື່ນ
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size.fromHeight(48),
                                  foregroundColor: warn,
                                  side: const BorderSide(color: warn),
                                ),
                                // ນັດຮອບຕໍ່ໄປໄດ້**ຫຼັງ check-in ແລ້ວ**ເທົ່ານັ້ນ (07-08-2026):
                                // ຮອບທີ່ບໍ່ເຄີຍໄປໜ້າງານ = ບໍ່ມີຫຼັກຖານຫຍັງ ⇒ ເປັນການເລື່ອນນັດ
                                // ບໍ່ແມ່ນ "ຮອບຕໍ່ໄປ" (ເລື່ອນວັນ ⇒ ໃຫ້ CS ແກ້ໃບງານແທນ).
                                // ດ່ານຈິງຢູ່ lib/job-flow.scheduleNextVisit.
                                // ນັດຮອບໃໝ່ = ຕັດສິນໃຈຂອງຫົວໜ້າງານ (ຊ່າງຮ່ວມໃຊ້ປຸ່ມ check-out ແທນ)
                                onPressed: busy || !_visitedThisJob || !job.isLead ? null : _askNextVisit,
                                icon: const Icon(Icons.event_repeat_outlined, size: 18),
                                label: Text(
                                  job.canCheckOut
                                      ? 'check-out ອອກ ແລະ ນັດຮອບຕໍ່ໄປ'
                                      : 'ນັດຮອບຕໍ່ໄປ',
                                ),
                              ),
                              if (!_visitedThisJob) ...[
                                const SizedBox(height: 6),
                                const Text(
                                  'ຕ້ອງ check-in ໜ້າງານກ່ອນ ຈຶ່ງນັດຮອບຕໍ່ໄປໄດ້',
                                  style: TextStyle(color: muted, fontSize: 11.5),
                                ),
                              ],
                            ] else if (job.workflow == 'install' ||
                                (job.workflow == 'repair' && job.onsite)) ...[
                              const SizedBox(height: 14),
                              const Divider(height: 1),
                              const SizedBox(height: 12),
                              const Text(
                                'ຍັງບໍ່ຈົບຮອບນີ້?',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: ink,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 8),
                              /*
                                ຕອນຈະອອກຈາກໜ້າງານມີ **2 ທາງ** ຢູ່ບ່ອນດຽວ (07-08-2026):
                                ① ຈົບແລ້ວ ⇒ ປຸ່ມ "ບັນທຶກ…ສຳເລັດ" ຂ້າງເທິງ (checkout ໃຫ້ເອງ → QC)
                                ② ຍັງບໍ່ຈົບ ⇒ check-out ອອກ (ບໍ່ປິດງານ) ແລ້ວນັດຮອບຕໍ່ໄປ
                              */
                              /*
                                ── ປຸ່ມດຽວ: check-out + ນັດຮອບຕໍ່ໄປ (07-08-2026 ຕາມຄຳສັ່ງ) ──
                                ແຕ່ກ່ອນແຍກເປັນ 2 ປຸ່ມ (ອອກກ່ອນ → ແລ້ວນັດ) ⇒ ຊ່າງກົດອັນທຳອິດແລ້ວ
                                ອອກຈາກໜ້າໄປ ⇒ ບໍ່ໄດ້ນັດ ງານຄາງຽບໆ. ດຽວນີ້ຂັ້ນຕອນດຽວ:
                                ຖາມວັນ+ເຫດຜົນ → check-out (ເວລາຈິງ) → ບັນທຶກນັດ.
                              */
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size.fromHeight(48),
                                  foregroundColor: warn,
                                  side: const BorderSide(color: warn),
                                ),
                                // ນັດຮອບຕໍ່ໄປໄດ້**ຫຼັງ check-in ແລ້ວ**ເທົ່ານັ້ນ (07-08-2026):
                                // ຮອບທີ່ບໍ່ເຄີຍໄປໜ້າງານ = ບໍ່ມີຫຼັກຖານຫຍັງ ⇒ ເປັນການເລື່ອນນັດ
                                // ບໍ່ແມ່ນ "ຮອບຕໍ່ໄປ" (ເລື່ອນວັນ ⇒ ໃຫ້ CS ແກ້ໃບງານແທນ).
                                // ດ່ານຈິງຢູ່ lib/job-flow.scheduleNextVisit.
                                // ນັດຮອບໃໝ່ = ຕັດສິນໃຈຂອງຫົວໜ້າງານ (ຊ່າງຮ່ວມໃຊ້ປຸ່ມ check-out ແທນ)
                                onPressed: busy || !_visitedThisJob || !job.isLead ? null : _askNextVisit,
                                icon: const Icon(Icons.event_repeat_outlined, size: 18),
                                label: Text(
                                  job.canCheckOut
                                      ? 'check-out ອອກ ແລະ ນັດຮອບຕໍ່ໄປ'
                                      : 'ນັດຮອບຕໍ່ໄປ',
                                ),
                              ),
                              if (!_visitedThisJob) ...[
                                const SizedBox(height: 6),
                                const Text(
                                  'ຕ້ອງ check-in ໜ້າງານກ່ອນ ຈຶ່ງນັດຮອບຕໍ່ໄປໄດ້',
                                  style: TextStyle(color: muted, fontSize: 11.5),
                                ),
                              ],
                            ],
                          ],

                          if (job.action == 'wait_spare') ...[
                            /*
                              ⚠️ **ບັກເກົ່າ (ແກ້ 06-08-2026)**: ຝັ່ງຕິດຕັ້ງເຄີຍກວດ `stage == 1`
                              ແຕ່ຂັ້ນ 1 ຂອງຕິດຕັ້ງ = **ຊ່າງຍັງບໍ່ທັນຮັບງານ** (tech_confirm ຫວ່າງ)
                              ເຊິ່ງຕອນນັ້ນ action ເປັນ 'accept' ບໍ່ແມ່ນ 'wait_spare'
                              ⇒ ເງື່ອນໄຂນີ້ **ບໍ່ເຄີຍເປັນຈິງ** ⇒ ຊ່າງຕິດຕັ້ງບໍ່ເຫັນປຸ່ມ
                              "ອອກໃບຂໍເບີກອາໄຫຼ່" ຈັກເທື່ອ ເຫັນແຕ່ "ລໍສາງເບີກ — ຍັງລົງມືບໍ່ໄດ້".

                              ຂັ້ນຈິງຂອງຕິດຕັ້ງ (lib/install-stage): ຮັບງານແລ້ວ ⇒ **2 = ລໍຂໍເບີກ**
                              (reg_start ຫວ່າງ) · 3 = ຂໍແລ້ວ ລໍສາງ · 4 = ອາໄຫຼ່ຄົບ/ບໍ່ໃຊ້ອາໄຫຼ່.
                              ເອົາ 2–3 ໃຫ້ຕົງກັບເວັບ (/installations/[code] ໂຊ້ວປຸ່ມຂໍເບີກຂັ້ນ 2–3).
                            */
                            if ((job.workflow == 'repair' && job.stage == 5) ||
                                (job.workflow == 'install' &&
                                    (job.stage == 2 || job.stage == 3))) ...[
                              const Text(
                                'ຕ້ອງອອກໃບຂໍເບີກອາໄຫຼ່ກ່ອນ',
                                style: TextStyle(color: muted),
                              ),
                              const SizedBox(height: 8),
                              _button('ອອກໃບຂໍເບີກອາໄຫຼ່', teal, () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => SpareRequestScreen(
                                      code: job.code,
                                      workflow: job.workflow,
                                    ),
                                  ),
                                );
                                if (mounted) await reload();
                              }),
                            ] else ...[
                              /*
                                ── ລາຍການ **ໃບຂໍເບີກ ແລະ ໃບເບີກ ລາຍໃບ** (07-08-2026) ──
                                1 ງານມີໃບຂໍຫຼາຍໃບ ແລະ 1 ໃບຂໍຖືກເບີກຫຼາຍໃບໄດ້ (ຄົນລະສາງ/ຄົນລະເທື່ອ)
                                ⇒ ຕ້ອງ **ກົດຮັບທຸກໃບ** ຈຶ່ງໄປຂັ້ນຕໍ່ໄປ. ແຕ່ກ່ອນແອັບບອກແຕ່
                                "ລໍສາງເບີກ — ຍັງລົງມືບໍ່ໄດ້" ⇒ ຊ່າງບໍ່ຮູ້ວ່າເຫຼືອໃບໃດ ຕ້ອງອອກໄປໜ້າອື່ນ.
                              */
                              if (_rounds.isEmpty)
                                const Text(
                                  'ລໍສາງເບີກອາໄຫຼ່ — ຍັງລົງມືບໍ່ໄດ້',
                                  style: TextStyle(color: muted),
                                )
                              else
                                ..._rounds.map(
                                  (round) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text(
                                              'ຮອບ ${round.round} · ${round.docNo}',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                color: ink,
                                                fontSize: 13,
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            _stateChip(round),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        if (round.dispatches.isEmpty)
                                          const Padding(
                                            padding: EdgeInsets.only(left: 4),
                                            child: Text(
                                              'ສາງຍັງບໍ່ໄດ້ເບີກໃຫ້',
                                              style: TextStyle(color: muted, fontSize: 12),
                                            ),
                                          )
                                        else
                                          ...round.dispatches.map(
                                            (doc) => Padding(
                                              padding: const EdgeInsets.only(left: 4, bottom: 6),
                                              child: Row(
                                                children: [
                                                  Icon(
                                                    doc.received
                                                        ? Icons.check_circle
                                                        : Icons.inventory_2_outlined,
                                                    size: 16,
                                                    color: doc.received ? ok : warn,
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Expanded(
                                                    child: Text(
                                                      '${doc.docNo} · ${doc.lines} ລາຍການ'
                                                      '${doc.received ? " · ຮັບແລ້ວ" : ""}',
                                                      style: const TextStyle(fontSize: 12.5, color: ink),
                                                    ),
                                                  ),
                                                  if (!doc.received)
                                                    FilledButton(
                                                      style: FilledButton.styleFrom(
                                                        backgroundColor: teal,
                                                        visualDensity: VisualDensity.compact,
                                                      ),
                                                      onPressed: busy
                                                          ? null
                                                          : () => _receiveDoc(doc.docNo),
                                                      child: const Text('ຮັບ'),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                              const SizedBox(height: 8),
                              _button(
                                'ໄປໜ້າ ຮັບອາໄຫຼ່',
                                const Color(0xFF334155),
                                () async {
                                  await Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const PickupScreen(),
                                    ),
                                  );
                                  if (mounted) await reload();
                                },
                              ),
                            ],
                          ],

                          if (job.action == 'wait_other' &&
                              !(job.workflow == 'repair' && job.stage <= 2))
                            const Text(
                              'ວຽກຂອງທ່ານຈົບແລ້ວ — ລໍຫົວໜ້າ ຫຼື CS ດຳເນີນການຕໍ່',
                              style: TextStyle(color: muted),
                              textAlign: TextAlign.center,
                            ),
                        ],
                      ),

                      /* ── ໜ້າງານ (ນອກສະຖານທີ່): check-out / ສະຖານະ ──
             check-in ຢູ່ແຖບການເຮັດວຽກດ້ານເທິງແລ້ວ (ຂັ້ນ 1). ຈົບງານ = checkout ອັດຕະໂນມັດ.
             ໂຊ້ບັດນີ້ສະເພາະ: ຍັງ check-in ຄ້າງ (ໃຫ້ອອກກ່ອນໄດ້) ຫຼື ຂັ້ນ 1 (ຮັບງານກ່ອນ/ຊີ້ຂຶ້ນ).
             ຂັ້ນສ້ອມ (8,9) ຫຼັງ checkout ໄປແລ້ວ = ບໍ່ໂຊ້ບັດ (ບໍ່ໃຫ້ປຸ່ມ check-in ໂຜ່ຄືນຜິດໆ). */
                      if (job.onsite &&
                          (job.canCheckOut || job.stage == 1)) ...[
                        const SizedBox(height: 12),
                        _Card(
                          children: [
                            const Text(
                              'ໜ້າງານ',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            // ຢູ່ໜ້າງານແລ້ວ = ສະຖານະລ້ວນ (ບໍ່ມີປຸ່ມ checkout ເອງ) — ຈົບງານ ລະບົບ
                            // checkout ໃຫ້ອັດຕະໂນມັດ. (ແຕ່ກ່ອນມີປຸ່ມ check-out ຄຽງກັບຄຳ "ອັດຕະໂນມັດ" ⇒ ຂັດກັນ.)
                            job.canCheckOut
                                ? Row(
                                    children: [
                                      const Icon(
                                        Icons.check_circle,
                                        size: 17,
                                        color: ok,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          job.workflow == 'install'
                                              ? 'ຢູ່ໜ້າງານແລ້ວ — ຈົບແລ້ວກົດ "ບັນທຶກຕິດຕັ້ງສຳເລັດ" · ຍັງບໍ່ຈົບກົດ "check-out ອອກ ແລະ ນັດຮອບຕໍ່ໄປ"'
                                              : 'ຢູ່ໜ້າງານແລ້ວ — ກົດ "ບັນທຶກສ້ອມສຳເລັດ" ⇒ checkout ອັດຕະໂນມັດ',
                                          style: const TextStyle(
                                            color: muted,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ],
                                  )
                                : !job.accepted
                                ? Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      const Text(
                                        'ກະລຸນາກົດ “ຮັບງານ” ດ້ານເທິງກ່ອນ check-in',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: Color(0xFFB45309),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      _button(
                                        'ຍັງ check-in ບໍ່ໄດ້',
                                        muted,
                                        null,
                                      ),
                                    ],
                                  )
                                : const Text(
                                    '↑ ໃຊ້ປຸ່ມ check-in ດ້ານເທິງ',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: muted,
                                      fontSize: 12,
                                    ),
                                  ),

                            /*
                              ── ຊ່າງຮ່ວມຕ້ອງ check-out ເອງໄດ້ (10-08-2026) ──
                              ຫົວໜ້າຖືກ checkout ໃຫ້ອັດຕະໂນມັດຕອນກົດຈົບງານ ແຕ່ຊ່າງຮ່ວມ
                              **ຈົບງານບໍ່ໄດ້** ⇒ ຖ້າບໍ່ມີປຸ່ມນີ້ ຮອບຂອງລາວຈະຄ້າງເປີດຕະຫຼອດ
                              (ລາຍງານຮອບໜ້າງານຜິດ ແລະ ຄ່າຄອມນັບຮອບບໍ່ຈົບ).
                            */
                            if (!job.isLead && job.canCheckOut) ...[
                              const SizedBox(height: 10),
                              _button(
                                'check-out ອອກຈາກໜ້າງານ',
                                ink,
                                busy ? null : () => run({'action': 'checkout'}),
                              ),
                            ],

                            /*
                              ── ເກັບ ISN/SN ຢູ່ບັດໜ້າງານນຳ (08-08-2026 ຕາມຄຳສັ່ງ) ──
                              ຊ່າງເປີດປ້າຍເຄື່ອງເບິ່ງ**ຕອນຕິດ** ບໍ່ແມ່ນຕອນຈະກົດຈົບງານ
                              (ໜ່ວຍນອກຂຶ້ນຢູ່ຝາແລ້ວ ຈໍ້ກ້ອງບໍ່ເຖິງອີກ) ⇒ ປຸ່ມຕ້ອງຢູ່ບ່ອນ
                              ດຽວກັບ check-in/check-out ບໍ່ແມ່ນລີ້ຢູ່ທ້າຍກ່ອງ "ຈົບງານ".
                              ອັນດຽວກັນກັບປຸ່ມຂ້າງເທິງ — ກົດບ່ອນໃດກໍ່ໄດ້.
                            */
                            if (job.workflow == 'install' &&
                                job.isLead &&
                                job.canCheckOut) ...[
                              const SizedBox(height: 10),
                              _serialCollector(),
                            ],
                          ],
                        ),
                      ],
                    ],
                  ),
                  // ── tab 2: ການເຄື່ອນໄຫວ (chatter) ──
                  _chatterView(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// ປ້າຍປະເພດບໍລິການ (CI/ST/IH/PS)
  String _serviceLabel(String? t) => switch (t) {
    'CI' => 'ນຳເຂົ້າສູນ (CI)',
    'ST' => 'ສ້ອມໜ້າງານ (ST)',
    'IH' => 'ສ້ອມເຖິງບ້ານ (IH)',
    'PS' => 'ບຳລຸງຮັກສາ (PS)',
    _ => t ?? '-',
  };

  /// **ຮອບນີ້ຄືຮອບທີເທົ່າໃດ + ຮອບກ່ອນຄ້າງຍ້ອນຫຍັງ** — null = ໃບໃໝ່ (ຍັງບໍ່ເຄີຍໄປ)
  /// ຫຼື ງານຈົບແລ້ວ. ຄຳນວນຄືກັນກັບ nextRoundHint() ຢູ່ເວັບ (lib/install-visits).
  Widget? _roundBanner() {
    final visits = timeline?.visits ?? const <JobVisit>[];
    if (visits.isEmpty) return null;
    // ຂັ້ນ 6 ຂຶ້ນໄປ = ຕິດຕັ້ງ/ສ້ອມສຳເລັດແລ້ວ ⇒ ບໍ່ມີ "ຮອບຕໍ່ໄປ" ໃຫ້ເຕືອນ
    if (job.stage > 5) return null;
    final last = visits.last;
    final open = last.out == null;
    final round = open ? last.n : last.n + 1;
    final reason = last.reason;
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
      decoration: BoxDecoration(
        color: warnTint,
        borderRadius: BorderRadius.circular(kCardRadius),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.replay_rounded, size: 18, color: warn),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  open ? 'ກຳລັງຢູ່ໜ້າງານ ຮອບທີ $round' : 'ໃບນີ້ຕ້ອງກັບໄປ — ຮອບທີ $round',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                    color: warn,
                  ),
                ),
              ),
            ],
          ),
          if (last.at != null) ...[
            const SizedBox(height: 3),
            Text(
              'ຮອບກ່ອນ ${last.out ?? last.at}',
              style: const TextStyle(fontSize: 11.5, color: muted),
            ),
          ],
          if ((reason ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'ຍັງບໍ່ຈົບຍ້ອນ: $reason',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: body,
              ),
            ),
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

  /// **ເສັ້ນເວລາຂອງງານ** — ຄູ່ກັບ Timeline ຢູ່ເວັບ (components/repair/job-timeline).
  ///
  /// ແອັບດຶງ `timeline` ມາຢູ່ແລ້ວແຕ່ເມື່ອກ່ອນ **ຖິ້ມຖິ້ມ** (ບໍ່ເຄີຍສະແດງ) ⇒ ຊ່າງເຫັນແຕ່
  /// ປຸ່ມຂັ້ນຕໍ່ໄປ ບໍ່ຮູ້ວ່າໃບງານຜ່ານຫຍັງມາ ແລະ ຄ້າງຢູ່ຂັ້ນນີ້ດົນປານໃດ — ຂໍ້ມູນທີ່ຫົວໜ້າ
  /// ຢູ່ເວັບເຫັນໝົດ. **ແນວຕັ້ງ** (ເວັບເປັນແນວນອນ) ເພາະຈໍແຄບ ແຕ່ຂໍ້ມູນຄືກັນທຸກຢ່າງ.
  Widget _timelineCard() {
    final data = timeline!;
    final steps = data.steps;
    return _Card(
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
          _timelineRow(steps[i], isLast: i == steps.length - 1 && data.cancelledAt == null),
        if (data.cancelledAt != null)
          _timelineRow(
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
          for (final visit in data.visits) _visitRow(visit),
        ],
      ],
    );
  }

  /// 1 ຂັ້ນໃນເສັ້ນເວລາ — ● ຜ່ານແລ້ວ · ◉ ຂັ້ນປັດຈຸບັນ (ເນັ້ນ) · ○ ຍັງບໍ່ຮອດ
  Widget _timelineRow(TimelineStep step, {required bool isLast, bool cancelled = false}) {
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

  /// 1 ຮອບເຂົ້າໜ້າງານ — ເຂົ້າ → ອອກ (ໃຊ້ເວລາ); ຮອບທີ່ຍັງບໍ່ອອກ ເນັ້ນສີເຕືອນ
  Widget _visitRow(JobVisit visit) {
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

  /// ການສົ່ງເຄື່ອງ — ຄູ່ກັບກ່ອງດຽວກັນຢູ່ເວັບ (components/installation/delivery-card).
  ///
  /// ສຳລັບຊ່າງ ອັນທີ່ມີຄ່າທີ່ສຸດຄື **ປຸ່ມນຳທາງໄປຈຸດສົ່ງ**: ທີ່ຢູ່ພິມມືໃນໃບງານ
  /// ມັກຫາບໍ່ພົບ ແຕ່ພິກັດນີ້ແມ່ນບ່ອນທີ່ຄົນສົ່ງໄປຮອດຈິງ.
  /// ເຄື່ອງສຳຮອງທີ່ຍັງບໍ່ຄືນ — ເຕືອນຊ່າງໃຫ້ເອົາກັບມາພ້ອມ (ຮັບຄືນຈິງເຮັດຢູ່ເວັບ).
  /// "ຕອນນີ້ລໍໃຜເຮັດ" — ປ້າຍໃຫຍ່ສີຄາມດຽວກັບເວັບ + ສະຖານະອາໄຫຼ່ 3 ຕົວເລກ
  /// (ນິຍາມດຽວກັບເວັບ: ກຳລັງສັ່ງຊື້ = status=5 ແລະ arrive_at ຫວ່າງ)
  Widget _nextActorCard() {
    final who = nextActor!;
    final spares = spareSummary;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      decoration: BoxDecoration(
        color: teal,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person_pin_rounded, size: 20, color: onAccent),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  'ຕອນນີ້ລໍ ${who.actorLabel} ເຮັດຕໍ່',
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                    color: surface,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            who.label,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFFCCFBF1),
            ),
          ),
          if (who.action.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              who.action,
              style: const TextStyle(fontSize: 11.5, color: Color(0xB3FFFFFF)),
            ),
          ],
          if (spares != null &&
              (spares.pending > 0 ||
                  spares.onOrder > 0 ||
                  spares.arrived > 0)) ...[
            const SizedBox(height: 9),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (spares.pending > 0)
                  _spareChip('ຄ້າງເບີກ ${spares.pending}', const Color(0xFFFDE68A), const Color(0xFF92400E)),
                if (spares.onOrder > 0)
                  _spareChip('ກຳລັງສັ່ງຊື້ ${spares.onOrder}', const Color(0xFFDDD6FE), const Color(0xFF5B21B6)),
                if (spares.arrived > 0)
                  _spareChip('ພ້ອມເບີກ ${spares.arrived}', const Color(0xFFA7F3D0), const Color(0xFF065F46)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _spareChip(String text, Color bg, Color fg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
    child: Text(
      text,
      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: fg),
    ),
  );

  Widget _loanerCard() {
    return _Card(
      children: [
        Row(
          children: const [
            Icon(
              Icons.inventory_2_outlined,
              size: 18,
              color: Color(0xFFB45309),
            ),
            SizedBox(width: 6),
            Text(
              'ຕ້ອງເອົາເຄື່ອງສຳຮອງຄືນ',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: ink,
                fontSize: 14,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final row in loaners)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.itemName,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: ink,
                        ),
                      ),
                      Text(
                        'ISN ${row.isn}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${row.days} ມື້',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ),
              ],
            ),
          ),
        const Text(
          'ຮັບຄືນແລ້ວ ໃຫ້ຝ່າຍບໍລິການບັນທຶກຢູ່ລະບົບ — ຍັງບໍ່ຄືນ ປິດງານບໍ່ໄດ້',
          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
      ],
    );
  }

  Widget _deliveryCard() {
    final info = delivery!;
    final list = deliveryPhotos;
    return _Card(
      children: [
        Row(
          children: [
            const Icon(
              Icons.local_shipping_outlined,
              size: 18,
              color: Color(0xFF059669),
            ),
            const SizedBox(width: 6),
            const Text(
              'ການສົ່ງເຄື່ອງ',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: ink,
                fontSize: 14,
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                info.billNo,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        if (info.sentEnd != null) _deliveryRow('ສົ່ງສຳເລັດ', info.sentEnd!),
        if (info.checkinAt != null)
          _deliveryRow('ເຊັກອິນໜ້າບ້ານ', info.checkinAt!),
        if (info.remark != null) _deliveryRow('ໝາຍເຫດຄົນສົ່ງ', info.remark!),

        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (info.hasGeo)
              FilledButton.icon(
                onPressed: openDeliveryMap,
                icon: const Icon(Icons.navigation_outlined, size: 16),
                label: const Text('ນຳທາງໄປຈຸດສົ່ງ'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                ),
              ),
            if ((info.telephone ?? '').isNotEmpty)
              OutlinedButton.icon(
                onPressed: callReceiver,
                icon: const Icon(Icons.phone_outlined, size: 16),
                label: Text('ໂທຫາຄົນຮັບ ${info.telephone}'),
              ),
            if (info.photos > 0 && list == null)
              OutlinedButton.icon(
                onPressed: loadingDeliveryPhotos ? null : loadDeliveryPhotos,
                icon: loadingDeliveryPhotos
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.photo_library_outlined, size: 16),
                label: Text('ເບິ່ງຮູບຕອນສົ່ງ (${info.photos})'),
              ),
          ],
        ),

        if (list != null && list.isNotEmpty) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 110,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, i) => ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(
                  base64Decode(list[i].split(',').last),
                  width: 140,
                  height: 110,
                  fit: BoxFit.cover,
                  // cacheWidth — ບໍ່ decode ຮູບກ້ອງເຕັມຄວາມລະອຽດ (ເຄື່ອງເກົ່າ RAM ໜ້ອຍ)
                  cacheWidth: (140 * MediaQuery.of(context).devicePixelRatio).round(),
                ),
              ),
            ),
          ),
        ],

        if (!info.hasGeo) ...[
          const SizedBox(height: 6),
          const Text(
            'ຄົນສົ່ງບໍ່ໄດ້ປັກພິກັດໄວ້ — ໃຊ້ທີ່ຢູ່ໃນໃບງານແທນ',
            style: TextStyle(fontSize: 11, color: Color(0xFFB45309)),
          ),
        ],
      ],
    );
  }

  Widget _deliveryRow(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              color: ink,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _row(String label, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 92,
            child: Text(
              label,
              style: const TextStyle(
                color: muted,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 12.5,
                height: 1.3,
                color: ink,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// ແຖວຮູບໜຶ່ງໝວດ (ຮັບເຄື່ອງ / ກວດເຊັກ / ສ້ອມສຳເລັດ) — ແຕະເພື່ອຂະຫຍາຍ
  Widget _photoRow(String label, IconData icon, List<String> items) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 17, color: teal),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: ink,
                fontSize: 13.5,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '(${items.length})',
              style: const TextStyle(color: faint, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final img in items)
              GestureDetector(
                onTap: () => showDialog<void>(
                  context: context,
                  builder: (_) => Dialog(
                    child: Stack(
                      children: [
                        InteractiveViewer(
                          child: Image.memory(
                            base64Decode(img.split(',').last),
                            // ຈຳກັດ 1800px — ພໍສຳລັບ zoom ເຕັມຈໍ
                            // ແຕ່ບໍ່ decode ຮູບ 12MP ເຕັມ (ເຄື່ອງເກົ່າ RAM ໜ້ອຍ)
                            cacheWidth: 1800,
                          ),
                        ),
                        Positioned(
                          right: 4,
                          top: 4,
                          child: IconButton.filled(
                            tooltip: 'ປິດ',
                            onPressed: () => Navigator.pop(context),
                            icon: const Icon(Icons.close),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  // cacheWidth: ຖອດລະຫັດຮູບຂະໜາດນ້ອຍເທົ່າ thumbnail ຈິງ — ຮູບກ້ອງ
                  // 12MP ຫຼາຍໜ່ວຍໃນ RAM 1-2GB ຂອງເຄື່ອງເກົ່າ ຈະ OOM ຖ້າ decode ເຕັມ
                  child: Image.memory(
                    base64Decode(img.split(',').last),
                    width: 76,
                    height: 76,
                    fit: BoxFit.cover,
                    cacheWidth: (76 * MediaQuery.of(context).devicePixelRatio).round(),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
      ],
    ),
  );

  /// ປຸ່ມ **ຫຼັກ** — ຖົມສີເຕັມ (v4: flat, ບໍ່ມີເງົາສີ ⇒ ປະຢັດ GPU ເຄື່ອງເກົ່າ)
  /* ══ ຂັ້ນຕໍ່ໄປ (v5) ═══════════════════════════════════════════════════════
     ປຸ່ມຫຼັກຂອງໜ້ານີ້ **ນິຍາມຢູ່ບ່ອນດຽວ** ແລ້ວສະແດງຢູ່ແຖບລຸ່ມຈໍ (NextActionBar).

     ເປັນຫຍັງ: ແຕ່ກ່ອນປຸ່ມທັງ 6 ຝັງກະຈາຍຢູ່ກາງໜ້າຍາວ ⇒ ຊ່າງທີ່ຢືນຢູ່ໜ້າງານ
     ຕ້ອງເລື່ອນຫາ ແລະ ບາງເທື່ອກົດອັນຜິດ. ດຽວນີ້: ເລື່ອນໄປໃສກໍ່ຕາມ ປຸ່ມທີ່ຖືກ
     ຢູ່ບ່ອນເກົ່າສະເໝີ ແລະ ມີ**ອັນດຽວ**.

     ⚠️ ຢ່າຄິດເງື່ອນໄຂຂັ້ນເອງເພີ່ມຢູ່ນີ້ — ທຸກແຖວລຸ່ມນີ້ຄັດມາຈາກເງື່ອນໄຂເກົ່າ
     ຄຳຕໍ່ຄຳ ແລະ ຍັງອີງ `job.action` / `job.canCheckIn` ຂອງ server ຄືເກົ່າ.
     ໜ້າທີ່ຂອງແອັບຄືສະແດງ ບໍ່ແມ່ນຕັດສິນ.
     ══════════════════════════════════════════════════════════════════════ */
  ({
    String label,
    IconData icon,
    Color color,
    VoidCallback? onTap,
    String? blocker,
  })?
  _nextAction() {
    // ① ວຽກໃໝ່ — ຕ້ອງຮັບກ່ອນ (ຫົວໜ້າຄົນດຽວ)
    if (job.isLead && job.action == 'accept' && !rejecting) {
      return (
        label: 'ຮັບງານ',
        icon: Icons.check_circle_outline_rounded,
        color: teal,
        onTap: () => run({'action': 'accept'}),
        blocker: null,
      );
    }

    // ② ໜ້າງານ (ສ້ອມ) — ຮັບແລ້ວ ຍັງບໍ່ check-in
    if (job.workflow == 'repair' &&
        job.accepted &&
        job.stage == 1 &&
        job.onsite &&
        !job.hasCheckedIn &&
        job.canCheckIn) {
      return (
        label: 'check-in ໜ້າງານ',
        icon: Icons.location_on_outlined,
        color: ink,
        onTap: checkIn,
        blocker: null,
      );
    }

    // ③ ຕິດຕັ້ງ/ລ້າງແອ — check-in ຄື "ເລີ່ມງານ" ໃນຮອບທຳອິດ
    if ((job.workflow == 'install' || job.workflow == 'maintenance') &&
        job.canCheckIn) {
      final first =
          (job.workflow == 'install' && job.stage == 4) ||
          (job.workflow == 'maintenance' && job.stage == 2);
      return (
        label: first ? 'check-in — ເລີ່ມງານ' : 'check-in ຮອບຕໍ່ໄປ',
        icon: Icons.location_on_outlined,
        color: ink,
        onTap: checkIn,
        blocker: null,
      );
    }

    // ④ ສ້ອມຂັ້ນ 1-2 = ກວດເຊັກ (ໜ້າງານທີ່ຍັງບໍ່ check-in ໃຊ້ຂໍ້ ② ແທນ)
    if (job.isLead &&
        job.workflow == 'repair' &&
        job.accepted &&
        (job.stage == 1 || job.stage == 2) &&
        !(job.stage == 1 && job.onsite && !job.hasCheckedIn)) {
      return (
        label: job.stage == 1 ? 'ເລີ່ມກວດເຊັກ' : 'ບັນທຶກຜົນກວດເຊັກ',
        icon: Icons.fact_check_outlined,
        color: teal,
        onTap: () async {
          final messenger = ScaffoldMessenger.of(context);
          if (job.stage == 1) {
            try {
              await Api.check(job.code, {'action': 'start'});
            } on ApiError catch (failure) {
              messenger.showSnackBar(
                SnackBar(
                  content: Text(failure.message),
                  backgroundColor: danger,
                ),
              );
              return;
            }
          }
          await _openCheck();
        },
        blocker: null,
      );
    }

    // ⑤ ເລີ່ມສ້ອມ (ຝັ່ງຕິດຕັ້ງ check-in ຄືການເລີ່ມຢູ່ແລ້ວ ⇒ ບໍ່ມີປຸ່ມນີ້)
    if (job.isLead && job.action == 'start' && job.workflow != 'install') {
      final needCheckIn = job.onsite && !job.hasCheckedIn;
      return (
        label: 'ເລີ່ມສ້ອມແປງ',
        icon: Icons.play_arrow_rounded,
        color: teal,
        onTap: () => run({'action': 'start'}),
        blocker: needCheckIn ? 'ຕ້ອງ check-in ໜ້າງານກ່ອນ ຈຶ່ງເລີ່ມງານໄດ້' : null,
      );
    }

    // ⑥ ຈົບງານ — ຫົວໜ້າຄົນດຽວ · ຕ້ອງມີຮູບຜົນງານ (ແລະ ISN/SN ຖ້າຕິດຕັ້ງ)
    if (job.isLead && job.action == 'finish') {
      final needPhoto =
          job.workflow != 'maintenance' &&
          (job.workflow == 'install' || job.onsite) &&
          photos.isEmpty;
      final needSerial = job.workflow == 'install' && !job.scanDone;
      return (
        label: job.workflow == 'install'
            ? 'ຕິດຕັ້ງສຳເລັດ — ສົ່ງ QC'
            : 'ສ້ອມສຳເລັດ — ສົ່ງ QC',
        icon: Icons.check_circle_outline_rounded,
        color: ok,
        onTap: () => run({
          'action': 'finish',
          'note': note.text,
          'photos': photos,
        }),
        blocker: needPhoto
            ? 'ຕ້ອງແນບຮູບຜົນງານຢ່າງໜ້ອຍ 1 ຮູບກ່ອນ'
            : needSerial
            ? 'ຕ້ອງເກັບ ISN/SN ${_missingUnit()} ກ່ອນ'
            : null,
      );
    }

    // ລໍຄົນອື່ນ/ຂັ້ນຕອນອື່ນ — ບໍ່ມີປຸ່ມໃຫ້ກົດ ⇒ ບໍ່ຕ້ອງມີແຖບ (ຢ່າໂຊ້ປຸ່ມຫຼອກ)
    return null;
  }

  /// ແຖບ "ຂັ້ນຕໍ່ໄປ" — null ເມື່ອງານກຳລັງລໍຄົນອື່ນ
  Widget? _nextActionBar() {
    final next = _nextAction();
    if (next == null) return null;
    return NextActionBar(
      label: next.label,
      icon: next.icon,
      tone: next.color,
      busy: busy,
      blocker: next.blocker,
      onPressed: next.onTap,
      actions: [
        if ((job.tel ?? '').trim().isNotEmpty)
          NextActionIcon(
            icon: Icons.call_outlined,
            onTap: callCustomer,
            tooltip: 'ໂທຫາລູກຄ້າ',
          ),
        if (job.lat != null || (job.address ?? '').trim().isNotEmpty)
          NextActionIcon(
            icon: Icons.navigation_outlined,
            onTap: openMap,
            tooltip: 'ນຳທາງ',
          ),
      ],
    );
  }

  Widget _primaryAction(
    String label,
    IconData icon,
    Color color,
    VoidCallback? onPressed, {
    double height = 54,
  }) => FilledButton.icon(
    onPressed: busy ? null : onPressed,
    style: FilledButton.styleFrom(
      backgroundColor: color,
      foregroundColor: onAccent,
      minimumSize: Size.fromHeight(height),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kButtonRadius),
      ),
    ),
    icon: busy
        ? const SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: onAccent,
            ),
          )
        : Icon(icon, size: 20),
    label: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
    ),
  );

  /// ປຸ່ມ **ຮອງ/ອັນຕະລາຍ** — ເສັ້ນຂອບບາງ ບໍ່ຖົມສີ ⇒ ບໍ່ແຍ້ງກັບປຸ່ມຫຼັກ ແລະ ກົດຜິດຍາກຂຶ້ນ
  Widget _ghostAction(
    String label,
    IconData icon,
    Color color,
    VoidCallback? onPressed, {
    double height = 48,
  }) => OutlinedButton.icon(
    onPressed: busy ? null : onPressed,
    style: OutlinedButton.styleFrom(
      foregroundColor: color,
      backgroundColor: surface,
      minimumSize: Size.fromHeight(height),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      side: BorderSide(color: color.withValues(alpha: .35)),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kButtonRadius),
      ),
    ),
    icon: Icon(icon, size: 18),
    label: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
    ),
  );

  /// ຖາມ ວັນນັດ + ເຫດຜົນ ແລ້ວສົ່ງຄຳສັ່ງ next-visit (ເບິ່ງ lib/job-flow.scheduleNextVisit)
  Future<void> _askNextVisit() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 180)),
      helpText: job.workflow == 'install'
          ? 'ວັນທີ່ຈະກັບໄປຕິດຕັ້ງຕໍ່'
          : job.workflow == 'maintenance'
          ? 'ວັນທີ່ຈະກັບໄປລ້າງຕໍ່'
          : 'ວັນທີ່ຈະກັບໄປສ້ອມຕໍ່',
    );
    if (picked == null || !mounted) return;

    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('check-out ອອກ ແລະ ນັດຮອບຕໍ່ໄປ'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'ກັບໄປວັນທີ ${picked.day}/${picked.month}/${picked.year}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: reason,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'ຍັງບໍ່ຈົບຍ້ອນຫຍັງ',
                hintText: 'ລໍງານໄຟຟ້າ · ຝົນຕົກ · ຂາດອາໄຫຼ່ · ລູກຄ້າຂໍເລື່ອນ',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('ຍົກເລີກ')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('ບັນທຶກນັດ')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final text = reason.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ກະລຸນາໃສ່ເຫດຜົນ')),
      );
      return;
    }
    final month = picked.month.toString().padLeft(2, '0');
    final day = picked.day.toString().padLeft(2, '0');
    /*
      check-out ກ່ອນ **ໃນຂັ້ນຕອນດຽວກັນ** — ເວລາອອກຈຶ່ງເປັນເວລາຈິງທີ່ຊ່າງກົດ
      (server ປະຕິເສດການນັດ ຖ້າຍັງມີ check-in ຄ້າງ — ເບິ່ງ lib/job-flow).
    */
    if (job.canCheckOut) {
      await run({'action': 'checkout'});
      if (!mounted) return;
    }
    await run({
      'action': 'next-visit',
      'next_date': '${picked.year}-$month-$day',
      'reason': text,
    });
  }

  /// ຊ່າງເຂົ້າໜ້າງານຂອງໃບນີ້ແລ້ວບໍ — ຍັງຢູ່ (`canCheckOut`) ຫຼື ໄປມາແລ້ວ (`hasCheckedIn`).
  /// ໃຊ້ຄຸມປຸ່ມ "ນັດຮອບຕໍ່ໄປ" ໃຫ້ຕົງກັບດ່ານຂອງ server (ຕ້ອງມີຢ່າງໜ້ອຍ 1 ຮອບ).
  bool get _visitedThisJob => job.canCheckOut || job.hasCheckedIn;

  /// ໜ່ວຍທີ່ຍັງບໍ່ທັນເກັບ — ຂໍ້ຄວາມສັ້ນໆໃສ່ປຸ່ມ/ຄຳອະທິບາຍ
  String _missingUnit() {
    if (!job.needOutdoor) return '';
    final indoor = (job.expectSn ?? '').isNotEmpty;
    final outdoor = (job.expectSnOut ?? '').isNotEmpty;
    if (!indoor && !outdoor) return '(ໜ່ວຍໃນ + ໜ່ວຍນອກ)';
    if (!indoor) return '(ຍັງຂາດ ໜ່ວຍໃນ)';
    if (!outdoor) return '(ຍັງຂາດ ໜ່ວຍນອກ)';
    return '';
  }

  /// ເລກທີ່ໃບງານມີຢູ່ແລ້ວຂອງໜ່ວຍນັ້ນ — '' = ຍັງຫວ່າງ ('-' ຂອງເກົ່ານັບເປັນຫວ່າງ)
  String _kept(String? value) {
    final text = (value ?? '').trim();
    return text.isEmpty || text == '-' || text.toUpperCase() == 'N/A' ? '' : text;
  }

  /*
    ── ປຸ່ມເກັບ ISN/SN ຂອງເຄື່ອງທີ່ຕິດຈິງ (ໃຊ້ 2 ບ່ອນ: ບັດໜ້າງານ ແລະ ກ່ອງຈົບງານ) ──
    ໃບງານເປີດມາ**ຫວ່າງ** ⇒ ຊ່າງຢູ່ໜ້າງານຍິງ/ພິມຈາກປ້າຍຕົວຈິງ ⇒ server ບັນທຶກໃສ່
    ໃບງານ (pro_sn / pro_sn_out) ພ້ອມ**ເກັບປະຫວັດການອັບເດດ** ໄວ້ໃຫ້.
    ຍິງແລ້ວ**ລົງເລີຍ ບໍ່ໄປທຽບກັບຫຍັງ** (08-08-2026) ⇒ ໄດ້ຄຳຕອບທັນທີ ບໍ່ຄາ ERP.
    ແອ = 2 ໜ່ວຍ (ໃນ+ນອກ) ຄົນລະເລກ ⇒ ຕ້ອງເກັບໃຫ້ຄົບກ່ອນຈົບງານ.
  */
  Widget _serialCollector() {
    final indoor = _kept(job.expectSn);
    final outdoor = _kept(job.expectSnOut);
    final done = job.scanDone;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            foregroundColor: done ? ok : teal,
            side: BorderSide(color: done ? ok : teal),
          ),
          // ຕ້ອງ check-in ກ່ອນ — ເລກນີ້ຄືຫຼັກຖານວ່າຢູ່ຕໍ່ໜ້າເຄື່ອງຈິງ
          // (ດ່ານຈິງຢູ່ server: /api/mobile/jobs … action 'scan')
          onPressed: busy || !job.canCheckOut ? null : _scanNow,
          icon: Icon(
            done ? Icons.check_circle_outline : Icons.qr_code_scanner_rounded,
            size: 18,
          ),
          label: Text(
            done
                ? 'ເກັບ ISN/SN ຄົບແລ້ວ — ເບິ່ງ/ແກ້ໄດ້'
                : 'ເກັບ ISN/SN ${_missingUnit()} (ຍິງ ຫຼື ພິມເອງ)',
          ),
        ),
        if (!job.canCheckOut) ...[
          const SizedBox(height: 6),
          const Text(
            'ຕ້ອງ check-in ໜ້າງານກ່ອນ ຈຶ່ງອ່ານ ISN/SN ໄດ້',
            style: TextStyle(color: muted, fontSize: 11.5),
          ),
        ] else ...[
          const SizedBox(height: 6),
          // ເກັບແລ້ວອັນໃດ — ຊ່າງກວດຕາເອງໄດ້ ວ່າລົງຖືກໜ່ວຍບໍ ກ່ອນຈົບງານ
          Text(
            [
              job.needOutdoor
                  ? 'ໜ່ວຍໃນ: ${indoor.isEmpty ? "— ຍັງບໍ່ໄດ້ເກັບ" : indoor}'
                  : 'ເລກເຄື່ອງ: ${indoor.isEmpty ? "— ຍັງບໍ່ໄດ້ເກັບ" : indoor}',
              if (job.needOutdoor)
                'ໜ່ວຍນອກ: ${outdoor.isEmpty ? "— ຍັງບໍ່ໄດ້ເກັບ" : outdoor}',
            ].join('\n'),
            style: const TextStyle(color: muted, fontSize: 11.5, height: 1.5),
          ),
          const Text(
            'ບໍ່ຈຳເປັນຕ້ອງຕົງກັບໃບງານ — ເອົາຕາມປ້າຍເຄື່ອງທີ່ຕິດຈິງ (ລະບົບເກັບປະຫວັດການແກ້ໄວ້ໃຫ້)',
            style: TextStyle(color: faint, fontSize: 11),
          ),
        ],
      ],
    );
  }

  /// ເປີດໜ້າອ່ານ ISN/SN (ກ້ອງ ຫຼື ພິມເອງ) ແລ້ວຄືນຄ່າດິບ (null = ຍົກເລີກ)
  Future<SerialInput?> _scanSerial(String title) async {
    // ເກັບແລ້ວອັນໃດ (ໃຫ້ຊ່າງຮູ້ວ່າກຳລັງເກັບໜ່ວຍໃດຢູ່) — ຫວ່າງໝົດ = ຍັງບໍ່ໄດ້ເກັບຫຍັງ
    final expect = [
      if ((job.expectSn ?? '').isNotEmpty && job.expectSn != '-') 'ໜ່ວຍໃນ ${job.expectSn}',
      if ((job.expectSnOut ?? '').isNotEmpty && job.expectSnOut != '-') 'ໜ່ວຍນອກ ${job.expectSnOut}',
    ].join(' · ');
    return Navigator.push<SerialInput>(
      context,
      MaterialPageRoute(
        builder: (_) => ScanSerialScreen(title: title, hint: expect.isEmpty ? null : expect),
      ),
    );
  }

  /// ແອ = 2 ໜ່ວຍຄົນລະເລກ ⇒ **ຖາມກ່ອນວ່າກຳລັງເກັບໜ່ວຍໃດ**.
  ///
  /// ແຕ່ກ່ອນ server ເດົາເອງຈາກໃບຈ່າຍຂອງບິນ — ບິນທີ່ບໍ່ໄດ້ລົງ ISN (ຫຼາຍ) ເດົາບໍ່ໄດ້
  /// ⇒ ລົງຊ່ອງທຳອິດທີ່ຫວ່າງ ⇒ ຊ່າງຍິງໜ່ວຍນອກກ່ອນ ກໍ່ໄປລົງຊ່ອງໜ່ວຍໃນ. ຄົນທີ່ຢືນຢູ່
  /// ໜ້າເຄື່ອງຮູ້ດີກວ່າ ⇒ ໃຫ້ເລືອກເອງ 1 ຈັບ.
  ///
  /// ຄືນ: null = ຍົກເລີກ · '' = ບໍ່ຕ້ອງເລືອກ (ເຄື່ອງໜ່ວຍດຽວ) · 'indoor'/'outdoor'
  Future<String?> _pickUnit() async {
    if (!job.needOutdoor) return '';
    return showModalBottomSheet<String>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Text(
                'ກຳລັງເກັບເລກຂອງໜ່ວຍໃດ?',
                style: TextStyle(fontWeight: FontWeight.bold, color: ink),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.living_outlined, color: teal),
              title: const Text('ໜ່ວຍໃນ (ຄອຍລ໌ເຢັນ)'),
              subtitle: Text(
                _kept(job.expectSn).isEmpty ? 'ຍັງບໍ່ໄດ້ເກັບ' : 'ດຽວນີ້: ${_kept(job.expectSn)}',
              ),
              onTap: () => Navigator.pop(sheet, 'indoor'),
            ),
            ListTile(
              leading: const Icon(Icons.ac_unit_outlined, color: teal),
              title: const Text('ໜ່ວຍນອກ (ຄອມເພຣສເຊີ)'),
              subtitle: Text(
                _kept(job.expectSnOut).isEmpty ? 'ຍັງບໍ່ໄດ້ເກັບ' : 'ດຽວນີ້: ${_kept(job.expectSnOut)}',
              ),
              onTap: () => Navigator.pop(sheet, 'outdoor'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  /// ອ່ານ ISN/SN **ຕອນກຳລັງຕິດຕັ້ງ** — ບໍ່ຕ້ອງຕົງກັບໃບງານ, server ບັນທຶກໃສ່ໃບງານ
  /// ພ້ອມເກັບປະຫວັດການອັບເດດໄວ້ (ບໍ່ຕົງກັບບິນ ⇒ ຮັບໄວ້ ພ້ອມຄຳເຕືອນ)
  Future<void> _scanNow() async {
    final unit = await _pickUnit();
    if (unit == null || !mounted) return;
    final input = await _scanSerial(
      unit == 'outdoor'
          ? 'ເກັບ ISN/SN — ໜ່ວຍນອກ'
          : unit == 'indoor'
              ? 'ເກັບ ISN/SN — ໜ່ວຍໃນ'
              : 'ເກັບ ISN/SN ຂອງເຄື່ອງ',
    );
    if (input == null || !mounted) return;
    await run({
      'action': 'scan',
      'scan': input.value,
      'scan_manual': input.manual,
      if (unit.isNotEmpty) 'unit': unit,
    });
  }

  /// ປ້າຍສະຖານະຂອງຮອບ — ຄຳດຽວກັບຝັ່ງເວັບ (ລໍສາງເບີກ · ເບີກແລ້ວລໍຮັບ · ຮັບແລ້ວ · ສັ່ງຊື້)
  Widget _stateChip(SpareWithdrawRound round) {
    final (String label, Color color) = round.status == 'purchasing'
        ? ('ກຳລັງສັ່ງຊື້', warn)
        : round.dispatches.isEmpty
        ? ('ລໍສາງເບີກ', warn)
        : round.waitingPickup.isNotEmpty
        ? ('ລໍຮັບ ${round.waitingPickup.length} ໃບ', warn)
        : ('ຮັບຄົບແລ້ວ', ok);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }

  /// ກົດຮັບ **ໃບເບີກໃບໜຶ່ງ** — ຮັບຄົບທຸກໃບແລ້ວ server ຈຶ່ງດັນງານໄປຂັ້ນຕໍ່ໄປ
  Future<void> _receiveDoc(String docNo) async {
    setState(() => busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final message = await Api.pickupSpares(docNo);
      messenger.showSnackBar(SnackBar(content: Text(message)));
    } on ApiError catch (failure) {
      messenger.showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: danger),
      );
    } finally {
      if (mounted) setState(() => busy = false);
      await reload();
    }
  }

  Widget _button(String label, Color color, VoidCallback? onPressed) {
    return FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: color,
        minimumSize: const Size.fromHeight(50),
      ),
      onPressed: busy ? null : onPressed,
      child: busy
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: onAccent,
              ),
            )
          : Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }
}

/// ເສັ້ນປະແບ່ງສ່ວນ — ຄືເສັ້ນສີກຂອງໃບງານ (ສະຕາຍດຽວກັບບັດຢູ່ໜ້າລາຍການ)
class _JobDashed extends StatelessWidget {
  const _JobDashed();
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (_, size) {
      const dash = 5.0, gap = 4.0;
      final count = (size.maxWidth / (dash + gap)).floor().clamp(1, 200);
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(
          count,
          (_) => Container(width: dash, height: 1.1, color: line),
        ),
      );
    },
  );
}

/// ຫົວຂັ້ນຕອນ ①② — ບອກລຳດັບວ່າຕ້ອງເຮັດຫຍັງກ່ອນ-ຫຼັງ
class _StepLabel extends StatelessWidget {
  const _StepLabel({
    required this.step,
    required this.text,
    this.hint,
    this.hintColor = faint,
  });
  final String step;
  final String text;
  final String? hint;
  final Color hintColor;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: tealTint,
          shape: BoxShape.circle,
        ),
        child: Text(
          step,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: teal,
          ),
        ),
      ),
      const SizedBox(width: 8),
      Text(
        text,
        style: const TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 13,
          color: ink,
        ),
      ),
      if (hint != null) ...[
        const Spacer(),
        Text(
          hint!,
          style: TextStyle(
            fontSize: 11,
            color: hintColor,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ],
  );
}

/// ແຖວຂໍ້ຄວາມໃນ chatter — log ຂອງລະບົບຈາງກວ່າ, ຂໍ້ຄວາມຄົນພິມເນັ້ນກວ່າ
class _MessageRow extends StatelessWidget {
  const _MessageRow({required this.message});
  final ChatterMessage message;

  @override
  Widget build(BuildContext context) {
    final log = message.isLog;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: log ? const Color(0xFFCBD5E1) : teal,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message.body,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    color: log ? muted : ink,
                    fontWeight: log ? FontWeight.w400 : FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${message.author} · ${message.createdAt}',
                  style: const TextStyle(fontSize: 11.5, color: faint),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// ກິດຈະກຳທີ່ນັດໄວ້ — ສີບອກກຳນົດ (ແດງ=ເລີຍ, ເຫຼືອງ=ມື້ນີ້, ຂຽວ=ຍັງມີເວລາ) ຄືເວັບ
class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.activity, required this.onDone});
  final JobActivity activity;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final color = activity.late
        ? danger
        : activity.today
        ? warn
        : ok;
    final due = activity.late
        ? 'ເລີຍກຳນົດ ${-activity.daysLeft} ມື້'
        : activity.today
        ? 'ຮອດກຳນົດມື້ນີ້'
        : 'ອີກ ${activity.daysLeft} ມື້';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.summary,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: ink,
                  ),
                ),
                Text(
                  '$due · ${activity.dueDate}',
                  style: TextStyle(fontSize: 11.5, color: color),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onDone,
            style: TextButton.styleFrom(
              foregroundColor: teal,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(0, 34),
            ),
            child: const Text('ເຮັດແລ້ວ', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      // v4: flat — ຂອບແທນເງົາ (ໜ້ານີ້ມີຫຼາຍກາດ ⇒ ປະຢັດ GPU ເຄື່ອງເກົ່າ)
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(kCardRadius),
        border: Border.all(color: line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }
}
