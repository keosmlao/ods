import { Elapsed } from "@/components/elapsed";
import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { ownJobsOnly } from "@/lib/scope";
import { TRANS } from "@/lib/stock-constants";

/**
 * ຊ່າງຮັບອາໄຫຼ່ (ວຽກສ້ອມ) — ຂັ້ນນີ້ມີແຕ່ໃນສາຍງານຕິດຕັ້ງ (/installations/spare-pickup)
 * ສ່ວນສາຍງານສ້ອມບໍ່ເຄີຍມີ ⇒ tb_used_spare.pick_finish ຂອງວຽກສ້ອມເປັນ null ທຸກແຖວ
 * ທັງທີ່ໜ້າ /repair ແລະ /repair/[code] ອ່ານມັນຢູ່ແລ້ວ. ບ່ອນນີ້ຄືຂັ້ນທີ່ຂາດໄປ.
 *
 * ວາງໄວ້ໃຕ້ /stock/requests ໂດຍເຈດຕະນາ — ກົດເກນສິດ (lib/roles) ຂອງ /stock/requests
 * ເປີດໃຫ້ ຊ່າງ + ສາງ + ຜູ້ຈັດການ ພໍດີກັບຄົນທີ່ຕ້ອງໃຊ້ໜ້ານີ້.
 */
export const dynamic = "force-dynamic";

/** trans_flag ຂອງໃບ "ຊ່າງຮັບອາໄຫຼ່" (PISP) — ຄືກັບ actions/stock.ts */
const TRANS_PICK = 166;

type Row = {
  doc_no: string;
  at_time: string | null;
  elapsed_seconds: number | null;
  code: string;
  customer: string | null;
  product: string | null;
  brand: string | null;
  issue: string | null;
  technician: string | null;
  lines: number;
};

const HEAD = ["ເລກທີໃບເບີກ", "ຄ້າງມາ", "ເລກທີວຽກ", "ຊື່ເຄື່ອງ / SN", "ຫຍີ່ຫໍ້", "ລູກຄ້າ", "ອາການ", "ຊ່າງ", "ອາໄຫຼ່", ""];

const COLUMNS = `ic.doc_no,
  to_char(coalesce(ic.create_date_time_now, ic.doc_date),'DD-MM-YYYY HH24:MI') at_time,
  greatest(0, round(extract(epoch from (localtimestamp - coalesce(ic.create_date_time_now, ic.doc_date)))))::int elapsed_seconds,
  p.code, concat_ws('-', c.name_1, c.tel) customer,
  concat_ws(' · ', p.name_1, p.sn) product, p.p_brand brand, coalesce(p.issue_2, p.issue) issue,
  p.emp_code technician,
  (select count(*) from ic_trans_detail d where d.doc_no = ic.doc_no and d.trans_flag = ic.trans_flag)::int lines`;

/**
 * ໃບເບີກ (SWC) ຂອງວຽກສ້ອມທີ່ຊ່າງຍັງບໍ່ທັນມາຮັບ.
 * job_type ເປັນ null = ວຽກສ້ອມ ('install' = ງານຕິດຕັ້ງ ເຊິ່ງມີໜ້າຂອງມັນເອງແລ້ວ).
 */
async function getWaiting(emp: string | null) {
  const sql = `select ${COLUMNS}
    from ic_trans ic
    join tb_product p on p.code = ic.product_code
    left join ar_customer c on c.code = p.cust_code
    where ic.trans_flag = $1 and (ic.job_type is null or ic.job_type <> 'install')
      and p.status <> 6 and p.return_complete is null
      and not exists (select 1 from ic_trans t where t.trans_flag = $2 and t.doc_ref = ic.doc_no)
      and exists (select 1 from tb_used_spare s where s.product_code = ic.product_code and s.pick_finish is null)
      ${emp ? "and p.emp_code = $3" : ""}
    order by coalesce(ic.create_date_time_now, ic.doc_date) asc nulls last`;
  const params: unknown[] = [TRANS.DISPATCH, TRANS_PICK];
  if (emp) params.push(emp);
  return (await query<Row>(sql, params)).rows;
}

/** ໃບຮັບອາໄຫຼ່ (PISP) ທີ່ຊ່າງຮັບແລ້ວ — 30 ໃບລ່າສຸດ */
async function getDone(emp: string | null) {
  const sql = `select ${COLUMNS}
    from ic_trans ic
    join tb_product p on p.code = ic.product_code
    left join ar_customer c on c.code = p.cust_code
    where ic.trans_flag = $1 and (ic.job_type is null or ic.job_type <> 'install')
      ${emp ? "and p.emp_code = $2" : ""}
    order by ic.doc_no desc
    limit 30`;
  const params: unknown[] = [TRANS_PICK];
  if (emp) params.push(emp);
  return (await query<Row>(sql, params)).rows;
}

function Cells({ row }: { row: Row }) {
  const tone = elapsedTone(row.elapsed_seconds);
  return (
    <>
      <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{row.doc_no}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <Elapsed
          seconds={row.elapsed_seconds}
          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
        />
        <span className="mt-0.5 block text-[10px] text-slate-400">{row.at_time ?? "-"}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{row.code}</td>
      <td className="max-w-64 truncate px-3 py-2.5" title={row.product ?? ""}>
        {row.product ?? "-"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{row.brand ?? "-"}</td>
      <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>
        {row.customer ?? "-"}
      </td>
      <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
        {row.issue ?? "-"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">{row.technician ?? "-"}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-center">{row.lines}</td>
    </>
  );
}

export default async function SparePickupPage() {
  const session = await getSession();
  // ຊ່າງເຫັນສະເພາະວຽກຂອງຕົນ — ຜູ້ຈັດການ/ສາງ ເຫັນທຸກໃບ
  const emp = ownJobsOnly(session);

  const [waiting, done] = await Promise.all([getWaiting(emp), getDone(emp)]);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ອາໄຫຼ່ທີ່ສາງເບີກອອກໃຫ້ແລ້ວ — ຢືນຢັນຕອນຊ່າງມາຮັບຂອງ">ຮັບອາໄຫຼ່ (ສ້ອມແປງ)</PageTitle>

      <Card title={`ລໍຖ້າຊ່າງມາຮັບ (${waiting.length})`}>
        {waiting.length === 0 ? (
          <Empty />
        ) : (
          <Table head={HEAD} minWidth={1400}>
            {waiting.map((row) => (
              <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                <Cells row={row} />
                <td className="px-3 py-2.5 text-center">
                  <LinkButton
                    href={`/stock/requests/pickup/${encodeURIComponent(row.doc_no)}`}
                    className="h-8 px-3 text-xs"
                  >
                    ຮັບອາໄຫຼ່
                  </LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="ຮັບອາໄຫຼ່ແລ້ວ">
        {done.length === 0 ? (
          <Empty />
        ) : (
          <Table head={HEAD} minWidth={1400}>
            {done.map((row) => (
              <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                <Cells row={row} />
                <td className="px-3 py-2.5 text-center">
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    ຮັບແລ້ວ
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <p className="text-center text-xs text-slate-400">
        ອາໄຫຼ່ທີ່ສາງຍັງບໍ່ທັນເບີກອອກ ຈະບໍ່ປາກົດຢູ່ໜ້ານີ້ — ຕິດຕາມສະຖານະໄດ້ທີ່ໜ້າ &quot;ໃບຂໍເບີກອາໄຫຼ່&quot;
      </p>
    </div>
  );
}
