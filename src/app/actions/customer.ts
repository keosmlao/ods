"use server";

import { db, query } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { MSG, type ActionState } from "@/components/manage/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * ລູກຄ້າ — ຖອດແບບຈາກ ods/customer.py
 * ແທນ: /customer, /addcust, /save_cust, /edit_custpage, /edit_cust, /del_cus
 *
 * ແກ້ບັກຈາກ ods:
 *  - edit_cust: UPDATE ໃສ່ຕາຕະລາງ `customer` (ບໍ່ມີຢູ່ຈິງ) ດ້ວຍຖັນ village_code/city_code/
 *    province_code/tax_id (ບໍ່ມີຢູ່ຈິງ) → ແກ້ໄຂລູກຄ້າບໍ່ເຄີຍບັນທຶກໄດ້ເລີຍ.
 *    ຕາຕະລາງຈິງແມ່ນ ar_customer ຖັນ address/city/provine ແລະ ບໍ່ມີ tax_id
 *  - del_cus: ລົບໄດ້ເລີຍ → ເພີ່ມການກວດ tb_product ແລະ ods_tb_install ກ່ອນລົບ
 *
 * ໝາຍເຫດ: ar_customer.provine ສະກົດຜິດແຕ່ເປັນຊື່ຖັນຈິງ — ຫ້າມແກ້
 */

const fail = (message: string): ActionState => ({ error: message });

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readForm(formData: FormData) {
  return {
    code: text(formData, "code"),
    name_1: text(formData, "name_1"),
    name_2: text(formData, "name_2"),
    address: text(formData, "address"),
    province: text(formData, "province"),
    city: text(formData, "city"),
    tel: text(formData, "tel"),
  };
}

/** ລະຫັດລູກຄ້າຕໍ່ໄປ — ຄື addcust() ແຕ່ກັນລະຫັດທີ່ບໍ່ແມ່ນຕົວເລກເຮັດໃຫ້ code::int ພັງ */
export async function nextCustomerCode() {
  const r = await query<{ code: string }>(
    "select coalesce(max(code::int),0)+1 code from ar_customer where code ~ '^[0-9]+$'",
  );
  return String(r.rows[0]?.code ?? 1);
}

export async function createCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requirePermission("/customers", "create", SERVICE_SIDE);
  if (!guard.ok) return fail(guard.error);

  const d = readForm(formData);
  if (!d.name_1) return fail(MSG.required);
  if (!db) return fail(MSG.failed);

  let code = d.code;
  const client = await db.connect();
  try {
    await client.query("begin");
    // ລັອກ ກັນສອງຄົນເພີ່ມລູກຄ້າພ້ອມກັນແລ້ວໄດ້ລະຫັດຊໍ້າ (ods ໃຊ້ max(code)+1 ເສີຍໆ)
    await client.query("select pg_advisory_xact_lock(734211)");

    const taken = await client.query<{ count: string }>("select count(*) from ar_customer where code=$1", [code]);
    if (!code || taken.rows[0]?.count !== "0") {
      const next = await client.query<{ code: string }>(
        "select coalesce(max(code::int),0)+1 code from ar_customer where code ~ '^[0-9]+$'",
      );
      code = String(next.rows[0]?.code ?? 1);
    }

    await client.query(
      "insert into ar_customer(code, name_1, name_2, address, city, provine, tel) values($1,$2,$3,$4,$5,$6,$7)",
      [code, d.name_1, d.name_2, d.address, d.city, d.province, d.tel],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("createCustomer failed", error);
    return fail(MSG.failed);
  } finally {
    client.release();
  }

  revalidatePath("/customers");
  redirect("/customers?ok=saved");
}

export async function updateCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requirePermission("/customers", "update", SERVICE_SIDE);
  if (!guard.ok) return fail(guard.error);

  const d = readForm(formData);
  if (!d.code || !d.name_1) return fail(MSG.required);

  try {
    await query(
      "update ar_customer set name_1=$1, name_2=$2, address=$3, city=$4, provine=$5, tel=$6 where code=$7",
      [d.name_1, d.name_2, d.address, d.city, d.province, d.tel, d.code],
    );
  } catch (error) {
    console.error("updateCustomer failed", error);
    return fail(MSG.failed);
  }

  revalidatePath("/customers");
  redirect("/customers?ok=edited");
}

export async function deleteCustomer(code: string): Promise<ActionState> {
  const guard = await requirePermission("/customers", "delete", SERVICE_SIDE);
  if (!guard.ok) return fail(guard.error);
  if (!code) return fail(MSG.failed);

  try {
    // ods ລົບໄດ້ເລີຍ — ເພີ່ມການກວດ: ຖ້າມີໃບຮັບເຄື່ອງ ຫຼື ງານຕິດຕັ້ງອ້າງອີງຢູ່ ຫ້າມລົບ
    const used = await query<{ count: string }>(
      `select count(*) from (
         select 1 from tb_product where cust_code = $1
         union all
         select 1 from ods_tb_install where cust_code = $1
       ) t`,
      [code],
    );
    if (used.rows[0]?.count !== "0") return fail(MSG.inUse);

    await query("delete from ar_customer where code=$1", [code]);
  } catch (error) {
    console.error("deleteCustomer failed", error);
    return fail(MSG.failed);
  }

  revalidatePath("/customers");
  return { ok: MSG.deleted };
}
