import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ອອກໃບຂໍເບີກອາໄຫຼ່ — **ຊ່າງເປັນຄົນອອກເອງ** (ບໍ່ຜ່ານ CS).
///
/// ອາໄຫຼ່ທີ່ຂໍ = ອາໄຫຼ່ທີ່ເລືອກໄວ້ຕອນກວດເຊັກ ແລະ **ຍັງບໍ່ທັນຂໍ/ເບີກ** ເທົ່ານັ້ນ
/// (server ກອງໃຫ້) ⇒ ໃບທີສອງບໍ່ຂໍຂອງເກົ່າຄືນອີກ ແລ້ວສາງຕັດສະຕັອກສອງເທື່ອ.
/// ສາງ/ທີ່ເກັບ ດຶງມາຈາກລາຍການທີ່ອະນຸຍາດຢູ່ server (ບໍ່ຝັງໄວ້ໃນແອັບ).
class SpareRequestScreen extends StatefulWidget {
  const SpareRequestScreen({super.key, required this.code});
  final String code;

  @override
  State<SpareRequestScreen> createState() => _SpareRequestScreenState();
}

class _SpareRequestScreenState extends State<SpareRequestScreen> {
  Lookups? lookups;
  String? wh;
  String? shelf;
  final remark = TextEditingController();
  bool busy = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final value = await Api.lookups();
      if (mounted) setState(() => lookups = value);
    } catch (caught) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$caught'), backgroundColor: danger),
      );
    }
  }

  Future<void> submit() async {
    setState(() => busy = true);
    try {
      final message = await Api.requestSpares(widget.code, wh!, shelf!, remark.text);
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
    final data = lookups;
    final shelves = data == null ? <Map<String, String>>[] : data.shelves.where((row) => row['wh_code'] == wh).toList();

    return Scaffold(
      appBar: AppBar(title: Text('ໃບຂໍເບີກອາໄຫຼ່ · ${widget.code}')),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                const Text('ສາງ', style: TextStyle(fontWeight: FontWeight.bold)),
                Wrap(
                  spacing: 8,
                  children: data.warehouses
                      .map((row) => ChoiceChip(
                            label: Text(row['name']!),
                            selected: wh == row['code'],
                            onSelected: (_) => setState(() {
                              wh = row['code'];
                              shelf = null;
                            }),
                          ))
                      .toList(),
                ),
                if (wh != null) ...[
                  const SizedBox(height: 12),
                  const Text('ທີ່ເກັບ', style: TextStyle(fontWeight: FontWeight.bold)),
                  Wrap(
                    spacing: 8,
                    children: shelves
                        .map((row) => ChoiceChip(
                              label: Text(row['name']!),
                              selected: shelf == row['code'],
                              onSelected: (_) => setState(() => shelf = row['code']),
                            ))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 12),
                TextField(
                  controller: remark,
                  decoration: const InputDecoration(
                    labelText: 'ໝາຍເຫດ (ບໍ່ບັງຄັບ)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: teal, minimumSize: const Size.fromHeight(52)),
                  onPressed: (wh == null || shelf == null || busy) ? null : submit,
                  child: busy
                      ? const SizedBox(
                          height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('ອອກໃບຂໍເບີກ', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
    );
  }
}
