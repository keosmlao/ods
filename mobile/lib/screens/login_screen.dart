import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';
import '../push.dart';
import 'jobs_screen.dart';

/// ເຂົ້າລະບົບດ້ວຍ **ລະຫັດພະນັກງານ** (ຫຼື ຊື່ຫຼິ້ນ/ຊື່ເຕັມ) — ກົດເກນອັນດຽວກັບເວັບ
/// (server: lib/credentials.ts) ⇒ ບັນຊີທີ່ຜູ້ຈັດການປິດໄວ້ ເຂົ້າທາງແອັບກໍ່ບໍ່ໄດ້.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final username = TextEditingController();
  final password = TextEditingController();
  String error = '';
  bool busy = false;

  Future<void> submit() async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await Api.login(username.text.trim(), password.text);
      await Push.register(); // ຮັບແຈ້ງເຕືອນທັນທີ — ຊ່າງບໍ່ຕ້ອງໄປຫາປຸ່ມເອງ
      if (!mounted) return;
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const JobsScreen()));
    } on ApiError catch (failure) {
      setState(() => error = failure.message);
    } catch (_) {
      setState(() => error = 'ເຊື່ອມຕໍ່ server ບໍ່ໄດ້');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'ODIEN SERVICE',
                  style: TextStyle(
                    color: teal,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'ເຂົ້າສູ່ລະບົບ',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'ໃຊ້ລະຫັດພະນັກງານ ແລະ ລະຫັດຜ່ານຂອງທ່ານ',
                  style: TextStyle(color: muted),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: username,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'ລະຫັດພະນັກງານ',
                    helperText: 'ໃຊ້ຊື່ຫຼິ້ນ ຫຼື ຊື່ເຕັມ ແທນກໍ່ໄດ້',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'ລະຫັດຜ່ານ',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (error.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    error,
                    style: const TextStyle(
                      color: danger,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: teal,
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: busy ? null : submit,
                  child: busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'ເຂົ້າສູ່ລະບົບ',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
