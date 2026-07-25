import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../main.dart';
import '../widgets/ui_kit.dart';

/// ກວດເຊັກ (ຝັ່ງສ້ອມ) — ຄືໜ້າ /checking/[code] ຂອງເວັບ.
///
/// ອາການທີ່ວິເຄາະ → (ຖ້າໃຊ້ອາໄຫຼ່) ເລືອກອາໄຫຼ່ຈາກສະຕັອກ → ຕັດສິນປະກັນ → ບັນທຶກ.
/// ຕັດສິນວ່າ **ໝົດຮັບປະກັນ ຕ້ອງມີເຫດຜົນ** (ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ — server ບັງຄັບ).
/// ຜົນຕັດສິນຫຼັງກວດເຊັກ — ຄືນຄ່າຕອນ pop ໃຫ້ job_screen ໄປຕໍ່:
///   repair  = ສ້ອມໄດ້ ⇒ (ໃນປະກັນ) ເລີ່ມສ້ອມເລີຍ · (ນອກປະກັນ) ໄປສະເໜີລາຄາ
///   spare   = ຕ້ອງສັ່ງ/ເບີກ ອາໄຫຼ່ ⇒ ເຂົ້າຂະບວນການອາໄຫຼ່
///   bringIn = ສ້ອມໜ້າງານບໍ່ໄດ້ ⇒ ນຳເຂົ້າສູນ (IH — job_screen ເປີດ dialog ເລືອກວິທີ)
/// repair = ສ້ອມໄດ້ ⇒ ເລີ່ມສ້ອມເລີຍ · checkOnly = ສຳເລັດການກວດ (ສ້ອມພາຍຫຼັງ, ຢູ່ສູນ) ·
/// spare = ຕ້ອງອາໄຫຼ່ · bringIn = ນຳເຂົ້າສູນ (IH)
enum CheckOutcome { repair, checkOnly, spare, bringIn }

class CheckScreen extends StatefulWidget {
  const CheckScreen({super.key, required this.code, this.serviceType});
  final String code;
  /// ປະເພດບໍລິການ (IH/PS/CI/ST) — ໃຫ້ຮູ້ວ່າ IH (ໄປສ້ອມບ້ານ) ⇒ ສະແດງ "ນຳເຂົ້າສູນ"
  final String? serviceType;

  @override
  State<CheckScreen> createState() => _CheckScreenState();
}

class _CheckScreenState extends State<CheckScreen> {
  final diagnosis = TextEditingController();
  final reason = TextEditingController();
  final term = TextEditingController();

