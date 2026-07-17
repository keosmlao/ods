import { redirect } from "next/navigation";

/**
 * ໜ້ານີ້ຖືກລວມເຂົ້າ**ໜ້າເອກະສານດຽວ** /purchase-orders/[docNo] (17-07-2026) —
 * ນະໂຍບາຍ "ຄື Odoo": ໃບດຽວມີໜ້າດຽວ, ປຸ່ມອະນຸມັດ/ອອກ PO/ອະນຸມັດ PO ຢູ່ບ່ອນດຽວກັນ
 * ຕາມສະຖານະ. ຄົງໄວ້ເປັນ redirect ເພື່ອ bookmark/ລິ້ງເກົ່າໃນແຈ້ງເຕືອນບໍ່ຕາຍ.
 */
export default async function LegacyApproveSprPage({ params }: { params: Promise<{ docNo: string }> }) {
  const { docNo } = await params;
  redirect(`/purchase-orders/${encodeURIComponent(decodeURIComponent(docNo))}`);
}
