import { guardApi } from "@/lib/api-guard";
import { query } from "@/lib/db";
import { CANCELLED_JOBS, DONE_JOBS, OPEN_JOBS, STAGE_ELAPSED_SQL, STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import { respondXlsx, type XlsxRow } from "@/lib/xlsx";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Excel ຂອງໜ້າ "ລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ" (/service).
 *
 * ໃຊ້ **ຕົວກອງອັນດຽວກັບໜ້າຈໍ** (ແທັບ · ຄຳຄົ້ນຫາ · ຂັ້ນ) ⇒ ສິ່ງທີ່ໂຫຼດອອກມາ
 * ຄືສິ່ງທີ່ຜູ້ໃຊ້ເຫັນ ບໍ່ແມ່ນຊຸດຂໍ້ມູນອື່ນ. ບໍ່ຈຳກັດຈຳນວນແຖວ (ໜ້າຈໍແບ່ງໜ້າ 20 ໃບ
 * ແຕ່ Excel ຕ້ອງໄດ້ຄົບ — ນັ້ນຄືເຫດຜົນທີ່ຄົນ export).
 *
 * ຂັ້ນ ແລະ ຊື່ຂັ້ນ ມາຈາກ lib/stage ບ່ອນດຽວ (STAGE_LABEL_SQL) ⇒ ບໍ່ມີວັນຕ່າງກັບໜ້າຈໍ.
 */
const SEARCH = `(a.code ilike $1 or a.sn ilike $1 or a.name_1 ilike $1 or a.p_brand ilike $1
  or a.issue ilike $1 or b.name_1 ilike $1 or b.tel ilike $1)`;

const TAB_WHERE: Record<string, string> = {
  pending: OPEN_JOBS,
  done: DONE_JOBS,
  cancelled: CANCELLED_JOBS,
};

const TAB_LABEL: Record<string, string> = {
  pending: "ວຽກຄ້າງ",
  done: "ຈົບແລ້ວ",
  cancelled: "ຍົກເລີກ",
};

export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /service — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/service");
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const tab = ["pending", "done", "cancelled"].includes(params.get("tab") ?? "")
    ? (params.get("tab") as string)
    : "pending";
  const q = (params.get("q") ?? "").trim();
  const statusRaw = Number(params.get("status"));
  const status = tab === "pending" && statusRaw >= 1 && statusRaw <= 11 ? statusRaw : null;
  const service = ["CI", "ST", "IH", "PS"].includes(params.get("service") ?? "")
    ? (params.get("service") as string)
    : null;

  const where = [TAB_WHERE[tab]];
  const args: (string | number)[] = [];
  if (q) {
    args.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$1", `$${args.length}`));
  }
  if (status) {
    args.push(status);
    where.push(`(${STAGE_SQL}) = $${args.length}`);
  }
  if (service) {
    args.push(service);
    where.push(`a.service_type = $${args.length}`);
  }

  const rows = await query<XlsxRow>(
    `select a.code as "ເລກທີ",
        to_char(a.time_register,'DD-MM-YYYY HH24:MI') as "ວັນທີຮັບເຄື່ອງ",
        b.name_1 as "ລູກຄ້າ", b.tel as "ເບີໂທ",
        a.name_1 as "ສິນຄ້າ", a.p_brand as "ຍີ່ຫໍ້", a.p_model as "ຮຸ່ນ", a.sn as "Serial",
        a.warrunty as "ປະກັນ",
        case a.service_type
          when 'CI' then 'CI · ລູກຄ້ານຳເຄື່ອງເຂົ້າ'
          when 'ST' then 'ST · ສ້ອມເຄື່ອງໃນສາງ'
          when 'IH' then 'IH · ສ້ອມບ້ານລູກຄ້າ'
          when 'PS' then 'PS · ໄປຮັບເຄື່ອງທີ່ບ້ານລູກຄ້າມາສ້ອມຢູ່ສູນ'
          else coalesce(a.service_type,'-') end as "ປະເພດບໍລິການ",
        a.issue as "ອາການ (ລູກຄ້າ)", a.issue_2 as "ອາການ (ຊ່າງ)",
        a.emp_code as "ຊ່າງ", a.user_regis as "ຜູ້ຮັບເຄື່ອງ",
        (${STAGE_LABEL_SQL}) as "ຂັ້ນຕອນ",
        round(${STAGE_ELAPSED_SQL} / 86400.0, 1) as "ຄ້າງ (ມື້)",
        to_char(a.time_finish_repair,'DD-MM-YYYY HH24:MI') as "ສ້ອມສຳເລັດ",
        to_char(a.qc_finish,'DD-MM-YYYY HH24:MI') as "ຜ່ານ QC",
        to_char(a.return_complete,'DD-MM-YYYY HH24:MI') as "ສົ່ງຄືນ"
      from tb_product a
      left join ar_customer b on b.code = a.cust_code
     where ${where.join(" and ")}
     order by a.time_register desc nulls last`,
    args,
  );

  const columns = [
    { header: "ເລກທີ", key: "ເລກທີ", width: 10 },
    { header: "ວັນທີຮັບເຄື່ອງ", key: "ວັນທີຮັບເຄື່ອງ", width: 18 },
    { header: "ລູກຄ້າ", key: "ລູກຄ້າ", width: 26 },
    { header: "ເບີໂທ", key: "ເບີໂທ", width: 14 },
    { header: "ສິນຄ້າ", key: "ສິນຄ້າ", width: 18 },
    { header: "ຍີ່ຫໍ້", key: "ຍີ່ຫໍ້", width: 14 },
    { header: "ຮຸ່ນ", key: "ຮຸ່ນ", width: 18 },
    { header: "Serial", key: "Serial", width: 20 },
    { header: "ປະກັນ", key: "ປະກັນ", width: 12 },
    { header: "ອາການ (ລູກຄ້າ)", key: "ອາການ (ລູກຄ້າ)", width: 30 },
    { header: "ອາການ (ຊ່າງ)", key: "ອາການ (ຊ່າງ)", width: 30 },
    { header: "ຊ່າງ", key: "ຊ່າງ", width: 12 },
    { header: "ຜູ້ຮັບເຄື່ອງ", key: "ຜູ້ຮັບເຄື່ອງ", width: 14 },
    { header: "ຂັ້ນຕອນ", key: "ຂັ້ນຕອນ", width: 20 },
    { header: "ຄ້າງ (ມື້)", key: "ຄ້າງ (ມື້)", width: 10 },
    { header: "ສ້ອມສຳເລັດ", key: "ສ້ອມສຳເລັດ", width: 18 },
    { header: "ຜ່ານ QC", key: "ຜ່ານ QC", width: 18 },
    { header: "ສົ່ງຄືນ", key: "ສົ່ງຄືນ", width: 18 },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return respondXlsx(
    `ຮັບເຄື່ອງສ້ອມ-${TAB_LABEL[tab]}`,
    columns,
    rows.rows,
    `service-${tab}-${stamp}.xlsx`,
  );
}
