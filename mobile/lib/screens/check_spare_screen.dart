import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ໜ້າ **ເລືອກອາໄຫຼ່** (ແຍກຈາກໜ້າກວດເຊັກ) — ຄົ້ນ/ແຕະເພີ່ມ · AI ແນະນຳ · ຖອດອອກ.
/// ໃຊ້ draft ດຽວກັນກັບໜ້າກວດ (Api.draft / Api.check add_spare|remove_spare) ⇒ ກັບໄປແລ້ວ
/// ໜ້າກວດໂຫຼດ draft ຄືນເອງ. ກົດ "ສຳເລັດ" ເພື່ອກັບ.
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
///   ① ອາໄຫຼ່ທີ່ເລືອກ ແລະ ຜົນຄົ້ນຫາ ເປັນ **ກາດ** ຄືກັບໜ້າອາໄຫຼ່ຕອນສ້ອມ (ໜ້າຕາລະບົບດຽວ)
///   ② ຜົນຄົ້ນຫາບອກ **ຄົງເຫຼືອ** ເປັນສີ (0 = ໝົດສາງ)
///   ③ ປຸ່ມ "ສຳເລັດ" ຢູ່ແຖບລຸ່ມຄົງທີ່ — ບໍ່ຕ້ອງເລື່ອນຜ່ານຜົນຄົ້ນຫາຍາວໆ ຈຶ່ງກັບໄດ້
///   ④ ຄົ້ນຫາຜິດພາດ/ບໍ່ພົບ = ບອກ (ແຕ່ກ່ອນງຽບ)
class CheckSpareScreen extends StatefulWidget {
  const CheckSpareScreen({super.key, required this.code});
  final String code;

  @override
  State<CheckSpareScreen> createState() => _CheckSpareScreenState();
}

class _CheckSpareScreenState extends State<CheckSpareScreen> {
  final term = TextEditingController();
  List<DraftLine> draft = [];
  List<SpareItem> results = [];
  List<SpareSuggestion> suggestions = [];
  bool busy = false;
  bool searched = false;

  @override
  void initState() {
    super.initState();
    load();
    loadSuggestions();
  }

