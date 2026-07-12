import { Chatter } from "@/components/chatter/chatter";
import { Elapsed } from "@/components/elapsed";
import { JOB_HEAD_COLUMNS, type JobHead, JobHeader } from "@/components/installation/job-header";
import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { INSTALL_ELAPSED_SQL, INSTALL_STAGE_SQL, installStageChip, installStageLabel } from "@/lib/install-stage";
import { notFound } from "next/navigation";

/**
 * ໜ້າລາຍລະອຽດງານຕິດຕັ້ງ — **ອ່ານຢ່າງດຽວ**, ເປີດໃຫ້ທຸກຄົນທີ່ login (lib/roles).
 *
 * ── ເປັນຫຍັງຈຶ່ງຕ້ອງມີ ──
 * ຝັ່ງສ້ອມມີ /service/<code> ມາແຕ່ຕົ້ນ ແຕ່ຝັ່ງຕິດຕັ້ງມີແຕ່ /edit ກັບ /print.
 * recordHref() ຂອງ lib/chatter ຈຶ່ງຊີ້ການແຈ້ງເຕືອນຂອງ ods_tb_install ໄປທີ່ /edit
 * ເຊິ່ງເປັນໜ້າຂອງ **ຝ່າຍບໍລິການ** ເທົ່ານັ້ນ — ໃນຂະນະທີ່ຄົນທີ່ຖືກແຈ້ງແມ່ນ
 * **ຊ່າງ** (assignTech ແຈ້ງ "ມີງານໃໝ່") ແລະ **ສາງ** (saveSpareRequest ແຈ້ງ "ມີໃບຂໍເບີກ").
 * ⇒ ທຸກການແຈ້ງເຕືອນຂອງງານຕິດຕັ້ງ ພາຊ່າງ/ສາງ ໄປຕົກໃສ່ /forbidden ແລະ chatter ຂອງ
 * ງານຕິດຕັ້ງກາຍເປັນ "ຂຽນຢ່າງດຽວ" ສຳລັບສອງ role ນັ້ນ.
 *
 * ໜ້ານີ້ຄືປາຍທາງໃໝ່ຂອງການແຈ້ງເຕືອນ (ເບິ່ງ recordHref). ອ່ານຢ່າງດຽວ ຈຶ່ງເປີດກວ້າງໄດ້
 * ຢ່າງປອດໄພ — ປຸ່ມລົງມືຍັງຢູ່ໜ້າຂອງແຕ່ລະຝ່າຍຄືເກົ່າ ແລະ ທຸກ action ກວດສິດເອງ (lib/guard).
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

type Row = JobHead & {
  stage: number;
  elapsed_seconds: number;
  remark: string | null;
  location_inst: string | null;
  pro_sn: string | null;
  user_created: string | null;
  cancel_remark: string | null;
  cancel_date: string | null;
};

type Spare = {
  item_code: string | null;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  reg_start: string | null;
  reg_finish: string | null;
  pick_finish: string | null;
};

type Doc = { doc_no: string; doc_date: string | null; trans_flag: number; lines: number };

/** ຊື່ເອກະສານຂອງສາຍງານຕິດຕັ້ງ — ຄືກັບ lib/stock-constants */
const DOC_LABEL: Record<number, string> = {
  122: "ໃບຂໍເບີກ (SION)",
  56: "ໃບເບີກອອກສາງ (SWC)",
  166: "ຊ່າງຮັບອາໄຫຼ່ (PISP)",
  59: "ໃບຂໍສົ່ງຄືນ (SRI)",
  58: "ສາງຮັບຄືນ (SRT)",
};

