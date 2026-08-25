import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ລາຍຮັບຂອງຊ່າງ (ເດືອນນີ້) — ຕົວເລກທີ່ **ແຊ່ໄວ້ຕອນປິດງານ** (ods_service_payout)
/// ບໍ່ແມ່ນຄິດຄືນໃໝ່ ⇒ ອັດຕາປ່ຽນພາຍຫຼັງ ບໍ່ກະທົບເງິນຂອງງານທີ່ຈົບໄປແລ້ວ.
///
/// ຍັງບໍ່ໄດ້ເຊື່ອມຕົວຕົນ ODS↔ERP ⇒ ບອກຊັດ (ບໍ່ສະແດງ 0 ງຽບໆ ແລ້ວປ່ອຍໃຫ້ຊ່າງເຂົ້າໃຈຜິດ).
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
///   ① ກາດຍອດບອກ **ແບ່ງຕາມສາຍງານ** (ສ້ອມ ↔ ຕິດຕັ້ງ) + ສະເລ່ຍຕໍ່ງານ — ແຕ່ກ່ອນມີແຕ່ຍອດລວມ
///   ② ຈັດກຸ່ມຕາມ **ວັນປິດງານ** ພ້ອມຍອດຕໍ່ວັນ ⇒ ຊ່າງທຽບກັບບັນທຶກຂອງຕົນໄດ້
///   ③ ບົດບາດສະແດງເປັນລາວ (`technician` → ຊ່າງ) ຄືກັບຝັ່ງເວັບ (lib/commission-roles)
///   ④ ດຶງລົງໂຫຼດຄືນ · ກອງຕາມສາຍງານ · ຍອດເປັນຫຼັກພັນມີເຄື່ອງໝາຍຈຸດ
///   ⑤ ໂຫຼດບໍ່ສຳເລັດ = ກາດ + ປຸ່ມລອງໃໝ່ (ແຕ່ກ່ອນເປັນຂໍ້ຄວາມແດງລອຍໆ ກົດຫຍັງບໍ່ໄດ້)
class IncomeScreen extends StatefulWidget {
  const IncomeScreen({super.key});

  @override
  State<IncomeScreen> createState() => _IncomeScreenState();
}

class _IncomeScreenState extends State<IncomeScreen> {
  Income? income;
  String error = '';
  String username = '';
  bool loading = true;

  /// ກອງສາຍງານ: '' = ທັງໝົດ · 'repair' · 'install'
  String flow = '';

  static const _months = [
    'ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ',
    'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ',
  ];

  /// ບົດບາດ → ລາວ (ຄ່າດຽວກັບ ROLE_LABEL ຂອງເວັບ — ods_service_payout.role)
  static const _roleLabel = {
    'supervisor': 'ຜູ້ຄຸມ',
    'team_lead': 'ຫົວໜ້າທີມ',
    'admin': 'ບໍລິການ',
    'technician': 'ຊ່າງ',
  };

  @override
  void initState() {
    super.initState();
    Api.savedUsername().then((value) {
      if (mounted) setState(() => username = value ?? '');
    });
    load();
  }

  Future<void> load() async {
    try {
      final value = await Api.income();
      if (!mounted) return;
      setState(() {
        income = value;
        error = '';
        loading = false;
      });
    } catch (caught) {
      if (!mounted) return;
      setState(() {
        error = caught is ApiError ? caught.message : '$caught';
        loading = false;
      });
    }
  }

