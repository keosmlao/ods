import 'dart:io';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../app_update.dart';
import '../main.dart';

/// **ໜ້າ "ຕ້ອງອັບເດດ"** — ທັບທັງແອັບ ອອກບໍ່ໄດ້ຈົນກວ່າຈະຕິດຕັ້ງລຸ້ນໃໝ່.
///
/// ກົດ "ອັບເດດດຽວນີ້" = ໂຫຼດ APK ໃນຕົວແອັບ (ມີແຖບຄວາມຄືບໜ້າ) ແລ້ວເປີດຕົວຕິດຕັ້ງ
/// ຂອງລະບົບໃຫ້ເລີຍ — ບໍ່ໄດ້ໂຍນຊ່າງໄປ browser ແລ້ວປ່ອຍໃຫ້ຫາໄຟລ໌ໃນ Files ເອງ
/// (ບ່ອນທີ່ການອັບເດດເຄີຍຄ້າງຢູ່ຕະຫຼອດ).
class UpdateRequiredScreen extends StatefulWidget {
  const UpdateRequiredScreen({super.key, required this.info});

  final AppUpdateInfo info;

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

  bool get _busy => _stage != _Stage.idle;

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
    // canPop: false — ກົດປຸ່ມກັບຄືນອອກຈາກໜ້ານີ້ບໍ່ໄດ້
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: ground,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: tealTint,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Icon(
                      Icons.system_update_rounded,
                      color: teal,
                      size: 44,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'ມີເວີຊັນໃໝ່',
                    style: TextStyle(
                      color: ink,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'ກະລຸນາອັບເດດແອັບເປັນເວີຊັນຫຼ້າສຸດ\nເພື່ອສືບຕໍ່ການໃຊ້ງານ',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: muted, fontSize: 14, height: 1.5),
                  ),
                  if (info.currentVersion.isNotEmpty ||
                      info.latestVersion.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: line),
                      ),
                      child: Text(
                        'ເວີຊັນຂອງທ່ານ: ${info.currentVersion.isEmpty ? '-' : info.currentVersion}'
                        '   •   ຕ້ອງການ: ${info.latestVersion.isEmpty ? '-' : info.latestVersion}',
                        style: const TextStyle(color: faint, fontSize: 12),
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    _errorBox(_error!),
                  ],
                  if (_busy) ...[
                    const SizedBox(height: 20),
                    _progressBar(),
                  ],
                  const SizedBox(height: 26),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy ? null : _update,
                      icon: Icon(
                        _busy
                            ? Icons.downloading_rounded
                            : (_error == null
                                  ? Icons.download_rounded
                                  : Icons.refresh_rounded),
                      ),
                      label: Text(
                        _busy
                            ? 'ກຳລັງອັບເດດ…'
                            : (_error == null ? 'ອັບເດດດຽວນີ້' : 'ລອງໃໝ່'),
                      ),
                    ),
                  ),
                  // ທາງອອກສຳຮອງ: ໂຫຼດໃນຕົວລົ້ມຊ້ຳໆ (proxy ແປກ) ⇒ ຍັງເອົາ APK
                  // ທາງ browser ໄດ້ຄືເກົ່າ
                  if (!_busy && _error != null && Platform.isAndroid) ...[
                    const SizedBox(height: 10),
                    TextButton.icon(
                      onPressed: _openInBrowser,
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
        borderRadius: BorderRadius.circular(6),
        child: LinearProgressIndicator(
          // ຄ່າລົບ = ບໍ່ຮູ້ຂະໜາດ ⇒ ແຖບແລ່ນໄປມາ (ບໍ່ແມ່ນຄ້າງຢູ່ 0%)
          value: _stage == _Stage.installing || _progress < 0
              ? null
              : _progress.clamp(0.0, 1.0),
          minHeight: 10,
          color: teal,
          backgroundColor: surfaceAlt,
        ),
      ),
      const SizedBox(height: 10),
      Text(
        _progressLabel,
        style: const TextStyle(color: faint, fontSize: 12),
      ),
    ],
  );

  Widget _errorBox(String message) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: dangerTint,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: danger.withValues(alpha: .35)),
    ),
    child: Row(
      children: [
        const Icon(Icons.error_outline_rounded, color: danger, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(color: ink, fontSize: 12.5),
          ),
        ),
      ],
    ),
  );
}
