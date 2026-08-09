import type { Session } from "@/lib/auth";
import { query } from "@/lib/db";
import { employeeCode } from "@/lib/erp-employee";
import {
  INSTALL_STAGE_LABEL_SQL,
  INSTALL_STAGE_SQL,
  INSTALL_ELAPSED_SQL,
  INSTALL_OPEN,
} from "@/lib/install-stage";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
import { REPAIR_STAGE_SLA_HOURS_SQL } from "@/lib/repair-sla";
import {
  MAINTENANCE_OPEN,
  MAINTENANCE_STAGE_LABEL_SQL,
  MAINTENANCE_STAGE_SQL,
} from "@/lib/maintenance-stage";
import { OPEN_JOBS, STAGE_ELAPSED_SQL, STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import { UNDO_TO_SQL } from "@/lib/mobile-undo";

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
  /** ສາຍງານ — ສ້ອມ · ຕິດຕັ້ງ · ບຳລຸງຮັກສາ (ລ້າງແອ) */
  workflow: "install" | "repair" | "maintenance";
  code: string;
  customer: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  detail: string | null;
  /** ລາຍລະອຽດສິນຄ້າ (ສະເພາະສ້ອມ): serial no · ສະຖານະຮັບປະກັນ */
  sn: string | null;
  warranty: string | null;
  /** ຜົນກວດເຊັກ (ສະເພາະສ້ອມ): ອາການລູກຄ້າແຈ້ງ · ຜົນວິເຄາະຊ່າງ · ເຫດຜົນໝົດປະກັນ */
  symptom: string | null;
  diagnosis: string | null;
  warranty_reason: string | null;
  /** ງານນອກສະຖານທີ່ບໍ — ຕິດຕັ້ງແມ່ນສະເໝີ · ສ້ອມແມ່ນຕາມ service_type */
  onsite: boolean;
  /** ປະເພດບໍລິການສ້ອມ (CI/ST/IH/PS) — null ຝັ່ງຕິດຕັ້ງ. ໃຊ້ໃຫ້ແອັບຮູ້ IH (ນຳເຂົ້າສູນໄດ້) */
  service_type: string | null;
  stage: number;
  stage_label: string;
  /** ວິນາທີທີ່ຄ້າງຢູ່ **ຂັ້ນປັດຈຸບັນ** */
  elapsed_seconds: number;
  /** ວັນ-ເວລາທີ່ຮັບເຄື່ອງເຂົ້າ (ເປີດໃບ) */
  received_at: string | null;
  /** ວິນາທີ **ລວມ** ນັບແຕ່ຮັບເຄື່ອງເຂົ້າ — ບອກອາຍຸງານທັງໝົດ ບໍ່ແມ່ນແຕ່ຂັ້ນປັດຈຸບັນ */
  total_seconds: number | null;
  /** ຜູ້ຮັບເຄື່ອງ (ຄົນທີ່ເປີດໃບ) */
  receiver: string | null;
  appointment: string | null;
  action: MobileAction;
  accepted: boolean;
  has_checked_in: boolean;
  has_checked_out: boolean;
  can_check_in: boolean;
  can_check_out: boolean;
  /** ຍັງ check-in ຄ້າງຢູ່ບໍ (ຍັງບໍ່ໄດ້ check-out) */
  checked_in: boolean;
  /** ຕິດຕັ້ງ: ເກັບ ISN/SN ຄົບທຸກໜ່ວຍແລ້ວບໍ (ດ່ານກ່ອນກົດສຳເລັດ) */
  scan_done?: boolean;
  /** ຕິດຕັ້ງ: ງານນີ້ມີ **ໜ່ວຍນອກ** ນຳບໍ (ແອ) ⇒ ຕ້ອງເກັບ 2 ເລກ */
  need_outdoor?: boolean;
  /** ຕິດຕັ້ງ: ເລກທີ່ໃບງານລະບຸໄວ້ — ໃຫ້ຊ່າງທຽບດ້ວຍຕາກ່ອນຍິງ */
  expect_sn?: string | null;
  expect_sn_out?: string | null;
  /** ພິກັດສະຖານທີ່ (ຖ້າ CS ປັກໝຸດໄວ້) — ແອັບກົດນຳທາງໄດ້ */
  lat: number | null;
  lng: number | null;
  /**
   * ວິນາທີທີ່ຍັງເຫຼືອກ່ອນຄົບ SLA (ຕິດລົບ = ເລີຍກຳນົດ).
   * ຕິດຕັ້ງ = 24 ຊມ ນັບແຕ່ອອກບິນ · ສ້ອມ = SLA ຂັ້ນປັດຈຸບັນຕາມ CI/ST/IH/PS.
   * ຊ່າງຕ້ອງເຫັນນາລິກາອັນດຽວກັບທີ່ຜູ້ຈັດການເຫັນ ບໍ່ດັ່ງນັ້ນ "ດ່ວນ" ຂອງສອງຝ່າຍບໍ່ຕົງກັນ.
   */
  sla_left: number | null;
  /** ປ້າຍ "ຖອຍໄປຫາ" (ຂັ້ນກ່ອນໜ້າ) — null = ຂັ້ນນີ້ຖອຍບໍ່ໄດ້ (ໃຫ້ແອັບເຊື່ອງປຸ່ມ) */
  undo_to: string | null;
};

