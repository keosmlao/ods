import { saveInstallReceiveReturn } from "@/app/actions/installation-returns";
import { DocSaveForm } from "@/components/installation/doc-save-form";
import { JOB_HEAD_COLUMNS, JobHeader, type JobHead } from "@/components/installation/job-header";
import { SpareLineTable, type SpareLine } from "@/components/stock/spare-lines";
import { ErrorBox, PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { TRANS } from "@/lib/stock-constants";
import { notFound } from "next/navigation";

/**
 * ສາງຮັບອາໄຫຼ່ຄືນຂອງງານຕິດຕັ້ງ.
 * ຖອດແບບຈາກ ods: /show_return_inst/<doc_no> + templates/stock/show_return_inst.html
 * (tech_install.py:783) — ຟອມນັ້ນ post ໄປ /save_com_return ຮ່ວມກັບຝັ່ງສ້ອມ,
 * ຢູ່ນີ້ແຍກເປັນ saveInstallReceiveReturn ເພື່ອຕິດ job_type='install' ໃສ່ເອກະສານ SRT.
 * ພາຣາມິເຕີ docNo = ເລກໃບຂໍສົ່ງຄືນ SRI.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  product_code: string;
  remark: string | null;
};

export default async function ReceiveInstallReturnPage({ params }: Props) {
  const docNo = decodeURIComponent((await params).docNo);

  const doc = await query<Head>(
    `select doc_no, to_char(doc_date,'DD-MM-YYYY') doc_date, doc_ref, product_code, remark
     from ic_trans where doc_no=$1 and trans_flag=$2 and job_type='install' limit 1`,
    [docNo, TRANS.RETURN_REQUEST],
  );
  const bill = doc.rows[0];
  if (!bill) notFound();

  const [job, lines, received] = await Promise.all([
    query<JobHead>(
      `select ${JOB_HEAD_COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [bill.product_code],
    ),
    query<Omit<SpareLine, "roworder">>(
      `select row_number() over (order by roworder asc)::int rnum, item_code, item_name, qty, unit_code
       from ic_trans_detail where doc_no=$1 order by roworder asc`,
      [docNo],
    ),
    // ods ບໍ່ກວດວ່າຮັບຄືນໄປແລ້ວ → ຮັບຊ້ຳໄດ້ ແລະ ສະຕັອກບວກສອງເທື່ອ
    query<{ count: number }>("select count(*)::int count from ic_trans where trans_flag=$1 and doc_ref=$2", [
      TRANS.RECEIVE_BACK,
      docNo,
    ]),
  ]);

  if (!job.rows[0]) notFound();
  const done = Boolean(received.rows[0]?.count);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={`ເລກທີໃບຂໍສົ່ງຄືນ ${docNo} · ວັນທີ ${bill.doc_date ?? "-"} · ອ້າງອີງໃບເບີກ ${bill.doc_ref ?? "-"}`}>
        ຮັບຄືນອາໄຫຼ່ເຂົ້າສາງ (ຕິດຕັ້ງ)
      </PageTitle>

      <JobHeader head={job.rows[0]} />

      <SpareLineTable lines={lines.rows} />

      {lines.rows.length === 0 && <ErrorBox>ບໍ່ມີອາໄຫຼ່ໃນໃບນີ້</ErrorBox>}
      {done && <ErrorBox>ໃບນີ້ຮັບຄືນເຂົ້າສາງແລ້ວ</ErrorBox>}

      <DocSaveForm
        action={saveInstallReceiveReturn}
        docRef={docNo}
        productCode={bill.product_code}
        today={today}
        backHref="/stock/receive-returns"
        submitLabel="ຮັບຄືນ"
        disabled={lines.rows.length === 0 || done}
      />
    </div>
  );
}
