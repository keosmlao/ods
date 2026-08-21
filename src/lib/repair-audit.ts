import { query } from "@/lib/db";
import { employeeNameMap, resolveName } from "@/lib/employee-names";
import { holdJsonSql, type JobHold } from "@/lib/job-hold";
import { ACTOR_LABEL, nextActor, type NextAction, type SpareSummary } from "@/lib/repair-next-action";
import {
  analyzeRepairJob,
  ANOMALY_LABEL,
  AUDIT_CHECKPOINTS,
  AUDIT_FLAG_LABEL,
  auditCauseLabel,
  formatSpan,
  isAuditProblem,
  type AuditFlag,
  type AuditResult,
  type CheckpointKey,
} from "@/lib/repair-audit-check";
import { REPAIR_SERVICE_TYPES, REPAIR_STAGE_POLICY, repairStageTargetHours } from "@/lib/repair-sla";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { NOT_CLAIM, NOT_MISSING, stageLabel, STAGE_SQL } from "@/lib/stage";

/**
 * **ຂໍ້ມູນຂອງໜ້າ "ກວດສອບງານສ້ອມແປງ"** (/reports/repair-audit).
 *
 * ── ໜ້ານີ້ຕ່າງຈາກ /reports/kpi ແນວໃດ ──
 * KPI ບອກ **ຄ່າລວມ**: "ຂັ້ນ 6 ທັນ SLA 54%". ດີສຳລັບເບິ່ງແນວໂນ້ມ ແຕ່ເອົາໄປລົງມືບໍ່ໄດ້ —
 * ບໍ່ຮູ້ວ່າ **ໃບໃດ** ຄ້າງ, ຄ້າງຍ້ອນຫຍັງ, ໃຜຕ້ອງແກ້. ໜ້ານີ້ເປັນ **ລາຍໃບ**: ງານໃດເກີນ SLA
 * ຫຼາຍເທົ່າ · timeline ຂອງໃບໃດຜິດຂັ້ນຕອນ · ໃຜຮັບຜິດຊອບຢູ່ຂັ້ນປັດຈຸບັນ · ແລະ **ມີບ່ອນໃຫ້
 * ຄົນຊີ້ແຈງ** (ສາເຫດ + ຜູ້ຮັບຜິດຊອບ + ໄຟລ໌ແນບ) ຈຶ່ງກາຍເປັນວົງຮອບການແກ້ໄຂ ບໍ່ແມ່ນພຽງລາຍງານ.
 *
 * ── ຂອບເຂດຂໍ້ມູນ ──
 * ງານສ້ອມ (ບໍ່ລວມເຄມ — ມີສາຍງານ ແລະ ລາຍງານຂອງຕົນ) ທີ່ **ຍັງບໍ່ຈົບ** ຫຼື **ຈົບໃນຊ່ວງວັນທີ**.
 * ງານທີ່ຮ້ອງຂໍຍົກເລີກແຕ່ຍັງບໍ່ອະນຸມັດ (stage -1) ຕັດອອກ ຄືກັບຄິວອື່ນ (NOT_PENDING_CANCEL)
 * — ມັນຢູ່ຄິວອະນຸມັດ ຍັງບໍ່ແມ່ນວຽກສ້ອມ.
 */

export type AuditScope = "open" | "all";

export type RepairAuditFilters = {
  /** ວັນທີຮັບເຄື່ອງ (YYYY-MM-DD) — ກັ່ນຕອງງານທີ່ຈົບແລ້ວ; ງານທີ່ຍັງຄ້າງເອົາໝົດສະເໝີ */
  from: string;
  to: string;
  scope: AuditScope;
  /** ປະເພດບໍລິການ CI/ST/IH/PS (ຫວ່າງ = ທຸກປະເພດ) */
  service?: string;
};

export type AuditNote = {
  id: number;
  cause: string;
  causeLabel: string;
  reason: string;
  ownerDept: string | null;
  ownerPerson: string | null;
  stageAt: number | null;
  createdBy: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedNote: string | null;
  files: { id: number; name: string; stored: string }[];
};

