import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ໜ້າ **ເລືອກອາໄຫຼ່** (ແຍກຈາກໜ້າກວດເຊັກ) — ຄົ້ນ/ແຕະເພີ່ມ · AI ແນະນຳ · ຖອດອອກ.
/// ໃຊ້ draft ດຽວກັນກັບໜ້າກວດ (Api.draft / Api.check add_spare|remove_spare) ⇒ ກັບໄປແລ້ວ
/// ໜ້າກວດໂຫຼດ draft ຄືນເອງ. ກົດ "ສຳເລັດ" ເພື່ອກັບ.
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
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
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
      if (mounted) setState(() => results = items);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            inlineBack: true,
            title: 'ລະບຸອາໄຫຼ່ · ${widget.code}',
            onBack: () => Navigator.pop(context),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
              children: [
                // ── ໝາຍເຫດ: ຊ່າງພຽງ "ລະບຸ" ອາໄຫຼ່ — admin ເປັນຄົນຂໍເບີກ/ສັ່ງ ──
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, size: 17, color: Color(0xFF2563EB)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'ລະບຸອາໄຫຼ່ທີ່ຕ້ອງໃຊ້ເທົ່ານັ້ນ — admin ຈະຂໍເບີກ/ສັ່ງໃຫ້',
                          style: TextStyle(fontSize: 12.5, color: Color(0xFF1E40AF), fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // ── AI ແນະນຳ ──
                if (suggestions.any((s) => !draft.any((d) => d.itemCode == s.code)))
                  AiAssistCard(
                    title: 'AI ແນະນຳອາໄຫຼ່',
                    body: const Text('ອີງຈາກวຽກຮຸ່ນเดียวกัน — ແຕະเพื่อเพิ่ม'),
                    chips: [
                      for (final s in suggestions.where((s) => !draft.any((d) => d.itemCode == s.code)))
                        AiChip(
                          label: s.name.length > 20 ? '${s.name.substring(0, 20)}…' : s.name,
                          confidence: s.confidence,
                          onTap: busy
                              ? null
                              : () => send({
                                  'action': 'add_spare',
                                  'item': {'code': s.code, 'name_1': s.name, 'unit_code': s.unitCode},
                                  'qty': 1,
                                }),
                        ),
                    ],
                  ),
                const SizedBox(height: 10),

                // ── ອາໄຫຼ່ທີ່ເລືອກ ──
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: cardDecoration(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SectionLabel('ອາໄຫຼ່ທີ່ເລືອກ (${draft.length})'),
                      if (draft.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 4),
                          child: Text('ຄົ້ນຫາ ແລ້ວແຕະ + ເພື່ອເພີ່ມ', style: TextStyle(fontSize: 12, color: faint)),
                        ),
                      ...draft.map(
                        (line) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          title: Text('${line.itemName} × ${line.qty.toStringAsFixed(0)}'),
                          trailing: TextButton(
                            onPressed: busy ? null : () => send({'action': 'remove_spare', 'roworder': line.roworder}),
                            child: const Text('ຖອດ', style: TextStyle(color: danger)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: term,
                              onSubmitted: (_) => search(),
                              decoration: const InputDecoration(hintText: 'ຄົ້ນຫາອາໄຫຼ່...', isDense: true),
                            ),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            style: FilledButton.styleFrom(minimumSize: const Size(64, 48)),
                            onPressed: busy ? null : search,
                            child: const Text('ຄົ້ນ'),
                          ),
                        ],
                      ),
                      ...results.map(
                        (item) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(item.name, style: const TextStyle(fontSize: 14)),
                          subtitle: Text('${item.code} · ຄົງເຫຼືອ ${item.balance}', style: const TextStyle(fontSize: 12, color: muted)),
                          trailing: const Icon(Icons.add_circle, color: teal),
                          onTap: busy
                              ? null
                              : () => send({
                                  'action': 'add_spare',
                                  'item': {'code': item.code, 'name_1': item.name, 'unit_code': item.unitCode},
                                  'qty': 1,
                                }),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: teal, minimumSize: const Size.fromHeight(52)),
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.check_rounded),
                  label: Text('ສຳເລັດ — ເລືອກ ${draft.length} ລາຍການ'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
