import 'package:flutter/material.dart';
import '../api.dart';
import '../main.dart';
import 'approval_detail_screen.dart';

/// **ຄິວອະນຸມັດ** (ຜູ້ຈັດການ) — ບອກວ່າມີຫຍັງຄ້າງລໍການຕັດສິນ.
///
/// ທັງ 4 ຂະບວນການເປັນ native: ເບິ່ງລາຍລະອຽດ ແລະ ຕັດສິນໃນແອັບ.
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
    await _run(quote ? 'approve_quote' : 'approve_cancellation', item.ref);
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

  @override
  Widget build(BuildContext context) {
    final quotes = items.where((i) => i.kind == 'quotation').length;
    final cancels = items.length - quotes;

    return Scaffold(
      backgroundColor: ground,
      body: SafeArea(
        child: DefaultTabController(
          length: _kindOrder.length,
          child: Column(
            children: [
              _ApprovalAppBar(onRefresh: load),
              if (!loading && error.isEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                  child: _ApprovalSummary(
                    total: items.length,
                    quotes: quotes,
                    cancels: cancels,
                  ),
                ),
              // ── ປຸ່ມແຍກ menu ແຕ່ລະຫົວຂໍ້ອະນຸມັດ (tab): ໃບສະເໜີລາຄາ · ຂໍຍົກເລີກ ──
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 14),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: surfaceAlt,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  labelColor: ink,
                  unselectedLabelColor: muted,
                  dividerColor: Colors.transparent,
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicator: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: [
                      BoxShadow(
                        color: ink.withValues(alpha: .07),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  labelPadding: EdgeInsets.zero,
                  labelStyle: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 11.5,
                  ),
                  tabs: [
                    for (final meta in _kindOrder)
                      Tab(
                        height: 40,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const SizedBox(width: 11),
                            Icon(meta.icon, size: 16),
                            const SizedBox(width: 5),
                            Text(meta.short),
                            const SizedBox(width: 5),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 1.5,
                              ),
                              decoration: BoxDecoration(
                                color: meta.color.withValues(alpha: .12),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '${items.where((i) => i.kind == meta.kind).length}',
                                style: TextStyle(
                                  color: meta.color,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            const SizedBox(width: 11),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Expanded(
                child: loading
                    ? const Center(
                        child: CircularProgressIndicator(color: teal),
                      )
                    : error.isNotEmpty
                    ? _message(Icons.cloud_off_rounded, error)
                    : TabBarView(
                        children: [
                          for (final meta in _kindOrder) _kindList(meta),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// ລາຍການອະນຸມັດ 1 ຫົວຂໍ້ (tab) — ຫວ່າງ = ຂໍ້ຄວາມ
  Widget _kindList(_KindMeta meta) {
    final list = items.where((i) => i.kind == meta.kind).toList();
    return RefreshIndicator(
      onRefresh: load,
      child: list.isEmpty
          ? _message(meta.icon, 'ບໍ່ມີ ${meta.label} ລໍອະນຸມັດ')
          : ListView(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 20),
              children: [
                for (final item in list) ...[
                  _ApprovalCard(
                    item: item,
                    onOpen: () => open(item),
                    onApprove: () => approve(item),
                    onReject: () => reject(item),
                  ),
                  const SizedBox(height: 10),
                ],
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

class _ApprovalAppBar extends StatelessWidget {
  const _ApprovalAppBar({required this.onRefresh});
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(18, 10, 12, 10),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: line)),
    ),
    child: Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: const Color(0xFFFFEDD5),
            borderRadius: BorderRadius.circular(13),
          ),
          child: const Icon(Icons.fact_check_rounded, color: warn, size: 22),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ຄິວອະນຸມັດ',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: ink,
                ),
              ),
              Text(
                'ກວດສອບ ແລະ ຕັດສິນຄຳຂໍ',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: muted,
                ),
              ),
            ],
          ),
        ),
        IconButton.filledTonal(
          onPressed: onRefresh,
          tooltip: 'ໂຫຼດໃໝ່',
          style: IconButton.styleFrom(
            backgroundColor: surfaceAlt,
            foregroundColor: ink,
          ),
          icon: const Icon(Icons.refresh_rounded, size: 20),
        ),
      ],
    ),
  );
}

class _ApprovalSummary extends StatelessWidget {
  const _ApprovalSummary({
    required this.total,
    required this.quotes,
    required this.cancels,
  });
  final int total;
  final int quotes;
  final int cancels;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(17),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF431407), Color(0xFF9A3412)],
      ),
      borderRadius: BorderRadius.circular(22),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF7C2D12).withValues(alpha: .18),
          blurRadius: 20,
          offset: const Offset(0, 8),
        ),
      ],
    ),
    child: Row(
      children: [
        Expanded(
          flex: 13,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'ລໍການຕັດສິນ',
                style: TextStyle(
                  color: Color(0xFFFED7AA),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                '$total',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  height: 1.05,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
        _ApprovalStat(
          value: '$quotes',
          label: 'ລາຄາ',
          color: const Color(0xFFFDE68A),
        ),
        Container(
          width: 1,
          height: 40,
          margin: const EdgeInsets.symmetric(horizontal: 12),
          color: Colors.white.withValues(alpha: .14),
        ),
        _ApprovalStat(
          value: '$cancels',
          label: 'ຍົກເລີກ',
          color: const Color(0xFFFDA4AF),
        ),
      ],
    ),
  );
}

