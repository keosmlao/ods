import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import 'nav_host.dart';
import 'server_settings_screen.dart';

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
      final user = await Api.login(
        username.text.trim(),
        password.text,
        remember: rememberMe,
      );
      await Push.register();
      if (!mounted) return;
      // ເຂົ້າສ່ວນງານຂອງ role — ແຖບລຸ່ມ (tabs) ທີ່ server ສົ່ງມາ
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => NavHost(tabs: user.tabs)),
      );
    } on ApiError catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } catch (_) {
      if (mounted) setState(() => error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> configureServer() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => ServerSettingsScreen(current: serverUrl),
      ),
    );
    if (result != null && mounted) setState(() => serverUrl = result);
  }

  @override
  Widget build(BuildContext context) {
    // ຈໍ 4 ນິ້ວ (ສູງ ~530-640) → ຫຍໍ້ hero ແລະ ໄລຍະຫ່າງ ໃຫ້ຟອມພໍດີ ບໍ່ຕ້ອງເລື່ອນຫຼາຍ
    final compact = MediaQuery.of(context).size.height < 680;
    return Scaffold(
      backgroundColor: ground,
      // v4: ບໍ່ມີ glow ຕົກແຕ່ງ — ພື້ນລ້ວນ render ໄວກວ່າເທິງ GPU ເກົ່າ
      body: SafeArea(
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
                                  'ODS by ODG',
                                  style: TextStyle(
                                    color: ink,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                                Text(
                                  'TECHNICIAN APP',
                                  style: TextStyle(
                                    color: Color(0xFF0F766E),
                                    fontSize: 10.5,
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
                            foregroundColor: const Color(0xFF0F766E),
                            backgroundColor: Colors.white,
                            side: const BorderSide(color: Color(0xFFD8E3E0)),
                          ),
                          icon: const Icon(Icons.settings_ethernet_rounded),
                        ),
                      ],
                    ),
                    SizedBox(height: compact ? 12 : 34),
                    if (!compact) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          width: 64,
                          height: 64,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: tealTint,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.person_outline_rounded,
                            color: teal,
                            size: 32,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    Text(
                      'ຍິນດີຕ້ອນຮັບ',
                      style: TextStyle(
                        color: ink,
                        fontSize: compact ? 20 : 25,
                        height: 1.2,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'ເຂົ້າລະບົບສຳລັບພະນັກງານບໍລິການ',
                      style: TextStyle(color: muted, fontSize: 12),
                    ),
                    SizedBox(height: compact ? 12 : 22),
                    Container(
                      padding: EdgeInsets.all(compact ? 15 : 20),
                      // v4: flat — ຂອບແທນເງົາໃຫຍ່
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(kCardRadius),
                        border: Border.all(color: line),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'ເຂົ້າສູ່ລະບົບ',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              color: ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'ກະລຸນາປ້ອນບັນຊີພະນັກງານຂອງທ່ານ',
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
                              style: TextStyle(color: muted, fontSize: 11),
                            ),
                          ),
                          if (error.isNotEmpty) ...[
                            const SizedBox(height: 13),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: dangerTint,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: danger.withValues(alpha: .35),
                                ),
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
                                        color: Color(0xFF9F1239),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        height: 1.4,
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
                                style: TextStyle(color: muted, fontSize: 11),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.circle,
                          size: 7,
                          color: Color(0xFF16A34A),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            serverUrl,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: muted, fontSize: 11),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'ODIEN Group · Service Operations',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: faint, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ),
    );
  }
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
    ),
    child: const Icon(Icons.handyman_rounded, color: Colors.white, size: 23),
  );
}
