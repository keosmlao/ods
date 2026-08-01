import 'package:flutter/material.dart';

import 'api.dart';
import 'app_links.dart';
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
  WidgetsBinding.instance.addPostFrameCallback((_) => AppLinks.flush());
}

// ── Design tokens v3 (Minimalist Executive Slate) ──
const teal = Color(0xFF0F766E); // brand teal-slate
const tealBright = Color(0xFF0D9488); // active highlight
const tealTint = Color(0xFFCCFBF1); // soft badge tint
const ink = Color(0xFF0F172A); // slate 900 — crisp title text
const danger = Color(0xFFE11D48); // rose 600
const ok = Color(0xFF059669); // emerald 600
const warn = Color(0xFFD97706); // amber 600
const muted = Color(0xFF64748B); // slate 500
const faint = Color(0xFF94A3B8); // slate 400
const ground = Color(0xFFF8FAFC); // slate 50 clean background
const surfaceAlt = Color(0xFFF1F5F9); // slate 100
const line = Color(0xFFE2E8F0); // slate 200

// ── Hero header (Obsidian Slate Theme) ──
const hero1 = Color(0xFF0F172A); // slate 900
const hero2 = Color(0xFF1E293B); // slate 800
const onHero = Color(0xFFF8FAFC);
const onHeroDim = Color(0xFF94A3B8);

class OdssApp extends StatelessWidget {
  const OdssApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ODS by ODG',
      navigatorKey: navigatorKey,
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
    if (token == null) {
      if (mounted) setState(() => _screen = const LoginScreen());
      return;
    }

    // ── cache-first: ສະແດງແອັບ **ທັນທີ** ຈາກ tab cache (ບໍ່ຖ່ວງດ້ວຍເຄືອຂ່າຍ) ──
    // ຊ່າງພາກສະໜາມສັນຍານບໍ່ດີ ⇒ ຢ່າໃຫ້ໝູນຄ້າງລໍ /me. ດຶງ manifest ໃໝ່ພື້ນຫຼັງ,
    // ປ່ຽນແທ້ (role/tab ຕ່າງ) ຈຶ່ງ rebuild · token ໝົດອາຍຸ (401) → refreshSession ລ້າງ → login.
    final cached = await Api.savedTabs();
    final cachedSig = cached.map((t) => t.key).join(',');
    if (mounted) setState(() => _screen = NavHost(key: ValueKey(cachedSig), tabs: cached));

    final valid = await Api.refreshSession();
    if (!mounted) return;
    if (!valid) {
      setState(() => _screen = const LoginScreen());
      return;
    }
    final fresh = await Api.savedTabs();
    final freshSig = fresh.map((t) => t.key).join(',');
    if (freshSig != cachedSig) {
      setState(() => _screen = NavHost(key: ValueKey(freshSig), tabs: fresh));
    }
  }

  @override
  Widget build(BuildContext context) {
    return _screen ??
        const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