/**
 * ຝັ່ງສ້ອມ: ງານ **ນອກສະຖານທີ່** = ຊ່າງຕ້ອງອອກໄປຫາເຄື່ອງ ⇒ ຕ້ອງ check-in/out.
 *
 * ⚠️ ຮຸ່ນກ່ອນຂຽນ `service_type <> 'in'` ໂດຍ **ເດົາຄ່າ** — ຄ່າ 'in'/'out' **ບໍ່ມີຢູ່ຈິງ**
 * ໃນຖານເລີຍ ⇒ ເງື່ອນໄຂເປັນຈິງສະເໝີ ⇒ ແອັບບັງຄັບ check-in ແມ່ນແຕ່ງານທີ່ເຮັດຢູ່ສູນ.
 *
 * ຄ່າຈິງ (5,069 ໃບ): **IH** ສ້ອມບ້ານລູກຄ້າ 3,669 · **PS** ໄປຮັບເຄື່ອງທີ່ບ້ານມາສ້ອມຢູ່ສູນ 123
 *                    **CI** ລູກຄ້ານຳເຂົ້າມາ 1,218 · **ST** ສ້ອມເຄື່ອງໃນສາງ 59
 * ⇒ ນອກສະຖານທີ່ = IH, PS ເທົ່ານັ້ນ (3,792 ໃບ = 75%).
 *
 * ຄ່າແປກທີ່ບໍ່ຮູ້ຈັກ ⇒ ຖືວ່າ **ຢູ່ສູນ** (ບໍ່ບັງຄັບ check-in) — ບັງຄັບຜິດ = ຊ່າງກົດຕໍ່ບໍ່ໄດ້
 * ຢູ່ໜ້າງານ ເຊິ່ງຮ້າຍແຮງກວ່າການຂາດຫຼັກຖານຂອງງານທີ່ເຮັດຢູ່ສູນ.
 *
 * ⚠️ **PS ນອກສະຖານທີ່ສະເພາະ "ໄປຮັບເຄື່ອງ" (ຍັງບໍ່ pickup_at)**. ພໍຮັບເຄື່ອງເຂົ້າສູນແລ້ວ
 * (pickup_at set — ລວມ IH→PS "ເອົາກັບພ້ອມ") ວຽກກວດ/ສ້ອມ **ຢູ່ສູນ** ⇒ ບໍ່ຕ້ອງ check-in GPS.
 * IH ສ້ອມບ້ານ = ນອກສະຖານທີ່ຕະຫຼອດ.
 */
