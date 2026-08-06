import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'spare_request_screen.dart';

/// ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — ພົບຕ້ອງໃຊ້ອາໄຫຼ່ເພີ່ມ/ປ່ຽນ: ຄົ້ນ+ເພີ່ມ, ຖອດ, ແລ້ວ
/// "ໄປອອກໃບຂໍເບີກ" (ຮອບ 2). ແຖວທີ່ເບີກແລ້ວ (locked) ຖອດບໍ່ໄດ້ — ຢາກປ່ຽນໃຫ້ສົ່ງຄືນສາງກ່ອນ.
///
/// ── ຕ່າງຈາກລຸ້ນກ່ອນ (ອອກແບບໃໝ່) ──
///   ① ແຕ່ລະແຖວມີ **ປ້າຍສະຖານະ** (ຄ້າງເບີກ · ຂໍເບີກແລ້ວ · ເບີກແລ້ວ) ເປັນສີ
///      — ແຕ່ກ່ອນຢັດຢູ່ທ້າຍຂໍ້ຄວາມ subtitle ອ່ານຂ້າມ
///   ② ຄົ້ນຫາຄືນຜົນເປັນກາດ ບອກ **ຄົງເຫຼືອ** ເປັນສີ (0 = ໝົດສາງ ⇒ ຮູ້ກ່ອນເພີ່ມ)
///   ③ ປຸ່ມ "ໄປອອກໃບຂໍເບີກ" ຢູ່ **ແຖບລຸ່ມຄົງທີ່** ບໍ່ຕ້ອງເລື່ອນລົງສຸດຈຶ່ງເຫັນ
///   ④ ຄົ້ນຫາຜິດພາດ/ບໍ່ພົບ = ບອກ (ແຕ່ກ່ອນຜົນເກົ່າຄ້າງຢູ່ ຄືກັບບໍ່ມີຫຍັງເກີດຂຶ້ນ)
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

  /// ບັນຊີອາໄຫຼ່ແບ່ງຕາມຮອບ (ໃບຂໍເບີກ + ໃບຂໍຊື້) — ຊຸດດຽວກັບເວັບ; ລົ້ມ = null (ບໍ່ສະແດງ)
  SpareRounds? rounds;
  bool busy = false;
  bool loading = true;
  bool searched = false;

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
    // ຮອບອາໄຫຼ່ — ຂໍ້ມູນເສີມ ລົ້ມກໍ່ບໍ່ໃຫ້ໜ້າພັງ (ພຽງບໍ່ສະແດງ)
    try {
      final data = await Api.spareRounds('repair', widget.code);
      if (mounted) setState(() => rounds = data);
    } catch (_) {}
  }

  Future<void> search() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => busy = true);
    try {
      final items = await Api.searchSpares(term.text);
      if (mounted) {
        setState(() {
          results = items;
          searched = true;
        });
      }
    } on ApiError catch (failure) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> run(Future<String> Function() call) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => busy = true);
    try {
      final message = await call();
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(message), backgroundColor: ok),
      );
      await load();
    } on ApiError catch (failure) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  int get pending => lines.where((line) => !line.locked).length;

  static String _qty(double value) => value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(2);

  @override
  Widget build(BuildContext context) => HeroScaffold(
    title: 'ອາໄຫຼ່ຕອນສ້ອມ',
    onBack: () => Navigator.pop(context),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 18),
                  children: [
                    _jobCard(),
                    const SizedBox(height: 14),
                    SectionLabel('ອາໄຫຼ່ທີ່ໃຊ້ (${lines.length})'),
                    if (lines.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 18,
                        ),
                        decoration: cardDecoration(),
                        child: const Column(
                          children: [
                            Icon(
                              Icons.inventory_2_outlined,
                              size: 24,
                              color: faint,
                            ),
                            SizedBox(height: 7),
                            Text(
                              'ຍັງບໍ່ມີອາໄຫຼ່ — ຄົ້ນຫາ ແລະ ເພີ່ມຂ້າງລຸ່ມ',
                              style: TextStyle(fontSize: 12.5, color: faint),
                            ),
                          ],
                        ),
                      )
                    else
                      for (final line in lines) _lineCard(line),
                    if (rounds != null &&
                        (rounds!.withdrawals.isNotEmpty ||
                            rounds!.purchases.isNotEmpty)) ...[
                      const SizedBox(height: 18),
                      const SectionLabel('ບັນຊີອາໄຫຼ່ຕາມຮອບ'),
                      const SizedBox(height: 8),
                      for (final round in rounds!.withdrawals)
                        _withdrawRoundCard(round),
                      for (final round in rounds!.purchases)
                        _purchaseRoundCard(round),
                    ],
                    const SizedBox(height: 18),
                    const SectionLabel('ຄົ້ນຫາ ແລະ ເພີ່ມອາໄຫຼ່'),
                    _searchBar(),
                    const SizedBox(height: 10),
                    if (busy && results.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 14),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (searched && results.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: cardDecoration(),
                        child: const Center(
                          child: Text(
                            'ບໍ່ພົບອາໄຫຼ່ທີ່ຄົ້ນ',
                            style: TextStyle(fontSize: 12.5, color: faint),
                          ),
                        ),
                      )
                    else
                      for (final item in results) _resultCard(item),
                  ],
                ),
              ),
              _bottomBar(),
            ],
          ),
  );

  Widget _jobCard() => Container(
    padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
    decoration: cardDecoration(),
    child: Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: tealTint,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.build_rounded, size: 19, color: teal),
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
                pending > 0
                    ? 'ຄ້າງເບີກ $pending ລາຍການ'
                    : 'ບໍ່ມີລາຍການຄ້າງເບີກ',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: pending > 0 ? warn : muted,
                ),
              ),
            ],
          ),
        ),
        const StageTag('ຂັ້ນສ້ອມ'),
      ],
    ),
  );

  Widget _lineCard(RepairSpareLine line) {
    final (label, fg, bg) = line.locked
        ? ('ເບີກແລ້ວ', ok, const Color(0xFFE1F5EC))
        : line.requested
        ? ('ຂໍເບີກແລ້ວ', const Color(0xFF2563EB), const Color(0xFFEFF6FF))
        : ('ຄ້າງເບີກ', warn, const Color(0xFFFBEED5));

    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Container(
        padding: const EdgeInsets.fromLTRB(13, 12, 9, 12),
        decoration: cardDecoration(),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line.itemName.isEmpty ? line.itemCode : line.itemName,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: ink,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Wrap(
                    spacing: 6,
                    runSpacing: 5,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      StageTag(label, color: fg, bg: bg),
                      Text(
                        '${line.itemCode} · ${_qty(line.qty)} ${line.unitCode ?? ''}',
                        style: const TextStyle(fontSize: 11, color: muted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (line.locked)
              const Padding(
                padding: EdgeInsets.only(right: 4, top: 2),
                child: Tooltip(
                  message: 'ເບີກອອກຈາກສາງແລ້ວ — ຢາກປ່ຽນໃຫ້ສົ່ງຄືນສາງກ່ອນ',
                  child: Icon(Icons.lock_rounded, size: 18, color: faint),
                ),
              )
            else
              IconButton(
                tooltip: 'ຖອດອອກ',
                icon: const Icon(Icons.delete_outline_rounded, color: danger),
                onPressed: busy
                    ? null
                    : () =>
                          run(() => Api.removeUsedSpare(widget.code, line.roworder)),
              ),
          ],
        ),
      ),
    );
  }

  /// ສະຖານະຮອບຂໍເບີກ — ນິຍາມດຽວກັບເວັບ (lib/repair-spare-rounds):
  /// ກຳລັງສັ່ງຊື້ = ແຖວ status=5 ທີ່ arrive_at ຫວ່າງ · ຮັບແລ້ວ = ມີໃບ PISP
  (String, Color, Color) _withdrawState(SpareWithdrawRound round) {
    if (round.state == 'received') {
      return ('ຮັບແລ້ວ', ok, const Color(0xFFE1F5EC));
    }
    if (round.onOrder > 0) {
      return ('ກຳລັງສັ່ງຊື້ ${round.onOrder} ລາຍການ', const Color(0xFF7C3AED), const Color(0xFFF5F3FF));
    }
    if (round.state == 'dispatched') {
      return ('ສາງເບີກແລ້ວ ລໍຊ່າງຮັບ', const Color(0xFF2563EB), const Color(0xFFEFF6FF));
    }
    if (round.status == 'issued') {
      return ('ເບີກແລ້ວ', ok, const Color(0xFFE1F5EC));
    }
    if (round.status == 'partial') {
      return ('ເບີກບາງສ່ວນ', const Color(0xFF0284C7), const Color(0xFFE0F2FE));
    }
    return ('ລໍສາງເບີກ', warn, const Color(0xFFFBEED5));
  }

  Widget _withdrawRoundCard(SpareWithdrawRound round) {
    final (label, fg, bg) = _withdrawState(round);
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Container(
        padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
        decoration: cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                StageTag('ຮອບ ${round.round}', color: const Color(0xFF4338CA), bg: const Color(0xFFEEF2FF)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${round.docNo} · ${round.docDate}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: ink),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 7),
            Wrap(
              spacing: 6,
              runSpacing: 5,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StageTag(label, color: fg, bg: bg),
                Text(
                  '${round.lines} ລາຍການ',
                  style: const TextStyle(fontSize: 11, color: muted),
                ),
                if (round.dispatchNo != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    'ໃບເບີກ ${round.dispatchNo}',
                    style: const TextStyle(fontSize: 11, color: faint),
                  ),
                ],
              ],
            ),
            // ── ໃບຂໍຄືນອາໄຫຼ່ (SRI) — ຝັ່ງເວັບສະແດງເປັນງ່າຢູ່ tree, ຢູ່ນີ້ເປັນແຖວຍ່ອຍ ──
            // ຮັບຄືນຫວ່າງ = ຂໍໄປແລ້ວແຕ່ສາງຍັງບໍ່ຮັບເຂົ້າ ⇒ ຂອງຍັງຄາຢູ່ມືຊ່າງ
            if (round.hasReturn) ...[
              const SizedBox(height: 7),
              for (final ret in round.returns)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.undo_rounded, size: 13, color: faint),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          'ຂໍຄືນ ${ret.docNo}${ret.docDate != null ? " · ${ret.docDate}" : ""}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, color: muted),
                        ),
                      ),
                      const SizedBox(width: 6),
                      StageTag(
                        ret.waitingWarehouse ? 'ລໍສາງຮັບຄືນ' : 'ສາງຮັບຄືນແລ້ວ',
                        color: ret.waitingWarehouse ? warn : ok,
                        bg: ret.waitingWarehouse ? const Color(0xFFFBEED5) : const Color(0xFFE1F5EC),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _purchaseRoundCard(SparePurchaseRound round) {
    final (label, fg, bg) = round.state == 'approved'
        ? ('ອະນຸມັດແລ້ວ — ຕິດຕາມຢູ່ ERP', const Color(0xFF2563EB), const Color(0xFFEFF6FF))
        : round.state == 'rejected'
        ? ('ບໍ່ອະນຸມັດ', danger, const Color(0xFFFFE4E6))
        : ('ລໍອະນຸມັດ', warn, const Color(0xFFFBEED5));
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Container(
        padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
        decoration: cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                StageTag('ຂໍຊື້ ຮອບ ${round.round}', color: const Color(0xFF7C3AED), bg: const Color(0xFFF5F3FF)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${round.docNo} · ${round.docDate}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: ink),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 7),
            Wrap(
              spacing: 6,
              runSpacing: 5,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StageTag(label, color: fg, bg: bg),
                Text(
                  '${round.lines} ລາຍການ',
                  style: const TextStyle(fontSize: 11, color: muted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _searchBar() => Row(
    children: [
      Expanded(
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: line),
          ),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, size: 18, color: faint),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: term,
                  onSubmitted: (_) => search(),
                  textInputAction: TextInputAction.search,
                  style: const TextStyle(fontSize: 13.5, color: ink),
                  decoration: const InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: 'ຊື່ ຫຼື ລະຫັດອາໄຫຼ່...',
                    hintStyle: TextStyle(fontSize: 13, color: faint),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(width: 8),
      SizedBox(
        height: 44,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: teal,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          onPressed: busy ? null : search,
          child: const Icon(Icons.search_rounded, size: 20),
        ),
      ),
    ],
  );

  Widget _resultCard(SpareItem item) {
    final out = item.balance <= 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: busy ? null : () => run(() => Api.addUsedSpare(widget.code, item, 1)),
        child: Container(
          padding: const EdgeInsets.fromLTRB(13, 11, 11, 11),
          decoration: cardDecoration(),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name.isEmpty ? item.code : item.name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: ink,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          item.code,
                          style: const TextStyle(fontSize: 11, color: faint),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          out ? 'ໝົດສາງ' : 'ຄົງເຫຼືອ ${item.balance}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: out ? danger : ok,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: tealTint,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(Icons.add_rounded, size: 20, color: teal),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bottomBar() => Container(
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
      child: SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFB45309),
            disabledBackgroundColor: surfaceAlt,
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(15),
            ),
          ),
          icon: Icon(
            Icons.inventory_2_outlined,
            size: 19,
            color: pending > 0 ? Colors.white : faint,
          ),
          label: Text(
            pending > 0 ? 'ໄປອອກໃບຂໍເບີກ ($pending)' : 'ບໍ່ມີອາໄຫຼ່ຄ້າງເບີກ',
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w900,
              color: pending > 0 ? Colors.white : faint,
            ),
          ),
          onPressed: pending > 0 && !busy
              ? () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => SpareRequestScreen(code: widget.code),
                    ),
                  );
                  if (mounted) await load();
                }
              : null,
        ),
      ),
    ),
  );
}
