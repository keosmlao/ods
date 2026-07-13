import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ຮັບອາໄຫຼ່ — ໃບທີ່ **ສາງເບີກອອກໃຫ້ແລ້ວ** ແຕ່ຊ່າງຍັງບໍ່ໄປຮັບ.
///
/// ຂະບວນການອາໄຫຼ່ = ຊ່າງ ↔ ສາງ ເທົ່ານັ້ນ (ບໍ່ຜ່ານ CS — ນະໂຍບາຍຂອງຜູ້ຈັດການ):
///   ຊ່າງອອກໃບຂໍເບີກ → ສາງເບີກອອກ (ຕັດສະຕັອກ ERP) → **ຊ່າງກົດຮັບ** (ໜ້ານີ້)
class PickupScreen extends StatefulWidget {
  const PickupScreen({super.key});

  @override
  State<PickupScreen> createState() => _PickupScreenState();
}

class _PickupScreenState extends State<PickupScreen> {
  List<PickupDoc> docs = [];
  bool loading = true;
  String busyDoc = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final rows = await Api.pickups();
      if (mounted) {
        setState(() {
          docs = rows;
          loading = false;
        });
      }
    } on ApiError catch (failure) {
      if (mounted) {
        setState(() => loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    }
  }

  Future<void> pickup(PickupDoc doc) async {
    setState(() => busyDoc = doc.docNo);
    try {
      final message = await Api.pickupSpares(doc.docNo);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message), backgroundColor: ok));
      await load();
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => busyDoc = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('ຮັບອາໄຫຼ່ (${docs.length})')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : docs.isEmpty
          ? const Center(
              child: Text('ບໍ່ມີອາໄຫຼ່ລໍຮັບ', style: TextStyle(color: muted)),
            )
          : RefreshIndicator(
              onRefresh: load,
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: docs.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final doc = docs[index];
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                doc.docNo,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: ink,
                                ),
                              ),
                              Text(
                                'ໃບຮັບເຄື່ອງ ${doc.jobCode} · ${doc.lines} ລາຍການ · ${doc.docDate}',
                                style: const TextStyle(
                                  color: muted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: teal),
                          onPressed: busyDoc == doc.docNo
                              ? null
                              : () => pickup(doc),
                          child: busyDoc == doc.docNo
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('ກົດຮັບ'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }
}
