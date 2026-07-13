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
  bool rememberMe = true;
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
      await Api.login(
        username.text.trim(),
        password.text,
        remember: rememberMe,
      );
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
              constraints: const BoxConstraints(maxWidth: 400),
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 14,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            _BrandMark(),
                            SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'ODIEN SERVICE',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                                Text(
                                  'TECHNICIAN APP',
                                  style: TextStyle(
                                    color: Color(0xFF5EEAD4),
                                    fontSize: 9,
                                    letterSpacing: 1.8,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        IconButton(
                          tooltip: 'ຕັ້ງຄ່າ Server',
                          onPressed: configureServer,
                          style: IconButton.styleFrom(
                            foregroundColor: Colors.white,
                            backgroundColor: Colors.white.withValues(
                              alpha: .08,
                            ),
                          ),
                          icon: const Icon(Icons.settings_ethernet_rounded),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Center(child: _TechnicianHero()),
                    const SizedBox(height: 12),
                    const Text(
                      'ພ້ອມຮັບວຽກມື້ນີ້ບໍ?',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        height: 1.2,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'ເຂົ້າລະບົບເພື່ອເບິ່ງຄິວຕິດຕັ້ງ ແລະ ສ້ອມແປງ',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                    const SizedBox(height: 15),
                    Container(
                      padding: const EdgeInsets.all(17),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 24,
                            offset: Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'ເຂົ້າສູ່ລະບົບຊ່າງ',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              color: ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'ເຂົ້າລະບົບດ້ວຍບັນຊີພະນັກງານ',
                            style: TextStyle(color: muted, fontSize: 12),
                          ),
                          const SizedBox(height: 15),
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
                          const SizedBox(height: 10),
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
                          const SizedBox(height: 4),
                          CheckboxListTile(
                            value: rememberMe,
                            onChanged: busy
                                ? null
                                : (value) => setState(
                                    () => rememberMe = value ?? false,
                                  ),
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            controlAffinity: ListTileControlAffinity.leading,
                            title: const Text(
                              'ຈື່ການເຂົ້າລະບົບ',
                              style: TextStyle(
                                color: ink,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: const Text(
                              'ຄົງການ Login ໄວ້ໃນເຄື່ອງນີ້',
                              style: TextStyle(color: muted, fontSize: 10),
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
                          const SizedBox(height: 15),
                          FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: teal,
                              minimumSize: const Size.fromHeight(48),
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
                          const SizedBox(height: 10),
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
                    const SizedBox(height: 8),
                    Text(
                      serverUrl,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFF64748B),
                        fontSize: 9,
                      ),
                    ),
                    const SizedBox(height: 4),
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

class _TechnicianHero extends StatelessWidget {
  const _TechnicianHero();

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 150,
    height: 82,
    child: Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 118,
          height: 72,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: .10)),
          ),
        ),
        Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            color: teal,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: teal.withValues(alpha: .35), blurRadius: 22),
            ],
          ),
          child: const Icon(
            Icons.engineering_rounded,
            color: Colors.white,
            size: 36,
          ),
        ),
        const Positioned(
          left: 4,
          bottom: 7,
          child: _ToolBadge(icon: Icons.build_rounded),
        ),
        const Positioned(
          right: 4,
          top: 7,
          child: _ToolBadge(icon: Icons.home_repair_service_rounded),
        ),
      ],
    ),
  );
}

class _ToolBadge extends StatelessWidget {
  const _ToolBadge({required this.icon});
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
    width: 32,
    height: 32,
    decoration: BoxDecoration(
      color: const Color(0xFF1E293B),
      shape: BoxShape.circle,
      border: Border.all(color: const Color(0xFF475569)),
    ),
    child: Icon(icon, color: const Color(0xFF5EEAD4), size: 16),
  );
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();
  @override
  Widget build(BuildContext context) => Container(
    width: 42,
    height: 42,
    decoration: BoxDecoration(
      color: teal,
      borderRadius: BorderRadius.circular(13),
      boxShadow: [
        BoxShadow(color: teal.withValues(alpha: .35), blurRadius: 18),
      ],
    ),
    child: const Icon(Icons.handyman_rounded, color: Colors.white, size: 23),
  );
}
