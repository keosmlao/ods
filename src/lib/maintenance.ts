import { query, queryOdg } from "@/lib/db";
import {
  MAINTENANCE_ELAPSED_SQL,
  MAINTENANCE_OPEN,
  MAINTENANCE_STAGE_LABEL,
  MAINTENANCE_STAGE_SQL,
  maintenanceStageLabel,
} from "@/lib/maintenance-stage";

/**
 * ລະບົບ "ສ້ອມບໍລຸງ" — ນິຍາມ query ບ່ອນດຽວ (ຄູ່ກັບ lib/stock-count · lib/install-stage).
 * ຂັ້ນຄິດຈາກ timestamp (MAINTENANCE_STAGE_SQL) ⇒ ໜ້າ ກັບ badge ບໍ່ມີທາງຫຼົ້ນກັນ.
 */

export type MaintenanceJob = {
  code: string;
  cust_name: string | null;
  cust_tel: string | null;
  location: string | null;
  emp_code: string | null;
  appoint_date: string | null;
  stage: number;
  stage_label: string;
  elapsed_seconds: number | null;
  total: number;
  services: string | null;
  remark: string | null;
  next_due: string | null;
};

export type MaintenanceDetail = {
  id: number;
  service_code: string | null;
  name: string;
  qty: number;
  price: number;
};

export type MaintenanceCatalogItem = { code: string; name: string; default_price: number };

/** ຂັ້ນນຶ່ງໃນ timeline — ເວລາທີ່ເຂົ້າຂັ້ນ + ໄລຍະທີ່ຢູ່ຂັ້ນນັ້ນ */
export type MaintenanceStep = {
  stage: number;
  label: string;
  at: string | null;
  durationSeconds: number | null;
  state: "done" | "current" | "pending";
};

/** ຂັ້ນ → ຖັນເວລາທີ່ "ເຂົ້າຂັ້ນນັ້ນ" (ລຽງ 0..6) */
const STEP_COLS = ["time_register", "assign_time", "tech_confirm", "start_clean", "finish_clean", "qc_finish", "job_finish"];

type TimelineRow = { stage: number; now_epoch: number; ce: number | null; cs: string | null } & Record<string, number | string | null>;

function buildTimeline(r: TimelineRow): { steps: MaintenanceStep[]; cancelledAt: string | null } {
  const raw = STEP_COLS.map((_, i) => (r[`e${i}`] as number | null) ?? null);
  const disp = STEP_COLS.map((_, i) => (r[`s${i}`] as string | null) ?? null);
  const cancelled = r.stage === -1;
  // ເວລາເຂົ້າຂັ້ນ (backfill ໃຫ້ຂັ້ນທີ່ຖືກຂ້າມໄດ້ຄ່າຂອງຂັ້ນກ່ອນ) — e0 (ເປີດງານ) ມີສະເໝີ
  const filled: number[] = [];
  raw.forEach((v, i) => { filled[i] = v ?? (i > 0 ? filled[i - 1] : (v ?? r.now_epoch)); });
  // ຂັ້ນປັດຈຸບັນ: ຖ້າຍົກເລີກ = ຂັ້ນສຸດທ້າຍທີ່ໄປຮອດ (raw ບໍ່ null); ບໍ່ດັ່ງນັ້ນ = stage
  let current = cancelled ? 0 : r.stage;
  if (cancelled) raw.forEach((v, i) => { if (v != null) current = i; });
  const endpoint = cancelled && r.ce != null ? r.ce : r.now_epoch;

  const steps: MaintenanceStep[] = STEP_COLS.map((_, i) => {
    const label = MAINTENANCE_STAGE_LABEL[i];
    let state: MaintenanceStep["state"];
    let durationSeconds: number | null = null;
    let at = disp[i];
    if (i < current) {
      state = "done";
      durationSeconds = filled[i + 1] - filled[i];
    } else if (i === current) {
      state = i === 6 ? "done" : cancelled ? "done" : "current";
      durationSeconds = i === 6 ? null : endpoint - filled[i];
    } else {
      state = "pending";
      at = null;
    }
    if (durationSeconds != null && durationSeconds < 0) durationSeconds = 0;
    return { stage: i, label, at, durationSeconds, state };
  });
  return { steps, cancelledAt: cancelled ? r.cs : null };
}

const JOB_SELECT = `select a.code, a.cust_name, a.cust_tel, a.location, a.emp_code,
    to_char(a.appoint_date,'YYYY-MM-DD') appoint_date,
    (${MAINTENANCE_STAGE_SQL})::int stage,
    (${MAINTENANCE_ELAPSED_SQL}) elapsed_seconds,
    coalesce(a.total,0)::float total, a.remark,
    to_char(a.next_due,'YYYY-MM-DD') next_due,
    (select string_agg(d.name, ', ') from ods_tb_maintenance_detail d where d.job_code = a.code) services
  from ods_tb_maintenance a`;