export type RepairAuditRow = {
  code: string;
  product: string | null;
  sn: string | null;
  brand: string | null;
  model: string | null;
  customer: string | null;
  serviceType: string | null;
  serviceLabel: string;
  stage: number;
  stageLabel: string;
  /** ຝ່າຍທີ່ SLA ກຳນົດວ່າຮັບຜິດຊອບຂັ້ນນີ້ (REPAIR_STAGE_POLICIES.owner) */
  ownerDept: string;
  /** ຄົນ/ໜ້າວຽກທີ່ຕ້ອງລົງມືຕໍ່ດຽວນີ້ (lib/repair-next-action) */
  next: NextAction | null;
  tech: string;
  receivedBy: string;
  registeredAt: string | null;
  returnedAt: string | null;
  open: boolean;
  cancelled: boolean;
  hold: JobHold | null;
  analysis: AuditResult;
  note: AuditNote | null;
  /** ມີບັນທຶກຊີ້ແຈງທີ່ຍັງເປີດຢູ່ບໍ */
  noted: boolean;
};

/** ຖັນເວລາຂອງທຸກຈຸດກວດ — ສ້າງຈາກ AUDIT_CHECKPOINTS ບ່ອນດຽວ (ບໍ່ພິມຊື່ຖັນຊ້ຳ) */
const CHECKPOINT_SELECT = AUDIT_CHECKPOINTS.map(
  (point) => `extract(epoch from ${point.column})::float ck_${point.key}`,
).join(",\n      ");

/**
 * ຍອດແຖວ SIO ຂອງງານ — ໃຫ້ `nextActor()` ຕັດສິນວ່າ "ລໍສາງ" ຫຼື "ລໍຈັດຊື້" ໄດ້ຖືກຕ້ອງ
 * (ເອກະສານເປັນຄວາມຈິງ — ເບິ່ງໝາຍເຫດໃນ lib/repair-next-action).
 */
const SPARE_SUMMARY_SQL = `(
  select json_build_object(
      'pending', count(*) filter (where coalesce(d.status,0) = ${LINE_STATUS.PENDING}),
      'onOrder', count(*) filter (where d.status = ${LINE_STATUS.ON_PURCHASE_ORDER} and d.arrive_at is null),
      'arrived', count(*) filter (where d.status = ${LINE_STATUS.ON_PURCHASE_ORDER} and d.arrive_at is not null))
    from ic_trans_detail d
   where d.product_code = a.code and d.trans_flag = ${TRANS.REQUEST}
) as spare_lines`;

/** ບັນທຶກຊີ້ແຈງ**ອັນທີ່ຍັງເປີດ** + ໄຟລ໌ແນບ (ປະຫວັດເກົ່າເບິ່ງໄດ້ຢູ່ໜ້າງານ) */
const NOTE_SQL = `(
  select json_build_object(
      'id', n.id, 'cause', n.cause, 'reason', n.reason,
      'ownerDept', n.owner_dept, 'ownerPerson', n.owner_person, 'stageAt', n.stage_at,
      'createdBy', n.created_by, 'createdAt', to_char(n.created_at,'DD-MM-YYYY HH24:MI'),
      'resolvedAt', to_char(n.resolved_at,'DD-MM-YYYY HH24:MI'),
      'resolvedBy', n.resolved_by, 'resolvedNote', n.resolved_note,
      'files', coalesce((select json_agg(json_build_object('id', f.id, 'name', f.original_name, 'stored', f.stored_name)
                                          order by f.id)
                           from ods_repair_audit_file f where f.audit_id = n.id), '[]'::json))
    from ods_repair_audit n
   where n.job_code = a.code and n.resolved_at is null
   order by n.id desc limit 1
) as note`;

