import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ຮັບອາໄຫຼ່ — ໃບທີ່ **ສາງເບີກອອກໃຫ້ແລ້ວ** ແຕ່ຊ່າງຍັງບໍ່ໄປຮັບ.
///
/// ຂະບວນການອາໄຫຼ່ = ຊ່າງ ↔ ສາງ ເທົ່ານັ້ນ (ບໍ່ຜ່ານ CS — ນະໂຍບາຍຂອງຜູ້ຈັດການ):
///   ຊ່າງອອກໃບຂໍເບີກ → ສາງເບີກອອກ (ຕັດສະຕັອກ ERP) → **ຊ່າງກົດຮັບ** (ໜ້ານີ້)
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
/// ລຸ້ນກ່ອນເປັນລາຍການແປ ໆ ທຸກໃບໜ້າຕາຄືກັນ — ຊ່າງທີ່ມີ **103 ໃບຄ້າງ** ຫາໃບທີ່ຕ້ອງການ
/// ບໍ່ພົບ, ບໍ່ຮູ້ວ່າໃບໃດຄ້າງດົນ ແລະ ຕ້ອງກົດ "ຮັບ" 103 ເທື່ອ. ດຽວນີ້:
///   ① ຫົວຈໍບອກ 3 ຕົວເລກ (ໃບ · ລາຍການ · ຄ້າງດົນສຸດ) ⇒ ຮູ້ສະພາບກ່ອນເລື່ອນ
///   ② ຄົ້ນຫາ (ເລກໃບເບີກ / ເລກໃບງານ) + ກອງຕາມສາຍງານ
///   ③ ຈັດກຸ່ມຕາມ **ຄວາມຄ້າງ** ແລະ ໃບເກົ່າສຸດຂຶ້ນກ່ອນ ⇒ ຮັບໃບທີ່ຄ້າງດົນກ່ອນ
///   ④ **ເລືອກຫຼາຍໃບ ແລ້ວກົດຮັບເທື່ອດຽວ** (ບີບຍາວທີ່ກາດ ຫຼື ກົດ "ເລືອກ")
///   ⑤ ໂຫຼດບໍ່ສຳເລັດ = ກາດແດງ + ປຸ່ມລອງໃໝ່ (ແຕ່ກ່ອນ error ຫາຍໄປກັບ snackbar
///      ແລ້ວຈໍຫວ່າງ ຄືກັບ "ບໍ່ມີວຽກ" — ຊ່າງເຂົ້າໃຈຜິດ)
class PickupScreen extends StatefulWidget {
  const PickupScreen({super.key});

  @override
  State<PickupScreen> createState() => _PickupScreenState();
}

class _PickupScreenState extends State<PickupScreen> {
  final term = TextEditingController();

  List<PickupDoc> docs = [];
  bool loading = true;
  String? error;

  /// ໃບທີ່ກຳລັງກົດຮັບຢູ່ (ໃບດຽວ) — ວ່າງ = ບໍ່ມີ
  String busyDoc = '';

  /// ກອງສາຍງານ: '' = ທັງໝົດ · 'repair' · 'install'
  String flow = '';

  /// ໂໝດເລືອກຫຼາຍໃບ
  bool selecting = false;
  final Set<String> picked = {};

