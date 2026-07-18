import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../api.dart';
import '../main.dart';
import 'login_screen.dart';

/// **ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ** — ໜ້າຫຼັກຂອງຄົນທີ່ບໍ່ແມ່ນຊ່າງ.
///
/// ຍິງ barcode (ກ້ອງ ຫຼື ພິມ) → ໝາຍວ່າພົບ · ກົດ "ສຳເລັດ" → server ໝາຍ 'ຕ້ອງກວດ'
/// ໃຫ້ອັນທີ່ບໍ່ພົບ. ກົດເກນ/ຂອບເຂດຢູ່ server (lib/stock-count) — ແອັບພຽງສະແດງ+ຍິງ.
class StockCountScreen extends StatefulWidget {
  const StockCountScreen({super.key});

  @override
  State<StockCountScreen> createState() => _StockCountScreenState();
}

class _StockCountScreenState extends State<StockCountScreen> {
  List<StockItem>? _items; // null = ກຳລັງໂຫຼດ
  String? _error;
  bool _enabled = true;
  bool _busy = false;
  final _scanned = <String>{};
  final _codes = <String>{};
  final _manual = TextEditingController();
  final _manualFocus = FocusNode();
  String? _flash;
  bool _flashOk = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _manual.dispose();
    _manualFocus.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _items = null;
      _error = null;
    });
    try {
      final data = await Api.stockCount();
      _codes
        ..clear()
        ..addAll(data.jobs.map((j) => j.code));
      if (mounted) {
        setState(() {
          _items = data.jobs;
          _enabled = data.enabled;
        });
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'ໂຫຼດລາຍການບໍ່ສຳເລັດ');
    }
  }

  void _count(String raw) {
    final code = raw.trim();
    if (code.isEmpty) return;
    setState(() {
      if (_codes.contains(code)) {
        _scanned.add(code);
        _flash = 'ພົບ $code — ນັບແລ້ວ';
        _flashOk = true;
      } else {
        _flash = '$code ບໍ່ຢູ່ໃນລາຍການທີ່ຕ້ອງນັບ';
        _flashOk = false;
      }
    });
    _manual.clear();
    _manualFocus.requestFocus();
  }

  Future<void> _scanCamera() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _ScannerPage()),
    );
    if (code != null) _count(code);
  }

  Future<void> _finalize() async {
    final total = _items?.length ?? 0;
    final notFound = total - _scanned.length;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ສຳເລັດການກວດນັບ?'),
        content: Text(
          'ສະແກນພົບ ${_scanned.length}/$total ອັນ.\n'
          'ເຄື່ອງທີ່ບໍ່ພົບ $notFound ອັນ ຈະຖືກໝາຍ “ຕ້ອງກວດວ່າຍັງຢູ່” ອັດຕະໂນມັດ.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('ຍົກເລີກ'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: notFound > 0 ? danger : teal,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ໝາຍ ຕ້ອງກວດ'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final (held, missing) = await Api.stockCountFinalize(_scanned.toList());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: ok2Green,
          content: Text('ໝາຍ “ຕ້ອງກວດ” $held ອັນ (ບໍ່ພົບ $missing)'),
        ),
      );
      _scanned.clear();
      await _load();
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    await Api.clearToken();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = _items?.length ?? 0;
    final found = _scanned.length;
    final pct = total > 0 ? found / total : 0.0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('ກວດນັບສະຕ໋ອກ'),
        actions: [
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            tooltip: 'ອອກ',
          ),
        ],
      ),
      body: _error != null
          ? _ErrorView(message: _error!, onRetry: _load)
          : _items == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // ── ແຖບສະແກນ + ຄວາມຄືບໜ້າ ──
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _manual,
                              focusNode: _manualFocus,
                              autofocus: true,
                              textInputAction: TextInputAction.done,
                              onSubmitted: _count,
                              decoration: const InputDecoration(
                                hintText: 'ພິມ/ຍິງເລກງານ ແລ້ວ Enter',
                                prefixIcon: Icon(Icons.qr_code_2),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            onPressed: _scanCamera,
                            style: FilledButton.styleFrom(
                              backgroundColor: teal,
                              minimumSize: const Size(56, 52),
                            ),
                            child: const Icon(Icons.camera_alt),
                          ),
                        ],
                      ),
                      if (_flash != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(
                              _flashOk ? Icons.check_circle : Icons.error,
                              size: 18,
                              color: _flashOk ? ok : danger,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                _flash!,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: _flashOk ? ok : danger,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'ສະແກນພົບ $found / $total',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            '${(pct * 100).round()}%',
                            style: const TextStyle(color: muted, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: pct,
                          minHeight: 8,
                          backgroundColor: const Color(0xFFF1F5F9),
                          valueColor: const AlwaysStoppedAnimation(teal),
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (!_enabled)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 10),
                          child: Text(
                            'ໝາຍວຽກມີບັນຫາຖືກປິດຢູ່ — ນັບໄດ້ ແຕ່ກົດສຳເລັດບໍ່ໄດ້',
                            style: TextStyle(color: danger, fontSize: 11),
                          ),
                        ),
                      SizedBox(
                        height: 50,
                        child: FilledButton(
                          onPressed: (_busy || !_enabled) ? null : _finalize,
                          style: FilledButton.styleFrom(backgroundColor: ink),
                          child: Text(
                            _busy
                                ? 'ກຳລັງໝາຍ...'
                                : 'ສຳເລັດການນັບ — ໝາຍ ${total - found} ອັນ ‘ຕ້ອງກວດ’',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                // ── ລາຍການ ──
                Expanded(
                  child: total == 0
                      ? const Center(
                          child: Text(
                            'ບໍ່ມີເຄື່ອງທີ່ຕ້ອງນັບ',
                            style: TextStyle(color: muted),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                            itemCount: total,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (_, i) => _ItemCard(
                              item: _items![i],
                              found: _scanned.contains(_items![i].code),
                            ),
                          ),
                        ),
                ),
              ],
            ),
    );
  }
}

