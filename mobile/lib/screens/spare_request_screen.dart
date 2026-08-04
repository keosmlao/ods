import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ອອກໃບຂໍເບີກອາໄຫຼ່ — **ຊ່າງເປັນຄົນອອກເອງ** (ບໍ່ຜ່ານ CS).
///
/// ອາໄຫຼ່ທີ່ຂໍ = ອາໄຫຼ່ທີ່ເລືອກໄວ້ຕອນກວດເຊັກ ແລະ **ຍັງບໍ່ທັນຂໍ/ເບີກ** ເທົ່ານັ້ນ
/// (server ກອງໃຫ້) ⇒ ໃບທີສອງບໍ່ຂໍຂອງເກົ່າຄືນອີກ ແລ້ວສາງຕັດສະຕັອກສອງເທື່ອ.
/// ສາງ/ທີ່ເກັບ ດຶງມາຈາກລາຍການທີ່ອະນຸຍາດຢູ່ server (ບໍ່ຝັງໄວ້ໃນແອັບ).
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
///   ① ເປັນ **ຂັ້ນຕອນ 1-2-3** (ສາງ → ທີ່ເກັບ → ໝາຍເຫດ) ບໍ່ແມ່ນ chip ລອຍໆ
///   ② ປຸ່ມຢູ່ **ແຖບລຸ່ມຄົງທີ່** + ບອກເຫດຜົນຕອນກົດບໍ່ໄດ້ (ແຕ່ກ່ອນປຸ່ມຈາງໆ ບໍ່ບອກຫຍັງ)
///   ③ ໂຫຼດລາຍການສາງບໍ່ສຳເລັດ = ກາດ + ລອງໃໝ່ — **ແຕ່ກ່ອນຄ້າງໝູນຕະຫຼອດໄປ**
///      (catch ຂຶ້ນ snackbar ແຕ່ `lookups` ຍັງ null ⇒ ວົງໝູນບໍ່ຢຸດ)
class SpareRequestScreen extends StatefulWidget {
  const SpareRequestScreen({
    super.key,
    required this.code,
    this.workflow = 'repair',
  });
  final String code;
  final String workflow;

  @override
  State<SpareRequestScreen> createState() => _SpareRequestScreenState();
}

class _SpareRequestScreenState extends State<SpareRequestScreen> {
  Lookups? lookups;

