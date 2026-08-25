import 'dart:async';
import 'dart:ui';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'api.dart';
import 'app_links.dart';
import 'app_update.dart';
import 'drafts.dart';
import 'lock.dart';
import 'metrics.dart';
import 'sun.dart';
import 'pending.dart';
import 'push.dart';
import 'screens/login_screen.dart';
import 'screens/nav_host.dart';
import 'screens/update_required_screen.dart';

/// ODIEN Service — ແອັບຊ່າງ.
///
/// ຫຼັກການ: ກົດເກນທັງໝົດຢູ່ **server** (lib/job-flow · lib/tech-flow · lib/qc-flow ຂອງເວັບ).
/// ແອັບພຽງແຕ່ສະແດງປຸ່ມທີ່ server ບອກວ່າກົດໄດ້ (`job.action`) ແລ້ວຍິງຄຳສັ່ງກັບໄປ
/// ⇒ ກົດຈາກແອັບ ຫຼື ຈາກເວັບ ໄດ້ຜົນຄືກັນທຸກປະການ ແລະ ຂ້າມຂັ້ນບໍ່ໄດ້.
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ຮູບ/ຂໍ້ຄວາມທີ່ຄ້າງຢູ່ຈາກຮອບກ່ອນ — ໂຫຼດກ່ອນ runApp ໃຫ້ໜ້າຈໍຄືນຮ່າງໄດ້ທັນທີ
  await Drafts.load();

  // ຄິວຄຳສັ່ງທີ່ຍັງສົ່ງບໍ່ໄດ້ + ລາຍການວຽກທີ່ເກັບໄວ້ — ຕ້ອງມີກ່ອນຄຳຂໍທຳອິດ
  await Future.wait([Pending.load(), JobCache.load()]);

  // ການຕັ້ງຄ່າສ່ວນຕົວ (ລັອກແອັບ · ໂໝດແດດ) — ອ່ານກ່ອນ runApp ໃຫ້ຈໍທຳອິດຖືກ
  await Future.wait([AppLock.load(), SunMode.load()]);

  // ເວີຊັນຂອງຕົນເອງ — ຕ້ອງຮູ້ກ່ອນຄຳຂໍທຳອິດ (ໃສ່ header x-app-version ທຸກຄຳຂໍ)
  await AppVersion.load();

  // ແຈ້ງເຕືອນ (FCM) — ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Firebase ກໍ່ບໍ່ເປັນຫຍັງ (Push.init ຈັບ error ໄວ້)
  await Push.init();

  // ເກັບ crash ສົ່ງເຂົ້າ Crashlytics — ຕ້ອງມາຫຼັງ Push.init (ບ່ອນທີ່ Firebase ຖືກ init)
  _watchCrashes();
  Metrics.init();

  runApp(const OdssApp());
  WidgetsBinding.instance.addPostFrameCallback((_) => AppLinks.flush());
}

