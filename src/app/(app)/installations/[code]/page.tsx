import { Chatter } from "@/components/chatter/chatter";
import { getSession } from "@/lib/auth";
import { CancelInstallSpareRequestButton } from "@/components/installation/cancel-spare-request-button";
import { CancelJobButton } from "@/components/installation/job-buttons";
import { NextVisitButton } from "@/components/installation/next-visit-button";
import { HandoverTechButton } from "@/components/installation/handover-tech-button";
import { technicianOptions } from "@/lib/technicians";
import { jobVisits } from "@/lib/job-flow";
import { minutesLabel, nextRoundHint } from "@/lib/install-visits";
import { RotateCcw } from "lucide-react";
import { Elapsed } from "@/components/elapsed";
import { InstallDeleteButton } from "@/components/installation/install-delete-button";
import { JOB_HEAD_COLUMNS, type JobHead, JobHeader } from "@/components/installation/job-header";
import { ReopenJobButton } from "@/components/installation/undo-buttons";
import { DeliveryCard } from "@/components/installation/delivery-card";
import { JobTimeline } from "@/components/repair/job-timeline";
import { SpareRounds } from "@/components/repair/spare-rounds";
import { syncErpDispatchForJob } from "@/lib/erp-dispatch";
import { repairSpareRounds } from "@/lib/repair-spare-rounds";
import { deliveryFor } from "@/lib/delivery";
import { jobHelpers } from "@/lib/job-techs";
import { installTimeline } from "@/lib/install-timeline";
import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { permissionFor } from "@/lib/permissions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { INSTALL_ELAPSED_SQL, INSTALL_STAGE_SQL, installStageChip, installStageLabel } from "@/lib/install-stage";
import { canViewAssignedJob } from "@/lib/scope";
import { notFound, redirect } from "next/navigation";

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
  /** ISN ໜ່ວຍນອກ (ແອ) — ຂຶ້ນສະເພາະງານທີ່ມີຄ່າ */
  pro_sn_out: string | null;
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

