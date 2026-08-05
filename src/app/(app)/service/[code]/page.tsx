import { Chatter } from "@/components/chatter/chatter";
import { BackLink } from "@/components/back-link";
import { getSession } from "@/lib/auth";
import { Elapsed } from "@/components/elapsed";
import { CompanyDeviceBanner } from "@/components/repair/company-device-banner";
import { HoldButtons } from "@/components/repair/hold-buttons";
import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { holdJsonSql, type JobHold } from "@/lib/job-hold";
import { previousJobOf, REPEAT_DAYS } from "@/lib/repeat";
import { AssignTechButton } from "@/components/installation/assign-tech";
import { relatedClaims } from "@/lib/claim";
import { RepairSpareEditor, type UsedSpareLine } from "@/components/repair/repair-spare-editor";
import { ScheduleRepairVisitButton } from "@/components/repair/schedule-repair-visit-button";
import { listTechnicians } from "@/lib/technicians";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { APPROVER_SIDE, roleOf, SERVICE_SIDE } from "@/lib/roles";
import { canViewAssignedJob } from "@/lib/scope";
import { permissionFor } from "@/lib/permissions";
import { ServiceDeleteButton } from "@/components/service/service-delete-button";
import { JobEvidence, type Checkin, type JobPhoto, type ReceivePhoto } from "@/components/service/job-evidence";
import { FixStageCard } from "@/components/service/fix-stage-card";
import { LoanerCard } from "@/components/service/loaner-card";
import { TransferJobButton } from "@/components/service/transfer-job-button";
import { jobCenterState } from "@/lib/job-center";
import { loanersFor } from "@/lib/loaner";
import { JobProgress } from "@/components/repair/job-progress";
import { SETTING, settingEnabled } from "@/lib/settings";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { stageLabel, STAGE_SQL } from "@/lib/stage";
import { repairTimeline } from "@/lib/repair-timeline";
import { JobTimeline } from "@/components/repair/job-timeline";
import { SpareRounds } from "@/components/repair/spare-rounds";
import { syncErpDispatchForJob } from "@/lib/erp-dispatch";
import { repairSpareRounds } from "@/lib/repair-spare-rounds";
import { nextActor } from "@/lib/repair-next-action";
import { DONE_STAGE } from "@/lib/track";
import { ArrowLeft, Barcode, CalendarDays, ChevronDown, Clock, ImageIcon, MapPin, MessageCircle, Pencil, Phone, Printer, ReceiptText, RotateCcw, UserRound } from "lucide-react";
import Link from "next/link";
import { claimRedirectTarget } from "@/lib/claim-route";
import { notFound, redirect } from "next/navigation";

/**
 * ລາຍລະອຽດໃບຮັບເຄື່ອງ.
 * ຂັ້ນຂອງວຽກມາຈາກ STAGE_SQL (lib/stage.ts) — ບໍ່ຜ່ານ view tracking_tb_product.
 * ຈຳນວນຮູບ ແລະ ຈຳນວນຄັ້ງທີ່ຕິດຕໍ່ ນັບຢູ່ query ດຽວກັນ (ບໍ່ດຶງຮູບມາສະແດງທີ່ນີ້).
 */
type Job = {
  code: string;
  registered: string | null;
  elapsed_seconds: number | null;
  stage: number;
  customer_code: string | null;
  customer: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  sn: string | null;
  model: string | null;
  brand: string | null;
  product_type: string | null;
  accessory: string | null;
  warranty: string | null;
  /** ເຫດຜົນທີ່ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ (tb_product.warranty_reason) — ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ */
  warranty_reason: string | null;
  service_type: string | null;
  issue: string | null;
  issue_2: string | null;
  remark: string | null;
  note: string | null;
  delivery: string | null;
  bill_no: string | null;
  bill_date: string | null;
  technician: string | null;
  /** ວັນນັດ + ສະຖານທີ່ສ້ອມ — ໃຫ້ AssignTechButton (ປ່ຽນຊ່າງ) pre-fill ໄດ້ */
  appoint_date: string | null;
  /** IH: ວັນນັດໄປສ້ອມ ຮອບ 2 (ຫຼັງອະນຸມັດລາຄາ) — ແຍກຈາກ appoint_date (ຮອບ 1 ໄປກວດ) */
  repair_appoint_date: string | null;
  location_inst: string | null;
  location_lat: number | null;
  location_lng: number | null;
  /** ໃຊ້ເປັນ key ຂອງໜ້າ /stock/requests/[roworder] (ຂໍເບີກອາໄຫຼ່) */
  roworder: number;
  receiver: string | null;
  /** ຍົກເລີກ = **ທຸງ** (status=6) ບໍ່ແມ່ນຂັ້ນ — ງານທີ່ຍົກເລີກແຕ່ເຄື່ອງຍັງຢູ່ ຢູ່ຂັ້ນ 11 */
  cancelled: boolean;
  /** ສົ່ງເຄື່ອງຄືນລູກຄ້າສຳເລັດແລ້ວ (return_complete) — ຈຸດທີ່ ເຄມເງິນຄືນ supplier (C) ໄດ້ */
  returned: boolean;
  images: number;
  contacts: number;
  /** ທຸງ "ຕ້ອງກວດ" ທີ່ຍັງເປີດຢູ່ (null = ບໍ່ມີ) — ໃຫ້ HoldButtons ສະແດງສະຖານະ/ປົດ */
  hold: JobHold | null;
  /** ຜົນກວດທີ່ຈົບໂດຍບໍ່ສ້ອມ — 'cannot_repair' | 'replace_advice' | null (ເບິ່ງ lib/check-outcome) */
  check_outcome: string | null;
  /** ໃບນີ້**ເປັນ**ໃບເຄື່ອງບໍລິສັດ ທີ່ຮັບເຂົ້າມາຈາກໃບເລກນີ້ */
  company_from_job: string | null;
  /** ໃບເຄື່ອງບໍລິສັດທີ່**ເກີດຈາກ**ໃບນີ້ (null = ຍັງບໍ່ໄດ້ຮັບເຂົ້າ) */
  company_job: string | null;
};

