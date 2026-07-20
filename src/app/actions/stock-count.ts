"use server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE } from "@/lib/roles";
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
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  const c = code.trim();
  if (!c) return { error: "ບໍ່ພົບ code" };
  // ບັນທຶກ ຂັ້ນ (stage) ຕອນນັບພົບ — snapshot ຈາກ tb_product ຂະນະນັ້ນ
  await query(
    `insert into ods_stock_count (job_code, counted_at, counted_by, stage_at)
       select a.code, now(), $2, (${STAGE_SQL})::int
         from tb_product a where a.code = $1
     on conflict (job_code) do update
       set counted_at = now(), counted_by = excluded.counted_by, stage_at = excluded.stage_at`,
    [c, guard.session.username],
  );
  return {};
}

export async function unmarkCounted(code: string): Promise<CountState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`delete from ods_stock_count where job_code = $1`, [code.trim()]);
  return {};
}

/**
 * ຍິງ/ພິມ code ຫຼື SN → ຄົ້ນຫາ job **ໃນ tb_product ທັງໝົດ** (ບໍ່ຈຳກັດ pending),
 * ໝາຍ "ນັບແລ້ວ" ພ້ອມ stage_at, ແລ້ວຄືນລາຍລະອຽດໃຫ້ຝັ່ງ client ສະແດງໃນລາຍການພົບ.
 */
export async function countByScan(input: string): Promise<{ item?: CountedItem; dupe?: boolean; error?: string }> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
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

  const dupe = ((await query(`select 1 from ods_stock_count where job_code = $1`, [job.code])).rowCount ?? 0) > 0;
  await query(
    `insert into ods_stock_count (job_code, counted_at, counted_by, stage_at)
       values ($1, now(), $2, $3)
     on conflict (job_code) do update
       set counted_at = now(), counted_by = excluded.counted_by, stage_at = excluded.stage_at`,
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

/** ລ້າງການນັບທັງໝົດ — ເລີ່ມກວດນັບຮອບໃໝ່ (ອອກລາຍງານກ່ອນລ້າງ) */
export async function resetStockCount(): Promise<CountState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`delete from ods_stock_count`);
  revalidatePath("/service/stock-count");
  revalidatePath("/reports/stock-count");
  return {};
}
