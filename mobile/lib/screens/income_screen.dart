import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ລາຍຮັບຂອງຊ່າງ (ເດືອນນີ້) — ຕົວເລກທີ່ **ແຊ່ໄວ້ຕອນປິດງານ** (ods_service_payout)
/// ບໍ່ແມ່ນຄິດຄືນໃໝ່ ⇒ ອັດຕາປ່ຽນພາຍຫຼັງ ບໍ່ກະທົບເງິນຂອງງານທີ່ຈົບໄປແລ້ວ.
///
/// ຍັງບໍ່ໄດ້ເຊື່ອມຕົວຕົນ ODS↔ERP ⇒ ບອກຊັດ (ບໍ່ສະແດງ 0 ງຽບໆ ແລ້ວປ່ອຍໃຫ້ຊ່າງເຂົ້າໃຈຜິດ).
class IncomeScreen extends StatefulWidget {
  const IncomeScreen({super.key});

  @override
  State<IncomeScreen> createState() => _IncomeScreenState();
}

class _IncomeScreenState extends State<IncomeScreen> {
  Income? income;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final value = await Api.income();
      if (mounted) setState(() => income = value);
    } catch (caught) {
      if (mounted) setState(() => error = '$caught');
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = income;
    return Scaffold(
      appBar: AppBar(title: const Text('ລາຍຮັບຂອງຂ້ອຍ')),
      body: error.isNotEmpty
          ? Center(
              child: Text(error, style: const TextStyle(color: danger)),
            )
          : data == null
          ? const Center(child: CircularProgressIndicator())
          : !data.linked
          ? const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ເຊື່ອມກັບພະນັກງານ ERP',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFFB45309),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'ຄ່າຄອມຈະຍັງບໍ່ເຂົ້າບັນຊີທ່ານ — ກະລຸນາແຈ້ງຜູ້ຈັດການ',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: muted),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(12),
              children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: ink,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ລາຍຮັບເດືອນນີ້ (${data.jobs} ງານ)',
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        '${data.totalThb.toStringAsFixed(2)} ບາທ',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                ...data.rows.map(
                  (row) => ListTile(
                    tileColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    title: Text(
                      '${row['workflow'] == 'install' ? 'ຕິດຕັ້ງ' : 'ສ້ອມ'} · ${row['job_code']}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      '${row['role']} · ປິດງານ ${row['closed_at']}',
                      style: const TextStyle(color: muted, fontSize: 12),
                    ),
                    trailing: Text(
                      (row['pay_thb'] as num).toStringAsFixed(2),
                      style: const TextStyle(
                        color: ok,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