/**
 * **ວຽກນອກສະຖານທີ່ = IH ເທົ່ານັ້ນ** (07-08-2026 ຕາມຄຳສັ່ງ).
 *
 * ── ເປັນຫຍັງ PS ບໍ່ນັບ ──
 * PS = **ໄປຮັບເຄື່ອງ**ບ້ານລູກຄ້າມາສ້ອມຢູ່ສູນ — ຄົນທີ່ໄປແມ່ນຂົນສົ່ງ/ຄົນຮັບເຄື່ອງ
 * ບໍ່ແມ່ນຊ່າງໄປລົງມືສ້ອມ ⇒ ບໍ່ມີ "ຮອບເຮັດວຽກໜ້າງານ" ໃຫ້ບັນທຶກ. ວຽກຈິງຂອງຊ່າງ
 * ເກີດຢູ່ສູນຫຼັງເຄື່ອງມາຮອດ. ບັງຄັບ check-in ໃຫ້ PS = ກັກວຽກໂດຍບໍ່ມີເຫດຜົນ.
 * (ຮຸ່ນກ່ອນນັບ PS ເປັນນອກສະຖານທີ່ຕອນຍັງບໍ່ pickup_at.)
 */
const REPAIR_ONSITE = "(coalesce(a.service_type,'')='IH')";

const CHECKED_IN = (workflow: string) => `exists (
  select 1 from ods_job_checkin ck
   where ck.workflow = '${workflow}' and ck.job_code = a.code
     and ck.tech_code = $1 and ck.checkout_at is null)`;

/**
 * ປຸ່ມທີ່ກົດໄດ້ດຽວນີ້ — ຄິດຈາກຂັ້ນ (ບໍ່ແມ່ນຈາກຖັນດິບ).
 * ຕິດຕັ້ງ: 1 ລໍຮັບ · 2-3 ອາໄຫຼ່ · 4 ຕິດຕັ້ງ · 5+ QC/ປະເມີນ/ປິດ
 */
const INSTALL_ACTION = `case
  when a.tech_confirm is null                       then 'accept'
  when (${INSTALL_STAGE_SQL}) in (2,3)              then 'wait_spare'
  when (${INSTALL_STAGE_SQL}) = 4 then 'start'
  when (${INSTALL_STAGE_SQL}) = 5 then 'finish'
  else 'wait_other' end`;

/** ສ້ອມ: 1-2 ກວດເຊັກ · 3-4 ລາຄາ · 5-7 ອາໄຫຼ່ · 8 ລໍສ້ອມ · 9 ກຳລັງສ້ອມ · 10+ ລໍ QC */
const REPAIR_ACTION = `case
  -- IH (ໄປສ້ອມບ້ານ) ຍັງບໍ່ນັດ (ຂັ້ນ 0) ⇒ ຮັບງານບໍ່ໄດ້ (acceptRepair ຕ້ອງຂັ້ນ 1);
  -- ລໍ CS ໃສ່ວັນນັດໝາຍກ່ອນ ຈຶ່ງຕົກຂັ້ນ 1. ບໍ່ໃຫ້ສະແດງ 'accept' ທີ່ກົດແລ້ວ error.
  when coalesce(a.service_type,'')='IH' and a.appoint_date is null then 'wait_other'
  -- ⚠️ "ຮັບງານ" ຕ້ອງຫາຍໄປເມື່ອວຽກເດີນໜ້າໄປແລ້ວ. ຫຼັງລວມປຸ່ມ "ເລີ່ມສ້ອມ" ເຂົ້າກັບການກົດຮັບ
  -- ວຽກສາມາດມີ time_repair ໂດຍ repair_confirm ຍັງຫວ່າງ ⇒ ຖ້າກວດແຕ່ repair_confirm
  -- ຈະຄ້າງປຸ່ມ "ຮັບງານ" ຢູ່ຕະຫຼອດ ທັງໆທີ່ກຳລັງສ້ອມຢູ່ (ວັດ 04-08-2026: 45 ວຽກ, ຍັງເປີດ 4).
  when a.repair_confirm is null and (${STAGE_SQL}) < 9 then 'accept'
  when (${STAGE_SQL}) in (5,6,7) then 'wait_spare'
  -- ຂັ້ນ 8 (ລໍຖ້າສ້ອມ) ໃຫ້ **ຈົບໄດ້ເລີຍ** ຄືກັບເວັບ — ບໍ່ຕ້ອງກົດ "ເລີ່ມສ້ອມ" ກ່ອນ
  -- (finishRepairFlow ຮັບຂັ້ນ 8|9 ແລະ ຕື່ມ time_repair ໃຫ້ເອງ — ເບິ່ງ docs/repair-redesign.md)
  when (${STAGE_SQL}) in (8, 9)  then 'finish'
  else 'wait_other' end`;

