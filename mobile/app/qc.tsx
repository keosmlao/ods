import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchQcJob, fetchQcQueue, saveQc, type QcItem, type QcJob } from "../lib/api";

/**
 * ກວດຮັບຄຸນນະພາບ ຢູ່ມືຖື — **ຫົວໜ້າຊ່າງ ແລະ CS** (ໃຜກວດໄດ້ ຜູ້ຈັດການກຳນົດຢູ່ ods_qc_role).
 *
 * ຄົນເຮັດງານ **ກວດງານຂອງຕົນເອງບໍ່ໄດ້** — server ປະຕິເສດສະເໝີ ເຖິງຈະກົດຈາກແອັບ.
 * ຕົກຂໍ້ໃດຂໍ້ນຶ່ງ → ງານກັບໄປຫາຊ່າງພ້ອມເຫດຜົນ (ບໍ່ແມ່ນປະຄ້າງໄວ້).
 */
type Answer = { passed: boolean | null; note: string; photo: string };

export default function QcScreen() {
  const [jobs, setJobs] = useState<QcJob[]>([]);
  const [job, setJob] = useState<QcJob | null>(null);
  const [items, setItems] = useState<QcItem[]>([]);
  const [photos, setPhotos] = useState<{ id: number; photo: string }[]>([]);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [signer, setSigner] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchQcQueue()
      .then(setJobs)
      .catch((caught) => setError((caught as { error?: string }).error ?? "ໂຫຼດບໍ່ໄດ້"))
      .finally(() => setLoading(false));
  }, []);

  async function open(target: QcJob) {
    setBusy(true);
    try {
      const detail = await fetchQcJob(target.workflow, target.code);
      setItems(detail.items);
      setPhotos(detail.photos);
      setAnswers(
        Object.fromEntries(
          detail.items.map((item) => [item.id, { passed: item.passed, note: item.note ?? "", photo: item.photo ?? "" }]),
        ),
      );
      setJob(target);
    } catch (caught) {
      Alert.alert("ເປີດບໍ່ໄດ້", (caught as { error?: string }).error ?? "");
    } finally {
      setBusy(false);
    }
  }

  async function shoot(id: number) {
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (shot.canceled) return;
    setAnswers((current) => ({
      ...current,
      [id]: { ...current[id], photo: `data:image/jpeg;base64,${shot.assets[0].base64}` },
    }));
  }

  async function submit() {
    if (!job) return;
    setBusy(true);
    try {
      const result = await saveQc(
        job.workflow,
        job.code,
        items.map((item) => ({
          item_id: item.id,
          passed: answers[item.id]?.passed === true,
          note: answers[item.id]?.note ?? "",
          photo: answers[item.id]?.photo ?? "",
        })),
        signer,
      );
      Alert.alert("ສຳເລັດ", result.message);
      setJob(null);
      setJobs(await fetchQcQueue());
    } catch (caught) {
      Alert.alert("ບໍ່ສຳເລັດ", (caught as { error?: string }).error ?? "");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.warn}>{error}</Text>
      </View>
    );
  }

  /* ── ຄິວ ── */
  if (!job) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        {jobs.length === 0 && <Text style={styles.empty}>ບໍ່ມີງານລໍກວດຮັບ</Text>}
        {jobs.map((row) => (
          <Pressable key={`${row.workflow}-${row.code}`} style={styles.card} onPress={() => open(row)}>
            <Text style={styles.code}>
              {row.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"} · {row.code}
            </Text>
            <Text style={styles.muted}>
              {row.customer ?? "-"} · {row.item ?? "-"}
            </Text>
            <Text style={styles.muted}>
              ຊ່າງ {row.worker ?? "-"} · ສຳເລັດ {row.finished_at ?? "-"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  /* ── ຟອມກວດ ── */
  const answered = items.filter((item) => answers[item.id]?.passed != null).length;
  const failed = items.filter((item) => answers[item.id]?.passed === false).length;
  const missingPhoto = items.filter(
    (item) => item.require_photo && answers[item.id]?.passed === true && !answers[item.id]?.photo,
  );
  const ready = answered === items.length && missingPhoto.length === 0;

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ gap: 10, paddingBottom: 48 }}>
      <Pressable onPress={() => setJob(null)}>
        <Text style={styles.back}>← ກັບຄິວ QC</Text>
      </Pressable>

      {/* ຮູບຜົນງານທີ່ຊ່າງຖ່າຍໄວ້ຕອນຈົບງານ */}
      {photos.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>ຮູບຜົນງານຈາກຊ່າງ ({photos.length})</Text>
          <View style={styles.thumbs}>
            {photos.map((photo) => (
              <Image key={photo.id} source={{ uri: photo.photo }} style={styles.thumb} />
            ))}
          </View>
        </View>
      )}

      {items.map((item) => {
        const answer = answers[item.id];
        return (
          <View
            key={item.id}
            style={[
              styles.card,
              answer?.passed === false && styles.fail,
              answer?.passed === true && styles.pass,
            ]}
          >
            <Text style={styles.label}>
              {item.name}
              {item.require_photo ? " (ຕ້ອງມີຮູບ)" : ""}
            </Text>

            <View style={styles.row}>
              <Pressable
                style={[styles.choice, answer?.passed === true && styles.choiceOn]}
                onPress={() => setAnswers((c) => ({ ...c, [item.id]: { ...c[item.id], passed: true } }))}
              >
                <Text style={answer?.passed === true ? styles.choiceTextOn : styles.choiceText}>ຜ່ານ</Text>
              </Pressable>
              <Pressable
                style={[styles.choice, answer?.passed === false && styles.choiceBad]}
                onPress={() => setAnswers((c) => ({ ...c, [item.id]: { ...c[item.id], passed: false } }))}
              >
                <Text style={answer?.passed === false ? styles.choiceTextOn : styles.choiceText}>ບໍ່ຜ່ານ</Text>
              </Pressable>
              <Pressable style={styles.choice} onPress={() => shoot(item.id)}>
                <Text style={styles.choiceText}>{answer?.photo ? "ປ່ຽນຮູບ" : "📷 ຮູບ"}</Text>
              </Pressable>
            </View>

            {answer?.passed === false && (
              <TextInput
                value={answer.note}
                onChangeText={(text) => setAnswers((c) => ({ ...c, [item.id]: { ...c[item.id], note: text } }))}
                placeholder="ເຫດຜົນທີ່ບໍ່ຜ່ານ — ຊ່າງຈະເຫັນ"
                style={styles.input}
              />
            )}
            {answer?.photo ? <Image source={{ uri: answer.photo }} style={styles.thumb} /> : null}
          </View>
        );
      })}

      {failed === 0 && answered === items.length && (
        <View style={styles.card}>
          <Text style={styles.label}>ຜູ້ຮັບມອບງານ (ລູກຄ້າ)</Text>
          <TextInput value={signer} onChangeText={setSigner} placeholder="ຊື່ຜູ້ຮັບມອບ" style={styles.input} />
        </View>
      )}

      <Pressable
        disabled={!ready || busy}
        onPress={submit}
        style={[styles.save, { backgroundColor: failed > 0 ? "#dc2626" : "#059669" }, (!ready || busy) && { opacity: 0.5 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>
            {failed > 0 ? `ບໍ່ຜ່ານ ${failed} ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງ` : "QC ຜ່ານ — ໄປຂັ້ນຕໍ່ໄປ"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#e2e8f0", gap: 8 },
  pass: { borderColor: "#6ee7b7", backgroundColor: "#f0fdf4" },
  fail: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  code: { fontWeight: "800", color: "#0f172a" },
  label: { fontWeight: "700", color: "#0f172a" },
  muted: { color: "#64748b", fontSize: 12 },
  back: { color: "#0d9488", fontWeight: "700", paddingVertical: 4 },
  row: { flexDirection: "row", gap: 8 },
  choice: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  choiceOn: { backgroundColor: "#059669", borderColor: "#059669" },
  choiceBad: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  choiceText: { color: "#334155", fontWeight: "700" },
  choiceTextOn: { color: "#fff", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, backgroundColor: "#fff" },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  thumb: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  save: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  warn: { color: "#b45309", fontWeight: "700", textAlign: "center" },
});
