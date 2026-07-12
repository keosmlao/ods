import { guardApi } from "@/lib/api-guard";
import { installStatuses, repairStatuses } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const keys=Object.keys(rows[0]); const cell=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;
  return `\uFEFF${keys.map(cell).join(",")}\n${rows.map((row)=>keys.map((key)=>cell(row[key])).join(",")).join("\n")}`;
};
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /dashboard — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/dashboard");
  if (denied) return denied;
  const workflow=request.nextUrl.searchParams.get("workflow"); const status=request.nextUrl.searchParams.get("status")??"";
  const config=workflow==="repair"?repairStatuses[status]:workflow==="install"?installStatuses[status]:null;
  if(!config)return NextResponse.json({error:"Invalid status"},{status:400});
  const sql=workflow==="repair"?`select a.code,c.name_1 customer,c.tel phone,a.name_1 product,a.sn,a.p_brand brand,a.p_model model,a.issue,a.emp_code technician,a.time_register registered from tb_product a left join ar_customer c on c.code=a.cust_code where ${config.condition} order by a.time_register desc`:`select a.code,a.time_register registered,c.name_1 customer,a.appoint_date appointment,a.doc_ref_1 sale_bill,a.item_name product,a.pro_brand brand,a.pro_model model,a.pro_type product_type,a.pro_size product_size,a.tech_code technician,a.user_created creator from ods_tb_install a left join ar_customer c on c.code=a.cust_code where a.cancel_date is null and a.job_finish is null and ${config.condition} order by a.time_register desc`;
  const body=csv((await query(sql)).rows); return new NextResponse(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${workflow}-${status}.csv"`}});
}