  /// ຫຼັກພັນມີເຄື່ອງໝາຍຈຸດ + ທົດນິຍົມ 2 ຕຳແໜ່ງ (1234.5 → 1,234.50)
  static String money(double value) {
    final negative = value < 0;
    final parts = value.abs().toStringAsFixed(2).split('.');
    final digits = parts[0];
    final grouped = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) grouped.write(',');
      grouped.write(digits[i]);
    }
    return '${negative ? '-' : ''}$grouped.${parts[1]}';
  }

  static double _pay(Map<String, dynamic> row) =>
      (row['pay_thb'] as num?)?.toDouble() ?? 0;

  static bool _isInstall(Map<String, dynamic> row) =>
      row['workflow'] == 'install';

  List<Map<String, dynamic>> get shown {
    final rows = income?.rows ?? const <Map<String, dynamic>>[];
    if (flow.isEmpty) return rows;
    return rows
        .where((row) => _isInstall(row) == (flow == 'install'))
        .toList();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: ground,
    body: Column(
      children: [
        HeroHeader(
          title: 'ລາຍຮັບຂອງຂ້ອຍ',
          trailing: [
            HeroIconButton(
              icon: Icons.refresh_rounded,
              onTap: () {
                setState(() => loading = true);
                load();
              },
            ),
          ],
        ),
        Expanded(child: _body()),
      ],
    ),
  );

  Widget _body() {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error.isNotEmpty) return _errorCard();

    final data = income;
    if (data == null) return const Center(child: CircularProgressIndicator());
    if (!data.linked) return _notLinked();

    final rows = shown;
    final repairTotal = data.rows
        .where((row) => !_isInstall(row))
        .fold<double>(0, (sum, row) => sum + _pay(row));
    final installTotal = data.rows
        .where(_isInstall)
        .fold<double>(0, (sum, row) => sum + _pay(row));

    // ຈັດກຸ່ມຕາມວັນປິດງານ — server ຮຽງໃໝ່ສຸດກ່ອນຢູ່ແລ້ວ ⇒ ຮັກສາລຳດັບເດີມ
    final byDay = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      byDay.putIfAbsent(row['closed_at'] as String? ?? '-', () => []).add(row);
    }

    return RefreshIndicator(
      onRefresh: load,
      color: teal,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
        children: [
          _summary(data, repairTotal, installTotal),
          const SizedBox(height: 14),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                FilterPill(
                  label: 'ທັງໝົດ',
                  count: data.rows.length,
                  selected: flow.isEmpty,
                  onTap: () => setState(() => flow = ''),
                ),
                FilterPill(
                  label: 'ສ້ອມແປງ',
                  count: data.rows.where((r) => !_isInstall(r)).length,
                  selected: flow == 'repair',
                  onTap: () => setState(() => flow = 'repair'),
                ),
                FilterPill(
                  label: 'ຕິດຕັ້ງ',
                  count: data.rows.where(_isInstall).length,
                  selected: flow == 'install',
                  onTap: () => setState(() => flow = 'install'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 30),
              child: Column(
                children: [
                  Container(
                    width: 62,
                    height: 62,
                    decoration: const BoxDecoration(
                      color: surfaceAlt,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.savings_outlined,
                      size: 27,
                      color: faint,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    data.rows.isEmpty
                        ? 'ເດືອນນີ້ຍັງບໍ່ມີງານປິດ'
                        : 'ບໍ່ມີລາຍການໃນຕົວກອງນີ້',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'ຄ່າຄອມເຂົ້າຕອນປິດງານເທົ່ານັ້ນ',
                    style: TextStyle(fontSize: 12, color: faint),
                  ),
                ],
              ),
            )
          else
            for (final entry in byDay.entries) ...[
              _dayHeader(
                entry.key,
                entry.value.fold<double>(0, (sum, row) => sum + _pay(row)),
              ),
              for (final row in entry.value)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _row(row),
                ),
              const SizedBox(height: 6),
            ],
        ],
      ),
    );
  }

  /// ກາດຍອດ — ລວມ · ແບ່ງສາຍງານ · ສະເລ່ຍຕໍ່ງານ
  Widget _summary(Income data, double repairTotal, double installTotal) {
    final now = DateTime.now();
    final total = data.totalThb;
    final average = data.jobs == 0 ? 0.0 : total / data.jobs;
    final repairShare = total <= 0 ? 0.0 : repairTotal / total;

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      // v4: flat — ພື້ນ ink ລ້ວນ ບໍ່ມີ gradient/ເງົາ (ປະຢັດ GPU ເຄື່ອງເກົ່າ)
      decoration: BoxDecoration(
        color: hero1,
        borderRadius: BorderRadius.circular(kCardRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.payments_rounded, size: 15, color: onHeroDim),
              const SizedBox(width: 6),
              Text(
                'ລາຍຮັບເດືອນ ${_months[now.month - 1]} ${now.year}',
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: onHeroDim,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    money(total),
                    style: const TextStyle(
                      color: onAccent,
                      fontSize: 34,
                      height: 1.1,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -1,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                'ບາທ',
                style: TextStyle(
                  color: onHeroDim,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // ແຖບສັດສ່ວນ ສ້ອມ ↔ ຕິດຕັ້ງ
          if (total > 0) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Row(
                children: [
                  Expanded(
                    flex: (repairShare * 1000).round().clamp(0, 1000),
                    child: Container(height: 7, color: tealBright),
                  ),
                  Expanded(
                    flex: (1000 - (repairShare * 1000).round()).clamp(0, 1000),
                    child: Container(height: 7, color: const Color(0xFF3B82F6)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _legend('ສ້ອມແປງ', repairTotal, tealBright),
                const SizedBox(width: 16),
                _legend('ຕິດຕັ້ງ', installTotal, const Color(0xFF3B82F6)),
              ],
            ),
            const SizedBox(height: 14),
            Container(height: 1, color: surface.withValues(alpha: .08)),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              _fact('${data.jobs}', 'ງານທີ່ປິດ'),
              _fact(money(average), 'ສະເລ່ຍຕໍ່ງານ'),
              _fact('${data.rows.length}', 'ລາຍການຈ່າຍ'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _legend(String label, double value, Color color) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 6),
      Text(
        label,
        style: const TextStyle(fontSize: 11.5, color: onHeroDim),
      ),
      const SizedBox(width: 5),
      Text(
        money(value),
        style: const TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          color: onHero,
          fontFeatures: [FontFeature.tabularFigures()],
        ),
      ),
    ],
  );

  Widget _fact(String value, String label) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: onHero,
            fontSize: 16,
            fontWeight: FontWeight.w900,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11.5, color: onHeroDim)),
      ],
    ),
  );

  Widget _dayHeader(String date, double total) => Padding(
    padding: const EdgeInsets.only(bottom: 8, left: 2, right: 2),
    child: Row(
      children: [
        Text(
          'ປິດງານ $date',
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: muted,
          ),
        ),
        const SizedBox(width: 8),
        const Expanded(child: Divider(color: line, height: 1)),
        const SizedBox(width: 8),
        Text(
          money(total),
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: ink,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      ],
    ),
  );

  Widget _row(Map<String, dynamic> row) {
    final install = _isInstall(row);
    final role = row['role'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 11, 13, 11),
      decoration: cardDecoration(),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: install ? const Color(0xFFEFF6FF) : tealTint,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              install
                  ? Icons.home_repair_service_rounded
                  : Icons.build_rounded,
              size: 18,
              color: install ? const Color(0xFF2563EB) : teal,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row['job_code'] as String? ?? '-',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: ink,
                    letterSpacing: -.2,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    StageTag(
                      install ? 'ຕິດຕັ້ງ' : 'ສ້ອມແປງ',
                      color: install ? const Color(0xFF2563EB) : teal,
                      bg: install ? const Color(0xFFEFF6FF) : tealTint,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        'ບົດບາດ: ${_roleLabel[role] ?? (role.isEmpty ? '-' : role)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5, color: muted),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                money(_pay(row)),
                style: const TextStyle(
                  color: ok,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const Text('ບາທ', style: TextStyle(fontSize: 11, color: faint)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _errorCard() => Center(
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
              'ໂຫຼດລາຍຮັບບໍ່ສຳເລັດ',
              style: TextStyle(fontWeight: FontWeight.w800, color: ink),
            ),
            const SizedBox(height: 5),
            Text(
              error,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: muted, height: 1.5),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: teal),
              onPressed: () {
                setState(() {
                  loading = true;
                  error = '';
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

  /// ຍັງບໍ່ເຊື່ອມ ODS ↔ ERP — ບອກເປັນຂັ້ນຕອນທີ່ຊ່າງເອົາໄປບອກຜູ້ຈັດການໄດ້ເລີຍ
  Widget _notLinked() => ListView(
    padding: const EdgeInsets.all(18),
    children: [
      Container(
        padding: const EdgeInsets.all(18),
        decoration: cardDecoration(border: const Color(0xFFFDE68A)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.link_off_rounded,
                    size: 19,
                    color: Color(0xFFB45309),
                  ),
                ),
                const SizedBox(width: 11),
                const Expanded(
                  child: Text(
                    'ບັນຊີຍັງບໍ່ໄດ້ເຊື່ອມກັບພະນັກງານ ERP',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: ink,
                      fontSize: 14.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'ຄ່າຄອມຈະຍັງບໍ່ເຂົ້າບັນຊີທ່ານ — ກະລຸນາແຈ້ງຜູ້ຈັດການ',
              style: TextStyle(color: muted, fontSize: 12.5, height: 1.5),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: surfaceAlt,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ລະຫັດບັນຊີ ODS ຂອງທ່ານ',
                    style: TextStyle(fontSize: 11, color: muted),
                  ),
                  const SizedBox(height: 3),
                  SelectableText(
                    username.isEmpty ? '-' : username,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      color: ink,
                      fontSize: 17,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'ໃຫ້ຜູ້ຈັດການເຂົ້າ ຈັດການ → ພະນັກງານ ແລ້ວເຊື່ອມລະຫັດນີ້ກັບ ERP employee',
              style: TextStyle(color: faint, fontSize: 11.5, height: 1.5),
            ),
          ],
        ),
      ),
    ],
  );
}
