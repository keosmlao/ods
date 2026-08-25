import 'dart:io';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../app_update.dart';

/* ══ ສີຂອງໜ້ານີ້ (ມືດ) ══════════════════════════════════════════════════════
   ໜ້າອື່ນຂອງແອັບເປັນໂໝດແຈ້ງ — ໜ້ານີ້ຕັ້ງໃຈໃຫ້ **ມືດ** ເພາະມັນຄື "ປະຕູ" ທີ່ທັບ
   ທັງແອັບ: ຕ່າງຈາກທຸກໜ້າຢ່າງຊັດເຈນ ⇒ ຊ່າງຮູ້ທັນທີວ່ານີ້ບໍ່ແມ່ນໜ້າທຳມະດາ ແລະ
   ບໍ່ຕ້ອງໄລ່ຫາທາງອອກ. ສີມິ້ນຄື teal ຂອງແບຣນທີ່ຍົກຄວາມສະຫວ່າງຂຶ້ນໃຫ້ອ່ານອອກ
   ເທິງພື້ນມືດ (teal 0F766E ເທິງພື້ນດຳ contrast ບໍ່ພຽງພໍ).
   ══════════════════════════════════════════════════════════════════════════ */
const _bg = Color(0xFF0B1114); // ພື້ນ
const _card = Color(0xFF131C21); // ກ່ອງເວີຊັນ · ແຖບຄວາມຄືບໜ້າ
const _border = Color(0xFF24313D);
const _mint = Color(0xFF2EE6C5); // ປຸ່ມ · ໄອຄອນ (teal ຍົກສະຫວ່າງ)
const _onMint = Color(0xFF05231D); // ຕົວໜັງສືເທິງມິ້ນ (contrast 11:1)
const _bright = Color(0xFFF2F7FA); // ຫົວຂໍ້
const _dim = Color(0xFF8CA0B3); // ຄຳອະທິບາຍ

/// **ໜ້າ "ຕ້ອງອັບເດດ"** — ທັບທັງແອັບ ອອກບໍ່ໄດ້ຈົນກວ່າຈະຕິດຕັ້ງລຸ້ນໃໝ່.
///
/// ກົດ "ອັບເດດດຽວນີ້" = ໂຫຼດ APK ໃນຕົວແອັບ (ມີແຖບຄວາມຄືບໜ້າ) ແລ້ວເປີດຕົວຕິດຕັ້ງ
/// ຂອງລະບົບໃຫ້ເລີຍ — ບໍ່ໄດ້ໂຍນຊ່າງໄປ browser ແລ້ວປ່ອຍໃຫ້ຫາໄຟລ໌ໃນ Files ເອງ
/// (ບ່ອນທີ່ການອັບເດດເຄີຍຄ້າງຢູ່ຕະຫຼອດ).
class UpdateRequiredScreen extends StatefulWidget {
  const UpdateRequiredScreen({super.key, required this.info, this.dismissible = false});

  final AppUpdateInfo info;

  /// ເປີດຈາກ **ແຈ້ງເຕືອນ / ກາດໜ້າ login** (ຍັງບໍ່ຖືກບັງຄັບ) ⇒ ອອກໄດ້.
  /// ຕອນເປັນດ່ານບັງຄັບຈິງ (main.dart) ໃຫ້ເປັນ false — ອອກບໍ່ໄດ້.
  final bool dismissible;

  @override
  State<UpdateRequiredScreen> createState() => _UpdateRequiredScreenState();
}

enum _Stage { idle, downloading, installing }

class _UpdateRequiredScreenState extends State<UpdateRequiredScreen> {
  _Stage _stage = _Stage.idle;
  double _progress = 0;
  int _received = 0;
  int _total = 0;
  String? _error;

  /// ລອງອັດຕະໂນມັດໄປແລ້ວຈັກຮອບ (ຮອບທີ່ຊ່າງກົດເອງບໍ່ນັບ)
  int _tries = 0;