/** ຊື່ເອກະສານຂອງສາຍງານຕິດຕັ້ງ — ຄືກັບ lib/stock-constants */
export default async function InstallationDetail({ params }: Props) {
  const code = decodeURIComponent((await params).code);
  const session = await getSession();
  if (!session) redirect("/login");
  const t = (await getDictionary(await getLocale())).installDetail;
  const [installPermission, sparePermission] = await Promise.all([
    permissionFor(session, "/installations"),
    permissionFor(session, "/installations/spare-requests"),
  ]);
  const canDelete = installPermission.delete;
  /**
   * ປຸ່ມຂອງບລັອກ "ອາໄຫຼ່ຂອງໃບງານ" ຕ້ອງອີງ **ສິດເມນູ** ຄືກັນກັບ action ຝັ່ງ server
   * (actions/installation → INSTALL_MENU.spareRequest) ບໍ່ແມ່ນ role ລ້ວນ.
   * ກ່ອນແກ້: `TECH_SIDE.includes(roleOf(session))` ⇒ CS ທີ່ຜູ້ຈັດການເປີດສິດ
   * ສ້າງ/ແກ້/ລຶບ ໃຫ້ແລ້ວ **ບໍ່ເຫັນປຸ່ມຈັກອັນ** (ປຸ່ມບໍ່ຖືກ render ເລີຍ ບໍ່ແມ່ນກົດແລ້ວຖືກປະຕິເສດ)
   * ⇒ ຄົນຕັ້ງສິດເຂົ້າໃຈວ່າສິດບໍ່ຕິດ. ບໍ່ມີ override = ຕົກມາໃຊ້ role ຄືເກົ່າ.
   */
  const canNewRequest = sparePermission.read && sparePermission.create;
  const canEditRequest = sparePermission.read && sparePermission.update;
  const canDeleteRequest = sparePermission.read && sparePermission.delete;

  // ໃບເບີກຂອງ ERP ເຂົ້າກ່ອນ — ຝັ່ງຕິດຕັ້ງກໍ່ຄືກັນ (ເບິ່ງ syncErpDispatchForJob)
  await syncErpDispatchForJob(code);

  const [job, spares, outstanding, rounds] = await Promise.all([
    query<Row>(
      `select ${JOB_HEAD_COLUMNS},
          (${INSTALL_STAGE_SQL})::int as stage,
          (${INSTALL_ELAPSED_SQL}) as elapsed_seconds,
          a.remark, a.location_inst, a.pro_sn, a.pro_sn_out, a.user_created, a.cancel_remark,
          to_char(a.cancel_date,'DD-MM-YYYY HH24:MI') as cancel_date
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
        where a.code = $1 limit 1`,
      [code],
    ),
    /**
     * ── ອາໄຫຼ່ຂອງງານ — **ລວມແຖວຊ້ຳ** (06-08-2026 ຕາມຄຳສັ່ງ) ──
     * `tb_used_spare` ເກັບເປັນລາຍແຖວ ⇒ ອາໄຫຼ່ຕົວດຽວກັນຖືກໃສ່ຫຼາຍເທື່ອ (ຊຸດຕິດຕັ້ງ +
     * ຊ່າງເພີ່ມເອງ) ແລ້ວຕາຕະລາງໂຊ້ວຊ້ຳກັນ (ພົບຈິງ: ມ໋ອດ VK 4 ອັນ ແລະ 1 ອັນ ຄົນລະແຖວ)
     * ⇒ ຄົນອ່ານຕ້ອງບວກເອງ ແລະ ນັບຈຳນວນລາຍການຜິດ.
     *
     * ⚠️ **ລວມສະເພາະແຖວທີ່ຢູ່ຂັ້ນດຽວກັນ** (ຂໍເບີກ · ສາງເບີກ · ຊ່າງຮັບ ວັນທີດຽວກັນ) —
     * ບໍ່ດັ່ງນັ້ນຈະໄປລວມແຖວທີ່ "ຂໍແລ້ວ" ກັບ "ຍັງບໍ່ຂໍ" ເປັນອັນດຽວ ແລ້ວສະຖານະຫາຍ.
     */
    query<Spare>(
      `select item_code, max(item_name) item_name, coalesce(sum(qty),0)::text qty, max(unit_code) unit_code,
          to_char(reg_start,'DD-MM-YYYY') reg_start,
          to_char(reg_finish,'DD-MM-YYYY') reg_finish,
          to_char(pick_finish,'DD-MM-YYYY') pick_finish
        from tb_used_spare where product_code = $1
       group by item_code, reg_start, reg_finish, pick_finish
       order by min(roworder)`,
      [code],
    ),
    /**
     * ── ອາໄຫຼ່ທີ່ **ຍັງຄ້າງຂໍເບີກ** (28-07-2026) ──
     * ກົດເກນ 1 ສາງ/1 ໃບ ⇒ ງານນຶ່ງອາດຕ້ອງອອກຫຼາຍໃບ. ພໍໃບທຳອິດອອກ reg_start ຖືກຕັ້ງ
     * ⇒ ງານຫຼຸດຈາກຄິວ /installations/spare-requests ແລ້ວ **ບໍ່ມີລິ້ງໃດພາເຂົ້າໜ້າຂໍເບີກອີກ**.
     * ນັບແບບດຽວກັນກັບ OUTSTANDING_INSTALL_SPARES (ບັນຊີເອກະສານ 122 ລົບ 59).
     */
    query<{ items: number }>(
      `select count(*)::int items from (
         select n.item_code
           from (select item_code, sum(qty) qty from tb_used_spare
                  where product_code = $1 group by item_code) n
           left join (select item_code, sum(case when trans_flag = 122 then qty else -qty end) qty
                        from ic_trans_detail
                       where product_code = $1 and trans_flag in (122,59) group by item_code) c
             on c.item_code = n.item_code
          where n.qty - coalesce(c.qty,0) > 0
       ) t`,
      [code],
    ),
    // ຮອບອາໄຫຼ່ — ຕ່ອງໂສ້ SION → SWC → PISP ດຽວກັນກັບຝັ່ງສ້ອມ (ຕິດຕັ້ງເຖິງ 10 ຮອບ/ວຽກ)
    repairSpareRounds(code),
  ]);

  const row = job.rows[0];
  if (!row) notFound();
  if (!canViewAssignedJob(session, row.tech_code)) redirect("/forbidden");

  /**
   * ດຶງ **ຫຼັງ**ກວດສິດ — ບໍ່ດັ່ງນັ້ນຄົນທີ່ເປີດງານຂອງຄົນອື່ນບໍ່ໄດ້ ຍັງເຮັດໃຫ້ລະບົບ
   * ຂົນສົ່ງຖືກ query ຢູ່. metadata ຢ່າງດຽວ (ບໍ່ມີຮູບ) ⇒ ເບົາ.
   */
  const [delivery, visits, techs, timeline, helpers] = await Promise.all([
    deliveryFor(row.doc_ref_1),
    // 1 ໃບງານ = ຫຼາຍຮອບເຂົ້າໜ້າງານ (ເບິ່ງ lib/job-flow.scheduleNextVisit)
    jobVisits("install", row.code),
    // ລາຍຊື່ຊ່າງ — ໃຫ້ປຸ່ມ "ປ່ຽນຊ່າງ" ຕອນງານກຳລັງດຳເນີນ (ຮອບຕໍ່ໄປອາດເປັນຄົນອື່ນ)
    row.stage === 4 || row.stage === 5 ? technicianOptions() : Promise.resolve([]),
    installTimeline(row.code),
    // ຊ່າງຮ່ວມ (10-08-2026) — ຫົວໜ້າຢູ່ `tech_code` ຄືເກົ່າ (ເບິ່ງ lib/job-techs)
    jobHelpers("install", row.code),
  ]);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={`${t.installJob} ${row.code}`}>{t.pageTitle}</PageTitle>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${installStageChip(row.stage)}`}>
          {installStageLabel(row.stage)}
        </span>
        <Elapsed
          seconds={row.elapsed_seconds}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600"
        />
        <div className="ml-auto flex gap-2">
          {/*
            ── ຍ້າຍມາຈາກແທັບ "ປິດງານແລ້ວ" ທີ່ຖືກຖອດອອກ (13-07-2026) ──
            ປຸ່ມນີ້ເຄີຍຢູ່ໃນແທັບນັ້ນບ່ອນດຽວ ⇒ ຖອດແທັບແລ້ວ ຄວາມສາມາດ "ເປີດງານຄືນ"
            ຈະຫາຍໄປນຳ. ຂັ້ນ 9 = ປິດງານແລ້ວ.
          */}
          {row.stage === 9 && <ReopenJobButton code={row.code} />}
          {/*
            ຍັງມີອາໄຫຼ່ຄ້າງ ແລະ ງານຍັງບໍ່ເລີ່ມຕິດຕັ້ງ ⇒ ໃຫ້ທາງເຂົ້າໄປອອກ**ໃບຕໍ່ໄປ**
            (ເບີກຈາກສາງອື່ນ) — ຄິວ /installations/spare-requests ສະແດງແຕ່ໃບທຳອິດ.
          */}
          {(outstanding.rows[0]?.items ?? 0) > 0 && row.stage >= 2 && row.stage <= 3 && (
            <LinkButton
              tone="success"
              href={`/installations/spare-requests/${encodeURIComponent(row.code)}`}
            >
              {t.requestMoreSpares}
            </LinkButton>
          )}
          {/*
            ທາງເຂົ້າໜ້າແກ້ໄຂ — ຄິວ /installations ມີແຕ່ **ງານດຳເນີນຢູ່** (INSTALL_OPEN)
            ⇒ ງານປິດແລ້ວມາຮອດໄດ້ທາງໜ້ານີ້ບ່ອນດຽວ. ປິດແລ້ວແກ້ໄດ້ສະເພາະ ISN
            (ເບິ່ງ updateInstall) ⇒ ປຸ່ມບອກໄວ້ໃຫ້ຮູ້ກ່ອນກົດເຂົ້າ.
          */}
          {installPermission.update && !row.cancel_date && (
            <LinkButton tone="neutral" href={`/installations/${encodeURIComponent(row.code)}/edit`}>
              {row.stage === 9 ? t.editIsn : t.edit}
            </LinkButton>
          )}
          <LinkButton tone="neutral" href={`/installations/${encodeURIComponent(row.code)}/print`}>
            {t.print}
          </LinkButton>
          {/*
            ── ຍົກເລີກງານ (ພ້ອມໝາຍເຫດ) — ເພີ່ມຢູ່ໜ້ານີ້ 06-08-2026 ──
            ເມື່ອກ່ອນປຸ່ມນີ້ມີແຕ່ຢູ່**ຄິວ** /installations ⇒ ຄົນທີ່ເປີດໃບງານມາເບິ່ງ
            (ຈາກລິ້ງແຈ້ງເຕືອນ · ຈາກ chatter · ຈາກຄົ້ນຫາ) ຍົກເລີກບໍ່ໄດ້ ຕ້ອງກັບໄປຄິວກ່ອນ.
            ດ່ານ ແລະ ໝາຍເຫດບັງຄັບ ຢູ່ `cancelInstall` ຄືເກົ່າ (ຍັງບອກອາໄຫຼ່ຄ້າງນອກສາງນຳ).
            ງານທີ່ຍົກເລີກ/ປິດແລ້ວ ບໍ່ໂຊ້ວ — ຍົກເລີກຊ້ຳບໍ່ໄດ້ຢູ່ແລ້ວ.
          */}
          {/* ຕິດຕັ້ງບໍ່ຈົບໃນມື້ດຽວ — ນັດກັບໄປໂດຍບໍ່ຕ້ອງກົດ "ຈົບງານ" ຫຼອກ (06-08-2026) */}
          {installPermission.update && !row.cancel_date && (row.stage === 4 || row.stage === 5) && (
            <NextVisitButton code={row.code} />
          )}
          {/* ຮອບຕໍ່ໄປອາດເປັນຊ່າງຄົນອື່ນ — ສົ່ງມອບກາງທາງໂດຍບໍ່ຖອຍຂັ້ນ */}
          {installPermission.update && !row.cancel_date && (row.stage === 4 || row.stage === 5) && (
            <HandoverTechButton
              code={row.code}
              current={row.tech_code}
              helpers={helpers}
              techs={techs.map((tech) => ({ code: tech.code, name: tech.name_1 || tech.code }))}
            />
          )}
          {installPermission.update && !row.cancel_date && row.stage !== 9 && (
            <CancelJobButton code={row.code} label={t.cancelJob} />
          )}
          {canDelete && <InstallDeleteButton code={row.code} />}
        </div>
      </div>

      {row.cancel_date && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-orange-400 bg-brand-orange-50 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-brand-orange-700">{t.jobCancelled} · {row.cancel_date}</p>
            {row.cancel_remark && <p className="mt-0.5 text-xs text-brand-orange-700">{t.reason} {row.cancel_remark}</p>}
          </div>
          {/*
            ── ທາງເຂົ້າ "ອອກໃບງານໃໝ່ຈາກບິນນີ້" (06-08-2026) ──
            ບິນທີ່ເຄີຍອອກໃບງານ **ບໍ່ເດັ້ງກັບເຂົ້າຄິວ "ບິນຄ້າງອອກໃບງານ" ອີກ** ເຖິງໃບງານຈະຖືກ
            ຍົກເລີກ (ເບິ່ງ lib/pending-bills) ⇒ ຢາກເປີດໃໝ່ ຕ້ອງໄປພິມເລກບິນເອງຢູ່ຟອມ.
            ປຸ່ມນີ້ພາໄປພ້ອມເລກບິນເລີຍ — ບ່ອນນີ້ຄືບ່ອນທີ່ຄົນຮູ້ວ່າ "ຕ້ອງເປີດໃໝ່".
            ບໍ່ມີດ່ານກັນບິນຊ້ຳຢູ່ createInstall ⇒ ຟອມຈະຂຶ້ນປ້າຍເຕືອນວ່າບິນນີ້ເຄີຍມີໃບງານ.
          */}
          {installPermission.update && row.doc_ref_1 && (
            <LinkButton
              tone="neutral"
              href={`/installations/new?bill=${encodeURIComponent(row.doc_ref_1)}`}
            >
              {t.reopenFromBill}
            </LinkButton>
          )}
        </div>
      )}

      {/*
        ── ທີມຊ່າງ (10-08-2026) ──
        ຫົວໜ້າຢູ່ໃນ JobHeader ຄືເກົ່າ; ແຖບນີ້ໂຜ່ສະເພາະງານທີ່ໄປກັນຫຼາຍຄົນ ⇒ CS ຮູ້ວ່າ
        ໃຜໄປນຳ ໂດຍບໍ່ຕ້ອງໄປອ່ານ chatter. ຄ່າຄອມແບ່ງຕາມຮອບ check-in ຈິງ (ບໍ່ແມ່ນລາຍຊື່).
      */}
      {helpers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm">
          <span className="font-semibold text-slate-600">ທີມຊ່າງ:</span>{" "}
          <b className="text-brand-800">{row.tech_code ?? "-"}</b>
          <span className="text-slate-400"> (ຫົວໜ້າ — ຮັບ/ຈົບງານ)</span>
          <span className="text-slate-600"> · ຊ່າງຮ່ວມ {helpers.join(" · ")}</span>
        </div>
      )}

      {/*
        ── ແຖບ "ຮອບນີ້ຄືຮອບທີ N" (12-08-2026) ──
        ວາງ **ເໜືອຫົວໃບງານ** ໂດຍເຈດຕະນາ: ຄົນທີ່ເປີດໃບງານທີ່ໄປມາແລ້ວ ຕ້ອງຮູ້ກ່ອນອື່ນ
        ວ່າຮອບກ່ອນຄ້າງຍ້ອນຫຍັງ — ບໍ່ດັ່ງນັ້ນຈະໄປຊ້ຳຮອຍເກົ່າ (ໄປຮອດແລ້ວຍັງບໍ່ມີໄຟຄືເກົ່າ).
        ແອັບສະແດງແຖບດຽວກັນນີ້ (screens/job_screen) — ຫົວໜ້າກັບຊ່າງເຫັນປະໂຫຍກດຽວກັນ.
      */}
      {(() => {
        const hint = nextRoundHint(timeline.visits);
        if (!hint || row.stage > 5) return null;
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand-orange-200 bg-brand-orange-50 px-4 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-brand-orange-800">
              <RotateCcw className="size-4" />
              {hint.open ? `ກຳລັງຢູ່ໜ້າງານ ຮອບທີ ${hint.round}` : `ຮອບຕໍ່ໄປຄືຮອບທີ ${hint.round}`}
            </span>
            {hint.lastAt && <span className="text-slate-600">ຮອບກ່ອນ {hint.lastAt}</span>}
            {hint.reason && (
              <span className="text-slate-700">
                ຍັງບໍ່ຈົບຍ້ອນ: <b className="text-brand-orange-800">{hint.reason}</b>
              </span>
            )}
          </div>
        );
      })()}

      <JobHeader head={row} />

      {visits.length > 0 && (
        <Card title={`ຮອບເຂົ້າໜ້າງານ (${visits.length})`}>
          {/*
            ── ສະຫຼຸບ "ໃບດຽວ ຫຼາຍຮອບ" ──
            ຕາຕະລາງລຸ່ມນີ້ບອກລາຍຮອບ ແຕ່ຄຳຖາມທຳອິດຂອງຫົວໜ້າແມ່ນ 3 ຂໍ້: ໄປມາຈັກຮອບ ·
            ຢູ່ໜ້າງານລວມດົນປານໃດ · **ຮອບຕໍ່ໄປວັນໃດ**. ບໍ່ຄວນໃຫ້ນັ່ງບວກເອົາເອງ.
          */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>
              ໄປມາແລ້ວ <b className="text-brand-800">{visits.length}</b> ຮອບ
            </span>
            <span>
              ຢູ່ໜ້າງານລວມ{" "}
              <b className="text-brand-800">
                {minutesLabel(visits.reduce((sum, visit) => sum + (visit.minutes ?? 0), 0))}
              </b>
            </span>
            {row.appoint_date && (
              <span>
                ນັດຮອບຕໍ່ໄປ <b className="text-brand-800">{row.appoint_date}</b>
              </span>
            )}
            {visits.some((visit) => !visit.checkout_at) && (
              <span className="font-semibold text-brand-orange-700">ມີຮອບທີ່ຍັງບໍ່ໄດ້ check-out</span>
            )}
          </div>
          {/* ຜ່ານມືຫຼາຍຄົນ ⇒ ບອກໄວ້ ເພາະຄ່າຄອມຄິດຕໍ່ໃບງານ (ຕົກໃສ່ຄົນທີ່ຖືງານຕອນປິດ) */}
          {new Set(visits.map((visit) => visit.tech_code).filter(Boolean)).size > 1 && (
            <p className="mb-2 rounded-lg bg-brand-orange-50 px-3 py-2 text-[11px] font-medium text-brand-orange-700">
              ງານນີ້ຜ່ານມືຊ່າງຫຼາຍກວ່າ 1 ຄົນ — ຄ່າຄອມຄິດ <b>ຕໍ່ໃບງານ</b> ຕົກໃສ່ຄົນທີ່ຖືງານຕອນປິດ
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">ຮອບ</th>
                  <th className="px-3 py-2 font-semibold">ຊ່າງ</th>
                  <th className="px-3 py-2 font-semibold">ເຂົ້າໜ້າງານ</th>
                  <th className="px-3 py-2 font-semibold">ອອກ</th>
                  <th className="px-3 py-2 font-semibold">ໃຊ້ເວລາ</th>
                  <th className="px-3 py-2 font-semibold">ໝາຍເຫດ</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit, index) => (
                  <tr key={visit.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold text-brand-700 tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2 text-slate-600">{visit.tech_code ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{visit.checkin_at ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {visit.checkout_at ?? <span className="text-brand-orange-700">ຍັງຢູ່ໜ້າງານ</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                      {visit.minutes == null ? "-" : `${Math.floor(visit.minutes / 60)} ຊມ ${visit.minutes % 60} ນທ`}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {visit.note ?? "-"}
                      {/* ເຫດຜົນທີ່ຮອບນັ້ນຍັງບໍ່ຈົບ — ຄຳຕອບຂອງ "ເປັນຫຍັງຕ້ອງໄປອີກຮອບ" */}
                      {visit.next_reason && (
                        <span className="mt-0.5 block text-[11px] font-medium text-brand-orange-700">
                          ຍັງບໍ່ຈົບຍ້ອນ: {visit.next_reason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Timeline ງານຕິດຕັ້ງ">
        <JobTimeline
          steps={timeline.steps}
          cancelledAt={timeline.cancelledAt}
          bare
          horizontal
        />
      </Card>

      {/**
        * ການສົ່ງເຄື່ອງ — ບ່ອນທີ່ຂົນສົ່ງເອົາເຄື່ອງໄປວາງ ຄືບ່ອນທີ່ຊ່າງຕ້ອງໄປຕິດຕັ້ງ
        * ⇒ ວາງໄວ້ເທິງສຸດຮອງຈາກຫົວງານ. ບໍ່ມີຂໍ້ມູນ (ລູກຄ້າຫອບເອງ) = ບໍ່ສະແດງ.
        */}
      {delivery && <DeliveryCard info={delivery} labels={t.delivery} />}

      <Card title={t.moreInfo}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [t.installLocation, row.location_inst],
              [row.pro_sn_out ? "Serial number (ໜ່ວຍໃນ)" : "Serial number", row.pro_sn],
              ...(row.pro_sn_out ? [["Serial number (ໜ່ວຍນອກ)", row.pro_sn_out] as [string, string | null]] : []),
              [t.openedBy, row.user_created],
              [t.remark, row.remark],
            ] as [string, string | null][]
          ).map(([label, value]) => (
            <div key={label} className="border-b border-slate-100 pb-2">
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={`${t.jobSpares} (${spares.rows.length})`}>
        {spares.rows.length === 0 ? (
          <Empty>{t.noSparesUsed}</Empty>
        ) : (
          <Table head={[t.code, t.spareName, t.qty, t.requested, t.dispatched, t.received]} minWidth={700}>
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

      {/* ── ອາໄຫຼ່: tree ຕາມຕ່ອງໂສ້ເອກະສານ ຄືກັບຝັ່ງສ້ອມ ──
          ແທນຕາຕະລາງເອກະສານແປທີ່ບອກບໍ່ໄດ້ວ່າໃບໃດຄູ່ກັບໃບໃດ ຫຼື ຮອບໃດຄ້າງຢູ່ໃສ */}
      <SpareRounds
        code={row.code}
        roworder={row.code}
        withdrawals={rounds.withdrawals}
        purchases={rounds.purchases}
        erp={rounds.erp}
        canRequest={canNewRequest}
        techReceipt={false}
        links={{
          newRequest: `/installations/spare-requests/${encodeURIComponent(row.code)}`,
          newPurchase: null, // ຕິດຕັ້ງບໍ່ມີໃບຂໍຊື້ (ວັດແລ້ວ 0 ໃບ)
          viewRequest: (docNo) => `/installations/spare-requests/view/${encodeURIComponent(docNo)}`,
          pickup: (docNo) => `/installations/spare-pickup/${encodeURIComponent(docNo)}`,
          // ຝັ່ງຕິດຕັ້ງມີເມນູ "ສົ່ງຄືນອາໄຫຼ່ງານຕິດຕັ້ງ" ຢູ່ແລ້ວ — ພາໄປບ່ອນດຽວກັນ ພ້ອມກອງໃສ່ໃບງານນີ້
          returnSpare: `/stock/receive-returns?q=${encodeURIComponent(row.code)}`,
          /**
           * ຝັ່ງຕິດຕັ້ງໃຊ້ **ຄົນລະ action ແລະ ຄົນລະໜ້າ** (startInstallReturnRequest) —
           * ReturnRequestButton ແຍກໃຫ້ເອງຕາມຄ່ານີ້. ⚠️ ຫຼັງລົບໜ້າລາຍການ /stock/returns
           * ປຸ່ມນີ້ຄື **ທາງເຂົ້າດຽວ**ຂອງການຂໍຄືນອາໄຫຼ່ຝັ່ງຕິດຕັ້ງ — ຢ່າຖອດອອກ.
           */
          returnJobType: "install",
        }}
        docAction={(docNo, dispatched) =>
          (canEditRequest || canDeleteRequest) && !dispatched ? (
            <span className="flex items-center gap-2">
              {canEditRequest && (
                <LinkButton href={`/installations/spare-requests/edit/${encodeURIComponent(docNo)}`} tone="info" size="sm">
                  ແກ້ໄຂ
                </LinkButton>
              )}
              {canDeleteRequest && <CancelInstallSpareRequestButton docNo={docNo} code={row.code} />}
            </span>
          ) : null
        }
      />

      <Chatter model="ods_tb_install" resId={row.code} />
    </div>
  );
}
