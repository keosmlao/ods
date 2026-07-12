import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchPickups, pickupSpares, type PickupDoc } from "../lib/api";

/**
 * ຮັບອາໄຫຼ່ — ໃບທີ່ **ສາງເບີກອອກໃຫ້ແລ້ວ** ແຕ່ຊ່າງຍັງບໍ່ໄປຮັບ.
 *
 * ຂະບວນການອາໄຫຼ່ = ຊ່າງ ↔ ສາງ ເທົ່ານັ້ນ (ບໍ່ຜ່ານ CS — ນະໂຍບາຍຂອງຜູ້ຈັດການ):
 *   ຊ່າງອອກໃບຂໍເບີກ → ສາງເບີກອອກ (ຕັດສະຕັອກ ERP) → **ຊ່າງກົດຮັບ** (ໜ້ານີ້)
 * ກົດຮັບແລ້ວ ອາໄຫຼ່ຈຶ່ງນັບວ່າຮອດມືຊ່າງ ແລະ ວຽກໄປຂັ້ນ "ລໍຖ້າສ້ອມແປງ" ໄດ້.
 */
export default function Spares() {
  const [docs, setDocs] = useState<PickupDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      setDocs(await fetchPickups());
    } catch (caught) {
      Alert.alert("ໂຫຼດບໍ່ໄດ້", (caught as { error?: string }).error ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function pickup(doc: PickupDoc) {
    setBusy(doc.doc_no);
    try {
      const result = await pickupSpares(doc.doc_no);
      Alert.alert("ສຳເລັດ", result.message);
      await load();
    } catch (caught) {
      Alert.alert("ບໍ່ສຳເລັດ", (caught as { error?: string }).error ?? "");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={docs}
        keyExtractor={(doc) => doc.doc_no}
        ListEmptyComponent={<Text style={styles.empty}>ບໍ່ມີອາໄຫຼ່ລໍຮັບ</Text>}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.doc}>{item.doc_no}</Text>
              <Text style={styles.muted}>
                ໃບຮັບເຄື່ອງ {item.job_code} · {item.lines} ລາຍການ · {item.doc_date}
              </Text>
            </View>
            <Pressable style={styles.button} disabled={busy === item.doc_no} onPress={() => pickup(item)}>
              {busy === item.doc_no ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ກົດຮັບ</Text>}
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  doc: { fontWeight: "800", color: "#0f172a" },
  muted: { color: "#64748b", fontSize: 12 },
  button: { backgroundColor: "#0d9488", paddingHorizontal: 16, height: 40, borderRadius: 10, justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
