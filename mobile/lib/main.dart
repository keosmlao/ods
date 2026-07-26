import 'package:flutter/material.dart';

import 'api.dart';
import 'push.dart';
import 'screens/login_screen.dart';
import 'screens/nav_host.dart';

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

// ── Design tokens v2 (ທັນສະໄໝ) — ແບຣນ emerald + hero ໄລ່ສີເຂັ້ມ ──
// ໝາຍເຫດ: ຮັກສາຊື່ `teal` ໄວ້ (ໜ້າຕ່າງໆ import ຢູ່) ແຕ່ຄ່າ = emerald.
const teal = Color(0xFF059669); // brand deep — ປຸ່ມ/ຕົວອັກສອນເນັ້ນ
const tealBright = Color(0xFF10B981); // emerald ສົດ — ໄລ່ສີ/active
const tealTint = Color(0xFFD6F5E9); // brand soft — ພື້ນອ່ອນ (ຊິບ/ໄອຄອນ)
const ink = Color(0xFF0A1A16); // ຫົວຂໍ້ / ຕົວອັກສອນເຂັ້ມ
const danger = Color(0xFFF43F5E); // rose
const ok = Color(0xFF059669); // emerald (= brand)
const warn = Color(0xFFE08A0B); // amber
const muted = Color(0xFF5A6C67);
const faint = Color(0xFF93A29D);
const ground = Color(0xFFEDF3F1); // ພື້ນຫຼັງໜ້າ
const surfaceAlt = Color(0xFFF5F9F7); // ພື້ນຮອງ (input/seg)
const line = Color(0xFFE4ECE9);

// ── Hero header (ໄລ່ສີ emerald→ink) ──
const hero1 = Color(0xFF0A2A24); // ເຂັ້ມສຸດ (ລຸ່ມ)
const hero2 = Color(0xFF114A3C); // ອ່ອນກວ່າ (ເທິງ)
const onHero = Color(0xFFEAFBF3); // ຕົວອັກສອນເທິງ hero
const onHeroDim = Color(0xFF9FD9C6); // ຕົວອັກສອນຈາງເທິງ hero

class OdssApp extends StatelessWidget {
  const OdssApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ODS by ODG',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme:
            ColorScheme.fromSeed(
              seedColor: teal,
              brightness: Brightness.light,
            ).copyWith(
              surface: Colors.white,
              onSurface: ink,
              error: danger,
            ),
        scaffoldBackgroundColor: ground,
        fontFamily: 'Noto Sans Lao',
        fontFamilyFallback: const ['Noto Sans Lao', 'sans-serif'],
        // AppBar ຂາວສະອາດ (ບໍ່ແມ່ນ bar ດຳໜັກແບບเก่า) — ຫົວຂໍ້ ink, ບໍ່ມີເງົາ
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: ink,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          surfaceTintColor: Colors.transparent,
          titleTextStyle: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: ink,
            letterSpacing: -.2,
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: surfaceAlt,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 15,
          ),
          hintStyle: const TextStyle(color: faint),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: line),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: line),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: teal, width: 1.6),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: teal,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(15),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: teal,
            minimumSize: const Size.fromHeight(48),
            backgroundColor: surfaceAlt,
            side: const BorderSide(color: line),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(13),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          shadowColor: const Color(0x140C1B18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: line),
          ),
        ),
        dividerTheme: const DividerThemeData(color: line, thickness: 1, space: 1),
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          backgroundColor: ink,
          contentTextStyle: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        useMaterial3: true,
      ),
      // ຫຍໍ້ font ທັງແອັບ ~10% (ບໍ່ໃຫ້ໃຫຍ່ເກີນ 0.9 ເຖິງ system ຕັ້ງໃຫຍ່)
      builder: (context, child) => MediaQuery.withClampedTextScaling(
        maxScaleFactor: 0.9,
        child: child!,
      ),
      home: const _Gate(),
      routes: {'/login': (_) => const LoginScreen()},
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
  Widget? _screen; // null = ກຳລັງໂຫຼດ

  @override
  void initState() {
    super.initState();
    _decide();
  }

  Future<void> _decide() async {
    final token = await Api.token();
    if (token != null) {
      /*
        ລົງທະບຽນ token FCM **ທຸກເທື່ອທີ່ເປີດແອັບ** ບໍ່ແມ່ນສະເພາະຕອນ login.
        ເປັນຫຍັງ: ຊ່າງ login ຄ້າງໄວ້ເປັນເດືອນ ⇒ ຖ້າລົງທະບຽນແຕ່ຕອນ login
        ຄົນທີ່ login ໄວ້ກ່ອນໜ້າ (ຫຼື ຕອນຕິດຕັ້ງ Firebase ໃໝ່) ຈະບໍ່ມີ token ຈັກເທື່ອ
        ແລະ ບໍ່ໄດ້ຮັບແຈ້ງເຕືອນເລີຍ. FCM token ຍັງປ່ຽນເອງໄດ້ (ລ້າງ app data / ຕິດຕັ້ງໃໝ່).
        ບໍ່ລໍຜົນ (ບໍ່ await) ⇒ ບໍ່ຖ່ວງການເປີດແອັບ; ລົ້ມກໍ່ບໍ່ກະທົບ (Push ຈັບ error ໄວ້).
      */
      Push.register();
    }
    // ມີ token → ດຶງ manifest **ໃໝ່** (role/tab ອາດປ່ຽນ server-side) ⇒ ບໍ່ຕ້ອງ login ຄືນ.
    // token ໝົດອາຍຸ (401) → refreshSession ລ້າງ token ແລ້ວ return false ⇒ ໄປໜ້າ login.
    Widget next;
    if (token == null) {
      next = const LoginScreen();
    } else {
      final valid = await Api.refreshSession();
      next = valid ? NavHost(tabs: await Api.savedTabs()) : const LoginScreen();
    }
    if (mounted) setState(() => _screen = next);
  }

  @override
  Widget build(BuildContext context) {
    return _screen ??
        const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
