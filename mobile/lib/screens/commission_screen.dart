import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'login_screen.dart';
import 'manager_kit.dart';

/// **ສະຫຼຸບຄ່າຄອມ** (ຜູ້ຈັດການ) — ໃຜໄດ້ເທົ່າໃດ ແລະ **ເງິນນັ້ນມາຈາກໃສ**.
///
/// 2 ຊັ້ນ: ໜ້ານີ້ = ສະຫຼຸບຕໍ່ຄົນ · ແຕະຄົນໃດ = ລາຍລະອຽດແຕ່ລະໃບຂອງຄົນນັ້ນ
/// (ໃບງານ · ອັດຕາທີ່ຈັບໄດ້ · ຍອດເຕັມ × ເປີເຊັນ = ເງິນທີ່ໄດ້).
///
/// ຕົວເລກອ່ານຈາກ `ods_service_payout` ທີ່ **ແຊ່ໄວ້ຕອນປິດງານ** — ບໍ່ຄິດຄືນໃໝ່
/// ⇒ ຕົວເລກທີ່ເຫັນຄືເງິນທີ່ຕົກລົງແລ້ວຈິງ ບໍ່ປ່ຽນເມື່ອຕາຕະລາງອັດຕາຖືກແກ້.
class CommissionScreen extends StatefulWidget {
  const CommissionScreen({super.key, this.employee = '', this.title = 'ສະຫຼຸບຄ່າຄອມ'});

  /// ວ່າງ = ທຸກຄົນ (ໜ້າສະຫຼຸບ) · ມີຄ່າ = ລາຍລະອຽດຂອງຄົນດຽວ
  final String employee;
  final String title;

  @override
  State<CommissionScreen> createState() => _CommissionScreenState();
}

class _CommissionScreenState extends State<CommissionScreen> {
  Commission? data;
  bool loading = true;
  String error = '';
  /// ຍ້ອນຫຼັງຈາກເດືອນປັດຈຸບັນ (0 = ເດືອນນີ້)
  int back = 0;

  @override
  void initState() {
    super.initState();
    load();
  }

