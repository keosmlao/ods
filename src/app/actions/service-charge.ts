"use server";
import { getSession } from "@/lib/auth";
import { db, queryOdg } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ຕັ້ງຄ່າ **ປະເພດເຄື່ອງ → ລາຍການຄ່າບໍລິການ (9702xx)** ທີ່ໜ້າໃບຮັບເງິນເອົາໄປຕື່ມໃຫ້ອັດຕະໂນມັດ.
 * **ຜູ້ຈັດການເທົ່ານັ້ນ** — ຄືກັບອັດຕາຄ່າຄອມ (actions/service-rate): ນີ້ຄືເລື່ອງເງິນ.
 */
export type ChargeState = { error?: string; ok?: string };

async function requireManager(): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session ໝົດອາຍຸ" };
  if (roleOf(session) !== "manager") return { ok: false, error: "ຜູ້ຈັດການເທົ່ານັ້ນທີ່ຕັ້ງຄ່າໄດ້" };
  return { ok: true, username: session.username };
}

/** ລາຍການຄ່າບໍລິການ 9702xx ຈາກ ERP — ໃຫ້ຟອມເລືອກ (ບໍ່ພິມລະຫັດເອງ ⇒ ບໍ່ພິມຜິດ) */
export async function serviceItemOptions(): Promise<{ code: string; name: string; unit: string | null }[]> {
  if (!(await getSession())) return [];
  try {
    return (
      await queryOdg<{ code: string; name: string; unit: string | null }>(
        `select code, coalesce(nullif(name_1,''), code) name, null::text unit
           from ic_inventory where code like '9702%' order by code`,
      )
    ).rows;
  } catch (error) {
    console.error("serviceItemOptions failed", error);
    return [];
  }
}

/**
 * **ປະເພດເຄື່ອງທີ່ໃຊ້ຈິງ** ໃນໃບຮັບເຄື່ອງ (tb_product.p_type) ພ້ອມຊື່ ແລະ ຈຳນວນງານ.
 *
 * ⚠️ ບໍ່ດຶງຈາກຕາຕະລາງ master ອັນໃດອັນໜຶ່ງ ເພາະ p_type **ປົນ 2 ຊຸດລະຫັດ**:
 * ຊຸດເກົ່າ `tb_type` (01 ປ້ຳນ້ຳ · 02 ເຄື່ອງໃຊ້ໄຟຟ້າ · 03 ແອ — ຍັງເປັນສ່ວນຫຼາຍ)
 * ແລະ ຊຸດ ERP `ic_category` (008/011/022/032 — ຟອມຮັບເຄື່ອງໃໝ່ຂຽນ).
 * ⇒ ດຶງ **ຄ່າທີ່ມີຢູ່ໃນຂໍ້ມູນຈິງ** ແລ້ວຫາຊື່ໃຫ້ ⇒ ຕັ້ງຄ່າແລ້ວຈັບຄູ່ໄດ້ແນ່ນອນ.
 */
export async function productTypeOptions(): Promise<{ code: string; name: string; jobs: number }[]> {
  if (!(await getSession())) return [];
  if (!db) return [];
  const used = (
    await db.query<{ code: string; name: string | null; jobs: number }>(
      `select p.p_type code,
          coalesce(t.name_1, c.name_1) name,
          count(*)::int jobs
        from tb_product p
        left join tb_type t on t.code = p.p_type
        left join tb_category c on c.code = p.p_type
       where coalesce(p.p_type,'') <> '' and p.time_register >= current_date - 730
       group by p.p_type, t.name_1, c.name_1
       order by count(*) desc`,
    )
  ).rows;
  if (used.length === 0) return [];

  // ຊື່ທີ່ຫາຢູ່ ODS ບໍ່ພົບ ⇒ ລອງ ic_category ຂອງ ERP (ລະຫັດຊຸດໃໝ່)
  const missing = used.filter((row) => !row.name).map((row) => row.code);
  const erpNames = new Map<string, string>();
  if (missing.length > 0) {
    try {
      const rows = await queryOdg<{ code: string; name_1: string | null }>(
        `select code, name_1 from ic_category where code = any($1::text[])`,
        [missing],
      );
      for (const row of rows.rows) if (row.name_1) erpNames.set(row.code, row.name_1);
    } catch (error) {
      console.error("productTypeOptions: ERP category lookup failed", error);
    }
  }
  return used.map((row) => ({
    code: row.code,
    name: row.name ?? erpNames.get(row.code) ?? row.code,
    jobs: row.jobs,
  }));
}

const text = (form: FormData, key: string) => (form.get(key) ?? "").toString().trim();

