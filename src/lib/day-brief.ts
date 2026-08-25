import { query } from "@/lib/db";
import { pushToUser } from "@/lib/push";
import { OPEN_JOBS, STAGE_SQL } from "@/lib/stage";
import { INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { MAINTENANCE_STAGE_SQL } from "@/lib/maintenance-stage";

/**
 * **ສະຫຼຸບຕອນເຊົ້າໃຫ້ຊ່າງ** — "ມື້ນີ້ທ່ານມີ 3 ໃບນັດ · ໃບທຳອິດ …"
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ວັນນັດເກັບຢູ່ `appoint_date` ແລະ ແອັບສະແດງໃຫ້ຢູ່ແລ້ວ — ແຕ່ຊ່າງຮູ້ວ່າມີນັດ
 * **ຕໍ່ເມື່ອລາວເປີດແອັບເອງ**. ຄົນທີ່ບໍ່ໄດ້ເປີດຕອນເຊົ້າ ຈຶ່ງອອກຈາກເຮືອນຊ້າ ຫຼື
 * ໄປຜິດທາງ. ຂໍ້ຄວາມດຽວຕອນເຊົ້າແກ້ເລື່ອງນີ້ໂດຍບໍ່ຕ້ອງໃຫ້ໃຜໂທຫາ.
 *
 * ⚠️ ຍິງ **ເທື່ອດຽວຕໍ່ຄົນຕໍ່ມື້** (ods_day_brief) ⇒ cron ແລ່ນຊ້ຳກໍ່ບໍ່ດັງຊ້ຳ.
 * ⚠️ ນັບສະເພາະ **ໃບທີ່ນັດມື້ນີ້** — ບໍ່ນັບວຽກຄ້າງທັງໝົດ ບໍ່ດັ່ງນັ້ນຂໍ້ຄວາມຈະ
 *    ຄືກັນທຸກມື້ ແລ້ວກາຍເປັນສຽງລົບກວນທີ່ຄົນເລີກອ່ານ.
 */
export interface DayBriefResult {
  /** ຈຳນວນຊ່າງທີ່ມີນັດມື້ນີ້ */
  techs: number;
  /** ຈຳນວນທີ່ຍິງຈິງ (ຫັກຄົນທີ່ຍິງໄປແລ້ວມື້ນີ້) */
  sent: number;
  rows: { tech: string; jobs: number; first: string }[];
}

type Row = { tech: string; jobs: number; first: string | null; where: string | null };

export async function sendDayBrief(dry = false): Promise<DayBriefResult> {
  if (!query) return { techs: 0, sent: 0, rows: [] };

  /*
    ລວມ 3 ສາຍງານ. ຊ່າງຮ່ວມ (ods_job_tech) ນັບນຳ — ຄົນທີ່ຖືກໃສ່ເປັນຊ່າງຮ່ວມ
    ກໍ່ຕ້ອງໄປໜ້າງານມື້ນັ້ນຄືກັນ.
  */
  const rows = (
    await query<Row>(
      `with jobs as (
         select a.emp_code as lead, a.code, coalesce(b.name_1,'-') as customer,
                coalesce(nullif(a.location_repair,''), b.address) as place, 'repair' as wf
           from tb_product a
           left join ar_customer b on b.code = a.cust_code
          where ${OPEN_JOBS} and a.appoint_date::date = current_date
            and (${STAGE_SQL}) between 0 and 11
         union all
         select a.tech_code as lead, a.code, coalesce(b.name_1,'-'),
                coalesce(nullif(a.location_inst,''), b.address), 'install'
           from ods_tb_install a
           left join ar_customer b on b.code = a.cust_code
          where a.cancel_date is null and a.job_finish is null
            and a.appoint_date::date = current_date
            and (${INSTALL_STAGE_SQL}) between 0 and 7
         union all
         -- ລ້າງແອໃຊ້ຖັນ emp_code (ທີມດຽວກັບສ້ອມ) ບໍ່ແມ່ນ tech_code ຄືຕິດຕັ້ງ
         select a.emp_code as lead, a.code,
                coalesce(b.name_1, nullif(a.cust_name,''), '-'),
                coalesce(nullif(a.location,''), b.address), 'maintenance'
           from ods_tb_maintenance a
           left join ar_customer b on b.code = a.cust_code
          where a.cancel_date is null and a.appoint_date::date = current_date
            and (${MAINTENANCE_STAGE_SQL}) between 0 and 5
       ),
       people as (
         select j.code, j.customer, j.place, nullif(trim(j.lead),'') as tech from jobs j
         union
         select j.code, j.customer, j.place, t.tech_code
           from jobs j join ods_job_tech t on t.job_code = j.code and t.workflow = j.wf
       )
       select tech, count(distinct code)::int as jobs,
              min(customer) as first, min(place) as where
         from people
        where coalesce(tech,'') <> ''
        group by tech
        order by jobs desc`,
    )
  ).rows;

  if (rows.length === 0) return { techs: 0, sent: 0, rows: [] };

  // ໃຜໄດ້ຮັບໄປແລ້ວມື້ນີ້ (ກັນຍິງຊ້ຳ)
  const already = new Set(
    (
      await query<{ tech: string }>(
        `select tech_code as tech from ods_day_brief where sent_on = current_date`,
      )
    ).rows.map((row) => row.tech.toLowerCase()),
  );

  let sent = 0;
  for (const row of rows) {
    if (already.has(row.tech.toLowerCase())) continue;
    if (!dry) {
      await pushToUser(
        row.tech,
        `ມື້ນີ້ທ່ານມີ ${row.jobs} ໃບນັດ`,
        [row.first, row.where].filter(Boolean).join(" · ") || "ເປີດແອັບເບິ່ງລາຍການ",
        { type: "day_brief" },
      );
      await query(
        `insert into ods_day_brief(tech_code, sent_on, jobs) values ($1, current_date, $2)
         on conflict (tech_code, sent_on) do nothing`,
        [row.tech, row.jobs],
      );
    }
    sent += 1;
  }

  return {
    techs: rows.length,
    sent,
    rows: rows.map((row) => ({ tech: row.tech, jobs: row.jobs, first: row.first ?? "-" })),
  };
}