/// ສີຂຽວອ່ອນສຳລັບ snackbar ສຳເລັດ
const ok2Green = Color(0xFF059669);

class _ItemCard extends StatelessWidget {
  final StockItem item;
  final bool found;
  const _ItemCard({required this.item, required this.found});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: found ? const Color(0xFFECFDF5) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: found ? const Color(0xFF6EE7B7) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                item.code,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0536A9),
                ),
              ),
              if (found)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: ok,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check, size: 12, color: Colors.white),
                      SizedBox(width: 3),
                      Text(
                        'ພົບແລ້ວ',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item.stageLabel,
                    style: const TextStyle(
                      color: muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            item.product ?? '-',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          Text(
            [
              item.brand,
              item.sn,
            ].where((v) => v != null && v.isNotEmpty).join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: muted, fontSize: 12),
          ),
          if (item.customer != null && item.customer!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              item.customer!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: muted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final Future<void> Function() onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 40, color: muted),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('ລອງໃໝ່')),
          ],
        ),
      ),
    );
  }
}

/// ໜ້າກ້ອງສະແກນ barcode — ຄືນ code ອັນທຳອິດທີ່ອ່ານໄດ້
class _ScannerPage extends StatefulWidget {
  const _ScannerPage();

  @override
  State<_ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<_ScannerPage> {
  bool _done = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ສະແກນ barcode')),
      body: MobileScanner(
        onDetect: (capture) {
          if (_done) return;
          final code = capture.barcodes.isNotEmpty
              ? capture.barcodes.first.rawValue
              : null;
          if (code != null && code.trim().isNotEmpty) {
            _done = true;
            Navigator.of(context).pop(code.trim());
          }
        },
      ),
    );
  }
}