  /// ຢ່າລອງເອງບໍ່ຈົບ — APK ໜັກ ~27MB, ຊ່າງບາງຄົນໃຊ້ເນັດມືຖື.
  /// ຄົບແລ້ວປ່ອຍໃຫ້ກົດເອງ (ປຸ່ມ "ລອງໃໝ່" ຍັງຢູ່).
  static const _maxAutoTries = 3;

  bool get _busy => _stage != _Stage.idle;

  @override
  void initState() {
    super.initState();
    /*
      ── ອັບເດດເອງ ບໍ່ຕ້ອງລໍໃຫ້ກົດ ──
      ຮອດໜ້ານີ້ແປວ່າແອັບຖືກກັ້ນແລ້ວ — ຊ່າງເຮັດຫຍັງບໍ່ໄດ້ຈົນກວ່າຈະຕິດຕັ້ງລຸ້ນໃໝ່
      ⇒ ການໃຫ້ກົດປຸ່ມກ່ອນ ເປັນພຽງຂັ້ນຕອນທີ່ຖ່ວງເວລາ. ເລີ່ມໂຫຼດທັນທີທີ່ຈໍຂຶ້ນ.

      ⚠️ Android **ບໍ່ອະນຸຍາດ**ໃຫ້ແອັບທຳມະດາຕິດຕັ້ງ APK ງຽບໆ — ຕອນທ້າຍລະບົບຈະ
      ຂຶ້ນກ່ອງ "ຕິດຕັ້ງ / ຍົກເລີກ" ໃຫ້ຢືນຢັນສະເໝີ (ແລະ ຄັ້ງທຳອິດຈະຂໍສິດ
      "ຕິດຕັ້ງແອັບຈາກແຫຼ່ງນີ້"). ອັດຕະໂນມັດໄດ້ເຖິງແຄ່ນັ້ນ.
    */
    WidgetsBinding.instance.addPostFrameCallback((_) => _autoUpdate());
  }

  /// ໂຫຼດ+ຕິດຕັ້ງເອງ — ລົ້ມ (ເນັດຂາດ) ⇒ ລອງຄືນເອງ ໂດຍຖ່າງເວລາອອກເທື່ອລະໜ້ອຍ
  Future<void> _autoUpdate() async {
    // iOS ຕິດຕັ້ງ APK ບໍ່ໄດ້ ⇒ ຢ່າເປີດ browser ໃຫ້ເອງໂດຍບໍ່ໄດ້ຂໍ (ໜ້າຈໍຈະຫາຍໄປເສີຍໆ)
    if (!AppUpdater.canInstallInApp) return;
    /*
      ── ອັດຕະໂນມັດສະເພາະ server ຂອງບໍລິສັດ ──
      ຊ່າງປ່ຽນ server URL ເອງໄດ້ (ໜ້າຕັ້ງຄ່າ) ແລະ ແອັບມີສິດຕິດຕັ້ງ APK
      ⇒ ຖ້າມີຄົນຫຼອກໃຫ້ຕັ້ງ server ປອມ ການໂຫຼດ+ຕິດຕັ້ງ**ເອງ**ຈະກາຍເປັນຊ່ອງ
      ຍັດແອັບປອມ. server ອື່ນ (ເຄື່ອງທົດສອບ) ຍັງອັບເດດໄດ້ ແຕ່ຕ້ອງກົດເອງ.
    */
    final target = await _url();
    if (target == null) return;
    final official = Uri.tryParse(Api.defaultBaseUrl)?.host;
    if (official == null || target.host != official) return;
    while (mounted && _tries < _maxAutoTries) {
      _tries++;
      await _update();
      // ສຳເລັດ (ຕົວຕິດຕັ້ງຂຶ້ນມາແລ້ວ) ຫຼື ຊ່າງກົດເອງຢູ່ ⇒ ຢຸດວົງ
      if (!mounted || _error == null) return;
      await Future.delayed(Duration(seconds: 5 * _tries));
      if (!mounted || _busy) return;
    }
  }