/** ບຳລຸງຮັກສາ: 1 ລໍຊ່າງຮັບ · 2 ລໍໄປລ້າງ · 3 ກຳລັງລ້າງ · ອື່ນ = ລໍຄົນອື່ນ */
const MAINTENANCE_ACTION = `case
  when (${MAINTENANCE_STAGE_SQL}) = 1 then 'accept'
  when (${MAINTENANCE_STAGE_SQL}) = 2 then 'start'
  when (${MAINTENANCE_STAGE_SQL}) = 3 then 'finish'
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
        null as sn, null as warranty,
        null as symptom, null as diagnosis, null as warranty_reason,
        true as onsite,
        null as service_type,
        (${INSTALL_STAGE_SQL}) as stage,
        (${INSTALL_STAGE_LABEL_SQL}) as stage_label,
        ${INSTALL_ELAPSED_SQL} as elapsed_seconds,
        to_char(a.time_register,'DD-MM-YYYY HH24:MI') as received_at,
        extract(epoch from localtimestamp - a.time_register)::double precision as total_seconds,
        nullif(a.user_created,'') as receiver,
        to_char(a.appoint_date,'DD-MM-YYYY') as appointment,
        (${INSTALL_ACTION}) as action,
        a.tech_confirm is not null as accepted,
        exists (select 1 from ods_job_checkin h where h.workflow='install' and h.job_code=a.code and h.tech_code=$1) as has_checked_in,
        exists (select 1 from ods_job_checkin h where h.workflow='install' and h.job_code=a.code and h.tech_code=$1 and h.checkout_at is not null) as has_checked_out,
        -- ⚠️ ຕ້ອງຕົງກັບ allowedStages ຂອງ lib/job-flow.checkIn ສະເໝີ — ອັນນີ້ບອກແອັບວ່າກົດໄດ້ບໍ
        -- ສ່ວນອັນນັ້ນເປັນດ່ານຈິງ. ຂັ້ນ 5 (ກຳລັງຕິດຕັ້ງ) ຮັບນຳ ເພາະ 1 ໃບງານເຂົ້າໜ້າງານໄດ້
        -- ຫຼາຍຮອບ (06-08-2026) ⇒ ຮອບ 2 ຕ້ອງ check-in ໃໝ່ໄດ້.
        (a.tech_confirm is not null
          and (${INSTALL_STAGE_SQL}) in (4, 5)
          and not ${CHECKED_IN("install")}) as can_check_in,
        -- ສະແກນ ISN/SN ຕອນກຳລັງຕິດຕັ້ງແລ້ວບໍ (ດ່ານກ່ອນກົດສຳເລັດ — ເບິ່ງ lib/install-scan)
        /*
          ── ເກັບ ISN/SN ຄົບແລ້ວບໍ (07-08-2026) ──
          ດຽວນີ້ຊ່າງເປັນຄົນເກັບເລກ ⇒ "ຄົບ" = ຊ່ອງໃນໃບງານມີຄ່າ ບໍ່ແມ່ນ "ເຄີຍຍິງແລ້ວ".
          ແອ (ລະຫັດ 12xx) = 2 ໜ່ວຍ (ໃນ+ນອກ) · ເຄື່ອງອື່ນ = 1 ໜ່ວຍ.
          ດ່ານຈິງຢູ່ lib/install-scan.installUnits — ດຽວນີ້ໃຊ້**ກົດດຽວກັນ**ກັບແຖວນີ້
          (12xx = 2 ໜ່ວຍ) ບໍ່ຖາມ ERP ອີກແລ້ວ (08-08-2026) ⇒ ໜ້າຈໍກັບດ່ານບໍ່ຂັດກັນ.
        */
        (nullif(a.pro_sn,'') is not null
          and (a.item_code not like '12%' or nullif(a.pro_sn_out,'') is not null)) as scan_done,
        (a.item_code like '12%') as need_outdoor,
        nullif(a.pro_sn,'') as expect_sn,
        nullif(a.pro_sn_out,'') as expect_sn_out,
        ${CHECKED_IN("install")} as can_check_out,
        ${CHECKED_IN("install")} as checked_in,
        a.location_lat as lat, a.location_lng as lng,
        (${INSTALL_LEFT_SQL}) as sla_left,
        null as undo_to
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
        a.sn as sn, a.warrunty as warranty,
        a.issue as symptom, a.issue_2 as diagnosis, a.warranty_reason as warranty_reason,
        (${REPAIR_ONSITE}) as onsite,
        a.service_type as service_type,
        (${STAGE_SQL}) as stage,
        (${STAGE_LABEL_SQL}) as stage_label,
        ${STAGE_ELAPSED_SQL} as elapsed_seconds,
        to_char(a.time_register,'DD-MM-YYYY HH24:MI') as received_at,
        extract(epoch from localtimestamp - a.time_register)::double precision as total_seconds,
        nullif(a.user_regis,'') as receiver,
        to_char(a.appoint_date,'DD-MM-YYYY') as appointment,
        (${REPAIR_ACTION}) as action,
        a.repair_confirm is not null as accepted,
        exists (select 1 from ods_job_checkin h where h.workflow='repair' and h.job_code=a.code and h.tech_code=$1) as has_checked_in,
        exists (select 1 from ods_job_checkin h where h.workflow='repair' and h.job_code=a.code and h.tech_code=$1 and h.checkout_at is not null) as has_checked_out,
        ((${REPAIR_ONSITE}) and a.repair_confirm is not null
          and (${STAGE_SQL}) in (1,2,8,9)
          and not ${CHECKED_IN("repair")}) as can_check_in,
        false as scan_done, false as need_outdoor,
        null::varchar as expect_sn, null::varchar as expect_sn_out,
        ${CHECKED_IN("repair")} as can_check_out,
        ${CHECKED_IN("repair")} as checked_in,
        a.location_lat as lat, a.location_lng as lng,
        case when (${REPAIR_STAGE_SLA_HOURS_SQL}) is not null
          then (${REPAIR_STAGE_SLA_HOURS_SQL}) * 3600 - (${STAGE_ELAPSED_SQL})
          else null end::double precision as sla_left,
        (${UNDO_TO_SQL}) as undo_to
      from tb_product a
      left join ar_customer b on b.code = a.cust_code
     where ${OPEN_JOBS}
       and coalesce(a.emp_code,'') <> ''
       and a.emp_code = $1
     order by sla_left asc nulls last, a.appoint_date asc nulls last, a.time_register asc`,
    [tech],
  );

  /**
   * ── ສາຍງານທີ 3: ບຳລຸງຮັກສາ (ລ້າງແອ) ──
   * ແຕ່ກ່ອນແອັບເຫັນແຕ່ ຕິດຕັ້ງ+ສ້ອມ ⇒ ຊ່າງທີ່ຖືກຈັດໄປລ້າງແອ **ບໍ່ເຫັນວຽກໃນແອັບເລີຍ**
   * ຕ້ອງເປີດເວັບເບິ່ງເອົາ. ຂັ້ນ/ປ້າຍ ມາຈາກ lib/maintenance-stage ບ່ອນດຽວກັບເວັບ.
   */
  const maintenance = await query<MobileJob>(
    `select 'maintenance' as workflow, a.code,
        coalesce(nullif(a.cust_name,''), c.name_1) as customer,
        coalesce(nullif(a.cust_tel,''), c.tel) as tel,
        coalesce(nullif(a.location,''), c.address) as address,
        'ບຳລຸງຮັກສາ / ລ້າງແອ' as product,
        nullif(a.remark,'') as detail,
        null as sn, null as warranty,
        null as symptom, null as diagnosis, null as warranty_reason,
        true as onsite,
        null as service_type,
        (${MAINTENANCE_STAGE_SQL}) as stage,
        (${MAINTENANCE_STAGE_LABEL_SQL}) as stage_label,
        extract(epoch from localtimestamp - a.time_register)::double precision as elapsed_seconds,
        to_char(a.time_register,'DD-MM-YYYY HH24:MI') as received_at,
        extract(epoch from localtimestamp - a.time_register)::double precision as total_seconds,
        nullif(a.created_by,'') as receiver,
        to_char(a.appoint_date,'DD-MM-YYYY') as appointment,
        (${MAINTENANCE_ACTION}) as action,
        a.tech_confirm is not null as accepted,
        -- ວຽກລ້າງແອເປັນວຽກໜ້າງານ 100% ⇒ ດຽວນີ້ມີ check-in/out ຄືສາຍງານອື່ນ (07-08-2026)
        exists (select 1 from ods_job_checkin h
                 where h.workflow='maintenance' and h.job_code=a.code and h.tech_code=$1) as has_checked_in,
        exists (select 1 from ods_job_checkin h
                 where h.workflow='maintenance' and h.job_code=a.code and h.tech_code=$1
                   and h.checkout_at is not null) as has_checked_out,
        (a.tech_confirm is not null and (${MAINTENANCE_STAGE_SQL}) in (2,3)
          and not ${CHECKED_IN("maintenance")}) as can_check_in,
        ${CHECKED_IN("maintenance")} as can_check_out,
        ${CHECKED_IN("maintenance")} as checked_in,
        false as scan_done, false as need_outdoor,
        null::varchar as expect_sn, null::varchar as expect_sn_out,
        null::double precision as lat, null::double precision as lng,
        null::double precision as sla_left,
        null as undo_to
      from ods_tb_maintenance a
      left join ar_customer c on c.code = a.cust_code
     where ${MAINTENANCE_OPEN}
       and coalesce(a.emp_code,'') <> ''
       and a.emp_code = $1
     order by a.appoint_date asc nulls last, a.time_register asc`,
    [tech],
  );

  return [...install.rows, ...repair.rows, ...maintenance.rows];
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
  // ຫາລະຫັດຜ່ານ `employeeCode` — ຢ່າຖາມ ods_user_employee ເອງ: ສຳເນົາແບບນັ້ນຫຼົ່ນ
  // ທັງ `users.code` ແລະ ການທຽບແບບບໍ່ສົນໂຕພິມ ⇒ ຊ່າງທີ່ມີລະຫັດຢູ່ແລ້ວເຫັນລາຍໄດ້ເປັນ 0
  const employee = await employeeCode(session.username);

  // payout.employee_code ເກັບຄ່າ **emp_code ຂອງງານ** — ຊ່າງເຊື່ອມແລ້ວ = ລະຫັດ ERP ·
  // ຊ່າງຍັງບໍ່ເຊື່ອມ = ຊື່ຫຼິ້ນ (ຄື username). ⇒ ຄົ້ນດ້ວຍ **ທັງສອງ** ບໍ່ດັ່ງນັ້ນຊ່າງທີ່ຍັງບໍ່
  // ເຊື່ອມຈະເຫັນ "ບໍ່ເຊື່ອມ ERP" ທັງທີ່ມີເງິນເຂົ້າຢູ່ຊື່ຫຼິ້ນແລ້ວ (ຕົງກັບ /commission ຝັ່ງເວັບ).
  const keys = [...new Set([employee, session.username].filter(Boolean))];

  const rows = await query<MobileIncome["rows"][number]>(
    `select p.job_code, p.workflow, p.role, p.pay_thb::float as pay_thb,
        to_char(p.closed_at,'DD-MM-YYYY') as closed_at
      from ods_service_payout p
     where p.employee_code = any($1)
       and p.closed_at >= date_trunc('month', current_date)
     order by p.closed_at desc`,
    [keys],
  );

  // ເຊື່ອມ ERP ແລ້ວ **ຫຼື** ມີເງິນເຂົ້າຊື່ນີ້ແລ້ວ ⇒ ສະແດງ. ບໍ່ດັ່ງນັ້ນ (ບໍ່ເຊື່ອມ+ບໍ່ມີເງິນ) = ເຕືອນ.
  if (!employee && rows.rows.length === 0) {
    return { month: "", jobs: 0, total_thb: 0, rows: [] };
  }

  const total = rows.rows.reduce((sum, row) => sum + row.pay_thb, 0);
  return {
    month: new Date().toISOString().slice(0, 7),
    jobs: new Set(rows.rows.map((row) => row.job_code)).size,
    total_thb: total,
    rows: rows.rows,
  };
}