type Raw = {
  code: string;
  product: string | null;
  sn: string | null;
  brand: string | null;
  model: string | null;
  customer: string | null;
  service_type: string | null;
  warranty: string | null;
  used_spare: number | null;
  stage: number;
  emp_code: string | null;
  user_regis: string | null;
  cancelled: boolean;
  registered_at: string | null;
  returned_at: string | null;
  is_open: boolean;
  now_epoch: number;
  open_until: number;
  hold: JobHold | null;
  spare_lines: { pending: number; onOrder: number; arrived: number } | null;
  note: (Omit<AuditNote, "causeLabel"> & { causeLabel?: string }) | null;
} & Record<string, unknown>;

/**
 * ດຶງ + ກວດ ງານສ້ອມທັງໝົດຕາມຕົວກອງ. ຄິດຄຳນວນຢູ່ JS (analyzeRepairJob) ບໍ່ແມ່ນ SQL:
 * ກົດເກນ "ຜິດປົກກະຕິ" ຕ້ອງອະທິບາຍເປັນຂໍ້ຄວາມໃຫ້ຄົນອ່ານ ແລະ ຕ້ອງທົດສອບໄດ້ —
 * ຂຽນເປັນ case ໃນ SQL ຈະໄດ້ boolean ລ້ວນທີ່ບອກ **ເຫດຜົນ**ບໍ່ໄດ້ ແລະ ທົດສອບຍາກ.
 * ຈຳນວນແຖວນ້ອຍ (ງານຄ້າງ ~90 ໃບ · ລວມທີ່ຈົບໃນ 90 ມື້ ~630 ໃບ) ⇒ ຄິດຢູ່ JS ໄວພຽງພໍ.
 */