const mapJob = (row: Omit<MaintenanceJob, "stage_label">): MaintenanceJob => ({
  ...row,
  stage_label: maintenanceStageLabel(row.stage),
});

/** ໃບງານທັງໝົດ (ຄ້າງ default) — ຮຽງງານໃໝ່ກ່ອນ. tech = ກອງສະເພາະຊ່າງນັ້ນ · stage = ກອງຂັ້ນ. */
export async function maintenanceJobs(
  opts: { tech?: string | null; includeClosed?: boolean; stage?: number } = {},
): Promise<MaintenanceJob[]> {
  const where = [opts.includeClosed ? "a.cancel_date is null" : MAINTENANCE_OPEN];
  const args: string[] = [];
  if (opts.tech) {
    args.push(opts.tech);
    where.push(`a.emp_code = $${args.length}`);
  }
  if (opts.stage != null) where.push(`(${MAINTENANCE_STAGE_SQL}) = ${Number(opts.stage)}`);
  const rows = (
    await query<Omit<MaintenanceJob, "stage_label">>(
      `${JOB_SELECT} where ${where.join(" and ")} order by a.time_register desc`,
      args,
    )
  ).rows;
  return rows.map(mapJob);
}

/** 1 ໃບງານ + ລາຍການບໍລິການ + timeline (ໄລຍະເວລາຕໍ່ຂັ້ນ) */
export async function maintenanceJob(
  code: string,
): Promise<{ job: MaintenanceJob; details: MaintenanceDetail[]; steps: MaintenanceStep[]; cancelledAt: string | null } | null> {
  const job = (await query<Omit<MaintenanceJob, "stage_label">>(`${JOB_SELECT} where a.code = $1`, [code])).rows[0];
  if (!job) return null;
  const details = (
    await query<MaintenanceDetail>(
      `select id, service_code, name, coalesce(qty,1)::int qty, coalesce(price,0)::float price
         from ods_tb_maintenance_detail where job_code = $1 order by id`,
      [code],
    )
  ).rows;
  // timeline — epoch (ໄລ່ໄລຍະ) + ຂໍ້ຄວາມ (ສະແດງ) ຂອງແຕ່ລະຖັນເວລາ
  const tl = STEP_COLS.map((col, i) => `extract(epoch from a.${col})::float e${i}, to_char(a.${col},'DD-MM-YYYY HH24:MI') s${i}`).join(",\n    ");
  const row = (
    await query<TimelineRow>(
      `select (${MAINTENANCE_STAGE_SQL})::int stage, extract(epoch from localtimestamp)::float now_epoch,
          extract(epoch from a.cancel_date)::float ce, to_char(a.cancel_date,'DD-MM-YYYY HH24:MI') cs,
          ${tl}
        from ods_tb_maintenance a where a.code = $1`,
      [code],
    )
  ).rows[0];
  const { steps, cancelledAt } = buildTimeline(row);
  return { job: mapJob(job), details, steps, cancelledAt };
}

/**
 * catalog ບໍລິການ — **ດຶງຈາກ ic_inventory ຂອງ ERP (queryOdg)** ບໍ່ແມ່ນຕາຕະລາງ seed.
 * ບໍລິການ = item_type=1 · code '9702%' (ຄ່າບໍລິການ ກວດເຊັກ/ລ້າງ/ແປງ ເຄື່ອງໃຊ້ໄຟຟ້າ —
 * ລ້າງແອ · ລ້າງຖັງຊັກຜ້າ · ກວດເຊັກຕູ້ເຢັນ...). ລາຄາ latest ຈາກ ic_inventory_price (ກີບ).
 * ⇒ ໜ້າຈໍ = catalog ຈິງຂອງ ERP. (ods_maintenance_service ບໍ່ໄດ້ໃຊ້ແລ້ວ.)
 */
export async function maintenanceCatalog(): Promise<MaintenanceCatalogItem[]> {
  return (
    await queryOdg<MaintenanceCatalogItem>(
      `select a.code, a.name_1 as name,
          coalesce((select p.sale_price1 from ic_inventory_price p
             where p.ic_code = a.code and current_date between p.from_date and p.to_date
               and p.currency_code = '01' order by p.from_date desc limit 1), 0)::float as default_price
        from ic_inventory a
       where a.code like '9702%' and a.item_type = 1 and coalesce(a.name_1,'') <> ''
       order by a.name_1`,
    )
  ).rows;
}

/** ຈຳນວນງານຄ້າງ — badge ຂ້າງເມນູ */
export async function openMaintenanceCount(): Promise<number> {
  const row = (await query<{ n: number }>(`select count(*)::int n from ods_tb_maintenance a where ${MAINTENANCE_OPEN}`)).rows[0];
  return row?.n ?? 0;
}
