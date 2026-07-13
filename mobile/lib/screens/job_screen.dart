import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../main.dart';
import 'check_screen.dart';
import 'pickup_screen.dart';
import 'spare_request_screen.dart';

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

  final picker = ImagePicker();

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
    await run({
      'action': 'checkin',
      'lat': point.latitude,
      'lng': point.longitude,
      if (photo != null) 'photo': photo,
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

  @override
  Widget build(BuildContext context) {
    final installWithoutPhoto = job.workflow == 'install' && photos.isEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          '${job.workflow == 'install' ? 'ຕິດຕັ້ງ' : 'ສ້ອມແປງ'} · ${job.code}',
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _Card(
            children: [
              Text(
                job.stageLabel,
                style: const TextStyle(
                  color: teal,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              _row('ລູກຄ້າ', job.customer),
              _row(
                'ສິນຄ້າ',
                [
                  job.product,
                  job.detail,
                ].where((x) => (x ?? '').isNotEmpty).join(' · '),
              ),
              _row('ບ່ອນຢູ່', job.address),
              _row('ວັນນັດ', job.appointment),
              // ມີພິກັດ ⇒ ນຳທາງໄປຈຸດທີ່ CS ປັກໝຸດໄວ້ (ບໍ່ຕ້ອງໂທຖາມທາງ)
            if (job.lat != null && job.lng != null) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                icon: const Icon(Icons.navigation_outlined, color: teal),
                label: const Text('ນຳທາງໄປສະຖານທີ່ຕິດຕັ້ງ', style: TextStyle(color: teal)),
                onPressed: () => launchUrl(
                  Uri.parse(
                    'https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}',
                  ),
                  mode: LaunchMode.externalApplication,
                ),
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
                  onPressed: () => launchUrl(Uri.parse('tel:${job.tel}')),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),

          /* ── ຂັ້ນຕອນ — ປຸ່ມມາຈາກ server ── */
          _Card(
            children: [
              if (job.action == 'accept' && !rejecting) ...[
                _button('ຮັບງານ', teal, () => run({'action': 'accept'})),
                const SizedBox(height: 8),
                _button(
                  'ປະຕິເສດງານ',
                  danger,
                  () => setState(() => rejecting = true),
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
                const SizedBox(height: 8),
                _button(
                  'ຢືນຢັນການປະຕິເສດ',
                  danger,
                  () => run({
                    'action': 'reject',
                    'reason': reason.text,
                  }, pop: true),
                ),
                const SizedBox(height: 8),
                _button(
                  'ຍົກເລີກ',
                  muted,
                  () => setState(() => rejecting = false),
                ),
              ],

              // ງານສ້ອມຂັ້ນ 1-2 = ກວດເຊັກ (ບໍ່ແມ່ນ "ເລີ່ມສ້ອມ" ຂອງຂັ້ນ 8)
              if (job.workflow == 'repair' &&
                  (job.stage == 1 || job.stage == 2))
                _button(
                  job.stage == 1 ? 'ເລີ່ມກວດເຊັກ' : 'ບັນທຶກຜົນກວດເຊັກ',
                  teal,
                  () async {
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

              if (job.action == 'start')
                _button(
                  job.workflow == 'install' ? 'ເລີ່ມຕິດຕັ້ງ' : 'ເລີ່ມສ້ອມແປງ',
                  teal,
                  () => run({'action': 'start'}),
                ),

              if (job.action == 'finish') ...[
                if (job.workflow == 'repair') ...[
                  const Text(
                    'ບັນທຶກການສ້ອມ (ວິທີແກ້ໄຂ)',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: note,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                Text(
                  'ຮູບຜົນງານ ${photos.isNotEmpty
                      ? '(${photos.length} ຮູບ)'
                      : job.workflow == 'install'
                      ? '— ບັງຄັບຢ່າງໜ້ອຍ 1 ຮູບ'
                      : '(ບໍ່ບັງຄັບ)'}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                _button('ຖ່າຍຮູບຜົນງານ', const Color(0xFF334155), () async {
                  final photo = await shoot();
                  if (photo != null) setState(() => photos.add(photo));
                }),
                if (photos.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: photos
                        .asMap()
                        .entries
                        .map(
                          (entry) => GestureDetector(
                            onTap: () => showDialog<void>(
                              context: context,
                              builder: (_) => Dialog(
                                child: Stack(
                                  children: [
                                    InteractiveViewer(
                                      child: Image.memory(
                                        base64Decode(
                                          entry.value.split(',').last,
                                        ),
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
                            child: Stack(
                              children: [
                                Image.memory(
                                  base64Decode(entry.value.split(',').last),
                                  width: 72,
                                  height: 72,
                                  fit: BoxFit.cover,
                                ),
                                Positioned(
                                  right: 2,
                                  top: 2,
                                  child: InkWell(
                                    onTap: busy
                                        ? null
                                        : () => setState(
                                            () => photos.removeAt(entry.key),
                                          ),
                                    child: const CircleAvatar(
                                      radius: 11,
                                      backgroundColor: danger,
                                      child: Icon(
                                        Icons.close,
                                        size: 14,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
                const SizedBox(height: 8),
                _button(
                  installWithoutPhoto
                      ? 'ຕ້ອງແນບຮູບກ່ອນ'
                      : 'ບັນທຶກສຳເລັດ — ສົ່ງກວດ QC',
                  installWithoutPhoto ? muted : ok,
                  installWithoutPhoto
                      ? null
                      : () => run({
                          'action': 'finish',
                          'note': note.text,
                          'photos': photos,
                        }, pop: true),
                ),
              ],

              if (job.action == 'wait_spare') ...[
                if (job.workflow == 'repair' && job.stage == 5) ...[
                  const Text(
                    'ຕ້ອງອອກໃບຂໍເບີກອາໄຫຼ່ກ່ອນ',
                    style: TextStyle(color: muted),
                  ),
                  const SizedBox(height: 8),
                  _button('ອອກໃບຂໍເບີກອາໄຫຼ່', teal, () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SpareRequestScreen(code: job.code),
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
                job.checkedIn
                    ? _button(
                        'check-out (ອອກຈາກໜ້າງານ)',
                        const Color(0xFF334155),
                        checkOut,
                      )
                    : _button('check-in ໜ້າງານ (ພິກັດ + ຮູບ)', ink, checkIn),
              ],
            ),
          ],
        ],
      ),
    );
  }

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
