import 'package:flutter/material.dart';

import 'api.dart';
import 'push.dart';
import 'screens/income_screen.dart';
import 'screens/jobs_screen.dart';
import 'screens/login_screen.dart';

/// ODIEN Service — ແອັບຊ່າງ.
///
/// ຫຼັກການ: ກົດເກນທັງໝົດຢູ່ **server** (lib/job-flow · lib/tech-flow · lib/qc-flow ຂອງເວັບ).
/// ແອັບພຽງແຕ່ສະແດງປຸ່ມທີ່ server ບອກວ່າກົດໄດ້ (`job.action`) ແລ້ວຍິງຄຳສັ່ງກັບໄປ
/// ⇒ ກົດຈາກແອັບ ຫຼື ຈາກເວັບ ໄດ້ຜົນຄືກັນທຸກປະການ ແລະ ຂ້າມຂັ້ນບໍ່ໄດ້.
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ແຈ້ງເຕືອນ (FCM) — ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Firebase ກໍ່ບໍ່ເປັນຫຍັງ (Push.init ຈັບ error ໄວ້)
  await Push.init();

  runApp(const OdssApp());
}

const teal = Color(0xFF0D9488);
const ink = Color(0xFF0F172A);
const danger = Color(0xFFDC2626);
const ok = Color(0xFF059669);
const muted = Color(0xFF64748B);

class OdssApp extends StatelessWidget {
  const OdssApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ODIEN Service',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: teal),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        appBarTheme: const AppBarTheme(
          backgroundColor: ink,
          foregroundColor: Colors.white,
          titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        useMaterial3: true,
      ),
      home: const _Gate(),
      routes: {
        '/jobs': (_) => const JobsScreen(),
        '/income': (_) => const IncomeScreen(),
        '/login': (_) => const LoginScreen(),
      },
    );
  }
}

/// ມີ token ຢູ່ບໍ — token ອາຍຸ 30 ມື້ (server ອອກໃຫ້) ⇒ ຊ່າງບໍ່ຖືກໄລ່ອອກກາງເຄິ່ງງານ
class _Gate extends StatefulWidget {
  const _Gate();

  @override
  State<_Gate> createState() => _GateState();
}

class _GateState extends State<_Gate> {
  bool? signedIn;

  @override
  void initState() {
    super.initState();
    Api.token().then((value) {
      if (mounted) setState(() => signedIn = value != null);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (signedIn == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return signedIn! ? const JobsScreen() : const LoginScreen();
  }
}
