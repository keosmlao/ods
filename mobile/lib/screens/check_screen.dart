import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ກວດເຊັກ (ຝັ່ງສ້ອມ) — ຄືໜ້າ /checking/[code] ຂອງເວັບ.
///
/// ອາການທີ່ວິເຄາະ → (ຖ້າໃຊ້ອາໄຫຼ່) ເລືອກອາໄຫຼ່ຈາກສະຕັອກ → ຕັດສິນປະກັນ → ບັນທຶກ.
/// ຕັດສິນວ່າ **ໝົດຮັບປະກັນ ຕ້ອງມີເຫດຜົນ** (ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ — server ບັງຄັບ).
class CheckScreen extends StatefulWidget {
  const CheckScreen({super.key, required this.code});
  final String code;

  @override
  State<CheckScreen> createState() => _CheckScreenState();
}

class _CheckScreenState extends State<CheckScreen> {
  final diagnosis = TextEditingController();
  final reason = TextEditingController();
  final term = TextEditingController();

  List<DraftLine> draft = [];
  List<SpareItem> results = [];
  bool useSpare = false;
  bool warrantyVoid = false;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    diagnosis.addListener(_refreshValidation);
    reason.addListener(_refreshValidation);
    load();
  }

  void _refreshValidation() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    diagnosis.removeListener(_refreshValidation);
    reason.removeListener(_refreshValidation);
    diagnosis.dispose();
    reason.dispose();
    term.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final rows = await Api.draft(widget.code);
      if (mounted) setState(() => draft = rows);
    } on ApiError catch (failure) {
      if (mounted) _toast(failure.message, danger);
    }
  }

  void _toast(String message, Color color) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  Future<void> send(Map<String, dynamic> body, {bool pop = false}) async {
    setState(() => busy = true);
    try {
      final message = await Api.check(widget.code, body);
      if (!mounted) return;
      if (pop) {
        _toast(message, ok);
        Navigator.pop(context);
        return;
      }
      await load();
    } on ApiError catch (failure) {
      if (mounted) _toast(failure.message, danger);
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
      appBar: AppBar(title: Text('ກວດເຊັກ · ${widget.code}')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _card([
            const Text(
              'ອາການທີ່ຊ່າງວິເຄາະ',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: diagnosis,
              maxLines: 3,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'ອາການທີ່ພົບ...',
              ),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('ຕ້ອງໃຊ້ອາໄຫຼ່'),
              value: useSpare,
              onChanged: (value) => setState(() => useSpare = value),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('ໝົດຮັບປະກັນ (ຊ່າງຕັດສິນ)'),
              subtitle: const Text(
                'ຕ້ອງໃສ່ເຫດຜົນ — ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ',
                style: TextStyle(fontSize: 12, color: muted),
              ),
              value: warrantyVoid,
              onChanged: (value) => setState(() => warrantyVoid = value),
            ),
            if (warrantyVoid)
              TextField(
                controller: reason,
                maxLines: 2,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'ເຫດຜົນ...',
                ),
              ),
          ]),

          if (useSpare) ...[
            const SizedBox(height: 12),
            _card([
              Text(
                'ອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້ (${draft.length})',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              ...draft.map(
                (line) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(
                    '${line.itemName} × ${line.qty.toStringAsFixed(0)}',
                  ),
                  trailing: TextButton(
                    onPressed: busy
                        ? null
                        : () => send({
                            'action': 'remove_spare',
                            'roworder': line.roworder,
                          }),
                    child: const Text('ຖອດ', style: TextStyle(color: danger)),
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: term,
                      onSubmitted: (_) => search(),
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        hintText: 'ຄົ້ນຫາອາໄຫຼ່...',
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: teal),
                    onPressed: busy ? null : search,
                    child: const Text('ຄົ້ນ'),
                  ),
                ],
              ),
              ...results.map(
                (item) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(item.name, style: const TextStyle(fontSize: 14)),
                  subtitle: Text(
                    '${item.code} · ຄົງເຫຼືອ ${item.balance}',
                    style: const TextStyle(fontSize: 12, color: muted),
                  ),
                  trailing: const Icon(Icons.add_circle_outline, color: teal),
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
                ),
              ),
            ]),
          ],

          const SizedBox(height: 12),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: ok,
              minimumSize: const Size.fromHeight(52),
            ),
            onPressed:
                busy ||
                    diagnosis.text.trim().isEmpty ||
                    (warrantyVoid && reason.text.trim().isEmpty) ||
                    (useSpare && draft.isEmpty)
                ? null
                : () => send({
                    'action': 'save',
                    'diagnosis': diagnosis.text,
                    'warranty_void': warrantyVoid,
                    'warranty_reason': reason.text,
                    'use_spare': useSpare,
                  }, pop: true),
            child: busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text(
                    'ບັນທຶກຜົນກວດເຊັກ',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _card(List<Widget> children) => Container(
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
