import { queryOdg } from "@/lib/db";

/**
 * ຕາຕະລາງແມ່ຂອງ ERP ທີ່ຟອມສັ່ງຊື້ຕ້ອງໃຊ້ — **ອ່ານຈາກ ERP ບ່ອນດຽວ**.
 *
 * ── ເປັນຫຍັງສອງອັນນີ້ຢູ່ນຳກັນ ──
 * ໃບ PO ຈິງທຸກໃບຕື່ມສາມຢ່າງທີ່ໂຄ້ດເກົ່າ**ບໍ່ເຄີຍຂຽນ**: `send_date` (ຄາດວ່າຮອດ),
 * `transport_code` (ຊ່ອງທາງຈັດສົ່ງ) ຢູ່ຫົວໃບ ແລະ `wh_code` (ສາງທີ່ຮັບເຂົ້າ) ຢູ່ແຖວ.
 * ຂໍ້ມູນຈິງ (17-07-2026 · ໃບ 1 ປີ): PO 2,188/2,188 ໃບ ມີ send_date + transport_code
 * ແລະ ແຖວ PO 14,648/14,652 (99.97%) ມີ wh_code — ໃນຂະນະທີ່ SPR/WPRA/WPOA **ບໍ່ມີ wh_code ຈັກແຖວ**.
 * ⇒ ສາງທີ່ຮັບເຂົ້າ ຖືກຕັດສິນ **ຕອນອອກ PO** (ບໍ່ແມ່ນຕອນຂໍຊື້) — ຟອມຈຶ່ງຖາມຢູ່ຂັ້ນນັ້ນ.
 */

export type Lookup = { code: string; name: string };

/**
 * ຊ່ອງທາງການຈັດສົ່ງ (ic_trans.transport_code) — 10 ອັນ ເຊັ່ນ "ຂົນສົ່ງໂອດ່ຽນ" · "ລູກຄ້າຮັບເອງ".
 * ERP ລົ້ມ ⇒ ຄືນລາຍການຫວ່າງ (ຟອມຍັງເປີດໄດ້ ພຽງແຕ່ເລືອກບໍ່ໄດ້) ບໍ່ໃຫ້ໜ້າຈໍຕາຍຕາມ.
 */
export async function transportTypes(): Promise<Lookup[]> {
  try {
    return (
      await queryOdg<Lookup>(
        `select code, coalesce(nullif(name_1,''), code) as name
           from transport_type where coalesce(status,0)=0 order by code`,
      )
    ).rows;
  } catch (error) {
    console.error("transportTypes failed", error);
    return [];
  }
}

/** ສາງທັງໝົດຂອງ ERP — ບໍ່ຈຳກັດ 4 ສາງຄືເມື່ອກ່ອນ (ນະໂຍບາຍ: ທຸກສາງໃຊ້ໄດ້) */
export async function warehouses(): Promise<Lookup[]> {
  try {
    return (
      await queryOdg<Lookup>(
        `select code, coalesce(nullif(name_1,''), code) as name from ic_warehouse order by code`,
      )
    ).rows;
  } catch (error) {
    console.error("warehouses failed", error);
    return [];
  }
}

/** ສະກຸນເງິນ ພ້ອມອັດຕາປັດຈຸບັນ (erp_currency.exchange_rate_present) */
export type Currency = Lookup & { symbol: string | null; rate: number };

/**
 * ສະກຸນເງິນຂອງ ERP — **01=ບາດ · 02=ກີບ · 03=ໂດລາ · 04=ຢວນ**.
 *
 * ⚠️ ຢ່າເດົາລະຫັດ: ໂຄ້ດເກົ່າຂຽນຄຳເຫັນວ່າ "01 = ກີບ" ເຊິ່ງ**ຜິດ** — 01 ຄືບາດ.
 * ຖານເງິນຂອງ ERP ແມ່ນ **ບາດ** ⇒ `exchange_rate` = ຈຳນວນບາດຕໍ່ 1 ໜ່ວຍຂອງສະກຸນນັ້ນ
 * (ຂໍ້ມູນຈິງ: ບາດ 1 · ໂດລາ 33 · ຢວນ 4.856 · ກີບ 0.0014598 ≈ 1/685).
 */
export async function currencies(): Promise<Currency[]> {
  try {
    return (
      await queryOdg<Currency>(
        `select code, coalesce(nullif(name_1,''), code) as name, symbol,
            coalesce(exchange_rate_present, 1)::float8 as rate
           from erp_currency order by code`,
      )
    ).rows;
  } catch (error) {
    console.error("currencies failed", error);
    return [];
  }
}