type Props = { params: Promise<{ code: string }> };

export default async function ServiceDetail({ params }: Props) {
  const { code } = await params;
  /* ໃບເຄມມີໜ້າຂອງຕົນ ⇒ ພາໄປ route ຝັ່ງເຄມ (lib/claim-route) — ຫ້າມມີ 2 ທາງເຂົ້າ */
  const claimPath = await claimRedirectTarget(decodeURIComponent(code), "detail");
  if (claimPath) redirect(claimPath);
  const session = await getSession();
  if (!session) redirect("/login");
  const t = (await getDictionary(await getLocale())).serviceDetail;

  const job = (
    await query<Job>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
         greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
         (${STAGE_SQL}) stage, (a.status = 6) cancelled, (a.return_complete is not null) returned,
         c.code customer_code, c.name_1 customer, c.tel phone, c.address,
         a.name_1 product, a.sn, a.p_model model, a.p_brand brand, a.p_type product_type, a.p_access accessory,
         a.warrunty warranty, a.warranty_reason, a.service_type, a.issue, a.issue_2, a.p_abrasion remark, a.repair_note note,
         -- ຜົນກວດທີ່ຈົບໂດຍບໍ່ສ້ອມ + ການເຊື່ອມກັບໃບເຄື່ອງບໍລິສັດ (ເບິ່ງ lib/check-outcome)
         a.check_outcome, a.company_from_job,
         (select p.code from tb_product p where p.company_from_job = a.code limit 1) company_job,
         a.p_delivery delivery, a.doc_def bill_no, a.doc_date_ref bill_date,
         a.emp_code technician, to_char(a.appoint_date,'YYYY-MM-DD') appoint_date,
         to_char(a.repair_appoint_date,'YYYY-MM-DD') repair_appoint_date,
         a.location_repair location_inst, a.location_lat, a.location_lng, a.roworder, a.user_regis receiver,
         (
           (select count(*) from product_image i
             where i.iteme_code = a.code and coalesce(i.product_url,'') <> '')
           + (select count(*) from ods_job_photo p
               where p.workflow='repair' and p.job_code = a.code and p.kind in ('check','finish'))
         )::int images,
         (select count(*) from cust_contactor t where t.product_code = a.code)::int contacts,
         ${holdJsonSql("repair")}
       from tb_product a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) notFound();
  if (!canViewAssignedJob(session, job.technician)) redirect("/forbidden");

  const timeline = await repairTimeline(code);

  // ໃບເບີກທີ່ສາງອອກຢູ່ ERP ⇒ ດຶງມາກ່ອນ ບໍ່ດັ່ງນັ້ນຮອບອາໄຫຼ່ຂຶ້ນ "ລໍສາງເບີກ" ຄ້າງ
  // (ເບິ່ງ syncErpDispatchForJob — ງານທີ່ບໍ່ມີແຖວລໍເບີກ ບໍ່ແຕະ ERP ເລີຍ)
  await syncErpDispatchForJob(code);

  // ── ຫຼັກຖານໜ້າງານ + ຮູບ — ໂຫຼດມາສະແດງ **ຢູ່ໜ້ານີ້ເລີຍ** (ບໍ່ຕ້ອງກົດເຂົ້າ /images) ──
  const [checkins, receivePhotos, jobPhotoRows, spareRounds, spareSummary] = await Promise.all([
    query<Checkin>(
      // id + job_code — ໃຊ້ຊີ້ຮູບ check-in ຜ່ານ /api/checkin-photo/<code>?id= (ຫ້າມໃສ່ data: ໃສ່ href)
      `select id, job_code, tech_code, to_char(checkin_at,'DD-MM-YYYY HH24:MI') checkin_at,
          checkin_lat, checkin_lng, checkin_photo,
          to_char(checkout_at,'DD-MM-YYYY HH24:MI') checkout_at, checkout_lat, checkout_lng, note
        from ods_job_checkin where workflow='repair' and job_code=$1 order by id`,
      [code],
    ),
    query<ReceivePhoto>(
      // ຮູບເທົ່ານັ້ນ (ຕັດວິດີໂອ) — product_image ເກັບວິດີໂອນຳ ⇒ ບໍ່ໃຫ້ <img> ຂຶ້ນຮູບແຕກ
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
    // ອາໄຫຼ່ແຍກເປັນຮອບ (ຂໍເບີກ/ສັ່ງຊື້ ຫຼາຍເທື່ອ) — ອ່ານຈາກເອກະສານ ບໍ່ແມ່ນຈາກ 4 ຖັນເວລາ
    repairSpareRounds(code),
    // ຍອດແຖວ SIO ລະດັບງານ — ໃຫ້ nextActor() ຕັດສິນ "ຜູ້ເຮັດຕໍ່" (ນິຍາມດຽວກັບສູນວຽກ)
    query<{ pending: number; on_order: number; arrived: number }>(
      `select count(*) filter (where coalesce(status,0) = ${LINE_STATUS.PENDING})::int pending,
          count(*) filter (where status = ${LINE_STATUS.ON_PURCHASE_ORDER} and arrive_at is null)::int on_order,
          count(*) filter (where status = ${LINE_STATUS.ON_PURCHASE_ORDER} and arrive_at is not null)::int arrived
        from ic_trans_detail where product_code = $1 and trans_flag = ${TRANS.REQUEST}`,
      [code],
    ).then((result) => result.rows[0] ?? { pending: 0, on_order: 0, arrived: 0 }),
  ]);
  const checkPhotos = jobPhotoRows.rows.filter((p) => p.kind === "check");
  const finishPhotos = jobPhotoRows.rows.filter((p) => p.kind === "finish");

  const inWarranty = job.warranty === "ຮັບປະກັນ";
  const cancelled = job.cancelled;
  // ຂັ້ນ 12 = ສົ່ງຄືນສຳເລັດ (ຂັ້ນ 11 ດຽວນີ້ແມ່ນ "ລໍຖ້າສົ່ງຄືນ" ຫຼັງເພີ່ມດ່ານ QC)
  const done = job.stage === DONE_STAGE;
  /**
   * "ຕອນນີ້ລໍໃຜເຮັດ" — ຄຳຕອບດຽວກັບສູນວຽກງານສ້ອມ (lib/repair-next-action).
   * ຂັ້ນ 5-9 ແຖວອາໄຫຼ່ທີ່ຍັງຄ້າງຊະນະຂັ້ນ (ເອກະສານເປັນຄວາມຈິງ). ວຽກຈົບ/ນອກຂັ້ນ = null.
   */
  const nextAction = nextActor(
    job.stage,
    { pending: spareSummary.pending, onOrder: spareSummary.on_order, arrived: spareSummary.arrived },
    job.service_type,
  );

  const groups: { title: string; fields: [string, string | null][] }[] = [
    {
      title: t.customerInfo,
      fields: [
        [t.code, job.customer_code],
        [t.name, job.customer],
        [t.phone, job.phone],
        [t.address, job.address],
      ],
    },
    {
      title: t.productInfo,
      fields: [
        [t.productName, job.product],
        ["Serial Number", job.sn],
        ["Model", job.model],
        [t.brand, job.brand],
        [t.type, job.product_type],
        [t.accessory, job.accessory],
        [t.warranty, job.warranty],
        // ຫຼັກຖານທີ່ຊ່າງໃຫ້ໄວ້ຕອນຕັດສິນວ່າໝົດປະກັນ — ສະແດງຄູ່ກັບສະຖານະປະກັນສະເໝີ
        [t.warrantyVoidReason, job.warranty_reason],
        [t.serviceType, job.service_type ? SERVICE_TYPE_LABEL[job.service_type] ?? job.service_type : null],
        [t.delivery, job.delivery],
        [t.issueReported, job.issue],
        [t.issueChecked, job.issue_2],
        [t.markRemark, job.remark],
        [t.repairNote, job.note],
      ],
    },
    {
      title: t.jobInfo,
      fields: [
        [t.receivedDate, job.registered],
        [t.technician, job.technician],
        [t.receiver, job.receiver],
        [t.status, stageLabel(job.stage, job.service_type)],
        // "ຮ້ານຄ້າ" (ap_code) ຖືກຖອດ — ມັນຄື**ລະຫັດລູກຄ້າ**ອັນດຽວກັນ (ສະແດງຢູ່ກຸ່ມລູກຄ້າແລ້ວ)
        [t.billNo, job.bill_no],
        [t.billDate, job.bill_date],
      ],
    },
  ];

  const action = "inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50";

  /**
   * ສ້ອມຊ້ຳ — ເຄື່ອງໜ່ວຍນີ້ (serial ດຽວກັນ) ຫາກໍ່ສົ່ງຄືນໄປພາຍໃນ 30 ມື້ແລ້ວກັບມາອີກ.
   * ຊ່າງຕ້ອງເຫັນໃບເກົ່າກ່ອນລົງມື (ອາການ ແລະ ສິ່ງທີ່ເຮັດໄປແລ້ວ) ບໍ່ດັ່ງນັ້ນຈະໄລ່ຫາເຫດຜົນຄືນໃໝ່
   * ຕັ້ງແຕ່ຕົ້ນ ແລະ ອາດປ່ຽນອາໄຫຼ່ອັນເກົ່າຊ້ຳອີກ.
   */
  const previous = await previousJobOf(code);

  /**
   * ── ຈັດການວຽກຄ້າງ (ຄືຄໍລຳໃນລາຍການ /service) ──
   * ເຫັນສະເພາະ ຫົວໜ້າ/ຜູ້ມີສິດອະນຸມັດ (APPROVER_SIDE) ເມື່ອເປີດ setting JOB_HOLD ໄວ້ ແລະ
   * ວຽກ **ຍັງເຄື່ອນໄຫວຢູ່** (ບໍ່ຈົບ ບໍ່ຍົກເລີກ) — ວຽກຈົບ/ຍົກເລີກ ບໍ່ມີຫຍັງໃຫ້ຈັດການ.
   * server ກວດສິດຊ້ຳ (holdJob/requestCancel/markJobRepaired).
   */
  const canHold = !done && !cancelled && (await settingEnabled(SETTING.JOB_HOLD)) && APPROVER_SIDE.includes(roleOf(session));
  /**
   * ປ່ຽນຊ່າງ ຢູ່ໜ້າລາຍລະອຽດ — ຮອງຮັບກໍລະນີ **ຊ່າງກວດ ≠ ຊ່າງສ້ອມ**: ຫຼັງ A ກວດເຊັກ,
   * CS/ຫົວໜ້າ ປ່ຽນເປັນ B ໃຫ້ໄປສ້ອມ. assignRepairTech ກັນ (ປ່ຽນຫຼັງຂໍເບີກບໍ່ໄດ້) ຢູ່ແລ້ວ.
   *
   * ⚠️ **ໄດ້ 2 ຂັ້ນເທົ່ານັ້ນ** (ກົດເກນ 04-08-2026): ຂັ້ນ 1 ລໍຖ້າຊ່າງຮັບ · ຂັ້ນ 8 ລໍຖ້າສ້ອມ.
   * ຂັ້ນອື່ນຊ່າງກຳລັງລົງມືຢູ່ (ກວດເຊັກ · ສະເໜີລາຄາ · ອາໄຫຼ່ · ກຳລັງສ້ອມ) ⇒ ປ່ຽນແລ້ວ
   * ວຽກທີ່ເຮັດຄ້າງໄວ້ ແລະ ເອກະສານທີ່ອອກໃນນາມຄົນເກົ່າຈະຂາດເຈົ້າຂອງ.
   */
  const REASSIGN_STAGES = [1, 8];
  const canReassign =
    !done && !cancelled && REASSIGN_STAGES.includes(job.stage) && SERVICE_SIDE.includes(roleOf(session));
  // IH ໄປສ້ອມບ້ານລູກຄ້າ: ຫຼັງລູກຄ້າຕົກລົງລາຄາ (ຂັ້ນ 5–9) → ນັດ "ໄປສ້ອມ ຮອບ 2"
  // ⚠️ ບໍ່ຜູກກັບ canReassign ອີກ (ອັນນັ້ນຈຳກັດ 2 ຂັ້ນແລ້ວ) — ນັດໄປສ້ອມແມ່ນຄົນລະເລື່ອງກັບການປ່ຽນຊ່າງ
  const canScheduleVisit =
    !done && !cancelled && SERVICE_SIDE.includes(roleOf(session)) &&
    job.service_type === "IH" && job.stage >= 5 && job.stage <= 9;
  // ລຶບໃບຮັບເຄື່ອງ — **ທຸກສະຖານະ** (ຄ້າງ/ຈົບ/ຍົກເລີກ). ສິດ manager ເທົ່ານັ້ນ (ດ່ານຈິງຢູ່ deleteService).
  const canDelete = (await permissionFor(session, "/service")).delete;
  // ເຄື່ອງສຳຮອງ — ຝ່າຍບໍລິການໃຫ້ຢືມ/ຮັບຄືນໄດ້, ຄົນອື່ນເຫັນຢ່າງດຽວ (action ກວດຊ້ຳເອງ)
  const loaners = await loanersFor(job.code);
  // ບ່ອນຮັບເຄື່ອງ ↔ ບ່ອນທີ່ເຄື່ອງຢູ່ (2 ສູນ) — ໂອນຂ້າມສູນ ແລະ ດ່ານກ່ອນສົ່ງຄືນ (lib/job-center)
  const centers = await jobCenterState(job.code);
  const canLendLoaner = SERVICE_SIDE.includes(roleOf(session));
  const techs = canReassign ? await listTechnicians() : [];

  /**
   * ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — ພົບຕ້ອງໃຊ້ເພີ່ມ/ປ່ຽນ ⇒ ເພີ່ມລາຍການ ແລ້ວ "ຂໍເບີກເພີ່ມ" (ຮອບ 2).
   * requested = ຢູ່ໃບຂໍເບີກແລ້ວ (reg_start) · locked = ເບີກ/ຈ່າຍອອກແລ້ວ (ແກ້/ລຶບບໍ່ໄດ້).
   */
  /**
   * ໜ້າຕ່າງ "ຂໍເບີກ/ປ່ຽນອາໄຫຼ່" = **ຂັ້ນ 5-9** (ຫຼັງກວດເຊັກ ຈົນກ່ອນຈົບສ້ອມ) —
   * ຄົນຂໍເບີກເພີ່ມຕອນ "ກຳລັງເບີກອາໄຫຼ່" (ຂັ້ນ 6) ເປັນປົກກະຕິ ບໍ່ແມ່ນສະເພາະຕອນລົງມືສ້ອມ.
   */
  const spareWindow = job.stage >= 5 && job.stage <= 9;
  /**
   * **ເພີ່ມອາໄຫຼ່ໃສ່ບັນຊີໄດ້ສະເພາະຕອນຍັງກວດເຊັກຢູ່** (ຂັ້ນ ≤ 2).
   * ບັນຊີນີ້ແມ່ນ**ຜົນຂອງການກວດ** (70% ຂອງ 2,531 ແຖວໃສ່ຕອນຈົບກວດ · 4% ຕອນສ້ອມ)
   * ⇒ ຈົບກວດແລ້ວຕ້ອງລັອກ ບໍ່ດັ່ງນັ້ນ "ຜົນກວດ" ປ່ຽນໄດ້ຕະຫຼອດ ແລະ ລາຄາທີ່ສະເໜີໄປແລ້ວບໍ່ຕົງ.
   * ຢາກໄດ້ອາໄຫຼ່ເພີ່ມພາຍຫຼັງ ⇒ ໃຊ້ "+ ຂໍເບີກຮອບໃໝ່" (ຜ່ານເອກະສານ ຈຶ່ງຕິດຕາມໄດ້).
   */
  const canAddSpare = job.stage <= 2 && !cancelled;
  const spareLines: UsedSpareLine[] =
    spareWindow
      ? (
          await query<UsedSpareLine>(
            `select s.roworder, s.item_code, s.item_name, coalesce(s.qty,0)::int qty, s.unit_code,
               (s.reg_start is not null) as "requested",
               (s.pick_finish is not null or exists (
                  select 1 from ic_trans_detail d
                  where d.product_code = s.product_code and d.item_code = s.item_code
                    and d.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}))) as "locked"
             from tb_used_spare s where s.product_code = $1 order by s.roworder`,
            [code],
          )
        ).rows
      : [];
  // "ຄ້າງເບີກ" = ຍັງບໍ່ຢູ່ໃບຂໍເບີກ/ໃບເບີກໃດ (locked=false) ⇒ ອັນທີ່ createSpareRequest ຈະດຶງ
  const pendingSpares = spareLines.filter((line) => !line.locked).length;
  // ໃບເຄມທີ່ຜູກກັບງານນີ້ (ເປີດຈາກປຸ່ມ "ສ້ອມ" ຂອງ CLM ⇒ ref_job = ເລກງານນີ້)
  const linkedClaims = await relatedClaims(code, "");

  // ── ສະຖານທີ່ (ກົດເປີດ maps) + WhatsApp ຫາລູກຄ້າ ──
  const mapsUrl =
    job.location_lat != null && job.location_lng != null
      ? `https://www.google.com/maps?q=${job.location_lat},${job.location_lng}`
      : job.location_inst?.trim()
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location_inst.trim())}`
        : null;
  // wa.me ຕ້ອງ international ບໍ່ມີ + / 0 ນຳໜ້າ — ລາວ: 0xxxxxxxx → 856xxxxxxxx
  const waDigits = (job.phone ?? "").replace(/\D/g, "");
  const waPhone = waDigits.startsWith("856") ? waDigits : waDigits.startsWith("0") ? `856${waDigits.slice(1)}` : waDigits ? `856${waDigits}` : "";
  const waUrl = waPhone ? `https://wa.me/${waPhone}` : null;

  return (
    <div className="w-full space-y-4">
      {/* ແນະນຳປ່ຽນເຄື່ອງ / ໃບເຄື່ອງບໍລິສັດ — ວາງເທິງສຸດ ເພາະມັນປ່ຽນຄວາມໝາຍຂອງທັງໃບ */}
      <CompanyDeviceBanner
        code={job.code}
        checkOutcome={job.check_outcome}
        companyJob={job.company_job}
        companyFromJob={job.company_from_job}
      />

      {previous && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-orange-400 bg-brand-orange-100 px-4 py-3 text-sm text-brand-900">
          <RotateCcw className="size-4 shrink-0" />
          <span>
            <b>{t.repeatRepair}</b> — {t.repeatReturnedOn} {previous.prev_returned} ({previous.days_between} {t.repeatDaysBefore} {REPEAT_DAYS} {t.repeatDaysUnit})
            {previous.prev_tech && <> · {t.repeatPrevTech} {previous.prev_tech}</>}
          </span>
          <Link
            href={`/service/${previous.prev_code}`}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg bg-brand-orange-700 px-3 text-xs font-semibold text-white hover:bg-brand-orange-700"
          >
            {t.viewOldReceipt} #{previous.prev_code}
            <LinkPending className="size-3" />
          </Link>
        </div>
      )}

      {/* ── HERO — ໂຕນຂຽວເຂັ້ມ ແບບແອັບ ODIEN SERVICE ── */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#003260] via-[#0f477d] to-[#1e5b9a] px-5 py-4 text-white shadow-lg shadow-brand-900/10">
        <BackLink fallback="/service" label={t.backToList} />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300/80">ODIEN SERVICE</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{t.receipt} #{job.code}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  cancelled ? "bg-brand-orange-700/30 text-brand-orange-100" : done ? "bg-brand-400/25 text-brand-100" : "bg-white/15 text-white"
                }`}
              >
                {stageLabel(job.stage, job.service_type)}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${inWarranty ? "bg-brand-400/20 text-brand-100" : "bg-white/10 text-brand-100/80"}`}>
                {job.warranty || "-"}
              </span>
              {!done && !cancelled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-brand-100/90">
                  {t.receivedSince} <Elapsed seconds={job.elapsed_seconds} className="font-semibold text-white" />
                </span>
              )}
              <span className="text-brand-200/60">· {job.registered || "-"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <HeroFact label={t.name} value={job.customer} />
            <HeroFact label={t.productName} value={job.product} />
            <HeroFact label={t.technician} value={job.technician} />
          </div>
        </div>
      </div>

      {/* ── ACTIONS ── */}
      <div className="flex flex-wrap items-center gap-2">
          {/**
            * ⚠️ **ບໍ່ມີປຸ່ມເຄມຢູ່ໜ້ານີ້ອີກ — ທຸກສະຖານະ** (ຖອດ 05-08-2026 ຕາມຄຳສັ່ງ):
            * "ໝາຍ ເຄມ supplier" · "ແຕກເຄມ · ຂໍອາໄຫຼ່ (A)" · "ເຄມເງິນຄືນ supplier (C)".
            * ການໝາຍວ່າ "ບິນນີ້ເກັບເງິນນຳ supplier" ຍ້າຍໄປຢູ່**ໜ້າໃບຮັບເງິນ**ແທນ.
            * ລິ້ງໄປ**ໃບເຄມທີ່ຜູກແລ້ວ** ຍັງຢູ່ຂ້າງລຸ່ມ — ນັ້ນເປັນທາງໄປອ່ານເອກະສານ ບໍ່ແມ່ນປຸ່ມສ້າງ.
            */}
          {/**
            * **ສົ່ງເຄື່ອງຄືນ / ອອກໃບເກັບເງິນ** — ຂັ້ນສຸດທ້າຍຂອງງານ.
            * ເມື່ອກ່ອນໜ້ານີ້ບໍ່ມີທາງເຂົ້າໄປ /returns/<ລະຫັດ> ເລີຍ ⇒ ຄົນທີ່ເປີດໃບງານມາເຫັນ
            * "ລໍຖ້າສົ່ງຄືນ" ຕ້ອງກັບໄປຫາຄິວເອງຈຶ່ງລົງມືໄດ້. ຂຶ້ນສະເພາະຕອນ**ຮອດຂັ້ນນັ້ນຈິງ**
            * (ຜ່ານ QC ແລ້ວ ຍັງບໍ່ໄດ້ສົ່ງຄືນ) — ໜ້າປາຍທາງກວດ qc_finish ຊ້ຳຢູ່ແລ້ວ.
            */}
          {!job.returned && !cancelled && job.stage === 11 && (
            <Link
              href={`/returns/${encodeURIComponent(code)}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"
              title="ອອກໃບຮັບເງິນ ແລະ ປິດການສົ່ງຄືນ"
            >
              <ReceiptText className="size-3.5" /> ສົ່ງເຄື່ອງຄືນ / ອອກໃບເກັບເງິນ
              <LinkPending className="size-3" />
            </Link>
          )}
          {linkedClaims.map((cl) => (
            <Link key={cl.claim_no} href={`/claims/${cl.claim_no}`} className={action} title="ໃບເຄມທີ່ຜູກ">
              <ReceiptText className="size-3.5 text-brand-700" /> ເຄມ {cl.claim_no}
            </Link>
          ))}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className={action} title="ເປີດ Google Maps">
              <MapPin className="size-3.5 text-brand-orange-700" />
              {job.location_inst?.trim() || "ສະຖານທີ່"}
            </a>
          )}
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noreferrer" className={`${action} !text-brand-800 hover:!bg-brand-50`} title={`WhatsApp ${job.phone}`}>
              <MessageCircle className="size-3.5 text-brand-800" />
              WhatsApp
            </a>
          )}
          <Link href={`/service/${code}/contacts`} className={action}>
            <Phone className="size-3.5" />
            {t.contactCustomer}
            {job.contacts > 0 && (
              <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-600">{job.contacts}</span>
            )}
            <LinkPending className="size-3" />
          </Link>
          <Link href={`/service/${code}/images`} className={action}>
            <ImageIcon className="size-3.5" />
            {t.images}
            {job.images > 0 && (
              <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-600">{job.images}</span>
            )}
            <LinkPending className="size-3" />
          </Link>
          <Link href={`/service/${code}/edit`} className={action}>
            <Pencil className="size-3.5" />
            {t.edit}
            <LinkPending className="size-3" />
          </Link>
          {/* ປ້າຍບາໂຄດ 50×30mm — ຕິດໃສ່ເຄື່ອງ ໃຫ້ສະແກນຫາໃບໄດ້ໄວ */}
          <Link href={`/service/${code}/barcode`} target="_blank" className={action}>
            <Barcode className="size-3.5" />
            {t.printBarcode}
          </Link>
          <Link
            href={`/service/${code}/print`}
            target="_blank"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-900 px-3 text-xs font-medium text-white hover:bg-brand-800"
          >
            <Printer className="size-3.5" />
            {t.print}
          </Link>
          {/* ລຶບໄດ້ **ທຸກສະຖານະ** — ຢູ່ໜ້າລາຍລະອຽດ ⇒ ເປີດຈາກ ຄົ້ນຫາ/ລາຍการ ໄດ້ทุกงาน */}
          {canDelete && (
            <span className="ml-1 border-l border-slate-200 pl-2">
              <ServiceDeleteButton code={job.code} afterHref="/service" />
            </span>
          )}
      </div>

      {/* ── ຄວາມຄືບໜ້າ (stepper) ── */}
      <JobProgress stage={job.stage} serviceType={job.service_type} cancelled={cancelled} />

      {/*
        ── ຕອນນີ້ລໍໃຜເຮັດ + ອາໄຫຼ່ຕາມຮອບ = ກ່ອງຫຼັກຂອງໜ້າວຽກ (03-08-2026) ──
        ຄຳຖາມທີຄົນເປີດໜ້ານີ້ຕ້ອງການຕອບກ່ອນໝູ່: "ວຽກນີ້ລໍໃຜ ແລະ ຮອບໃດຄ້າງຢູ່ໃສ".
        ຂຶ້ນກ່ອນ ຈັດການວຽກຄ້າງ/ປ່ຽນຊ່າງ ເພາະນັ້ນແມ່ນເຄື່ອງມື ບໍ່ແມ່ນສະຖານະ.
      */}
      {nextAction && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50/70 px-5 py-4 shadow-sm">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-brand-900">
              ຕອນນີ້ລໍ <span className="text-base font-extrabold">{nextAction.actorLabel}</span> ເຮັດຕໍ່
            </p>
            <p className="mt-0.5 text-xs font-medium text-brand-900">
              {nextAction.label} · ຕ້ອງ: {nextAction.action}
            </p>
          </div>
          <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-200">
            {stageLabel(job.stage, job.service_type)}
          </span>
        </section>
      )}

      {/* ອາໄຫຼ່ຕາມຮອບ — ສະແດງທຸກຂັ້ນທີ່ມີເອກະສານແລ້ວ (ບໍ່ແມ່ນສະເພາະຂັ້ນ 9) */}
      <SpareRounds
        code={job.code}
        roworder={String(job.roworder)}
        withdrawals={spareRounds.withdrawals}
        purchases={spareRounds.purchases}
        erp={spareRounds.erp}
        canRequest={spareWindow && !cancelled}
      />

      {spareWindow && (
        <RepairSpareEditor
          code={job.code}
          roworder={String(job.roworder)}
          lines={spareLines}
          pending={pendingSpares}
          canAdd={canAddSpare}
        />
      )}

      {/* ຈັດການວຽກຄ້າງ / ປ່ຽນຊ່າງ — ຄືຄໍລຳໃນລາຍການ /service ແຕ່ຈັດການໄດ້ໃນໜ້າລາຍລະອຽດເລີຍ */}
      {(canHold || canReassign || canScheduleVisit) && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-xs font-bold text-slate-600">{t.manageJob}</span>
          {canHold && <HoldButtons key={job.hold ? "held" : "free"} code={job.code} hold={job.hold} />}
          {canScheduleVisit && (
            <ScheduleRepairVisitButton
              code={job.code}
              currentDate={job.repair_appoint_date}
              location={job.location_inst}
            />
          )}
          {job.service_type === "IH" && job.repair_appoint_date && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-brand-orange-100 px-2 py-1 text-xs font-semibold text-brand-900">
              <CalendarDays className="size-3.5" />
              {job.repair_appoint_date}
            </span>
          )}
          {canReassign && (
            <AssignTechButton
              label={job.technician ? t.changeTech : t.assignTech}
              size="sm"
              row={{
                code: job.code,
                customer: job.customer,
                location_inst: job.location_inst,
                appoint_date: job.appoint_date,
                remark: job.remark,
                technician: job.technician,
              }}
              techs={techs}
              workflow="repair"
            />
          )}
        </section>
      )}

      {/* ເສັ້ນເວລາລະອຽດ — ຫຍໍ້ໄວ້ (ພາບລວມຢູ່ stepper + ກ່ອງອາໄຫຼ່ດ້ານເທິງແລ້ວ) ⇒ ບໍ່ໃຫ້ໜ້າຍາວ */}
      <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <span className="flex items-center gap-2">
            <Clock className="size-4 text-slate-400" />
            ເສັ້ນເວລາລະອຽດ
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
              {stageLabel(job.stage, job.service_type)}
            </span>
          </span>
          <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-100 p-4">
          <JobTimeline steps={timeline.steps} cancelledAt={timeline.cancelledAt} bare />
        </div>
      </details>

      {/* ເຄື່ອງສຳຮອງທີ່ໃຫ້ລູກຄ້າໃຊ້ກ່ອນ — ຄ້າງຄືນ ⇒ ສົ່ງເຄື່ອງຄືນບໍ່ໄດ້ (lib/loaner) */}
      <TransferJobButton
        code={job.code}
        intake={centers?.intake ?? null}
        current={centers?.current ?? null}
        transferTo={centers?.transferPending ? centers.transferTo ?? null : null}
        canEdit={canLendLoaner}
      />

      <LoanerCard code={job.code} rows={loaners} canEdit={canLendLoaner} />

      {/*
        ແກ້ຂັ້ນໃຫ້ຕົງກັບຄວາມຈິງ — **ຜູ້ຈັດການເທົ່ານັ້ນ**. ມີໃບເກົ່າຄ້າງຢູ່ຂັ້ນຜິດ
        ຫຼາຍໃບ (ເກົ່າສຸດ 346 ມື້) ເພາະລືມກົດຂັ້ນຕໍ່ໄປ ຫຼື ຂໍ້ມູນຍ້າຍມາຈາກລະບົບເກົ່າ
        ⇒ ຄິວ ແລະ ລາຍງານຜິດຕາມ. ດ່ານຈິງ (ສິດ · ໃບຮັບເງິນ · ຄິວຍົກເລີກ) ຢູ່ actions.
      */}
      {roleOf(session) === "manager" && <FixStageCard code={job.code} currentStage={job.stage} />}

      <JobEvidence
        checkins={checkins.rows}
        receive={receivePhotos.rows}
        checkPhotos={checkPhotos}
        finishPhotos={finishPhotos}
        serviceType={job.service_type ? SERVICE_TYPE_LABEL[job.service_type] ?? job.service_type : null}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group, index) => (
          <section
            key={group.title}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${index === 1 ? "lg:row-span-2" : ""}`}
          >
            <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">{group.title}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {group.fields.map(([label, value]) => (
                <div key={label} className="min-w-0 border-b border-slate-100 pb-2 last:border-0">
                  <dt className="text-[10px] text-slate-400">{label}</dt>
                  <dd className="mt-0.5 text-xs font-medium break-words text-slate-800">{value || "-"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <Chatter model="tb_product" resId={job.code} />
    </div>
  );
}

/** ຂໍ້ມູນຫຍໍ້ໃນ hero — ປ້າຍນ້ອຍ + ຄ່າ (truncate ຖ້າຍາວ) */
function HeroFact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0 max-w-[190px]">
      <p className="text-[10px] uppercase tracking-wide text-brand-300/70">{label}</p>
      <p className="truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
