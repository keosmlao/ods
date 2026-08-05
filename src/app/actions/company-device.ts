"use server";
import { getSession } from "@/lib/auth";
import { logChange } from "@/lib/chatter-log";
import { db, query } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * **ຮັບເຄື່ອງເກົ່າເຂົ້າເປັນ "ເຄສສ້ອມເຄື່ອງບໍລິສັດ"** — ຫຼັງຊ່າງແນະນຳໃຫ້ລູກຄ້າປ່ຽນເຄື່ອງ.
 *
 * ── ເລື່ອງລາວ ──
 * ຊ່າງກວດແລ້ວແນະນຳໃຫ້ປ່ຽນເຄື່ອງ (check_outcome='replace_advice') → **ຝ່າຍຂາຍ**
 * ເປັນຜູ້ຕັດສິນ ແລະ ປ່ຽນເຄື່ອງໃໝ່ໃຫ້ລູກຄ້າ → ເຄື່ອງເກົ່າຕົກມາເປັນຂອງບໍລິສັດ ແລະ
 * ຕ້ອງເອົາມາສ້ອມເປັນເຄື່ອງບໍລິສັດ.
 *
 * ແຕ່ກ່ອນຕ້ອງເປີດໃບໃໝ່ດ້ວຍມື ພ້ອມກ໋ອບ ຊື່ເຄື່ອງ/SN/model/brand ເອງ ⇒ ພິມຜິດໄດ້,
 * ບໍ່ມີການເຊື່ອມກັບໃບເດີມ (ຕິດຕາມກັບບໍ່ໄດ້ວ່າມາຈາກລູກຄ້າຄົນໃດ) ແລະ ລູກຄ້າ
 * "ເຄື່ອງບໍລິສັດ" ຖືກສ້າງຊ້ຳຈົນມີຫຼາຍສິບລະຫັດຊື່ດຽວກັນ.
 *
 * ບ່ອນນີ້ເຮັດໃຫ້ຄົບໃນກົດດຽວ: ກ໋ອບຂໍ້ມູນເຄື່ອງ · ຜູກກັບໃບເດີມ · ໃຊ້ລູກຄ້າມາດຕະຖານອັນດຽວ.
 */

/** ຊື່ລູກຄ້າມາດຕະຖານສຳລັບເຄື່ອງຂອງບໍລິສັດເອງ */
const COMPANY_CUSTOMER_NAME = "ເຄື່ອງບໍລິສັດ";

export type CompanyDeviceState = { ok?: string; error?: string; code?: string };

/**
 * ລູກຄ້າ "ເຄື່ອງບໍລິສັດ" **ອັນດຽວທີ່ເປັນທາງການ** — ເອົາລະຫັດ**ນ້ອຍສຸດ**ທີ່ຊື່ຕົງ.
 *
 * ເປັນຫຍັງບໍ່ເກັບເປັນຄ່າຕັ້ງ: ຖານມີແຖວຊື່ນີ້ຢູ່ຫຼາຍສິບແຖວແລ້ວ (ສ້າງຊ້ຳມາດົນ) ⇒ ຖ້າ
 * ໃຫ້ຄົນເລືອກເອງກໍ່ຈະເລືອກຄົນລະອັນຄືເກົ່າ. ກົດ "ນ້ອຍສຸດຊະນະ" ເປັນຄ່າຄົງທີ່ໃນຕົວມັນເອງ
 * ⇒ ທຸກເທື່ອໄດ້ອັນດຽວກັນ ແລະ ຂໍ້ມູນໃໝ່ຈະ**ໄຫຼມາລວມຢູ່ແຖວດຽວ**ເອງ ໂດຍບໍ່ຕ້ອງຕັ້ງຄ່າ.
 */
