import { query } from "@/lib/db";
import type { PoolClient } from "pg";

/**
 * ── ຄຳຂໍປ່ຽນສະຖານະການຮັບປະກັນ ──
 *
 * "ໝົດຮັບປະກັນ" ຄືການຕັດສິນວ່າ **ລູກຄ້າຕ້ອງຈ່າຍ** ⇒ ບໍ່ຄວນຂຶ້ນກັບຊ່າງຄົນດຽວ.
 * ຊ່າງ **ຂໍ** ຕອນກວດເຊັກ (lib/tech-flow) → ຜູ້ຈັດການອະນຸມັດ (/approvals/warranty)
 * → ຈຶ່ງປ່ຽນຈິງ. ລະຫວ່າງລໍ ໃບຍັງເປັນ **ຮັບປະກັນ** ຄືເກົ່າ ແລະ **ໄປຕໍ່ບໍ່ໄດ້**.
 *
 * ⚠️ ຢ່າໃຫ້ tech-flow ຂຽນ `warrunty` ໂດຍກົງອີກ — ຖ້າຂຽນກ່ອນອະນຸມັດ ໃບຈະຕົກເຂົ້າ
 * ຂັ້ນ "ລໍຖ້າສະເໜີລາຄາ" ທັນທີ (STAGE_SQL ອ່ານ warrunty) ແລ້ວການອະນຸມັດກໍ່ບໍ່ມີຄວາມໝາຍ.
 */

export type WarrantyRequest = {
  id: number;
  job_code: string;
  from_warranty: string;
  to_warranty: string;
  reason: string;
  requested_by: string;
  requested_at: string | null;
  state: "pending" | "approved" | "rejected";
  decided_by: string | null;
  decided_at: string | null;
  decide_note: string | null;
};

/** ສ້າງຄຳຂໍພາຍໃນ transaction ຂອງການກວດເຊັກ (ຢູ່ client ດຽວກັນ) */
export async function createWarrantyRequest(
  client: PoolClient,
  input: { code: string; from: string; to: string; reason: string; by: string },
): Promise<void> {
  await client.query(
    `insert into ods_warranty_request(job_code, from_warranty, to_warranty, reason, requested_by)
     values($1,$2,$3,$4,$5)
     -- ຂໍຊ້ຳ (ຊ່າງກົດສອງເທື່ອ) ⇒ ຢຽບຄຳຂໍເກົ່າໄວ້ບໍ່ຕ້ອງລົ້ມທັງ transaction
     on conflict do nothing`,
    [input.code, input.from, input.to, input.reason, input.by],
  );
}

/** ຄຳຂໍທີ່ຍັງບໍ່ຕັດສິນ ຂອງໃບງານນີ້ — null = ບໍ່ມີ */
export async function pendingWarrantyRequest(jobCode: string): Promise<WarrantyRequest | null> {
  const rows = await query<WarrantyRequest>(
    `select id, job_code, from_warranty, to_warranty, reason, requested_by,
        to_char(requested_at,'DD-MM-YYYY HH24:MI') requested_at, state,
        decided_by, to_char(decided_at,'DD-MM-YYYY HH24:MI') decided_at, decide_note
       from ods_warranty_request where job_code = $1 and state = 'pending' limit 1`,
    [jobCode],
  );
  return rows.rows[0] ?? null;
}

/**
 * ດ່ານ: ຍັງລໍອະນຸມັດປ່ຽນປະກັນ ⇒ ເດີນງານຕໍ່ບໍ່ໄດ້ — null ຄື ຜ່ານ.
 * ເອີ້ນຢູ່ບ່ອນທີ່ **ຜູກກັບເງິນ**: ອອກໃບສະເໜີລາຄາ ແລະ ສົ່ງເຄື່ອງຄືນ/ປິດງານ
 * (ຫຼັກການດຽວກັບ loanerBlock · centerBlock).
 */
export async function warrantyBlock(jobCode: string): Promise<string | null> {
  const pending = await pendingWarrantyRequest(jobCode);
  if (!pending) return null;
  return `ຍັງລໍຜູ້ຈັດການອະນຸມັດການປ່ຽນເປັນ "${pending.to_warranty}" (ຂໍໂດຍ ${pending.requested_by}) — ອະນຸມັດກ່ອນ ຈຶ່ງເດີນງານຕໍ່ໄດ້`;
}

export type WarrantyQueueRow = WarrantyRequest & {
  product: string | null;
  customer: string | null;
  tech: string | null;
  /** ວັນທີ່ຄ້າງລໍການຕັດສິນ */
  age_days: number;
};

/** ຄິວອະນຸມັດ — `state` ວ່າງ = ລໍຕັດສິນ */
export async function warrantyQueue(state: "pending" | "approved" | "rejected" = "pending"): Promise<WarrantyQueueRow[]> {
  const rows = await query<WarrantyQueueRow>(
    `select r.id, r.job_code, r.from_warranty, r.to_warranty, r.reason, r.requested_by,
        to_char(r.requested_at,'DD-MM-YYYY HH24:MI') requested_at, r.state,
        r.decided_by, to_char(r.decided_at,'DD-MM-YYYY HH24:MI') decided_at, r.decide_note,
        a.name_1 product, c.name_1 customer, nullif(a.emp_code,'') tech,
        extract(day from localtimestamp - r.requested_at)::int age_days
       from ods_warranty_request r
       left join tb_product a on a.code = r.job_code
       left join ar_customer c on c.code = a.cust_code
      where r.state = $1
      order by r.requested_at`,
    [state],
  );
  return rows.rows;
}
