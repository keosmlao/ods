import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../main.dart';

/// ກວດຮັບຄຸນນະພາບ (QC) — **ຫົວໜ້າຊ່າງ ແລະ CS** (ໃຜກວດໄດ້ ຜູ້ຈັດການກຳນົດຢູ່ ods_qc_role).
///
/// ຄົນເຮັດງານ **ກວດງານຂອງຕົນເອງບໍ່ໄດ້** — server ປະຕິເສດສະເໝີ ເຖິງຈະກົດຈາກແອັບ.
/// ຕົກຂໍ້ໃດຂໍ້ນຶ່ງ → ງານກັບໄປຫາຊ່າງພ້ອມເຫດຜົນ (ບໍ່ແມ່ນປະຄ້າງໄວ້).
class QcScreen extends StatefulWidget {
  const QcScreen({super.key});

  @override
  State<QcScreen> createState() => _QcScreenState();
}

class _QcScreenState extends State<QcScreen> {
  List<QcJob> jobs = [];
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final rows = await Api.qcQueue();
      if (mounted) setState(() { jobs = rows; loading = false; });
    } on ApiError catch (failure) {
      if (mounted) setState(() { error = failure.message; loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('ກວດຮັບຄຸນນະພາບ (${jobs.length})')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error.isNotEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(error,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFFB45309), fontWeight: FontWeight.bold)),
                  ),
                )
              : jobs.isEmpty
                  ? const Center(child: Text('ບໍ່ມີງານລໍກວດຮັບ', style: TextStyle(color: muted)))
                  : ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: jobs.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final job = jobs[index];
                        return ListTile(
                          tileColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          title: Text('${job.workflow == 'install' ? 'ຕິດຕັ້ງ' : 'ສ້ອມ'} · ${job.code}',
                              style: const TextStyle(fontWeight: FontWeight.w800, color: ink)),
                          subtitle: Text(
                            '${job.customer ?? '-'} · ${job.item ?? '-'}\nຊ່າງ ${job.worker ?? '-'} · ສຳເລັດ ${job.finishedAt ?? '-'}',
                            style: const TextStyle(color: muted, fontSize: 12),
                          ),
                          isThreeLine: true,
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => QcJobScreen(job: job)),
                          ).then((_) => load()),
                        );
                      },
                    ),
    );
  }
}

/// ຟອມກວດຂອງງານດຽວ — checklist + ຮູບຕໍ່ຂໍ້ + ຮູບຜົນງານທີ່ຊ່າງຖ່າຍໄວ້
class QcJobScreen extends StatefulWidget {
  const QcJobScreen({super.key, required this.job});
  final QcJob job;

  @override
  State<QcJobScreen> createState() => _QcJobScreenState();
}

class _QcJobScreenState extends State<QcJobScreen> {
  List<QcItem> items = [];
  List<String> photos = [];
  final signer = TextEditingController();
  bool loading = true;
  bool busy = false;
  final picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final detail = await Api.qcJob(widget.job.workflow, widget.job.code);
      if (!mounted) return;
      setState(() {
        items = detail.items;
        photos = detail.photos;
        loading = false;
      });
    } catch (caught) {
      if (!mounted) return;
      setState(() => loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$caught'), backgroundColor: danger),
      );
    }
  }

  Future<void> shoot(QcItem item) async {
    final shot = await picker.pickImage(source: ImageSource.camera, imageQuality: 50, maxWidth: 1280);
    if (shot == null) return;
    final bytes = await shot.readAsBytes();
    setState(() => item.photo = 'data:image/jpeg;base64,${base64Encode(bytes)}');
  }

  Future<void> submit() async {
    setState(() => busy = true);
    try {
      final message = await Api.saveQc(
        widget.job.workflow,
        widget.job.code,
        items
            .map((item) => {
                  'item_id': item.id,
                  'passed': item.passed == true,
                  'note': item.note,
                  'photo': item.photo,
                })
            .toList(),
        signer.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: ok));
      Navigator.pop(context);
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final answered = items.where((item) => item.passed != null).length;
    final failed = items.where((item) => item.passed == false).length;
    final missingPhoto = items.where((item) => item.requirePhoto && item.passed == true && item.photo.isEmpty);
    final ready = answered == items.length && items.isNotEmpty && missingPhoto.isEmpty;

    return Scaffold(
      appBar: AppBar(title: Text('QC · ${widget.job.code}')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                if (photos.isNotEmpty) ...[
                  Text('ຮູບຜົນງານຈາກຊ່າງ (${photos.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: ink)),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 96,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: photos.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 6),
                      itemBuilder: (_, index) => Image.memory(
                        base64Decode(photos[index].split(',').last),
                        width: 96, height: 96, fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                ...items.map((item) => Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: item.passed == false
                            ? const Color(0xFFFEF2F2)
                            : item.passed == true
                                ? const Color(0xFFF0FDF4)
                                : Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: item.passed == false
                              ? const Color(0xFFFCA5A5)
                              : item.passed == true
                                  ? const Color(0xFF6EE7B7)
                                  : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${item.name}${item.requirePhoto ? ' (ຕ້ອງມີຮູບ)' : ''}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: ink)),
                          const SizedBox(height: 8),
                          Row(children: [
                            ChoiceChip(
                              label: const Text('ຜ່ານ'),
                              selected: item.passed == true,
                              selectedColor: ok,
                              labelStyle: TextStyle(color: item.passed == true ? Colors.white : ink),
                              onSelected: (_) => setState(() => item.passed = true),
                            ),
                            const SizedBox(width: 8),
                            ChoiceChip(
                              label: const Text('ບໍ່ຜ່ານ'),
                              selected: item.passed == false,
                              selectedColor: danger,
                              labelStyle: TextStyle(color: item.passed == false ? Colors.white : ink),
                              onSelected: (_) => setState(() => item.passed = false),
                            ),
                            const Spacer(),
                            IconButton(
                              icon: const Icon(Icons.photo_camera_outlined),
                              onPressed: () => shoot(item),
                            ),
                          ]),
                          if (item.passed == false)
                            TextField(
                              onChanged: (value) => item.note = value,
                              decoration: const InputDecoration(
                                isDense: true,
                                border: OutlineInputBorder(),
                                hintText: 'ເຫດຜົນທີ່ບໍ່ຜ່ານ — ຊ່າງຈະເຫັນ',
                              ),
                            ),
                          if (item.photo.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Image.memory(base64Decode(item.photo.split(',').last),
                                width: 96, height: 96, fit: BoxFit.cover),
                          ],
                        ],
                      ),
                    )),

                if (failed == 0 && answered == items.length && items.isNotEmpty)
                  TextField(
                    controller: signer,
                    decoration: const InputDecoration(
                      labelText: 'ຜູ້ຮັບມອບງານ (ລູກຄ້າ)',
                      border: OutlineInputBorder(),
                    ),
                  ),

                const SizedBox(height: 12),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: failed > 0 ? danger : ok,
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: (!ready || busy) ? null : submit,
                  child: busy
                      ? const SizedBox(
                          height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(
                          failed > 0 ? 'ບໍ່ຜ່ານ $failed ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງ' : 'QC ຜ່ານ — ໄປຂັ້ນຕໍ່ໄປ',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
    );
  }
}
