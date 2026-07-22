"use server";
import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { STOCK_COUNT_SIDE } from "@/lib/roles";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { stageLabel, STAGE_SQL } from "@/lib/stage";
import type { CountedItem } from "@/lib/stock-count";
import { revalidatePath } from "next/cache";

/**
 * ກວດນັບສະຕັອກ — ບັນທຶກ "ນັບແລ້ວ" ລົງ DB (ຕາຕະລາງ ods_stock_count) ແທນ localStorage
 * ⇒ ແບ່ງກັນຫຼາຍຄົນ/ເຄື່ອງ + ດຶງໄປເຮັດລາຍງານໄດ້. ໝາຍ/ຍົກເລີກ ຕົວຕໍ່ຕົວ (optimistic ຝັ່ງ client).
 */
export type CountState = { error?: string };

export async function markCounted(code: string): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  const c = code.trim();
  if (!c) return { error: "ບໍ່ພົບ code" };
  // ບັນທຶກ ຂັ້ນ (stage) ຕອນນັບພົບ — snapshot ຈາກ tb_product ຂະນະນັ້ນ
  await query(
    `insert into ods_stock_count (job_code, counted_at, counted_by, stage_at, found)
       select a.code, now(), $2, (${STAGE_SQL})::int, true
         from tb_product a where a.code = $1
     on conflict (job_code) do update
       set counted_at = now(), counted_by = excluded.counted_by, stage_at = excluded.stage_at, found = true`,
    [c, guard.session.username],
  );
  revalidatePath("/reports/stock-count");
  return {};
}

/** ນຳ job "ນັບແລ້ວ" ກັບຄືນ → ຍັງບໍ່ນັບ (ລຶບ record ໝາຍ). job ຍັງຢູ່ pending ຄືເກົ່າ. */
export async function unmarkCounted(code: string): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`delete from ods_stock_count where job_code = $1`, [code.trim()]);
  revalidatePath("/reports/stock-count");
  return {};
}

/** ເຊັກແລ້ວ = ຢືນຢັນຊ້ຳ (ຂັ້ນ 2 ຫຼັງນັບພົບ). ໝາຍໄດ້ສະເພາະ record ທີ່ນັບພົບ (found). */
export async function markChecked(code: string): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  const c = code.trim();
  if (!c) return { error: "ບໍ່ພົບ code" };
  const r = await query(
    `update ods_stock_count set checked_at = now(), checked_by = $2 where job_code = $1 and found`,
    [c, guard.session.username],
  );
  if (!r.rowCount) return { error: "ຕ້ອງນັບພົບກ່ອນຈຶ່ງເຊັກໄດ້" };
  revalidatePath("/reports/stock-count");
  return {};
}

/** ຍົກເລີກ ເຊັກແລ້ວ → ກັບເປັນ ນັບພົບ (ຍັງບໍ່ໄດ້ເຊັກ) */
export async function unmarkChecked(code: string): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`update ods_stock_count set checked_at = null, checked_by = null where job_code = $1`, [code.trim()]);
  revalidatePath("/reports/stock-count");
  return {};
}

/**
 * ຍິງ/ພິມ code ຫຼື SN → ຄົ້ນຫາ job **ໃນ tb_product ທັງໝົດ** (ບໍ່ຈຳກັດ pending),
 * ໝາຍ "ນັບແລ້ວ" ພ້ອມ stage_at, ແລ້ວຄືນລາຍລະອຽດໃຫ້ຝັ່ງ client ສະແດງໃນລາຍການພົບ.
 */
export async function countByScan(input: string): Promise<{ item?: CountedItem; dupe?: boolean; error?: string }> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  const q = input.trim();
  if (!q) return { error: "empty" };

  const job = (
    await query<{
      code: string;
      product: string | null;
      sn: string | null;
      brand: string | null;
      customer: string | null;
      issue: string | null;
      stage: number;
      service_type: string | null;
      returned: boolean;
    }>(
      `select a.code, a.name_1 product, a.sn, a.p_brand brand, c.name_1 customer,
          nullif(trim(coalesce(a.issue,'')),'') issue,
          (${STAGE_SQL})::int stage, a.service_type, (a.return_complete is not null) returned
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.code = $1 or upper(a.sn) = upper($1)
       order by (a.code = $1) desc
       limit 1`,
      [q],
    )
  ).rows[0];
  if (!job) return { error: "notfound" };

  const dupe = ((await query(`select 1 from ods_stock_count where job_code = $1 and found`, [job.code])).rowCount ?? 0) > 0;
  // ຍິງພົບ ⇒ found=true (ຖ້າເຄີຍໝາຍ "ຫາຍ" ໄວ້ ກໍ່ພິກກັບເປັນພົບ)
  await query(
    `insert into ods_stock_count (job_code, counted_at, counted_by, stage_at, found)
       values ($1, now(), $2, $3, true)
     on conflict (job_code) do update
       set counted_at = now(), counted_by = excluded.counted_by, stage_at = excluded.stage_at, found = true`,
    [job.code, guard.session.username, job.stage],
  );

  const label = stageLabel(job.stage, job.service_type);
  return {
    dupe,
    item: {
      code: job.code,
      product: job.product,
      sn: job.sn,
      brand: job.brand,
      customer: job.customer,
      issue: job.issue,
      stage_label: label,
      service_type: job.service_type,
      service_type_label: SERVICE_TYPE_LABEL[job.service_type ?? ""] ?? (job.service_type ?? "-"),
      counted_at: null,
      counted_by: guard.session.username,
      counted_stage_label: label,
      returned: job.returned,
    },
  };
}

