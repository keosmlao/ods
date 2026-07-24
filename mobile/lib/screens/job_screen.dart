import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'check_screen.dart';
import 'pickup_screen.dart';
import 'repair_spare_screen.dart';
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
  final note = TextEditingController();
  final reason = TextEditingController();
  final photos = <String>[];
  bool busy = false;
  bool rejecting = false;

  /// ຈຳນວນອາໄຫຼ່ທີ່ **ເບີກມາແລ້ວ ຍັງບໍ່ໄດ້ສົ່ງຄືນ** — ປຸ່ມ "ສົ່ງຄືນ" ຂຶ້ນສະເພາະເມື່ອ > 0
  int outstandingSpares = 0;

  /// ຮູບເກົ່າຂອງງານ (ຮັບເຄື່ອງ · ກວດເຊັກ · ສ້ອມສຳເລັດ) — ໂຫຼດຈາກ server
  JobPhotos? gallery;

  /// ການເຄື່ອນໄຫວ (ຂໍ້ຄວາມ/log + ກິດຈະກຳ) — ຊຸດດຽວກັບ chatter ຢູ່ເວັບ
  JobChatter? chatter;
  String chatterError = '';
  final chatInput = TextEditingController();
  bool sending = false;

  final picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    loadOutstanding();
    loadGallery();
    loadChatter();
  }

  /// ໂຫຼດຮູບເກົ່າຂອງງານ — ລົ້ມກໍ່ບໍ່ເປັນຫຍັງ (ພຽງບໍ່ສະແດງ)
  Future<void> loadGallery() async {
    try {
      final sets = await Api.jobPhotos(job.workflow, job.code);
      if (mounted) setState(() => gallery = sets);
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

  /// ໂຫຼດຈຳນວນອາໄຫຼ່ຄ້າງນຳຊ່າງ — ລົ້ມກໍ່ບໍ່ເປັນຫຍັງ (ພຽງເຊື່ອງປຸ່ມ)
  Future<void> loadOutstanding() async {
    try {
      final rows = await Api.outstandingSpares(job.workflow, job.code);
      if (mounted) setState(() => outstandingSpares = rows.length);
    } catch (_) {
      // ບໍ່ໃຫ້ລົ້ມໜ້າງານ
    }
  }

  @override
  void dispose() {
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
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
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
  Future<String?> shoot() async {
    final shot = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 50,
      maxWidth: 1280,
    );
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
    return Geolocator.getCurrentPosition();
  }

  Future<void> checkIn() async {
    final point = await coordinates();
    if (point == null) return;
    final photo = await shoot();
    if (photo == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ຕ້ອງຖ່າຍຮູບໜ້າງານກ່ອນ check-in')),
        );
      }
      return;
    }
    await run({
      'action': 'checkin',
      'lat': point.latitude,
      'lng': point.longitude,
      'photo': photo,
    });
  }

  Future<void> checkOut() async {
    final point = await coordinates();
    await run({
      'action': 'checkout',
      if (point != null) 'lat': point.latitude,
      if (point != null) 'lng': point.longitude,
    });
  }

  /// IH ສ້ອມໜ້າງານບໍ່ໄດ້ ⇒ ນຳເຄື່ອງເຂົ້າສູນ (ແປງເປັນ PS). ຕ້ອງໃສ່ເຫດຜົນ.
  Future<void> bringIn() async {
    reason.clear();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('ສ້ອມໜ້າງານບໍ່ໄດ້ — ນຳເຂົ້າສູນ?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'ເຄື່ອງຈະຖືກນຳເຂົ້າສູນ (ແປງເປັນ PS) ແລ້ວ CS ຮັບເຂົ້າສູນ. ໃສ່ເຫດຜົນໃຫ້ຊ່າງສູນ/CS ເຫັນ:',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 8),
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
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('ຍົກເລີກ'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('ນຳເຂົ້າສູນ'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (reason.text.trim().isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ຕ້ອງໃສ່ເຫດຜົນກ່ອນ')),
        );
      }
      return;
    }
    await run({'action': 'bring-in', 'reason': reason.text.trim()});
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

  @override
  Widget build(BuildContext context) {
    // ບຳລຸງຮັກສາບໍ່ໄດ້ເກັບຮູບຜົນງານ (server ບໍ່ຮັບ) ⇒ ຢ່າບັງຄັບ ບໍ່ດັ່ງນັ້ນຊ່າງກົດຈົບບໍ່ໄດ້
    final evidenceRequired = job.workflow != 'maintenance' &&
        (job.workflow == 'install' || job.onsite) &&
        photos.isEmpty;

    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title:
                '${job.workflow == 'install'
                    ? 'ຕິດຕັ້ງ'
                    : job.workflow == 'maintenance'
                    ? 'ລ້າງແອ'
                    : 'ສ້ອມແປງ'} · ${job.code}',
            onBack: () => Navigator.pop(context),
          ),
          Expanded(
            child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _WorkflowProgress(job: job),
          const SizedBox(height: 12),
          _Card(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      job.stageLabel,
                      style: const TextStyle(
                        color: teal,
                        fontWeight: FontWeight.bold,
                      ),
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
              const SizedBox(height: 8),
              _row('ລູກຄ້າ', job.customer),
              _row('ສິນຄ້າ', job.product),
              if ((job.detail ?? '').trim().isNotEmpty)
                _row('ຍີ່ຫໍ້/ລຸ້ນ', job.detail),
              if ((job.sn ?? '').trim().isNotEmpty) _row('SN', job.sn),
              if (job.workflow == 'repair' && (job.serviceType ?? '').isNotEmpty)
                _row('ປະເພດ', _serviceLabel(job.serviceType)),
              if ((job.warranty ?? '').trim().isNotEmpty)
                _row('ຮັບປະກັນ', job.warranty),
              _row('ບ່ອນຢູ່', job.address),
              _row('ວັນນັດ', job.appointment),
              // ຮັບເຄື່ອງເມື່ອໃດ · ໃຊ້ເວລາລວມມາເທົ່າໃດ · ໃຜເປັນຄົນຮັບ
              _row('ຮັບເຄື່ອງ', job.receivedAt),
              _row('ເວລາທີ່ໃຊ້', job.totalLabel),
              _row('ຜູ້ຮັບ', job.receiver),
              // ນຳທາງ — ສະເພາະ **ສ້ອມນອກສະຖານທີ່** (onsite); ງານນຳເຄື່ອງເຂົ້າສູນບໍ່ຕ້ອງ
              if (job.onsite &&
                  ((job.lat != null && job.lng != null) ||
                      (job.address ?? '').trim().isNotEmpty)) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.navigation_outlined, color: teal),
                  label: const Text(
                    'ນຳທາງໄປສະຖານທີ່ໜ້າງານ',
                    style: TextStyle(color: teal),
                  ),
                  onPressed: openMap,
                ),
              ],

              if ((job.tel ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.phone, color: ok),
                  label: Text(
                    'ໂທຫາລູກຄ້າ ${job.tel}',
                    style: const TextStyle(color: ok),
                  ),
                  onPressed: callCustomer,
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
                  icon: const Icon(Icons.assignment_return, color: muted),
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

          // ── ຜົນກວດເຊັກ (ສະເພາະສ້ອມ · ຂຶ້ນຫຼັງຊ່າງວິເຄາະ) ──
          if (job.workflow == 'repair' &&
              (job.diagnosis ?? '').trim().isNotEmpty) ...[
            _Card(
              children: [
                const Row(
                  children: [
                    Icon(Icons.fact_check_outlined, size: 18, color: teal),
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
            _Card(
              children: [
                if (gallery!.receive.isNotEmpty)
                  _photoRow('ຮູບຕອນຮັບເຄື່ອງ', Icons.inventory_2_outlined, gallery!.receive),
                if (gallery!.check.isNotEmpty)
                  _photoRow('ຮູບຕອນກວດເຊັກ', Icons.fact_check_outlined, gallery!.check),
                if (gallery!.finish.isNotEmpty)
                  _photoRow(
                    job.workflow == 'install' ? 'ຮູບຕິດຕັ້ງສຳເລັດ' : 'ຮູບສ້ອມສຳເລັດ',
                    Icons.verified_outlined,
                    gallery!.finish,
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],

          // ── ກິດຈະກຳທີ່ນັດໄວ້ (ຍັງບໍ່ເຮັດ) ──
          if ((chatter?.activities.isNotEmpty ?? false)) ...[
            _Card(
              children: [
                const Row(
                  children: [
                    Icon(Icons.event_available_outlined, size: 18, color: warn),
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
                  _ActivityRow(activity: activity, onDone: () => finishActivity(activity)),
              ],
            ),
            const SizedBox(height: 12),
          ],

          // ── ການເຄື່ອນໄຫວ (chatter) — ຊຸດດຽວກັບເວັບ ──
          _Card(
            children: [
              Row(
                children: [
                  const Icon(Icons.forum_outlined, size: 18, color: teal),
                  const SizedBox(width: 8),
                  const Text(
                    'ການເຄື່ອນໄຫວ',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: ink,
                      fontSize: 14,
                    ),
                  ),
                  const Spacer(),
                  if (chatter != null)
                    Text(
                      '${chatter!.messages.length}',
                      style: const TextStyle(color: faint, fontSize: 12),
                    ),
                ],
              ),
              const SizedBox(height: 10),

              // ພິມສົ່ງຫາ CS/ຫົວໜ້າ
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: chatInput,
                      minLines: 1,
                      maxLines: 3,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => sendMessage(),
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: 'ພິມຂໍ້ຄວາມເຖິງ CS / ຫົວໜ້າ...',
                        hintStyle: const TextStyle(fontSize: 13, color: faint),
                        filled: true,
                        fillColor: surfaceAlt,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: teal,
                      minimumSize: const Size(48, 44),
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: sending ? null : sendMessage,
                    child: sending
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 18),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if (chatterError.isNotEmpty)
                Row(
                  children: [
                    const Icon(Icons.cloud_off_rounded, size: 16, color: faint),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        'ໂຫຼດການເຄື່ອນໄຫວບໍ່ໄດ້ — $chatterError',
                        style: const TextStyle(fontSize: 11.5, color: muted),
                      ),
                    ),
                    TextButton(
                      onPressed: loadChatter,
                      style: TextButton.styleFrom(
                        foregroundColor: teal,
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                      child: const Text('ລອງໃໝ່', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                )
              else if (chatter == null)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Center(
                    child: SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else if (chatter!.messages.isEmpty)
                const Text(
                  'ຍັງບໍ່ມີການເຄື່ອນໄຫວ',
                  style: TextStyle(color: faint, fontSize: 12.5),
                )
              else
                for (final msg in chatter!.messages.take(30))
                  _MessageRow(message: msg),
            ],
          ),
          const SizedBox(height: 12),

          /* ── ຂັ້ນຕອນ — ປຸ່ມມາຈາກ server ── */
          _Card(
            children: [
              /*
                ── ລຳດັບຄວາມສຳຄັນ ──
                "ຮັບງານ" = ສິ່ງທີ່ຄວນເຮັດ ⇒ ປຸ່ມຖົມສີເຕັມ ເນັ້ນສຸດ.
                "ປະຕິເສດ" = ທາງເລືອກທີ່ນານໆເຮັດເທື່ອ ⇒ ເສັ້ນຂອບບາງໆ ບໍ່ຖົມສີ
                ບໍ່ດັ່ງນັ້ນສອງປຸ່ມແຍ້ງກັນ ແລະ ກົດຜິດງ່າຍ.
              */
              if (job.action == 'accept' && !rejecting) ...[
                Row(
                  children: [
                    const Icon(Icons.assignment_ind_outlined, size: 17, color: teal),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        job.accepted ? 'ວຽກນີ້ຮັບແລ້ວ' : 'ວຽກໃໝ່ — ຕ້ອງຮັບງານກ່ອນຈຶ່ງເລີ່ມໄດ້',
                        style: const TextStyle(fontSize: 12.5, color: muted),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // 2 ຖັນ: ຊ້າຍ = ຮັບງານ (ຫຼັກ) · ຂວາ = ປະຕິເສດ (ຮອງ) — ສູງເທົ່າກັນ
                Row(
                  children: [
                    Expanded(
                      child: _primaryAction(
                        'ຮັບງານ',
                        Icons.check_circle_outline_rounded,
                        teal,
                        () => run({'action': 'accept'}),
                        height: 52,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _ghostAction(
                        'ປະຕິເສດ',
                        Icons.close_rounded,
                        danger,
                        () => setState(() => rejecting = true),
                        height: 52,
                      ),
                    ),
                  ],
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
                    hintText: 'ຕິດງານອື່ນ, ຢູ່ໄກ, ບໍ່ຖະນັດງານນີ້...',
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

              // ງານສ້ອມຂັ້ນ 1-2 = ກວດເຊັກ (ບໍ່ແມ່ນ "ເລີ່ມສ້ອມ" ຂອງຂັ້ນ 8)
              // ⚠️ ຕ້ອງ **ຮັບງານກ່ອນ** ຈຶ່ງກວດເຊັກໄດ້ (job.accepted) — ບໍ່ໃຫ້ຂ້າມ "ຮັບງານ"
              if (job.workflow == 'repair' &&
                  job.accepted &&
                  (job.stage == 1 || job.stage == 2))
                _button(
                  job.stage == 1 && job.onsite && !job.hasCheckedIn
                      ? 'ຕ້ອງ check-in ກ່ອນກວດເຊັກ'
                      : job.stage == 1
                      ? 'ເລີ່ມກວດເຊັກ'
                      : 'ບັນທຶກຜົນກວດເຊັກ',
                  job.stage == 1 && job.onsite && !job.hasCheckedIn
                      ? muted
                      : teal,
                  job.stage == 1 && job.onsite && !job.hasCheckedIn
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(context);
                          final navigator = Navigator.of(context);
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
                          await navigator.push(
                            MaterialPageRoute(
                              builder: (_) => CheckScreen(code: job.code),
                            ),
                          );
                          if (mounted) await reload();
                        },
                ),

              // IH ໜ້າງານ ສ້ອມບໍ່ໄດ້ ⇒ ນຳເຂົ້າສູນ (ແປງເປັນ PS) — ມີແຕ່ຕອນກຳລັງກວດ (ຂັ້ນ 1/2)
              if (job.workflow == 'repair' &&
                  job.accepted &&
                  job.serviceType == 'IH' &&
                  (job.stage == 1 || job.stage == 2)) ...[
                const SizedBox(height: 8),
                _button(
                  'ສ້ອມໜ້າງານບໍ່ໄດ້ — ນຳເຂົ້າສູນ',
                  const Color(0xFFB45309),
                  bringIn,
                ),
              ],

              if (job.action == 'start')
                _button(
                  job.onsite && !job.hasCheckedIn
                      ? 'ຕ້ອງ check-in ກ່ອນເລີ່ມງານ'
                      : job.workflow == 'install'
                      ? 'ເລີ່ມຕິດຕັ້ງ'
                      : 'ເລີ່ມສ້ອມແປງ',
                  job.onsite && !job.hasCheckedIn ? muted : teal,
                  job.onsite && !job.hasCheckedIn
                      ? null
                      : () => run({'action': 'start'}),
                ),

              // ຂັ້ນ 9 ກຳລັງສ້ອມ (ສະເພາະສ້ອມ): ພົບຕ້ອງໃຊ້ອາໄຫຼ່ເພີ່ມ/ປ່ຽນ ⇒ ຂໍເບີກເພີ່ມ
              // ── ຂັ້ນ 9 ກຳລັງສ້ອມ: ພົບຕ້ອງໃຊ້ອາໄຫຼ່ເພີ່ມ/ປ່ຽນ ⇒ ຂໍເບີກເພີ່ມ ──
              if (job.workflow == 'repair' && job.stage == 9) ...[
                _ghostAction(
                  'ຂໍເບີກ / ປ່ຽນ ອາໄຫຼ່',
                  Icons.inventory_2_outlined,
                  const Color(0xFF7C3AED),
                  () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => RepairSpareScreen(code: job.code)),
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
                    const Icon(Icons.assignment_turned_in_outlined, size: 18, color: ok),
                    const SizedBox(width: 8),
                    Text(
                      job.workflow == 'install' ? 'ຈົບງານຕິດຕັ້ງ' : 'ຈົບງານສ້ອມ',
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
                  const _StepLabel(step: '1', text: 'ບັນທຶກວິທີແກ້ໄຂ'),
                  const SizedBox(height: 7),
                  TextField(
                    controller: note,
                    maxLines: 3,
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'ປ່ຽນອາໄຫຼ່ຫຍັງ · ແກ້ແນວໃດ...',
                      hintStyle: const TextStyle(fontSize: 12.5, color: faint),
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
                                        base64Decode(photos[i].split(',').last),
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
                              child: Image.memory(
                                base64Decode(photos[i].split(',').last),
                                width: 78,
                                height: 78,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          Positioned(
                            right: -6,
                            top: -6,
                            child: IconButton(
                              icon: const Icon(Icons.cancel, size: 20, color: danger),
                              onPressed: busy
                                  ? null
                                  : () => setState(() => photos.removeAt(i)),
                            ),
                          ),
                        ],
                      ),
                    InkWell(
                      onTap: busy
                          ? null
                          : () async {
                              final photo = await shoot();
                              if (photo != null) setState(() => photos.add(photo));
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
                        child: const Icon(Icons.add_a_photo_outlined, color: teal),
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
                        Icon(Icons.error_outline, size: 15, color: faint),
                        SizedBox(width: 6),
                        Text(
                          'ຕ້ອງແນບຮູບຜົນງານກ່ອນຈຶ່ງບັນທຶກໄດ້',
                          style: TextStyle(fontSize: 12, color: faint),
                        ),
                      ],
                    ),
                  ),
                _primaryAction(
                  'ບັນທຶກສຳເລັດ — ສົ່ງກວດ QC',
                  Icons.check_circle_outline_rounded,
                  ok,
                  evidenceRequired
                      ? null
                      : () => run({
                          'action': 'finish',
                          'note': note.text,
                          'photos': photos,
                        }),
                ),
              ],

              if (job.action == 'wait_spare') ...[
                if ((job.workflow == 'repair' && job.stage == 5) ||
                    (job.workflow == 'install' && job.stage == 1)) ...[
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
                  const Text(
                    'ລໍສາງເບີກອາໄຫຼ່ — ຍັງລົງມືບໍ່ໄດ້',
                    style: TextStyle(color: muted),
                  ),
                  const SizedBox(height: 8),
                  _button('ໄປໜ້າ ຮັບອາໄຫຼ່', const Color(0xFF334155), () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const PickupScreen()),
                    );
                    if (mounted) await reload();
                  }),
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

          /* ── check-in ໜ້າງານ (ສະເພາະວຽກນອກສະຖານທີ່) ── */
          if (job.onsite) ...[
            const SizedBox(height: 12),
            _Card(
              children: [
                const Text(
                  'ໜ້າງານ',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                job.canCheckOut
                    ? _button(
                        'check-out (ອອກຈາກໜ້າງານ)',
                        const Color(0xFF334155),
                        checkOut,
                      )
                    : !job.accepted
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
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
                          _button('ຍັງ check-in ບໍ່ໄດ້', muted, null),
                        ],
                      )
                    : job.canCheckIn
                    ? _button('check-in ໜ້າງານ (ພິກັດ + ຮູບ)', ink, checkIn)
                    : const Text(
                        'ຂັ້ນປັດຈຸບັນບໍ່ສາມາດ check-in ໄດ້',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: muted),
                      ),
              ],
            ),
          ],
        ],
      ),
          ),
        ],
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

  Widget _row(String label, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 78,
            child: Text(
              label,
              style: const TextStyle(color: muted, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
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
                          child: Image.memory(base64Decode(img.split(',').last)),
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
                  child: Image.memory(
                    base64Decode(img.split(',').last),
                    width: 76,
                    height: 76,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
      ],
    ),
  );

  /// ປຸ່ມ **ຫຼັກ** — ຖົມສີເຕັມ + ເງົາອ່ອນ ⇒ ຕາໄປຫາກ່ອນ
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
      foregroundColor: Colors.white,
      minimumSize: Size.fromHeight(height),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      elevation: 2,
      shadowColor: color.withValues(alpha: .45),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    icon: busy
        ? const SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
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
      backgroundColor: Colors.white,
      minimumSize: Size.fromHeight(height),
      padding: const EdgeInsets.symmetric(horizontal: 10),
      side: BorderSide(color: color.withValues(alpha: .35)),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    icon: Icon(icon, size: 18),
    label: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
    ),
  );

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
                color: Colors.white,
              ),
            )
          : Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }
}

class _WorkflowProgress extends StatelessWidget {
  const _WorkflowProgress({required this.job});
  final Job job;

  @override
  Widget build(BuildContext context) {
    final started = job.workflow == 'install' ? job.stage >= 5 : job.stage >= 2;
    final finished = job.workflow == 'install'
        ? job.stage >= 6
        : job.stage >= 10;
    final steps = job.onsite
        ? [
            ('ຮັບງານ', job.accepted),
            ('ເຖິງໜ້າງານ', job.hasCheckedIn),
            ('ລົງມື', started),
            ('ສຳເລັດ', finished),
            ('ອອກໜ້າງານ', job.hasCheckedOut),
          ]
        : [('ຮັບງານ', job.accepted), ('ລົງມື', started), ('ສຳເລັດ', finished)];

    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: const Color(0xFF0F2F2B),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ຄວາມຄືບໜ້າວຽກ',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 13),
          Row(
            children: List.generate(steps.length, (index) {
              final step = steps[index];
              final done = step.$2;
              return Expanded(
                child: Column(
                  children: [
                    Row(
                      children: [
                        if (index > 0)
                          Expanded(
                            child: Container(
                              height: 2,
                              color: done ? teal : const Color(0xFF36534F),
                            ),
                          ),
                        Container(
                          width: 23,
                          height: 23,
                          decoration: BoxDecoration(
                            color: done ? teal : const Color(0xFF36534F),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            done ? Icons.check_rounded : Icons.circle,
                            size: done ? 15 : 7,
                            color: done
                                ? Colors.white
                                : const Color(0xFF89A7A2),
                          ),
                        ),
                        if (index < steps.length - 1)
                          Expanded(
                            child: Container(
                              height: 2,
                              color: steps[index + 1].$2
                                  ? teal
                                  : const Color(0xFF36534F),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      step.$1,
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: done ? Colors.white : const Color(0xFF9BB4B0),
                        fontSize: 8,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
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
        width: 19,
        height: 19,
        alignment: Alignment.center,
        decoration: const BoxDecoration(color: tealTint, shape: BoxShape.circle),
        child: Text(
          step,
          style: const TextStyle(
            fontSize: 11,
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
          style: TextStyle(fontSize: 11, color: hintColor, fontWeight: FontWeight.w600),
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
                  style: const TextStyle(fontSize: 10.5, color: faint),
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
    final color = activity.late ? danger : activity.today ? warn : ok;
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
                  style: TextStyle(fontSize: 10.5, color: color),
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }
}