async function companyCustomerCode(client: import("pg").PoolClient): Promise<string> {
  const found = await client.query<{ code: string }>(
    `select code from ar_customer where trim(name_1) = $1 and code ~ '^[0-9]+$'
      order by code::int limit 1`,
    [COMPANY_CUSTOMER_NAME],
  );
  if (found.rows[0]) return found.rows[0].code;

  const code = String(
    (await client.query<{ code: number }>(
      "select coalesce(max(code::int),0)+1 code from ar_customer where code ~ '^[0-9]+$'",
    )).rows[0].code,
  );
  // ar_type ຕາມແບບ resolveCustomer/createCustomer ຂອງ actions/service — 'walkin' = ສ້າງຢູ່ລະບົບນີ້
  // (ບໍ່ແມ່ນ 'erp' ເພາະບໍ່ໄດ້ sync ມາຈາກ ERP). ກິ່ງນີ້ແທບບໍ່ເຄີຍແລ່ນ — ຖານມີແຖວຊື່ນີ້ຢູ່ແລ້ວ.
  await client.query(`insert into ar_customer(code, name_1, ar_type) values($1, $2, 'walkin')`, [
    code,
    COMPANY_CUSTOMER_NAME,
  ]);
  return code;
}

/**
 * ຮັບໃບ `fromCode` ເຂົ້າເປັນເຄື່ອງບໍລິສັດ ⇒ ສ້າງໃບງານໃໝ່ທີ່ຜູກກັບມັນ.
 *
 * ດ່ານ:
 *   · ຕ້ອງເປັນຜົນກວດ 'replace_advice' (ແນະນຳປ່ຽນເຄື່ອງ) — ບໍ່ແມ່ນໃບໃດກໍ່ຮັບໄດ້
 *   · ຮັບໄດ້**ເທື່ອດຽວ** (ກວດ company_from_job ກ່ອນ) — ກັນກົດຊ້ຳໄດ້ 2 ໃບ
 */
