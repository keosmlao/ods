import type { Session } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  INSTALL_STAGE_LABEL_SQL,
  INSTALL_STAGE_SQL,
  INSTALL_ELAPSED_SQL,
  INSTALL_OPEN,
} from "@/lib/install-stage";
import { OPEN_JOBS, STAGE_ELAPSED_SQL, STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";

/**
 * "ວຽກຂອງຂ້ອຍ" ສຳລັບແອັບມືຖື — ລວມ ຕິດຕັ້ງ ແລະ ສ້ອມແປງ ໄວ້ໃນລາຍການດຽວ.
 *
 * ຊື່ຂັ້ນ ແລະ ເລກຂັ້ນ ມາຈາກຂັ້ນໄດອັນດຽວກັບເວັບ (lib/stage · lib/install-stage)
 * ⇒ ແອັບກັບເວັບຈະບໍ່ມີວັນສະແດງຂັ້ນຕ່າງກັນ.
 *
 * `action` = ປຸ່ມທີ່ຊ່າງກົດໄດ້ດຽວນີ້ — ຄິດຢູ່ຝັ່ງ server ບ່ອນດຽວ
 * ບໍ່ໃຫ້ແອັບຄິດເອງ (ບໍ່ດັ່ງນັ້ນແອັບເກົ່າໃນມືຖືຊ່າງຈະຄິດຜິດ ຫຼັງເຮົາປ່ຽນຂັ້ນໄດ).
 */

export type MobileAction =
  | "accept" // ຮັບງານ / ປະຕິເສດ
  | "start" // ເລີ່ມລົງມື
  | "finish" // ບັນທຶກສຳເລັດ
  | "wait_spare" // ລໍອາໄຫຼ່ຈາກສາງ
  | "wait_other"; // ລໍຄົນອື່ນ (CS/QC/ສາງ)

export type MobileJob = {
  workflow: "install" | "repair";
  code: string;
  customer: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  detail: string | null;
  /** ງານນອກສະຖານທີ່ບໍ — ຕິດຕັ້ງແມ່ນສະເໝີ · ສ້ອມແມ່ນຕາມ service_type */
  onsite: boolean;
  stage: number;
  stage_label: string;
  elapsed_seconds: number;
  appointment: string | null;
  action: MobileAction;
  accepted: boolean;
  has_checked_in: boolean;
  has_checked_out: boolean;
  can_check_in: boolean;
  can_check_out: boolean;
  /** ຍັງ check-in ຄ້າງຢູ່ບໍ (ຍັງບໍ່ໄດ້ check-out) */
  checked_in: boolean;
  /** ພິກັດສະຖານທີ່ (ຖ້າ CS ປັກໝຸດໄວ້) — ແອັບກົດນຳທາງໄດ້ */
  lat: number | null;
  lng: number | null;
};

/**
 * ຝັ່ງສ້ອມ: ງານ **ນອກສະຖານທີ່** = ຊ່າງຕ້ອງອອກໄປຫາເຄື່ອງ ⇒ ຕ້ອງ check-in/out.
 *
 * ⚠️ ຮຸ່ນກ່ອນຂຽນ `service_type <> 'in'` ໂດຍ **ເດົາຄ່າ** — ຄ່າ 'in'/'out' **ບໍ່ມີຢູ່ຈິງ**
 * ໃນຖານເລີຍ ⇒ ເງື່ອນໄຂເປັນຈິງສະເໝີ ⇒ ແອັບບັງຄັບ check-in ແມ່ນແຕ່ງານທີ່ເຮັດຢູ່ສູນ.
 *
 * ຄ່າຈິງ (5,069 ໃບ): **IH** ສ້ອມບ້ານລູກຄ້າ 3,669 · **PS** ໄປຮັບບ້ານລູກຄ້າ 123
 *                    **CI** ລູກຄ້ານຳເຂົ້າມາ 1,218 · **ST** ສ້ອມເຄື່ອງໃນສາງ 59
 * ⇒ ນອກສະຖານທີ່ = IH, PS ເທົ່ານັ້ນ (3,792 ໃບ = 75%).
 *
 * ຄ່າແປກທີ່ບໍ່ຮູ້ຈັກ ⇒ ຖືວ່າ **ຢູ່ສູນ** (ບໍ່ບັງຄັບ check-in) — ບັງຄັບຜິດ = ຊ່າງກົດຕໍ່ບໍ່ໄດ້
 * ຢູ່ໜ້າງານ ເຊິ່ງຮ້າຍແຮງກວ່າການຂາດຫຼັກຖານຂອງງານທີ່ເຮັດຢູ່ສູນ.
 */
const REPAIR_ONSITE = "coalesce(a.service_type,'') in ('IH','PS')";

const CHECKED_IN = (workflow: string) => `exists (
  select 1 from ods_job_checkin ck
   where ck.workflow = '${workflow}' and ck.job_code = a.code
     and ck.tech_code = $1 and ck.checkout_at is null)`;

/**
 * ປຸ່ມທີ່ກົດໄດ້ດຽວນີ້ — ຄິດຈາກຂັ້ນ (ບໍ່ແມ່ນຈາກຖັນດິບ).
 * ຕິດຕັ້ງ: 0 ບໍ່ມີຊ່າງ · 1-3 ອາໄຫຼ່ · 4 ລໍຕິດຕັ້ງ · 5 ກຳລັງຕິດຕັ້ງ · 6+ ລໍ QC/ອື່ນ
 */
const INSTALL_ACTION = `case
  when a.tech_confirm is null                       then 'accept'
  when (${INSTALL_STAGE_SQL}) in (1,2,3)            then 'wait_spare'
  when (${INSTALL_STAGE_SQL}) = 4                   then 'start'
  when (${INSTALL_STAGE_SQL}) = 5                   then 'finish'
  else 'wait_other' end`;

/** ສ້ອມ: 1-2 ກວດເຊັກ · 3-4 ລາຄາ · 5-7 ອາໄຫຼ່ · 8 ລໍສ້ອມ · 9 ກຳລັງສ້ອມ · 10+ ລໍ QC */
const REPAIR_ACTION = `case
  when a.repair_confirm is null      then 'accept'
  when (${STAGE_SQL}) in (5,6,7) then 'wait_spare'
  when (${STAGE_SQL}) = 8        then 'start'
  when (${STAGE_SQL}) = 9        then 'finish'
  else 'wait_other' end`;

export async function myJobs(session: Session): Promise<MobileJob[]> {
  const tech = session.username;
  // Mobile ແມ່ນໜ້າ "ວຽກຂອງຂ້ອຍ": ທຸກ role ຕ້ອງເຫັນສະເພາະງານທີ່
  // ມອບໝາຍໃຫ້ identity ທີ່ login ເທົ່ານັ້ນ. ຫົວໜ້າ/ຜູ້ຈັດການ
  // ເບິ່ງງານລວມຢູ່ web dashboard; ການໃຫ້ role ເຫຼົ່ານີ້ເຫັນທຸກງານ
  // ໃນ mobile ເຮັດໃຫ້ສາມາດເປີດ/ດຳເນີນງານຂອງຊ່າງຄົນອື່ນໄດ້.

  const install = await query<MobileJob>(
    `select 'install' as workflow, a.code,
        c.name_1 as customer, c.tel, coalesce(nullif(a.location_inst,''), c.address) as address,
        a.item_name as product,
        concat_ws(' ', a.pro_brand, a.pro_model) as detail,
        true as onsite,
        (${INSTALL_STAGE_SQL}) as stage,
        (${INSTALL_STAGE_LABEL_SQL}) as stage_label,
        ${INSTALL_ELAPSED_SQL} as elapsed_seconds,
        to_char(a.appoint_date,'DD-MM-YYYY') as appointment,
        (${INSTALL_ACTION}) as action,
        a.tech_confirm is not null as accepted,
        exists (select 1 from ods_job_checkin h where h.workflow='install' and h.job_code=a.code and h.tech_code=$1) as has_checked_in,
        exists (select 1 from ods_job_checkin h where h.workflow='install' and h.job_code=a.code and h.tech_code=$1 and h.checkout_at is not null) as has_checked_out,
        (a.tech_confirm is not null
          and (${INSTALL_STAGE_SQL}) in (4,5)
          and not ${CHECKED_IN("install")}) as can_check_in,
        ${CHECKED_IN("install")} as can_check_out,
        ${CHECKED_IN("install")} as checked_in,
        a.location_lat as lat, a.location_lng as lng
      from ods_tb_install a
      left join ar_customer c on c.code = a.cust_code
     where ${INSTALL_OPEN}
       and coalesce(a.tech_code,'') <> ''
       and a.tech_code = $1
     order by a.appoint_date asc nulls last, a.time_register asc`,
    [tech],
  );

  const repair = await query<MobileJob>(
    `select 'repair' as workflow, a.code,
        b.name_1 as customer, b.tel, coalesce(nullif(a.location_repair,''), b.address) as address,
        a.name_1 as product,
        concat_ws(' ', a.p_brand, a.p_model) as detail,
        (${REPAIR_ONSITE}) as onsite,
        (${STAGE_SQL}) as stage,
        (${STAGE_LABEL_SQL}) as stage_label,
        ${STAGE_ELAPSED_SQL} as elapsed_seconds,
        to_char(a.appoint_date,'DD-MM-YYYY') as appointment,
        (${REPAIR_ACTION}) as action,
        a.repair_confirm is not null as accepted,
        exists (select 1 from ods_job_checkin h where h.workflow='repair' and h.job_code=a.code and h.tech_code=$1) as has_checked_in,
        exists (select 1 from ods_job_checkin h where h.workflow='repair' and h.job_code=a.code and h.tech_code=$1 and h.checkout_at is not null) as has_checked_out,
        ((${REPAIR_ONSITE}) and a.repair_confirm is not null
          and (${STAGE_SQL}) in (1,2,8,9)
          and not ${CHECKED_IN("repair")}) as can_check_in,
        ${CHECKED_IN("repair")} as can_check_out,
        ${CHECKED_IN("repair")} as checked_in,
        a.location_lat as lat, a.location_lng as lng
      from tb_product a
      left join ar_customer b on b.code = a.cust_code
     where ${OPEN_JOBS}
       and coalesce(a.emp_code,'') <> ''
       and a.emp_code = $1
     order by a.appoint_date asc nulls last, a.time_register asc`,
    [tech],
  );

  return [...install.rows, ...repair.rows];
}

/**
 * ລາຍຮັບຂອງຊ່າງ — ອ່ານຈາກ ods_service_payout (ຕົວເລກທີ່ແຊ່ໄວ້ຕອນປິດງານ).
 * ຊ່າງເຫັນ **ຂອງຕົນເອງ** ເທົ່ານັ້ນ ແລະ ຕ້ອງເຊື່ອມຕົວຕົນ ODS↔ERP ໄວ້ກ່ອນ
 * (ods_user_employee — ໜ້າ /manage/technicians) ບໍ່ດັ່ງນັ້ນເງິນຈະບໍ່ມີເຈົ້າຂອງ.
 */
export type MobileIncome = {
  month: string;
  jobs: number;
  total_thb: number;
  rows: { job_code: string; workflow: string; role: string; pay_thb: number; closed_at: string }[];
};

export async function myIncome(session: Session): Promise<MobileIncome> {
  const employee = (
    await query<{ employee_code: string }>("select employee_code from ods_user_employee where user_code = $1", [
      session.username,
    ])
  ).rows[0];

  // ຍັງບໍ່ໄດ້ເຊື່ອມຕົວຕົນ ⇒ ບໍ່ມີເງິນຜູກກັບຄົນນີ້ (ບອກແອັບໄປຕາມຄວາມຈິງ ບໍ່ໃຫ້ເດົາ)
  if (!employee) return { month: "", jobs: 0, total_thb: 0, rows: [] };

  const rows = await query<MobileIncome["rows"][number]>(
    `select p.job_code, p.workflow, p.role, p.pay_thb::float as pay_thb,
        to_char(p.closed_at,'DD-MM-YYYY') as closed_at
      from ods_service_payout p
     where p.employee_code = $1
       and p.closed_at >= date_trunc('month', current_date)
     order by p.closed_at desc`,
    [employee.employee_code],
  );

  const total = rows.rows.reduce((sum, row) => sum + row.pay_thb, 0);
  return {
    month: new Date().toISOString().slice(0, 7),
    jobs: new Set(rows.rows.map((row) => row.job_code)).size,
    total_thb: total,
    rows: rows.rows,
  };
}
