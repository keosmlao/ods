import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';
import 'approval_detail_screen.dart';

/// **ຄິວອະນຸມັດ** (ຜູ້ຈັດການ) — ບອກວ່າມີຫຍັງຄ້າງລໍການຕັດສິນ.
///
/// ⚠️ **ອະນຸມັດຢູ່ນີ້ບໍ່ໄດ້ຕັ້ງໃຈ**: ການອະນຸມັດແຕະລາຄາ · ສາງ · ERP ແລະ ຂັ້ນຕອນຢູ່ໃນ
/// actions/approval.ts ທີ່ຜູກກັບຟອມ/redirect ຂອງເວັບ. ແອັບຈຶ່ງເປັນ "ກະດິ່ງ + ລາຍການ"
/// ແລ້ວກົດເປີດເວັບໄປຕັດສິນ — ປອດໄພກວ່າການເຮັດ endpoint ອະນຸມັດຄູ່ຂະໜານທີ່ອາດຫຼົ້ນກັນ.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  List<ApprovalItem> items = [];
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => error = '');
    try {
      final rows = await Api.approvals();
      if (mounted) {
        setState(() {
          items = rows;
          loading = false;
        });
      }
    } on ApiError catch (failure) {
      if (mounted) {
        setState(() {
          error = failure.message;
          loading = false;
        });
      }
    } catch (caught) {
      if (mounted) {
        setState(() {
          error = '$caught';
          loading = false;
        });
      }
    }
  }

  /// ເປີດ **ໜ້າລາຍລະອຽດ native** (ບໍ່ເປີດ web ອີກ) — ຕັດສິນຢູ່ນັ້ນໄດ້ເລີຍ,
  /// ກັບມາແລ້ວໂຫຼດຄິວຄືນ (pop ຄືນ true = ມີການປ່ຽນແປງ)
  Future<void> open(ApprovalItem item) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => ApprovalDetailScreen(item: item)),
    );
    if (changed == true) await load();
  }

  /// ອະນຸມັດ — ຢືນຢັນກ່ອນ (ແຕະເອກະສານທີ່ເປັນເງິນ ⇒ ຢ່າໃຫ້ກົດພາດ)
  Future<void> approve(ApprovalItem item) async {
    final quote = item.kind == 'quotation';
    final yes = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(quote ? 'ອະນຸມັດໃບສະເໜີລາຄາ?' : 'ອະນຸມັດການຍົກເລີກ?'),
        content: Text(
          '${item.ref}${item.title != null ? ' · ${item.title}' : ''}'
          '${item.amount != null ? '\nຍອດ ${item.amount} ฿' : ''}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: const Text('ຍົກເລີກ'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: ok),
            onPressed: () => Navigator.pop(dialog, true),
            child: const Text('ຢືນຢັນອະນຸມັດ'),
          ),
        ],
      ),
    );
    if (yes != true) return;
    await _run(
      quote ? 'approve_quote' : 'approve_cancellation',
      item.ref,
    );
  }

  /// ບໍ່ອະນຸມັດ — ຕ້ອງໃສ່ເຫດຜົນ (server ບັງຄັບ)
  Future<void> reject(ApprovalItem item) async {
    final quote = item.kind == 'quotation';
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('ບໍ່ອະນຸມັດ'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'ເຫດຜົນ (ຜູ້ຂໍຕ້ອງຮູ້ວ່າຍ້ອນຫຍັງ)...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog),
            child: const Text('ຍົກເລີກ'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: danger),
            onPressed: () => Navigator.pop(dialog, ctrl.text.trim()),
            child: const Text('ຢືນຢັນບໍ່ອະນຸມັດ'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (reason == null || reason.isEmpty) return;
    await _run(
      quote ? 'reject_quote' : 'reject_cancellation',
      item.ref,
      reason: reason,
    );
  }

  Future<void> _run(String action, String ref, {String reason = ''}) async {
    try {
      await Api.decideApproval(action, ref, reason: reason);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('ບັນທຶກແລ້ວ')));
      }
      await load();
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    }
  }

  /// ຈັດເປັນຫົວຂໍ້ຕາມ kind — ຮຽງ ໃບສະເໜີລາຄາ ກ່ອນ ຂໍຍົກເລີກ (ສະແດງແຕ່ຫົວຂໍ້ທີ່ມີ)
  List<_ApprovalGroup> get _grouped {
    final out = <_ApprovalGroup>[];
    for (final meta in _kindOrder) {
      final list = items.where((i) => i.kind == meta.kind).toList();
      if (list.isNotEmpty) out.add(_ApprovalGroup(meta, list));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final quotes = items.where((i) => i.kind == 'quotation').length;
    final cancels = items.length - quotes;

    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ຄິວອະນຸມັດ',
            trailing: [HeroIconButton(icon: Icons.refresh_rounded, onTap: load)],
            stats: [
              HeroStat(value: '${items.length}', label: 'ລໍອະນຸມັດ'),
              HeroStat(
                value: '$quotes',
                label: 'ໃບສະເໜີລາຄາ',
                color: const Color(0xFFFDBA74),
              ),
              HeroStat(
                value: '$cancels',
                label: 'ຂໍຍົກເລີກ',
                color: const Color(0xFF6EE7B7),
              ),
            ],
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: load,
                    child: error.isNotEmpty
                        ? _message(Icons.cloud_off_rounded, error)
                        : items.isEmpty
                        ? _message(Icons.task_alt_rounded, 'ບໍ່ມີລາຍການລໍອະນຸມັດ')
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(14, 6, 14, 20),
                            children: [
                              // ແຍກເປັນຫົວຂໍ້ — ໃບສະເໜີລາຄາ · ຂໍຍົກເລີກ (ຄິວຄົນລະຊະນິດ)
                              for (final group in _grouped) ...[
                                _SectionHeader(meta: group.meta, count: group.items.length),
                                for (final item in group.items) ...[
                                  _ApprovalCard(
                                    item: item,
                                    onOpen: () => open(item),
                                    onApprove: () => approve(item),
                                    onReject: () => reject(item),
                                  ),
                                  const SizedBox(height: 10),
                                ],
                                const SizedBox(height: 6),
                              ],
                            ],
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  /// ຂໍ້ຄວາມກາງຈໍ — ຫໍ່ດ້ວຍ ListView ໃຫ້ດຶງ refresh ໄດ້ເຖິງຈະຫວ່າງ
  Widget _message(IconData icon, String text) => ListView(
    padding: const EdgeInsets.only(top: 90),
    children: [
      Icon(icon, size: 52, color: const Color(0xFFCBD5E1)),
      const SizedBox(height: 12),
      Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(color: muted, fontWeight: FontWeight.w700),
      ),
    ],
  );
}

