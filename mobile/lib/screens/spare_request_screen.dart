import 'package:flutter/material.dart';

import '../api.dart';
import '../drafts.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ອອກໃບຂໍເບີກອາໄຫຼ່ — **ຊ່າງເປັນຄົນອອກເອງ** (ບໍ່ຜ່ານ CS).
///
/// ອາໄຫຼ່ທີ່ຂໍ = ອາໄຫຼ່ທີ່ເລືອກໄວ້ຕອນກວດເຊັກ ແລະ **ຍັງບໍ່ທັນຂໍ/ເບີກ** ເທົ່ານັ້ນ
/// (server ກອງໃຫ້) ⇒ ໃບທີສອງບໍ່ຂໍຂອງເກົ່າຄືນອີກ ແລ້ວສາງຕັດສະຕັອກສອງເທື່ອ.
/// ສາງ/ທີ່ເກັບ ດຶງມາຈາກລາຍການທີ່ອະນຸຍາດຢູ່ server (ບໍ່ຝັງໄວ້ໃນແອັບ).
///
/// ── ແບ່ງເບີກຫຼາຍສາງ: **1 ສາງ ຕໍ່ 1 ໃບ** (13-08-2026) ──
/// ອາໄຫຼ່ຕົວດຽວກັນມັກກະຈາຍຢູ່ຫຼາຍສາງ ⇒ ຖ້າໃບນຶ່ງບັງຄັບເອົາ "ຄ້າງທັງໝົດ" ຊ່າງເບີກບໍ່ໄດ້
/// ຈັກໜ່ວຍ ທັງທີ່ລວມທຸກສາງມີພໍ. ຂັ້ນ ③ ຈຶ່ງໃຫ້ລະບຸ **ໃບນີ້ເອົາຈັກໜ່ວຍຕໍ່ລາຍການ**
/// ສ່ວນທີ່ເຫຼືອຍັງຄ້າງໄວ້ ⇒ ອອກໃບໃໝ່ຈາກສາງອື່ນຕໍ່ໄດ້ທັນທີ (ຄືກັບຟອມເວັບ).
/// ຕົວຕັດຈິງຢູ່ server ສະເໝີ (lib/spare-take.takeQty) — ຢູ່ນີ້ພຽງໜ້າຈໍ.
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
///   ① ເປັນ **ຂັ້ນຕອນ 1-2-3-4** (ສາງ → ທີ່ເກັບ → ລາຍການ/ຈຳນວນ → ໝາຍເຫດ) ບໍ່ແມ່ນ chip ລອຍໆ
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

  /// ລາຍການທີ່ຍັງຄ້າງຂໍເບີກ (null = ຍັງບໍ່ໂຫຼດ/ໂຫຼດບໍ່ໄດ້ ⇒ ໃຊ້ພຶດຕິກຳເກົ່າ: ເອົາທັງໝົດ)
  List<PendingSpareLine>? pending;

  /// item_code → ຈຳນວນທີ່ **ໃບນີ້** ຈະເອົາ (ຕັ້ງຕົ້ນ = ຄ້າງທັງໝົດ)
  final Map<String, double> take = {};
  String? wh;
  String? shelf;
  final remark = TextEditingController();
  bool busy = false;
  String error = '';

  /// ຮ່າງໃບຂໍເບີກ — ຈຳນວນທີ່ປັບເອງ + ໝາຍເຫດ ບໍ່ໃຫ້ຫາຍຕອນອອກຈາກໜ້າ
  String get _draftKey => 'spare-request:${widget.workflow}:${widget.code}';

  void _saveDraft() => Drafts.write(_draftKey, {
        'take': take.map((code, qty) => MapEntry(code, qty)),
        'remark': remark.text,
      });

  @override
  void initState() {
    super.initState();
    remark.text = (Drafts.read(_draftKey)['remark'] as String?) ?? '';
    remark.addListener(_saveDraft);
    load();
  }

  /// ຄືນຈຳນວນທີ່ຊ່າງປັບເອງ — ເອົາສະເພາະລາຍການທີ່ **ຍັງຄ້າງຢູ່ຈິງ** ແລະ
  /// ບໍ່ເກີນຈຳນວນຄ້າງ (ຂໍ້ມູນຝັ່ງ server ອາດປ່ຽນໄປແລ້ວລະຫວ່າງທີ່ຮ່າງຄ້າງຢູ່)
  void _restoreTake(List<PendingSpareLine> rows) {
    final saved = Drafts.read(_draftKey)['take'];
    if (saved is! Map) return;
    for (final row in rows) {
      final value = saved[row.itemCode];
      if (value is num) take[row.itemCode] = value.toDouble().clamp(0, row.qty);
    }
  }

  @override
  void dispose() {
    remark.removeListener(_saveDraft);
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
    // ລາຍການທີ່ຄ້າງ — ລົ້ມກໍ່ບໍ່ໃຫ້ໜ້າພັງ: `pending` ຍັງ null ⇒ ບໍ່ສົ່ງ `take`
    // ⇒ server ໃຊ້ພຶດຕິກຳເກົ່າ (ເອົາຄ້າງທັງໝົດ) ຄືກັບແອັບຮຸ່ນກ່ອນ.
    try {
      final rows = await Api.pendingSpareLines(widget.workflow, widget.code);
      if (mounted) {
        setState(() {
          pending = rows;
          take
            ..clear()
            ..addEntries(rows.map((row) => MapEntry(row.itemCode, row.qty)));
          _restoreTake(rows);
        });
      }
    } catch (_) {}
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
        // ໂຫຼດລາຍການບໍ່ໄດ້ = ບໍ່ສົ່ງ take ⇒ server ເອົາຄ້າງທັງໝົດ (ພຶດຕິກຳເກົ່າ)
        take: pending == null ? null : Map<String, num>.from(take),
      );
      Drafts.clear(_draftKey); // ສົ່ງໃບແລ້ວ ⇒ ຮ່າງບໍ່ຈຳເປັນອີກ
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
    // ໂຫຼດລາຍການບໍ່ໄດ້ (pending == null) = ບໍ່ກັ້ນ — server ຈະເອົາຄ້າງທັງໝົດໃຫ້ເອງ
    final ready = wh != null && shelf != null && (pending == null || takenCount > 0);

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
                        'ລາຍການ ແລະ ຈຳນວນ',
                        pending == null || takenCount == 0
                            ? null
                            : 'ເອົາ $takenCount ລາຍການ',
                        _linesStep(),
                      ),
                      const SizedBox(height: 12),
                      _step(
                        4,
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

  /// ຈຳນວນລາຍການທີ່ໃບນີ້ຈະເອົາ (ຈຳນວນ > 0)
  int get takenCount => take.values.where((qty) => qty > 0).length;

  static String _qty(double value) => value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(2);

  /// ຂັ້ນ ③ — ເລືອກລາຍການ ແລະ ຈຳນວນຂອງ**ໃບນີ້**
  Widget _linesStep() {
    final rows = pending;
    if (rows == null) {
      return const _Hint('ໂຫຼດລາຍການບໍ່ໄດ້ — ໃບນີ້ຈະເອົາອາໄຫຼ່ທີ່ຄ້າງທັງໝົດ');
    }
    if (rows.isEmpty) return const _Hint('ບໍ່ມີອາໄຫຼ່ທີ່ຄ້າງຂໍເບີກ');

    final all = takenCount == rows.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ຂອງກະຈາຍຫຼາຍສາງ ⇒ ມັກເອົາບາງລາຍການ; ປຸ່ມນີ້ຊ່ວຍລ້າງ/ຕິກຄືນໄວໆ
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => setState(() {
              for (final row in rows) {
                take[row.itemCode] = all ? 0 : row.qty;
                _saveDraft();
              }
            }),
            child: Text(
              all ? 'ບໍ່ເອົາທັງໝົດ' : 'ເອົາທັງໝົດ',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: teal,
              ),
            ),
          ),
        ),
        for (final row in rows) _lineRow(row),
        const SizedBox(height: 2),
        const Text(
          '1 ສາງ = 1 ໃບ · ສ່ວນທີ່ບໍ່ເອົາຍັງຄ້າງໄວ້ ອອກໃບຈາກສາງອື່ນຕໍ່ໄດ້',
          style: TextStyle(fontSize: 11, color: faint, height: 1.5),
        ),
      ],
    );
  }

  Widget _lineRow(PendingSpareLine row) {
    final chosen = take[row.itemCode] ?? 0;
    final on = chosen > 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.fromLTRB(11, 10, 11, 10),
        decoration: BoxDecoration(
          color: on ? tealTint : surfaceAlt,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: on ? teal : Colors.transparent),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    row.itemName.isEmpty ? row.itemCode : row.itemName,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: on ? teal : ink,
                      height: 1.35,
                    ),
                  ),
                ),
                // ຕິກອອກ = ບໍ່ເອົາລາຍການນີ້ໃນໃບນີ້ (ຍັງຄ້າງໄວ້ໃຫ້ໃບຕໍ່ໄປ)
                Checkbox(
                  value: on,
                  activeColor: teal,
                  visualDensity: VisualDensity.compact,
                  onChanged: (value) => setState(
                    () {
                      take[row.itemCode] = value == true ? row.qty : 0;
                      _saveDraft();
                    },
                  ),
                ),
              ],
            ),
            Text(
              '${row.itemCode} · ຄ້າງ ${_qty(row.qty)} ${row.unitCode ?? ''}',
              style: const TextStyle(fontSize: 11, color: faint),
            ),
            if (on) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  _stepButton(
                    Icons.remove_rounded,
                    chosen <= 1
                        ? null
                        : () {
                            setState(() => take[row.itemCode] = chosen - 1);
                            _saveDraft();
                          },
                  ),
                  Container(
                    width: 52,
                    alignment: Alignment.center,
                    child: Text(
                      _qty(chosen),
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w900,
                        color: ink,
                      ),
                    ),
                  ),
                  // ເພດານ = ຈຳນວນຄ້າງ (server ຕັດຊ້ຳຢູ່ແລ້ວ ແຕ່ຢ່າໃຫ້ຈໍຫຼອກຕາ)
                  _stepButton(
                    Icons.add_rounded,
                    chosen >= row.qty
                        ? null
                        : () {
                            setState(() => take[row.itemCode] = chosen + 1);
                            _saveDraft();
                          },
                  ),
                  const Spacer(),
                  if (chosen < row.qty)
                    Text(
                      'ຍັງຄ້າງ ${_qty(row.qty - chosen)}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: warn,
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _stepButton(IconData icon, VoidCallback? onTap) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(10),
    child: Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: line),
      ),
      child: Icon(icon, size: 17, color: onTap == null ? faint : ink),
    ),
  );

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

  /// ປ້າຍສະຖານະຮອບ — ນິຍາມດຽວກັບເວັບ (lib/repair-spare-rounds).
  /// **ຂໍຄືນຄ້າງ** ຂຶ້ນກ່ອນສະຖານະອື່ນ: ຂອງອອກສາງໄປແລ້ວ ແຕ່ສາງຍັງບໍ່ຮັບຄືນ
  /// ⇒ ຊ່າງຍັງຖືຂອງຢູ່ ຕ້ອງເຫັນກ່ອນສິ່ງອື່ນ (ຝັ່ງເວັບໂຊ້ວເປັນປ້າຍ "ລໍສາງຮັບຄືນ").
  static String _roundLabel(SpareWithdrawRound round) {
    if (round.returnsWaiting > 0) return 'ລໍສາງຮັບຄືນ ${round.returnsWaiting} ໃບ';
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
                            color: onAccent,
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
                    style: const TextStyle(fontSize: 11.5, color: faint),
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
      color: surface,
      border: Border(top: BorderSide(color: line)),
    ),
    child: SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!ready)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                wh == null || shelf == null
                    ? 'ເລືອກ ສາງ ແລະ ທີ່ເກັບ ກ່ອນຈຶ່ງອອກໃບໄດ້'
                    : 'ຕິກເອົາຢ່າງໜ້ອຍ 1 ລາຍການ ຈຶ່ງອອກໃບໄດ້',
                style: const TextStyle(fontSize: 11.5, color: warn),
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
                        color: onAccent,
                      ),
                    )
                  : Text(
                      'ອອກໃບຂໍເບີກ',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w900,
                        color: ready ? onAccent : faint,
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