export default async function InstallationDetail({ params }: Props) {
  const code = decodeURIComponent((await params).code);

  const [job, spares, docs] = await Promise.all([
    query<Row>(
      `select ${JOB_HEAD_COLUMNS},
          (${INSTALL_STAGE_SQL})::int as stage,
          (${INSTALL_ELAPSED_SQL}) as elapsed_seconds,
          a.remark, a.location_inst, a.pro_sn, a.user_created, a.cancel_remark,
          to_char(a.cancel_date,'DD-MM-YYYY HH24:MI') as cancel_date
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
        where a.code = $1 limit 1`,
      [code],
    ),
    query<Spare>(
      `select item_code, item_name, coalesce(qty,0)::text qty, unit_code,
          to_char(reg_start,'DD-MM-YYYY') reg_start,
          to_char(reg_finish,'DD-MM-YYYY') reg_finish,
          to_char(pick_finish,'DD-MM-YYYY') pick_finish
        from tb_used_spare where product_code = $1 order by roworder`,
      [code],
    ),
    query<Doc>(
      `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date, t.trans_flag,
          (select count(*)::int from ic_trans_detail d where d.doc_no = t.doc_no) lines
        from ic_trans t
        where t.product_code = $1 and t.trans_flag in (122,56,166,59,58)
        order by t.doc_no`,
      [code],
    ),
  ]);

  const row = job.rows[0];
  if (!row) notFound();

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={`ງານຕິດຕັ້ງ ${row.code}`}>ລາຍລະອຽດງານຕິດຕັ້ງ</PageTitle>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${installStageChip(row.stage)}`}>
          {installStageLabel(row.stage)}
        </span>
        <Elapsed
          seconds={row.elapsed_seconds}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600"
        />
        <div className="ml-auto flex gap-2">
          <LinkButton tone="neutral" href={`/installations/${encodeURIComponent(row.code)}/print`}>
            ພິມ
          </LinkButton>
        </div>
      </div>

      {row.cancel_date && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <p className="text-sm font-bold text-red-800">ງານນີ້ຖືກຍົກເລີກແລ້ວ · {row.cancel_date}</p>
          {row.cancel_remark && <p className="mt-0.5 text-xs text-red-700">ເຫດຜົນ: {row.cancel_remark}</p>}
        </div>
      )}

      <JobHeader head={row} />

      <Card title="ຂໍ້ມູນເພີ່ມເຕີມ">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["ສະຖານທີ່ຕິດຕັ້ງ", row.location_inst],
              ["Serial number", row.pro_sn],
              ["ຜູ້ເປີດງານ", row.user_created],
              ["ໝາຍເຫດ", row.remark],
            ] as [string, string | null][]
          ).map(([label, value]) => (
            <div key={label} className="border-b border-slate-100 pb-2">
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={`ອາໄຫຼ່ຂອງງານ (${spares.rows.length})`}>
        {spares.rows.length === 0 ? (
          <Empty>ງານນີ້ບໍ່ໃຊ້ອາໄຫຼ່</Empty>
        ) : (
          <Table head={["ລະຫັດ", "ຊື່ອາໄຫຼ່", "ຈຳນວນ", "ຂໍເບີກ", "ສາງເບີກ", "ຊ່າງຮັບ"]} minWidth={700}>
            {spares.rows.map((spare, index) => (
              <tr key={`${spare.item_code}-${index}`} className="border-b border-slate-100">
                <td className="px-3 py-2 text-xs">{spare.item_code ?? "-"}</td>
                <td className="px-3 py-2 text-xs">{spare.item_name ?? "-"}</td>
                <td className="px-3 py-2 text-xs font-semibold">
                  {Number(spare.qty).toLocaleString()} {spare.unit_code ?? ""}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{spare.reg_start ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{spare.reg_finish ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{spare.pick_finish ?? "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`ເອກະສານທີ່ກ່ຽວຂ້ອງ (${docs.rows.length})`}>
        {docs.rows.length === 0 ? (
          <Empty>ຍັງບໍ່ມີເອກະສານ</Empty>
        ) : (
          <Table head={["ປະເພດ", "ເລກທີ", "ວັນທີ", "ລາຍການ"]} minWidth={600}>
            {docs.rows.map((doc) => (
              <tr key={doc.doc_no} className="border-b border-slate-100">
                <td className="px-3 py-2 text-xs">{DOC_LABEL[doc.trans_flag] ?? doc.trans_flag}</td>
                <td className="px-3 py-2 text-xs font-semibold">{doc.doc_no}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{doc.doc_date ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{doc.lines}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Chatter model="ods_tb_install" resId={row.code} />
    </div>
  );
}
