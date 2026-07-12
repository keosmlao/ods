import type { PoolClient } from "pg";

/**
 * ຄ່າບໍລິການ ແລະ ຄ່າຄອມຂອງຊ່າງ.
 *
 * ── ຫຼັກການ ──
 * ① **ມິຕິຂອງອັດຕາມາຈາກ ERP ທັງໝົດ** (ອ່ານຢ່າງດຽວ):
 *      ໝວດ  ic_inventory.item_category → ic_category   ("ແອ", "ໂທລະທັດ")
 *      ແບບ  ic_inventory.item_design   → ic_design     ("ແອຕິດຝາ", "ແອແຄັດເສັດ", "ແອຕູ້ຕັ້ງ")
 *      ຂະໜາດ ic_inventory.item_size    → ic_size       ("11,000-14,999 btu." — ເປັນຊ່ວງພ້ອມແລ້ວ)
 *    ⇒ ບໍ່ຕ້ອງແກະ BTU/ນິ້ວ ອອກຈາກຂໍ້ຄວາມເອງ ແລະ ບໍ່ຕ້ອງເກັບຂະໜາດຊ້ຳໃນ ODS.
 *
 * ② **ແຊ່ເງິນຕອນປິດງານ** (ods_service_payout).
 *    ຫ້າມຄິດສົດທຸກຄັ້ງທີ່ເປີດລາຍງານ: ພໍປ່ຽນອັດຕາເດືອນໜ້າ ເງິນຂອງເດືອນທີ່ຈ່າຍໄປ
 *    ແລ້ວຈະປ່ຽນຕາມ. ບັນທຶກ ອັດຕາ · ເປີເຊັນ · ຈຳນວນ ໄວ້ຄົບຕອນນັ້ນເລີຍ.
 *
 * ③ **ບໍ່ຈ່າຍຜິດຄົນ**: ຊ່າງເອົາຈາກງານເອງ (ຄົນທີ່ຮັບງານ). ບົດບາດອື່ນ ຜູ້ຈັດການລະບຸ
 *    ຢູ່ ods_service_commission_payee — ຖ້າຍັງບໍ່ລະບຸ ບັນທຶກເງິນໄວ້ແຕ່ employee_code
 *    ເປັນ null (ຄ້າງລໍຜູ້ຮັບ) ບໍ່ແມ່ນຍັດໃສ່ໃຜຄົນນຶ່ງມົ້ວໆ.
 */

export type Workflow = "repair" | "install";

export const ROLE_LABEL: Record<string, string> = {
  supervisor: "ຜູ້ຄຸມ",
  team_lead: "ຫົວໜ້າທີມ",
  admin: "Admin",
  technician: "ຊ່າງ",
};

/** ມິຕິຂອງງານ — ດຶງມາຈາກ ERP ຜ່ານ item_code */
export type JobDims = {
  job_code: string;
  service_type: string | null;
  category_code: string | null;
  design_code: string | null;
  size_code: string | null;
  technician: string | null;
  closed_at: Date | null;
};

/**
 * ຫາອັດຕາທີ່ **ຕົງທີ່ສຸດ**.
 *
 * null ໃນແຖວອັດຕາ = "ທຸກອັນ" ⇒ ແຖວທີ່ລະບຸລະອຽດກວ່າຕ້ອງຊະນະ.
 * ໃຫ້ຄະແນນ: ຂະໜາດ 8 · ແບບ 4 · ໝວດ 2 · ປະເພດບໍລິການ 1 — ຮວມແລ້ວຮຽງລົງ.
 * ແຖວທີ່ **ຂັດກັນ** (ເຊັ່ນ ອັດຕາລະບຸໝວດ "ແອ" ແຕ່ງານເປັນ "ໂທລະທັດ") ຖືກຕັດອອກ.
 */
const MATCH_SQL = `
  select r.id, r.label, r.amount_thb,
      (case when r.size_code     is not null then 8 else 0 end)
    + (case when r.design_code   is not null then 4 else 0 end)
    + (case when r.category_code is not null then 2 else 0 end)
    + (case when r.service_type  is not null then 1 else 0 end) as score
  from ods_service_rate r
  where r.workflow = $1
    and r.is_active
    and r.effective_from <= current_date
    and (r.effective_to is null or r.effective_to >= current_date)
    and (r.service_type  is null or r.service_type  = $2)
    and (r.category_code is null or r.category_code = $3)
    and (r.design_code   is null or r.design_code   = $4)
    and (r.size_code     is null or r.size_code     = $5)
  order by score desc, r.id
  limit 1`;

export type MatchedRate = { id: number; label: string; amount_thb: string };

export async function matchRate(client: PoolClient, workflow: Workflow, dims: JobDims): Promise<MatchedRate | null> {
  const result = await client.query<MatchedRate>(MATCH_SQL, [
    workflow,
    dims.service_type,
    dims.category_code,
    dims.design_code,
    dims.size_code,
  ]);
  return result.rows[0] ?? null;
}