export async function receiveAsCompanyDevice(fromCode: string): Promise<CompanyDeviceState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  // ຝ່າຍບໍລິການ/ຫົວໜ້າ/ຜູ້ຈັດການ — ຄົນທີ່ຮັບເຄື່ອງເຂົ້າສູນຢູ່ແລ້ວ
  if (!["manager", "headtechnical", "admin"].includes(roleOf(session))) {
    return { error: "ບໍ່ມີສິດຮັບເຄື່ອງເຂົ້າເປັນເຄື່ອງບໍລິສັດ" };
  }
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const client = await db.connect();
  let newCode = "";
  try {
    await client.query("begin");
    // ລັອກອັນດຽວກັບ createService — ກັນສອງຄົນຮັບພ້ອມກັນແລ້ວໄດ້ເລກໃບຊ້ຳ
    await client.query("select pg_advisory_xact_lock(734210)");

    const source = (
      await client.query<{
        code: string; name_1: string | null; sn: string | null; p_model: string | null;
        p_brand: string | null; p_access: string | null; issue: string | null; p_type: string | null;
        item_code: string | null; service_center: string | null; check_outcome: string | null;
      }>(
        `select code, name_1, sn, p_model, p_brand, p_access, issue, p_type, item_code,
            service_center, check_outcome
           from tb_product where code = $1 for update`,
        [fromCode],
      )
    ).rows[0];

    if (!source) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບໃບງານ" };
    }
    if (source.check_outcome !== "replace_advice") {
      await client.query("rollback");
      return { error: 'ຮັບໄດ້ສະເພາະໃບທີ່ຊ່າງບັນທຶກຜົນວ່າ "ແນະນຳປ່ຽນເຄື່ອງ"' };
    }

    const already = await client.query<{ code: string }>(
      "select code from tb_product where company_from_job = $1 limit 1",
      [fromCode],
    );
    if (already.rows[0]) {
      await client.query("rollback");
      return { error: `ໃບນີ້ຮັບເຂົ້າແລ້ວ — ເປັນໃບເລກ ${already.rows[0].code}` };
    }

    const custCode = await companyCustomerCode(client);
    newCode = String(
      (await client.query<{ code: number }>(
        "select coalesce(max(code::int),0)+1 code from tb_product where code~'^[0-9]+$'",
      )).rows[0].code,
    );

    /**
     * ⚠️ `warrunty = 'ຮັບປະກັນ'` **ຕັ້ງໃຈ** — ບໍ່ແມ່ນປະກັນຂອງລູກຄ້າ ແຕ່ເປັນການ
     * **ຂ້າມຂັ້ນສະເໜີລາຄາ**: STAGE_SQL ພາໃບ 'ໝົດຮັບປະກັນ' ໄປ "ລໍຖ້າສະເໜີລາຄາ"
     * ເຊິ່ງເຄື່ອງບໍລິສັດ**ບໍ່ມີລູກຄ້າໃຫ້ສະເໜີ** ⇒ ໃບຈະຄາຢູ່ຂັ້ນນັ້ນຖາວອນ.
     *
     * status=1 · time_register=ດຽວນີ້ ⇒ ໃບເຂົ້າຄິວ "ລໍຖ້າກວດເຊັກ" ຄືໃບຮັບເຄື່ອງທົ່ວໄປ.
     * service_type='CI' ບໍ່ຕັ້ງ (ໃຊ້ຄ່າຫວ່າງ) ເພາະ PS/IH ມີຄວາມໝາຍພິເສດໃນ STAGE_SQL.
     */
    await client.query(
      `insert into tb_product(code, name_1, sn, p_model, p_brand, p_access, p_type, item_code,
          issue, warrunty, cust_code, ap_code, status, time_register, user_regis,
          company_from_job, intake_center, service_center)
       values($1,$2,$3,$4,$5,$6,$7,nullif($8,''),
          $9,'ຮັບປະກັນ',$10,$10,1,localtimestamp(0),$11,
          $12,nullif($13,''),nullif($13,''))`,
      [
        newCode, source.name_1, source.sn, source.p_model, source.p_brand, source.p_access,
        source.p_type, source.item_code ?? "",
        `ຮັບເຂົ້າເປັນເຄື່ອງບໍລິສັດ ຈາກໃບ ${fromCode} (ແນະນຳໃຫ້ລູກຄ້າປ່ຽນເຄື່ອງ) · ອາການເດີມ: ${source.issue ?? "-"}`,
        custCode, session.username, fromCode, source.service_center ?? "",
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("receiveAsCompanyDevice failed", error);
    return { error: "ຮັບເຂົ້າບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ຜູກ 2 ທາງໃນປະຫວັດ — ເປີດໃບໃດກໍ່ເຫັນອີກໃບ
  await logChange(
    "tb_product",
    fromCode,
    `ຮັບເຄື່ອງເກົ່າເຂົ້າເປັນ **ເຄື່ອງບໍລິສັດ** — ເປີດໃບສ້ອມໃໝ່ເລກ ${newCode}`,
    { author: session.username, roles: ["manager", "headtechnical", "admin"] },
  );
  await logChange(
    "tb_product",
    newCode,
    `ເປີດຈາກໃບ ${fromCode} — ລູກຄ້າປ່ຽນເຄື່ອງໃໝ່ (ຝ່າຍຂາຍ), ເຄື່ອງເກົ່າເປັນຂອງບໍລິສັດ`,
    { author: session.username },
  );

  revalidatePath(`/service/${fromCode}`);
  revalidatePath(`/service/${newCode}`);
  revalidatePath("/checking");
  return { ok: `ຮັບເຂົ້າແລ້ວ — ໃບສ້ອມເຄື່ອງບໍລິສັດເລກ ${newCode}`, code: newCode };
}

/** ໃບເຄື່ອງບໍລິສັດທີ່ເກີດຈາກໃບນີ້ (null = ຍັງບໍ່ໄດ້ຮັບເຂົ້າ) — ໃຫ້ໜ້າໃບງານສະແດງປຸ່ມ/ລິ້ງ */
export async function companyDeviceOf(fromCode: string): Promise<string | null> {
  const rows = (
    await query<{ code: string }>("select code from tb_product where company_from_job = $1 limit 1", [fromCode])
  ).rows;
  return rows[0]?.code ?? null;
}
