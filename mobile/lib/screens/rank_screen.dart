import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// **ອັນດັບຊ່າງປະຈຳເດືອນ** — ຮຽງຕາມ **ຈຳນວນໃບທີ່ປິດ** (ບໍ່ແມ່ນເງິນ).
///
/// ເປັນຫຍັງຮຽງດ້ວຍໃບ: ຈຸດປະສົງຂອງລະບົບຄືໃຫ້ວຽກຄ້າງຫຼຸດລົງ — ຄົນທີ່ໄດ້ໃບໃຫຍ່ 2 ໃບ
/// ບໍ່ຄວນຢູ່ເໜືອຄົນທີ່ຈົບ 20 ໃບ. ຈຳນວນເງິນຂອງຄົນອື່ນເຫັນ/ບໍ່ເຫັນ ຜູ້ຈັດການເລືອກໄດ້
/// (ຕັ້ງຄ່າ `mobile_rank_money`) — ຄ່າຕັ້ງຕົ້ນເຫັນແຕ່ຂອງຕົນເອງ.
class RankScreen extends StatefulWidget {
  const RankScreen({super.key});

  @override
  State<RankScreen> createState() => _RankScreenState();
}

class _RankScreenState extends State<RankScreen> {
  TechRank? data;
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final rows = await Api.rank();
      if (mounted) setState(() { data = rows; error = ''; loading = false; });
    } on ApiError catch (failure) {
      if (mounted) setState(() { error = failure.message; loading = false; });
    } catch (_) {
      if (mounted) setState(() { error = 'ໂຫຼດອັນດັບບໍ່ສຳເລັດ'; loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final rank = data;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            eyebrow: 'ອັນດັບຊ່າງ',
            title: rank == null ? 'ເດືອນນີ້' : 'ເດືອນ ${rank.month}',
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error.isNotEmpty
                ? StateBlock(
                    icon: Icons.cloud_off_rounded,
                    message: error,
                    action: FilledButton(onPressed: load, child: const Text('ລອງໃໝ່')),
                  )
                : rank == null || rank.rows.isEmpty
                ? const StateBlock(
                    icon: Icons.emoji_events_outlined,
                    message: 'ເດືອນນີ້ຍັງບໍ່ມີໃບປິດ',
                    detail: 'ຈົບໃບທຳອິດ ແລ້ວຊື່ຂອງເຈົ້າຈະຂຶ້ນມາ',
                  )
                : RefreshIndicator(onRefresh: load, child: _list(rank)),
          ),
        ],
      ),
    );
  }

  Widget _list(TechRank rank) {
    final top = rank.rows.take(3).toList();
    final rest = rank.rows.skip(3).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
      children: [
        if (rank.myRank > 0) _myCard(rank),
        if (rank.myRank > 0) const SizedBox(height: 16),
        _podium(top, rank.showMoney),
        const SizedBox(height: 16),
        if (rest.isNotEmpty) ...[
          const BandHeader('ອັນດັບທັງໝົດ'),
          const SizedBox(height: 8),
          for (final row in rest) ...[_row(row, rank.showMoney), const SizedBox(height: 8)],
        ],
      ],
    );
  }

  /// ກາດ "ຂອງເຈົ້າ" — ບໍ່ຕ້ອງໄລ່ຫາຕົນເອງໃນລາຍການ
  Widget _myCard(TechRank rank) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: tealTint,
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: teal),
    ),
    child: Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('ອັນດັບຂອງເຈົ້າ', style: TextStyle(fontSize: 12, color: muted)),
            Text(
              '#${rank.myRank}',
              style: const TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                color: tealBright,
                height: 1.1,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
        const SizedBox(width: 18),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${rank.myJobs} ໃບ · ${_thb(rank.myTotalThb)} ບາທ',
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: ink),
              ),
              const SizedBox(height: 4),
              Text(
                rank.jobsToNext == null
                    ? 'ເຈົ້າຢູ່ອັນດັບ 1 ຂອງເດືອນນີ້ 🏆'
                    : 'ອີກ ${rank.jobsToNext} ໃບ ຈະແຊງຄົນເໜືອໜ້າ',
                style: const TextStyle(fontSize: 12.5, color: body),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _podium(List<RankRow> top, bool money) {
    // ຮຽງໃໝ່ໃຫ້ອັນດັບ 1 ຢູ່ກາງ (ຮູບແບບແທ່ນຮັບລາງວັນ)
    final order = <RankRow?>[
      top.length > 1 ? top[1] : null,
      top.isNotEmpty ? top[0] : null,
      top.length > 2 ? top[2] : null,
    ];
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (final row in order)
          Expanded(
            child: row == null
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: _podiumCard(row, money),
                  ),
          ),
      ],
    );
  }

  Widget _podiumCard(RankRow row, bool money) {
    final first = row.rank == 1;
    return Container(
      padding: EdgeInsets.fromLTRB(8, first ? 18 : 12, 8, 12),
      decoration: BoxDecoration(
        color: first ? tealTint : surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: first ? teal : line),
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: first ? teal : surfaceAlt,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              row.name.characters.first.toUpperCase(),
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 15,
                color: first ? onAccent : body,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            row.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: ink),
          ),
          const SizedBox(height: 2),
          Text(
            '${row.jobs} ໃບ',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: first ? tealBright : teal,
            ),
          ),
          Text(
            first ? '🥇' : '#${row.rank}',
            style: const TextStyle(fontSize: 11, color: faint),
          ),
          if (money && row.totalThb != null)
            Text(
              '${_thb(row.totalThb!)} ບາທ',
              style: const TextStyle(fontSize: 10.5, color: faint),
            ),
        ],
      ),
    );
  }

  Widget _row(RankRow row, bool money) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
    decoration: BoxDecoration(
      color: row.me ? tealTint : surface,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: row.me ? teal : line),
    ),
    child: Row(
      children: [
        SizedBox(
          width: 24,
          child: Text(
            '${row.rank}',
            style: const TextStyle(
              color: faint,
              fontWeight: FontWeight.w800,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ),
        Expanded(
          child: Text(
            row.me ? '${row.name} (ເຈົ້າ)' : row.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: ink),
          ),
        ),
        Text('${row.jobs} ໃບ', style: const TextStyle(fontSize: 12, color: muted)),
        if (row.totalThb != null) ...[
          const SizedBox(width: 10),
          Text(
            _thb(row.totalThb!),
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w900,
              color: teal,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ],
    ),
  );

  static String _thb(double value) {
    final whole = value.round().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
      buffer.write(whole[i]);
    }
    return buffer.toString();
  }
}
