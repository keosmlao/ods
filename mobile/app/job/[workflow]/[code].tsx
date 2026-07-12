import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchJobs, sendCheck, sendCommand, type Job, type JobCommand } from "../../../lib/api";

/**
 * ໜ້າງານດຽວ — ປຸ່ມທີ່ສະແດງ **ມາຈາກ server** (`job.action`) ບໍ່ແມ່ນແອັບຄິດເອງ.
 *
 * check-in ໜ້າງານ: ບັງຄັບເອົາພິກັດ (ຫຼັກຖານວ່າໄປຮອດຈິງ) ແລະ ຮູບ (ບໍ່ບັງຄັບ).
 * ວຽກຕິດຕັ້ງລົງໜ້າງານສະເໝີ · ວຽກສ້ອມສະແດງປຸ່ມ check-in ສະເພາະງານນອກສູນ (onsite).
 */
export default function JobDetail() {
  const { workflow, code } = useLocalSearchParams<{ workflow: "install" | "repair"; code: string }>();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    const jobs = await fetchJobs();
    setJob(jobs.find((row) => row.workflow === workflow && row.code === code) ?? null);
    setLoading(false);
  }, [workflow, code]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(command: JobCommand) {
    setBusy(true);
    try {
      const result = await sendCommand({ workflow, code }, command);
      Alert.alert("ສຳເລັດ", result.message);
      await load();
      // ງານທີ່ປະຕິເສດ ບໍ່ແມ່ນຂອງເຮົາອີກແລ້ວ ⇒ ກັບຄິວ
      if (command.action === "reject") router.replace("/");
    } catch (caught) {
      Alert.alert("ບໍ່ສຳເລັດ", (caught as { error?: string }).error ?? "ດຳເນີນການບໍ່ໄດ້");
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  }

  /** ພິກັດ — ບໍ່ມີສິດ = check-in ບໍ່ໄດ້ (ຫຼັກຖານຂາດ ບໍ່ມີຄວາມໝາຍ) */
  async function coordinates() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("ຕ້ອງການພິກັດ", "check-in ຕ້ອງໃຊ້ພິກັດເປັນຫຼັກຖານວ່າໄປຮອດໜ້າງານ");
      return null;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  }

  /**
   * ຮູບຜົນງານຕອນຈົບງານ — ຝັ່ງຕິດຕັ້ງ **ບັງຄັບຢ່າງໜ້ອຍ 1 ຮູບ** (server ບັງຄັບອີກຊັ້ນ).
   * quality 0.5 + base64 ⇒ ປະມານ 100-200 KB ຕໍ່ຮູບ ຫຼັງ base64 (ເພດານ server 400k ຕົວອັກສອນ).
   */
  async function addPhoto() {
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (shot.canceled) return;
    setPhotos((current) => [...current, `data:image/jpeg;base64,${shot.assets[0].base64}`]);
  }

  async function checkin() {
    const point = await coordinates();
    if (!point) return;

    const shot = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    const photo = shot.canceled ? undefined : `data:image/jpeg;base64,${shot.assets[0].base64}`;
    await run({ action: "checkin", ...point, photo, note });
  }

  async function checkout() {
    const point = await coordinates();
    await run({ action: "checkout", ...(point ?? {}), note });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>ບໍ່ພົບງານນີ້ (ອາດຖືກປ່ຽນຊ່າງ ຫຼື ຈົບໄປແລ້ວ)</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
      <View style={styles.card}>
        <Text style={styles.code}>
          {job.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມແປງ"} · {job.code}
        </Text>
        <Text style={styles.stage}>{job.stage_label}</Text>

        <Row label="ລູກຄ້າ" value={job.customer} />
        <Row label="ສິນຄ້າ" value={[job.product, job.detail].filter(Boolean).join(" · ")} />
        <Row label="ບ່ອນຢູ່" value={job.address} />
        {job.appointment ? <Row label="ວັນນັດ" value={job.appointment} /> : null}

        {job.tel ? (
          <Pressable style={styles.call} onPress={() => Linking.openURL(`tel:${job.tel}`)}>
            <Text style={styles.callText}>📞 ໂທຫາລູກຄ້າ {job.tel}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ຂັ້ນຕອນ — ປຸ່ມມາຈາກ server */}
      <View style={styles.card}>
        {job.action === "accept" && !rejecting && (
          <>
            <Button label="ຮັບງານ" color="#0d9488" busy={busy} onPress={() => run({ action: "accept" })} />
            <Button label="ປະຕິເສດງານ" color="#dc2626" busy={busy} onPress={() => setRejecting(true)} />
          </>
        )}

        {rejecting && (
          <>
            <Text style={styles.label}>ເຫດຜົນທີ່ປະຕິເສດ (CS ຈະເຫັນ)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="ຕິດງານອື່ນ, ຢູ່ໄກ, ບໍ່ຖະນັດງານນີ້..."
              style={styles.input}
              multiline
            />
            <Button
              label="ຢືນຢັນການປະຕິເສດ"
              color="#dc2626"
              busy={busy}
              onPress={() => run({ action: "reject", reason })}
            />
            <Button label="ຍົກເລີກ" color="#64748b" busy={busy} onPress={() => setRejecting(false)} />
          </>
        )}

        {job.action === "start" && (
          <Button
            label={job.workflow === "install" ? "ເລີ່ມຕິດຕັ້ງ" : "ເລີ່ມສ້ອມແປງ"}
            color="#0d9488"
            busy={busy}
            onPress={() => run({ action: "start" })}
          />
        )}

        {job.action === "finish" && (
          <>
            {job.workflow === "repair" && (
              <>
                <Text style={styles.label}>ບັນທຶກການສ້ອມ (ວິທີແກ້ໄຂ)</Text>
                <TextInput value={note} onChangeText={setNote} style={styles.input} multiline />
              </>
            )}

            {/* ຮູບຜົນງານ — ຕິດຕັ້ງບັງຄັບ · ສ້ອມບໍ່ບັງຄັບ (ແຕ່ແນະນຳ) */}
            <Text style={styles.label}>
              ຮູບຜົນງານ {photos.length > 0 ? `(${photos.length} ຮູບ)` : job.workflow === "install" ? "— ບັງຄັບຢ່າງໜ້ອຍ 1 ຮູບ" : "(ບໍ່ບັງຄັບ)"}
            </Text>
            <Button label="📷 ຖ່າຍຮູບຜົນງານ" color="#334155" busy={busy} onPress={addPhoto} />
            {photos.length > 0 && (
              <View style={styles.thumbs}>
                {photos.map((photo, index) => (
                  <Image key={index} source={{ uri: photo }} style={styles.thumb} />
                ))}
              </View>
            )}

            <Button
              label={
                job.workflow === "install" && photos.length === 0
                  ? "ຕ້ອງແນບຮູບກ່ອນ"
                  : "ບັນທຶກສຳເລັດ — ສົ່ງກວດ QC"
              }
              color={job.workflow === "install" && photos.length === 0 ? "#94a3b8" : "#059669"}
              busy={busy || (job.workflow === "install" && photos.length === 0)}
              onPress={() => run({ action: "finish", note, photos })}
            />
          </>
        )}

        {/* ງານສ້ອມທີ່ຢູ່ຂັ້ນກວດເຊັກ (1-2) — ໄປໜ້າກວດເຊັກ */}
        {job.workflow === "repair" && (job.stage === 1 || job.stage === 2) && (
          <Button
            label={job.stage === 1 ? "ເລີ່ມກວດເຊັກ" : "ບັນທຶກຜົນກວດເຊັກ"}
            color="#0d9488"
            busy={busy}
            onPress={async () => {
              /**
               * ⚠️ ຂັ້ນ 1 = "ລໍຖ້າກວດເຊັກ" ⇒ ຕ້ອງເອີ້ນ **ເລີ່ມກວດເຊັກ** (/api/mobile/check)
               * ບໍ່ແມ່ນ "ເລີ່ມສ້ອມແປງ" (ຂັ້ນ 8). ສອງອັນນີ້ຄົນລະຄຳສັ່ງກັນ.
               */
              try {
                if (job.stage === 1) await sendCheck(job.code, { action: "start" });
                router.push(`/check/${job.code}`);
              } catch (caught) {
                Alert.alert("ບໍ່ສຳເລັດ", (caught as { error?: string }).error ?? "");
              }
            }}
          />
        )}

        {job.action === "wait_spare" && (
          <>
            {/* ຂັ້ນ 5 = ຍັງບໍ່ໄດ້ອອກໃບຂໍເບີກ ⇒ ຊ່າງເປັນຄົນອອກເອງ (ບໍ່ຜ່ານ CS) */}
            {job.workflow === "repair" && job.stage === 5 ? (
              <>
                <Text style={styles.wait}>ຕ້ອງອອກໃບຂໍເບີກອາໄຫຼ່ກ່ອນ</Text>
                <Button
                  label="ອອກໃບຂໍເບີກອາໄຫຼ່"
                  color="#0d9488"
                  busy={busy}
                  onPress={() => router.push(`/spare-request/${job.code}`)}
                />
              </>
            ) : (
              <>
                <Text style={styles.wait}>ລໍສາງເບີກອາໄຫຼ່ — ຍັງລົງມືບໍ່ໄດ້</Text>
                <Button label="ໄປໜ້າ ຮັບອາໄຫຼ່" color="#334155" busy={busy} onPress={() => router.push("/spares")} />
              </>
            )}
          </>
        )}
        {job.action === "wait_other" && <Text style={styles.wait}>ວຽກຂອງທ່ານຈົບແລ້ວ — ລໍຂັ້ນຕອນອື່ນ (QC / CS)</Text>}
      </View>

      {/* check-in ໜ້າງານ — ສະເພາະວຽກນອກສະຖານທີ່ */}
      {job.onsite && (
        <View style={styles.card}>
          <Text style={styles.label}>ໜ້າງານ</Text>
          {job.checked_in ? (
            <Button label="check-out (ອອກຈາກໜ້າງານ)" color="#334155" busy={busy} onPress={checkout} />
          ) : (
            <Button label="check-in ໜ້າງານ (ພິກັດ + ຮູບ)" color="#0f172a" busy={busy} onPress={checkin} />
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Button({
  label,
  color,
  busy,
  onPress,
}: {
  label: string;
  color: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.button, { backgroundColor: color }, busy && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 8 },
  code: { fontWeight: "800", fontSize: 18, color: "#0f172a" },
  stage: { color: "#0d9488", fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  rowLabel: { width: 72, color: "#64748b", fontSize: 13 },
  rowValue: { flex: 1, color: "#0f172a", fontWeight: "600", fontSize: 13 },
  call: { backgroundColor: "#ecfdf5", padding: 12, borderRadius: 10, marginTop: 6 },
  callText: { color: "#047857", fontWeight: "700", textAlign: "center" },
  label: { color: "#334155", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, minHeight: 60, backgroundColor: "#fff" },
  button: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  wait: { color: "#64748b", textAlign: "center", paddingVertical: 8 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  thumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  muted: { color: "#64748b" },
});
