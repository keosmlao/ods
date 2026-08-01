import { queryOdg } from "@/lib/db";

/**
 * ── ພິກັດຂອງລູກຄ້າ ຈາກ ERP (`ar_customer_detail`) ──
 *
 * ໃຊ້ຕື່ມໝຸດໃຫ້ອັດຕະໂນມັດ ແທນທີ່ຈະໃຫ້ຄົນຮັບເຄື່ອງປັກເອງທຸກໃບ.
 *
 * ⚠️ **20,595 ຈາກ 20,845 ແຖວເປັນ 0.0** ເຊິ່ງບໍ່ແມ່ນພິກັດ (0,0 ຢູ່ກາງມະຫາສະໝຸດ
 * ນອກຝັ່ງອາຟຣິກາ) ⇒ ຕ້ອງກອງດ້ວຍຂອບເຂດປະເທດລາວ ບໍ່ດັ່ງນັ້ນທຸກໃບຈະໄດ້ໝຸດຜິດບ່ອນ
 * ແລ້ວແຜນທີ່ຕິດຕາມງານຈະຊີ້ໄປທະເລ. ໃຊ້ໄດ້ຈິງພຽງ **247 ຄົນ**.
 */
export type CustomerPoint = { lat: number; lng: number };

/** ຂອບເຂດປະເທດລາວ — ນອກນີ້ຖືວ່າຂໍ້ມູນເສຍ */
const IN_LAOS = `d.latitude between 13 and 23 and d.longitude between 100 and 108`;

/**
 * @param erpCode ລະຫັດລູກຄ້າຝັ່ງ ERP (ar_customer.code) — ບໍ່ແມ່ນລະຫັດ ODS
 */
export async function customerPoint(erpCode: string): Promise<CustomerPoint | null> {
  if (!erpCode.trim()) return null;
  try {
    const rows = await queryOdg<CustomerPoint>(
      `select d.latitude::float8 lat, d.longitude::float8 lng
         from ar_customer_detail d
        where d.ar_code = $1 and ${IN_LAOS}
        limit 1`,
      [erpCode.trim()],
    );
    return rows.rows[0] ?? null;
  } catch (error) {
    // ERP ອ່ານບໍ່ໄດ້ ⇒ ຄືນ null ⇒ ຄົນປັກເອງຄືເກົ່າ (ຢ່າໃຫ້ການເປີດງານລົ້ມ)
    console.error("customerPoint failed", error);
    return null;
  }
}
