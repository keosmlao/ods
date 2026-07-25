"use server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { STAGE_LABEL_SQL } from "@/lib/stage";

/**
 * **ປະຫວັດການສ້ອມຂອງເຄື່ອງໜ່ວຍດຽວກັນ** — ໃຫ້ໜ້າເປີດງານໃໝ່ດຶງມາສະແດງ.
 *
 * ຈັບຄູ່ດ້ວຍ **SN** (serial) ຄືກັບ lib/repeat — ຖ້າ SN ຖືກສ້ອມມາກ່ອນ ຊ່າງ/CS ຄວນເຫັນວ່າ
 * ເຄື່ອງນີ້ເຄີຍເປັນຫຍັງ · ໃຜສ້ອມ · ຜົນເປັນແນວໃດ (ຊ່ວຍວິເຄາະ ແລະ ກັນສ້ອມຊ້ຳບັນຫາເກົ່າ).
 */

export type RepairHistoryItem = {
  code: string;
  received: string | null;
  returned: string | null;
  symptom: string | null;
  diagnosis: string | null;
  warranty: string | null;
  tech: string | null;
  stage: string | null;
};

/** SN ທີ່ຖືວ່າ "ຈິງ" (ຄືກັບ lib/repeat.realSn) — ສັ້ນ/ຄ່າຫຼອກ ບໍ່ຄົ້ນ */
const REAL_SN = `length(trim(coalesce($1,''))) >= 4
  and upper(trim($1)) not in ('-','NONE','N/A','NA','ບໍ່ມີ','0000')`;

export async function repairHistoryBySn(sn: string): Promise<RepairHistoryItem[]> {
  const session = await getSession();
  if (!session) return [];
  const value = sn.trim();
  if (value.length < 4) return [];

  return (
    await query<RepairHistoryItem>(
      `select a.code,
          to_char(a.time_register,'DD-MM-YYYY') as received,
          to_char(a.return_complete,'DD-MM-YYYY') as returned,
          a.issue as symptom,
          a.issue_2 as diagnosis,
          a.warrunty as warranty,
          nullif(a.emp_code,'') as tech,
          (${STAGE_LABEL_SQL}) as stage
        from tb_product a
       where replace(upper(trim(a.sn)),' ','') = replace(upper(trim($1)),' ','')
         and ${REAL_SN}
       order by a.time_register desc
       limit 10`,
      [value],
    )
  ).rows;
}
