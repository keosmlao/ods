
/**
 * **ຄີພ້ອມໃຊ້ບໍ — ນິຍາມບ່ອນດຽວ** (ໜ້າ /assistant ແລະ route ໃຊ້ຮ່ວມກັນ).
 * ບໍ່ພຽງແຕ່ກວດວ່າ "ມີຄ່າ": ຄ່າຫຼອກແບບ `...` ຜ່ານດ່ານ `if (!key)` ໄດ້ ⇒ ໜ້າຈະບອກວ່າ
 * "ພ້ອມ" ແຕ່ພໍຖາມຈິງກັບລົ້ມ 401 (ເກີດຂຶ້ນຈິງມາແລ້ວ).
 * ໃຊ້ endpoint OpenAI-compatible (Groq…) ⇒ ຕ້ອງມີທັງ base URL (http…) ແລະ ຄີ (>20 ຕົວ).
 */
export function assistantReady() {
  const base = (process.env.LOCAL_AI_BASE_URL ?? "").trim();
  const key = (process.env.LOCAL_AI_API_KEY ?? "").trim();
  return base.startsWith("http") && key.length > 20;
}
import type { Session } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { ownJobsOnly } from "@/lib/scope";
import {
  REPAIR_STAGE_OVERDUE_SQL,
  REPAIR_STAGE_SLA_HOURS_SQL,
} from "@/lib/repair-sla";
import {
  OPEN_JOBS,
  stageLabel,
  STAGE_ELAPSED_SQL,
  STAGE_LABEL_SQL,
  STAGE_SQL,
} from "@/lib/stage";

/**
 * ນິຍາມເຄື່ອງມື — **ເປັນກາງ ບໍ່ຜູກກັບ SDK ຂອງຜູ້ໃຫ້ບໍລິການໃດ**.
 * ເຄີຍຜູກກັບ type ຂອງ SDK ໂດຍກົງ ⇒ ພໍປ່ຽນຜູ້ໃຫ້ບໍລິການ ໄຟລ໌ນີ້ພັງນຳທັງທີ່ບໍ່ກ່ຽວ.
 * ດຽວນີ້ route ເປັນຄົນແປງເປັນຮູບແບບຂອງເຈົ້ານັ້ນ (ເບິ່ງ api/assistant/route.ts).
 *
 * `input_schema` = JSON Schema ມາດຕະຖານ. ຄ່າທີ່ AI ສົ່ງມາຖືກກວດ/ຕັດຢູ່ຟັງຊັນຂອງມັນເອງ
 * ອີກຊັ້ນ (ເຊັ່ນ `Math.min(30, ...)` ຂອງ searchJobs) ⇒ ບໍ່ໄດ້ເຊື່ອ AI ຢູ່ດີ.
 */
export type AssistantTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: "get_job_status",
    description: "Find repair jobs by exact/partial job code or serial number and return current workflow, assignee and SLA facts.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string", description: "Job code or product serial number." } },
      required: ["search"],
      additionalProperties: false,
    },
  },
  {
    name: "search_jobs",
    description: "List open repair jobs using optional workflow stage, technician, service type and overdue filters.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: ["integer", "null"], minimum: 1, maximum: 12 },
        technician: { type: ["string", "null"] },
        service_type: { type: ["string", "null"], enum: ["CI", "ST", "IH", "PS", null] },
        overdue: { type: ["boolean", "null"] },
        limit: { type: "integer", minimum: 1, maximum: 30 },
      },
      required: ["stage", "technician", "service_type", "overdue", "limit"],
      additionalProperties: false,
    },
  },
  {
    name: "get_stock",
    description: "Search ERP spare parts by item code or Lao/English name and return real stock split by warehouse and location.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string", description: "Spare item code or name." } },
      required: ["search"],
      additionalProperties: false,
    },
  },
  {
    name: "get_sla_summary",
    description: "Summarize current open repair jobs and overdue counts by workflow stage, optionally filtered by service type.",
    input_schema: {
      type: "object",
      properties: {
        service_type: { type: ["string", "null"], enum: ["CI", "ST", "IH", "PS", null] },
      },
      required: ["service_type"],
      additionalProperties: false,
    },
  },
];

type JobRow = {
  code: string;
  product: string | null;
  sn: string | null;
  customer: string | null;
  technician: string | null;
  service_type: string | null;
  stage: number;
  stage_label: string;
  stage_hours: number | null;
  sla_hours: number | null;
  overdue: boolean;
  registered_at: string | null;
};

const ownerClause = (session: Session, params: unknown[]) => {
  const owner = ownJobsOnly(session);
  if (!owner) return "true";
  params.push(owner);
  return `a.emp_code=$${params.length}`;
};

const JOB_SELECT = `select a.code, concat_ws(' · ',a.name_1,a.p_model) product, a.sn,
    b.name_1 customer, a.emp_code technician, a.service_type,
    (${STAGE_SQL})::int stage, (${STAGE_LABEL_SQL}) stage_label,
    round((${STAGE_ELAPSED_SQL})::numeric/3600,1)::float stage_hours,
    (${REPAIR_STAGE_SLA_HOURS_SQL})::float sla_hours,
    coalesce((${REPAIR_STAGE_OVERDUE_SQL}),false) overdue,
    to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered_at
  from tb_product a left join ar_customer b on b.code=a.cust_code`;