  @override
  void dispose() {
    term.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final rows = await Api.draft(widget.code);
      if (mounted) setState(() => draft = rows);
    } on ApiError catch (failure) {
      _toast(failure.message, danger);
    }
  }

  Future<void> loadSuggestions() async {
    try {
      final rows = await Api.suggestSpares(widget.code);
      if (mounted) setState(() => suggestions = rows);
    } catch (_) {
      // AI ບໍ່ຂຶ້ນ ບໍ່ກະທົບ
    }
  }

  void _toast(String message, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  Future<void> send(Map<String, dynamic> body) async {
    setState(() => busy = true);
    try {
      await Api.check(widget.code, body);
      await load();
    } on ApiError catch (failure) {
      _toast(failure.message, danger);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> search() async {
    setState(() => busy = true);
    try {
      final items = await Api.searchSpares(term.text);
      if (mounted) {
        setState(() {
          results = items;
          searched = true;
        });
      }
    } on ApiError catch (failure) {
      _toast(failure.message, danger);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  static String _qty(double value) => value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) {
    final fresh = suggestions
        .where((s) => !draft.any((d) => d.itemCode == s.code))
        .toList();

    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            inlineBack: true,
            title: 'ລະບຸອາໄຫຼ່',
            onBack: () => Navigator.pop(context),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 20),
              children: [
                // ── ໝາຍເຫດ: ຊ່າງພຽງ "ລະບຸ" ອາໄຫຼ່ — admin ເປັນຄົນຂໍເບີກ/ສັ່ງ ──
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 17,
                        color: Color(0xFF2563EB),
                      ),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'ລະບຸອາໄຫຼ່ທີ່ຕ້ອງໃຊ້ເທົ່ານັ້ນ — admin ຈະຂໍເບີກ/ສັ່ງໃຫ້',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF1E40AF),
                            fontWeight: FontWeight.w600,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // ── AI ແນະນຳ ──
                if (fresh.isNotEmpty)
                  AiAssistCard(
                    title: 'AI ແນະນຳອາໄຫຼ່',
                    body: const Text('ອີງຈາກງານລຸ້ນດຽວກັນ — ແຕະເພື່ອເພີ່ມ'),
                    chips: [
                      for (final s in fresh)
                        AiChip(
                          label: s.name.length > 20
                              ? '${s.name.substring(0, 20)}…'
                              : s.name,
                          confidence: s.confidence,
                          onTap: busy
                              ? null
                              : () => send({
                                  'action': 'add_spare',
                                  'item': {
                                    'code': s.code,
                                    'name_1': s.name,
                                    'unit_code': s.unitCode,
                                  },
                                  'qty': 1,
                                }),
                        ),
                    ],
                  ),

                SectionLabel('ອາໄຫຼ່ທີ່ເລືອກ (${draft.length})'),
                if (draft.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    decoration: cardDecoration(),
                    child: const Column(
                      children: [
                        Icon(
                          Icons.inventory_2_outlined,
                          size: 24,
                          color: faint,
                        ),
                        SizedBox(height: 7),
                        Text(
                          'ຍັງບໍ່ໄດ້ເລືອກ — ຄົ້ນຫາຂ້າງລຸ່ມແລ້ວແຕະ +',
                          style: TextStyle(fontSize: 12.5, color: faint),
                        ),
                        SizedBox(height: 6),
                        // ຫາລະຫັດບໍ່ພົບ = ບໍ່ຕ້ອງຕິດຢູ່ໜ້ານີ້ (07-08-2026) — ຮູບໃຊ້ແທນໄດ້
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 18),
                          child: Text(
                            'ຫາລະຫັດບໍ່ພົບ? ບໍ່ຕ້ອງເລືອກກໍ່ໄດ້ — ກັບຄືນໄປ '
                            'ຖ່າຍຮູບອາໄຫຼ່ທີ່ຕ້ອງການ ແລ້ວ admin ຈະລະບຸ/ສັ່ງໃຫ້',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11.5, color: muted),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  for (final line in draft) _draftCard(line),

                const SizedBox(height: 18),
                const SectionLabel('ຄົ້ນຫາ ແລະ ເພີ່ມອາໄຫຼ່'),
                _searchBar(),
                const SizedBox(height: 10),
                if (busy && results.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (searched && results.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: cardDecoration(),
                    child: const Center(
                      child: Text(
                        'ບໍ່ພົບອາໄຫຼ່ທີ່ຄົ້ນ',
                        style: TextStyle(fontSize: 12.5, color: faint),
                      ),
                    ),
                  )
                else
                  for (final item in results) _resultCard(item),
              ],
            ),
          ),
          _bottomBar(),
        ],
      ),
    );
  }

  Widget _draftCard(DraftLine line) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Container(
      padding: const EdgeInsets.fromLTRB(13, 10, 8, 10),
      decoration: cardDecoration(),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.itemName ?? line.itemCode,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: ink,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${line.itemCode} · ຈຳນວນ ${_qty(line.qty)}',
                  style: const TextStyle(fontSize: 11, color: muted),
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: busy
                ? null
                : () => send({
                    'action': 'remove_spare',
                    'roworder': line.roworder,
                  }),
            style: TextButton.styleFrom(
              foregroundColor: danger,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: Size.zero,
            ),
            icon: const Icon(Icons.close_rounded, size: 16),
            label: const Text(
              'ຖອດ',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _searchBar() => Row(
    children: [
      Expanded(
        child: Container(
          height: 44,
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
                  onSubmitted: (_) => search(),
                  textInputAction: TextInputAction.search,
                  style: const TextStyle(fontSize: 13.5, color: ink),
                  decoration: const InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: 'ຊື່ ຫຼື ລະຫັດອາໄຫຼ່...',
                    hintStyle: TextStyle(fontSize: 13, color: faint),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(width: 8),
      SizedBox(
        height: 44,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: teal,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          onPressed: busy ? null : search,
          child: const Icon(Icons.search_rounded, size: 20),
        ),
      ),
    ],
  );

  Widget _resultCard(SpareItem item) {
    final out = item.balance <= 0;
    final added = draft.any((d) => d.itemCode == item.code);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: busy
            ? null
            : () => send({
                'action': 'add_spare',
                'item': {
                  'code': item.code,
                  'name_1': item.name,
                  'unit_code': item.unitCode,
                },
                'qty': 1,
              }),
        child: Container(
          padding: const EdgeInsets.fromLTRB(13, 11, 11, 11),
          decoration: cardDecoration(),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name.isEmpty ? item.code : item.name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: ink,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          item.code,
                          style: const TextStyle(fontSize: 11, color: faint),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          out ? 'ໝົດສາງ' : 'ຄົງເຫຼືອ ${item.balance}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: out ? danger : ok,
                          ),
                        ),
                        if (added) ...[
                          const SizedBox(width: 8),
                          const StageTag('ເລືອກແລ້ວ'),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: tealTint,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(Icons.add_rounded, size: 20, color: teal),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bottomBar() => Container(
    padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(top: BorderSide(color: line)),
    ),
    child: SafeArea(
      top: false,
      child: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: teal,
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(15),
            ),
          ),
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.check_rounded, size: 19),
          label: Text(
            draft.isEmpty
                ? 'ສຳເລັດ — ຍັງບໍ່ໄດ້ເລືອກ'
                : 'ສຳເລັດ — ເລືອກ ${draft.length} ລາຍການ',
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900),
          ),
        ),
      ),
    ),
  );
}
