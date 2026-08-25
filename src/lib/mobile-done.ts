import { query } from "@/lib/db";
import { employeeCode } from "@/lib/erp-employee";
import type { Session } from "@/lib/auth";

/**
 * **ວຽກທີ່ຊ່າງຈົບໄປແລ້ວ** (30 ມື້ຫຼ້າສຸດ) — ສ້ອມ · ຕິດຕັ້ງ · ລ້າງແອ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ລາຍການວຽກຂອງແອັບກອງດ້ວຍ "ວຽກທີ່ຍັງເປີດ" ⇒ ໃບທີ່ຈົບແລ້ວ **ຫາຍໄປຈາກຈໍທັນທີ**.
 * ພໍລູກຄ້າ/ຫົວໜ້າຖາມວ່າ "ໃບນັ້ນເຮັດແລ້ວບໍ · ເຮັດມື້ໃດ" ຊ່າງພິສູດເອງບໍ່ໄດ້
 * ຕ້ອງໄປລົບກວນ CS ໃຫ້ເປີດເວັບເບິ່ງໃຫ້.
 *
 * ອ່ານຢ່າງດຽວ — ບໍ່ມີປຸ່ມ, ບໍ່ປ່ຽນຂັ້ນຫຍັງ.
 */
export interface DoneJob {
  workflow: "repair" | "install" | "maintenance";
  code: string;
  customer: string | null;
  product: string | null;
  /** ວັນທີ່ຈົບ (DD-MM-YYYY HH24:MI) */
  finished_at: string | null;
  /** ຈົບເອງ ຫຼື ເປັນຊ່າງຮ່ວມ */
  lead: boolean;
}

const DAYS = 30;

export async function myDoneJobs(session: Session): Promise<DoneJob[]> {
  if (!query) return [];
  const employee = await employeeCode(session.username);
  const keys = [...new Set([employee, session.username].filter(Boolean))];
  if (keys.length === 0) return [];

  /*
    ໃຊ້ **ວັນທີ່ຈົບຂອງແຕ່ລະສາຍງານ** ເປັນຕົວກອງ ບໍ່ແມ່ນຂັ້ນ — ຂັ້ນຂອງໃບທີ່ຈົບແລ້ວ
    ຍັງຂະຫຍັບໄດ້ອີກ (QC ສົ່ງກັບ · ປິດບິນ) ແຕ່ "ຊ່າງເຮັດແລ້ວ" ບໍ່ປ່ຽນ.
    ຊ່າງຮ່ວມ (ods_job_tech) ເຫັນນຳ — ລາວກໍ່ໄປເຮັດຄືກັນ.
  */
  const rows = await query<DoneJob>(
    `select 'repair' as workflow, a.code,
        b.name_1 as customer, a.name_1 as product,
        to_char(a.time_finish_repair,'DD-MM-YYYY HH24:MI') as finished_at,
        (a.emp_code = any($1)) as lead
       from tb_product a
       left join ar_customer b on b.code = a.cust_code
      where a.time_finish_repair is not null
        and a.time_finish_repair >= localtimestamp - interval '${DAYS} days'
        and (a.emp_code = any($1)
             or exists (select 1 from ods_job_tech t
                         where t.workflow='repair' and t.job_code=a.code and t.tech_code = any($1)))
     union all
     select 'install', a.code, b.name_1, a.name_1,
        to_char(a.finish_install,'DD-MM-YYYY HH24:MI'),
        (a.tech_code = any($1))
       from ods_tb_install a
       left join ar_customer b on b.code = a.cust_code
      where a.finish_install is not null
        and a.finish_install >= localtimestamp - interval '${DAYS} days'
        and (a.tech_code = any($1)
             or exists (select 1 from ods_job_tech t
                         where t.workflow='install' and t.job_code=a.code and t.tech_code = any($1)))
     union all
     -- ລ້າງແອ: ຊ່າງຢູ່ຖັນ emp_code · ລູກຄ້າ walk-in ຢູ່ cust_name · ບໍ່ມີຊື່ສິນຄ້າ
     select 'maintenance', a.code,
        coalesce(b.name_1, nullif(a.cust_name,'')), 'ລ້າງແອ',
        to_char(a.finish_clean,'DD-MM-YYYY HH24:MI'),
        (a.emp_code = any($1))
       from ods_tb_maintenance a
       left join ar_customer b on b.code = a.cust_code
      where a.finish_clean is not null
        and a.finish_clean >= localtimestamp - interval '${DAYS} days'
        and (a.emp_code = any($1)
             or exists (select 1 from ods_job_tech t
                         where t.workflow='maintenance' and t.job_code=a.code and t.tech_code = any($1)))
     order by finished_at desc nulls last
     limit 200`,
    [keys],
  );
  return rows.rows;
}
