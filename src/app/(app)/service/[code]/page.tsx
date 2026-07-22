import { Chatter } from "@/components/chatter/chatter";
import { getSession } from "@/lib/auth";
import { Elapsed } from "@/components/elapsed";
import { HoldButtons } from "@/components/repair/hold-buttons";
import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { holdJsonSql, type JobHold } from "@/lib/job-hold";
import { previousJobOf, REPEAT_DAYS } from "@/lib/repeat";
import { AssignTechButton } from "@/components/installation/assign-tech";
import { ClaimMarkToggle } from "@/components/claim/claim-mark-toggle";
import { isJobClaimMarked } from "@/lib/claim";
import { RepairSpareEditor, type UsedSpareLine } from "@/components/repair/repair-spare-editor";
import { ScheduleRepairVisitButton } from "@/components/repair/schedule-repair-visit-button";
import { listTechnicians } from "@/lib/technicians";
import { TRANS } from "@/lib/stock-constants";
import { APPROVER_SIDE, roleOf, SERVICE_SIDE } from "@/lib/roles";
import { canViewAssignedJob } from "@/lib/scope";
import { SETTING, settingEnabled } from "@/lib/settings";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { stageLabel, STAGE_SQL } from "@/lib/stage";
import { repairTimeline } from "@/lib/repair-timeline";
import { JobTimeline } from "@/components/repair/job-timeline";
import { DONE_STAGE } from "@/lib/track";
import { ArrowLeft, Barcode, CalendarDays, ImageIcon, MapPin, MessageCircle, Pencil, Phone, Printer, RotateCcw } from "lucide-react";
import Link from "next/link";
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
  images: number;
  contacts: number;
  /** ທຸງ "ຕ້ອງກວດ" ທີ່ຍັງເປີດຢູ່ (null = ບໍ່ມີ) — ໃຫ້ HoldButtons ສະແດງສະຖານະ/ປົດ */
  hold: JobHold | null;
};

type Props = { params: Promise<{ code: string }> };

export default async function ServiceDetail({ params }: Props) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const t = (await getDictionary(await getLocale())).serviceDetail;

  const job = (
    await query<Job>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
         greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
         (${STAGE_SQL}) stage, (a.status = 6) cancelled,
         c.code customer_code, c.name_1 customer, c.tel phone, c.address,
         a.name_1 product, a.sn, a.p_model model, a.p_brand brand, a.p_type product_type, a.p_access accessory,
         a.warrunty warranty, a.warranty_reason, a.service_type, a.issue, a.issue_2, a.p_abrasion remark, a.repair_note note,
         a.p_delivery delivery, a.doc_def bill_no, a.doc_date_ref bill_date,
         a.emp_code technician, to_char(a.appoint_date,'YYYY-MM-DD') appoint_date,
         to_char(a.repair_appoint_date,'YYYY-MM-DD') repair_appoint_date,
         a.location_repair location_inst, a.location_lat, a.location_lng, a.roworder, a.user_regis receiver,
         (select count(*) from product_image i
           where i.iteme_code = a.code and coalesce(i.product_url,'') <> '')::int images,
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

  const tone = elapsedTone(job.elapsed_seconds);
  const inWarranty = job.warranty === "ຮັບປະກັນ";
  const cancelled = job.cancelled;
  // ຂັ້ນ 12 = ສົ່ງຄືນສຳເລັດ (ຂັ້ນ 11 ດຽວນີ້ແມ່ນ "ລໍຖ້າສົ່ງຄືນ" ຫຼັງເພີ່ມດ່ານ QC)
  const done = job.stage === DONE_STAGE;

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
   */
  const canReassign = !done && !cancelled && SERVICE_SIDE.includes(roleOf(session));
  // IH ໄປສ້ອມບ້ານລູກຄ້າ: ຫຼັງລູກຄ້າຕົກລົງລາຄາ (ຂັ້ນ 5–9) → ນັດ "ໄປສ້ອມ ຮອບ 2"
  const canScheduleVisit = canReassign && job.service_type === "IH" && job.stage >= 5 && job.stage <= 9;
  const techs = canReassign ? await listTechnicians() : [];

  /**
   * ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — ພົບຕ້ອງໃຊ້ເພີ່ມ/ປ່ຽນ ⇒ ເພີ່ມລາຍການ ແລ້ວ "ຂໍເບີກເພີ່ມ" (ຮອບ 2).
   * requested = ຢູ່ໃບຂໍເບີກແລ້ວ (reg_start) · locked = ເບີກ/ຈ່າຍອອກແລ້ວ (ແກ້/ລຶບບໍ່ໄດ້).
   */
  const spareLines: UsedSpareLine[] =
    job.stage === 9
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
  const claimMarked = await isJobClaimMarked(code);

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
      {previous && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <RotateCcw className="size-4 shrink-0" />
          <span>
            <b>{t.repeatRepair}</b> — {t.repeatReturnedOn} {previous.prev_returned} ({previous.days_between} {t.repeatDaysBefore} {REPEAT_DAYS} {t.repeatDaysUnit})
            {previous.prev_tech && <> · {t.repeatPrevTech} {previous.prev_tech}</>}
          </span>
          <Link
            href={`/service/${previous.prev_code}`}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
          >
            {t.viewOldReceipt} #{previous.prev_code}
            <LinkPending className="size-3" />
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/service" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
            <ArrowLeft className="size-3.5" />
            {t.backToList}
            <LinkPending className="size-3" />
          </Link>
          <h1 className="text-xl font-bold text-slate-700">{t.receipt} #{job.code}</h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                cancelled ? "bg-red-100 text-red-700" : done ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
              }`}
            >
              {stageLabel(job.stage, job.service_type)}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {job.warranty || "-"}
            </span>
            {/* ວຽກທີ່ຈົບ/ຍົກເລີກແລ້ວ ບໍ່ຕ້ອງນັບເວລາຕໍ່ */}
            {!done && !cancelled && (
              <>
                <span className="text-slate-400">{t.receivedSince}</span>
                <Elapsed seconds={job.elapsed_seconds} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`} />
              </>
            )}
            <span className="text-slate-400">· {job.registered || "-"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ClaimMarkToggle jobCode={code} marked={claimMarked} />
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className={action} title="ເປີດ Google Maps">
              <MapPin className="size-3.5 text-rose-600" />
              {job.location_inst?.trim() || "ສະຖານທີ່"}
            </a>
          )}
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noreferrer" className={`${action} !text-green-700 hover:!bg-green-50`} title={`WhatsApp ${job.phone}`}>
              <MessageCircle className="size-3.5 text-green-600" />
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
          {/* ໃບພິມແບບທີ 2 (ods: /sprint2 — reciptpd_anniv.html): ໂຄງ ແລະ ຂໍ້ມູນຄືກັນ ຕ່າງກັນພຽງຫົວຂໍ້ໃບ */}
          <Link href={`/service/${code}/print?layout=anniv`} target="_blank" className={action}>
            <Printer className="size-3.5" />
            {t.printWasherJob}
          </Link>
          <Link
            href={`/service/${code}/print`}
            target="_blank"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Printer className="size-3.5" />
            {t.print}
          </Link>
        </div>
      </div>

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
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
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

      {job.stage === 9 && (
        <RepairSpareEditor
          code={job.code}
          roworder={String(job.roworder)}
          lines={spareLines}
          pending={pendingSpares}
        />
      )}

      <JobTimeline steps={timeline.steps} cancelledAt={timeline.cancelledAt} />

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
