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

  /// ເປີດໜ້າຕັດສິນຢູ່ເວັບ (ໃຊ້ server ອັນດຽວກັບທີ່ແອັບຕໍ່ຢູ່)
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
                            itemBuilder: (_, i) =>
                                _ApprovalCard(item: items[i], onOpen: () => open(items[i])),
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
  const _ApprovalCard({required this.item, required this.onOpen});
  final ApprovalItem item;
  final VoidCallback onOpen;

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
        child: InkWell(
          onTap: onOpen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(height: 4, color: accent),
              Padding(
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
                    const SizedBox(height: 11),
                    Row(
                      children: [
                        if ((item.amount ?? '').isNotEmpty)
                          Text(
                            '${item.amount} ฿',
                            style: const TextStyle(
                              color: ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: .10),
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Row(
                            children: [
                              Text(
                                'ໄປຕັດສິນຢູ່ເວັບ',
                                style: TextStyle(
                                  color: accent,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(width: 3),
                              Icon(Icons.open_in_new_rounded, color: accent, size: 13),
                            ],
                          ),
                        ),
                      ],
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
