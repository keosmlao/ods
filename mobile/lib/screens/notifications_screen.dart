import 'package:flutter/material.dart';

import '../api.dart';

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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final (list, _) = await Api.notifications(unreadOnly: unreadOnly);
      if (!mounted) return;
      setState(() {
        rows = list;
        error = null;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = '$e';
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ແຈ້ງເຕືອນ'),
        actions: [
          TextButton(
            onPressed: () async {
              await Api.markNotificationRead(all: true);
              await _load();
            },
            child: const Text('ອ່ານທັງໝົດ'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('ຍັງບໍ່ອ່ານ')),
                ButtonSegment(value: false, label: Text('ທັງໝົດ')),
              ],
              selected: {unreadOnly},
              onSelectionChanged: (value) {
                setState(() => unreadOnly = value.first);
                _load();
              },
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : rows.isEmpty
                ? const Center(child: Text('ບໍ່ມີແຈ້ງເຕືອນ'))
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView.separated(
                      itemCount: rows.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final row = rows[index];
                        return ListTile(
                          leading: Icon(
                            row.read
                                ? Icons.notifications_none
                                : Icons.notifications_active,
                            color: row.read ? Colors.grey : Colors.teal,
                          ),
                          title: Text(
                            row.body,
                            style: TextStyle(
                              fontWeight: row.read
                                  ? FontWeight.normal
                                  : FontWeight.bold,
                            ),
                          ),
                          subtitle: Text(
                            '${row.resId} · ${row.createdAt}'
                            '${row.actor != null ? ' · ${row.actor}' : ''}',
                          ),
                          // ກົດເບິ່ງ = ຖືວ່າອ່ານແລ້ວ (ອ່ານຢູ່ແອັບ ⇒ ເວັບກໍ່ເຫັນວ່າອ່ານແລ້ວ)
                          onTap: row.read
                              ? null
                              : () async {
                                  await Api.markNotificationRead(id: row.id);
                                  await _load();
                                },
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
