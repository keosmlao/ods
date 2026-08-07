import 'package:flutter/material.dart';

import '../api.dart';
import '../app_links.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// **ກ່ອງແຈ້ງເຕືອນ** — ອ່ານຈາກຕາຕະລາງດຽວກັບເວັບ (ods_notification).
///
/// ── ເປັນຫຍັງຕ້ອງມີ ──
/// ແອັບມີແຕ່ **push**: ຖ້າຊ່າງປັດຖິ້ມ ຫຼື ມືຖືປິດຢູ່ຕອນນັ້ນ **ຂໍ້ຄວາມຫາຍໄປເລີຍ**
/// (ເຊັ່ນ "ມີງານໃໝ່" · "ເຫຼືອ 6 ຊມ ຈະຄົບ 24 ຊມ" · "ສາງເບີກອາໄຫຼ່ໃຫ້ແລ້ວ").
/// ໜ້ານີ້ຄືບ່ອນທີ່ຂໍ້ຄວາມນອນຢູ່ຈົນກວ່າຊ່າງຈະໄດ້ອ່ານ.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> rows = [];
  bool unreadOnly = true;
  bool loading = true;
  String? error;
  int unreadCount = 0;

  /// ── ໂຫຼດຕໍ່ (07-08-2026) ──
  /// ຜູ້ຈັດການໄດ້ຮັບ 600+ ແຖວ/ມື້ ແຕ່ໜ້ານີ້ເຄີຍໂຊ້ວແຕ່ 30 ອັນລ່າສຸດ ແລ້ວຈົບ
  /// ⇒ "ບໍ່ເຫັນທຸກຢ່າງທີ່ເຄື່ອນໄຫວ". ດຽວນີ້ເລື່ອນລົງສຸດແລ້ວກົດໂຫຼດຕໍ່ໄດ້.
  bool loadingMore = false;
  bool hasMore = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      hasMore = true;
    });
    try {
      final (list, unread) = await Api.notifications(unreadOnly: unreadOnly);
      if (!mounted) return;
      setState(() {
        rows = list;
        unreadCount = unread;
        error = null;
        loading = false;
        hasMore = list.length >= 30;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = '$e';
        loading = false;
      });
    }
  }

  /// ໂຫຼດແຖວເກົ່າກວ່າຕໍ່ທ້າຍ (ບໍ່ແທນຂອງເກົ່າ)
  Future<void> _loadMore() async {
    if (loadingMore || !hasMore || rows.isEmpty) return;
    setState(() => loadingMore = true);
    try {
      final (list, unread) = await Api.notifications(
        unreadOnly: unreadOnly,
        before: rows.last.id,
      );
      if (!mounted) return;
      setState(() {
        rows = [...rows, ...list];
        unreadCount = unread;
        hasMore = list.length >= 30;
        loadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        loadingMore = false;
        error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            eyebrow: unreadCount > 0
                ? '$unreadCount ລາຍການຍັງບໍ່ອ່ານ'
                : 'ຂໍ້ຄວາມ ແລະ ການເຄື່ອນໄຫວ',
            title: 'ແຈ້ງເຕືອນ',
            trailing: [
              TextButton.icon(
                onPressed: unreadCount == 0
                    ? null
                    : () async {
                        await Api.markNotificationRead(all: true);
                        await _load();
                      },
                style: TextButton.styleFrom(foregroundColor: onHero),
                icon: const Icon(Icons.done_all_rounded, size: 17),
                label: const Text('ອ່ານທັງໝົດ'),
              ),
            ],
            stats: loading
                ? null
                : [
                    HeroStat(value: '$unreadCount', label: 'ຍັງບໍ່ອ່ານ'),
                    HeroStat(
                      value: '${rows.length}',
                      label: unreadOnly ? 'ສະແດງຢູ່' : 'ຫຼ້າສຸດ',
                      color: const Color(0xFF6EE7B7),
                    ),
                  ],
          ),
          Expanded(
            child: Column(
              children: [
                _NotificationTabs(
                  unreadOnly: unreadOnly,
                  unread: unreadCount,
                  onChanged: (value) {
                    setState(() => unreadOnly = value);
                    _load();
                  },
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                Expanded(
                  child: loading
                      ? const _NotificationLoading()
                      : rows.isEmpty
                      ? _NotificationEmpty(unreadOnly: unreadOnly)
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(14, 5, 14, 28),
                            // +1 ແຖວທ້າຍ = ປຸ່ມ "ໂຫຼດຕໍ່" (ຫຼື ຄຳວ່າຄົບແລ້ວ)
                            itemCount: rows.length + 1,
                            itemBuilder: (context, index) {
                              if (index == rows.length) {
                                if (!hasMore) {
                                  return const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 18),
                                    child: Text(
                                      'ຄົບແລ້ວ',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(color: muted, fontSize: 12),
                                    ),
                                  );
                                }
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  child: Center(
                                    child: loadingMore
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : OutlinedButton(
                                            onPressed: _loadMore,
                                            child: const Text('ໂຫຼດເພີ່ມ'),
                                          ),
                                  ),
                                );
                              }
                              final row = rows[index];
                              return _NotificationCard(
                                row: row,
                                // ກົດເບິ່ງ = ຖືວ່າອ່ານແລ້ວ (ອ່ານຢູ່ແອັບ ⇒ ເວັບກໍ່ເຫັນວ່າອ່ານແລ້ວ)
                                onTap: () async {
                                  if (!row.read) {
                                    await Api.markNotificationRead(id: row.id);
                                  }
                                  await AppLinks.openRecord(
                                    row.model,
                                    row.resId,
                                  );
                                  await _load();
                                },
                              );
                            },
                          ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTabs extends StatelessWidget {
  const _NotificationTabs({
    required this.unreadOnly,
    required this.unread,
    required this.onChanged,
  });
  final bool unreadOnly;
  final int unread;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.fromLTRB(14, 12, 14, 10),
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: surfaceAlt,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      children: [
        _TabButton(
          label: 'ຍັງບໍ່ອ່ານ',
          count: unread,
          selected: unreadOnly,
          onTap: () => onChanged(true),
        ),
        _TabButton(
          label: 'ທັງໝົດ',
          selected: !unreadOnly,
          onTap: () => onChanged(false),
        ),
      ],
    ),
  );
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(11),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        // v4: flat — ຂອບແທນເງົາ
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(11),
          border: selected ? Border.all(color: lineStrong) : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                color: selected ? ink : muted,
                fontWeight: FontWeight.w900,
              ),
            ),
            if (count != null && count! > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: danger.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(
                    fontSize: 11,
                    color: danger,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.row, required this.onTap});
  final AppNotification row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final visual = _visual(row.body);
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(17),
        // v4: flat — ບໍ່ອ່ານ = ຂອບສີເຂັ້ມພໍ, ບໍ່ຕ້ອງໃຊ້ເງົາ
        border: Border.all(
          color: row.read ? line : visual.color.withValues(alpha: .45),
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(17),
          child: Padding(
            padding: const EdgeInsets.all(13),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: visual.color.withValues(alpha: .1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(visual.icon, color: visual.color, size: 20),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              row.body,
                              style: TextStyle(
                                fontSize: 12.5,
                                height: 1.35,
                                color: ink,
                                fontWeight: row.read
                                    ? FontWeight.w600
                                    : FontWeight.w900,
                              ),
                            ),
                          ),
                          if (!row.read)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(left: 8, top: 4),
                              decoration: BoxDecoration(
                                color: visual.color,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 7,
                        runSpacing: 5,
                        children: [
                          _meta(Icons.tag_rounded, row.resId),
                          _meta(Icons.schedule_rounded, row.createdAt),
                          if ((row.actor ?? '').isNotEmpty)
                            _meta(Icons.person_outline_rounded, row.actor!),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                const Padding(
                  padding: EdgeInsets.only(top: 13),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    color: faint,
                    size: 18,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Widget _meta(IconData icon, String text) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 11, color: faint),
      const SizedBox(width: 3),
      Text(
        text,
        style: const TextStyle(
          fontSize: 11,
          color: muted,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

({IconData icon, Color color}) _visual(String body) {
  final text = body.toLowerCase();
  if (text.contains('qc') || text.contains('ກວດ')) {
    return (icon: Icons.fact_check_outlined, color: const Color(0xFF7C3AED));
  }
  if (text.contains('ອາໄຫຼ່') || text.contains('ເບີກ')) {
    return (icon: Icons.inventory_2_outlined, color: const Color(0xFFD97706));
  }
  if (text.contains('ສຳເລັດ') || text.contains('ແລ້ວ')) {
    return (icon: Icons.task_alt_rounded, color: ok);
  }
  if (text.contains('ດ່ວນ') || text.contains('ເລີຍ')) {
    return (icon: Icons.warning_amber_rounded, color: danger);
  }
  return (icon: Icons.notifications_none_rounded, color: teal);
}

class _NotificationEmpty extends StatelessWidget {
  const _NotificationEmpty({required this.unreadOnly});
  final bool unreadOnly;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 70,
          height: 70,
          decoration: BoxDecoration(
            color: ok.withValues(alpha: .08),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.notifications_off_outlined,
            color: ok,
            size: 32,
          ),
        ),
        const SizedBox(height: 13),
        Text(
          unreadOnly ? 'ອ່ານຄົບແລ້ວ' : 'ຍັງບໍ່ມີແຈ້ງເຕືອນ',
          style: const TextStyle(
            fontSize: 14,
            color: ink,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'ດຶງລົງເພື່ອໂຫຼດຂໍ້ມູນໃໝ່',
          style: TextStyle(fontSize: 11.5, color: muted),
        ),
      ],
    ),
  );
}

class _NotificationLoading extends StatelessWidget {
  const _NotificationLoading();
  @override
  Widget build(BuildContext context) => ListView.builder(
    padding: const EdgeInsets.all(14),
    itemCount: 5,
    itemBuilder: (_, index) => Container(
      height: 82,
      margin: const EdgeInsets.only(bottom: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: line),
      ),
    ),
  );
}
