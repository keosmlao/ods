import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { getToken } from "../lib/api";

/**
 * ໂຄງແອັບ — ຖ້າຍັງບໍ່ມີ token ພາໄປໜ້າ login ທັນທີ.
 * token ອາຍຸ 30 ມື້ (ເບິ່ງ lib/mobile-auth.ts ຝັ່ງ server) ⇒ ຊ່າງບໍ່ຖືກໄລ່ອອກກາງເຄິ່ງງານ.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    getToken().then((token) => {
      setSignedIn(Boolean(token));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    if (!signedIn && !onLogin) router.replace("/login");
    if (signedIn && onLogin) router.replace("/");
  }, [ready, signedIn, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: "ວຽກຂອງຂ້ອຍ" }} />
      <Stack.Screen name="job/[workflow]/[code]" options={{ title: "ລາຍລະອຽດງານ" }} />
      <Stack.Screen name="income" options={{ title: "ລາຍຮັບຂອງຂ້ອຍ" }} />
    </Stack>
  );
}
