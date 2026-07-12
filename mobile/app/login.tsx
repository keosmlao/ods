import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { login } from "../lib/api";
import { registerForPush } from "../lib/push";

/** ເຂົ້າລະບົບດ້ວຍ **ລະຫັດພະນັກງານ** (ຫຼື ຊື່ຫຼິ້ນ/ຊື່ເຕັມ) — ຄືກັບເວັບ */
export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      // ລົງທະບຽນຮັບແຈ້ງເຕືອນທັນທີ — ຊ່າງບໍ່ຕ້ອງໄປຫາປຸ່ມເອງ
      await registerForPush();
      router.replace("/");
    } catch (caught) {
      setError((caught as { error?: string }).error ?? "ເຂົ້າລະບົບບໍ່ໄດ້");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.brand}>ODIEN SERVICE</Text>
      <Text style={styles.title}>ເຂົ້າສູ່ລະບົບ</Text>
      <Text style={styles.hint}>ໃຊ້ລະຫັດພະນັກງານ ແລະ ລະຫັດຜ່ານຂອງທ່ານ</Text>

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="ລະຫັດພະນັກງານ"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="ລະຫັດຜ່ານ"
        secureTextEntry
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={submit} disabled={busy || !username || !password} style={[styles.button, (busy || !username || !password) && styles.buttonOff]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ເຂົ້າສູ່ລະບົບ</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff", gap: 12 },
  brand: { color: "#0d9488", fontWeight: "800", letterSpacing: 2 },
  title: { fontSize: 28, fontWeight: "800", color: "#0f172a" },
  hint: { color: "#64748b", marginBottom: 8 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  error: { color: "#dc2626", fontWeight: "600" },
  button: { height: 52, borderRadius: 12, backgroundColor: "#0d9488", alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonOff: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
