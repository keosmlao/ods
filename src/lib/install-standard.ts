import { query, queryOdg } from "@/lib/db";
// ດ່ານ "ນອກມາດຕະຖານ" ຢູ່ໄຟລ໌ -shared (ບໍ່ແຕະຖານ ⇒ ທົດສອບໄດ້) — ສົ່ງຕໍ່ໃຫ້ຜູ້ໃຊ້ເກົ່າ
export { outsideStandardCodes } from "@/lib/loaner-shared";

/**
 * ── ອາໄຫຼ່ "ຕາມມາດຕະຖານ" ຂອງງານຕິດຕັ້ງ ──
 *
 * ມີ **2 ແຫຼ່ງ ຕາມລຳດັບ**:
 *   ① `ods_install_spare_standard` — ນິຍາມເອງຢູ່ ODS ຕໍ່ **ໝວດສິນຄ້າ (+ຂະໜາດ)**
 *      (ຜູ້ຈັດການຕັ້ງທີ່ /manage/install-standard). ແຖວທີ່ລະບຸຂະໜາດຖືກໃຊ້ກ່ອນ
 *      ແຖວຂະໜາດຫວ່າງ (= ຄ່າຕັ້ງຕົ້ນຂອງໝວດ).
 *   ② ຖ້າຍັງບໍ່ໄດ້ນິຍາມ ⇒ ຕົກໄປໃຊ້ **ic_inventory_set_detail ຂອງ ERP** (ພຶດຕິກຳເກົ່າ)
 *
 * ⚠️ ເປັນຫຍັງຕ້ອງມີ ①: ຊຸດຂອງ ERP ຄື**ອົງປະກອບຂອງຕົວເຄື່ອງ** (ແອ [SET] → [C]/[H]/ກ່ອງທໍ່)
 * ບໍ່ແມ່ນອາໄຫຼ່ຕິດຕັ້ງ — ວັດຈາກຂໍ້ມູນຈິງ 1 ປີ: ແຖວອາໄຫຼ່ໃນກະຕ່າ 2,439 ແຖວ **ຢູ່ໃນຊຸດ 0 ແຖວ**
 * (ເບິ່ງ migrations/2026-07-31-install-standard.sql).
 *
 * ບໍ່ໃຊ້ ods.tb_used_spare ເປັນມາດຕະຖານ ເພາະມັນເປັນ **ກະຕ່າຂອງງານ** (ຊ່າງເພີ່ມ/ລຶບໄດ້).
 * ຈຳນວນ "ຂໍແລ້ວ" ຍັງຄິດຈາກ **ບັນຊີເອກະສານ** (122 ລົບ 59) ຄືເກົ່າ — ນິຍາມດຽວກັບ
 * saveSpareRequest ຈຶ່ງບໍ່ຂັດກັນເອງ.
 */

export type StandardSpare = {
  item_code: string;
  item_name: string;
  unit_code: string | null;
  standard_qty: number;
  requested_qty: number;
  remaining_qty: number;
};

/**
 * ⚠️ **ຫົວໜ່ວຍເອົາຈາກ `sd.unit_code` (ຂອງຊຸດ) ເທົ່ານັ້ນ** — ບໍ່ຕົກໄປໃຊ້
 * `ic_inventory.unit_standard`. ເຫດຜົນ: ຫົວໜ່ວຍມາດຕະຖານຂອງສິນຄ້າມັກເປັນ
 * ຫົວໜ່ວຍຊື້/ຊັ່ງ (ເຊັ່ນ 140507-0336 = **ກິໂລ** ເພາະຂາຍເປັນເປົາ 50KG) ແຕ່
 * ຕອນຕິດຕັ້ງເບີກເປັນ **ຕົວ/ອັນ** ຕາມທີ່ຊຸດກຳນົດ ⇒ ໃຊ້ຫົວໜ່ວຍສິນຄ້າ = ຈຳນວນຜິດຄວາມໝາຍ
 * ທັງໃນໃບຂໍເບີກ ແລະ ໃນ ERP.
 */
const SET_LINES = `
  select sd.ic_code as item_code,
      coalesce(nullif(i.name_1, ''), sd.ic_code) as item_name,
      nullif(sd.unit_code, '') as unit_code,
      sum(sd.qty)::float8 as standard_qty,
      min(sd.line_number) as line_number
    from ic_inventory_set_detail sd
    left join ic_inventory i on i.code = sd.ic_code
   where sd.ic_set_code = $1
   group by 1, 2, 3
   order by line_number`;

/** ຂໍໄປແລ້ວເທົ່າໃດ = ໃບຂໍ (122) ລົບໃບສົ່ງຄືນ (59) — ຄືກັບ OUTSTANDING ຂອງກະຕ່າ */
const REQUESTED = `
  select item_code, sum(case when trans_flag = 122 then qty else -qty end)::float8 as qty
    from ic_trans_detail
   where product_code = $1 and trans_flag in (122, 59)
   group by item_code`;

