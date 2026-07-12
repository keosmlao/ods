import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./api";

/**
 * ລົງທະບຽນຮັບການແຈ້ງເຕືອນ — ເອີ້ນຫຼັງ login ສຳເລັດ.
 * ລົ້ມເຫຼວກໍ່ບໍ່ເປັນຫຍັງ (ຊ່າງຍັງໃຊ້ແອັບໄດ້ ພຽງແຕ່ບໍ່ໄດ້ຮັບແຈ້ງເຕືອນ) ⇒ ບໍ່ໂຍນ error ຕໍ່.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPush(): Promise<string | null> {
  try {
    // ຕົວຈຳລອງ (simulator) ຮັບ push ບໍ່ໄດ້ — ຢ່າໄປລົບກວນຜູ້ໃຊ້ດ້ວຍ dialog ສິດ
    if (!Device.isDevice) return null;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("jobs", {
        name: "ງານໃໝ່",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await registerPushToken(token, Platform.OS);
    return token;
  } catch (error) {
    console.warn("registerForPush failed", error);
    return null;
  }
}
