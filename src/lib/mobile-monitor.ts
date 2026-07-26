import { query } from "@/lib/db";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
import { INSTALL_OPEN, INSTALL_STAGE_LABEL_SQL } from "@/lib/install-stage";
import { REPAIR_STAGE_SLA_HOURS_SQL } from "@/lib/repair-sla";
import { NOT_MISSING, NOT_PENDING_CANCEL, OPEN_JOBS, STAGE_ELAPSED_SQL, STAGE_LABEL_SQL } from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";

/**
 * ຕິດຕາມງານ (ຜູ້ຈັດການ) — ລາຍการงาน **ທີ່ຕ້ອງລົງມື** ຈັດເປັນກຸ່ມຕາມຄວາມດ່ວນ:
 *   ① ເລີຍ SLA (ມີຊ່າງແລ້ວ ແຕ່ຊ້າ)  ② ຍັງບໍ່ຈັດຊ່າງ  ③ ຄ້າງດົນ (≥3 ມື້, ຍັງບໍ່ເລີຍ SLA)
 * ຕົວເລກ/ຂັ້ນ ອີງ STAGE_SQL ອັນດຽວກັບເວັບ & ແອັບຊ່າງ ⇒ ບໍ່ແຍ້ງກັນ.
 */

export type MonitorJob = {
  workflow: "repair" | "install";
  code: string;
  product: string | null;
  customer: string | null;
  tech: string | null;
  service_type: string | null;
  stage_label: string;
  age_days: number;
  /** ວິນາທີກ່ອນຄົບ SLA (ຕິດລົບ = ເລີຍກຳນົດ) · null = ບໍ່ຄິດ SLA ຂັ້ນນີ້ */
  sla_left: number | null;
};

export type MonitorGroup = {
  key: "late" | "unassigned" | "aging";
  label: string;
  tone: "danger" | "warn" | "muted";
  jobs: MonitorJob[];
};

export type MobileMonitor = { groups: MonitorGroup[] };

const AGING_DAYS = 3;
const CAP = 60;

type Row = {
  code: string;
  product: string | null;
  customer: string | null;
  tech_code: string | null;
  service_type: string | null;
  stage_label: string;
  age_days: number;
  sla_left: number | null;
};

export async function mobileMonitor(): Promise<MobileMonitor> {
  const techs = await listTechnicians();
  const nameOf = new Map(techs.map((t) => [t.code, t.name]));

  const [repair, install] = await Promise.all([
    query<Row>(
      `select a.code,
          a.name_1 as product,
          b.name_1 as customer,
          nullif(trim(a.emp_code),'') as tech_code,
          a.service_type,
          (${STAGE_LABEL_SQL}) as stage_label,
          round(extract(epoch from (localtimestamp - a.time_register)) / 86400)::int as age_days,
          case when (${REPAIR_STAGE_SLA_HOURS_SQL}) is not null
            then (${REPAIR_STAGE_SLA_HOURS_SQL}) * 3600 - (${STAGE_ELAPSED_SQL})
            else null end::double precision as sla_left
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
       where ${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL}`,
    ),
    query<Row>(
      `select a.code,
          a.item_name as product,
          c.name_1 as customer,
          nullif(trim(a.tech_code),'') as tech_code,
          null as service_type,
          (${INSTALL_STAGE_LABEL_SQL}) as stage_label,
          round(extract(epoch from (localtimestamp - a.time_register)) / 86400)::int as age_days,
          (${INSTALL_LEFT_SQL})::double precision as sla_left
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
       where ${INSTALL_OPEN}`,
    ),
  ]);

  const rows: (MonitorJob & { assigned: boolean })[] = [
    ...repair.rows.map((r) => toJob(r, "repair", nameOf)),
    ...install.rows.map((r) => toJob(r, "install", nameOf)),
  ];

  // ແຕ່ລະໃບຢູ່ກຸ່ມດຽວ (priority): ຍັງບໍ່ຈັດຊ່າງ > ເລີຍ SLA > ຄ້າງດົນ
  const unassigned = rows.filter((j) => !j.assigned);
  const rest = rows.filter((j) => j.assigned);
  const late = rest.filter((j) => j.sla_left != null && j.sla_left < 0);
  const aging = rest.filter((j) => !(j.sla_left != null && j.sla_left < 0) && j.age_days >= AGING_DAYS);

  const groups: MonitorGroup[] = [
    {
      key: "late",
      label: "ເລີຍ SLA",
      tone: "danger",
      jobs: late.sort((a, b) => (a.sla_left ?? 0) - (b.sla_left ?? 0)).slice(0, CAP).map(strip),
    },
    {
      key: "unassigned",
      label: "ຍັງບໍ່ຈັດຊ່າງ",
      tone: "warn",
      jobs: unassigned.sort((a, b) => b.age_days - a.age_days).slice(0, CAP).map(strip),
    },
    {
      key: "aging",
      label: `ຄ້າງດົນ (≥${AGING_DAYS} ມື້)`,
      tone: "muted",
      jobs: aging.sort((a, b) => b.age_days - a.age_days).slice(0, CAP).map(strip),
    },
  ];

  return { groups: groups.filter((g) => g.jobs.length > 0) };
}

function toJob(
  r: Row,
  workflow: "repair" | "install",
  nameOf: Map<string, string>,
): MonitorJob & { assigned: boolean } {
  return {
    workflow,
    code: r.code,
    product: r.product,
    customer: r.customer,
    tech: r.tech_code ? nameOf.get(r.tech_code) ?? r.tech_code : null,
    service_type: r.service_type,
    stage_label: r.stage_label,
    age_days: r.age_days,
    sla_left: r.sla_left,
    assigned: Boolean(r.tech_code),
  };
}

function strip(j: MonitorJob & { assigned: boolean }): MonitorJob {
  const { assigned, ...rest } = j;
  void assigned;
  return rest;
}
