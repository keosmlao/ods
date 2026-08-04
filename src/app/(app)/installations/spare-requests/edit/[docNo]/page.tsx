import {
  JOB_HEAD_COLUMNS,
  JobHeader,
  type JobHead,
} from "@/components/installation/job-header";
import {
  SpareRequestEditForm,
  type Shelf,
} from "@/components/installation/spare-request-edit-form";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { getEditableSpareLines } from "@/lib/install-spare-edit";
import { canViewAssignedJob } from "@/lib/scope";
import { getBalances } from "@/lib/stock-balance";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * ── ແກ້ໃບຂໍເບີກຕິດຕັ້ງທີ່ບັນທຶກແລ້ວ (SION 122) ──
 *
 * ໃບຄາເລກເກົ່າ: ແກ້ຈຳນວນ · ຖອດລາຍການ (ໃສ່ 0) · ເພີ່ມລາຍການທີ່ຍັງຄ້າງໃນກະຕ່າ ·
 * ວັນທີ · ສາງ/ທີ່ເກັບ · ໝາຍເຫດ. ດ່ານກັນຈິງຢູ່ actions/installation.updateSpareRequest
 * (ໜ້ານີ້ພຽງກັນບໍ່ໃຫ້ເປີດເຂົ້າມາລ້າໆ).
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  product_code: string | null;
  remark: string | null;
  wh_code: string | null;
  shelf_code: string | null;
};

type Guard = {
  cancelled: boolean;
  closed: boolean;
  started: boolean;
};

export default async function EditSpareRequestPage({ params }: Props) {
  const docNo = decodeURIComponent((await params).docNo);
  const session = await getSession();
  if (!session) redirect("/login");

  const head = await query<Head>(
    `select doc_no, to_char(doc_date,'YYYY-MM-DD') as doc_date, product_code, remark, wh_code, shelf_code
       from ic_trans where doc_no = $1 and trans_flag = 122 limit 1`,
    [docNo],
  );
  const doc = head.rows[0];
  if (!doc?.product_code) notFound();
  const code = doc.product_code;

  const [job, guard, dispatched] = await Promise.all([
    query<JobHead>(
      `select ${JOB_HEAD_COLUMNS}
         from ods_tb_install a
         left join ar_customer c on c.code = a.cust_code
        where a.code = $1 limit 1`,
      [code],
    ),
    query<Guard>(
      `select cancel_date is not null as cancelled, job_finish is not null as closed,
          start_install is not null as started
         from ods_tb_install where code = $1 limit 1`,
      [code],
    ),
    // ສາງເບີກຕາມໃບນີ້ແລ້ວ ⇒ ແກ້ບໍ່ໄດ້ (ນິຍາມດຽວກັບ deleteSpareRequest)
    query<{ doc_no: string }>(
      "select doc_no from ic_trans where doc_ref = $1 limit 1",
      [docNo],
    ),
  ]);
  if (!job.rows[0] || !guard.rows[0]) notFound();
  if (!canViewAssignedJob(session, job.rows[0].tech_code)) redirect("/forbidden");

  const blocked = dispatched.rows[0]
    ? `ສາງເບີກອາໄຫຼ່ຕາມໃບນີ້ໄປແລ້ວ (${dispatched.rows[0].doc_no}) — ແກ້ບໍ່ໄດ້`
    : guard.rows[0].cancelled
      ? "ງານນີ້ຖືກຍົກເລີກແລ້ວ — ແກ້ໃບຂໍເບີກບໍ່ໄດ້"
      : guard.rows[0].closed
        ? "ງານນີ້ປິດແລ້ວ — ແກ້ໃບຂໍເບີກບໍ່ໄດ້"
        : guard.rows[0].started
          ? "ງານນີ້ເລີ່ມຕິດຕັ້ງແລ້ວ — ແກ້ໃບຂໍເບີກບໍ່ໄດ້"
          : null;

  if (blocked) {
    return (
      <div className="w-full space-y-5">
        <PageTitle>ແກ້ໃບຂໍເບີກ {docNo}</PageTitle>
        <JobHeader head={job.rows[0]} />
        <div className="flex items-start gap-3 rounded-xl border border-brand-orange-400 bg-brand-orange-100 p-5 shadow-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand-900" />
          <div className="space-y-2">
            <p className="text-sm font-bold text-brand-900">{blocked}</p>
            <Link
              href={`/installations/spare-requests/view/${encodeURIComponent(docNo)}`}
              className="text-xs text-brand-900 underline"
            >
              ເປີດເບິ່ງໃບຂໍເບີກ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lines = await getEditableSpareLines(code, docNo);
  const balanceMap = await getBalances(lines.map((line) => line.item_code));
  const [warehouses, shelves] = await Promise.all([
    queryOdg<{ code: string; name_1: string }>(
      "select code, name_1 from ic_warehouse order by code",
    ),
    queryOdg<Shelf>("select whcode, code, name_1 from ic_shelf order by whcode, code"),
  ]);
  const balances = Object.fromEntries(
    [...balanceMap.entries()].map(([itemCode, balance]) => [
      itemCode,
      {
        total: balance.total,
        byWarehouse: Object.fromEntries(balance.byWarehouse),
      },
    ]),
  );

  return (
    <div className="w-full space-y-4">
      <PageTitle sub={`ງານ ${code} — ແກ້ຈຳນວນ/ລາຍການ ແລ້ວບັນທຶກຄາເລກໃບເກົ່າ`}>
        ແກ້ໃບຂໍເບີກ {docNo}
      </PageTitle>
      <JobHeader head={job.rows[0]} />
      <SpareRequestEditForm
        docNo={docNo}
        code={code}
        docDate={doc.doc_date ?? ""}
        remark={doc.remark ?? ""}
        whCode={doc.wh_code ?? ""}
        shelfCode={doc.shelf_code ?? ""}
        lines={lines}
        warehouses={warehouses.rows}
        shelves={shelves.rows}
        balances={balances}
      />
    </div>
  );
}
