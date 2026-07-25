import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

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

  /// ເປີດໜ້າລາຍລະອຽດຢູ່ເວັບ (ເບິ່ງລາຍການ/ໃບເຕັມ ກ່ອນຕັດສິນ)
  Future<void> open(ApprovalItem item) async {
    final base = await Api.serverUrl();
    final uri = Uri.parse('$base${item.href}');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ເປີດເວັບບໍ່ໄດ້'), backgroundColor: danger),
        );
      }
    }
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
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(14, 14, 14, 20),
                            itemCount: items.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (_, i) => _ApprovalCard(
                              item: items[i],
                              onOpen: () => open(items[i]),
                              onApprove: () => approve(items[i]),
                              onReject: () => reject(items[i]),
                            ),
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
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDDE6E3)),
        boxShadow: const [
          BoxShadow(color: Color(0x0D0F172A), blurRadius: 14, offset: Offset(0, 5)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(height: 4, color: accent),
            InkWell(
              onTap: onOpen,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 11, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: .11),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Text(
                            item.kindLabel,
                            style: TextStyle(
                              color: accent,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
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
                        Text(
                          item.waitingLabel,
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: late ? danger : faint,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 9),
                    Text(
                      item.title ?? '-',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: ink,
                        fontSize: 14,
                        height: 1.3,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if ((item.customer ?? '').isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        item.customer!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: muted, fontSize: 11.5),
                      ),
                    ],
                      if ((item.amount ?? '').isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Text(
                              '${item.amount} ฿',
                              style: const TextStyle(
                                color: ink,
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const Spacer(),
                            // ແຕະບ່ອນນີ້ = ເປີດເວັບເບິ່ງລາຍການເຕັມກ່ອນຕັດສິນ
                            Row(
                              children: [
                                Text(
                                  'ເບິ່ງລາຍລະອຽດ',
                                  style: TextStyle(
                                    color: faint,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(width: 3),
                                const Icon(Icons.open_in_new_rounded, color: faint, size: 12),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // ── ປຸ່ມຕັດສິນ: ບໍ່ອະນຸມັດ (ຮອງ) · ອະນຸມັດ (ຫຼັກ) ──
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onReject,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: danger,
                          minimumSize: const Size.fromHeight(42),
                          side: BorderSide(color: danger.withValues(alpha: .35)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(11),
                          ),
                        ),
                        icon: const Icon(Icons.close_rounded, size: 17),
                        label: const Text('ບໍ່ອະນຸມັດ', style: TextStyle(fontSize: 12.5)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onApprove,
                        style: FilledButton.styleFrom(
                          backgroundColor: ok,
                          minimumSize: const Size.fromHeight(42),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(11),
                          ),
                        ),
                        icon: const Icon(Icons.check_rounded, size: 18),
                        label: const Text('ອະນຸມັດ', style: TextStyle(fontSize: 12.5)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
    );
  }
}