/// ສົ່ງ crash/error ຂຶ້ນ Crashlytics.
///
/// ເປັນຫຍັງຕ້ອງມີ: ຊ່າງແຈ້ງວ່າ "ແອັບປິດເອງ" ແລ້ວ IT ບໍ່ມີຫຼັກຖານຫຍັງເລີຍ —
/// ບໍ່ຮູ້ວ່າໜ້າໃດ · ເຄື່ອງລຸ້ນໃດ · ເກີດຈັກຄົນ. ບໍ່ມີຂໍ້ມູນ = ແກ້ບໍ່ໄດ້ ນອກຈາກເດົາ.
///
/// ⚠️ Firebase init ບໍ່ໄດ້ (ບໍ່ມີ google-services.json ຢູ່ເຄື່ອງ build) ⇒ ຈັບ error
/// ໄວ້ໝົດ ແລະ ແອັບຍັງແລ່ນປົກກະຕິ — ຫຼັກການດຽວກັບ Push (ເຄື່ອງມືເສີມຫ້າມລົ້ມແອັບ).
void _watchCrashes() {
  try {
    final crashlytics = FirebaseCrashlytics.instance;
    // debug build ບໍ່ຕ້ອງສົ່ງ (ບໍ່ດັ່ງນັ້ນ error ຕອນພັດທະນາປົນກັບຂອງໜ້າງານຈິງ)
    crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);
    crashlytics.setCustomKey('app_version', AppVersion.current);

    final flutterOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      flutterOnError?.call(details);
      crashlytics.recordFlutterFatalError(details);
    };
    // error ທີ່ຫຼຸດອອກນອກ zone ຂອງ Flutter (ເຊັ່ນ Future ທີ່ບໍ່ມີໃຜຈັບ)
    PlatformDispatcher.instance.onError = (error, stack) {
      crashlytics.recordError(error, stack, fatal: true);
      return true;
    };
  } catch (error) {
    debugPrint('ຕັ້ງ Crashlytics ບໍ່ໄດ້ (ບໍ່ມີ Firebase?): $error');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Design tokens v6 "NIGHT" — ໂໝດມືດ
   ══════════════════════════════════════════════════════════════════════════
   ເປັນຫຍັງມືດ: ຊ່າງອາຍຸ 15–25 ໃຊ້ມືຖືມື້ລະຫຼາຍຊົ່ວໂມງກັບແອັບທີ່ເປັນໂໝດມືດ
   ເກືອບທັງໝົດ — ແອັບບໍລິສັດທີ່ຂາວຈ້າຮູ້ສຶກເປັນ "ແບບຟອມ" ບໍ່ແມ່ນເຄື່ອງມືຂອງຕົນ.

   ── ບົດຮຽນທີ່ຝັງໄວ້ໃນ token ນີ້ ──
   ① `teal` **ບໍ່ແມ່ນສີດຽວກັບ v5** ອີກຕໍ່ໄປ: teal-700 (#0F766E) ເທິງພື້ນມືດ
      contrast ພຽງ ~2.4:1 (ອ່ານບໍ່ອອກ) ⇒ ຍົກເປັນ #14B8A6 (6.4:1 ✓)
   ② ສີເຂັ້ມສະຫວ່າງແບບນີ້ໃຊ້ເປັນ**ພື້ນປຸ່ມ**ກັບຕົວໜັງສືຂາວບໍ່ໄດ້ (2.3:1)
      ⇒ ຕົວໜັງສືເທິງປຸ່ມສີເນັ້ນ ໃຊ້ `onAccent` (ເກືອບດຳ) ບໍ່ແມ່ນ `onAccent`
   ③ ພື້ນກາດ = `surface` (ບໍ່ແມ່ນ `onAccent`) ⇒ ຢ່າພິມ onAccent ເປັນພື້ນອີກ

   ⚠️ ຍັງເປັນ **const** ທັງໝົດ ⇒ ສະຫຼັບໂໝດແດດຕອນແລ່ນຍັງບໍ່ໄດ້ (ຕ້ອງຍ້າຍໄປ
   ThemeExtension ກ່ອນ — ວຽກແຍກ). ຊ່າງທີ່ຂຶ້ນຫຼັງຄາຕອນທ່ຽງໃຫ້ຍົກຄວາມສະຫວ່າງຈໍສຸດ.
   ══════════════════════════════════════════════════════════════════════════ */
// ── ໂທເຄັນເກົ່າ v5 (ເກັບຄຳອະທິບາຍໄວ້ເປັນປະຫວັດ) ──
// ຫຼັກການເດີມທີ່ **ຍັງຖືຢູ່**: contrast ສູງ (WCAG AA ຂຶ້ນໄປສຳລັບ text), ບໍ່ມີ gradient/blur
// ໃນ widget ທີ່ render ຖີ່ (GPU ເກົ່າແຮງ), flat surface + border ແທນເງົາ.
//
// ສິ່ງທີ່ v5 ເພີ່ມ:
//   ① ພື້ນອຽງໄປທາງຂຽວເລັກນ້ອຍ (ບໍ່ແມ່ນເທົາກາງ) ⇒ ຢູ່ຮ່ວມກັບ teal ໄດ້ບໍ່ຂັດ
//   ② **ສີສັນຍານມີໜ້າທີ່ຕາຍຕົວ**: ແດງ = ຊ້າ/ຫ້າມ · ເຫຼືອງ = ໃກ້ຮອດ/ຕ້ອງກວດ · ຂຽວ = ຜ່ານ
//      ⇒ ຫ້າມໃຊ້ 3 ສີນີ້ເປັນເຄື່ອງປະດັບ ບໍ່ດັ່ງນັ້ນ "ແດງ" ຈະບໍ່ໝາຍຄວາມວ່າຫຍັງອີກຕໍ່ໄປ
//   ③ ປຸ່ມຫຼັກສູງ 52 (kPrimaryTouch) — ນິ້ວໂປ້ຊ່າງ ໃສ່ຖົງມື ຢືນຢູ່ໜ້າງານ
const teal = Color(0xFF14B8A6); // ສີຫຼັກ (mint) — ອ່ານອອກເທິງພື້ນມືດ 6.4:1
const tealBright = Color(0xFF2EE6C5); // ເນັ້ນ/ໄຮໄລທ໌ · ຕົວເລກໃຫຍ່
const tealDeep = Color(0xFF0D9488); // pressed
const tealTint = Color(0xFF14302A); // ພື້ນປ້າຍອ່ອນ (ມືດ)
const tealWash = Color(0xFF102421); // ພື້ນອ່ອນສຸດ (ກາດ selected)
const ink = Color(0xFFF2FBF8); // ຫົວຂໍ້ (ສະຫວ່າງສຸດ)
const body = Color(0xFFC3D6D1); // ເນື້ອຄວາມ
const danger = Color(0xFFFB7185); // rose 400 — ອ່ານອອກເທິງພື້ນມືດ
const dangerTint = Color(0xFF3A1620); // ພື້ນປ້າຍແດງ

/// ພື້ນຂອງ **ກາດ/ແຖບ** — ແທນ `onAccent` ຂອງ v5 (ຢ່າພິມ onAccent ເປັນພື້ນ)
const surface = Color(0xFF101C1A);

/// ຕົວໜັງສື/ໄອຄອນ **ເທິງພື້ນສີເນັ້ນ** (teal · danger · warn · ok) — ເກືອບດຳ
const onAccent = Color(0xFF04211C);
const ok = Color(0xFF34D399); // emerald 400 — ອ່ານອອກເທິງພື້ນມືດ
const okTint = Color(0xFF10312A); // ພື້ນປ້າຍຂຽວ
const warn = Color(0xFFFFC46B); // amber 300 — ອ່ານອອກເທິງພື້ນມືດ
const warnTint = Color(0xFF3A2A12); // ພື້ນປ້າຍເຫຼືອງ
const muted = Color(0xFF8BA39D); // ຄຳອະທິບາຍ
const faint = Color(0xFF6C817C); // ຈາງສຸດ (ຍັງຜ່ານ 4.5:1 ເທິງພື້ນ)
const ground = Color(0xFF0A1413); // ພື້ນຫຼັງແອັບ
const surfaceAlt = Color(0xFF172523); // ພື້ນຮອງ (input · ປຸ່ມມົນ · ແຖບຄວາມຄືບໜ້າ)
const line = Color(0xFF22332F); // ຂອບ
const lineStrong = Color(0xFF2E4440); // ຂອບເນັ້ນ (input ປົກກະຕິ)

// ── Hero header v4 (flat, ບໍ່ມີ gradient — ປະຢັດ GPU ເຄື່ອງເກົ່າ) ──
const hero1 = Color(0xFF0D1918); // ຫົວຈໍ — ຕ່າງຈາກພື້ນໜ້ອຍໜຶ່ງ (ບໍ່ແມ່ນກ້ອນດຳທັບ)
const hero2 = Color(0xFF172523); // tile ເທິງ hero
const onHero = Color(0xFFF2FBF8);
const onHeroDim = Color(0xFF8BA39D);

/// ລັດສະໝີມາດຕະຖານ (ກາດ = 16, ປຸ່ມ = 14, ຊິບ = pill)
const kCardRadius = 16.0;
const kButtonRadius = 14.0;

/// ຄວາມສູງສຳຜັດຂັ້ນຕ່ຳ — ນິ້ວໂປ້ຊ່າງງານ + ຈໍລຸ້ນເກົ່າ density ຕ່ຳ
const kMinTouch = 48.0;

/// ປຸ່ມ **ຫຼັກ** ຂອງໜ້າ (ແຖບ "ຂັ້ນຕໍ່ໄປ") — ສູງກວ່າຂັ້ນຕ່ຳ ເພາະເປັນປຸ່ມທີ່ຖືກກົດ
/// ຢູ່ໜ້າງານ: ຢືນ · ມືເປື້ອນ · ບາງເທື່ອໃສ່ຖົງມື. ກົດພາດ = ຕ້ອງເລີ່ມຂັ້ນຕອນໃໝ່.
const kPrimaryTouch = 52.0;

/// ຊຸດ theme ຂອງແອັບ — **ແຍກອອກມາເປັນຟັງຊັນ** ເພື່ອໃຫ້ເທສ pump ດ້ວຍ theme ຈິງໄດ້
/// (ບັນຫາລະດັບ theme ເຊັ່ນຄວາມກວ້າງປຸ່ມ ຈຶ່ງຖືກຈັບໄດ້ດ້ວຍເທສ ບໍ່ແມ່ນຈັບໄດ້ຢູ່ໜ້າງານ).
ThemeData odssTheme() => ThemeData(
        colorScheme:
            ColorScheme.fromSeed(
              seedColor: teal,
              brightness: Brightness.dark,
            ).copyWith(
              surface: surface,
              onSurface: ink,
              primary: teal,
              onPrimary: onAccent,
              error: danger,
              onError: onAccent,
            ),
        scaffoldBackgroundColor: ground,
        fontFamily: 'Noto Sans Lao',
        fontFamilyFallback: const ['Noto Sans Lao', 'sans-serif'],
        // AppBar ພື້ນດຽວກັບກາດ — ຫົວຂໍ້ ink (ສະຫວ່າງ), ບໍ່ມີເງົາ
        appBarTheme: const AppBarTheme(
          backgroundColor: surface,
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
            // ຕົວໜັງສືເທິງ mint ຕ້ອງເປັນສີເຂັ້ມ — ຂາວເທິງ mint ອ່ານບໍ່ອອກ (2.3:1)
            foregroundColor: onAccent,
            /*
              ສຳຜັດ 48px ຂຶ້ນໄປທຸກປຸ່ມຫຼັກ (ນິ້ວໂປ້ + ຈໍລຸ້ນເກົ່າ).

              ⚠️ `Size.fromHeight` = ກວ້າງ **infinity** ⇒ ປຸ່ມເຕັມແຖວເມື່ອຢູ່ໃນ Column
              (ຕາມທີ່ຕ້ອງການ) ແຕ່ເມື່ອເອົາໄປວາງເປັນ **ລູກໂດຍກົງຂອງ Row** ມັນຈະກິນ
              ຄວາມກວ້າງໝົດ ⇒ `Expanded` ຂ້າງໆເຫຼືອເກືອບສູນ ແລ້ວຂໍ້ຄວາມແຕກເປັນ
              **1 ຕົວອັກສອນຕໍ່ແຖວ** (ພົບຈິງ 25-08-2026 — ແຖວໃບເບີກໃນໜ້າໃບງານ).
              ⇒ ປຸ່ມທີ່ຢູ່ໃນ Row ໃຫ້ໃສ່ `minimumSize: const Size(0, kMinTouch)` ທຸກເທື່ອ.
            */
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
            backgroundColor: surface,
            side: const BorderSide(color: lineStrong),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(kButtonRadius),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        cardTheme: CardThemeData(
          color: surface,
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
          // ແຈ້ງເຕືອນລອຍ — ພື້ນສະຫວ່າງກວ່າກາດ ⇒ ເຫັນຊັດເທິງໜ້າມືດ
          backgroundColor: surfaceAlt,
          contentTextStyle: const TextStyle(
            color: ink,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        useMaterial3: true,
      );

class OdssApp extends StatelessWidget {
  const OdssApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ODIEN Service',
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: odssTheme(),

      /*
        ── ຂະໜາດຕົວໜັງສືຕາມລະບົບ (26-08-2026) ──
        ເມື່ອກ່ອນລັອກໄວ້ທີ່ 1.0 ⇒ ຊ່າງທີ່ຕັ້ງຕົວໜັງສືໃຫຍ່ໃນເຄື່ອງ (ສາຍຕາບໍ່ດີ ·
        ອາຍຸຫຼາຍ) **ຂະຫຍາຍບໍ່ໄດ້ເລີຍ** — ແອັບບໍລິສັດເປັນແອັບດຽວທີ່ບໍ່ຟັງ.
        ດຽວນີ້ຍອມເຖິງ 1.3 (ຫຍໍ້ຕ່ຳສຸດ 0.9 ຢູ່) — ເກີນນັ້ນປຸ່ມ/ຕາຕະລາງເລີ່ມແຕກ.
      */
      builder: (context, child) => MediaQuery.withClampedTextScaling(
        minScaleFactor: 0.9,
        maxScaleFactor: 1.3,
        /*
          ── ດ່ານບັງຄັບອັບເດດ ──
          ວາງທັບ **ເໜືອ Navigator** ⇒ ບລັອກທຸກໜ້າພ້ອມກັນ ບໍ່ວ່າຊ່າງກຳລັງຢູ່ໜ້າໃດ
          ແລະ ບໍ່ຕ້ອງໃຫ້ແຕ່ລະໜ້າໄປກວດເອງ (ອັນທີ່ລືມ = ຊ່ອງທີ່ຫຼຸດ).
          server ເປັນຄົນຕັດສິນ (426) — ແອັບບໍ່ໄດ້ຄິດເອງ ຄືກັບກົດເກນອື່ນທັງໝົດ.
        */
        child: ValueListenableBuilder<AppUpdateInfo?>(
          valueListenable: appUpdate,
          builder: (context, info, navigator) =>
              info != null && info.forceUpdate
              ? UpdateRequiredScreen(info: info)
              : _LockGate(child: navigator!),
          child: child,
        ),
      ),
      home: const _Gate(),
      routes: {'/login': (_) => const LoginScreen()},
    );
  }
}

/// **ດ່ານລັອກແອັບ** — ຫຸ້ມທັງແອັບ (ຄືກັບດ່ານບັງຄັບອັບເດດ) ⇒ ບໍ່ວ່າຈະຢູ່ໜ້າໃດ
/// ພໍກັບມາຈາກພື້ນຫຼັງດົນເກີນ [AppLock.idle] ຈະຖືກຖາມກ່ອນເຫັນຂໍ້ມູນ.
///
/// ບໍ່ໄດ້ລ້າງ token — ປົດບໍ່ໄດ້ພຽງແຕ່ຄາຢູ່ຈໍນີ້ (ຊ່າງບໍ່ຖືກໄລ່ອອກຈາກລະບົບ).
class _LockGate extends StatefulWidget {
  const _LockGate({required this.child});
  final Widget child;

  @override
  State<_LockGate> createState() => _LockGateState();
}

class _LockGateState extends State<_LockGate> with WidgetsBindingObserver {
  bool _locked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      AppLock.markLeft();
    }
    if (state == AppLifecycleState.resumed && AppLock.shouldAsk()) {
      setState(() => _locked = true);
      _ask();
    }
  }

  Future<void> _ask() async {
    final ok = await AppLock.unlock();
    if (ok && mounted) setState(() => _locked = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_locked) return widget.child;
    return Scaffold(
      backgroundColor: ground,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 78,
              height: 78,
              decoration: BoxDecoration(color: tealTint, shape: BoxShape.circle),
              child: const Icon(Icons.lock_outline_rounded, size: 38, color: teal),
            ),
            const SizedBox(height: 18),
            const Text(
              'ແອັບຖືກລັອກ',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: ink),
            ),
            const SizedBox(height: 6),
            const Text('ຢືນຢັນຕົວຕົນເພື່ອເປີດຕໍ່', style: TextStyle(color: muted)),
            const SizedBox(height: 22),
            FilledButton.icon(
              onPressed: _ask,
              icon: const Icon(Icons.fingerprint_rounded),
              label: const Text('ປົດລັອກ'),
              style: FilledButton.styleFrom(minimumSize: const Size(200, kPrimaryTouch)),
            ),
          ],
        ),
      ),
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
      debugPrint('boot ລົ້ມ: $error');
      setState(() {
        _bootError = 'boot';
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
              // ບໍ່ຕ້ອງເອົາ stack trace ໃສ່ໜ້າຊ່າງ — ບອກສິ່ງທີ່ຕ້ອງເຮັດພໍ
              // (ລາຍລະອຽດຢູ່ debugPrint ໃຫ້ນັກພັດທະນາເບິ່ງ)
              content: const Text('ຂໍ້ມູນເຂົ້າສູ່ລະບົບເກົ່າໃຊ້ບໍ່ໄດ້ — ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່'),
              duration: const Duration(seconds: 5),
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
