import 'package:flutter/material.dart';

import '../api.dart';

/// **ຂໍສົ່ງຄືນອາໄຫຼ່ທີ່ບໍ່ໄດ້ໃຊ້** (ໃບ SRI).
///
/// ── ເປັນຫຍັງຕ້ອງມີໃນແອັບ ──
/// ເມື່ອກ່ອນເຮັດໄດ້ **ແຕ່ຢູ່ເວັບ** ⇒ ຊ່າງທີ່ຢູ່ໜ້າງານເຮັດບໍ່ໄດ້ ແລ້ວອາໄຫຼ່ທີ່ເບີກໄປ
/// ແຕ່ບໍ່ໄດ້ໃຊ້ **ຄ້າງຢູ່ນຳຊ່າງໂດຍບໍ່ມີເອກະສານ** (ຂໍ້ມູນຈິງ: ງານທີ່ຍົກເລີກແລ້ວມີອາໄຫຼ່
/// 36 ແຖວ ທີ່ບໍ່ເຄີຍມີໃບສົ່ງຄືນຈັກໃບ ⇒ ອາໄຫຼ່ຫາຍຈາກສາງ).
///
/// ສາງຈະ **ຮັບຄືນຢູ່ ERP** ແລ້ວລະບົບດຶງກັບມາເອງ (ນະໂຍບາຍ 13-07-2026).
class SpareReturnScreen extends StatefulWidget {
  const SpareReturnScreen({
    super.key,
    required this.workflow,
    required this.code,
  });

  final String workflow;
  final String code;

  @override
  State<SpareReturnScreen> createState() => _SpareReturnScreenState();
}

class _SpareReturnScreenState extends State<SpareReturnScreen> {
  List<OutstandingSpare> rows = [];
  final Set<String> picked = {};
  final remark = TextEditingController();
  bool loading = true;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    remark.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await Api.outstandingSpares(widget.workflow, widget.code);
      if (!mounted) return;
      setState(() {
        rows = list;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = '$e';
        loading = false;
      });
    }
  }

  Future<void> _submit() async {
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final items = rows
          .where((row) => picked.contains(row.itemCode))
          .map((row) => {'item_code': row.itemCode, 'qty': row.qty})
          .toList();
      final message = await Api.returnSpares(
        widget.workflow,
        widget.code,
        items,
        remark.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = '$e';
        saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('ສົ່ງຄືນອາໄຫຼ່ · ${widget.code}')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : rows.isEmpty
          ? const Center(child: Text('ບໍ່ມີອາໄຫຼ່ຄ້າງຢູ່ນຳທ່ານ'))
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    children: [
                      for (final row in rows)
                        CheckboxListTile(
                          value: picked.contains(row.itemCode),
                          onChanged: (checked) => setState(() {
                            if (checked == true) {
                              picked.add(row.itemCode);
                            } else {
                              picked.remove(row.itemCode);
                            }
                          }),
                          title: Text(row.itemName),
                          subtitle: Text(
                            '${row.itemCode} · ${row.qty.toStringAsFixed(0)} ${row.unitCode ?? ''} · ໃບເບີກ ${row.docNo}',
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: TextField(
                          controller: remark,
                          decoration: const InputDecoration(
                            labelText: 'ໝາຍເຫດ (ເຊັ່ນ: ບໍ່ໄດ້ໃຊ້, ຜິດລຸ້ນ)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      if (error != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            error!,
                            style: const TextStyle(color: Colors.red),
                          ),
                        ),
                    ],
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: picked.isEmpty || saving ? null : _submit,
                        icon: const Icon(Icons.assignment_return),
                        label: Text(
                          saving
                              ? 'ກຳລັງບັນທຶກ...'
                              : 'ຂໍສົ່ງຄືນ ${picked.length} ລາຍການ',
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
