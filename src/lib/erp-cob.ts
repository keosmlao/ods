import { odgDb, query } from "@/lib/db";

/**
 * **ຕັ້ງໜີ້ຕ້ອງຮັບຈາກ supplier ໃຫ້ໃບເຄມ CLM-C ອັດຕະໂນມັດ** — ເອກະສານ **AOB** ຂອງ ERP
 * (`ic_trans` trans_flag **99** · doc_format_code 'AOB' · trans_type 2).
 *
 * ── ⚠️ ເປັນຫຍັງ AOB ບໍ່ແມ່ນ COB (ແກ້ 05-08-2026) ──
 * ຮອບທຳອິດຂຽນເປັນ **COB (87)** ຕາມຊື່ຊ່ອງເກົ່າຢູ່ໜ້າຈໍ ແຕ່ກວດ ERP ແລ້ວ COB ເປັນ
 * **ຝັ່ງລາຍຈ່າຍ/ໜີ້ຕ້ອງສົ່ງ** (trans_type 1 — ຕົວຢ່າງຈິງ: ເງິນເດືອນ · ໂບນັດ · ຄ່າຄອມ)
 * ⇒ ໃຊ້ຜິດຂ້າງ. ອັນທີ່ **ຕັ້ງໜີ້ຕ້ອງຮັບ** ຄື **AOB (99, trans_type 2)** — ຕົວຢ່າງຈິງ
 * 228 ໃບ ເປັນ "ພະນັກງານຢືມເງິນບໍລິສັດ" ແລະ "ຕັ້ງໜີ້ຈາກການນັບສະຕ໋ອກ": ຫົວໃບຕັ້ງໜີ້ໃສ່
 * `cust_code` ແລ້ວແຖວເປັນ**ບັນຊີຄູ່**. ຂອງເຮົາ: ຕັ້ງໜີ້ໃສ່ **supplier** ຄູ່ກັບບັນຊີ
 * **ລາຍຮັບຈາກການບໍລິການ**.
 *
 * ── ບັນຊີຄູ່ (ແກ້ໄດ້ທີ່ /manage/service-charges) ──
 * ຄ່າຕັ້ງຕົ້ນ **4010501 "ລາຍຮັບຈາກການບໍລິການ"** (ມີຈິງໃນ gl_chart_of_account ຂອງ ERP).
 * ບັນຊີຜິດ = ງົບຜິດ ⇒ ໃຫ້ບັນຊີກວດ ແລະ ປ່ຽນລະຫັດເອງໄດ້ ໂດຍບໍ່ຕ້ອງແກ້ໂຄດ.
 *
 * ── ເລກເອກະສານ = **ລະຫັດໃບເຄມ** (CLM00042) ບໍ່ແມ່ນເລກຊຸດຂອງ ERP ──
 * ສອງລະບົບອ້າງເລກດຽວກັນ · ບໍ່ຕ້ອງໄລ່ເລກຊຸດ · ບໍ່ຊົນກັບໃບທີ່ບັນຊີອອກເອງ · ກວດຊ້ຳກ່ອນຂຽນ.
 *
 * ⚠️ ບໍ່ໂຍນ error ຈັກເທື່ອ — ການອອກໃບເຄມ/ໃບຮັບເງິນ ຫ້າມພັງເພາະເອກະສານບັນຊີ.
 */

/** trans_flag ຂອງໃບຕັ້ງໜີ້ຕ້ອງຮັບ (AOB) ຢູ່ ERP */
export const AOB_FLAG = 99;
/** ບັນຊີຄູ່ຕັ້ງຕົ້ນ — ລາຍຮັບຈາກການບໍລິການ (gl_chart_of_account) */
const DEFAULT_ACCOUNT = "4010501";
const DEFAULT_ACCOUNT_NAME = "ລາຍຮັບຈາກການບໍລິການ";

export type CobConfig = { account_code: string; account_name: string; branch_code: string };

