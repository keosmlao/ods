import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchDraft, searchSpares, sendCheck, type DraftLine, type SpareItem } from "../../lib/api";

/**
 * ກວດເຊັກ (ຝັ່ງສ້ອມ) ຈາກມືຖື — ຄືໜ້າ /checking/[code] ຂອງເວັບ.
 *
 * ຂັ້ນຕອນ: ເລີ່ມກວດ → ໃສ່ອາການທີ່ວິເຄາະ → (ຖ້າໃຊ້ອາໄຫຼ່) ເລືອກອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້
 * → ບັນທຶກຜົນ. ຖ້າຊ່າງຕັດສິນວ່າ **ໝົດຮັບປະກັນ** ຕ້ອງໃສ່ເຫດຜົນ (ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ).
 * ກົດເກນທັງໝົດຢູ່ຝັ່ງ server (lib/tech-flow) — ອັນດຽວກັບເວັບ.
 */
export default function CheckScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [useSpare, setUseSpare] = useState(false);
  const [warrantyVoid, setWarrantyVoid] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SpareItem[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      setDraft(await fetchDraft(code));
    } catch (caught) {
      Alert.alert("ໂຫຼດບໍ່ໄດ້", (caught as { error?: string }).error ?? "");
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<{ message: string }>, back = false) {
    setBusy(true);
    try {
      const result = await fn();
      await load();
      if (back) {
        Alert.alert("ສຳເລັດ", result.message);
        router.replace("/");
      }
    } catch (caught) {
      Alert.alert("ບໍ່ສຳເລັດ", (caught as { error?: string }).error ?? "ດຳເນີນການບໍ່ໄດ້");
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    setSearching(true);
    try {
      setResults(await searchSpares(term, true));
    } finally {
      setSearching(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ gap: 12, paddingBottom: 48 }}>
      <View style={styles.card}>
        <Text style={styles.title}>ກວດເຊັກ · {code}</Text>
        <Text style={styles.label}>ອາການທີ່ຊ່າງວິເຄາະ</Text>
        <TextInput value={diagnosis} onChangeText={setDiagnosis} style={styles.input} multiline placeholder="ອາການທີ່ພົບ..." />

        <View style={styles.switchRow}>
          <Text style={styles.label}>ຕ້ອງໃຊ້ອາໄຫຼ່</Text>
          <Switch value={useSpare} onValueChange={setUseSpare} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>ໝົດຮັບປະກັນ (ຊ່າງຕັດສິນ)</Text>
          <Switch value={warrantyVoid} onValueChange={setWarrantyVoid} />
        </View>
        {warrantyVoid && (
          <>
            <Text style={styles.hint}>ຕ້ອງໃສ່ເຫດຜົນ — ເປັນຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ</Text>
            <TextInput value={reason} onChangeText={setReason} style={styles.input} multiline placeholder="ເຫດຜົນ..." />
          </>
        )}
      </View>

      {/* ອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້ — ຍ້າຍເປັນລາຍການຈິງຕອນບັນທຶກຜົນ */}
      {useSpare && (
        <View style={styles.card}>
          <Text style={styles.title}>ອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້ ({draft.length})</Text>

          {draft.map((line) => (
            <View key={line.roworder} style={styles.line}>
              <Text style={styles.lineName}>
                {line.item_name} × {line.qty}
              </Text>
              <Pressable onPress={() => run(() => sendCheck(code, { action: "remove_spare", roworder: line.roworder }))}>
                <Text style={styles.remove}>ຖອດ</Text>
              </Pressable>
            </View>
          ))}

          <View style={styles.searchRow}>
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder="ຄົ້ນຫາອາໄຫຼ່..."
              style={[styles.input, { flex: 1, minHeight: 44 }]}
              onSubmitEditing={search}
            />
            <Pressable style={styles.searchButton} onPress={search}>
              {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchText}>ຄົ້ນ</Text>}
            </Pressable>
          </View>

          <FlatList
            data={results}
            scrollEnabled={false}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                style={styles.result}
                onPress={() =>
                  run(() =>
                    sendCheck(code, {
                      action: "add_spare",
                      item: { code: item.code, name_1: item.name_1, unit_code: item.unit_code },
                      qty: 1,
                    }),
                  )
                }
              >
                <Text style={styles.resultName}>{item.name_1}</Text>
                <Text style={styles.muted}>
                  {item.code} · ຄົງເຫຼືອ {item.balance_qty}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      <Pressable
        disabled={busy || !diagnosis.trim()}
        style={[styles.save, (busy || !diagnosis.trim()) && { opacity: 0.5 }]}
        onPress={() =>
          run(
            () =>
              sendCheck(code, {
                action: "save",
                diagnosis,
                warranty_void: warrantyVoid,
                warranty_reason: reason,
                use_spare: useSpare,
              }),
            true,
          )
        }
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>ບັນທຶກຜົນກວດເຊັກ</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 8 },
  title: { fontWeight: "800", fontSize: 16, color: "#0f172a" },
  label: { color: "#334155", fontWeight: "700" },
  hint: { color: "#b45309", fontSize: 12 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, minHeight: 56, backgroundColor: "#fff" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  lineName: { flex: 1, color: "#0f172a" },
  remove: { color: "#dc2626", fontWeight: "700" },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchButton: { backgroundColor: "#0d9488", height: 44, paddingHorizontal: 16, borderRadius: 10, justifyContent: "center" },
  searchText: { color: "#fff", fontWeight: "700" },
  result: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  resultName: { color: "#0f172a", fontWeight: "600" },
  muted: { color: "#64748b", fontSize: 12 },
  save: { height: 52, borderRadius: 12, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
