import { query } from "@/lib/db";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { stageLabel, STAGE_SQL } from "@/lib/stage";

/**
 * **ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມແປງ** — ນິຍາມ "ເຄື່ອງທີ່ຄວນຢູ່ໃນສູນຈິງ" ບ່ອນດຽວ.
 *
 * ── ຂອບເຂດ ──
 * "ຍັງບໍ່ສົ່ງຄືນ" = `return_complete is null` (ຄືເງື່ອນໄຂຂອງ holdJob) — ເຄື່ອງລູກຄ້າ
 * ທີ່ຮັບເຂົ້າມາ ແລະ ຍັງບໍ່ໄດ້ສົ່ງຄືນ ⇒ **ຕ້ອງມີຕົວຈິງຢູ່ໃນສູນ**. ຈຳກັດຂັ້ນ 1-11
 * (ຕັດ 12=ສົ່ງຄືນສຳເລັດ ແລະ ຂໍ້ມູນຫຼົງທີ່ບໍ່ມີຂັ້ນ) ໃຫ້ນັບແຕ່ເຄື່ອງທີ່ຢູ່ໃນຂັ້ນຕອນຈິງ.
 *
 * barcode ຂອງປ້າຍ (lib/barcode) ເຂົ້າລະຫັດ `tb_product.code` ⇒ ສະແກນແລ້ວໄດ້ code ໂດຍກົງ
 * ບໍ່ຕ້ອງແຕະ ERP. ໜ້າ /service/stock-count ໃຊ້ລາຍການນີ້ເປັນ "ສິ່ງທີ່ຄວນນັບໃຫ້ຄົບ".
 */
export type StockCountJob = {
  code: string;
  product: string | null;
  sn: string | null;
  brand: string | null;
  customer: string | null;
  stage: number;
  stage_label: string;
  /** ປະເພດບໍລິການ — CI/ST/IH/PS (Pending ທັງໝົດ, ບໍ່ແຍກ service) */
  service_type: string | null;
  service_type_label: string;
  registered: string | null;
  elapsed_seconds: number | null;
};

export async function inScopeRepairJobs(): Promise<StockCountJob[]> {
  const rows = (
    await query<Omit<StockCountJob, "stage_label" | "service_type_label">>(
      `select a.code, a.name_1 product, a.sn, a.p_brand brand, c.name_1 customer,
          (${STAGE_SQL}) stage, a.service_type,
          to_char(a.time_register,'DD-MM-YYYY') registered,
          greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       -- Pending ທັງໝົດ = ຍັງບໍ່ສົ່ງຄືນ (ບໍ່ແຍກ service type — ລວມ IH/PS ນຳ)
       where a.return_complete is null
       order by a.time_register desc`,
    )
  ).rows;
  return rows.map((row) => ({
    ...row,
    stage_label: stageLabel(row.stage, row.service_type),
    service_type_label: SERVICE_TYPE_LABEL[row.service_type ?? ""] ?? (row.service_type ?? "-"),
  }));
}

/** job_code ທີ່ **ນັບແລ້ວ** (ຈາກ ods_stock_count) — ໃຫ້ໜ້າກວດນັບໂຫຼດສະຖານະຄືນ */
export async function countedCodes(): Promise<string[]> {
  const rows = (await query<{ job_code: string }>(`select job_code from ods_stock_count`)).rows;
  return rows.map((row) => row.job_code);
}

/** ເຄື່ອງທີ່ **ນັບພົບແລ້ວ** ພ້ອມລາຍລະອຽດ — join FROM ods_stock_count (ນັບໄດ້ທຸກ job, ບໍ່ຈຳກັດ pending) */
export type CountedItem = {
  code: string;
  product: string | null;
  sn: string | null;
  brand: string | null;
  customer: string | null;
  /** ອາການ (ລູກຄ້າແຈ້ງ) */
  issue: string | null;
  /** ຂັ້ນປັດຈຸບັນ (ສົດ) */
  stage_label: string;
  service_type: string | null;
  service_type_label: string;
  counted_at: string | null;
  counted_by: string | null;
  /** ຂັ້ນຕອນນັບພົບ (snapshot) */
  counted_stage_label: string | null;
  /** ບໍ່ pending ອີກແລ້ວ (ສົ່ງຄືນລູກຄ້າແລ້ວ) ແຕ່ຖືກນັບໄວ້ — ໃຫ້ລະວັງໃນລາຍງານ */
  returned: boolean;
};