  /// ຮອບອາໄຫຼ່ຂອງງານ — ໃບນີ້ຈະເປັນຮອບຖັດໄປ; ລົ້ມ = null (ບໍ່ສະແດງ)
  SpareRounds? rounds;
  String? wh;
  String? shelf;
  final remark = TextEditingController();
  bool busy = false;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    remark.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final value = await Api.lookups();
      if (!mounted) return;
      setState(() {
        lookups = value;
        error = '';
      });
    } catch (caught) {
      if (!mounted) return;
      setState(
        () => error = caught is ApiError ? caught.message : '$caught',
      );
    }
    // ຮອບເກົ່າ — ຂໍ້ມູນເສີມ ລົ້ມກໍ່ບໍ່ໃຫ້ໜ້າພັງ (ພຽງບໍ່ສະແດງ)
    try {
      final data = await Api.spareRounds(widget.workflow, widget.code);
      if (mounted) setState(() => rounds = data);
    } catch (_) {}
  }

  Future<void> submit() async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() => busy = true);
    try {
      final message = await Api.requestSpares(
        widget.workflow,
        widget.code,
        wh!,
        shelf!,
        remark.text,
      );
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(message), backgroundColor: ok),
      );
      navigator.pop();
    } on ApiError catch (failure) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: danger),
      );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = lookups;
    final shelves = data == null
        ? <Map<String, String>>[]
        : data.shelves.where((row) => row['wh_code'] == wh).toList();
    final ready = wh != null && shelf != null;

    return HeroScaffold(
      title: 'ໃບຂໍເບີກອາໄຫຼ່',
      onBack: () => Navigator.pop(context),
      body: error.isNotEmpty
          ? _errorCard()
          : data == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 18),
                    children: [
                      _jobCard(),
                      if (rounds != null && rounds!.withdrawals.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        _roundsCard(),
                      ],
                      const SizedBox(height: 14),
                      _step(
                        1,
                        'ເລືອກສາງ',
                        wh == null ? null : _nameOf(data.warehouses, wh!),
                        Column(
                          children: [
                            for (final row in data.warehouses)
                              _option(
                                label: row['name'] ?? row['code']!,
                                sub: row['code']!,
                                selected: wh == row['code'],
                                icon: Icons.warehouse_rounded,
                                onTap: () => setState(() {
                                  wh = row['code'];
                                  shelf = null;
                                }),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _step(
                        2,
                        'ເລືອກທີ່ເກັບ',
                        shelf == null ? null : _nameOf(shelves, shelf!),
                        wh == null
                            ? const _Hint('ເລືອກສາງກ່ອນ')
                            : shelves.isEmpty
                            ? const _Hint('ສາງນີ້ຍັງບໍ່ມີທີ່ເກັບ')
                            : Column(
                                children: [
                                  for (final row in shelves)
                                    _option(
                                      label: row['name'] ?? row['code']!,
                                      sub: row['code']!,
                                      selected: shelf == row['code'],
                                      icon: Icons.shelves,
                                      onTap: () =>
                                          setState(() => shelf = row['code']),
                                    ),
                                ],
                              ),
                      ),
                      const SizedBox(height: 12),
                      _step(
                        3,
                        'ໝາຍເຫດ',
                        null,
                        TextField(
                          controller: remark,
                          maxLines: 3,
                          style: const TextStyle(fontSize: 13.5, color: ink),
                          decoration: InputDecoration(
                            hintText: 'ບໍ່ບັງຄັບ — ເຊັ່ນ ຕ້ອງການດ່ວນ, ໃຊ້ກັບລຸ້ນ...',
                            hintStyle: const TextStyle(
                              fontSize: 12.5,
                              color: faint,
                            ),
                            filled: true,
                            fillColor: surfaceAlt,
                            contentPadding: const EdgeInsets.all(12),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                _bottomBar(ready),
              ],
            ),
    );
  }

  static String _nameOf(List<Map<String, String>> rows, String code) {
    for (final row in rows) {
      if (row['code'] == code) return row['name'] ?? code;
    }
    return code;
  }

  /// ຮອບເກົ່າຂອງງານ + ບອກວ່າໃບນີ້ຈະເປັນຮອບທີເທົ່າໃດ — ຊ່າງບໍ່ຕ້ອງເດົາວ່າຂໍໄປແລ້ວກີ່ເທື່ອ
  /// (ນິຍາມສະຖານະດຽວກັບເວັບ: ກຳລັງສັ່ງຊື້ = status=5 ແລະ arrive_at ຫວ່າງ)
  Widget _roundsCard() {
    final next = rounds!.withdrawals.length + 1;
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
      decoration: cardDecoration(border: const Color(0xFFC7D2FE)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ໃບນີ້ຈະເປັນໃບຂໍເບີກ ຮອບທີ $next',
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF4338CA),
            ),
          ),
          const SizedBox(height: 6),
          for (final round in rounds!.withdrawals)
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Text(
                'ຮອບ ${round.round} · ${round.docNo} — ${_roundLabel(round)}',
                style: const TextStyle(fontSize: 11.5, color: muted),
              ),
            ),
        ],
      ),
    );
  }

  static String _roundLabel(SpareWithdrawRound round) {
    if (round.state == 'received') return 'ຮັບແລ້ວ';
    if (round.onOrder > 0) return 'ກຳລັງສັ່ງຊື້ ${round.onOrder} ລາຍການ';
    if (round.state == 'dispatched') return 'ສາງເບີກແລ້ວ ລໍຮັບ';
    if (round.status == 'issued') return 'ເບີກແລ້ວ';
    if (round.status == 'partial') return 'ເບີກບາງສ່ວນ';
    return 'ລໍສາງເບີກ';
  }

  Widget _jobCard() => Container(
    padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
    decoration: cardDecoration(),
    child: Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: widget.workflow == 'install'
                ? const Color(0xFFEFF6FF)
                : tealTint,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            widget.workflow == 'install'
                ? Icons.home_repair_service_rounded
                : Icons.build_rounded,
            size: 19,
            color: widget.workflow == 'install'
                ? const Color(0xFF2563EB)
                : teal,
          ),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.code,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'ຂໍເບີກອາໄຫຼ່ທີ່ເລືອກໄວ້ຕອນກວດເຊັກ',
                style: const TextStyle(fontSize: 11.5, color: muted),
              ),
            ],
          ),
        ),
        StageTag(widget.workflow == 'install' ? 'ຕິດຕັ້ງ' : 'ສ້ອມແປງ'),
      ],
    ),
  );

  /// ບລັອກຂັ້ນຕອນ: ເລກ + ຫົວຂໍ້ + ຄ່າທີ່ເລືອກແລ້ວ
  Widget _step(int number, String title, String? chosen, Widget child) =>
      Container(
        padding: const EdgeInsets.fromLTRB(13, 12, 13, 13),
        decoration: cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: chosen == null ? surfaceAlt : teal,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: chosen == null
                        ? Text(
                            '$number',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: muted,
                            ),
                          )
                        : const Icon(
                            Icons.check_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                  ),
                ),
                const SizedBox(width: 9),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                    color: ink,
                  ),
                ),
                if (chosen != null) ...[
                  const Spacer(),
                  Flexible(
                    child: Text(
                      chosen,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: teal,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 11),
            child,
          ],
        ),
      );

  Widget _option({
    required String label,
    required String sub,
    required bool selected,
    required IconData icon,
    required VoidCallback onTap,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.fromLTRB(11, 10, 11, 10),
        decoration: BoxDecoration(
          color: selected ? tealTint : surfaceAlt,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? teal : Colors.transparent),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: selected ? teal : muted),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: selected ? teal : ink,
                    ),
                  ),
                  Text(
                    sub,
                    style: const TextStyle(fontSize: 10.5, color: faint),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle_rounded, size: 19, color: teal),
          ],
        ),
      ),
    ),
  );

  Widget _bottomBar(bool ready) => Container(
    padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(top: BorderSide(color: line)),
      boxShadow: [
        BoxShadow(color: Color(0x0F0F172A), blurRadius: 18, offset: Offset(0, -6)),
      ],
    ),
    child: SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!ready)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'ເລືອກ ສາງ ແລະ ທີ່ເກັບ ກ່ອນຈຶ່ງອອກໃບໄດ້',
                style: TextStyle(fontSize: 11.5, color: warn),
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: teal,
                disabledBackgroundColor: surfaceAlt,
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
              ),
              onPressed: !ready || busy ? null : submit,
              child: busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      'ອອກໃບຂໍເບີກ',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w900,
                        color: ready ? Colors.white : faint,
                      ),
                    ),
            ),
          ),
        ],
      ),
    ),
  );

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
              'ໂຫຼດລາຍການສາງບໍ່ສຳເລັດ',
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
                setState(() => error = '');
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
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
    decoration: BoxDecoration(
      color: surfaceAlt,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Text(
      text,
      style: const TextStyle(fontSize: 12, color: faint),
    ),
  );
}
