import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../streak.dart';

/// **ຈໍສະຫຼອງຕອນຈົບງານ** — ຂຶ້ນຫຼັງ server ຮັບ "ຈົບງານ" ສຳເລັດ.
///
/// ── ເປັນຫຍັງຕ້ອງມີ ──
/// ແຕ່ກ່ອນກົດຈົບງານແລ້ວໄດ້ພຽງແຖບຂໍ້ຄວາມນ້ອຍໆທີ່ຫາຍໄປໃນ 3 ວິ — ວຽກທັງມື້ຈົບລົງ
/// ແບບບໍ່ມີຈຸດສິ້ນສຸດທີ່ຮູ້ສຶກໄດ້. ຈໍນີ້ບອກ **ຜົນເປັນຕົວເລກ** ທັນທີ: ໃບເດືອນນີ້ ·
/// ຄ່າຄອມ · ມື້ຕິດ. ຕົວເລກທັງໝົດມາຈາກ `Api.income()` ຊຸດດຽວກັບໜ້າລາຍຮັບ.
///
/// ⚠️ ບໍ່ໃຊ້ particle/confetti — ຂະຫຍາຍວົງກົມ + ຈາງ ເທົ່ານັ້ນ (ເຄື່ອງລຸ້ນເກົ່າຕ້ອງລື່ນ).
class FinishedScreen extends StatefulWidget {
  const FinishedScreen({super.key, required this.jobCode, required this.workflow});

  final String jobCode;
  final String workflow;

  @override
  State<FinishedScreen> createState() => _FinishedScreenState();
}

class _FinishedScreenState extends State<FinishedScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pop = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  )..forward();

  Income? income;

  @override
  void initState() {
    super.initState();
    // ຕົວເລກໂຫຼດຊ້າກວ່າຈໍ ⇒ ຈໍຂຶ້ນກ່ອນ ແລ້ວຄ່ອຍເຕີມ (ບໍ່ໃຫ້ລໍຈໍຂາວ)
    Api.income().then((value) {
      if (mounted) setState(() => income = value);
    }).catchError((_) => null);
  }

  @override
  void dispose() {
    _pop.dispose();
    super.dispose();
  }

  int get _streak => streakDays(
        (income?.rows ?? const [])
            .map((row) => parseClosedAt(row['closed_at'] as String?))
            .whereType<DateTime>(),
      );

  @override
  Widget build(BuildContext context) {
    final money = income;
    return Scaffold(
      backgroundColor: ground,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 10, 22, 20),
          child: Column(
            children: [
              const Spacer(),
              ScaleTransition(
                scale: CurvedAnimation(parent: _pop, curve: Curves.easeOutBack),
                child: Container(
                  width: 128,
                  height: 128,
                  decoration: BoxDecoration(color: tealTint, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: const Text('🎉', style: TextStyle(fontSize: 56)),
                ),
              ),
              const SizedBox(height: 22),
              const Text(
                'ຈົບງານແລ້ວ!',
                style: TextStyle(fontSize: 27, fontWeight: FontWeight.w900, color: ink),
              ),
              const SizedBox(height: 6),
              Text(
                '${widget.jobCode} · ສົ່ງໃຫ້ QC ກວດແລ້ວ',
                style: const TextStyle(color: muted, fontSize: 13.5),
              ),
              const SizedBox(height: 26),
              Row(
                children: [
                  _gain('+1', 'ໃບເດືອນນີ້ (${money?.jobs ?? '-'})'),
                  const SizedBox(width: 10),
                  _gain(_thb(money?.totalThb), 'ຄ່າຄອມເດືອນນີ້ (ບາທ)'),
                  const SizedBox(width: 10),
                  _gain(_streak > 0 ? '🔥 $_streak' : '—', 'ມື້ຕິດ'),
                ],
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: kPrimaryTouch + 4,
                child: FilledButton.icon(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: const Text(
                    'ໄປວຽກຕໍ່ໄປ',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _gain(String value, String label) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 8),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: line),
      ),
      child: Column(
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: tealBright,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 10.5, color: faint, height: 1.3),
          ),
        ],
      ),
    ),
  );

  static String _thb(double? value) {
    if (value == null) return '—';
    final whole = value.round().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
      buffer.write(whole[i]);
    }
    return buffer.toString();
  }
}