/**
 * ຄິດ ແລະ **ແຊ່** ຄ່າຄອມຂອງງານນຶ່ງງານ — ເອີ້ນຕອນປິດງານ.
 *
 * ບໍ່ໂຍນ error ຂຶ້ນມາ: ຖ້າຈັບຄູ່ອັດຕາບໍ່ໄດ້ ຫຼື ຍັງບໍ່ໄດ້ຕັ້ງອັດຕາເລີຍ ກໍ່ບໍ່ບັນທຶກ
 * ແລ້ວປ່ອຍໃຫ້ງານປິດຕາມປົກກະຕິ — **ການປິດງານຫ້າມພັງເພາະເລື່ອງເງິນ**.
 * ງານທີ່ຈັບຄູ່ບໍ່ໄດ້ຈະຂຶ້ນຢູ່ລາຍງານ "ຍັງບໍ່ໄດ້ຄິດຄ່າບໍລິການ" ໃຫ້ໄປແກ້.
 *
 * unique(workflow, job_code, role) ⇒ ເອີ້ນຊ້ຳບໍ່ຄິດເງິນຊ້ຳ.
 */
export async function computePayout(client: PoolClient, workflow: Workflow, dims: JobDims): Promise<void> {
  const rate = await matchRate(client, workflow, dims);
  if (!rate) return;

  /**
   * ຕົວຕົນຂອງຊ່າງ — ງານເກັບໄວ້ເປັນ **ຊື່ຜູ້ໃຊ້ ODS** ('Xiew', 'sak') ແຕ່ຜູ້ຮັບເງິນ
   * ບົດບາດອື່ນເປັນ employee_code ຂອງ ERP ⇒ ຖ້າປະໄວ້ ຈະຢູ່ຄົນລະລະບົບຕົວຕົນ
   * ແລະ ຈ່າຍເຂົ້າບັນຊີ ERP ບໍ່ໄດ້. ແປງຜ່ານສະພານ (ods_user_employee) ຕັ້ງແຕ່ຕອນ
   * **ແຊ່ເງິນ** ⇒ ຄ່າຄອມທຸກແຖວອອກມາເປັນລະຫັດອັນດຽວກັນ.
   * ຍັງບໍ່ເຊື່ອມ → ໃຊ້ຄ່າເດີມ (ບໍ່ຫາຍ ແຕ່ບໍ່ຜູກກັບ ERP — ຂຶ້ນເຕືອນຢູ່ /manage/technicians).
   */
  let technician = dims.technician;
  if (technician) {
    const linked = await client.query<{ employee_code: string }>(
      "select employee_code from ods_user_employee where user_code = $1",
      [technician],
    );
    technician = linked.rows[0]?.employee_code ?? technician;
  }

  const splits = await client.query<{ role: string; pct: string }>(
    "select role, pct from ods_service_commission_split where workflow = $1 and pct > 0",
    [workflow],
  );
  if (splits.rowCount === 0) return;

  const payees = await client.query<{ role: string; employee_code: string }>(
    "select role, employee_code from ods_service_commission_payee where workflow = $1",
    [workflow],
  );
  const payeeOf = new Map(payees.rows.map((row) => [row.role, row.employee_code]));

  const amount = Number(rate.amount_thb);

  for (const split of splits.rows) {
    const pct = Number(split.pct);
    // ຊ່າງ = ຄົນທີ່ຮັບງານ (ແປງເປັນ employee_code ແລ້ວ) · ບົດບາດອື່ນ = ຄົນທີ່ຜູ້ຈັດການລະບຸ
    const employee = split.role === "technician" ? technician : (payeeOf.get(split.role) ?? null);

    await client.query(
      `insert into ods_service_payout(
          workflow, job_code, rate_id, rate_label, amount_thb,
          role, employee_code, pct, pay_thb, closed_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,round($5::numeric * $8::numeric / 100, 2),$9)
       on conflict (workflow, job_code, role) do nothing`,
      [workflow, dims.job_code, rate.id, rate.label, amount, split.role, employee, pct, dims.closed_at],
    );
  }
}

/* ── ດຶງມິຕິຂອງງານ ─────────────────────────────────────────────── */

/**
 * ⚠️ ໝວດ/ແບບ/ຂະໜາດ ຢູ່ **ຖານ ERP** ຄົນລະຖານກັບງານ ⇒ join ຂ້າມຖານບໍ່ໄດ້.
 * ຈຶ່ງດຶງສອງຈັງຫວະ: ①ເອົາ item_code ຈາກ ODS ②ຖາມ ERP ດ້ວຍ item_code ນັ້ນ.
 */
export const JOB_DIMS_INSTALL_SQL = `select a.code as job_code, a.item_code,
    null::varchar as service_type, nullif(a.tech_code,'') as technician, a.job_finish as closed_at
  from ods_tb_install a where a.code = $1`;

export const JOB_DIMS_REPAIR_SQL = `select a.code as job_code, a.item_code,
    a.service_type, nullif(a.emp_code,'') as technician, a.return_complete as closed_at
  from tb_product a where a.code = $1`;

/** ຖາມ ERP ຫາ ໝວດ/ແບບ/ຂະໜາດ ຂອງລະຫັດສິນຄ້າ */
export const ERP_DIMS_SQL = `select item_category as category_code, item_design as design_code,
    item_size as size_code
  from ic_inventory where code = $1`;
