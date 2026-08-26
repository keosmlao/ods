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
///
/// ── ອອກແບບໃໝ່ 26-08-2026 — ເປັນຫຍັງຈຶ່ງຮື້ ──
/// ວັດຂອງຈິງຢູ່ຖານ: **2,437,842 ແຖວ ໃນນັ້ນຍັງບໍ່ອ່ານ 2,402,139** (283 ຄົນ,
/// ວັນລະ 60,000–88,000 ແຖວ) ⇒ ທຸກຄົນ **100% ຍັງບໍ່ອ່ານ** — ບໍ່ມີໃຜເຄີຍອ່ານຈັກແຖວ.
/// ສາເຫດບໍ່ແມ່ນຮູບແບບກາດ ແຕ່ແມ່ນ **ເນື້ອໃນ**: `log` (ບັນທຶກວ່າໃຜແກ້ຫຍັງ) ຖືກ
/// ກະຈາຍໃສ່ທຸກຄົນ ຈົນເລື່ອງທີ່ຮຽກຫາຄົນນັ້ນຈິງໆຈົມຫາຍ (ຊ່າງຄົນໜຶ່ງ: log 3,294
/// ຕໍ່ assign 629). ຈຶ່ງແຍກເປັນ 2 ແຖບ:
///   • **ຮຽກຫາຂ້ອຍ** (ຕັ້ງຕົ້ນ) — ມອບງານ · ມີຄົນເວົ້າເຖິງ
///   • **ຄວາມເຄື່ອນໄຫວ** — audit ຄົບຖ້ວນຄືເກົ່າ (ບໍ່ໄດ້ລຶບ ບໍ່ໄດ້ຢຸດຂຽນ)
/// ແລະ ປ້າຍແດງນັບສະເພາະຝ່າຍທຳອິດ — ປ້າຍທີ່ຄ້າງ 9,900 ຕະຫຼອດຄືປ້າຍທີ່ຄົນເລີກເບິ່ງ.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<_Entry> entries = [];
  List<AppNotification> rows = [];
  String group = 'todo';
  bool unreadOnly = false;
  bool loading = true;
  String? error;
  int unreadTodo = 0;
  int unreadAll = 0;

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
      final (list, unread, todo) = await Api.notifications(
        unreadOnly: unreadOnly,
        group: group,
      );
      if (!mounted) return;
      setState(() {
        rows = list;
        entries = _Entry.build(list);
        unreadAll = unread;
        unreadTodo = todo;
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
      final (list, unread, todo) = await Api.notifications(
        unreadOnly: unreadOnly,
        group: group,
        before: rows.last.id,
      );
      if (!mounted) return;
      setState(() {
        rows = [...rows, ...list];
        entries = _Entry.build(rows);
        unreadAll = unread;
        unreadTodo = todo;
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

  Future<void> _markRead(AppNotification row) async {
    if (row.read) return;
    await Api.markNotificationRead(id: row.id);
    if (!mounted) return;
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final todo = group == 'todo';
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            eyebrow: unreadTodo > 0
                ? '$unreadTodo ເລື່ອງຮຽກຫາທ່ານ'
                : 'ບໍ່ມີເລື່ອງທີ່ຮຽກຫາທ່ານ',
            title: 'ແຈ້ງເຕືອນ',
            trailing: [
              TextButton.icon(
                onPressed: unreadAll == 0
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
                    HeroStat(value: '$unreadTodo', label: 'ຮຽກຫາຂ້ອຍ'),
                    HeroStat(
                      value: '${entries.where((e) => e.row != null).length}',
                      label: 'ສະແດງຢູ່',
                      color: const Color(0xFF6EE7B7),
                    ),
                  ],
          ),
          Expanded(
            child: Column(
              children: [
                _GroupTabs(
                  group: group,
                  unreadTodo: unreadTodo,
                  onChanged: (value) {
                    setState(() => group = value);
                    _load();
                  },
                ),
                _UnreadToggle(
                  value: unreadOnly,
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
                      : entries.isEmpty
                      ? _NotificationEmpty(todo: todo, unreadOnly: unreadOnly)
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.fromLTRB(14, 2, 14, 28),
                            // +1 ແຖວທ້າຍ = ປຸ່ມ "ໂຫຼດຕໍ່" (ຫຼື ຄຳວ່າຄົບແລ້ວ)
                            itemCount: entries.length + 1,
                            itemBuilder: (context, index) {
                              if (index == entries.length) return _footer();
                              final entry = entries[index];
                              final row = entry.row;
                              if (row == null) {
                                return _DayHeader(label: entry.dayLabel);
                              }
                              return _NotificationCard(
                                row: row,
                                repeats: entry.repeats,
                                onRead: () => _markRead(row),
                                // ກົດເບິ່ງ = ຖືວ່າອ່ານແລ້ວ (ອ່ານຢູ່ແອັບ ⇒ ເວັບກໍ່ເຫັນວ່າອ່ານແລ້ວ)
                                onTap: () async {
                                  if (!row.read) {
                                    await Api.markNotificationRead(id: row.id);
                                  }
                                  await AppLinks.openRecord(row.model, row.resId);
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

  Widget _footer() {
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
}

/// ແຖວໃນລາຍການ — ຫົວກຸ່ມມື້ (`row == null`) ຫຼື ຂໍ້ຄວາມ 1 ອັນ.
class _Entry {
  _Entry.header(this.dayLabel) : row = null, repeats = 1;
  _Entry.item(this.row, this.repeats) : dayLabel = '';

  final AppNotification? row;
  final String dayLabel;

  /// ຂໍ້ຄວາມດຽວກັນຕິດກັນ**ຈຳນວນເທົ່າໃດ** — ສະແດງເປັນ "×8" ແທນ 8 ກາດ.
  final int repeats;

  /// ຈັດເປັນກຸ່ມຕາມມື້ + ຮວບອັນຊ້ຳ.
  ///
  /// ⚠️ ຮວບສະເພາະ **ອັນທີ່ຕິດກັນ ແລະ ຢູ່ໃບດຽວກັນ ແລະ ຂໍ້ຄວາມຄືກັນ** ເທົ່ານັ້ນ —
  /// ບໍ່ຮວບຂ້າມໃບ ບໍ່ດັ່ງນັ້ນລຳດັບເວລາຈະຜິດ. ຂອງຈິງພົບ "ບັນທຶກຜົນກວດເຊັກ: ນ້ຳຮົ່ວ"
  /// ຕິດກັນ 8 ແຖວ ⇒ ຫຍໍ້ເປັນແຖວດຽວແລ້ວຈໍອ່ານໄດ້ທັນທີ.
  static List<_Entry> build(List<AppNotification> rows) {
    final out = <_Entry>[];
    String? day;
    for (var index = 0; index < rows.length; index++) {
      final row = rows[index];
      if (row.dayLabel != day) {
        day = row.dayLabel;
        out.add(_Entry.header(day));
      }
      var repeats = 1;
      while (index + 1 < rows.length &&
          rows[index + 1].body == row.body &&
          rows[index + 1].model == row.model &&
          rows[index + 1].resId == row.resId &&
          rows[index + 1].dayLabel == row.dayLabel) {
        repeats++;
        index++;
      }
      out.add(_Entry.item(row, repeats));
    }
    return out;
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 14, 4, 7),
    child: Row(
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: muted,
            fontWeight: FontWeight.w900,
            letterSpacing: .4,
          ),
        ),
        const SizedBox(width: 9),
        const Expanded(child: Divider(height: 1, color: line)),
      ],
    ),
  );
}

class _GroupTabs extends StatelessWidget {
  const _GroupTabs({
    required this.group,
    required this.unreadTodo,
    required this.onChanged,
  });
  final String group;
  final int unreadTodo;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.fromLTRB(14, 12, 14, 8),
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: surfaceAlt,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      children: [
        _TabButton(
          label: 'ຮຽກຫາຂ້ອຍ',
          count: unreadTodo,
          selected: group == 'todo',
          onTap: () => onChanged('todo'),
        ),
        _TabButton(
          label: 'ຄວາມເຄື່ອນໄຫວ',
          selected: group == 'activity',
          onTap: () => onChanged('activity'),
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
          color: selected ? onAccent : Colors.transparent,
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
                  color: danger.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  count! > 99 ? '99+' : '$count',
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

/// ຕົວກອງຮອງ — "ຍັງບໍ່ອ່ານເທົ່ານັ້ນ".
///
/// ⚠️ ຕັ້ງຕົ້ນ **ປິດ** (ຕ່າງຈາກຮຸ່ນເກົ່າທີ່ເປີດຢູ່): ເມື່ອ 100% ຂອງແຖວຍັງບໍ່ອ່ານ
/// ຕົວກອງນີ້ບໍ່ໄດ້ກອງຫຍັງອອກເລີຍ ແຕ່ພັດເຮັດໃຫ້ຂໍ້ຄວາມທີ່ຫາກໍ່ອ່ານໄປ**ຫາຍຕໍ່ໜ້າຕໍ່ຕາ**.
class _UnreadToggle extends StatelessWidget {
  const _UnreadToggle({required this.value, required this.onChanged});
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 2),
      child: InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(9),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                value
                    ? Icons.check_box_rounded
                    : Icons.check_box_outline_blank_rounded,
                size: 16,
                color: value ? teal : faint,
              ),
              const SizedBox(width: 6),
              Text(
                'ສະແດງແຕ່ອັນທີ່ຍັງບໍ່ອ່ານ',
                style: TextStyle(
                  fontSize: 11.5,
                  color: value ? ink : muted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.row,
    required this.repeats,
    required this.onTap,
    required this.onRead,
  });
  final AppNotification row;
  final int repeats;
  final VoidCallback onTap;
  final Future<void> Function() onRead;

  @override
  Widget build(BuildContext context) {
    final visual = _visual(row);
    final card = Container(
      decoration: BoxDecoration(
        color: surface,
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
                        children: [
                          // ປ້າຍປະເພດ — ມາຈາກ `kind` ຂອງຖານ ບໍ່ແມ່ນເດົາຈາກຄຳໃນປະໂຫຍກ
                          Text(
                            visual.label,
                            style: TextStyle(
                              fontSize: 10.5,
                              color: visual.color,
                              fontWeight: FontWeight.w900,
                              letterSpacing: .3,
                            ),
                          ),
                          if (repeats > 1) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                                vertical: 1,
                              ),
                              decoration: BoxDecoration(
                                color: surfaceAlt,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: line),
                              ),
                              child: Text(
                                '×$repeats',
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: muted,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                          const Spacer(),
                          Text(
                            row.ago,
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: faint,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (!row.read)
                            Container(
                              width: 7,
                              height: 7,
                              margin: const EdgeInsets.only(left: 7),
                              decoration: BoxDecoration(
                                color: visual.color,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
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
                      const SizedBox(height: 7),
                      Wrap(
                        spacing: 7,
                        runSpacing: 5,
                        children: [
                          _meta(Icons.tag_rounded, row.resId),
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

    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      // ປັດຂວາ = ອ່ານແລ້ວ — ບໍ່ຕ້ອງກົດເຂົ້າໄປແລ້ວກົດກັບ ເພື່ອລ້າງແຖວທີ່ບໍ່ສຳຄັນ
      child: row.read
          ? card
          : Dismissible(
              key: ValueKey(row.id),
              direction: DismissDirection.startToEnd,
              confirmDismiss: (_) async {
                await onRead();
                return false; // ໂຫຼດໃໝ່ເອງແລ້ວ — ຢ່າໃຫ້ list ລຶບແຖວຊ້ຳ
              },
              background: Container(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.only(left: 20),
                decoration: BoxDecoration(
                  color: ok.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: const Icon(Icons.done_rounded, color: ok, size: 20),
              ),
              child: card,
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

/// ຮູບ · ສີ · ປ້າຍ — ຕັດສິນຈາກ **`kind` + `model` ຂອງຖານ**.
///
/// ⚠️ ຮຸ່ນເກົ່າເດົາຈາກຄຳໃນຂໍ້ຄວາມ (`body.contains('ແລ້ວ')` · `contains('ເລີຍ')`)
/// ຊຶ່ງຜິດເລື້ອຍ ເພາະຄຳເຫຼົ່ານັ້ນມີຢູ່ໃນເກືອບທຸກປະໂຫຍກລາວ — ແລະ server ສົ່ງ `kind`
/// ມາໃຫ້ຢູ່ແລ້ວ ພຽງແຕ່ແອັບຖິ້ມມັນຖິ້ມ.
({IconData icon, Color color, String label}) _visual(AppNotification row) {
  switch (row.kind) {
    case 'assign':
      return (
        icon: Icons.assignment_ind_outlined,
        color: teal,
        label: 'ມອບໝາຍໃຫ້ທ່ານ',
      );
    case 'comment':
      return (
        icon: Icons.forum_outlined,
        color: const Color(0xFF7C3AED),
        label: 'ມີຄົນເວົ້າເຖິງ',
      );
  }
  // kind = log ⇒ ແຍກຕາມປະເພດເອກະສານ ຈຶ່ງພໍຮູ້ວ່າເລື່ອງຫຍັງໂດຍບໍ່ຕ້ອງອ່ານ
  return switch (row.model) {
    'tb_product' => (
      icon: Icons.build_outlined,
      color: muted,
      label: 'ໃບສ້ອມແປງ',
    ),
    'ods_tb_install' => (
      icon: Icons.construction_outlined,
      color: muted,
      label: 'ໃບຕິດຕັ້ງ',
    ),
    'ods_tb_maintenance' => (
      icon: Icons.ac_unit_rounded,
      color: muted,
      label: 'ໃບລ້າງແອ',
    ),
    'ods_claim' => (
      icon: Icons.gavel_rounded,
      color: const Color(0xFFD97706),
      label: 'ເຄມ',
    ),
    'ic_trans' => (
      icon: Icons.inventory_2_outlined,
      color: const Color(0xFFD97706),
      label: 'ອາໄຫຼ່/ສາງ',
    ),
    'ar_customer' => (
      icon: Icons.person_outline_rounded,
      color: muted,
      label: 'ລູກຄ້າ',
    ),
    _ => (
      icon: Icons.notifications_none_rounded,
      color: muted,
      label: 'ຄວາມເຄື່ອນໄຫວ',
    ),
  };
}

class _NotificationEmpty extends StatelessWidget {
  const _NotificationEmpty({required this.todo, required this.unreadOnly});
  final bool todo;
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
          child: const Icon(Icons.done_all_rounded, color: ok, size: 32),
        ),
        const SizedBox(height: 13),
        Text(
          todo ? 'ບໍ່ມີເລື່ອງຮຽກຫາທ່ານ' : 'ຍັງບໍ່ມີຄວາມເຄື່ອນໄຫວ',
          style: const TextStyle(
            fontSize: 14,
            color: ink,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          todo
              ? (unreadOnly
                    ? 'ເອົາເຄື່ອງໝາຍ “ຍັງບໍ່ອ່ານ” ອອກ ເພື່ອເບິ່ງອັນເກົ່າ'
                    : 'ມີງານມອບໃຫ້ ຫຼື ມີຄົນເວົ້າເຖິງ ຈະຂຶ້ນຢູ່ນີ້')
              : 'ດຶງລົງເພື່ອໂຫຼດຂໍ້ມູນໃໝ່',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11.5, color: muted),
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
      height: 92,
      margin: const EdgeInsets.only(bottom: 9),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: line),
      ),
    ),
  );
}
