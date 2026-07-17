import { JOB_HEAD_COLUMNS, JobHeader, type JobHead } from "@/components/installation/job-header";
import { SpareRequestForm, type Shelf, type SpareLine } from "@/components/installation/spare-request-form";
import { Empty, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { canViewAssignedJob } from "@/lib/scope";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * ຖອດແບບຈາກ ods: /in_add_req/<id> + req_page.html (tech_reg_install.py)
 *
 * ດ່ານກວດ (B2/B3) — ods ແລະ ສະບັບກ່ອນໜ້າຂອງໜ້ານີ້ບໍ່ກວດຫຍັງເລີຍ ຈຶ່ງພິມ URL ເຂົ້າມາ
 * ຂໍເບີກໃຫ້ງານທີ່ຍົກເລີກແລ້ວ / ປິດແລ້ວ / ຊ່າງຍັງບໍ່ຮັບ ໄດ້ ແລະ ຟອມກໍ່ສະແດງ **ທຸກ** ແຖວກະຕ່າ
 * ລວມທັງແຖວທີ່ຖືກເບີກອອກໄປແລ້ວ ⇒ ກົດບັນທຶກຊ້ຳກໍ່ຂໍອາໄຫຼ່ຊຸດເກົ່າຄືນອີກ (double issue).
 * ດຽວນີ້ຟອມສະແດງສະເພາະ "ຈຳນວນທີ່ຍັງຄ້າງ" ຄິດຈາກບັນຊີເອກະສານ (122 ລົບດ້ວຍ 59)
 * — ນິຍາມດຽວກັນກັບ saveSpareRequest ຈຶ່ງບໍ່ຂັດກັນ.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

/** ຈຳນວນທີ່ຍັງບໍ່ທັນຂໍເບີກ = ກະຕ່າ − (ຂໍໄປແລ້ວ 122 − ສົ່ງຄືນ 59) — ຄືກັບ OUTSTANDING_INSTALL_SPARES */
const OUTSTANDING = `
  select n.roworder, n.item_code, n.item_name, n.unit_code,
      round(n.qty - coalesce(c.qty, 0), 0) as qty
  from (
    select min(roworder) roworder, item_code, max(item_name) item_name, max(unit_code) unit_code, sum(qty) qty
    from tb_used_spare where product_code = $1 group by item_code
  ) n
  left join (
    select item_code, sum(case when trans_flag = 122 then qty else -qty end) qty
    from ic_trans_detail where product_code = $1 and trans_flag in (122, 59) group by item_code
  ) c on c.item_code = n.item_code
  where n.qty - coalesce(c.qty, 0) > 0
  order by n.roworder asc`;

type Guard = { cancelled: boolean; closed: boolean; assigned: boolean; accepted: boolean };

const BLOCKED: Record<string, string> = {
  cancelled: "ງານນີ້ຖືກຍົກເລີກແລ້ວ — ຂໍເບີກອາໄຫຼ່ບໍ່ໄດ້",
  closed: "ງານນີ້ປິດແລ້ວ — ຂໍເບີກອາໄຫຼ່ບໍ່ໄດ້",
  unassigned: "ງານນີ້ຍັງບໍ່ມີຊ່າງ — ຕ້ອງຈັດຊ່າງກ່ອນ",
  unaccepted: "ຊ່າງຍັງບໍ່ທັນຮັບງານນີ້ — ຕ້ອງຮັບງານກ່ອນຈຶ່ງຂໍເບີກອາໄຫຼ່ໄດ້",
};

function blockedReason(guard: Guard) {
  if (guard.cancelled) return "cancelled";
  if (guard.closed) return "closed";
  if (!guard.assigned) return "unassigned";
  if (!guard.accepted) return "unaccepted";
  return null;
}

export default async function SpareRequestPage({ params }: Props) {
  const code = decodeURIComponent((await params).code);
  const session = await getSession();
  if (!session) redirect("/login");

  const [head, guard, lines, standard, warehouses, shelves] = await Promise.all([
    query<JobHead>(
      `select ${JOB_HEAD_COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    ),
    query<Guard>(
      `select cancel_date is not null as cancelled, job_finish is not null as closed,
          (tech_code is not null and tech_code <> '') as assigned, tech_confirm is not null as accepted
       from ods_tb_install where code = $1 limit 1`,
      [code],
    ),
    query<SpareLine>(OUTSTANDING, [code]),
    query<{ rnum: string; item_code: string; item_name: string; qty: string; unit_code: string | null }>(
      `select row_number() over (order by line_number asc) as rnum, item_code, item_name, round(qty,2) as qty, unit_code
       from ods_tb_install_detail where code = $1 order by line_number asc`,
      [code],
    ),
    queryOdg<{ code: string; name_1: string }>(
      `select code, name_1 from ic_warehouse where code in ('1103','1104','1204','1203','1206') order by code asc`,
    ),
    // ທີ່ເກັບຂອງແຕ່ລະສາງ (ic_shelf ຂອງ ERP) — ບັງຄັບເລືອກຕັ້ງແຕ່ຕອນຂໍເບີກ
    queryOdg<Shelf>(
      `select whcode, code, name_1 from ic_shelf
        where whcode in ('1103','1104','1204','1203','1206') order by whcode, code`,
    ),
  ]);

  if (!head.rows[0] || !guard.rows[0]) notFound();
  if (!canViewAssignedJob(session, head.rows[0].tech_code)) redirect("/forbidden");
  const today = new Date().toISOString().slice(0, 10);
  const blocked = blockedReason(guard.rows[0]);

  if (blocked) {
    return (
      <div className="w-full space-y-5">
        <PageTitle>ໃບຂໍເບີກຕິດຕັ້ງ</PageTitle>
        <JobHeader head={head.rows[0]} />
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="space-y-2">
            <p className="text-sm font-bold text-amber-800">{BLOCKED[blocked]}</p>
            <Link href="/installations/spare-requests" className="text-xs text-amber-700 underline">
              ກັບຄືນລາຍການໃບຂໍເບີກ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <PageTitle sub={`ງານ ${code} — ເລືອກອາໄຫຼ່ທີ່ຈະເບີກ ແລ້ວສົ່ງໃຫ້ສາງ`}>ໃບຂໍເບີກຕິດຕັ້ງ</PageTitle>

      <JobHeader head={head.rows[0]} />

      {/*
        ── ລຳດັບຂອງໜ້າ ──
        ຮຸ່ນກ່ອນເອົາຕາຕະລາງ "ອຸປະກອນມາດຕະຖານ" (13 ແຖວ) ໄວ້ **ກ່ອນ** ຟອມຂໍເບີກ
        ⇒ ຄົນຕ້ອງເລື່ອນຜ່ານຂໍ້ມູນອ້າງອີງທຸກເທື່ອ ກ່ອນຈະຮອດສິ່ງທີ່ມາເຮັດຈິງ.
        ດຽວນີ້ **ຟອມຂຶ້ນກ່ອນ** · ອຸປະກອນມາດຕະຖານພັບໄວ້ລຸ່ມ (ກົດເປີດເບິ່ງເມື່ອຢາກທຽບ).
      */}
      <SpareRequestForm code={code} today={today} lines={lines.rows} warehouses={warehouses.rows} shelves={shelves.rows} />

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
          ອຸປະກອນຕິດຕັ້ງມາດຕະຖານຂອງເຄື່ອງນີ້
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            {standard.rows.length} ລາຍການ
          </span>
          <span className="ml-2 text-[11px] font-normal text-slate-400">(ຂໍ້ມູນອ້າງອີງ — ກົດເພື່ອເບິ່ງ)</span>
        </summary>
        <div className="border-t border-slate-100 p-4">
          {standard.rows.length === 0 ? (
            <Empty />
          ) : (
            <Table head={["ລຳດັບ", "ລະຫັດ", "ຊື່ອຸປະກອນ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
              {standard.rows.map((row) => (
                <tr key={`${row.item_code}-${row.rnum}`} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-center">{row.rnum}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.item_code}</td>
                  <td className="px-3 py-2">{row.item_name}</td>
                  <td className="px-3 py-2 text-center">{Number(row.qty)}</td>
                  <td className="px-3 py-2 text-center">{row.unit_code}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </details>
    </div>
  );
}
