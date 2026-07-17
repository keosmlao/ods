import { queryOdg } from "@/lib/db";

/**
 * **ຜູ້ສະໜອງ (AP Supplier) — ດຶງຈາກ ERP ສົດໆ. ບໍ່ກ໋ອບມາເກັບໃນ ODS.**
 *
 * ── ເປັນຫຍັງບໍ່ເກັບໄວ້ ──
 * ຜູ້ສະໜອງເປັນ **ຂໍ້ມູນຫຼັກຂອງ ERP** (ຄືກັບ ລູກຄ້າ · ສິນຄ້າ · ພະນັກງານ ທີ່ລະບົບນີ້
 * ດຶງສົດຢູ່ແລ້ວ — ເບິ່ງ lib/erp-master). ກ໋ອບມາເກັບ = ມີວັນລ້າສະໄໝ ແລະ ຄົນຈະເລືອກ
 * ຜູ້ສະໜອງທີ່ຖືກປິດໄປແລ້ວ. ຕົ້ນເຫດຂອງ SPR ຜີກໍ່ມາຈາກການເກັບຊ້ຳສອງບ່ອນພໍດີ.
 *
 * ── ລະຫັດຜູ້ສະໜອງບອກສາຂາ ──
 * ຮູບແບບ `NN-XXXX` — ຄຳນຳໜ້າຕົງກັບສາຂາທີ່ຊື້ຜ່ານ (ຂໍ້ມູນຈິງຈາກໃບ WPRA/PO):
 *   `01-…` ຮ້ານແອມ(ເຍັນຊັບ) …   ← ຊື້ຜ່ານລາວ
 *   `02-…` ເຈົ້າໜີ້ອື່ນໆ(ໄທ) …    ← ຊື້ຜ່ານໄທ
 * ⇒ ກອງຕາມສາຂາທີ່ຜູ້ຂໍເລືອກໄວ້ໃນໃບ (ic_trans.branch_code) ໄດ້.
 */

export type Supplier = {
  code: string;
  name: string;
  /** ຊື່ທີ 2 (ພາສາອື່ນ) — ວ່າງໄດ້ */
  name_2: string | null;
};

/**
 * ຄົ້ນຫາຜູ້ສະໜອງ — ໃຊ້ຢູ່ຟອມອອກໃບສັ່ງຊື້.
 * `q` ຫວ່າງ = ຄືນລາຍການທຳອິດ (ໃຫ້ dropdown ມີຂໍ້ມູນເລີຍ ບໍ່ຕ້ອງພິມກ່ອນ).
 *
 * ບໍ່ໂຍນ error: ERP ລົ້ມ ⇒ ຄືນລາຍການຫວ່າງ ແລະ ຟອມຍັງເປີດໄດ້ (ຄື lib/erp-purchase).
 */
export async function searchSuppliers(q = "", limit = 30): Promise<Supplier[]> {
  const term = q.trim();
  try {
    const rows = await queryOdg<Supplier>(
      `select code, coalesce(nullif(name_1,''), code) as name, nullif(name_2,'') as name_2
         from ap_supplier
        where coalesce(ap_status, 0) <> 1
          and ($1 = '' or code ilike $2 or name_1 ilike $2 or name_2 ilike $2)
        order by code
        limit $3`,
      [term, `%${term}%`, limit],
    );
    return rows.rows;
  } catch (error) {
    console.error("searchSuppliers failed", error);
    return [];
  }
}

/** ຜູ້ສະໜອງ 1 ລາຍ — ໃຊ້ຢືນຢັນຢູ່ server ວ່າລະຫັດທີ່ຟອມສົ່ງມາມີຈິງ (ຢ່າເຊື່ອ form) */
export async function supplierByCode(code: string): Promise<Supplier | null> {
  const clean = code.trim();
  if (!clean) return null;
  try {
    const rows = await queryOdg<Supplier>(
      `select code, coalesce(nullif(name_1,''), code) as name, nullif(name_2,'') as name_2
         from ap_supplier where code = $1 limit 1`,
      [clean],
    );
    return rows.rows[0] ?? null;
  } catch (error) {
    console.error("supplierByCode failed", error);
    return null;
  }
}
