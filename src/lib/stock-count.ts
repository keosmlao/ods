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
  /** ປະເພດບໍລິການ — CI/ST/PS (IH ຖືກຂ້າມ) */
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
       where a.return_complete is null and (${STAGE_SQL}) between 1 and 11
         -- IH ຢູ່ບ້ານລູກຄ້າ ⇒ ຂ້າມ · PS ທີ່ຍັງບໍ່ໄປຮັບຢູ່ຂັ້ນ 0 ⇒ ຂ້າມເອງ (ນອກ 1-11)
         and coalesce(a.service_type,'') <> 'IH'
       order by a.time_register desc`,
    )
  ).rows;
  return rows.map((row) => ({
    ...row,
    stage_label: stageLabel(row.stage, row.service_type),
    service_type_label: SERVICE_TYPE_LABEL[row.service_type ?? ""] ?? (row.service_type ?? "-"),
  }));
}

/** code ຂອງເຄື່ອງທີ່ **ຄວນຢູ່** — server ໃຊ້ຕອນ finalize ເພື່ອຮູ້ວ່າອັນໃດ "ບໍ່ພົບ" */
export async function inScopeCodes(): Promise<string[]> {
  const rows = (
    await query<{ code: string }>(
      `select a.code from tb_product a
        where a.return_complete is null and (${STAGE_SQL}) between 1 and 11
         -- IH ຢູ່ບ້ານລູກຄ້າ ⇒ ຂ້າມ · PS ທີ່ຍັງບໍ່ໄປຮັບຢູ່ຂັ້ນ 0 ⇒ ຂ້າມເອງ (ນອກ 1-11)
         and coalesce(a.service_type,'') <> 'IH'`,
    )
  ).rows;
  return rows.map((row) => row.code);
}