  /// ຄວາມຄືບໜ້າຕອນຮັບຫຼາຍໃບ (0 = ບໍ່ໄດ້ເຮັດຢູ່)
  int bulkTotal = 0;
  int bulkDone = 0;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    term.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final rows = await Api.pickups();
      if (!mounted) return;
      setState(() {
        docs = rows;
        loading = false;
        error = null;
        // ໃບທີ່ຮັບໄປແລ້ວຫາຍຈາກຄິວ ⇒ ລ້າງການເລືອກທີ່ຄ້າງ
        picked.removeWhere((doc) => !rows.any((row) => row.docNo == doc));
        if (picked.isEmpty) selecting = false;
      });
    } on ApiError catch (failure) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = failure.message;
      });
    }
  }

  /* ── ຄວາມຄ້າງ ─────────────────────────────────────────────────────
   * server ສົ່ງ doc_date ມາເປັນ 'DD-MM-YYYY' (ບໍ່ມີເວລາ) ⇒ ນັບເປັນ **ມື້**.
   * ອ່ານບໍ່ອອກ = null (ບໍ່ເດົາ ແລະ ບໍ່ໃຫ້ຕົກຫຼົ່ນ — ໄປຢູ່ກຸ່ມ "ບໍ່ຮູ້ວັນທີ").
   */
  static int? _days(PickupDoc doc) {
    final parts = doc.docDate.split('-');
    if (parts.length != 3) return null;
    final d = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final y = int.tryParse(parts[2]);
    if (d == null || m == null || y == null) return null;
    final now = DateTime.now();
    final diff = DateTime(
      now.year,
      now.month,
      now.day,
    ).difference(DateTime(y, m, d)).inDays;
    return diff < 0 ? 0 : diff;
  }

  static SlaTone _tone(int? days) => days == null
      ? SlaTone.ok
      : days >= 7
      ? SlaTone.late_
      : days >= 3
      ? SlaTone.soon
      : SlaTone.ok;

  /// 0 = ຄ້າງເກີນ 7 ມື້ · 1 = 3–6 ມື້ · 2 = ບໍ່ເກີນ 2 ມື້ · 3 = ບໍ່ຮູ້ວັນທີ
  static int _bucket(int? days) => days == null
      ? 3
      : days >= 7
      ? 0
      : days >= 3
      ? 1
      : 2;

  static const _bucketLabel = [
    'ຄ້າງເກີນ 7 ມື້ — ຮັບກ່ອນ',
    'ຄ້າງ 3–6 ມື້',
    'ໃໝ່ (ບໍ່ເກີນ 2 ມື້)',
    'ບໍ່ຮູ້ວັນທີ',
  ];

  /// ລາຍການທີ່ຜ່ານຕົວກອງ — ຄ້າງດົນສຸດຂຶ້ນກ່ອນ
  List<PickupDoc> get shown {
    final q = term.text.trim().toLowerCase();
    final list = docs.where((doc) {
      if (flow.isNotEmpty && doc.workflow != flow) return false;
      if (q.isEmpty) return true;
      return doc.docNo.toLowerCase().contains(q) ||
          doc.jobCode.toLowerCase().contains(q);
    }).toList();
    list.sort((a, b) {
      final byBucket = _bucket(_days(a)).compareTo(_bucket(_days(b)));
      if (byBucket != 0) return byBucket;
      return (_days(b) ?? -1).compareTo(_days(a) ?? -1);
    });
    return list;
  }

  int get repairCount => docs.where((d) => d.workflow != 'install').length;
  int get installCount => docs.where((d) => d.workflow == 'install').length;

  /* ── ການກົດຮັບ ─────────────────────────────────────────────────── */

  Future<void> pickupOne(PickupDoc doc) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => busyDoc = doc.docNo);
    try {
      final message = await Api.pickupSpares(doc.docNo);
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(message), backgroundColor: ok),
      );
      await load();
    } on ApiError catch (failure) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: danger),
      );
    } finally {
      if (mounted) setState(() => busyDoc = '');
    }
  }

  /// ຮັບຫຼາຍໃບ — ຍິງເທື່ອລະໃບຕາມ API ເດີມ (ບໍ່ມີ endpoint ຫຼາຍໃບ) ແລະ
  /// **ບອກຜົນຈິງທຸກໃບ**: ໃບໃດຜິດພາດຍັງຄ້າງຢູ່ຄິວ ບໍ່ຫາຍງຽບໆ.
  Future<void> pickupSelected() async {
    final targets = shown.where((d) => picked.contains(d.docNo)).toList();
    if (targets.isEmpty) return;

    final messenger = ScaffoldMessenger.of(context);
    final agreed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text(
          'ຢືນຢັນການຮັບອາໄຫຼ່',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: ink,
            fontSize: 17,
          ),
        ),
        content: Text(
          'ຈະກົດຮັບ ${targets.length} ໃບ '
          '(${targets.fold<int>(0, (sum, d) => sum + d.lines)} ລາຍການ).\n'
          'ກົດຮັບແລ້ວ ຖືວ່າອາໄຫຼ່ຢູ່ໃນມືຊ່າງແລ້ວ.',
          style: const TextStyle(color: muted, height: 1.5, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('ຍົກເລີກ', style: TextStyle(color: muted)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: teal),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text('ຮັບ ${targets.length} ໃບ'),
          ),
        ],
      ),
    );
    if (agreed != true || !mounted) return;

    setState(() {
      bulkTotal = targets.length;
      bulkDone = 0;
    });

    var done = 0;
    final failures = <String>[];
    for (final doc in targets) {
      try {
        await Api.pickupSpares(doc.docNo);
        done += 1;
      } on ApiError catch (failure) {
        failures.add('${doc.docNo}: ${failure.message}');
      }
      if (!mounted) return;
      setState(() => bulkDone += 1);
    }

    if (!mounted) return;
    setState(() {
      bulkTotal = 0;
      bulkDone = 0;
      selecting = false;
      picked.clear();
    });
    messenger.showSnackBar(
      SnackBar(
        backgroundColor: failures.isEmpty ? ok : warn,
        duration: Duration(seconds: failures.isEmpty ? 3 : 6),
        content: Text(
          failures.isEmpty
              ? 'ຮັບອາໄຫຼ່ສຳເລັດ $done ໃບ'
              : 'ສຳເລັດ $done ໃບ · ບໍ່ສຳເລັດ ${failures.length} ໃບ\n${failures.take(3).join('\n')}',
        ),
      ),
    );
    await load();
  }

  void toggle(PickupDoc doc) {
    setState(() {
      if (picked.contains(doc.docNo)) {
        picked.remove(doc.docNo);
        if (picked.isEmpty) selecting = false;
      } else {
        picked.add(doc.docNo);
        selecting = true;
      }
    });
  }

  /* ── ໜ້າຈໍ ─────────────────────────────────────────────────────── */

  @override
  Widget build(BuildContext context) {
    final list = shown;
    final oldest = docs
        .map(_days)
        .whereType<int>()
        .fold<int>(0, (a, b) => a > b ? a : b);
    final lines = docs.fold<int>(0, (sum, d) => sum + d.lines);

    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ຮັບອາໄຫຼ່',
            trailing: [
              HeroIconButton(
                icon: Icons.refresh_rounded,
                onTap: () {
                  setState(() => loading = true);
                  load();
                },
              ),
            ],
            stats: [
              HeroStat(
                value: '${docs.length}',
                label: 'ໃບລໍຮັບ',
                icon: Icons.receipt_long_rounded,
              ),
              HeroStat(
                value: '$lines',
                label: 'ລາຍການອາໄຫຼ່',
                icon: Icons.inventory_2_rounded,
              ),
              HeroStat(
                value: docs.isEmpty ? '-' : '$oldest',
                label: 'ຄ້າງດົນສຸດ (ມື້)',
                icon: Icons.schedule_rounded,
                color: oldest >= 7 ? const Color(0xFFFB7185) : null,
              ),
            ],
          ),
          if (!loading && error == null && docs.isNotEmpty) _controls(),
          Expanded(child: _body(list)),
          if (selecting && picked.isNotEmpty) _actionBar(),
        ],
      ),
    );
  }

  /// ຄົ້ນຫາ + ຊິບກອງ + ປຸ່ມເລືອກຫຼາຍໃບ
  Widget _controls() => Container(
    padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
    child: Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Container(
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: line),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded, size: 18, color: faint),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: term,
                        onChanged: (_) => setState(() {}),
                        style: const TextStyle(fontSize: 13.5, color: ink),
                        decoration: const InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          hintText: 'ຄົ້ນເລກໃບເບີກ ຫຼື ເລກໃບງານ',
                          hintStyle: TextStyle(fontSize: 13, color: faint),
                        ),
                      ),
                    ),
                    if (term.text.isNotEmpty)
                      InkWell(
                        onTap: () => setState(term.clear),
                        child: const Icon(
                          Icons.close_rounded,
                          size: 17,
                          color: faint,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            // ເປີດ/ປິດໂໝດເລືອກ — ບີບຍາວທີ່ກາດກໍ່ເປີດໄດ້ຄືກັນ
            InkWell(
              onTap: () => setState(() {
                selecting = !selecting;
                if (!selecting) picked.clear();
              }),
              borderRadius: BorderRadius.circular(14),
              child: Container(
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 13),
                decoration: BoxDecoration(
                  color: selecting ? ink : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: selecting ? ink : line),
                ),
                child: Row(
                  children: [
                    Icon(
                      selecting
                          ? Icons.close_rounded
                          : Icons.checklist_rtl_rounded,
                      size: 17,
                      color: selecting ? Colors.white : muted,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      selecting ? 'ອອກ' : 'ເລືອກ',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: selecting ? Colors.white : muted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 34,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              FilterPill(
                label: 'ທັງໝົດ',
                count: docs.length,
                selected: flow.isEmpty,
                onTap: () => setState(() => flow = ''),
              ),
              FilterPill(
                label: 'ສ້ອມແປງ',
                count: repairCount,
                selected: flow == 'repair',
                onTap: () => setState(() => flow = 'repair'),
              ),
              FilterPill(
                label: 'ຕິດຕັ້ງ',
                count: installCount,
                selected: flow == 'install',
                onTap: () => setState(() => flow = 'install'),
              ),
              if (selecting)
                Padding(
                  padding: const EdgeInsets.only(left: 2),
                  child: TextButton(
                    onPressed: () => setState(() {
                      final all = shown.map((d) => d.docNo).toSet();
                      if (picked.containsAll(all)) {
                        picked.clear();
                      } else {
                        picked.addAll(all);
                      }
                    }),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      minimumSize: Size.zero,
                    ),
                    child: Text(
                      picked.containsAll(shown.map((d) => d.docNo).toSet())
                          ? 'ບໍ່ເລືອກທັງໝົດ'
                          : 'ເລືອກທັງໝົດ',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: teal,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _body(List<PickupDoc> list) {
    if (loading) return const Center(child: CircularProgressIndicator());

    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: cardDecoration(border: const Color(0xFFFECDD3)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_rounded, size: 34, color: danger),
                const SizedBox(height: 10),
                const Text(
                  'ໂຫຼດຄິວອາໄຫຼ່ບໍ່ສຳເລັດ',
                  style: TextStyle(fontWeight: FontWeight.w800, color: ink),
                ),
                const SizedBox(height: 5),
                Text(
                  error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: muted,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: teal),
                  onPressed: () {
                    setState(() {
                      loading = true;
                      error = null;
                    });
                    load();
                  },
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('ລອງໃໝ່'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (docs.isEmpty) {
      return _empty('ບໍ່ມີອາໄຫຼ່ລໍຮັບ', 'ສາງເບີກອອກໃຫ້ເມື່ອໃດ ຈະຂຶ້ນຢູ່ນີ້');
    }
    if (list.isEmpty) {
      return _empty('ບໍ່ພົບໃບທີ່ຄົ້ນ', 'ລອງລ້າງຄຳຄົ້ນ ຫຼື ປ່ຽນຕົວກອງ');
    }

    // ແຖວປົນກັນ: String = ຫົວກຸ່ມ · PickupDoc = ກາດໃບເບີກ
    final rows = <Object>[];
    var bucket = -1;
    for (final doc in list) {
      final b = _bucket(_days(doc));
      if (b != bucket) {
        bucket = b;
        rows.add(_bucketLabel[b]);
      }
      rows.add(doc);
    }

    return RefreshIndicator(
      onRefresh: load,
      color: teal,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 20),
        itemCount: rows.length,
        itemBuilder: (context, index) {
          final row = rows[index];
          if (row is String) {
            return Padding(
              padding: EdgeInsets.only(
                top: index == 0 ? 4 : 16,
                bottom: 8,
                left: 2,
              ),
              child: Row(
                children: [
                  Text(
                    row,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: .2,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(child: Divider(color: line, height: 1)),
                ],
              ),
            );
          }
          return Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: _card(row as PickupDoc),
          );
        },
      ),
    );
  }

  Widget _empty(String title, String hint) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: const BoxDecoration(
            color: surfaceAlt,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.inventory_2_outlined, size: 28, color: faint),
        ),
        const SizedBox(height: 12),
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w800, color: ink),
        ),
        const SizedBox(height: 4),
        Text(hint, style: const TextStyle(fontSize: 12, color: faint)),
      ],
    ),
  );

  Widget _card(PickupDoc doc) {
    final install = doc.workflow == 'install';
    final days = _days(doc);
    final tone = _tone(days);
    final chosen = picked.contains(doc.docNo);
    final busy = busyDoc == doc.docNo;

    return InkWell(
      onTap: selecting ? () => toggle(doc) : null,
      onLongPress: () => toggle(doc),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
        decoration: cardDecoration(
          border: chosen ? teal : const Color(0xFFF1F5F9),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ໄອຄອນສາຍງານ / ຊ່ອງໝາຍຕອນເລືອກ
            GestureDetector(
              onTap: () => toggle(doc),
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: chosen
                      ? teal
                      : install
                      ? const Color(0xFFEFF6FF)
                      : tealTint,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  chosen
                      ? Icons.check_rounded
                      : install
                      ? Icons.home_repair_service_rounded
                      : Icons.build_rounded,
                  size: 20,
                  color: chosen
                      ? Colors.white
                      : install
                      ? const Color(0xFF2563EB)
                      : teal,
                ),
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          doc.jobCode,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: ink,
                            letterSpacing: -.2,
                          ),
                        ),
                      ),
                      StageTag(
                        install ? 'ຕິດຕັ້ງ' : 'ສ້ອມແປງ',
                        color: install ? const Color(0xFF2563EB) : teal,
                        bg: install ? const Color(0xFFEFF6FF) : tealTint,
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'ໃບເບີກ ${doc.docNo} · ${doc.docDate}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: muted),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      // ຮອບຂອງໃບຂໍເບີກ (SIO) ທີ່ເປັນຕົ້ນເຫດ — ງານດຽວກັນເບີກຫຼາຍຮອບ
                      // ຊ່າງໄດ້ຮູ້ວ່າໃບນີ້ແມ່ນຮອບໃດ (ສະເພາະສ້ອມ)
                      if (doc.round != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2FF),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'ຮອບ ${doc.round}',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF4338CA),
                            ),
                          ),
                        ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: surfaceAlt,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '${doc.lines} ລາຍການ',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            color: muted,
                          ),
                        ),
                      ),
                      SlaChip(
                        label: days == null ? 'ບໍ່ຮູ້ວັນທີ' : 'ຄ້າງ $days ມື້',
                        tone: tone,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 9),
            // ໂໝດເລືອກ = ບໍ່ມີປຸ່ມຮັບລາຍໃບ (ກັນກົດຜິດຂະນະເລືອກ)
            if (!selecting)
              SizedBox(
                width: 58,
                height: 36,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: teal,
                    minimumSize: const Size(58, 36),
                    maximumSize: const Size(58, 36),
                    padding: EdgeInsets.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: busy ? null : () => pickupOne(doc),
                  child: busy
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'ຮັບ',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// ແຖບລຸ່ມຕອນເລືອກຫຼາຍໃບ — ຕອນກຳລັງຮັບ ຈະກາຍເປັນແຖບຄວາມຄືບໜ້າ
  Widget _actionBar() {
    final running = bulkTotal > 0;
    final chosen = shown.where((d) => picked.contains(d.docNo)).toList();
    final lines = chosen.fold<int>(0, (sum, d) => sum + d.lines);

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: line)),
      ),
      child: SafeArea(
        top: false,
        child: running
            ? Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'ກຳລັງກົດຮັບ...',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: ink,
                        ),
                      ),
                      Text(
                        '$bulkDone / $bulkTotal',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: teal,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 9),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: bulkTotal == 0 ? null : bulkDone / bulkTotal,
                      minHeight: 6,
                      backgroundColor: surfaceAlt,
                      color: teal,
                    ),
                  ),
                ],
              )
            : Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ເລືອກ ${picked.length} ໃບ',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            color: ink,
                            fontSize: 15,
                          ),
                        ),
                        Text(
                          'ລວມ $lines ລາຍການ',
                          style: const TextStyle(fontSize: 11.5, color: muted),
                        ),
                      ],
                    ),
                  ),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: teal,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 14,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    onPressed: pickupSelected,
                    icon: const Icon(Icons.done_all_rounded, size: 18),
                    label: Text(
                      'ຮັບ ${picked.length} ໃບ',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
