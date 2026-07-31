import { query } from "@/lib/db";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
import { INSTALL_OPEN, INSTALL_STAGE_LABEL_SQL } from "@/lib/install-stage";
import type { MonitorJob } from "@/lib/mobile-monitor";
import { REPAIR_STAGE_SLA_HOURS_SQL } from "@/lib/repair-sla";
import { SLA_SQL } from "@/lib/sla";
import {
  IS_CLAIM,
  NOT_CLAIM,
  NOT_MISSING,
  NOT_PENDING_CANCEL,
  OPEN_JOBS,
  STAGE_ELAPSED_SQL,
  STAGE_LABEL_SQL,
  STAGE_SQL,
} from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";

/**
 * ── ກົດເບິ່ງລາຍລະອຽດ ຈາກໜ້າພາບລວມຜູ້ຈັດການ (ແອັບມືຖື) ──
 *
 * ທຸກຕົວເລກຢູ່ໜ້າ /overview ຄວນ **ກົດເຂົ້າໄປເຫັນວ່າແມ່ນໃບໃດແດ່** ໄດ້ — ບໍ່ດັ່ງນັ້ນ
 * ຜູ້ຈັດການເຫັນວ່າ "ຄ້າງ 46 ໃບ" ແລ້ວກໍ່ຈົນມຸມ: ຕ້ອງໄປເປີດເວັບ ຫຼື ຖາມຄົນອື່ນ.
 *
 * ໃຊ້ **ຮູບແບບ MonitorJob ອັນດຽວກັບໜ້າຕິດຕາມງານ** ⇒ ແອັບເອົາ MonitorTile ເກົ່າ
 * ມາສະແດງໄດ້ເລີຍ ບໍ່ຕ້ອງມີແຖວແບບໃໝ່ ແລະ ການແຕະເບິ່ງລາຍລະອຽດເຮັດວຽກຄືກັນທຸກບ່ອນ.
 *
 * ⚠️ ເງື່ອນໄຂ "ຂັ້ນ"/"ອາຍຸ" ຕ້ອງ **ຄືກັນເປັນຕົວອັກສອນ** ກັບ lib/manager-overview
 * ບໍ່ດັ່ງນັ້ນຕົວເລກໃນບັດ ກັບ ຈຳນວນແຖວທີ່ກົດເຂົ້າໄປ ຈະບໍ່ຕົງກັນ.
 */

const CAP = 100;

/** ນິຍາມດຽວກັບ lib/manager-overview — ຢ່າແກ້ບ່ອນດຽວ */
const OPEN_JOB = "a.return_complete is null and a.status <> 6";
const AGE_DAYS = `extract(day from localtimestamp - coalesce(a.time_register, a.create_date_time_now))::int`;

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

const REPAIR_SELECT = `select a.code,
    a.name_1 as product,
    b.name_1 as customer,
    nullif(trim(a.emp_code),'') as tech_code,
    a.service_type,
    (${STAGE_LABEL_SQL}) as stage_label,
    ${AGE_DAYS} as age_days,
    case when (${REPAIR_STAGE_SLA_HOURS_SQL}) is not null
      then (${REPAIR_STAGE_SLA_HOURS_SQL}) * 3600 - (${STAGE_ELAPSED_SQL})
      else null end::double precision as sla_left
  from tb_product a
  left join ar_customer b on b.code = a.cust_code`;

const INSTALL_SELECT = `select a.code,
    a.item_name as product,
    c.name_1 as customer,
    nullif(trim(a.tech_code),'') as tech_code,
    null as service_type,
    (${INSTALL_STAGE_LABEL_SQL}) as stage_label,
    round(extract(epoch from (localtimestamp - a.time_register)) / 86400)::int as age_days,
    (${INSTALL_LEFT_SQL})::double precision as sla_left
  from ods_tb_install a
  left join ar_customer c on c.code = a.cust_code`;

/** ຖັງອາຍຸ — ຂອບເຂດຄືກັບ manager-overview.getManagerOverview */
const AGE_WHERE: Record<string, string> = {
  d7: `${AGE_DAYS} <= 7`,
  d14: `${AGE_DAYS} > 7 and ${AGE_DAYS} <= 14`,
  d30: `${AGE_DAYS} > 14 and ${AGE_DAYS} <= 30`,
  over30: `${AGE_DAYS} > 30`,
};