/// ຫົວຂໍ້ຄິວອະນຸມັດ — ໃບສະເໜີລາຄາ · ຂໍຍົກເລີກ
class _KindMeta {
  final String kind;
  final String label;
  final IconData icon;
  final Color color;
  const _KindMeta(this.kind, this.label, this.icon, this.color);
}

const _kindOrder = [
  _KindMeta('quotation', 'ໃບສະເໜີລາຄາ', Icons.request_quote_outlined, Color(0xFF7C3AED)),
  _KindMeta('cancellation', 'ຂໍຍົກເລີກໃບຮັບເຄື່ອງ', Icons.cancel_outlined, danger),
];

class _ApprovalGroup {
  final _KindMeta meta;
  final List<ApprovalItem> items;
  const _ApprovalGroup(this.meta, this.items);
}

/// ຫົວກຸ່ມ — ໄອຄອນສີ + ຊື່ຫົວຂໍ້ + ຈຳນວນ
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.meta, required this.count});
  final _KindMeta meta;
  final int count;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 10, 2, 8),
    child: Row(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: meta.color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(meta.icon, size: 17, color: meta.color),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            meta.label,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w800,
              color: ink,
              letterSpacing: -.2,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
          decoration: BoxDecoration(
            color: meta.color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '$count',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: meta.color,
            ),
          ),
        ),
      ],
    ),
  );
}

