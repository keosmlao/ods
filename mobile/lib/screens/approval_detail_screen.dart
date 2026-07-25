import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// **ລາຍລະອຽດການອະນຸມັດ (native)** — ບໍ່ເປີດ web ອີກ.
/// ໃບສະເໜີ = ຫົວ + ລາຍການ+ລາຄາ · ຂໍຍົກເລີກ = ຫົວ + ເຫດຜົນ + ອາໄຫຼ່ຄ້າງ.
/// ອະນຸມັດ/ບໍ່ອະນຸມັດ ໄດ້ຈາກໜ້ານີ້ເລີຍ.
class ApprovalDetailScreen extends StatefulWidget {
  const ApprovalDetailScreen({super.key, required this.item});
  final ApprovalItem item;

  @override
  State<ApprovalDetailScreen> createState() => _ApprovalDetailScreenState();
}

class _ApprovalDetailScreenState extends State<ApprovalDetailScreen> {
  ApprovalDetail? detail;
  String error = '';
  bool busy = false;

  bool get quote => widget.item.kind == 'quotation';
  Color get accent => quote ? const Color(0xFF7C3AED) : danger;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => error = '');
    try {
      final d = await Api.approvalDetail(widget.item.kind, widget.item.ref);
      if (mounted) setState(() => detail = d);
    } on ApiError catch (f) {
      if (mounted) setState(() => error = f.message);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> _decide(String action, {String reason = ''}) async {
    setState(() => busy = true);
    try {
      await Api.decideApproval(action, widget.item.ref, reason: reason);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('ບັນທຶກແລ້ວ')));
      Navigator.pop(context, true); // ບອກໜ້າຄິວໃຫ້ໂຫຼດຄືນ
    } on ApiError catch (f) {
      if (mounted) {
        setState(() => busy = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(f.message), backgroundColor: danger),
        );
      }
    }
  }

  Future<void> approve() async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(quote ? 'ອະນຸມັດໃບສະເໜີລາຄາ?' : 'ອະນຸມັດການຍົກເລີກ?'),
        content: Text('${widget.item.ref}${detail?.amount != null ? '\nຍອດ ${detail!.amount} ฿' : ''}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('ຍົກເລີກ')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: ok),
            onPressed: () => Navigator.pop(d, true),
            child: const Text('ຢືນຢັນອະນຸມັດ'),
          ),
        ],
      ),
    );
    if (yes == true) {
      await _decide(quote ? 'approve_quote' : 'approve_cancellation');
    }
  }

  Future<void> reject() async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('ບໍ່ອະນຸມັດ'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'ເຫດຜົນ (ຜູ້ຂໍຕ້ອງຮູ້)...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d), child: const Text('ຍົກເລີກ')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: danger),
            onPressed: () => Navigator.pop(d, ctrl.text.trim()),
            child: const Text('ຢືນຢັນບໍ່ອະນຸມັດ'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (reason != null && reason.isNotEmpty) {
      await _decide(quote ? 'reject_quote' : 'reject_cancellation', reason: reason);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = detail;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            eyebrow: quote ? 'ໃບສະເໜີລາຄາ' : 'ຂໍຍົກເລີກໃບຮັບເຄື່ອງ',
            title: widget.item.ref,
            onBack: () => Navigator.pop(context),
          ),
          Expanded(
            child: error.isNotEmpty
                ? _msg(Icons.cloud_off_rounded, error)
                : d == null
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                    children: [
                      // ── ຂໍ້ມູນເຄື່ອງ / ລູກຄ້າ ──
                      _Card(
                        children: [
                          _row('ສິນຄ້າ', [d.product, d.brand, d.model].where((x) => (x ?? '').isNotEmpty).join(' · ')),
                          _row('SN', d.sn),
                          _row('ຮັບປະກັນ', d.warranty),
                          _row('ລູກຄ້າ', d.customer),
                          _row('ເບີໂທ', d.tel),
                          _row('ອາການແຈ້ງ', d.symptom),
                          _row('ຜົນວິເຄາະ', d.diagnosis),
                          _row('ຜູ້ຂໍ', d.requestedBy),
                          _row('ວັນທີ່ຂໍ', d.requestedAt),
                          if (d.reason != null) _row('ເຫດຜົນຍົກເລີກ', d.reason),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // ── ລາຍການ (ໃບສະເໜີ = ສິນຄ້າ+ລາຄາ · ຂໍຍົກເລີກ = ອາໄຫຼ່ຄ້າງ) ──
                      _Card(
                        children: [
                          Row(
                            children: [
                              Icon(quote ? Icons.receipt_long_outlined : Icons.inventory_2_outlined, size: 18, color: accent),
                              const SizedBox(width: 8),
                              Text(
                                quote ? 'ລາຍການທີ່ສະເໜີ' : 'ອາໄຫຼ່ຄ້າງນອກສາງ',
                                style: const TextStyle(fontWeight: FontWeight.w800, color: ink, fontSize: 14),
                              ),
                              const Spacer(),
                              Text('${d.lines.length}', style: const TextStyle(color: faint, fontSize: 12)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          if (d.lines.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 6),
                              child: Text('ບໍ່ມີລາຍການ', style: TextStyle(color: faint, fontSize: 12.5)),
                            )
                          else
                            for (final l in d.lines) _LineRow(line: l, showPrice: quote),
                        ],
                      ),

                      // ── ຍອດ (ໃບສະເໜີ) ──
                      if (quote && (d.amount ?? '').isNotEmpty) ...[
                        const SizedBox(height: 12),
                        _Card(
                          children: [
                            if ((d.discount ?? '0') != '0' && d.discount != null)
                              _money('ສ່ວນຫຼຸດ', '${d.discount} ฿', muted),
                            _money('ຍອດລວມ', '${d.amount} ฿', ink, big: true),
                            if ((d.amountKip ?? '').isNotEmpty && d.amountKip != '0')
                              _money('≈ ກີບ', '${d.amountKip} ₭', faint),
                          ],
                        ),
                      ],
                    ],
                  ),
          ),

          // ── ປຸ່ມຕັດສິນ ຕິດລຸ່ມ ──
          if (d != null)
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: line)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: busy ? null : reject,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: danger,
                          minimumSize: const Size.fromHeight(50),
                          side: BorderSide(color: danger.withValues(alpha: .4)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                        ),
                        icon: const Icon(Icons.close_rounded, size: 19),
                        label: const Text('ບໍ່ອະນຸມັດ', style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: busy ? null : approve,
                        style: FilledButton.styleFrom(
                          backgroundColor: ok,
                          minimumSize: const Size.fromHeight(50),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)),
                        ),
                        icon: busy
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.check_rounded, size: 20),
                        label: const Text('ອະນຸມັດ', style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _msg(IconData icon, String text) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: const Color(0xFFCBD5E1)),
          const SizedBox(height: 10),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: muted)),
          const SizedBox(height: 12),
          OutlinedButton.icon(onPressed: load, icon: const Icon(Icons.refresh), label: const Text('ລອງໃໝ່')),
        ],
      ),
    ),
  );

  Widget _row(String label, String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 84, child: Text(label, style: const TextStyle(fontSize: 11.5, color: faint))),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 12.5, height: 1.3, color: ink, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  Widget _money(String label, String value, Color color, {bool big = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(child: Text(label, style: TextStyle(fontSize: big ? 13 : 12, color: big ? ink : muted, fontWeight: big ? FontWeight.w800 : FontWeight.w500))),
        Text(value, style: TextStyle(fontSize: big ? 17 : 12.5, color: color, fontWeight: FontWeight.w900)),
      ],
    ),
  );
}

class _LineRow extends StatelessWidget {
  const _LineRow({required this.line, required this.showPrice});
  final ApprovalLine line;
  final bool showPrice;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(line.name ?? '-', style: const TextStyle(fontSize: 12.5, color: ink, fontWeight: FontWeight.w600)),
              Text(
                'x${line.qty}${line.unit != null ? ' ${line.unit}' : ''}'
                '${showPrice && line.price != null ? ' · ${line.price} ฿/ໜ່ວຍ' : ''}',
                style: const TextStyle(fontSize: 10.5, color: faint),
              ),
            ],
          ),
        ),
        if (showPrice && line.total != null)
          Text('${line.total} ฿', style: const TextStyle(fontSize: 12.5, color: ink, fontWeight: FontWeight.w800)),
      ],
    ),
  );
}

/// ກາດຂາວມົນ — ຄືກັບໜ້າອື່ນ
class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: cardDecoration(),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
  );
}