export async function saveServiceCharge(_: ChargeState, formData: FormData): Promise<ChargeState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ຖານຂໍ້ມູນຍັງບໍ່ພ້ອມ" };

  const serviceCode = text(formData, "service_code");
  if (!serviceCode) return { error: "ຕ້ອງເລືອກລາຍການຄ່າບໍລິການ" };
  const price = Number(text(formData, "price_thb") || "0");
  if (!Number.isFinite(price) || price < 0) return { error: "ລາຄາບໍ່ຖືກຕ້ອງ" };

  const serviceName = text(formData, "service_name");
  const productType = text(formData, "product_type");
  const category = text(formData, "category_code");
  const design = text(formData, "design_code");
  const size = text(formData, "size_code");
  const serviceType = text(formData, "service_type");

  /**
   * ກັນ**ແຖວຊ້ຳມິຕິດຽວກັນ**: ສອງແຖວທີ່ມິຕິຄືກັນ ຄະແນນຈັບຄູ່ເທົ່າກັນ ⇒ ຜົນຂຶ້ນກັບ id
   * (ຄົນຕັ້ງຄ່າບໍ່ຮູ້ວ່າອັນໃດຈະຊະນະ). ມີຢູ່ແລ້ວ ⇒ **ທັບອັນເກົ່າ** ບໍ່ແມ່ນເພີ່ມແຖວໃໝ່.
   */
  const existing = await db.query<{ id: number }>(
    `select id from ods_service_charge_map
      where coalesce(service_type,'')=$1 and coalesce(category_code,'')=$2
        and coalesce(design_code,'')=$3 and coalesce(size_code,'')=$4
        and coalesce(product_type,'')=$5
      limit 1`,
    [serviceType, category, design, size, productType],
  );
  if (existing.rows[0]) {
    await db.query(
      `update ods_service_charge_map
          set service_code=$2, service_name=nullif($3,''), price_thb=$4, is_active=true,
              updated_by=$5, updated_at=localtimestamp
        where id=$1`,
      [existing.rows[0].id, serviceCode, serviceName, price, guard.username],
    );
  } else {
    await db.query(
      `insert into ods_service_charge_map(service_type, category_code, design_code, size_code,
         product_type, service_code, service_name, price_thb, updated_by)
       values (nullif($1,''), nullif($2,''), nullif($3,''), nullif($4,''), nullif($5,''), $6, nullif($7,''), $8, $9)`,
      [serviceType, category, design, size, productType, serviceCode, serviceName, price, guard.username],
    );
  }
  revalidatePath("/manage/service-charges");
  return { ok: existing.rows[0] ? "ອັບເດດແລ້ວ (ມິຕິນີ້ມີຢູ່ກ່ອນ)" : "ບັນທຶກແລ້ວ" };
}

export async function deleteServiceCharge(formData: FormData): Promise<void> {
  const guard = await requireManager();
  if (!guard.ok || !db) return;
  const id = Number(text(formData, "id"));
  if (!Number.isFinite(id)) return;
  await db.query(`delete from ods_service_charge_map where id=$1`, [id]);
  revalidatePath("/manage/service-charges");
}

/* ───────────────────── ຕັ້ງຄ່າ COB (ເອກະສານບັນຊີຂອງໃບເຄມ CLM-C) ───────────────────── */

/**
 * ລະຫັດ**ບັນຊີ**ທີ່ COB ຈະລົງ + ສາຂາ — ເກັບໃນ `ods_setting`.
 *
 * ⚠️ ລະບົບ**ບໍ່ເດົາ**ລະຫັດບັນຊີໃຫ້: ແຖວຂອງ COB ຄືລາຍການບັນຊີແທ້ໆ (ເຊັ່ນ 5020103
 * "ລາຍຈ່າຍ ຄ່າຄອມມິດຊັນ") ⇒ ໃສ່ຜິດ = ງົບການເງິນຜິດ. ຍັງບໍ່ຕັ້ງ ⇒ ບໍ່ສ້າງ COB
 * (ໃບເຄມຍັງອອກປົກກະຕິ — ເບິ່ງ lib/erp-cob).
 */
export async function saveCobConfig(_: ChargeState, formData: FormData): Promise<ChargeState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ຖານຂໍ້ມູນຍັງບໍ່ພ້ອມ" };

  const values: Record<string, string> = {
    cob_account_code: text(formData, "cob_account_code"),
    cob_account_name: text(formData, "cob_account_name"),
    cob_branch_code: text(formData, "cob_branch_code") || "01",
  };
  for (const [key, value] of Object.entries(values)) {
    await db.query(
      `insert into ods_setting(key, value, updated_by, updated_at)
       values($1,$2,$3, localtimestamp(0))
       on conflict (key) do update
          set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      [key, value, guard.username],
    );
  }
  revalidatePath("/manage/service-charges");
  return { ok: "ບັນທຶກແລ້ວ — ໃບເຄມ CLM-C ຈະຕັ້ງໜີ້ຕ້ອງຮັບໃຫ້ເອງ" };
}
