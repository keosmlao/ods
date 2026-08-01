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

/**
 * ── ຈື່ພິກັດໃສ່ **ຂໍ້ມູນລູກຄ້າ** ເມື່ອ ERP ຍັງບໍ່ຮູ້ (01-08-2026 ຕາມຄຳສັ່ງ) ──
 *
 * ຄົນຮັບເຄື່ອງປັກໝຸດຢູ່ໃບງານເທື່ອດຽວ ⇒ ໃບຕໍ່ໄປຂອງລູກຄ້າຄົນນັ້ນໄດ້ໝຸດເອງ.
 * ນີ້ຄືວິທີທີ່ຂໍ້ມູນ 247/20,845 ຈະຄ່ອຍໆເຕັມຂຶ້ນ ໂດຍບໍ່ຕ້ອງໄລ່ປ້ອນຍ້ອນຫຼັງ.
 *
 * ── ດ່ານ 3 ຢ່າງ (ອັນນີ້ຂຽນລົງ **ຖານ ERP** ຈຶ່ງຕ້ອງລະວັງ) ──
 * ① **ບໍ່ຂຽນທັບພິກັດທີ່ມີຢູ່ແລ້ວ** — ຂຽນສະເພາະແຖວທີ່ຫວ່າງ/ເປັນ 0/ນອກປະເທດລາວ.
 *    ພິກັດທີ່ ERP ມີຢູ່ອາດເປັນທີ່ຢູ່ຈົດທະບຽນທີ່ຖືກຕ້ອງກວ່າໜ້າງານຂອງໃບໜຶ່ງ.
 * ② **ຂຽນສະເພາະໝຸດທີ່ຢູ່ໃນປະເທດລາວ** — ກັນຄ່າຂີ້ເຫຍື້ອຈາກການວາງລິງຜິດ.
 * ③ **ບໍ່ insert ແຖວໃໝ່** — ມີລູກຄ້າ 36 ຄົນທີ່ບໍ່ມີແຖວ detail; ການສ້າງແຖວ master
 *    ຂອງ ERP ເປັນເລື່ອງຂອງ ERP ບໍ່ແມ່ນຂອງລະບົບສ້ອມ.
 *
 * ⚠️ ໜ້າງານຂອງໃບໜຶ່ງ **ບໍ່ຈຳເປັນຕ້ອງແມ່ນ**ທີ່ຢູ່ຂອງລູກຄ້າສະເໝີ (ລູກຄ້າອາດມີຫຼາຍສາຂາ)
 * ⇒ ຈຶ່ງຂຽນສະເພາະຕອນ**ຍັງບໍ່ມີຫຍັງ** ເຊິ່ງມີຂໍ້ມູນດີກວ່າບໍ່ມີ ແລະ ຄົນແກ້ຄືນໄດ້ຢູ່ ERP.
 *
 * ລົ້ມເຫຼວ ⇒ ງຽບ (ການເປີດງານຕ້ອງບໍ່ພັງຍ້ອນເລື່ອງນີ້).
 * @returns true ຖ້າຂຽນຈິງ
 */
export async function rememberCustomerPoint(erpCode: string, point: CustomerPoint): Promise<boolean> {
  if (!erpCode.trim()) return false;
  // ② ນອກຂອບເຂດປະເທດລາວ = ຂໍ້ມູນເສຍ ⇒ ຢ່າເອົາໄປໃສ່ຂໍ້ມູນລູກຄ້າ
  if (!(point.lat >= 13 && point.lat <= 23 && point.lng >= 100 && point.lng <= 108)) return false;
  try {
    const result = await queryOdg(
      `update ar_customer_detail
          set latitude = $2, longitude = $3
        where ar_code = $1
          -- ① ສະເພາະແຖວທີ່ຍັງບໍ່ມີພິກັດໃຊ້ໄດ້
          and not (latitude between 13 and 23 and longitude between 100 and 108)`,
      [erpCode.trim(), point.lat, point.lng],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("rememberCustomerPoint failed", error);
    return false;
  }
}