class _ApprovalStat extends StatelessWidget {
  const _ApprovalStat({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: TextStyle(
          color: color,
          fontSize: 20,
          height: 1,
          fontWeight: FontWeight.w900,
        ),
      ),
      const SizedBox(height: 4),
      Text(
        label,
        style: TextStyle(
          color: Colors.white.withValues(alpha: .65),
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

/// ຫົວຂໍ້ຄິວອະນຸມັດ — ໃບສະເໜີລາຄາ · ຂໍຍົກເລີກ · ໃບຂໍຊື້ · ໃບສັ່ງຊື້
class _KindMeta {
  final String kind;
  final String label;
  final String short; // ປ້າຍສັ້ນສຳລັບ tab
  final IconData icon;
  final Color color;
  const _KindMeta(this.kind, this.label, this.short, this.icon, this.color);
}

const _kindOrder = [
  _KindMeta(
    'quotation',
    'ໃບສະເໜີລາຄາ',
    'ໃບສະເໜີລາຄາ',
    Icons.request_quote_outlined,
    Color(0xFF7C3AED),
  ),
  _KindMeta(
    'cancellation',
    'ຂໍຍົກເລີກໃບຮັບເຄື່ອງ',
    'ຂໍຍົກເລີກ',
    Icons.cancel_outlined,
    danger,
  ),
  // ເພີ່ມ 31-07-2026 — ແຕ່ກ່ອນ 2 ອັນນີ້ບໍ່ມີໃນແອັບເລີຍ ⇒ ຜູ້ຈັດການບໍ່ເຫັນໃບສັ່ງຊື້
  _KindMeta(
    'purchase-request',
    'ໃບຂໍຊື້ (SPR)',
    'ໃບຂໍຊື້',
    Icons.playlist_add_check_rounded,
    Color(0xFF0891B2),
  ),
  _KindMeta(
    'purchase-order',
    'ໃບສັ່ງຊື້ (PO)',
    'ໃບສັ່ງຊື້',
    Icons.local_shipping_outlined,
    Color(0xFFD97706),
  ),
];

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
    final accent = _kindOrder
        .firstWhere((m) => m.kind == item.kind, orElse: () => _kindOrder.first)
        .color;
    // ຄ້າງເກີນ 3 ມື້ = ຖ່ວງງານແທ້ ⇒ ເນັ້ນສີແດງ
    final late = item.days >= 3;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: line),
        boxShadow: [
          BoxShadow(
            color: ink.withValues(alpha: .035),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ແຖບສີຊະນິດ (ບໍ່ຕ້ອງມີ chip ຊ້ຳ — ຫົວກຸ່ມບອກແລ້ວ)
              Container(width: 5, color: late ? danger : accent),
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
                                Container(
                                  width: 32,
                                  height: 32,
                                  margin: const EdgeInsets.only(right: 9),
                                  decoration: BoxDecoration(
                                    color: accent.withValues(alpha: .1),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(
                                    _kindOrder
                                        .firstWhere(
                                          (m) => m.kind == item.kind,
                                          orElse: () => _kindOrder.first,
                                        )
                                        .icon,
                                    size: 17,
                                    color: accent,
                                  ),
                                ),
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
                                Icon(
                                  Icons.schedule_rounded,
                                  size: 11,
                                  color: late ? danger : faint,
                                ),
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
                                Icon(
                                  Icons.chevron_right_rounded,
                                  color: accent,
                                  size: 13,
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            // ── ຂໍ້ມູນເປັນສັດສ່ວນ: ປ້າຍ (ຖັນຊ້າຍ) : ຄ່າ (ຖັນຂວາ) ຮຽງຕົງກັນ ──
                            _Field(
                              label: 'ສິນຄ້າ',
                              value: item.title ?? '-',
                              strong: true,
                            ),
                            if ((item.customer ?? '').isNotEmpty)
                              _Field(label: 'ລູກຄ້າ', value: item.customer!),
                            if (item.requestedAt != null)
                              _Field(
                                label: 'ວັນທີ່ຂໍ',
                                value: item.requestedAt!,
                              ),
                            if ((item.amount ?? '').isNotEmpty)
                              _Field(
                                label: 'ຍອດ',
                                value: '${item.amount} ฿',
                                strong: true,
                                accent: accent,
                              ),
                          ],
                        ),
                      ),
                    ),
                    // ── ປຸ່ມຕັດສິນ — ຫຍໍ້ ──
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 0, 10, 9),
                      child:
                          (item.kind == 'purchase-request' ||
                              item.kind == 'purchase-order')
                          ? OutlinedButton.icon(
                              onPressed: onOpen,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: accent,
                                minimumSize: const Size.fromHeight(42),
                                padding: EdgeInsets.zero,
                                side: BorderSide(
                                  color: accent.withValues(alpha: .35),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(9),
                                ),
                              ),
                              icon: const Icon(
                                Icons.fact_check_outlined,
                                size: 15,
                              ),
                              label: const Text(
                                'ເບິ່ງລາຍລະອຽດ ແລະ ຕັດສິນ',
                                style: TextStyle(fontSize: 11.5),
                              ),
                            )
                          : Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: onReject,
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: danger,
                                      minimumSize: const Size.fromHeight(42),
                                      padding: EdgeInsets.zero,
                                      side: BorderSide(
                                        color: danger.withValues(alpha: .35),
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(9),
                                      ),
                                    ),
                                    icon: const Icon(
                                      Icons.close_rounded,
                                      size: 15,
                                    ),
                                    label: const Text(
                                      'ບໍ່ອະນຸມັດ',
                                      style: TextStyle(fontSize: 11.5),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton.icon(
                                    onPressed: onApprove,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: ok,
                                      minimumSize: const Size.fromHeight(42),
                                      padding: EdgeInsets.zero,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(9),
                                      ),
                                    ),
                                    icon: const Icon(
                                      Icons.check_rounded,
                                      size: 16,
                                    ),
                                    label: const Text(
                                      'ອະນຸມັດ',
                                      style: TextStyle(fontSize: 11.5),
                                    ),
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
            style: const TextStyle(
              fontSize: 10.5,
              color: faint,
              fontWeight: FontWeight.w600,
            ),
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
