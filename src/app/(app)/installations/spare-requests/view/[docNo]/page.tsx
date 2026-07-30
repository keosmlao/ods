import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { canViewAssignedJob } from "@/lib/scope";
import { notFound, redirect } from "next/navigation";

/** ຖອດແບບຈາກ ods: /in_view_req/<id> + view_reg_page.html (tech_reg_install.py) */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  code: string | null;
  item_name: string | null;
  cust_code: string | null;
  cust_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  remark: string | null;
  tech_code: string | null;
};

export default async function ViewSpareRequest({ params }: Props) {
  const t = (await getDictionary(await getLocale())).spareRequestsView;
  const docNo = decodeURIComponent((await params).docNo);
  const session = await getSession();
  if (!session) redirect("/login");

  const [head, lines] = await Promise.all([
    query<Head>(
      `select ic.doc_no, to_char(ic.doc_date,'DD-MM-YYYY') as doc_date, a.code, a.item_name,
         a.cust_code, c.name_1 as cust_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
         ic.remark, a.tech_code
       from ic_trans ic
       left join ods_tb_install a on a.code = ic.product_code
       left join ar_customer c on c.code = a.cust_code
       where ic.doc_no = $1 and ic.trans_flag = 122 limit 1`,
      [docNo],
    ),
    query<{
      rnum: string;
      item_code: string;
      item_name: string;
      qty: string;
      issued_qty: string;
      pending_qty: string;
      unit_code: string | null;
    }>(
      `select row_number() over (order by min(r.roworder)) as rnum,
          r.item_code, max(r.item_name) item_name, sum(r.qty)::text qty,
          coalesce(max(issued.qty),0)::text issued_qty,
          greatest(sum(r.qty) - coalesce(max(issued.qty),0),0)::text pending_qty,
          max(r.unit_code) unit_code
         from ic_trans_detail r
         left join (
           select item_code, sum(qty) qty
             from ic_trans_detail
            where trans_flag = 56 and doc_ref = $1
            group by item_code
         ) issued on issued.item_code = r.item_code
        where r.doc_no = $1 and r.trans_flag = 122
        group by r.item_code
        order by min(r.roworder)`,
      [docNo],
    ),
  ]);

  const x = head.rows[0];
  if (!x) notFound();
  if (!canViewAssignedJob(session, x.tech_code)) redirect("/forbidden");
  const backHref = session.role === "stock"
    ? "/installations/dispatch"
    : `/installations/${encodeURIComponent(x.code ?? "")}`;

  const fields: [string, string | null][] = [
    [t.reqNo, x.doc_no],
    [t.date, x.doc_date],
    [t.installCode, x.code],
    [t.customer, `${x.cust_code ?? ""}-${x.cust_name ?? ""}`],
    [t.installItem, x.item_name],
    [t.brand, x.pro_brand],
    [t.model, x.pro_model],
    [t.type, x.pro_type],
    [t.size, x.pro_size],
    [t.technician, x.tech_code],
    [t.remark, x.remark],
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 bg-white print:max-w-none">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display:none !important } }`}</style>
      <div className="no-print"><PageTitle>{t.title}</PageTitle></div>
      <h1 className="hidden border-b-2 border-slate-900 pb-3 text-center text-xl font-bold print:block">
        {t.title}
      </h1>

      <Card
        title={t.cardInfo}
        actions={
          <div className="no-print flex gap-2">
            <LinkButton href={backHref} tone="neutral">{t.back}</LinkButton>
            {/* ແກ້ໄດ້ຕາບໃດທີ່ສາງຍັງບໍ່ທັນເບີກ — ໜ້າແກ້ກວດເງື່ອນໄຂຈິງເອງອີກຊັ້ນ */}
            {session.role !== "stock" && (
              <LinkButton
                href={`/installations/spare-requests/edit/${encodeURIComponent(x.doc_no)}`}
                tone="info"
              >
                ແກ້ໄຂ
              </LinkButton>
            )}
            <PrintButton />
          </div>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(([label, value]) => (
            <div key={label} className="border-b border-slate-100 pb-2">
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title={`${t.cardEquipment} · ຄ້າງ ${lines.rows.filter((row) => Number(row.pending_qty) > 0).length} ລາຍການ`}
      >
        {lines.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table
            head={[t.colNo, t.colCode, t.colName, "ຈຳນວນຂໍ", "ເບີກແລ້ວ", "ຄ້າງເບີກ", t.colUnit]}
            minWidth={850}
          >
            {lines.rows.map((row) => (
              <tr key={`${row.item_code}-${row.rnum}`} className="border-b border-slate-100">
                <td className="px-3 py-2 text-center">{row.rnum}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.item_code}</td>
                <td className="px-3 py-2">{row.item_name}</td>
                <td className="px-3 py-2 text-center">{Number(row.qty)}</td>
                <td className="px-3 py-2 text-center text-emerald-700">{Number(row.issued_qty)}</td>
                <td className={`px-3 py-2 text-center font-bold ${
                  Number(row.pending_qty) > 0 ? "text-amber-700" : "text-slate-400"
                }`}>
                  {Number(row.pending_qty)}
                </td>
                <td className="px-3 py-2 text-center">{row.unit_code}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