async function getJobStatus(session: Session, args: { search: string }) {
  const value = args.search.trim();
  if (!value) return { jobs: [] };
  const params: unknown[] = [`%${value}%`];
  const owner = ownerClause(session, params);
  params.push(value);
  const exact = `$${params.length}`;
  const result = await query<JobRow>(
    `${JOB_SELECT}
      where ${owner} and (a.code ilike $1 or a.sn ilike $1)
      order by case when lower(a.code)=lower(${exact}) then 0 else 1 end, a.time_register desc limit 8`,
    params,
  );
  return { jobs: result.rows };
}

type SearchArgs = {
  stage: number | null;
  technician: string | null;
  service_type: "CI" | "ST" | "IH" | "PS" | null;
  overdue: boolean | null;
  limit: number;
};

async function searchJobs(session: Session, args: SearchArgs) {
  const params: unknown[] = [];
  const where = [OPEN_JOBS, ownerClause(session, params)];
  if (args.stage != null) {
    params.push(args.stage);
    where.push(`(${STAGE_SQL})=$${params.length}`);
  }
  // ຊ່າງຖືກ ownerClause ລັອກໄວ້ແລ້ວ; ຄ່າ technician ຈາກ model ຈຶ່ງບໍ່ສາມາດຂ້າມ scope.
  if (args.technician?.trim()) {
    params.push(args.technician.trim());
    where.push(`a.emp_code=$${params.length}`);
  }
  if (args.service_type) {
    params.push(args.service_type);
    where.push(`a.service_type=$${params.length}`);
  }
  if (args.overdue === true) where.push(`(${REPAIR_STAGE_OVERDUE_SQL})`);
  if (args.overdue === false) where.push(`not (${REPAIR_STAGE_OVERDUE_SQL})`);
  params.push(Math.min(30, Math.max(1, Number(args.limit) || 10)));
  const result = await query<JobRow>(
    `${JOB_SELECT} where ${where.join(" and ")}
      order by (${STAGE_ELAPSED_SQL}) desc nulls last limit $${params.length}`,
    params,
  );
  return { jobs: result.rows, count_returned: result.rows.length };
}

type StockRow = {
  item_code: string;
  item_name: string | null;
  warehouse: string | null;
  location: string | null;
  qty: number;
};

async function getStock(args: { search: string }) {
  const search = args.search.trim();
  if (!search) return { items: [] };
  const rows = await queryOdg<StockRow>(
    `with items as (
       select code item_code,name_1 item_name
         from ic_inventory
        where code ilike $1 or name_1 ilike $1
        order by case when lower(code)=lower($2) then 0 else 1 end, code
        limit 10
     )
     select i.item_code,i.item_name,b.warehouse,b.location,
       coalesce(sum(coalesce(b.balance_qty,0)),0)::float qty
       from items i
       left join lateral sml_ic_function_stock_balance_warehouse_location('2099-12-31',i.item_code,'','') b on true
      group by i.item_code,i.item_name,b.warehouse,b.location
      order by i.item_code,b.warehouse,b.location`,
    [`%${search}%`, search],
  );
  const items = new Map<string, { item_code: string; item_name: string | null; total: number; locations: StockRow[] }>();
  for (const row of rows.rows) {
    const item = items.get(row.item_code) ?? { item_code: row.item_code, item_name: row.item_name, total: 0, locations: [] };
    const qty = Number(row.qty ?? 0);
    item.total += qty;
    if (row.warehouse && qty !== 0) item.locations.push({ ...row, qty });
    items.set(row.item_code, item);
  }
  return { items: [...items.values()] };
}

async function getSlaSummary(session: Session, args: { service_type: "CI" | "ST" | "IH" | "PS" | null }) {
  const params: unknown[] = [];
  const where = [OPEN_JOBS, ownerClause(session, params)];
  if (args.service_type) {
    params.push(args.service_type);
    where.push(`a.service_type=$${params.length}`);
  }
  const rows = await query<{ stage: number; total: number; overdue: number; avg_hours: number | null }>(
    `select (${STAGE_SQL})::int stage, count(*)::int total,
       count(*) filter(where ${REPAIR_STAGE_OVERDUE_SQL})::int overdue,
       round(avg((${STAGE_ELAPSED_SQL})::numeric/3600),1)::float avg_hours
       from tb_product a where ${where.join(" and ")}
      group by (${STAGE_SQL}) order by stage`,
    params,
  );
  return {
    service_type: args.service_type ?? "all",
    stages: rows.rows.map((row) => ({ ...row, stage_label: stageLabel(row.stage, args.service_type) })),
  };
}

/** ຮັບ `args` ເປັນ object ແລ້ວ — Claude ສົ່ງ `tool_use.input` ມາເປັນ object (OpenAI ສົ່ງເປັນ string) */
export async function executeAssistantTool(session: Session, name: string, args: unknown) {
  switch (name) {
    case "get_job_status":
      return getJobStatus(session, args as { search: string });
    case "search_jobs":
      return searchJobs(session, args as SearchArgs);
    case "get_stock":
      return getStock(args as { search: string });
    case "get_sla_summary":
      return getSlaSummary(session, args as { service_type: "CI" | "ST" | "IH" | "PS" | null });
    default:
      return { error: "Unknown read-only tool" };
  }
}