export async function cobConfig(): Promise<CobConfig> {
  try {
    const rows = (
      await query<{ key: string; value: string | null }>(
        `select key, value from ods_setting where key in ('cob_account_code','cob_account_name','cob_branch_code')`,
      )
    ).rows;
    const map = new Map(rows.map((row) => [row.key, (row.value ?? "").trim()]));
    return {
      account_code: map.get("cob_account_code") || DEFAULT_ACCOUNT,
      account_name: map.get("cob_account_name") || DEFAULT_ACCOUNT_NAME,
      branch_code: map.get("cob_branch_code") || "01",
    };
  } catch {
    return { account_code: DEFAULT_ACCOUNT, account_name: DEFAULT_ACCOUNT_NAME, branch_code: "01" };
  }
}

/**
 * ສ້າງໃບຕັ້ງໜີ້ຕ້ອງຮັບ 1 ໃບ (ເລກ = ລະຫັດໃບເຄມ). ຄືນເລກເອກະສານ ຫຼື null
 * (ບໍ່ມີ supplier · ຍອດ 0 · ERP ລົ້ມ).
 */
export async function createCobForClaim(input: {
  claimNo: string;
  supplierCode: string;
  jobCode: string | null;
  amountThb: number;
  by: string;
  remark?: string | null;
}): Promise<string | null> {
  if (!odgDb) return null;
  if (!input.supplierCode.trim()) return null;
  if (!(input.amountThb > 0)) return null; // ຍອດ 0 = ບໍ່ມີໜີ້ໃຫ້ຕັ້ງ

  const config = await cobConfig();
  const now = new Date();
  const docDate = now.toISOString().slice(0, 10);
  const docTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
  const remark = input.remark?.trim() || `ຄ່າສ້ອມແປງ ໃບເຄມ ${input.claimNo}${input.jobCode ? ` · ງານ ${input.jobCode}` : ""}`;
  const amount = Math.round(input.amountThb * 100) / 100;
  const docNo = input.claimNo.trim();

  const client = await odgDb.connect();
  try {
    await client.query("begin");
    const dup = await client.query("select 1 from ic_trans where doc_no=$1 and trans_flag=$2 limit 1", [docNo, AOB_FLAG]);
    if (dup.rowCount) {
      await client.query("rollback");
      return docNo; // ມີແລ້ວ ⇒ ບໍ່ຂຽນຊ້ຳ (idempotent)
    }

    await client.query(
      `insert into ic_trans(trans_type, trans_flag, doc_date, doc_no, tax_doc_no, tax_doc_date, vat_type, vat_rate,
         cust_code, branch_code, currency_code, exchange_rate, total_value, total_amount, total_value_2, total_amount_2,
         doc_time, doc_format_code, remark, creator_code, last_editor_code, create_datetime, lastedit_datetime)
       values(2, $9, $1, $2, $2, $1, 2, 10, $3, $4, '01', 1, $5, $5, $5, $5, $6, 'AOB', $7, $8, $8, localtimestamp, localtimestamp)`,
      [docDate, docNo, input.supplierCode.trim(), config.branch_code, amount, docTime, remark, input.by, AOB_FLAG],
    );
    await client.query(
      `insert into ic_trans_detail(trans_type, trans_flag, doc_date, doc_no, cust_code, item_code, item_name,
         qty, price, sum_amount, sum_amount_exclude_vat, sum_amount_2, calc_flag, vat_type, ref_row, is_get_price,
         branch_code, doc_time, doc_date_calc, doc_time_calc, remark)
       values(2, $10, $1, $2, $3, $4, $5, 0, 0, $6, $6, $6, 1, 2, -1, 1, $7, $8, $1, $8, $9)`,
      [docDate, docNo, input.supplierCode.trim(), config.account_code, config.account_name, amount,
        config.branch_code, docTime, remark, AOB_FLAG],
    );
    await client.query("commit");
    return docNo;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("createCobForClaim (AOB) failed", input.claimNo, error);
    return null;
  } finally {
    client.release();
  }
}