export async function countedItems(): Promise<CountedItem[]> {
  const rows = (
    await query<{
      code: string;
      product: string | null;
      sn: string | null;
      brand: string | null;
      customer: string | null;
      issue: string | null;
      stage: number;
      service_type: string | null;
      counted_at: string | null;
      counted_by: string | null;
      stage_at: number | null;
      returned: boolean;
    }>(
      `select a.code, a.name_1 product, a.sn, a.p_brand brand, c.name_1 customer,
          nullif(trim(coalesce(a.issue,'')),'') issue,
          (${STAGE_SQL}) stage, a.service_type,
          to_char(sc.counted_at,'DD-MM-YYYY HH24:MI') counted_at, sc.counted_by, sc.stage_at,
          (a.return_complete is not null) returned
        from ods_stock_count sc
        join tb_product a on a.code = sc.job_code
        left join ar_customer c on c.code = a.cust_code
       order by sc.counted_at desc`,
    )
  ).rows;
  return rows.map((row) => ({
    code: row.code,
    product: row.product,
    sn: row.sn,
    brand: row.brand,
    customer: row.customer,
    issue: row.issue,
    stage_label: stageLabel(row.stage, row.service_type),
    service_type: row.service_type,
    service_type_label: SERVICE_TYPE_LABEL[row.service_type ?? ""] ?? (row.service_type ?? "-"),
    counted_at: row.counted_at,
    counted_by: row.counted_by,
    counted_stage_label: row.stage_at != null ? stageLabel(row.stage_at, row.service_type) : null,
    returned: row.returned,
  }));
}

export type StockCountReportRow = StockCountJob & {
  /** ນັບເມື່ອໃດ (null = ຍັງບໍ່ນັບ = ບໍ່ພົບຕົວ) */
  counted_at: string | null;
  counted_by: string | null;
  /** ຂັ້ນຕອນນັບ (snapshot) — ເລກ + ປ້າຍ. null = ຍັງບໍ່ນັບ */
  stage_at: number | null;
  counted_stage_label: string | null;
};

/**
 * ລາຍງານຜົນກວດນັບ — pending ທັງໝົດ LEFT JOIN ods_stock_count.
 * ຍັງບໍ່ນັບ (counted_at null) = ຂຶ້ນກ່ອນ (ຕ້ອງຕິດຕາມ), ຕໍ່ດ້ວຍ ນັບແລ້ວ ຮຽງຕາມເວລາ.
 */
export async function stockCountReport(): Promise<StockCountReportRow[]> {
  const rows = (
    await query<Omit<StockCountReportRow, "stage_label" | "service_type_label" | "counted_stage_label">>(
      `select a.code, a.name_1 product, a.sn, a.p_brand brand, c.name_1 customer,
          (${STAGE_SQL}) stage, a.service_type,
          to_char(a.time_register,'DD-MM-YYYY') registered,
          greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
          to_char(sc.counted_at,'DD-MM-YYYY HH24:MI') counted_at, sc.counted_by, sc.stage_at
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
        left join ods_stock_count sc on sc.job_code = a.code
       where a.return_complete is null
       order by (sc.counted_at is null) desc, sc.counted_at desc nulls last, a.time_register desc`,
    )
  ).rows;
  return rows.map((row) => ({
    ...row,
    stage_label: stageLabel(row.stage, row.service_type),
    service_type_label: SERVICE_TYPE_LABEL[row.service_type ?? ""] ?? (row.service_type ?? "-"),
    // ສະຖານະຕອນນັບພົບ (snapshot) — ຖ້າຂັ້ນປັດຈຸບັນຕ່າງ = ເຄື່ອງຂະຫຍັບຫຼັງນັບ
    counted_stage_label: row.stage_at != null ? stageLabel(row.stage_at, row.service_type) : null,
  }));
}
