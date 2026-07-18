import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// **ຕັ້ງຄ່າ Server** — ໜ້າເຕັມ (ແທນ modal ເກົ່າ) ໃຫ້ພໍດີຈໍ 4 ນິ້ວ.
///
/// pop() ຄືນ URL ທີ່ບັນທຶກ (String) ຫຼື null ຖ້າອອກໂດຍບໍ່ບັນທຶກ.
class ServerSettingsScreen extends StatefulWidget {
  const ServerSettingsScreen({super.key, required this.current});
  final String current;

  @override
  State<ServerSettingsScreen> createState() => _ServerSettingsScreenState();
}

class _ServerSettingsScreenState extends State<ServerSettingsScreen> {
  late final TextEditingController _url = TextEditingController(
    text: widget.current,
  );
  String? _message;
  bool _messageOk = false;
  bool _testing = false;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _message = null;
    });
    try {
      await Api.testServer(_url.text);
      if (mounted) {
        setState(() {
          _message = 'ເຊື່ອມຕໍ່ server ໄດ້';
          _messageOk = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _message = e is ApiError ? e.message : e.toString();
          _messageOk = false;
        });
      }
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _reset() async {
    await Api.resetServerUrl();
    if (!mounted) return;
    setState(() {
      _url.text = Api.defaultBaseUrl;
      _message = 'ກັບຄືນຄ່າຕັ້ງຕົ້ນແລ້ວ';
      _messageOk = true;
    });
  }

  Future<void> _save() async {
    try {
      final value = Api.normalizeServerUrl(_url.text);
      await Api.saveServerUrl(value);
      if (!mounted) return;
      Navigator.of(context).pop(value);
    } catch (e) {
      if (mounted) {
        setState(() {
          _message = e.toString().replaceFirst('FormatException: ', '');
          _messageOk = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.dns_outlined, size: 20),
            SizedBox(width: 8),
            Text('ຕັ້ງຄ່າ Server'),
          ],
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'ໃສ່ URL ຂອງ ODSS server ທີ່ແອັບຈະຕໍ່',
                style: TextStyle(color: muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _url,
                keyboardType: TextInputType.url,
                autocorrect: false,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Server URL',
                  hintText: 'http://10.0.21.161:3000',
                  prefixIcon: Icon(Icons.link_rounded),
                ),
              ),
              if (_message != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _messageOk
                        ? const Color(0xFFECFDF5)
                        : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        _messageOk
                            ? Icons.check_circle_outline
                            : Icons.error_outline_rounded,
                        size: 19,
                        color: _messageOk ? ok : danger,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _message!,
                          style: TextStyle(
                            color: _messageOk
                                ? const Color(0xFF065F46)
                                : const Color(0xFF991B1B),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 22),
              OutlinedButton.icon(
                onPressed: _testing ? null : _test,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                icon: _testing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.wifi_tethering_rounded, size: 20),
                label: Text(_testing ? 'ກຳລັງທົດສອບ...' : 'ທົດສອບການເຊື່ອມຕໍ່'),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: _testing ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: teal,
                  minimumSize: const Size.fromHeight(50),
                ),
                icon: const Icon(Icons.save_rounded, size: 20),
                label: const Text('ບັນທຶກ'),
              ),
              const SizedBox(height: 10),
              TextButton.icon(
                onPressed: _testing ? null : _reset,
                style: TextButton.styleFrom(foregroundColor: muted),
                icon: const Icon(Icons.restart_alt_rounded, size: 18),
                label: const Text('ກັບຄືນຄ່າຕັ້ງຕົ້ນ'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