class _ApprovalCard extends StatelessWidget {
  const _ApprovalCard({
    required this.item,
    required this.onOpen,
    required this.onApprove,
    required this.onReject,
  });
  final ApprovalItem item;
  final VoidCallback onOpen;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final quote = item.kind == 'quotation';
    final accent = quote ? const Color(0xFF7C3AED) : danger;
    // ຄ້າງເກີນ 3 ມື້ = ຖ່ວງງານແທ້ ⇒ ເນັ້ນສີແດງ
    final late = item.days >= 3;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: const Color(0xFFE2E9E6)),
      ),
      child: Material(
        color: Colors.transparent,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ແຖບສີຊະນິດ (ບໍ່ຕ້ອງມີ chip ຊ້ຳ — ຫົວກຸ່ມບອກແລ້ວ)
              Container(width: 4, color: accent),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    InkWell(
                      onTap: onOpen,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 11, 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ຫົວ: ເລກອ້າງອີງ + ຄ້າງມາ + ລິ້ງເບິ່ງ
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item.ref,
                                    style: const TextStyle(
                                      color: ink,
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                Icon(Icons.schedule_rounded, size: 11, color: late ? danger : faint),
                                const SizedBox(width: 3),
                                Text(
                                  item.waitingLabel,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: late ? danger : faint,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Icon(Icons.open_in_new_rounded, color: accent, size: 13),
                              ],
                            ),
                            const SizedBox(height: 8),
                            // ── ຂໍ້ມູນເປັນສັດສ່ວນ: ປ້າຍ (ຖັນຊ້າຍ) : ຄ່າ (ຖັນຂວາ) ຮຽງຕົງກັນ ──
                            _Field(label: 'ສິນຄ້າ', value: item.title ?? '-', strong: true),
                            if ((item.customer ?? '').isNotEmpty)
                              _Field(label: 'ລູກຄ້າ', value: item.customer!),
                            if (item.requestedAt != null)
                              _Field(label: 'ວັນທີ່ຂໍ', value: item.requestedAt!),
                            if ((item.amount ?? '').isNotEmpty)
                              _Field(label: 'ຍອດ', value: '${item.amount} ฿', strong: true, accent: accent),
                          ],
                        ),
                      ),
                    ),
                    // ── ປຸ່ມຕັດສິນ — ຫຍໍ້ ──
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 0, 10, 9),
                      child: Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: onReject,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: danger,
                                minimumSize: const Size.fromHeight(34),
                                padding: EdgeInsets.zero,
                                side: BorderSide(color: danger.withValues(alpha: .35)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                              ),
                              icon: const Icon(Icons.close_rounded, size: 15),
                              label: const Text('ບໍ່ອະນຸມັດ', style: TextStyle(fontSize: 11.5)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: onApprove,
                              style: FilledButton.styleFrom(
                                backgroundColor: ok,
                                minimumSize: const Size.fromHeight(34),
                                padding: EdgeInsets.zero,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                              ),
                              icon: const Icon(Icons.check_rounded, size: 16),
                              label: const Text('ອະນຸມັດ', style: TextStyle(fontSize: 11.5)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ແຖວ ປ້າຍ : ຄ່າ ແບບເປັນສັດສ່ວນ — ປ້າຍຖັນຊ້າຍກ້ວາງຄົງທີ່ ⇒ ຄ່າຮຽງຕົງກັນທຸກແຖວ
class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.value,
    this.strong = false,
    this.accent,
  });
  final String label;
  final String value;
  final bool strong;
  final Color? accent;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 3),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 54,
          child: Text(
            label,
            style: const TextStyle(fontSize: 10.5, color: faint, fontWeight: FontWeight.w600),
          ),
        ),
        Expanded(
          child: Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: strong ? 12.5 : 11.5,
              height: 1.25,
              color: accent ?? ink,
              fontWeight: strong ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
        ),
      ],
    ),
  );
}
