import { query } from "@/lib/db";
import { INSTALL_OPEN, INSTALL_STAGE_LABEL_SQL } from "@/lib/install-stage";
import { NOT_MISSING, NOT_PENDING_CANCEL, OPEN_JOBS, STAGE_LABEL_SQL } from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";

/**
 * ── ແຜນທີ່ງານທີ່ **ຍັງຄ້າງ** (ແອັບຜູ້ຈັດການ) ──
 *
 * ໝຸດ = ງານສ້ອມ ແລະ ງານຕິດຕັ້ງ ທີ່ຍັງບໍ່ຈົບ ແລະ **ມີພິກັດ**.
 *
 * ⚠️ **ຄວາມຈິງຂອງຂໍ້ມູນປັດຈຸບັນ** (ວັດ 31-07-2026): ງານສ້ອມທີ່ເປີດຢູ່ 124 ໃບ
 * **ບໍ່ມີພິກັດຈັກໃບ** · ງານຕິດຕັ້ງ 39 ໃບ ມີພິກັດພຽງ 6 ໃບ ⇒ ແຜນທີ່ຈະຍັງວ່າງເກືອບໝົດ
 * ຈົນກວ່າຄົນເປີດງານຈະໝາຍພິກັດ (location-picker ຢູ່ຟອມ IH/PS/ຕິດຕັ້ງ).
 * ຈຶ່ງສົ່ງ `without_gps` ລົງໄປນຳ ⇒ ແອັບ**ບອກໄດ້ວ່າຂາດໄປຈັກໃບ** ແທນທີ່ຈະສະແດງແຜນທີ່
 * ວ່າງໆແລ້ວປະໃຫ້ຄົນເດົາວ່າລະບົບພັງ.
 *
 * ພິກັດເອົາຈາກ 2 ບ່ອນ ຕາມລຳດັບ: ①ພິກັດຂອງໃບງານ ②ຈຸດທີ່ຊ່າງ check-in ຄັ້ງລ່າສຸດ
 * (ods_job_checkin) — ອັນທີ 2 ບອກວ່າ "ຊ່າງໄປຮອດແລ້ວ" ເຊິ່ງກໍ່ຄືບ່ອນຂອງງານນັ້ນ.
 */
export type MapPin = {
  workflow: "repair" | "install";
  code: string;
  lat: number;
  lng: number;
  title: string;
  customer: string | null;
  tech: string | null;
  stage_label: string;
  age_days: number;
  service_type: string | null;
  /** job = ພິກັດທີ່ໝາຍຕອນເປີດງານ · checkin = ຈຸດທີ່ຊ່າງໄປຮອດ */
  source: "job" | "checkin";
};

export type MobileMap = {
  pins: MapPin[];
  /** ງານທີ່ຍັງຄ້າງແຕ່ **ບໍ່ມີພິກັດ** — ແຍກຕາມສາຍງານ */
  without_gps: { repair: number; install: number };
};

type Row = Omit<MapPin, "workflow" | "tech"> & { tech_code: string | null };

/** ພິກັດຂອງໃບງານ ຫຼື ຖ້າບໍ່ມີ ເອົາຈຸດ check-in ຄັ້ງລ່າສຸດ */
const COORD = (table: "repair" | "install") => `
  coalesce(a.location_lat, (select c.checkin_lat from ods_job_checkin c
    where c.workflow = '${table}' and c.job_code = a.code and c.checkin_lat is not null
    order by c.id desc limit 1))`;
const COORD_LNG = (table: "repair" | "install") => `
  coalesce(a.location_lng, (select c.checkin_lng from ods_job_checkin c
    where c.workflow = '${table}' and c.job_code = a.code and c.checkin_lng is not null
    order by c.id desc limit 1))`;

export async function mobileMapPending(): Promise<MobileMap> {
  const techs = await listTechnicians();
  const nameOf = new Map(techs.map((tech) => [tech.code, tech.name]));

  const [repair, install, missing] = await Promise.all([
    query<Row>(
      `select a.code, ${COORD("repair")}::float8 lat, ${COORD_LNG("repair")}::float8 lng,
          coalesce(a.name_1,'') title,
          c.name_1 customer,
          nullif(trim(a.emp_code),'') tech_code,
          (${STAGE_LABEL_SQL}) stage_label,
          extract(day from localtimestamp - coalesce(a.time_register, a.create_date_time_now))::int age_days,
          a.service_type,
          case when a.location_lat is not null then 'job' else 'checkin' end source
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where ${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL}
         and ${COORD("repair")} is not null and ${COORD_LNG("repair")} is not null`,
    ),
    query<Row>(
      `select a.code, ${COORD("install")}::float8 lat, ${COORD_LNG("install")}::float8 lng,
          coalesce(a.item_name,'') title,
          c.name_1 customer,
          nullif(trim(a.tech_code),'') tech_code,
          (${INSTALL_STAGE_LABEL_SQL}) stage_label,
          extract(day from localtimestamp - a.time_register)::int age_days,
          null as service_type,
          case when a.location_lat is not null then 'job' else 'checkin' end source
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
       where ${INSTALL_OPEN}
         and ${COORD("install")} is not null and ${COORD_LNG("install")} is not null`,
    ),
    query<{ repair: number; install: number }>(
      `select
         (select count(*) from tb_product a
           where ${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL}
             and ${COORD("repair")} is null)::int repair,
         (select count(*) from ods_tb_install a
           where ${INSTALL_OPEN} and ${COORD("install")} is null)::int install`,
    ),
  ]);

  const toPin = (row: Row, workflow: "repair" | "install"): MapPin => ({
    ...row,
    workflow,
    tech: row.tech_code ? (nameOf.get(row.tech_code) ?? row.tech_code) : null,
  });

  return {
    // ຄ້າງດົນສຸດຂຶ້ນກ່ອນ — ແອັບເອົາລຳດັບນີ້ໄປໃຊ້ຕອນລວມໝຸດທີ່ຊ້ອນກັນ
    pins: [
      ...repair.rows.map((row) => toPin(row, "repair")),
      ...install.rows.map((row) => toPin(row, "install")),
    ].sort((a, b) => b.age_days - a.age_days),
    without_gps: missing.rows[0] ?? { repair: 0, install: 0 },
  };
}