export async function fetchRepairAudit(filters: RepairAuditFilters): Promise<RepairAuditRow[]> {
  const service = REPAIR_SERVICE_TYPES.includes(filters.service as never) ? filters.service : null;

  const rows = (
    await query<Raw>(
      `select a.code, a.name_1 product, nullif(a.sn,'') sn, nullif(a.p_brand,'') brand, nullif(a.p_model,'') model,
          nullif(b.name_1,'') customer, a.service_type, a.warrunty warranty, coalesce(a.used_spare,0) used_spare,
          (${STAGE_SQL})::int stage,
          nullif(a.emp_code,'') emp_code, nullif(a.user_regis,'') user_regis,
          (a.status = 6) cancelled,
          to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered_at,
          to_char(a.return_complete,'DD-MM-YYYY HH24:MI') returned_at,
          (a.return_complete is null) is_open,
          extract(epoch from localtimestamp)::float now_epoch,
          -- ນາລິກາຂັ້ນທີ່ຍັງເປີດ ຢຸດຢູ່ຈຸດທີ່ຖືກໝາຍ "ວຽກມີບັນຫາ" (ຄືກັບ STAGE_ELAPSED_SQL)
          extract(epoch from coalesce(
            (select h.created_at from ods_job_hold h
              where h.workflow = 'repair' and h.job_code = a.code and h.resolved_at is null limit 1),
            localtimestamp))::float open_until,
          ${holdJsonSql("repair")},
          ${SPARE_SUMMARY_SQL},
          ${NOTE_SQL},
          ${CHECKPOINT_SELECT}
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
       where ${NOT_CLAIM} and ${NOT_MISSING}
         and not (a.status = 6 and a.cancel_finish is null)
         and ($3 = '' or coalesce(a.service_type,'') = $3)
         and (a.return_complete is null
              or ($4 and a.time_register::date between $1::date and $2::date))
       order by a.time_register desc`,
      [filters.from, filters.to, service ?? "", filters.scope === "all"],
    )
  ).rows;

  // ຊື່ພະນັກງານ: emp_code/user_regis ບາງໃບເກັບເປັນລະຫັດ ⇒ ແປເປັນຊື່ (lib/employee-names)
  const names = await employeeNameMap(rows.flatMap((row) => [row.emp_code, row.user_regis]));

  return rows.map((row) => {
    const points: Partial<Record<CheckpointKey, number | null>> = {};
    for (const point of AUDIT_CHECKPOINTS) {
      const value = row[`ck_${point.key}`];
      points[point.key] = typeof value === "number" ? value : null;
    }

    const analysis = analyzeRepairJob(
      {
        code: row.code,
        serviceType: row.service_type,
        warrantyExpired: row.warranty === "ໝົດຮັບປະກັນ",
        usedSpare: Number(row.used_spare) === 1,
        stage: row.stage,
        cancelled: row.cancelled,
        hasTech: Boolean(row.emp_code),
        now: row.now_epoch,
        openUntil: row.is_open ? row.open_until : row.now_epoch,
        points,
      },
      repairStageTargetHours,
    );

    // SQL ນັບມາໃນຮູບ SpareSummary ພໍດີແລ້ວ (ບໍ່ຕ້ອງດຶງທຸກແຖວມານັບຢູ່ JS)
    const spare: SpareSummary | null = row.spare_lines;

    const note: AuditNote | null = row.note
      ? { ...row.note, causeLabel: auditCauseLabel(row.note.cause), files: row.note.files ?? [] }
      : null;

    return {
      code: row.code,
      product: row.product,
      sn: row.sn,
      brand: row.brand,
      model: row.model,
      customer: row.customer,
      serviceType: row.service_type,
      serviceLabel: row.service_type ? (SERVICE_TYPE_LABEL[row.service_type] ?? row.service_type) : "-",
      stage: row.stage,
      stageLabel: stageLabel(row.stage, row.service_type),
      // ຂັ້ນ 12 (ຈົບ) ແລະ -1 (ລໍອະນຸມັດຍົກເລີກ) ບໍ່ມີແຖວໃນຕາຕະລາງ SLA ⇒ ບອກຕາມຄວາມຈິງ
      ownerDept: REPAIR_STAGE_POLICY.get(row.stage)?.owner ?? (row.is_open ? "-" : "ປິດງານແລ້ວ"),
      next: row.is_open ? nextActor(row.stage, spare, row.service_type) : null,
      tech: resolveName(row.emp_code, names),
      receivedBy: resolveName(row.user_regis, names),
      registeredAt: row.registered_at,
      returnedAt: row.returned_at,
      open: row.is_open,
      cancelled: row.cancelled,
      hold: row.hold,
      analysis,
      note,
      noted: Boolean(note),
    };
  });
}

/* ────────────────────────────────────────────────────────────────── ຕົວກອງ / ສະຫຼຸບ */

export type AuditTab = "problem" | "anomaly" | "late" | "noted" | "all";

export const AUDIT_TAB_LABEL: Record<AuditTab, string> = {
  problem: "ງານຜິດປົກກະຕິ",
  anomaly: "timeline ຜິດຂັ້ນຕອນ",
  late: "ເກີນ SLA",
  noted: "ມີບັນທຶກຊີ້ແຈງ",
  all: "ທັງໝົດ",
};

/** ແທັບຕັ້ງຕົ້ນ = ງານທີ່ຕ້ອງລົງມື — ບໍ່ແມ່ນ "ທັງໝົດ" (ເປີດມາເຫັນ 600 ແຖວ ແລ້ວບໍ່ຮູ້ເລີ່ມໃສ) */
export const isAuditTab = (value: string | undefined): value is AuditTab =>
  value != null && value in AUDIT_TAB_LABEL;

/**
 * ຄົ້ນຫາໃນແຖວທີ່ດຶງມາແລ້ວ — **ໜ້າຈໍ ແລະ route export ໃຊ້ອັນນີ້ອັນດຽວກັນ**
 * ⇒ ໄຟລ໌ Excel ໄດ້ແຖວຊຸດດຽວກັບທີ່ຄົນເຫັນສະເໝີ (ຄືແນວຄິດຂອງ searchRows ໃນ lib/report-sql).
 */
