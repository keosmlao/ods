import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchLookups, requestSpares } from "../../lib/api";

/**
 * ອອກໃບຂໍເບີກອາໄຫຼ່ — **ຊ່າງເປັນຄົນອອກເອງ** (ບໍ່ຜ່ານ CS — ນະໂຍບາຍຂອງຜູ້ຈັດການ).
 *
 * ອາໄຫຼ່ທີ່ຂໍ = ອາໄຫຼ່ທີ່ຊ່າງເລືອກໄວ້ຕອນກວດເຊັກ ແລະ **ຍັງບໍ່ທັນຂໍ/ເບີກ** ເທົ່ານັ້ນ
 * (server ກອງໃຫ້ — OUTSTANDING_SPARES) ⇒ ໃບທີສອງບໍ່ຂໍຂອງເກົ່າຄືນອີກ.
 * ສາງ ແລະ ທີ່ເກັບ ດຶງມາຈາກລາຍການທີ່ອະນຸຍາດຢູ່ server (ບໍ່ຝັງໄວ້ໃນແອັບ).
 */
export default function SpareRequest() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<{ code: string; name: string }[]>([]);
  const [shelves, setShelves] = useState<{ code: string; name: string; wh_code: string }[]>([]);
  const [wh, setWh] = useState("");
  const [shelf, setShelf] = useState("");
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchLookups()
      .then((data) => {
        setWarehouses(data.warehouses);
        setShelves(data.shelves);
      })
      .catch((caught) => Alert.alert("ໂຫຼດບໍ່ໄດ້", (caught as { error?: string }).error ?? ""));
  }, []);

  const shelvesOfWh = shelves.filter((row) => row.wh_code === wh);

  async function submit() {
    setBusy(true);
    try {
      const result = await requestSpares(code, wh, shelf, remark);
      Alert.alert("ສຳເລັດ", result.message);
      router.replace("/");
    } catch (caught) {
      Alert.alert("ບໍ່ສຳເລັດ", (caught as { error?: string }).error ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
      <View style={styles.card}>
        <Text style={styles.title}>ໃບຂໍເບີກອາໄຫຼ່ · {code}</Text>

        <Text style={styles.label}>ສາງ</Text>
        <View style={styles.chips}>
          {warehouses.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => {
                setWh(item.code);
                setShelf("");
              }}
              style={[styles.chip, wh === item.code && styles.chipOn]}
            >
              <Text style={wh === item.code ? styles.chipTextOn : styles.chipText}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        {wh ? (
          <>
            <Text style={styles.label}>ທີ່ເກັບ</Text>
            <View style={styles.chips}>
              {shelvesOfWh.map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => setShelf(item.code)}
                  style={[styles.chip, shelf === item.code && styles.chipOn]}
                >
                  <Text style={shelf === item.code ? styles.chipTextOn : styles.chipText}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.label}>ໝາຍເຫດ (ບໍ່ບັງຄັບ)</Text>
        <TextInput value={remark} onChangeText={setRemark} style={styles.input} />
      </View>

      <Pressable
        disabled={!wh || !shelf || busy}
        onPress={submit}
        style={[styles.save, (!wh || !shelf || busy) && { opacity: 0.5 }]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>ອອກໃບຂໍເບີກ</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 8 },
  title: { fontWeight: "800", fontSize: 16, color: "#0f172a" },
  label: { fontWeight: "700", color: "#334155", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: "#0d9488", borderColor: "#0d9488" },
  chipText: { color: "#334155", fontWeight: "600", fontSize: 12 },
  chipTextOn: { color: "#fff", fontWeight: "700", fontSize: 12 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, backgroundColor: "#fff" },
  save: { height: 52, borderRadius: 12, backgroundColor: "#0d9488", alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
