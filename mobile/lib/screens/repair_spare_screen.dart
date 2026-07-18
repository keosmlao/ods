import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import 'spare_request_screen.dart';

/// ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — ພົບຕ້ອງໃຊ້ອາໄຫຼ່ເພີ່ມ/ປ່ຽນ: ຄົ້ນ+ເພີ່ມ, ຖອດ, ແລ້ວ
/// "ໄປອອກໃບຂໍເບີກ" (ຮອບ 2). ແຖວທີ່ເບີກແລ້ວ (locked) ຖອດບໍ່ໄດ້ — ຢາກປ່ຽນໃຫ້ສົ່ງຄືນສາງກ່ອນ.
class RepairSpareScreen extends StatefulWidget {
  const RepairSpareScreen({super.key, required this.code});
  final String code;

  @override
  State<RepairSpareScreen> createState() => _RepairSpareScreenState();
}

class _RepairSpareScreenState extends State<RepairSpareScreen> {
  final term = TextEditingController();
  List<RepairSpareLine> lines = [];
  List<SpareItem> results = [];
  bool busy = false;
  bool loading = true;

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
      final rows = await Api.usedSpares(widget.code);
      if (mounted) setState(() => lines = rows);
    } catch (caught) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$caught'), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
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

  Future<void> run(Future<String> Function() call) async {
    setState(() => busy = true);
    try {
      final message = await call();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      await load();
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

  int get pending => lines.where((line) => !line.locked).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('ອາໄຫຼ່ຕອນສ້ອມ · ${widget.code}')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                Text('ອາໄຫຼ່ທີ່ໃຊ້ (${lines.length})', style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                if (lines.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text('ຍັງບໍ່ມີ — ຄົ້ນຫາ ແລະ ເພີ່ມຂ້າງລຸ່ມ', style: TextStyle(color: muted)),
                  ),
                ...lines.map(
                  (line) => Card(
                    margin: const EdgeInsets.only(bottom: 6),
                    child: ListTile(
                      title: Text(line.itemName, style: const TextStyle(fontSize: 14)),
                      subtitle: Text(
                        '${line.itemCode} · ${line.qty.toStringAsFixed(0)} ${line.unitCode ?? ''}'
                        '${line.locked ? ' · ເບີກແລ້ວ' : line.requested ? ' · ຂໍເບີກແລ້ວ' : ' · ຄ້າງເບີກ'}',
                        style: const TextStyle(fontSize: 12, color: muted),
                      ),
                      trailing: line.locked
                          ? const Icon(Icons.lock, size: 18, color: muted)
                          : IconButton(
                              icon: const Icon(Icons.delete_outline, color: danger),
                              onPressed: busy ? null : () => run(() => Api.removeUsedSpare(widget.code, line.roworder)),
                            ),
                    ),
                  ),
                ),

                const Divider(height: 24),
                const Text('ຄົ້ນຫາ ແລະ ເພີ່ມອາໄຫຼ່', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: term,
                        onSubmitted: (_) => search(),
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          hintText: 'ຊື່ ຫຼື ລະຫັດອາໄຫຼ່...',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: teal),
                      onPressed: busy ? null : search,
                      child: const Icon(Icons.search),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ...results.map(
                  (item) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.name, style: const TextStyle(fontSize: 13)),
                    subtitle: Text('${item.code} · ຄົງເຫຼືອ ${item.balance}', style: const TextStyle(fontSize: 11, color: muted)),
                    trailing: const Icon(Icons.add_circle_outline, color: teal),
                    onTap: busy ? null : () => run(() => Api.addUsedSpare(widget.code, item, 1)),
                  ),
                ),

                const SizedBox(height: 20),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: pending > 0 ? const Color(0xFFB45309) : muted,
                    minimumSize: const Size.fromHeight(52),
                  ),
                  icon: const Icon(Icons.inventory_2_outlined),
                  label: Text(
                    pending > 0 ? 'ໄປອອກໃບຂໍເບີກ ($pending)' : 'ບໍ່ມີອາໄຫຼ່ຄ້າງເບີກ',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  onPressed: pending > 0 && !busy
                      ? () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => SpareRequestScreen(code: widget.code)),
                          );
                          if (mounted) await load();
                        }
                      : null,
                ),
              ],
            ),
    );
  }
}
