import { Card } from "@/components/ui";

/** ຫົວໃບງານຕິດຕັ້ງ — ໃຊ້ຮ່ວມກັນໃນໜ້າຂໍເບີກ / ສາງເບີກ / ຮັບອາໄຫຼ່ */
export type JobHead = {
  code: string;
  cust_code: string | null;
  cust_name: string | null;
  tel: string | null;
  address: string | null;
  doc_ref_1: string | null;
  time_register: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  appoint_date: string | null;
  tech_code: string | null;
};

export const JOB_HEAD_COLUMNS = `a.code, a.cust_code, c.name_1 as cust_name, c.tel, c.address, a.doc_ref_1,
  to_char(a.time_register,'DD-MM-YYYY HH24:MI') as time_register, a.item_name,
  a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
  to_char(a.appoint_date,'DD-MM-YYYY') as appoint_date, a.tech_code`;

export function JobHeader({ head, title = "ຂໍ້ມູນງານຕິດຕັ້ງ" }: { head: JobHead; title?: string }) {
  const fields: [string, string | null][] = [
    ["ເລກທີເປີດງານ", head.code],
    ["ວັນ/ເວລາເປີດງານ", head.time_register],
    ["ລູກຄ້າ", `${head.cust_code ?? ""}-${head.cust_name ?? ""}`],
    ["ເບີໂທ", head.tel],
    ["ທີ່ຢູ່", head.address],
    ["ເລກບີນຂາຍ", head.doc_ref_1],
    ["ລາຍການຕິດຕັ້ງ", head.item_name],
    ["ຍີ່ຫໍ້", head.pro_brand],
    ["model", head.pro_model],
    ["ປະເພດ", head.pro_type],
    ["ຂະໜາດ", head.pro_size],
    ["ວັນທີນັດຕິດຕັ້ງ", head.appoint_date],
    ["ຊ່າງ", head.tech_code],
  ];

  return (
    <Card title={title}>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label} className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
