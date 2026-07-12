import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { clearToken, fetchJobs, type Job } from "../lib/api";

/**
 * ຄິວວຽກຂອງຊ່າງ — ຕິດຕັ້ງ ແລະ ສ້ອມແປງ ຢູ່ບ່ອນດຽວ (ຄືວຽກຈິງຂອງຊ່າງ ທີ່ບໍ່ໄດ້ແຍກສອງແອັບ).
 * ປ້າຍ "ຕ້ອງລົງມື" ມາຈາກ server (`action`) — ແອັບບໍ່ຄິດຂັ້ນຕອນເອງ.
 */
const ACTION_LABEL: Record<Job["action"], string> = {
  accept: "ຮັບ / ປະຕິເສດ",
  start: "ເລີ່ມລົງມື",
  finish: "ບັນທຶກສຳເລັດ",
  wait_spare: "ລໍອາໄຫຼ່ຈາກສາງ",
  wait_other: "ລໍຂັ້ນຕອນອື່ນ",
};

const ACTION_COLOR: Record<Job["action"], string> = {
  accept: "#dc2626",
  start: "#0d9488",
  finish: "#059669",
  wait_spare: "#d97706",
  wait_other: "#94a3b8",
};

const days = (seconds: number) => Math.floor(seconds / 86400);

export default function Jobs() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setJobs(await fetchJobs());
      setError("");
    } catch (caught) {
      const failure = caught as { error?: string; status?: number };
      // token ໝົດອາຍຸ → ກັບໄປ login (ບໍ່ໃຫ້ຄ້າງຢູ່ໜ້າຫວ່າງ)
      if (failure.status === 401) {
        await clearToken();
        router.replace("/login");
        return;
      }
      setError(failure.error ?? "ໂຫຼດບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.topRow}>
        <Text style={styles.count}>{jobs.length} ງານ</Text>
        <View style={styles.links}>
          <Link href="/spares" asChild>
            <Pressable style={styles.link}>
              <Text style={styles.linkText}>ຮັບອາໄຫຼ່</Text>
            </Pressable>
          </Link>
          {/* QC ຂຶ້ນສະເພາະຜູ້ທີ່ຜູ້ຈັດການກຳນົດ (ຫົວໜ້າຊ່າງ/CS) — ຄົນອື່ນກົດເຂົ້າໄປ server ປະຕິເສດ */}
          <Link href="/qc" asChild>
            <Pressable style={styles.link}>
              <Text style={styles.linkText}>QC</Text>
            </Pressable>
          </Link>
          <Link href="/income" asChild>
            <Pressable style={styles.incomeLink}>
              <Text style={styles.incomeText}>ລາຍຮັບ</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={jobs}
        keyExtractor={(job) => `${job.workflow}-${job.code}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>ບໍ່ມີງານຄ້າງ</Text>}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Link href={`/job/${item.workflow}/${item.code}`} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.code}>
                  {item.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"} · {item.code}
                </Text>
                <View style={[styles.chip, { backgroundColor: ACTION_COLOR[item.action] }]}>
                  <Text style={styles.chipText}>{ACTION_LABEL[item.action]}</Text>
                </View>
              </View>

              <Text style={styles.product}>{item.product ?? "-"}</Text>
              <Text style={styles.muted}>{item.customer ?? "-"}</Text>
              <Text style={styles.muted}>{item.address ?? ""}</Text>

              <View style={styles.cardBottom}>
                <Text style={styles.stage}>{item.stage_label}</Text>
                <Text style={styles.muted}>
                  {item.checked_in ? "🟢 ຢູ່ໜ້າງານ · " : ""}
                  {item.appointment ? `ນັດ ${item.appointment} · ` : ""}
                  ຄ້າງ {days(item.elapsed_seconds)} ມື້
                </Text>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  count: { fontWeight: "700", color: "#0f172a" },
  links: { flexDirection: "row", gap: 6 },
  link: { backgroundColor: "#0d9488", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  linkText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  incomeLink: { backgroundColor: "#0f172a", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  incomeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#e2e8f0", gap: 2 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  code: { fontWeight: "800", color: "#0f172a" },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chipText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  product: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  muted: { color: "#64748b", fontSize: 12 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  stage: { color: "#0d9488", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  error: { color: "#dc2626", marginBottom: 8, fontWeight: "600" },
});