/* ── ① ນິຍາມຂອງ ODS (ods_install_spare_standard) ─────────────────── */

export type StandardKey = { pro_type_code: string | null; pro_size: string | null };

/**
 * ແຖວມາດຕະຖານທີ່ນິຍາມເອງ ສຳລັບໝວດ+ຂະໜາດນຶ່ງ.
 * ຂະໜາດຕົງ ຊະນະ ຂະໜາດຫວ່າງ (distinct on) ⇒ ຕັ້ງຄ່າກາງໄວ້ແລ້ວ override ສະເພາະຂະໜາດໄດ້.
 */
const ODS_STANDARD = `
  select distinct on (item_code) item_code, item_name, nullif(unit_code,'') unit_code, qty::float8 standard_qty
    from ods_install_spare_standard
   where pro_type_code = $1 and (pro_size = $2 or pro_size = '')
   order by item_code, (pro_size = $2) desc`;

/** ນິຍາມມາດຕະຖານຂອງ **ງານນຶ່ງ** (ອ່ານໝວດ/ຂະໜາດຈາກໃບງານເອງ) — ຫວ່າງ = ຍັງບໍ່ໄດ້ນິຍາມ */
async function odsStandardFor(
  jobCode: string,
): Promise<(StandardSpare & { line_number: number })[]> {
  const job = await query<{ pro_type_code: string | null; pro_size: string | null }>(
    "select pro_type_code, pro_size from ods_tb_install where code=$1 limit 1",
    [jobCode],
  );
  const key = job.rows[0];
  if (!key?.pro_type_code) return [];
  const rows = await query<StandardSpare>(ODS_STANDARD, [key.pro_type_code, key.pro_size ?? ""]);
  return rows.rows.map((row, index) => ({ ...row, requested_qty: 0, remaining_qty: 0, line_number: index }));
}

/* ── ແນະນຳມາດຕະຖານ **ຈາກປະຫວັດຈິງ** ──────────────────────── */

export type StandardSuggestion = {
  item_code: string;
  item_name: string;
  unit_code: string | null;
  /** ຈຳນວນງານທີ່ເຄີຍເບີກລາຍການນີ້ */
  jobs: number;
  /** ຄິດເປັນ % ຂອງງານໝວດນີ້ທັງໝົດ */
  pct: number;
  /** ຈຳນວນກາງ (median) ທີ່ເບີກຕໍ່ງານ — ໃຊ້ເປັນຈຳນວນມາດຕະຖານ */
  median_qty: number;
};

/**
 * ລາຍການທີ່ຊ່າງ **ເບີກຈິງ** ຫຼາຍທີ່ສຸດ ຂອງໝວດ (+ຂະໜາດ) ໃນ 2 ປີຫຼັງສຸດ.
 *
 * ⚠️ ບໍ່ມີລາຍການໃດຢູ່ 100% — ຂໍ້ມູນຈິງຂອງແອ (1,086 ງານ) ສູງສຸດ 47% ທົ່ວທຸກຂະໜາດ
 * ແລະ 58% ເມື່ອແຍກຂະໜາດ. ນັ້ນຄືເຫດຜົນທີ່ໜ້ານີ້ໃຫ້ **ຄົນເລືອກ** ບໍ່ແມ່ນຕັ້ງໃຫ້ອັດຕະໂນມັດ:
 * % ບອກວ່າ "ເບີກເລື້ອຍປານໃດ" ບໍ່ໄດ້ບອກວ່າ "ຄວນເປັນມາດຕະຖານ".
 */
export async function suggestStandardFromHistory(
  proTypeCode: string,
  proSize: string,
): Promise<StandardSuggestion[]> {
  if (!proTypeCode) return [];
  const sizeFilter = proSize ? "and coalesce(a.pro_size,'') = $2" : "";
  try {
    const rows = await query<StandardSuggestion>(
      `with jobs as (
         select a.code from ods_tb_install a
          where a.pro_type_code = $1 ${sizeFilter}
            and a.time_register > localtimestamp - interval '2 years'
            and exists (select 1 from tb_used_spare s where s.product_code = a.code)
       ), per as (
         select s.item_code, max(s.item_name) item_name, max(s.unit_code) unit_code,
             count(distinct s.product_code)::int jobs,
             (percentile_cont(0.5) within group (order by s.qty))::float8 median_qty
           from tb_used_spare s join jobs j on j.code = s.product_code
          group by s.item_code
       )
       select p.item_code, p.item_name, nullif(p.unit_code,'') unit_code, p.jobs,
           round(100.0 * p.jobs / nullif((select count(*) from jobs), 0))::int pct,
           p.median_qty
         from per p
        where p.jobs >= 3
        order by p.jobs desc
        limit 30`,
      proSize ? [proTypeCode, proSize] : [proTypeCode],
    );
    return rows.rows;
  } catch (error) {
    console.error("suggestStandardFromHistory failed", error);
    return [];
  }
}