  Future<Uri?> _url() async =>
      AppUpdater.resolveUrl(widget.info.updateUrl, baseUrl: await Api.serverUrl());

  Future<void> _update() async {
    final url = await _url();
    if (url == null) {
      setState(() => _error = 'ຍັງບໍ່ໄດ້ຕັ້ງລິ້ງອັບເດດ — ກະລຸນາຕິດຕໍ່ IT');
      return;
    }
    // iOS ຕິດຕັ້ງ APK ບໍ່ໄດ້ ⇒ ສົ່ງລິ້ງໃຫ້ browser ແທນ
    if (!AppUpdater.canInstallInApp) {
      await _openInBrowser();
      return;
    }
    setState(() {
      _stage = _Stage.downloading;
      _progress = 0;
      _received = 0;
      _total = 0;
      _error = null;
    });
    try {
      final apk = await AppUpdater.download(
        url,
        onProgress: (progress, received, total) {
          if (!mounted) return;
          setState(() {
            _progress = progress;
            _received = received;
            _total = total;
          });
        },
      );
      if (!mounted) return;
      setState(() => _stage = _Stage.installing);
      await AppUpdater.install(apk);
      // ຕົວຕິດຕັ້ງຂຶ້ນມາທັບແລ້ວ — ກັບເປັນ idle ໄວ້ ເຜື່ອຊ່າງກົດຍົກເລີກການຕິດຕັ້ງ
      // ຈະໄດ້ກົດປຸ່ມຄືນໄດ້ (ບໍ່ດັ່ງນັ້ນປຸ່ມຄ້າງເປັນ "ກຳລັງອັບເດດ..." ຕະຫຼອດ)
      if (mounted) setState(() => _stage = _Stage.idle);
    } on AppUpdateException catch (failure) {
      if (!mounted) return;
      setState(() {
        _stage = _Stage.idle;
        _error = failure.message;
      });
    } catch (caught) {
      if (!mounted) return;
      debugPrint('ອັບເດດລົ້ມ: $caught');
      setState(() {
        _stage = _Stage.idle;
        _error = 'ອັບເດດບໍ່ສຳເລັດ — ກະລຸນາລອງໃໝ່ ຫຼື ແຈ້ງ IT';
      });
    }
  }

