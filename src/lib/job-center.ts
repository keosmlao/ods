import { query } from "@/lib/db";
import { centerHoldMessage, type JobCenterState } from "@/lib/job-center-shared";

/**
 * **ບ່ອນຮັບເຄື່ອງ ↔ ບ່ອນທີ່ເຄື່ອງຢູ່** ຂອງໃບງານສ້ອມ — ອ່ານຈາກຖານ.
 * ກົດເກນຢູ່ lib/job-center-shared (pure ⇒ ທົດສອບໄດ້).
 */
export async function jobCenterState(jobCode: string): Promise<JobCenterState | null> {
  const rows = await query<{
    intake_at: string | null;
    now_at: string | null;
    transfer_to: string | null;
  }>(
    /**
     * ⚠️ ຢ່າໃຊ້ຊື່ alias `current` — ເປັນ **ຄຳສະຫງວນ** ຂອງ Postgres
     * ⇒ `... service_center,'') current` = syntax error (ພົບຈິງ 31-07-2026 ໜ້າໃບງານລົ້ມ).
     */
    `select nullif(a.intake_center,'') intake_at, nullif(a.service_center,'') now_at,
        (select jt.to_center from ods_job_transfer jt
          where jt.job_code = a.code and jt.received_at is null
          order by jt.id desc limit 1) transfer_to
       from tb_product a where a.code = $1 limit 1`,
    [jobCode],
  );
  const row = rows.rows[0];
  if (!row) return null;
  return {
    intake: row.intake_at,
    current: row.now_at,
    transferPending: Boolean(row.transfer_to),
    transferTo: row.transfer_to,
  };
}

/**
 * ຂໍ້ຄວາມຫ້າມສົ່ງເຄື່ອງຄືນລູກຄ້າ — null ຄື ຜ່ານ.
 * ເອີ້ນຢູ່**ທຸກທາງອອກ**ທີ່ປະທັບ return_complete ຄືກັນກັບ loanerBlock (lib/loaner).
 */
export async function centerBlock(jobCode: string): Promise<string | null> {
  try {
    const state = await jobCenterState(jobCode);
    return state ? centerHoldMessage(state) : null;
  } catch (error) {
    // ຖາມຖານບໍ່ໄດ້ ⇒ ຢ່າຂວາງການສົ່ງຄືນ (ດ່ານນີ້ເປັນຕົວຊ່ວຍ ບໍ່ແມ່ນຄວາມປອດໄພ)
    console.error("centerBlock failed", error);
    return null;
  }
}

/** ຄິວ "ລໍຮັບໂອນ" — ການໂອນທີ່ປາຍທາງຍັງບໍ່ກົດຮັບ (ໜ້າ /service/transfers + badge) */
export type PendingTransfer = {
  id: number;
  job_code: string;
  from_center: string | null;
  to_center: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  days: number;
  product: string | null;
  sn: string | null;
  cust_name: string | null;
  tel: string | null;
};

export async function pendingTransfers(): Promise<PendingTransfer[]> {
  const rows = await query<PendingTransfer>(
    `select jt.id, jt.job_code, jt.from_center, jt.to_center, jt.reason, jt.created_by,
        to_char(jt.created_at,'DD-MM-YYYY HH24:MI') created_at,
        greatest(0, extract(day from localtimestamp - jt.created_at))::int days,
        p.name_1 product, p.sn, c.name_1 cust_name, c.tel
       from ods_job_transfer jt
       left join tb_product p on p.code = jt.job_code
       left join ar_customer c on c.code = p.cust_code
      where jt.received_at is null
      order by jt.created_at`,
  );
  return rows.rows;
}
