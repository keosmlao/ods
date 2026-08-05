import { ERP_DIMS_SQL } from "@/lib/commission";
import { db, odgDb, query } from "@/lib/db";

/**
 * **ຄ່າບໍລິການສ້ອມແປງທີ່ຈະຕື່ມໃສ່ບິນ — ຈັບຄູ່ຈາກປະເພດເຄື່ອງ**.
 *
 * ── ບັນຫາທີ່ແກ້ ──
 * ໜ້າໃບຮັບເງິນຕື່ມ **ອາໄຫຼ່** ໃຫ້ເອງຢູ່ແລ້ວ ແຕ່ຄ່າບໍລິການຄົນຕ້ອງໄປເລືອກເອງຈາກ
 * ລາຍການ 9702xx ເກືອບ 20 ລະຫັດ (ກວດເຊັກ / ລ້າງ / ແປງ × ຊະນິດ × BTU) ທຸກໃບ
 * ⇒ ລືມໃສ່ = ລາຍຮັບຫາຍ, ໃສ່ຜິດລະຫັດ = ລາຍງານລາຍຮັບແຍກໝວດຜິດ.
 *
 * ── ຈັບຄູ່ແນວໃດ (ສູດດຽວກັບ ods_service_rate — ເບິ່ງ lib/commission) ──
 * ມິຕິ: **ປະເພດເຄື່ອງ (p_type)** ເປັນຫຼັກ + ປະເພດບໍລິການ, ແລ້ວ ໝວດ/ແບບ/ຂະໜາດ ຈາກ ERP
 * ເປັນຕົວລະອຽດເພີ່ມ (ໃຊ້ໄດ້ສະເພາະງານທີ່ມີ item_code — ໜ້ອຍຫຼາຍ ເບິ່ງໝາຍເຫດ MATCH_SQL).
 * null ໃນແຖວຕັ້ງຄ່າ = "ທຸກອັນ" ⇒ ແຖວທີ່ລະອຽດກວ່າຊະນະ.
 *
 * ⚠️ **ໃນປະກັນ = 0 ສະເໝີ** — ບັງຄັບຢູ່ຜູ້ເອີ້ນ (seedCart) ບໍ່ແມ່ນຢູ່ຕາຕະລາງ
 * ⇒ ຕັ້ງລາຄາເທື່ອດຽວໃຊ້ໄດ້ທັງງານໃນ/ນອກປະກັນ.
 */
export type ServiceChargeRow = {
  id: number;
  service_type: string | null;
  product_type: string | null;
  category_code: string | null;
  design_code: string | null;
  size_code: string | null;
  service_code: string;
  service_name: string | null;
  unit_code: string | null;
  price_thb: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string | null;
};

export type ServiceChargeMatch = {
  id: number;
  service_code: string;
  service_name: string | null;
  unit_code: string | null;
  price_thb: number;
};

/**
 * ⚠️ **ມິຕິຫຼັກຄື `product_type`** (p_type ຂອງໃບຮັບເຄື່ອງ) ບໍ່ແມ່ນໝວດ ERP —
 * ງານສ້ອມ 1 ປີ 2,122 ໃບ ມີ `item_code` ພຽງ 15 ໃບ ⇒ ໝວດ/ແບບ/ຂະໜາດ ຈາກ ERP
 * ຈັບຄູ່ໄດ້ 0.7% ຂອງງານເທົ່ານັ້ນ (ເບິ່ງ migration 2026-08-05-service-charge-product-type).
 * ຄະແນນ: ຂະໜາດ 16 · ແບບ 8 · ໝວດ ERP 4 · ປະເພດເຄື່ອງ 2 · ປະເພດບໍລິການ 1.
 */
const MATCH_SQL = `
  select m.id, m.service_code, m.service_name, m.unit_code, m.price_thb::float8 price_thb,
      (case when m.size_code     is not null then 16 else 0 end)
    + (case when m.design_code   is not null then 8 else 0 end)
    + (case when m.category_code is not null then 4 else 0 end)
    + (case when m.product_type  is not null then 2 else 0 end)
    + (case when m.service_type  is not null then 1 else 0 end) as score
  from ods_service_charge_map m
  where m.is_active
    and (m.service_type  is null or m.service_type  = $1)
    and (m.category_code is null or m.category_code = $2)
    and (m.design_code   is null or m.design_code   = $3)
    and (m.size_code     is null or m.size_code     = $4)
    and (m.product_type  is null or m.product_type  = $5)
  order by score desc, m.id
  limit 1`;

/**
 * ຫາລາຍການຄ່າບໍລິການຂອງໃບງານນຶ່ງ. ບໍ່ໂຍນ error ແລະ ບໍ່ບັງຄັບໃຫ້ພົບ —
 * ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ ຫຼື ງານບໍ່ມີລະຫັດສິນຄ້າ ERP ⇒ null ແລ້ວບິນກໍ່ອອກໄດ້ຄືເກົ່າ
 * (ຄົນເລືອກເອງຈາກປຸ່ມ "ລາຍການຄ່າບໍລິການ"). **ການອອກບິນຫ້າມພັງເພາະການຕັ້ງຄ່າ.**
 */
export async function serviceChargeForJob(jobCode: string): Promise<ServiceChargeMatch | null> {
  if (!db) return null;
  try {
    const job = (
      await db.query<{ item_code: string | null; service_type: string | null; product_type: string | null }>(
        `select item_code, nullif(service_type,'') service_type, nullif(p_type,'') product_type
           from tb_product where code = $1 limit 1`,
        [jobCode],
      )
    ).rows[0];
    if (!job) return null;

    let dims = { category_code: null as string | null, design_code: null as string | null, size_code: null as string | null };
    if (job.item_code && odgDb) {
      const erp = (await odgDb.query<typeof dims>(ERP_DIMS_SQL, [job.item_code])).rows[0];
      if (erp) dims = erp;
    }
    const row = (
      await db.query<ServiceChargeMatch>(MATCH_SQL, [
        job.service_type,
        dims.category_code,
        dims.design_code,
        dims.size_code,
        job.product_type,
      ])
    ).rows[0];
    return row ?? null;
  } catch (error) {
    console.error("serviceChargeForJob failed", jobCode, error);
    return null;
  }
}

/** ລາຍການຕັ້ງຄ່າທັງໝົດ — ໜ້າ /manage/service-charges */
export async function listServiceCharges(): Promise<ServiceChargeRow[]> {
  return (
    await query<ServiceChargeRow>(
      `select id, service_type, product_type, category_code, design_code, size_code, service_code, service_name,
          unit_code, price_thb::float8 price_thb, is_active, updated_by,
          to_char(updated_at,'DD-MM-YYYY HH24:MI') updated_at
        from ods_service_charge_map
       order by product_type nulls first, category_code nulls first, design_code nulls first, size_code nulls first, id`,
    )
  ).rows;
}