  Future<void> _openInBrowser() async {
    final url = await _url();
    final opened = url != null &&
        await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      setState(() => _error = 'ເປີດລິ້ງອັບເດດບໍ່ສຳເລັດ');
    }
  }

  static String _mb(int bytes) =>
      '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';

  String get _progressLabel {
    if (_stage == _Stage.installing) return 'ກຳລັງເປີດຕົວຕິດຕັ້ງ…';
    if (_total > 0) {
      return 'ກຳລັງໂຫຼດ ${_mb(_received)} / ${_mb(_total)}'
          '  ·  ${(_progress * 100).clamp(0, 100).toStringAsFixed(0)}%';
    }
    return 'ກຳລັງໂຫຼດ ${_mb(_received)}…';
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    // ດ່ານບັງຄັບ = ອອກບໍ່ໄດ້ · ເປີດເອງຈາກແຈ້ງເຕືອນ = ອອກໄດ້
    return PopScope(
      canPop: widget.dismissible,
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: _mint,
                      borderRadius: BorderRadius.circular(26),
                    ),
                    child: const Icon(Icons.system_update, color: _onMint, size: 50),
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'ມີເວີຊັນໃໝ່',
                    style: TextStyle(
                      color: _bright,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _busy
                        ? 'ກຳລັງອັບເດດໃຫ້ອັດຕະໂນມັດ…\nເມື່ອໂຫຼດຄົບ ລະບົບຈະຖາມໃຫ້ກົດ “ຕິດຕັ້ງ”'
                        : 'ກະລຸນາອັບເດດແອັບເປັນເວີຊັນຫຼ້າສຸດ\nເພື່ອສືບຕໍ່ການໃຊ້ງານ',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: _dim, fontSize: 14.5, height: 1.6),
                  ),
                  if (info.currentVersion.isNotEmpty || info.latestVersion.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                      decoration: BoxDecoration(
                        color: _card,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: _border),
                      ),
                      child: Text(
                        'ເວີຊັນປັດຈຸບັນ: ${info.currentVersion.isEmpty ? '-' : info.currentVersion}'
                        '   •   ຕ້ອງການ: ${info.latestVersion.isEmpty ? '-' : info.latestVersion}',
                        style: const TextStyle(color: _dim, fontSize: 13),
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 20),
                    _errorBox(_error!),
                  ],
                  if (_busy) ...[
                    const SizedBox(height: 24),
                    _progressBar(),
                  ],
                  const SizedBox(height: 30),
                  SizedBox(
                    width: double.infinity,
                    height: 60,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: _mint,
                        foregroundColor: _onMint,
                        disabledBackgroundColor: _mint.withValues(alpha: .45),
                        disabledForegroundColor: _onMint.withValues(alpha: .7),
                        shape: const StadiumBorder(),
                      ),
                      onPressed: _busy ? null : _update,
                      icon: Icon(
                        _busy
                            ? Icons.downloading_rounded
                            : (_error == null
                                  ? Icons.download_rounded
                                  : Icons.refresh_rounded),
                        size: 24,
                      ),
                      label: Text(
                        _busy
                            ? 'ກຳລັງອັບເດດ…'
                            : (_error == null ? 'ອັບເດດດຽວນີ້' : 'ລອງໃໝ່'),
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                  if (_error != null && _tries >= _maxAutoTries) ...[
                    const SizedBox(height: 10),
                    const Text(
                      'ລອງໃຫ້ອັດຕະໂນມັດ 3 ຮອບແລ້ວແຕ່ບໍ່ສຳເລັດ — ກວດ WiFi/ເນັດ ແລ້ວກົດ “ລອງໃໝ່”',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: _dim, fontSize: 12, height: 1.6),
                    ),
                  ],
                  if (widget.dismissible && !_busy) ...[
                    const SizedBox(height: 4),
                    TextButton(
                      onPressed: () => Navigator.maybePop(context),
                      style: TextButton.styleFrom(foregroundColor: _dim),
                      child: const Text('ພາຍຫຼັງ'),
                    ),
                  ],
                  // ທາງອອກສຳຮອງ: ໂຫຼດໃນຕົວລົ້ມຊ້ຳໆ (proxy ແປກ) ⇒ ຍັງເອົາ APK
                  // ທາງ browser ໄດ້ຄືເກົ່າ
                  if (!_busy && _error != null && Platform.isAndroid) ...[
                    const SizedBox(height: 6),
                    TextButton.icon(
                      onPressed: _openInBrowser,
                      style: TextButton.styleFrom(foregroundColor: _dim),
                      icon: const Icon(Icons.open_in_new_rounded, size: 18),
                      label: const Text('ເປີດລິ້ງໃນ browser ແທນ'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _progressBar() => Column(
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(
          // ຄ່າລົບ = ບໍ່ຮູ້ຂະໜາດ ⇒ ແຖບແລ່ນໄປມາ (ບໍ່ແມ່ນຄ້າງຢູ່ 0%)
          value: _stage == _Stage.installing || _progress < 0
              ? null
              : _progress.clamp(0.0, 1.0),
          minHeight: 10,
          color: _mint,
          backgroundColor: _card,
        ),
      ),
      const SizedBox(height: 12),
      Text(
        _progressLabel,
        style: const TextStyle(color: _dim, fontSize: 12.5),
      ),
    ],
  );

  Widget _errorBox(String message) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFF2A1216),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0xFF5B2530)),
    ),
    child: Row(
      children: [
        const Icon(Icons.error_outline_rounded, color: Color(0xFFFB7185), size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(color: _bright, fontSize: 13),
          ),
        ),
      ],
    ),
  );
}