  String get _month {
    final now = DateTime.now();
    final target = DateTime(now.year, now.month - back);
    return '${target.year}-${target.month.toString().padLeft(2, '0')}';
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final result = await Api.commission(month: _month, employee: widget.employee);
      if (!mounted) return;
      setState(() {
        data = result;
        error = '';
        loading = false;
      });
    } on ApiError catch (failure) {
      if (!mounted) return;
      if (failure.status == 401) {
        await Api.clearToken();
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
        return;
      }
      setState(() {
        error = failure.message;
        loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້';
          loading = false;
        });
      }
    }
  }

  static String _money(double value) =>
      value.toStringAsFixed(value == value.roundToDouble() ? 0 : 2);

  @override
  Widget build(BuildContext context) {
    final d = data;
    final detail = widget.employee.isNotEmpty;

    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: widget.title,
            onBack: () => Navigator.pop(context),
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: d == null
                ? null
                : [
                    HeroStat(value: '${_money(d.totalThb)} ฿', label: 'ລວມ ${d.month}'),
                    HeroStat(value: '${d.jobs}', label: 'ໃບງານ'),
                  ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? ErrorRetry(message: error, onRetry: load)
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
                      children: [
                        // ── ເລືອກເດືອນ ──
                        Row(
                          children: [
                            IconButton(
                              onPressed: () {
                                setState(() => back += 1);
                                load();
                              },
                              icon: const Icon(Icons.chevron_left, color: muted),
                            ),
                            Expanded(
                              child: Text(
                                d?.month ?? _month,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: ink,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: back == 0
                                  ? null
                                  : () {
                                      setState(() => back -= 1);
                                      load();
                                    },
                              icon: Icon(
                                Icons.chevron_right,
                                color: back == 0 ? faint : muted,
                              ),
                            ),
                          ],
                        ),

                        if (d == null || d.lines.isEmpty)
                          const EmptyHint(
                            icon: Icons.payments_outlined,
                            text: 'ເດືອນນີ້ຍັງບໍ່ມີຄ່າຄອມ\n(ຄ່າຄອມຄິດຕອນປິດງານ)',
                          )
                        else ...[
                          // ── ສະຫຼຸບຕໍ່ຄົນ (ເສັ້ນທາງເຂົ້າໜ້າລາຍລະອຽດ) ──
                          if (!detail)
                            MCard(
                              title: 'ຄ່າຄອມຕໍ່ຄົນ',
                              child: Column(
                                children: [
                                  for (final person in d.people)
                                    _PersonRow(
                                      person: person,
                                      total: d.totalThb,
                                      onTap: person.employeeCode.isEmpty
                                          ? null
                                          : () => Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) => CommissionScreen(
                                                  employee: person.employeeCode,
                                                  title: person.name,
                                                ),
                                              ),
                                            ),
                                    ),
                                ],
                              ),
                            ),

                          // ── ລາຍລະອຽດ: ຄ່າຄອມແຕ່ລະແຖວມາຈາກໃສ ──
                          MCard(
                            title: detail
                                ? 'ລາຍລະອຽດ ${d.lines.length} ແຖວ'
                                : 'ລາຍລະອຽດລ່າສຸດ',
                            child: Column(
                              children: [
                                for (final line in (detail ? d.lines : d.lines.take(20)))
                                  _LineRow(line: line, showName: !detail),
                              ],
                            ),
                          ),
                          if (!detail && d.lines.length > 20)
                            const Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: Text(
                                'ສະແດງ 20 ແຖວລ່າສຸດ — ແຕະຊື່ຄົນເພື່ອເບິ່ງຄົບ',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 11, color: muted),
                              ),
                            ),
                        ],
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// 1 ແຖວສະຫຼຸບຕໍ່ຄົນ — ແຖບບອກສັດສ່ວນຕໍ່ຍອດລວມ
class _PersonRow extends StatelessWidget {
  const _PersonRow({required this.person, required this.total, this.onTap});
  final CommissionPerson person;
  final double total;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(10),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  person.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: ink),
                ),
              ),
              Text(
                '${_CommissionScreenState._money(person.totalThb)} ฿',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: ok),
              ),
              if (onTap != null) const Icon(Icons.chevron_right, size: 17, color: faint),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: total > 0 ? person.totalThb / total : 0,
              minHeight: 5,
              backgroundColor: const Color(0xFFEFF3F1),
              valueColor: const AlwaysStoppedAnimation(teal),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            '${person.jobs} ໃບ · ${person.lines} ແຖວ',
            style: const TextStyle(fontSize: 11.5, color: muted),
          ),
        ],
      ),
    ),
  );
}

/// 1 ແຖວລາຍລະອຽດ — ບອກສູດ: ຍອດເຕັມ × ເປີເຊັນ = ເງິນທີ່ໄດ້
class _LineRow extends StatelessWidget {
  const _LineRow({required this.line, required this.showName});
  final CommissionLine line;
  final bool showName;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '#${line.jobCode}',
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: ink),
            ),
            const SizedBox(width: 6),
            Text(
              line.workflow == 'install' ? 'ຕິດຕັ້ງ' : 'ສ້ອມ',
              style: const TextStyle(fontSize: 11, color: muted),
            ),
            const Spacer(),
            Text(
              '${_CommissionScreenState._money(line.payThb)} ฿',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: ok),
            ),
          ],
        ),
        const SizedBox(height: 2),
        // ນີ້ຄືຄຳຕອບຂອງ "ຄ່າຄອມມາຈາກໃສ"
        Text(
          line.rateLabel ?? 'ບໍ່ມີຊື່ອັດຕາ',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 11.5, color: ink, height: 1.3),
        ),
        const SizedBox(height: 2),
        Text(
          [
            '${_CommissionScreenState._money(line.amountThb)} × ${line.pct.toStringAsFixed(0)}%',
            line.roleLabel,
            if (showName) line.name,
            if (line.closedAt != null) line.closedAt!,
          ].join('  ·  '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 11.5, color: muted),
        ),
      ],
    ),
  );
}
