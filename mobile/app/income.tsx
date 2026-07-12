import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { fetchIncome, type Income } from "../lib/api";

/**
 * ລາຍຮັບຂອງຊ່າງ (ເດືອນນີ້) — ຕົວເລກທີ່ **ແຊ່ໄວ້ຕອນປິດງານ** (ods_service_payout)
 * ບໍ່ແມ່ນຄິດຄືນໃໝ່ ⇒ ອັດຕາປ່ຽນພາຍຫຼັງ ບໍ່ກະທົບເງິນຂອງງານທີ່ຈົບໄປແລ້ວ.
 *
 * ຖ້າຊ່າງຍັງບໍ່ໄດ້ເຊື່ອມຕົວຕົນ ODS↔ERP (ຜູ້ຈັດການເຮັດທີ່ /manage/technicians)
 * ຈະບອກໃຫ້ຮູ້ຊັດ — ບໍ່ສະແດງ 0 ງຽບໆ ແລ້ວປ່ອຍໃຫ້ຊ່າງເຂົ້າໃຈວ່າບໍ່ໄດ້ເງິນ.
 */
export default function IncomeScreen() {
  const [income, setIncome] = useState<Income | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchIncome()
      .then(setIncome)
      .catch((caught) => setError((caught as { error?: string }).error ?? "ໂຫຼດບໍ່ສຳເລັດ"));
  }, []);

  if (error) return <Text style={styles.error}>{error}</Text>;

  if (!income) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (!income.linked) {
    return (
      <View style={styles.center}>
        <Text style={styles.warn}>ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ເຊື່ອມກັບພະນັກງານ ERP</Text>
        <Text style={styles.muted}>ຄ່າຄອມຈະຍັງບໍ່ເຂົ້າບັນຊີທ່ານ — ກະລຸນາແຈ້ງຜູ້ຈັດການ</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.total}>
        <Text style={styles.totalLabel}>ລາຍຮັບເດືອນນີ້ ({income.jobs} ງານ)</Text>
        <Text style={styles.totalValue}>
          {income.total_thb.toLocaleString("en-US", { minimumFractionDigits: 2 })} ບາທ
        </Text>
      </View>

      <FlatList
        data={income.rows}
        keyExtractor={(row, index) => `${row.job_code}-${index}`}
        ListEmptyComponent={<Text style={styles.muted}>ຍັງບໍ່ມີງານທີ່ປິດໃນເດືອນນີ້</Text>}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.code}>
                {item.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"} · {item.job_code}
              </Text>
              <Text style={styles.muted}>
                {item.role} · ປິດງານ {item.closed_at}
              </Text>
            </View>
            <Text style={styles.pay}>{item.pay_thb.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f8fafc", padding: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  total: { backgroundColor: "#0f172a", borderRadius: 14, padding: 18, marginBottom: 12 },
  totalLabel: { color: "#94a3b8", fontSize: 12 },
  totalValue: { color: "#fff", fontSize: 30, fontWeight: "800" },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  code: { fontWeight: "700", color: "#0f172a" },
  pay: { fontWeight: "800", color: "#059669", fontSize: 16 },
  muted: { color: "#64748b", fontSize: 12, textAlign: "center" },
  warn: { color: "#b45309", fontWeight: "700", textAlign: "center" },
  error: { color: "#dc2626", padding: 24, fontWeight: "600" },
});
