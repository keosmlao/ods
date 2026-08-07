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

// ── Design tokens v4 (Flat High-Contrast — ອ່ານງ່າຍເທິງຈໍລຸ້ນເກົ່າ) ──
// ຫຼັກການ: ສີ contrast ສູງ (WCAG AA ຂຶ້ນໄປສຳລັບ text), ບໍ່ມີ gradient/blur ໃນ widget ທີ່
// render ຖີ່ (GPU ເກົ່າແຮງ), flat surface + border ແທນເງົາ.
const teal = Color(0xFF0F766E); // brand teal-700 — ສີຫຼັກ (contrast 4.6:1 ເທິງຂາວ)
const tealBright = Color(0xFF0D9488); // active highlight
const tealDeep = Color(0xFF115E59); // pressed/hover state (teal-800)
const tealTint = Color(0xFFCCFBF1); // soft badge tint
const tealWash = Color(0xFFF0FDFA); // ພື້ນອ່ອນສຸດ (tint ກາດ selected)
const ink = Color(0xFF0F172A); // slate 900 — ຫົວຂໍ້
const body = Color(0xFF1E293B); // slate 800 — ເນື້ອຄວາມອ່ານງ່າຍກວ່າ muted
const danger = Color(0xFFE11D48); // rose 600
const dangerTint = Color(0xFFFFE4E6); // rose 100
const ok = Color(0xFF047857); // emerald 700 (ເຂັ້ມຂຶ້ນ — ອ່ານງ່າຍກວ່າ 600)
const okTint = Color(0xFFD1FAE5); // emerald 100
const warn = Color(0xFFB45309); // amber 700 (ເຂັ້ມຂຶ້ນ)
const warnTint = Color(0xFFFEF3C7); // amber 100
const muted = Color(0xFF475569); // slate 600 — ຍົກຈາກ 500 ໃຫ້ອ່ານງ່າຍຂຶ້ນ
const faint = Color(0xFF64748B); // slate 500 — ຍົກຈາກ 400 (4.5:1 ພໍດີ)
const ground = Color(0xFFF8FAFC); // slate 50 — ພື້ນຫຼັງ
const surfaceAlt = Color(0xFFF1F5F9); // slate 100
const line = Color(0xFFE2E8F0); // slate 200 — ຂອບ
const lineStrong = Color(0xFFCBD5E1); // slate 300 — ຂອບເນັ້ນ (input ປົກກະຕິ)

// ── Hero header v4 (flat, ບໍ່ມີ gradient — ປະຢັດ GPU ເຄື່ອງເກົ່າ) ──
const hero1 = Color(0xFF0F172A); // slate 900 (ພື້ນ)
const hero2 = Color(0xFF1E293B); // slate 800 (tile ເທິງ hero)
const onHero = Color(0xFFF8FAFC);
const onHeroDim = Color(0xFFB6C2D4); // ຍົກຈາກ slate 400 ໃຫ້ອ່ານງ່າຍເທິງພື້ນມືດ

/// ລັດສະໝີມາດຕະຖານ (ກາດ = 16, ປຸ່ມ = 14, ຊິບ = pill)
const kCardRadius = 16.0;
const kButtonRadius = 14.0;

/// ຄວາມສູງສຳຜັດຂັ້ນຕ່ຳ — ນິ້ວໂປ້ຊ່າງງານ + ຈໍລຸ້ນເກົ່າ density ຕ່ຳ
const kMinTouch = 48.0;

class OdssApp extends StatelessWidget {
  const OdssApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ODIEN Service',
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
            borderRadius: BorderRadius.circular(kButtonRadius),
            borderSide: const BorderSide(color: lineStrong),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(kButtonRadius),
            borderSide: const BorderSide(color: lineStrong),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(kButtonRadius),
            borderSide: const BorderSide(color: teal, width: 2),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: teal,
            foregroundColor: Colors.white,
            // ສຳຜັດ 48px ຂຶ້ນໄປທຸກປຸ່ມຫຼັກ (ນິ້ວໂປ້ + ຈໍລຸ້ນເກົ່າ)
            minimumSize: const Size.fromHeight(kMinTouch),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(kButtonRadius),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: teal,
            minimumSize: const Size.fromHeight(kMinTouch),
            backgroundColor: Colors.white,
            side: const BorderSide(color: lineStrong),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(kButtonRadius),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(kCardRadius),
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
      // ອະນຸຍາດໃຫ້ system font-scale ເຕັມ 1.0 (v3 ຫຍໍ້ 0.9 — ຈໍນ້ອຍລຸ້ນເກົ່າອ່ານຍາກ)
      builder: (context, child) => MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.0,
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

  /// ຂໍ້ຄວາມຜິດພາດຕອນເປີດແອັບ (null = ປົກກະຕິ) — ບໍ່ດັ່ງນັ້ນຈໍໝູນຄ້າງໂດຍບໍ່ບອກຫຍັງ
  String? _bootError;

  Future<void> _decide() async {
    /*
      ── ຫຸ້ມທັງໝົດ + ໃສ່ timeout (07-08-2026) ──
      ພົບຈິງ: ບາງເຄື່ອງ (Samsung One UI) ເປີດແອັບແລ້ວ **ໝູນຄ້າງຕະຫຼອດ** ເພາະ
      `flutter_secure_storage` ອ່ານ token ບໍ່ໄດ້ (keystore ເສຍ ຫຼື ຖືກ Auto Blocker ກັ້ນ)
      ⇒ ໂຍນ exception ອອກຈາກ _decide() ⇒ **ບໍ່ມີ setState ຈັກເທື່ອ** ⇒ ຈໍໝູນຢູ່ຢ່າງນັ້ນ
      ໂດຍບໍ່ມີຂໍ້ຄວາມ ແລະ ບໍ່ມີທາງອອກ. ດຽວນີ້: ລົ້ມ/ຊ້າ ⇒ ພາໄປໜ້າ login ພ້ອມບອກເຫດຜົນ.
    */
    try {
      await _boot();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _bootError = '$error';
        _screen = const LoginScreen();
      });
    }
  }

  Future<void> _boot() async {
    // ອ່ານ token — ຄ້າງເກີນ 8 ວິ ຖືວ່າ storage ມີບັນຫາ ⇒ ໃຫ້ login ໃໝ່ດີກວ່າຄ້າງ
    final token = await Api.token().timeout(const Duration(seconds: 8));
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
    // ອ່ານ cache ຈາກ secure storage — ຄ້າງກໍ່ຢ່າໃຫ້ແອັບຄາ (ຮ້າຍສຸດ = ໄປ login)
    final cached = await Api.savedTabs().timeout(const Duration(seconds: 8));
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
    if (_screen != null) {
      // ບອກເຫດຜົນຄັ້ງດຽວຫຼັງໜ້າ login ຂຶ້ນ (ບໍ່ດັ່ງນັ້ນຊ່າງບໍ່ຮູ້ວ່າເປັນຫຍັງຖືກໄລ່ອອກ)
      final message = _bootError;
      if (message != null) {
        _bootError = null;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final messenger = ScaffoldMessenger.maybeOf(context);
          messenger?.showSnackBar(
            SnackBar(
              content: Text('ເປີດແອັບບໍ່ສຳເລັດ — ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່ ($message)'),
              duration: const Duration(seconds: 6),
            ),
          );
        });
      }
      return _screen!;
    }
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 14),
            Text('ກຳລັງເປີດແອັບ…', style: TextStyle(color: muted, fontSize: 12.5)),
          ],
        ),
      ),
    );
  }
}
