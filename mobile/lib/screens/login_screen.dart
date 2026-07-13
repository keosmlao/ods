import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import 'jobs_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final username = TextEditingController();
  final password = TextEditingController();
  final passwordFocus = FocusNode();
  String error = '';
  bool busy = false;
  bool hidePassword = true;
  String serverUrl = Api.defaultBaseUrl;

  @override
  void initState() {
    super.initState();
    Api.serverUrl().then((value) {
      if (mounted) setState(() => serverUrl = value);
    });
  }

  @override
  void dispose() {
    username.dispose();
    password.dispose();
    passwordFocus.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (username.text.trim().isEmpty || password.text.isEmpty) {
      setState(() => error = 'ກະລຸນາປ້ອນລະຫັດພະນັກງານ ແລະລະຫັດຜ່ານ');
      return;
    }
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await Api.login(username.text.trim(), password.text);
      await Push.register();
      if (!mounted) return;
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const JobsScreen()));
    } on ApiError catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } catch (_) {
      if (mounted) setState(() => error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> configureServer() async {
    final controller = TextEditingController(text: serverUrl);
    String? message;
    bool testing = false;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.dns_outlined, color: teal),
              SizedBox(width: 9),
              Text('ຕັ້ງຄ່າ Server'),
            ],
          ),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'ໃສ່ URL ຂອງ ODSS server',
                  style: TextStyle(color: muted, fontSize: 12),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Server URL',
                    hintText: 'http://10.0.21.161:3000',
                    prefixIcon: Icon(Icons.link_rounded),
                  ),
                ),
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      message!,
                      style: TextStyle(
                        color: message!.startsWith('✓') ? ok : danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: testing
                  ? null
                  : () async {
                      await Api.resetServerUrl();
                      if (!dialogContext.mounted) return;
                      controller.text = Api.defaultBaseUrl;
                      setDialogState(() => message = 'ກັບຄືນຄ່າຕັ້ງຕົ້ນ');
                    },
              child: const Text('Reset'),
            ),
            OutlinedButton(
              onPressed: testing
                  ? null
                  : () async {
                      setDialogState(() {
                        testing = true;
                        message = null;
                      });
                      try {
                        await Api.testServer(controller.text);
                        if (!dialogContext.mounted) return;
                        setDialogState(
                          () => message = '✓ ເຊື່ອມຕໍ່ server ໄດ້',
                        );
                      } catch (e) {
                        if (!dialogContext.mounted) return;
                        setDialogState(
                          () => message = e is ApiError
                              ? e.message
                              : e.toString(),
                        );
                      } finally {
                        if (dialogContext.mounted) {
                          setDialogState(() => testing = false);
                        }
                      }
                    },
              child: testing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('ທົດສອບ'),
            ),
            FilledButton(
              onPressed: testing
                  ? null
                  : () async {
                      try {
                        final value = Api.normalizeServerUrl(controller.text);
                        await Api.saveServerUrl(value);
                        if (!dialogContext.mounted) return;
                        if (mounted) setState(() => serverUrl = value);
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } catch (e) {
                        if (!dialogContext.mounted) return;
                        setDialogState(
                          () => message = e.toString().replaceFirst(
                            'FormatException: ',
                            '',
                          ),
                        );
                      }
                    },
              child: const Text('ບັນທຶກ'),
            ),
          ],
        ),
      ),
    );
    // The dialog route may still be completing its inherited-widget teardown here.
    // Let the controller be collected with the closed route instead of disposing it
    // synchronously and racing Flutter's dependent cleanup during hot reload/pop.
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: ink,
    body: Stack(
      children: [
        Positioned(
          right: -85,
          top: -70,
          child: _Glow(size: 250, color: teal.withValues(alpha: .20)),
        ),
        Positioned(
          left: -110,
          bottom: 20,
          child: _Glow(
            size: 240,
            color: const Color(0xFF2563EB).withValues(alpha: .12),
          ),
        ),
        SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Row(
                      children: [
                        _BrandMark(),
                        SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'ODIEN SERVICE',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.2,
                              ),
                            ),
                            Text(
                              'FIELD OPERATIONS',
                              style: TextStyle(
                                color: Color(0xFF5EEAD4),
                                fontSize: 9,
                                letterSpacing: 2,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 44),
                    const Text(
                      'ຈັດການວຽກບໍລິການ\nໄດ້ທຸກບ່ອນ',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 31,
                        height: 1.25,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 9),
                    const Text(
                      'ຮັບງານ · ກວດເຊັກ · ອາໄຫຼ່ · ບັນທຶກຜົນງານ',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    ),
                    const SizedBox(height: 30),
                    Container(
                      padding: const EdgeInsets.all(21),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(25),
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 32,
                            offset: Offset(0, 18),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'ຍິນດີຕ້ອນຮັບ',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'ເຂົ້າລະບົບດ້ວຍບັນຊີພະນັກງານ',
                            style: TextStyle(color: muted, fontSize: 12),
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: username,
                            autocorrect: false,
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) => passwordFocus.requestFocus(),
                            decoration: const InputDecoration(
                              labelText: 'ລະຫັດພະນັກງານ',
                              prefixIcon: Icon(Icons.badge_outlined),
                              hintText: 'ຕົວຢ່າງ: EMP001',
                            ),
                          ),
                          const SizedBox(height: 13),
                          TextField(
                            controller: password,
                            focusNode: passwordFocus,
                            obscureText: hidePassword,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => busy ? null : submit(),
                            decoration: InputDecoration(
                              labelText: 'ລະຫັດຜ່ານ',
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                              ),
                              suffixIcon: IconButton(
                                tooltip: hidePassword
                                    ? 'ສະແດງລະຫັດຜ່ານ'
                                    : 'ເຊື່ອງລະຫັດຜ່ານ',
                                onPressed: () => setState(
                                  () => hidePassword = !hidePassword,
                                ),
                                icon: Icon(
                                  hidePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                              ),
                            ),
                          ),
                          if (error.isNotEmpty) ...[
                            const SizedBox(height: 13),
                            Container(
                              padding: const EdgeInsets.all(11),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.error_outline_rounded,
                                    color: danger,
                                    size: 19,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      error,
                                      style: const TextStyle(
                                        color: Color(0xFF991B1B),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 19),
                          FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: teal,
                              minimumSize: const Size.fromHeight(55),
                            ),
                            onPressed: busy ? null : submit,
                            child: busy
                                ? const SizedBox(
                                    width: 21,
                                    height: 21,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text('ເຂົ້າສູ່ລະບົບ'),
                                      SizedBox(width: 8),
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 19,
                                      ),
                                    ],
                                  ),
                          ),
                          const SizedBox(height: 13),
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.shield_outlined,
                                size: 14,
                                color: muted,
                              ),
                              SizedBox(width: 5),
                              Text(
                                'ຂໍ້ມູນຖືກເກັບໃນ Secure Storage',
                                style: TextStyle(color: muted, fontSize: 10),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextButton.icon(
                      onPressed: configureServer,
                      icon: const Icon(
                        Icons.settings_ethernet_rounded,
                        size: 17,
                      ),
                      label: Text(serverUrl, overflow: TextOverflow.ellipsis),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF94A3B8),
                      ),
                    ),
                    const Text(
                      'ODIEN Group · Service Operations',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 10),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _Glow extends StatelessWidget {
  const _Glow({required this.size, required this.color});
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, color: color),
  );
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();
  @override
  Widget build(BuildContext context) => Container(
    width: 49,
    height: 49,
    decoration: BoxDecoration(
      color: teal,
      borderRadius: BorderRadius.circular(15),
      boxShadow: [
        BoxShadow(color: teal.withValues(alpha: .35), blurRadius: 18),
      ],
    ),
    child: const Icon(Icons.handyman_rounded, color: Colors.white, size: 27),
  );
}