export type DrillResult = { label: string; jobs: MonitorJob[] };

/**
 * @param bucket ຄີຈາກແອັບ — ຮັບແບບ `age:over30` · `tech:23037` · `stage:9` ນຳ
 */
export async function managerDrill(bucket: string): Promise<DrillResult> {
  const [kind, argument = ""] = bucket.split(":");
  const techs = await listTechnicians();
  const nameOf = new Map(techs.map((tech) => [tech.code, tech.name]));

  const repair = async (where: string, params: unknown[] = []) =>
    (await query<Row>(`${REPAIR_SELECT} where ${where} limit ${CAP}`, params)).rows.map((row) =>
      toJob(row, "repair", nameOf),
    );

  const install = async (where: string, params: unknown[] = []) =>
    (await query<Row>(`${INSTALL_SELECT} where ${where} limit ${CAP}`, params)).rows.map((row) =>
      toJob(row, "install", nameOf),
    );

  switch (kind) {
    case "age": {
      const range = AGE_WHERE[argument];
      if (!range) return { label: "", jobs: [] };
      return {
        label: LABEL[`age:${argument}`] ?? "ງານຄ້າງ",
        jobs: sortByAge(await repair(`${OPEN_JOB} and ${NOT_CLAIM} and ${range}`)),
      };
    }

    case "unassigned": {
      // ຝັ່ງຕິດຕັ້ງກໍ່ນັບນຳ — ບັດຢູ່ໜ້າພາບລວມລວມສອງສາຍງານໄວ້ດ້ວຍກັນ
      const [jobs, installs] = await Promise.all([
        repair(`${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL} and coalesce(trim(a.emp_code),'') = ''`),
        install(`${INSTALL_OPEN} and coalesce(trim(a.tech_code),'') = ''`),
      ]);
      return { label: LABEL.unassigned, jobs: sortByAge([...jobs, ...installs]) };
    }

    case "sla-late":
      /**
       * ⚠️ **ຕ້ອງໃຊ້ນິຍາມດຽວກັບບັດ** (SLA_LATE_SQL ຂອງ lib/dashboard) ບໍ່ແມ່ນ
       * REPAIR_STAGE_SLA_HOURS_SQL ຂອງໜ້າຕິດຕາມງານ: ອັນນັ້ນວັດ **ທຸກຂັ້ນ** ໄດ້ 87 ໃບ
       * ໃນຂະນະທີ່ບັດວັດ **ສະເພາະ 2 ຂັ້ນກວດເຊັກ** ໄດ້ 43 ໃບ ⇒ ກົດເຂົ້າໄປແລ້ວຕົວເລກບໍ່ຕົງ.
       */
      return {
        label: LABEL["sla-late"],
        jobs: sortByAge(await repair(SLA_LATE_WHERE)),
      };

    case "claim-decision":
      return {
        label: LABEL["claim-decision"],
        jobs: sortByAge(await repair(`${OPEN_JOB} and ${IS_CLAIM} and (${STAGE_SQL}) = 13`)),
      };

    case "claim-open":
      return { label: LABEL["claim-open"], jobs: sortByAge(await repair(`${OPEN_JOB} and ${IS_CLAIM}`)) };

    case "loaners":
      // ໃບງານທີ່ຍັງມີເຄື່ອງສຳຮອງຢູ່ນຳລູກຄ້າ (ບໍ່ແມ່ນລາຍໜ່ວຍ — ຜູ້ຈັດການຕາມທີ່ໃບງານ)
      return {
        label: LABEL.loaners,
        jobs: sortByAge(
          await repair(
            `${OPEN_JOBS} and exists (select 1 from ods_loaner l where l.job_code = a.code and l.return_time is null)`,
          ),
        ),
      };

    case "unhappy":
      /**
       * ⚠️ **ຄຳຕິຊົມທັງໝົດເປັນຂອງງານຕິດຕັ້ງ** — ວັດຈາກຂໍ້ມູນຈິງ: 66 ໃບທີ່ points≥3
       * ຢູ່ ods_tb_install ໝົດ (INST-*), ຢູ່ tb_product **0 ໃບ**. ຄົ້ນຝັ່ງສ້ອມ
       * ຈຶ່ງໄດ້ລາຍການຫວ່າງທັງທີ່ບັດຂຶ້ນ 66.
       *
       * ບໍ່ຈຳກັດວັນທີ ແລະ ບໍ່ຈຳກັດວ່າໃບຍັງເປີດຢູ່ — ນິຍາມດຽວກັບ FEEDBACK_SQL ຂອງ
       * lib/dashboard (ນັບ **ທັງໝົດ** ບໍ່ແມ່ນ 30 ມື້).
       */
      return {
        label: LABEL.unhappy,
        jobs: sortByAge(
          await install(
            `exists (select 1 from cust_complain c
                      where c.product_code = a.code and c.topic_code = '002' and c.points >= 3)`,
          ),
        ),
      };

    case "tech": {
      if (!argument) return { label: "", jobs: [] };
      return {
        label: `${nameOf.get(argument) ?? argument} · ວຽກຄ້າງ`,
        jobs: sortByAge(await repair(`${OPEN_JOB} and ${NOT_CLAIM} and trim(a.emp_code) = $1`, [argument])),
      };
    }

    case "stage": {
      const stage = Number(argument);
      if (!Number.isInteger(stage)) return { label: "", jobs: [] };
      const jobs = await repair(`${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL} and (${STAGE_SQL}) = ${stage}`);
      return { label: jobs[0]?.stage_label ?? "ຂັ້ນນີ້", jobs: sortByAge(jobs) };
    }

    case "today": {
      const where =
        argument === "received" ? "a.time_register::date = current_date"
        : argument === "returned" ? "a.return_complete::date = current_date"
        : "";
      if (!where) return { label: "", jobs: [] };
      return { label: LABEL[`today:${argument}`] ?? "ມື້ນີ້", jobs: sortByAge(await repair(where)) };
    }

    default:
      return { label: "", jobs: [] };
  }
}