/**
 * **ຈຳນວນ ແລະ ຫົວໜ່ວຍ ຕາມມາດຕະຖານ** — ໃຊ້ຕອນເພີ່ມລາຍການເຂົ້າກະຕ່າ ເພື່ອບໍ່ຕ້ອງເຊື່ອຄ່າ
 * ທີ່ browser ສົ່ງມາ ແລະ ບໍ່ຕ້ອງໄປຢືມຫົວໜ່ວຍຂອງ ic_inventory (ເບິ່ງເຫດຜົນຢູ່ SET_LINES).
 *
 * ⚠️ ອັນນີ້ຮັບ **ລະຫັດສິນຄ້າ** (ຊຸດ ERP ຢ່າງດຽວ) — ຖ້າຢາກໄດ້ນິຍາມຂອງ ODS ນຳ
 * ໃຫ້ໃຊ້ `standardLinesForJob(jobCode)` ຂ້າງລຸ່ມ ເຊິ່ງຮູ້ໝວດ/ຂະໜາດຂອງໃບງານ.
 */
export async function getStandardSetLines(
  productCode: string | null | undefined,
): Promise<Map<string, { qty: number; unit_code: string | null }>> {
  if (!productCode) return new Map();
  try {
    const rows = (
      await queryOdg<{ item_code: string; unit_code: string | null; standard_qty: number }>(
        SET_LINES,
        [productCode],
      )
    ).rows;
    return new Map(
      rows.map((row) => [row.item_code, { qty: row.standard_qty, unit_code: row.unit_code }]),
    );
  } catch (error) {
    console.error("getStandardSetLines failed", error);
    return new Map();
  }
}

/**
 * ມາດຕະຖານຂອງງານນຶ່ງ ເປັນ Map — ODS ກ່ອນ ຖ້າບໍ່ມີຈຶ່ງຕົກໄປໃຊ້ຊຸດ ERP.
 * ໃຊ້ຢູ່ addSpareLines (ຈຳນວນ/ຫົວໜ່ວຍຕັ້ງຕົ້ນ) ແລະ blockNonStandard (ດ່ານນອກມາດຕະຖານ).
 */
export async function standardLinesForJob(
  jobCode: string,
  productCode: string | null | undefined,
): Promise<Map<string, { qty: number; unit_code: string | null }>> {
  try {
    const ods = await odsStandardFor(jobCode);
    if (ods.length) {
      return new Map(ods.map((row) => [row.item_code, { qty: row.standard_qty, unit_code: row.unit_code }]));
    }
  } catch (error) {
    // ນິຍາມ ODS ອ່ານບໍ່ໄດ້ ⇒ ຢ່າໃຫ້ການເພີ່ມອາໄຫຼ່ພັງ, ຕົກໄປໃຊ້ຊຸດ ERP
    console.error("standardLinesForJob (ods) failed", error);
  }
  return getStandardSetLines(productCode);
}

/**
 * ລາຍການມາດຕະຖານພ້ອມຄວາມຄືບໜ້າຂອງງານ.
 * @param jobCode     ເລກທີງານ (INST-xxxx) — ໃຊ້ຫານິຍາມ ODS ແລະ ນັບຈຳນວນທີ່ຂໍໄປແລ້ວ
 * @param productCode ລະຫັດສິນຄ້າຂອງງານ (ods_tb_install.item_code) = ລະຫັດຊຸດໃນ ERP
 */
export async function getStandardSpares(
  jobCode: string,
  productCode: string | null | undefined,
): Promise<StandardSpare[]> {
  let setLines: (StandardSpare & { line_number: number })[] = [];
  try {
    // ① ນິຍາມຂອງ ODS ກ່ອນ (ຕໍ່ໝວດ+ຂະໜາດ)
    setLines = await odsStandardFor(jobCode);
  } catch (error) {
    console.error("getStandardSpares (ods) failed", error);
  }
  if (!setLines.length) {
    if (!productCode) return [];
    try {
      // ② ຕົກໄປໃຊ້ຊຸດ ERP ຄືເກົ່າ
      setLines = (
        await queryOdg<StandardSpare & { line_number: number }>(SET_LINES, [productCode])
      ).rows;
    } catch (error) {
      // ERP ບໍ່ພ້ອມ → ຢ່າໃຫ້ໜ້າລົ້ມ, ສະແດງບໍ່ມີມາດຕະຖານໄປກ່ອນ
      console.error("getStandardSpares failed", error);
      return [];
    }
  }
  if (!setLines.length) return [];

  const requested = new Map(
    (await query<{ item_code: string; qty: number }>(REQUESTED, [jobCode])).rows.map(
      (row) => [row.item_code, row.qty],
    ),
  );
  return setLines.map((row) => {
    const already = requested.get(row.item_code) ?? 0;
    return {
      item_code: row.item_code,
      item_name: row.item_name,
      unit_code: row.unit_code,
      standard_qty: row.standard_qty,
      requested_qty: already,
      remaining_qty: Math.max(0, row.standard_qty - already),
    };
  });
}
