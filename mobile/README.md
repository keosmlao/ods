# ODIEN Service — ແອັບຊ່າງ (Flutter)

ຮັບ/ປະຕິເສດງານ · ກວດເຊັກ · ຂໍເບີກ/ຮັບອາໄຫຼ່ · ດຳເນີນຂັ້ນຕອນ · check-in/out ໜ້າງານ ·
ຮູບຜົນງານ · QC · ລາຍຮັບ · ແຈ້ງເຕືອນເມື່ອມີງານໃໝ່.

## ຫຼັກການອອກແບບ (ຢ່າແກ້ໂດຍບໍ່ຄິດ)

**ແອັບບໍ່ຄິດຂັ້ນຕອນເອງ.** server ສົ່ງ `action` ມາໃຫ້ໃນແຕ່ລະງານ (`accept` / `start` /
`finish` / `wait_spare` / `wait_other`) ແລ້ວແອັບພຽງແຕ່ສະແດງປຸ່ມນັ້ນ. ຂັ້ນໄດ ແລະ ກົດເກນ
ຢູ່ຝັ່ງ server ບ່ອນດຽວ (`src/lib/job-flow.ts` · `src/lib/tech-flow.ts` · `src/lib/qc-flow.ts`)
— **ອັນດຽວກັບທີ່ປຸ່ມຢູ່ເວັບເອີ້ນ** ⇒ ກົດຈາກແອັບ ຫຼື ຈາກເວັບ ໄດ້ຜົນຄືກັນທຸກປະການ
ແລະ ຂ້າມຂັ້ນບໍ່ໄດ້.

## ແລ່ນຕອນພັດທະນາ

1. ເປີດ server ODSS ໃຫ້ຮັບຈາກ Wi-Fi (ບໍ່ແມ່ນແຕ່ localhost):

```bash
cd ..            # ຫ້ອງ odss-next
npm run dev -- -H 0.0.0.0
```

2. ແລ່ນແອັບ ພ້ອມຊີ້ URL ຂອງ server (**ຢ່າໃຊ້ `localhost`** — ໃນມືຖື localhost = ຕົວມືຖືເອງ):

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_URL=http://192.168.1.51:3000     # IP: ipconfig getifaddr en0
```

3. Login ດ້ວຍ **ລະຫັດພະນັກງານ** + ລະຫັດຜ່ານ (ອັນດຽວກັບເວັບ).

## ສ້າງ APK ໃຫ້ຊ່າງ

```bash
flutter build apk --release --dart-define=API_URL=https://service.odien.net
# ໄດ້ໄຟລ໌: build/app/outputs/flutter-apk/app-release.apk
```

`API_URL` ຕ້ອງເປັນ URL ຈິງຂອງ server ຕອນ build — ບໍ່ດັ່ງນັ້ນແອັບໃນມືຊ່າງຈະໄປຫາ IP ໃນຫ້ອງການ.

## ແຈ້ງເຕືອນ (FCM)

ແອັບໃຊ້ **Firebase Cloud Messaging** (ຮຸ່ນ Expo ເກົ່າໃຊ້ Expo Push — Flutter ໃຊ້ອັນນັ້ນບໍ່ໄດ້).

ຝັ່ງແອັບ:

```bash
dart pub global activate flutterfire_cli
flutterfire configure          # ສ້າງ firebase_options.dart + google-services.json
```

ຝັ່ງ server (`.env` ຂອງ odss-next) — Firebase Console → Project settings →
Service accounts → Generate new private key:

```
FCM_PROJECT_ID=...
FCM_CLIENT_EMAIL=...@....iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

ຍັງບໍ່ຕັ້ງຄ່າກໍ່ **ໃຊ້ໄດ້ປົກກະຕິ** — ພຽງແຕ່ບໍ່ມີແຈ້ງເຕືອນ (ທັງ `lib/push.dart` ຂອງແອັບ
ແລະ `src/lib/push.ts` ຂອງ server ຈັບ error ໄວ້: push ລົ້ມ **ຫ້າມ** ເຮັດໃຫ້ການມອບໝາຍງານລົ້ມ).

ທົດສອບ push ຕ້ອງໃຊ້ **ເຄື່ອງຈິງ** (emulator ບໍ່ໄດ້).

## ໂຄງສ້າງ

```
lib/
  main.dart                     ດ່ານ login (token 30 ມື້, ເກັບໃນ Keychain/Keystore)
  api.dart                      ຕົວເຊື່ອມກັບ /api/mobile/* ບ່ອນດຽວ
  push.dart                     FCM (ບໍ່ຕັ້ງຄ່າກໍ່ບໍ່ພັງ)
  screens/
    login_screen.dart           ລະຫັດພະນັກງານ + ລະຫັດຜ່ານ
    jobs_screen.dart            ຄິວວຽກ (ຕິດຕັ້ງ + ສ້ອມ ຢູ່ບ່ອນດຽວ)
    job_screen.dart             ຂັ້ນຕອນ · ຮູບຜົນງານ · check-in/out · ໂທຫາລູກຄ້າ
    check_screen.dart           ກວດເຊັກ + ອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້
    spare_request_screen.dart   ອອກໃບຂໍເບີກອາໄຫຼ່ (ຊ່າງເຮັດເອງ ບໍ່ຜ່ານ CS)
    pickup_screen.dart          ກົດຮັບອາໄຫຼ່ທີ່ສາງເບີກອອກແລ້ວ
    qc_screen.dart              QC (ຫົວໜ້າຊ່າງ / CS) — checklist + ຮູບ
    income_screen.dart          ລາຍຮັບເດືອນນີ້
```