export function searchAudit(rows: RepairAuditRow[], q: string): RepairAuditRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.code, row.product, row.sn, row.customer, row.tech, row.note?.reason]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );
}

export function filterByTab(rows: RepairAuditRow[], tab: AuditTab): RepairAuditRow[] {
  if (tab === "problem") return rows.filter((row) => isAuditProblem(row.analysis));
  if (tab === "anomaly") return rows.filter((row) => row.analysis.broken);
  if (tab === "late") return rows.filter((row) => row.analysis.breaches.length > 0);
  if (tab === "noted") return rows.filter((row) => row.noted);
  return rows;
}

/**
 * ຮຽງ: timeline ຜິດ ແລະ ວິກິດກ່ອນ → ເກີນ SLA ຫຼາຍກ່ອນ → ງານທີ່ຍັງເປີດກ່ອນ.
 * ຄົນເປີດລາຍງານນີ້ຢາກເຫັນ "ອັນທີ່ຮ້ອນສຸດ" ແຖວທຳອິດ ບໍ່ແມ່ນອັນທີ່ໃໝ່ສຸດ.
 */
const FLAG_RANK: Record<AuditFlag, number> = { critical: 0, problem: 1, watch: 2, ok: 3 };

export function sortAudit(rows: RepairAuditRow[]): RepairAuditRow[] {
  return [...rows].sort((left, right) => {
    // timeline ຜິດ ຂຶ້ນກ່ອນທຸກອັນ — ມັນເປັນບັນຫາຂອງ **ຄວາມຖືກຕ້ອງຂອງຂໍ້ມູນ** ບໍ່ແມ່ນຄວາມຊ້າ
    const broken = Number(right.analysis.broken) - Number(left.analysis.broken);
    if (broken) return broken;
    const flag = FLAG_RANK[left.analysis.flag] - FLAG_RANK[right.analysis.flag];
    if (flag) return flag;
    const ratio = (right.analysis.worst?.ratio ?? 0) - (left.analysis.worst?.ratio ?? 0);
    if (ratio) return ratio;
    return Number(right.open) - Number(left.open);
  });
}

export type AuditSummary = {
  total: number;
  problem: number;
  anomaly: number;
  late: number;
  critical: number;
  noted: number;
  /** ງານຜິດປົກກະຕິທີ່ **ຍັງບໍ່ມີໃຜຊີ້ແຈງ** — ຕົວເລກທີ່ຫົວໜ້າຕ້ອງໄລ່ໃຫ້ເປັນ 0 */
  unexplained: number;
  /** ຂັ້ນທີ່ເປັນຄໍຂວດ (ນັບຈຳນວນງານທີ່ເກີນ SLA ຢູ່ຂັ້ນນັ້ນ) */
  byStage: { stage: number; label: string; owner: string; count: number }[];
};

export function auditSummary(rows: RepairAuditRow[]): AuditSummary {
  const byStage = new Map<number, number>();
  for (const row of rows) {
    for (const breach of row.analysis.breaches) {
      if ((breach.ratio ?? 0) < 1) continue;
      byStage.set(breach.stage, (byStage.get(breach.stage) ?? 0) + 1);
    }
  }
  const problems = rows.filter((row) => isAuditProblem(row.analysis));
  return {
    total: rows.length,
    problem: problems.length,
    anomaly: rows.filter((row) => row.analysis.broken).length,
    late: rows.filter((row) => row.analysis.breaches.length > 0).length,
    critical: rows.filter((row) => row.analysis.flag === "critical").length,
    noted: rows.filter((row) => row.noted).length,
    unexplained: problems.filter((row) => !row.noted).length,
    byStage: [...byStage.entries()]
      .map(([stage, count]) => ({
        stage,
        label: REPAIR_STAGE_POLICY.get(stage)?.label ?? stageLabel(stage),
        owner: REPAIR_STAGE_POLICY.get(stage)?.owner ?? "-",
        count,
      }))
      .sort((left, right) => right.count - left.count),
  };
}

/* ────────────────────────────────────────────────────────────────────────── Excel */