/**
 * ໝາຍ job ວ່າ **ນັບບໍ່ພົບ (ຫາຍ)** ຕອນກວດນັບ — ປິດອອກຈາກຄິວກວດນັບ ແຕ່ **ຍ້ອນຄືນໄດ້**
 * (ບໍ່ລຶບຂໍ້ມູນ · ບໍ່ແຕະ ERP · ພຽງແຕ່ບັນທຶກ found=false ໃນ ods_stock_count).
 */
export async function markMissing(code: string): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  const c = code.trim();
  if (!c) return { error: "ບໍ່ພົບ code" };
  const stage = (await query<{ stage: number }>(`select (${STAGE_SQL})::int stage from tb_product a where a.code = $1`, [c])).rows[0];
  if (!stage) return { error: "ບໍ່ພົບ job ນີ້" };
  await query(
    `insert into ods_stock_count (job_code, counted_at, counted_by, stage_at, found)
       values ($1, now(), $2, $3, false)
     on conflict (job_code) do update
       set counted_at = now(), counted_by = excluded.counted_by, stage_at = excluded.stage_at, found = false`,
    [c, guard.session.username, stage.stage],
  );
  await logChange("tb_product", c, `ໝາຍ "ນັບບໍ່ພົບ (ຫາຍ)" ຕອນກວດນັບ ໂດຍ ${guard.session.username}`, { roles: ["manager"] });
  revalidatePath("/reports/stock-count");
  revalidatePath("/reports/stock-count/missing");
  revalidatePath("/service");
  return {};
}

/** ນຳ job ກັບຄືນ ຈາກ "ນັບບໍ່ພົບ" → ກັບໄປເປັນ "ຍັງບໍ່ນັບ" (ລຶບ record ໝາຍ) */
export async function restoreMissing(code: string): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  const c = code.trim();
  await query(`delete from ods_stock_count where job_code = $1 and found = false`, [c]);
  await logChange("tb_product", c, `ນຳ job ກັບຄືນ ຈາກ "ນັບບໍ່ພົບ" ໂດຍ ${guard.session.username}`, { roles: ["manager"] });
  revalidatePath("/reports/stock-count");
  revalidatePath("/reports/stock-count/missing");
  revalidatePath("/service");
  return {};
}

/**
 * ນຳ **"ນັບແລ້ວ" ທັງໝົດ** (found=true, ລວມທີ່ເຊັກແລ້ວ) ກັບເປັນ "ຍັງບໍ່ນັບ" (pending) —
 * ລຶບສະເພາະ record ນັບພົບ, **ຮັກສາ "ນັບບໍ່ພົບ" (found=false) ໄວ້**. ໃຊ້ເລີ່ມນັບຮອບໃໝ່.
 */
export async function resetCounted(): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`delete from ods_stock_count where found = true`);
  await logChange("tb_product", "-", `ນຳ "ນັບແລ້ວ" ທັງໝົດ ກັບເປັນ ຍັງບໍ່ນັບ ໂດຍ ${guard.session.username}`, { roles: ["manager"] });
  revalidatePath("/service/stock-count");
  revalidatePath("/reports/stock-count");
  revalidatePath("/service");
  return {};
}

/** ລ້າງການນັບທັງໝົດ — ເລີ່ມກວດນັບຮອບໃໝ່ (ອອກລາຍງານກ່ອນລ້າງ) */
export async function resetStockCount(): Promise<CountState> {
  const guard = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`delete from ods_stock_count`);
  revalidatePath("/service/stock-count");
  revalidatePath("/reports/stock-count");
  revalidatePath("/reports/stock-count/missing");
  revalidatePath("/service");
  return {};
}