/** ເລີຍ SLA — ຄັດລອກເງື່ອນໄຂ wait_late + check_late ຂອງ SLA_LATE_SQL (lib/dashboard) */
const SLA_LATE_WHERE = `(${SLA_SQL}) is not null and (
    (a.time_check is null and a.time_finish_check is null and a.status = 1
      and extract(epoch from (localtimestamp - a.time_register)) > (${SLA_SQL}))
    or
    (a.time_check is not null and a.time_finish_check is null and a.status <> 6
      and extract(epoch from (localtimestamp - a.time_check)) > (${SLA_SQL}))
  )`;

const LABEL: Record<string, string> = {
  "age:d7": "ຄ້າງບໍ່ເກີນ 7 ມື້",
  "age:d14": "ຄ້າງ 8-14 ມື້",
  "age:d30": "ຄ້າງ 15-30 ມື້",
  "age:over30": "ຄ້າງເກີນ 30 ມື້",
  unassigned: "ຍັງບໍ່ຈັດຊ່າງ",
  "sla-late": "ເກີນເວລາທີ່ສັນຍາໄວ້ (SLA)",
  "claim-decision": "ງານເຄມລໍຕັດສິນ",
  "claim-open": "ງານເຄມທີ່ຍັງເປີດຢູ່",
  loaners: "ໃບງານທີ່ມີເຄື່ອງສຳຮອງຄ້າງຄືນ",
  unhappy: "ລູກຄ້າໃຫ້ຄະແນນຕໍ່າ",
  "today:received": "ຮັບເຄື່ອງເຂົ້າມື້ນີ້",
  "today:returned": "ສົ່ງຄືນລູກຄ້າມື້ນີ້",
};

const sortByAge = (jobs: MonitorJob[]) => jobs.sort((a, b) => b.age_days - a.age_days).slice(0, CAP);

function toJob(row: Row, workflow: "repair" | "install", nameOf: Map<string, string>): MonitorJob {
  return {
    workflow,
    code: row.code,
    product: row.product,
    customer: row.customer,
    tech: row.tech_code ? (nameOf.get(row.tech_code) ?? row.tech_code) : null,
    service_type: row.service_type,
    stage_label: row.stage_label,
    age_days: row.age_days,
    sla_left: row.sla_left,
  };
}