export type AuditSheets = {
  jobs: Record<string, string | number | null>[];
  stages: Record<string, string | number | null>[];
  anomalies: Record<string, string | number | null>[];
};

/**
 * 3 sheet — ໃບງານ / ຂັ້ນທີ່ເກີນ SLA / timeline ຜິດປົກກະຕິ.
 * ແຍກ sheet ເພາະ 1 ໃບງານມີໄດ້ຫຼາຍຂັ້ນທີ່ເກີນ ແລະ ຫຼາຍຈຸດຜິດ — ຍັດລົງແຖວດຽວແລ້ວ
 * ຄົນເອົາໄປ pivot ຕໍ່ບໍ່ໄດ້ (ຄວາມຕ້ອງການຈິງຂອງລາຍງານນີ້ຄື "ດຶງໄປສະຫຼຸບຕໍ່").
 */
export function auditSheets(rows: RepairAuditRow[]): AuditSheets {
  const jobs = rows.map((row) => ({
    code: row.code,
    flag: AUDIT_FLAG_LABEL[row.analysis.flag],
    timeline: row.analysis.broken ? "ຜິດຂັ້ນຕອນ" : "-",
    product: row.product,
    sn: row.sn,
    brand: row.brand,
    customer: row.customer,
    service: row.serviceType,
    stage: `${row.stage}. ${row.stageLabel}`,
    owner: row.ownerDept,
    next: row.next ? `${ACTOR_LABEL[row.next.actor]} — ${row.next.action}` : "-",
    tech: row.tech,
    registered: row.registeredAt,
    returned: row.returnedAt ?? (row.open ? "ຍັງບໍ່ຈົບ" : "-"),
    total: formatSpan(row.analysis.totalSeconds),
    worst: row.analysis.worst
      ? `ຂັ້ນ ${row.analysis.worst.stage} — ${formatSpan(row.analysis.worst.seconds)} (SLA ${row.analysis.worst.targetHours} ຊມ)`
      : "-",
    ratio: row.analysis.worst?.ratio ? Math.round(row.analysis.worst.ratio * 10) / 10 : null,
    breaches: row.analysis.breaches.length,
    anomalies: row.analysis.anomalies.filter((item) => item.severity === "high").length,
    cause: row.note ? row.note.causeLabel : "-",
    reason: row.note?.reason ?? "-",
    responsible: row.note ? [row.note.ownerDept, row.note.ownerPerson].filter(Boolean).join(" / ") || "-" : "-",
    notedBy: row.note ? `${row.note.createdBy} · ${row.note.createdAt}` : "-",
    files: row.note?.files.length ?? 0,
  }));

  const stages = rows.flatMap((row) =>
    row.analysis.breaches.map((breach) => ({
      code: row.code,
      service: row.serviceType,
      stage: breach.stage,
      stageLabel: REPAIR_STAGE_POLICY.get(breach.stage)?.label ?? "-",
      owner: REPAIR_STAGE_POLICY.get(breach.stage)?.owner ?? "-",
      state: breach.state === "open" ? "ຍັງຄ້າງຢູ່ຂັ້ນນີ້" : "ຜ່ານໄປແລ້ວ",
      used: formatSpan(breach.seconds),
      sla: breach.targetHours,
      over: formatSpan(breach.overSeconds),
      ratio: breach.ratio ? Math.round(breach.ratio * 10) / 10 : null,
    })),
  );

  const anomalies = rows.flatMap((row) =>
    row.analysis.anomalies.map((item) => ({
      code: row.code,
      service: row.serviceType,
      stage: item.stage ?? null,
      kind: ANOMALY_LABEL[item.kind],
      severity: item.severity === "high" ? "ຜິດແທ້" : "ຂໍ້ສັງເກດ",
      detail: item.detail,
      cause: row.note?.causeLabel ?? "-",
      reason: row.note?.reason ?? "-",
    })),
  );

  return { jobs, stages, anomalies };
}
