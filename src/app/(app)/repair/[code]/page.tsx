import { AcceptRepairButton } from "@/components/repair/accept-repair-button";
import { BackLink } from "@/components/back-link";
import { CompleteRepairButton } from "@/components/repair/complete-repair-button";
import { StartRepairButton, UndoStartRepairButton } from "@/components/repair/repair-actions";
import { JobEvidence, type Checkin, type JobPhoto, type ReceivePhoto } from "@/components/service/job-evidence";
import { JobProgress } from "@/components/repair/job-progress";
import { LinkPending } from "@/components/link-pending";
import { RepairSpareEditor, type UsedSpareLine } from "@/components/repair/repair-spare-editor";
import { SpareRounds } from "@/components/repair/spare-rounds";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canViewAssignedJob } from "@/lib/scope";
import { repairSpareRounds } from "@/lib/repair-spare-rounds";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { STAGE_LABEL, STAGE_SQL } from "@/lib/stage";
import { TRANS } from "@/lib/stock-constants";
import { ArrowLeft, ClipboardCheck, FileText, Printer, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * **ໜ້າວຽກຊ່າງ (ສ້ອມ) ຢູ່ເວັບ — ຕົງກັບແອັບ**.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ຢູ່ແອັບ ຊ່າງເປີດໃບງານດຽວແລ້ວເຫັນ **ທຸກຂັ້ນ ແລະ ທຸກປຸ່ມຂອງຕົນ** ຢູ່ໜ້າດຽວ
 * (ຮັບງານ → ກວດເຊັກ → ຂໍເບີກ/ຮັບອາໄຫຼ່ → ຈົບງານ) ແຕ່ຢູ່ເວັບ ປຸ່ມພວກນີ້ **ກະຈາຍຢູ່ 5 ໜ້າ**
 * (/repair · /checking · /stock/requests · /stock/requests/pickup · /service/<ລະຫັດ>)
 * ⇒ ຄົນທີ່ເຮັດວຽກຢູ່ຄອມ ຕ້ອງຈື່ວ່າຂັ້ນໃດຢູ່ໜ້າໃດ ແລະ ຂັ້ນຕອນສອງທາງບໍ່ຕົງກັນ.
 *
 * ໜ້ານີ້ = **ຄູ່ຂອງ job_screen.dart** ຂອງແອັບ: ຂໍ້ມູນງານ · ຂັ້ນຕອນ · ປຸ່ມຕາມຂັ້ນ ·
 * ອາໄຫຼ່ (ຕາມຮອບ) · ຫຼັກຖານ/ຮູບ. ໃຊ້ **action ອັນດຽວກັນ** ກັບແອັບ (lib/job-flow)
 * ⇒ ດ່ານ ແລະ ຜົນລັບຕົງກັນສະເໝີ.
 *
 * ⚠️ ຂໍ້ຕ່າງດຽວທີ່ຕັ້ງໃຈ: **check-in ໜ້າງານເຮັດຢູ່ແອັບເທົ່ານັ້ນ** (ຕ້ອງ GPS + ຮູບຈິງ)
 * — ໜ້ານີ້ສະແດງຜົນ check-in ໃຫ້ເບິ່ງ ແຕ່ບໍ່ໃຫ້ກົດແທນ.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

type Job = {
  code: string;
  roworder: number;
  stage: number;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  issue: string | null;
  issue_2: string | null;
  warranty: string | null;
  service_type: string | null;
  customer: string | null;
  phone: string | null;
  address: string | null;
  technician: string | null;
  accepted: boolean;
  /** ເລີ່ມສ້ອມແລ້ວ (time_repair) — ວຽກເດີນໜ້າໄປແລ້ວ ເຖິງ repair_confirm ຈະຫວ່າງ */
  started: boolean;
  cancelled: boolean;
  registered: string | null;
  appoint_date: string | null;
  repair_note: string | null;
};

export default async function RepairJobPage({ params }: Props) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const job = (
    await query<Job>(
      `select a.code, a.roworder, (${STAGE_SQL})::int stage,
          a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
          a.issue, a.issue_2, a.warrunty warranty, a.service_type,
          c.name_1 customer, c.tel phone, c.address,
          nullif(a.emp_code,'') technician,
          (a.repair_confirm is not null) accepted,
          (a.time_repair is not null) started,
          (a.status = 6) cancelled,
          to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
          to_char(a.appoint_date,'DD-MM-YYYY') appoint_date,
          a.repair_note
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) notFound();
  // ຊ່າງເຫັນສະເພາະງານຂອງຕົນ (ກົດເກນດຽວກັບໜ້າ /service/<ລະຫັດ> ແລະ ແອັບ)
  if (!canViewAssignedJob(session, job.technician)) redirect("/forbidden");

  const spareWindow = job.stage >= 5 && job.stage <= 9 && !job.cancelled;

  const [spareRounds, spareRows, checkins, receivePhotos, jobPhotoRows] = await Promise.all([
    repairSpareRounds(code),
    spareWindow
      ? query<UsedSpareLine>(
          `select s.roworder, s.item_code, s.item_name, coalesce(s.qty,0)::int qty, s.unit_code,
             (s.reg_start is not null) as "requested",
             (s.pick_finish is not null or exists (
                select 1 from ic_trans_detail d
                where d.product_code = s.product_code and d.item_code = s.item_code
                  and d.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}))) as "locked"
           from tb_used_spare s where s.product_code = $1 order by s.roworder`,
          [code],
        )
      : Promise.resolve({ rows: [] as UsedSpareLine[] }),
    query<Checkin>(
      `select id, job_code, tech_code, to_char(checkin_at,'DD-MM-YYYY HH24:MI') checkin_at,
          checkin_lat, checkin_lng, checkin_photo,
          to_char(checkout_at,'DD-MM-YYYY HH24:MI') checkout_at, checkout_lat, checkout_lng, note
        from ods_job_checkin where workflow='repair' and job_code=$1 order by id`,
      [code],
    ),
    query<ReceivePhoto>(
      `select roworder, product_url, coalesce(line_number,0) line_number
         from product_image where iteme_code=$1 and coalesce(product_url,'')<>''
           and lower(product_url) ~ '\\.(jpe?g|png|gif|webp)$'
        order by line_number, roworder desc`,
      [code],
    ),
    query<JobPhoto & { kind: string }>(
      `select id, kind, photo, created_by, to_char(created_at,'DD-MM-YYYY HH24:MI') created_at
         from ods_job_photo where workflow='repair' and job_code=$1 and kind in ('check','finish') order by id`,
      [code],
    ),
  ]);

  /**
   * ຍັງມີຮອບອາໄຫຼ່ຄ້າງບໍ — ຄ້າງຢູ່ ⇒ **ບໍ່ສະແດງປຸ່ມສ້ອມ**.
   * ປຸ່ມ "ເລີ່ມສ້ອມ/ສ້ອມສຳເລັດ" ເປັນຂອງ**ຂັ້ນສ້ອມ** ບໍ່ແມ່ນຂັ້ນອາໄຫຼ່ — ເອົາມາປົນກັນ
   * ຄົນຈະກົດຈົບງານທັງທີ່ອາໄຫຼ່ຍັງບໍ່ຮອດມື (ດ່ານຝັ່ງ server ກໍ່ຈະປະຕິເສດຢູ່ແລ້ວ).
   */
  // ສາງເບີກແລ້ວ = ຜ່ານ ⇒ ກັກໄວ້ສະເພາະຮອບທີ່ **ສາງຍັງບໍ່ເບີກ** (state "requested")
  const sparePending = spareRounds.withdrawals.some((round) => round.state === "requested");
  const spareLines = spareRows.rows;
  const pendingSpares = spareLines.filter((line) => !line.locked).length;
  const checkPhotos = jobPhotoRows.rows.filter((p) => p.kind === "check");
  const finishPhotos = jobPhotoRows.rows.filter((p) => p.kind === "finish");
  const serviceLabel = job.service_type ? (SERVICE_TYPE_LABEL[job.service_type] ?? job.service_type) : null;

  return (
    // ເຕັມຄວາມກວ້າງ ຄືກັບໜ້າໃບຮັບເຄື່ອງ/ຄິວອື່ນ — ຕາຕະລາງອາໄຫຼ່ຕາມຮອບ ແລະ ຮູບ ຕ້ອງການບ່ອນ
    <div className="w-full space-y-4">
      <div>
        <BackLink fallback="/work/repair/repairing" label="ກັບຄິວກຳລັງສ້ອມ" />
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-700">ວຽກສ້ອມ #{job.code}</h1>
          <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
            {STAGE_LABEL[job.stage] ?? "-"}
          </span>
          {serviceLabel && (
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{serviceLabel}</span>
          )}
          {job.cancelled && (
            <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">ຍົກເລີກແລ້ວ</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {job.product || "-"} {job.model && `· ${job.model}`} {job.sn && `· SN ${job.sn}`} · ລູກຄ້າ {job.customer || "-"}
          {job.phone && ` · ${job.phone}`}
        </p>
      </div>

      <JobProgress stage={job.stage} serviceType={job.service_type} cancelled={job.cancelled} />

      {/* ── ປຸ່ມຂອງຊ່າງ ຕາມຂັ້ນ — ລຳດັບດຽວກັບແອັບ ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
          <Wrench className="size-4 text-teal-600" />
          ຂັ້ນຕອນຂອງຊ່າງ
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* ① ຮັບງານ (ຄືປຸ່ມ accept ຢູ່ແອັບ) */}
          {!job.accepted && !job.started && !job.cancelled && <AcceptRepairButton code={job.code} />}

          {/* ② ກວດເຊັກ — ໜ້າດຽວກັບ CheckScreen ຂອງແອັບ */}
          {job.stage >= 1 && job.stage <= 2 && !job.cancelled && (
            <Link
              href={`/checking/${encodeURIComponent(job.code)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
            >
              <ClipboardCheck className="size-4" />
              {job.stage === 1 ? "ເລີ່ມກວດເຊັກ" : "ບັນທຶກຜົນກວດເຊັກ"}
              <LinkPending className="size-3" />
            </Link>
          )}

          {/* ③ ອາໄຫຼ່ — ບໍ່ມີປຸ່ມຢູ່ນີ້: ຂໍເບີກ/ຮັບອາໄຫຼ່ ຢູ່ໃນແຜງ "ອາໄຫຼ່ຂອງໃບງານ" ຂ້າງລຸ່ມ
              (ປຸ່ມຕ້ອງຢູ່ກັບແຖວຂອງໃບທີ່ມັນເປັນເຈົ້າຂອງ ບໍ່ແມ່ນລອຍຢູ່ແຖວຂັ້ນຕອນ) */}

          {/* ④ ຈົບງານ — ຂັ້ນ 8 ກົດໄດ້ເລີຍ ຄືກັບແອັບ (ບໍ່ຕ້ອງກົດ "ເລີ່ມສ້ອມ" ກ່ອນ) */}
          {(job.stage === 8 || job.stage === 9) && !job.cancelled && !sparePending && (
            <>
              <CompleteRepairButton code={job.code} initialNote={job.repair_note ?? ""} />
              {job.stage === 8 && <StartRepairButton code={job.code} />}
              {job.stage === 9 && <UndoStartRepairButton code={job.code} variant="icon" />}
            </>
          )}

          {(job.stage === 8 || job.stage === 9) && !job.cancelled && sparePending && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              ຍັງມີອາໄຫຼ່ຄ້າງ — ຮັບໃຫ້ຄົບກ່ອນ ຈຶ່ງລົງມືສ້ອມໄດ້
            </span>
          )}

          {/* ອ້າງອີງ — ໃບຮັບເຄື່ອງເຕັມ ແລະ ໃບພິມ */}
          <span className="ml-auto flex items-center gap-2">
            <Link
              href={`/service/${encodeURIComponent(job.code)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText className="size-3.5" />
              ໃບຮັບເຄື່ອງ
              <LinkPending className="size-3" />
            </Link>
            <Link
              href={`/repair/${encodeURIComponent(job.code)}/print`}
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="size-3.5" />
              ພິມໃບສ້ອມ
            </Link>
          </span>
        </div>

        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[10px] text-slate-400">ອາການທີ່ລູກຄ້າແຈ້ງ</dt>
            <dd className="mt-0.5 font-medium text-slate-700">{job.issue || "-"}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400">ຜົນກວດຂອງຊ່າງ</dt>
            <dd className="mt-0.5 font-medium text-red-600">{job.issue_2 || "-"}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400">ປະກັນ · ຊ່າງ · ວັນນັດ</dt>
            <dd className="mt-0.5 font-medium text-slate-700">
              {job.warranty || "-"} · {job.technician || "ຍັງບໍ່ຈັດ"} {job.appoint_date && `· ນັດ ${job.appoint_date}`}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] text-slate-400">ບ່ອນຢູ່ລູກຄ້າ</dt>
            <dd className="mt-0.5 text-slate-600">{job.address || "-"}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-slate-400">ຮັບເຄື່ອງເມື່ອ</dt>
            <dd className="mt-0.5 text-slate-600">{job.registered ?? "-"}</dd>
          </div>
        </dl>
      </section>

      <SpareRounds
        code={job.code}
        roworder={String(job.roworder)}
        withdrawals={spareRounds.withdrawals}
        purchases={spareRounds.purchases}
        erp={spareRounds.erp}
        canRequest={spareWindow}
        jobStarted={job.started}
        techReceipt={false}
      />

      {spareWindow && (
        <RepairSpareEditor
          code={job.code}
          roworder={String(job.roworder)}
          lines={spareLines}
          pending={pendingSpares}
        />
      )}

      <JobEvidence
        checkins={checkins.rows}
        receive={receivePhotos.rows}
        checkPhotos={checkPhotos}
        finishPhotos={finishPhotos}
        serviceType={serviceLabel}
      />
    </div>
  );
}