  List<DraftLine> draft = [];
  List<SpareItem> results = [];
  List<SpareSuggestion> suggestions = []; // ຜູ້ຊ່ວຍ AI
  final List<String> photos = []; // ຮູບຕອນກວດເຊັກ (data-URI base64)
  final picker = ImagePicker();
  CheckOutcome? outcome; // ຜົນຕັດສິນທີ່ຊ່າງເລືອກ (null = ຍັງບໍ່ເລືອກ)
  bool get useSpare => outcome == CheckOutcome.spare;
  bool warrantyVoid = false;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    diagnosis.addListener(_refreshValidation);
    reason.addListener(_refreshValidation);
    load();
    loadSuggestions();
  }

  /// ໂຫຼດອາໄຫຼ່ທີ່ AI ແນະນຳ — ລົ້ມກໍ່ບໍ່ເປັນຫຍັງ (ພຽງບໍ່ສະແດງ)
  Future<void> loadSuggestions() async {
    try {
      final rows = await Api.suggestSpares(widget.code);
      if (mounted) setState(() => suggestions = rows);
    } catch (_) {
      // ຜູ້ຊ່ວຍ AI ບໍ່ຂຶ້ນ ບໍ່ກະທົບການເຮັດວຽກ
    }
  }

  void _refreshValidation() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    diagnosis.removeListener(_refreshValidation);
    reason.removeListener(_refreshValidation);
    diagnosis.dispose();
    reason.dispose();
    term.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final rows = await Api.draft(widget.code);
      if (mounted) setState(() => draft = rows);
    } on ApiError catch (failure) {
      if (mounted) _toast(failure.message, danger);
    }
  }

  void _toast(String message, Color color) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  Future<void> send(Map<String, dynamic> body, {bool pop = false, Object? popResult}) async {
    setState(() => busy = true);
    try {
      final message = await Api.check(widget.code, body);
      if (!mounted) return;
      if (pop) {
        _toast(message, ok);
        Navigator.pop(context, popResult);
        return;
      }
      await load();
    } on ApiError catch (failure) {
      if (mounted) _toast(failure.message, danger);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> search() async {
    setState(() => busy = true);
    try {
      final items = await Api.searchSpares(term.text);
      if (mounted) setState(() => results = items);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  /// ຖ່າຍຮູບຕອນກວດເຊັກ (ສູງສຸດ 6 ຮູບ) — ຫຼັກຖານອາການ/ຄວາມເສຍຫາຍທີ່ພົບ
  Future<void> shoot() async {
    if (photos.length >= 6) {
      _toast('ແນບຮູບໄດ້ສູງສຸດ 6 ຮູບ', warn);
      return;
    }
    final shot = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 50,
      maxWidth: 1280,
    );
    if (shot == null) return;
    final bytes = await shot.readAsBytes();
    setState(
      () => photos.add('data:image/jpeg;base64,${base64Encode(bytes)}'),
    );
  }

  /// ເຫດຜົນທີ່ຍັງບັນທຶກບໍ່ໄດ້ (null = ພ້ອມບັນທຶກ) — ບອກຊ່າງໃຫ້ຮູ້ວ່າຂາດຫຍັງ
  String? get _blocker {
    if (diagnosis.text.trim().isEmpty) return 'ຕ້ອງປ້ອນອາການທີ່ພົບກ່ອນ';
    if (warrantyVoid && reason.text.trim().isEmpty) {
      return 'ຕ້ອງໃສ່ເຫດຜົນໝົດຮັບປະກັນ';
    }
    if (outcome == null) return 'ເລືອກຜົນຕັດສິນຫຼັງກວດເຊັກ';
    if (outcome == CheckOutcome.spare && draft.isEmpty) {
      return 'ຕ້ອງເລືອກອາໄຫຼ່ຢ່າງໜ້ອຍ 1 ລາຍການ';
    }
    return null;
  }

  /// ບັນທຶກຜົນກວດ ແລ້ວ pop ຄືນຄ່າ **ຜົນຕັດສິນ** ໃຫ້ job_screen ໄປຕໍ່:
  ///   repair ໃນປະກັນ → 'start' (ເລີ່ມສ້ອມເລີຍ) · bringIn → 'bring-in' · ອື່ນ → null (reload)
  Future<void> _submit() async {
    final chosen = outcome;
    if (chosen == null) return;
    final Object? result = chosen == CheckOutcome.bringIn
        ? CheckOutcome.bringIn
        : (chosen == CheckOutcome.repair && !warrantyVoid)
            ? CheckOutcome.repair
            : null;
    await send({
      'action': 'save',
      'diagnosis': diagnosis.text,
      'warranty_void': warrantyVoid,
      'warranty_reason': reason.text,
      'use_spare': chosen == CheckOutcome.spare,
      'photos': photos,
    }, pop: true, popResult: result);
  }

  @override
  Widget build(BuildContext context) {
    final blocker = _blocker;
    return Scaffold(
      backgroundColor: ground,
      body: Column(
        children: [
          HeroHeader(
            title: 'ກວດເຊັກ · ${widget.code}',
            onBack: () => Navigator.pop(context),
          ),
          Expanded(
            child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
        children: [
          // ── ຄວາມຄືບໜ້າ flow ຊ່າງ (ຂັ້ນ 2/6 = ກວດເຊັກ) ──
          const StepProgress(current: 2, label: 'ກວດເຊັກ & ວິເຄາະ'),
          const SizedBox(height: 14),
          // ── ຜູ້ຊ່ວຍ AI: ຄຳແນະນຳຂັ້ນຕອນ ──
          const AiAssistCard(
            body: Text(
              'ບັນທຶກອາການທີ່ພົບ → ຕັດສິນອາໄຫຼ່ ແລະ ປະກັນ → ບັນທຶກຜົນ. ຮູບ QC ບໍ່ບັງຄັບ.',
            ),
          ),

          _card([
            const SectionLabel('ອາການທີ່ຊ່າງວິເຄາະ'),
            TextField(
              controller: diagnosis,
              maxLines: 3,
              decoration: const InputDecoration(hintText: 'ພິມອາການທີ່ພົບ...'),
            ),
          ]),
          const SizedBox(height: 10),

          _optionCard(
            icon: Icons.verified_user_outlined,
            title: 'ໝົດຮັບປະກັນ (ຊ່າງຕັດສິນ)',
            subtitle: 'ຕ້ອງໃສ່ເຫດຜົນ — ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ',
            value: warrantyVoid,
            onChanged: (value) => setState(() => warrantyVoid = value),
          ),
          if (warrantyVoid) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: const Color(0xFFFBEED5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFEBD7A6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.info_outline, size: 16, color: warn),
                      SizedBox(width: 6),
                      Text(
                        'ເຫດຜົນທີ່ໝົດຮັບປະກັນ',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: warn,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: reason,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      hintText: 'ເຊັ່ນ: ຮ່ອງຮอຍແຕກ, ໂດນນ້ຳ, ໝົດອາຍຸປະກັນ...',
                      fillColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 14),
          // ── ຜົນຕັດສິນຫຼັງກວດເຊັກ (ເລືອກ 1) ──
          const SectionLabel('ຕັດສິນໃຈຫຼັງກວດເຊັກ'),
          const SizedBox(height: 8),
          _outcomeCard(
            outcome: CheckOutcome.repair,
            icon: Icons.build_circle_outlined,
            color: ok,
            title: 'ສ້ອມໄດ້ — ເລີ່ມສ້ອມເລີຍ',
            subtitle: warrantyVoid
                ? 'ນອກປະກັນ ⇒ ບັນທຶກແລ້ວໄປສະເໜີລາຄາ'
                : 'ບັນທຶກແລ້ວເລີ່ມສ້ອມທັນທີ',
          ),
          // ── ຢູ່ສູນ (ບໍ່ແມ່ນ IH): ເລືອກ "ສຳເລັດການກວດເຊັກ" ໄວ້ກ່ອນ ສ້ອມพายຫຼັງໄດ້ ──
          if (widget.serviceType != 'IH') ...[
            const SizedBox(height: 8),
            _outcomeCard(
              outcome: CheckOutcome.checkOnly,
              icon: Icons.fact_check_outlined,
              color: teal,
              title: 'ສຳເລັດການກວດເຊັກ (ສ້ອມພາຍຫຼັງ)',
              subtitle: 'ບັນທຶກຜົນກວດໄວ້ກ່ອນ — ກົດ "ເລີ່ມສ້ອມ" ຕ່າງຫາກເມື່ອพร้อม',
            ),
          ],
          const SizedBox(height: 8),
          _outcomeCard(
            outcome: CheckOutcome.spare,
            icon: Icons.inventory_2_outlined,
            color: const Color(0xFF7C3AED),
            title: 'ຕ້ອງໃຊ້ / ສັ່ງ ອາໄຫຼ່',
            subtitle: 'ເລືອກອາໄຫຼ່ຈາກສະຕັອກ ⇒ ຂໍເບີກ/ສັ່ງຊື້',
          ),
          if (widget.serviceType == 'IH') ...[
            const SizedBox(height: 8),
            _outcomeCard(
              outcome: CheckOutcome.bringIn,
              icon: Icons.warehouse_outlined,
              color: const Color(0xFFB45309),
              title: 'ສ້ອມໜ້າງານບໍ່ໄດ້ — ນຳເຂົ້າສູນ',
              subtitle: 'ບັນທຶກຜົນກວດແລ້ວ ນຳເຄື່ອງເຂົ້າສູນ',
            ),
          ],

          if (outcome == CheckOutcome.spare) ...[
            const SizedBox(height: 12),
            // ── ຜູ້ຊ່ວຍ AI: ອາໄຫຼ່ທີ່ແນະນຳ (ຈາກวຽກຮຸ່ນເดียวกัน) ──
            if (suggestions.any((s) => !draft.any((d) => d.itemCode == s.code)))
              AiAssistCard(
                title: 'AI ແນະນຳອາໄຫຼ່',
                body: const Text('ອີງຈາກวຽກຮຸ່ນเดียวกัน — ແຕະเพื่อเพิ่ม'),
                chips: [
                  for (final s in suggestions.where(
                    (s) => !draft.any((d) => d.itemCode == s.code),
                  ))
                    AiChip(
                      label: s.name.length > 20 ? '${s.name.substring(0, 20)}…' : s.name,
                      confidence: s.confidence,
                      onTap: busy
                          ? null
                          : () => send({
                              'action': 'add_spare',
                              'item': {
                                'code': s.code,
                                'name_1': s.name,
                                'unit_code': s.unitCode,
                              },
                              'qty': 1,
                            }),
                    ),
                ],
              ),
            _card([
              SectionLabel('ອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້ (${draft.length})'),
              if (draft.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(bottom: 4),
                  child: Text(
                    'ຄົ້ນຫາ ແລ້ວແຕະ + ເພື່ອເພີ່ມ',
                    style: TextStyle(fontSize: 12, color: faint),
                  ),
                ),
              ...draft.map(
                (line) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(
                    '${line.itemName} × ${line.qty.toStringAsFixed(0)}',
                  ),
                  trailing: TextButton(
                    onPressed: busy
                        ? null
                        : () => send({
                            'action': 'remove_spare',
                            'roworder': line.roworder,
                          }),
                    child: const Text('ຖອດ', style: TextStyle(color: danger)),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: term,
                      onSubmitted: (_) => search(),
                      decoration: const InputDecoration(
                        hintText: 'ຄົ້ນຫາອາໄຫຼ່...',
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(64, 48),
                    ),
                    onPressed: busy ? null : search,
                    child: const Text('ຄົ້ນ'),
                  ),
                ],
              ),
              ...results.map(
                (item) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(item.name, style: const TextStyle(fontSize: 14)),
                  subtitle: Text(
                    '${item.code} · ຄົງເຫຼືອ ${item.balance}',
                    style: const TextStyle(fontSize: 12, color: muted),
                  ),
                  trailing: const Icon(Icons.add_circle, color: teal),
                  onTap: busy
                      ? null
                      : () => send({
                          'action': 'add_spare',
                          'item': {
                            'code': item.code,
                            'name_1': item.name,
                            'unit_code': item.unitCode,
                          },
                          'qty': 1,
                        }),
                ),
              ),
            ]),
          ],

          const SizedBox(height: 18),
          // ── ຮູບຕອນກວດເຊັກ (ຫຼັກຖານອາການ/ຄວາມເສຍຫາຍ) — ບໍ່ບັງຄັບ ──
          _photoCard(),
          const SizedBox(height: 18),
          // ── ບອກເຫດຜົນເມື່ອຍັງບັນທຶກບໍ່ໄດ້ (ບໍ່ໃຫ້ปุ่มเทาลอยໆ ໂດຍບໍ່ຮູ້ສາເຫດ) ──
          if (blocker != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 15, color: faint),
                  const SizedBox(width: 6),
                  Text(
                    blocker,
                    style: const TextStyle(fontSize: 12.5, color: faint),
                  ),
                ],
              ),
            ),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: ok,
              minimumSize: const Size.fromHeight(54),
            ),
            onPressed: busy || blocker != null ? null : _submit,
            icon: busy
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle_outline, size: 20),
            label: Text(switch (outcome) {
              CheckOutcome.repair => warrantyVoid ? 'ບັນທຶກ & ໄປສະເໜີລາຄາ' : 'ບັນທຶກ & ເລີ່ມສ້ອມ',
              CheckOutcome.checkOnly => 'ບັນທຶກ ສຳເລັດການກວດເຊັກ',
              CheckOutcome.spare => 'ບັນທຶກ & ຂໍເບີກອາໄຫຼ່',
              CheckOutcome.bringIn => 'ບັນທຶກ & ນຳເຂົ້າສູນ',
              null => 'ບັນທຶກຜົນກວດເຊັກ',
            }),
          ),
        ],
      ),
          ),
        ],
      ),
    );
  }

  /// ກາດຖ່າຍ/ສະແດງຮູບຕອນກວດເຊັກ
  Widget _photoCard() => Container(
    padding: const EdgeInsets.all(14),
    decoration: cardDecoration(),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.photo_camera_outlined, size: 18, color: teal),
            const SizedBox(width: 8),
            const Text(
              'ຮູບຕອນກວດເຊັກ',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
            ),
            const Spacer(),
            Text(
              '${photos.length}/6',
              style: const TextStyle(fontSize: 12, color: faint),
            ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'ຖ່າຍຮູບອາການ ຫຼື ຄວາມເສຍຫາຍທີ່ພົບ (ບໍ່ບັງຄັບ)',
          style: TextStyle(fontSize: 12, color: muted),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var i = 0; i < photos.length; i++)
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.memory(
                      base64Decode(photos[i].split(',').last),
                      width: 78,
                      height: 78,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: -6,
                    right: -6,
                    child: IconButton(
                      icon: const Icon(Icons.cancel, size: 20, color: danger),
                      onPressed: busy
                          ? null
                          : () => setState(() => photos.removeAt(i)),
                    ),
                  ),
                ],
              ),
            if (photos.length < 6)
              InkWell(
                onTap: busy ? null : shoot,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 78,
                  height: 78,
                  decoration: BoxDecoration(
                    color: tealTint,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: line),
                  ),
                  child: const Icon(Icons.add_a_photo_outlined, color: teal),
                ),
              ),
          ],
        ),
      ],
    ),
  );

  /// ກາດຕົວເລືອກແບບແຕະ (toggle) — ເລືອກແລ້ວเน้น teal
  /// ກາດເລືອກ **ຜົນຕັດສິນ** (radio) — ເລືອກໄດ້ອັນດຽວ, ເລືອກແລ້ວເນັ້ນສີຂອງໂຕເອງ
  Widget _outcomeCard({
    required CheckOutcome outcome,
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
  }) {
    final selected = this.outcome == outcome;
    return InkWell(
      onTap: busy ? null : () => setState(() => this.outcome = outcome),
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: .08) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? color : line, width: selected ? 1.5 : 1),
        ),
        child: Row(
          children: [
            Icon(icon, color: selected ? color : muted, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: selected ? color : ink,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(fontSize: 11.5, color: muted)),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
              color: selected ? color : const Color(0xFFCBD5E1),
              size: 22,
            ),
          ],
        ),
      ),
    );
  }

  Widget _optionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) => InkWell(
    onTap: () => onChanged(!value),
    borderRadius: BorderRadius.circular(14),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: value ? tealTint : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: value ? teal : line),
      ),
      child: Row(
        children: [
          Icon(icon, color: value ? teal : muted, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: ink,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11.5, color: muted),
                ),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    ),
  );

  Widget _card(List<Widget> children) => Container(
    padding: const EdgeInsets.all(16),
    decoration: cardDecoration(),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    ),
  );
}
