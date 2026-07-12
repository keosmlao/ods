# ODIEN Service — ແອັບຊ່າງ (Expo)

ແອັບມືຖືສຳລັບຊ່າງ: ຮັບ/ປະຕິເສດງານ · ດຳເນີນຕາມຂັ້ນຕອນ · check-in/out ໜ້າງານ (ພິກັດ+ຮູບ) ·
ເບິ່ງລາຍຮັບ · ຮັບການແຈ້ງເຕືອນເມື່ອມີງານໃໝ່.

## ຫຼັກການອອກແບບ

**ແອັບບໍ່ຄິດຂັ້ນຕອນເອງ.** server ສົ່ງ `action` ມາໃຫ້ໃນແຕ່ລະງານ (`accept` / `start` /
`finish` / `wait_spare` / `wait_other`) ແລ້ວແອັບພຽງແຕ່ສະແດງປຸ່ມນັ້ນ. ຂັ້ນໄດຢູ່ຝັ່ງ server
ບ່ອນດຽວ (`src/lib/stage.ts`, `src/lib/install-stage.ts`, `src/lib/job-flow.ts`) —
ຖ້າແອັບຄິດເອງ ມື້ທີ່ຂັ້ນໄດປ່ຽນ ແອັບເກົ່າໃນມືຖືຊ່າງຈະພາງານໄປຜິດຂັ້ນ.

ທຸກຄຳສັ່ງຍິງໄປຫາ `/api/mobile/*` ຂອງເວັບ ແລະ **ຜ່ານ `lib/job-flow` ອັນດຽວກັບປຸ່ມຢູ່ເວັບ**
⇒ ກົດຈາກແອັບ ຫຼື ຈາກເວັບ ໄດ້ຜົນຄືກັນທຸກປະການ.

## ຕັ້ງຄ່າ

1. ຊີ້ໄປຫາ server: ແກ້ `expo.extra.apiUrl` ໃນ `app.json`
   (ຕອນພັດທະນາໃນເຄື່ອງ: `http://<IP ຂອງເຄື່ອງ>:3000` — `localhost` ໃນມືຖືຈະຊີ້ຫາຕົວມືຖືເອງ)
2. ຕິດຕັ້ງ ແລະ ແລ່ນ:

```bash
cd mobile
npm install
npx expo start
```

3. ສ້າງ APK ໃຫ້ຊ່າງຕິດຕັ້ງ (ບໍ່ຕ້ອງຜ່ານ Play Store):

```bash
npx eas build --platform android --profile preview
```

## ການແຈ້ງເຕືອນ (push)

ໃຊ້ **Expo Push** — ບໍ່ຕ້ອງມີກະແຈ FCM/APNs ຢູ່ຝັ່ງ server.
ແອັບລົງທະບຽນ token ຫຼັງ login (`/api/mobile/push-token`) ແລ້ວ server ຍິງແຈ້ງເຕືອນ
ຕອນ **ຈັດຊ່າງ** (ຕິດຕັ້ງ) ແລະ ຕອນ **ເປີດ/ແກ້ໃບຮັບເຄື່ອງ** (ສ້ອມ).
Push ລົ້ມເຫຼວ **ບໍ່ເຮັດໃຫ້ການມອບໝາຍງານລົ້ມເຫຼວ** (ເບິ່ງ `src/lib/push.ts`).

ຕ້ອງທົດສອບຢູ່ **ເຄື່ອງຈິງ** — ຕົວຈຳລອງຮັບ push ບໍ່ໄດ້.

## ໂຄງສ້າງ

```
app/
  _layout.tsx              ດ່ານ login (token ອາຍຸ 30 ມື້, ເກັບໃນ SecureStore)
  login.tsx                ເຂົ້າລະບົບດ້ວຍລະຫັດພະນັກງານ
  index.tsx                ຄິວວຽກ (ຕິດຕັ້ງ + ສ້ອມ ຢູ່ບ່ອນດຽວ)
  job/[workflow]/[code].tsx ລາຍລະອຽດງານ + ປຸ່ມຂັ້ນຕອນ + check-in/out
  income.tsx               ລາຍຮັບເດືອນນີ້
lib/
  api.ts                   ຕົວເຊື່ອມກັບ /api/mobile/*
  push.ts                  ລົງທະບຽນ Expo push
```
