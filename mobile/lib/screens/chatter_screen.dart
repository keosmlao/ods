import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// Chatter ແລະ Activities ຂອງໃບງານ — native ແລະໃຊ້ຂໍ້ມູນຊຸດດຽວກັບ Web.
class ChatterScreen extends StatefulWidget {
  const ChatterScreen({super.key, required this.workflow, required this.code});
  final String workflow;
  final String code;
  @override
  State<ChatterScreen> createState() => _ChatterScreenState();
}

class _ChatterScreenState extends State<ChatterScreen> {
  JobChatter? data;
  bool loading = true;
  bool sending = false;
  String error = '';
  final input = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = await Api.chatter(widget.workflow, widget.code);
      if (mounted) {
        setState(() {
          data = result;
          error = '';
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
    }
  }

  Future<void> send() async {
    final text = input.text.trim();
    if (text.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      await Api.postChatter(widget.workflow, widget.code, text);
      input.clear();
      await load();
    } on ApiError catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failure.message), backgroundColor: danger),
        );
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> complete(JobActivity activity) async {
    try {
      await Api.completeActivity(widget.workflow, widget.code, activity.id);
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
    final value = data;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: ground,
        body: Column(
          children: [
            HeroHeader(
              eyebrow: widget.workflow == 'install' ? 'ງານຕິດຕັ້ງ' : 'ງານສ້ອມ',
              title: '#${widget.code}',
              onBack: () => Navigator.pop(context),
              trailing: [
                HeroIconButton(icon: Icons.refresh_rounded, onTap: load),
              ],
              stats: value == null
                  ? null
                  : [
                      HeroStat(
                        value: '${value.messages.length}',
                        label: 'Chatter',
                      ),
                      HeroStat(
                        value: '${value.activities.length}',
                        label: 'Activities',
                        color: const Color(0xFFFCD34D),
                      ),
                    ],
            ),
            Container(
              color: surface,
              child: const TabBar(
                labelColor: ink,
                unselectedLabelColor: muted,
                indicatorColor: teal,
                tabs: [
                  Tab(text: 'Chatter'),
                  Tab(text: 'Activities'),
                ],
              ),
            ),
            Expanded(
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : error.isNotEmpty
                  ? _ErrorRetry(message: error, onRetry: load)
                  : TabBarView(
                      children: [_chatter(value!), _activities(value)],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chatter(JobChatter value) => Column(
    children: [
      Expanded(
        child: RefreshIndicator(
          onRefresh: load,
          child: value.messages.isEmpty
              ? ListView(
                  children: const [
                    _EmptyHint(
                      icon: Icons.forum_outlined,
                      text: 'ຍັງບໍ່ມີຂໍ້ຄວາມ',
                    ),
                  ],
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(14),
                  itemCount: value.messages.length,
                  itemBuilder: (_, i) =>
                      _MessageCard(message: value.messages[i]),
                ),
        ),
      ),
      SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
          decoration: const BoxDecoration(
            color: surface,
            border: Border(top: BorderSide(color: line)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: input,
                  minLines: 1,
                  maxLines: 4,
                  decoration: InputDecoration(
                    hintText: 'ຂຽນຂໍ້ຄວາມ...',
                    filled: true,
                    fillColor: surfaceAlt,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              IconButton.filled(
                onPressed: sending ? null : send,
                style: IconButton.styleFrom(backgroundColor: teal),
                icon: sending
                    ? const SizedBox(
                        width: 17,
                        height: 17,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: onAccent,
                        ),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ],
          ),
        ),
      ),
    ],
  );

  Widget _activities(JobChatter value) => RefreshIndicator(
    onRefresh: load,
    child: value.activities.isEmpty
        ? ListView(
            children: const [
              _EmptyHint(
                icon: Icons.event_available_rounded,
                text: 'ບໍ່ມີກິດຈະກຳຄ້າງ',
              ),
            ],
          )
        : ListView.builder(
            padding: const EdgeInsets.all(14),
            itemCount: value.activities.length,
            itemBuilder: (_, i) {
              final activity = value.activities[i];
              return Container(
                margin: const EdgeInsets.only(bottom: 9),
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: activity.late ? danger.withValues(alpha: .3) : line,
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            activity.summary,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${activity.dueDate} · ${activity.assignedTo}',
                            style: TextStyle(
                              fontSize: 11,
                              color: activity.late ? danger : muted,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if ((activity.note ?? '').isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              activity.note!,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: ink,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => complete(activity),
                      tooltip: 'ເຮັດແລ້ວ',
                      icon: const Icon(
                        Icons.check_circle_outline_rounded,
                        color: ok,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
  );
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.message});
  final ChatterMessage message;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: message.isLog ? const Color(0xFFF1F5F4) : surface,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              message.isLog
                  ? Icons.history_rounded
                  : Icons.person_outline_rounded,
              size: 14,
              color: message.isLog ? faint : teal,
            ),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                message.author,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: ink,
                ),
              ),
            ),
            Text(
              message.createdAt,
              style: const TextStyle(fontSize: 11, color: faint),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          message.body,
          style: TextStyle(
            fontSize: 12,
            height: 1.4,
            color: message.isLog ? muted : ink,
          ),
        ),
      ],
    ),
  );
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 60),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 42, color: faint),
        const SizedBox(height: 10),
        Text(text, style: const TextStyle(color: muted)),
      ],
    ),
  );
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.cloud_off_rounded, size: 42, color: muted),
        const SizedBox(height: 10),
        Text(message, style: const TextStyle(color: muted)),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('ລອງໃໝ່'),
        ),
      ],
    ),
  );
}
