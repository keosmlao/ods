import { Chatter } from "@/components/chatter/chatter";
import { getSession } from "@/lib/auth";
import { CancelInstallSpareRequestButton } from "@/components/installation/cancel-spare-request-button";
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
import { installTimeline } from "@/lib/install-timeline";
import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { permissionFor } from "@/lib/permissions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { INSTALL_ELAPSED_SQL, INSTALL_STAGE_SQL, installStageChip, installStageLabel } from "@/lib/install-stage";
import { canViewAssignedJob } from "@/lib/scope";
import { TECH_SIDE, roleOf } from "@/lib/roles";
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
  const installPermission = await permissionFor(session, "/installations");
  const canDelete = installPermission.delete;

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
    query<Spare>(
      `select item_code, item_name, coalesce(qty,0)::text qty, unit_code,
          to_char(reg_start,'DD-MM-YYYY') reg_start,
          to_char(reg_finish,'DD-MM-YYYY') reg_finish,
          to_char(pick_finish,'DD-MM-YYYY') pick_finish
        from tb_used_spare where product_code = $1 order by roworder`,
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
  const canCancelRequest = TECH_SIDE.includes(roleOf(session));

  /**
   * ດຶງ **ຫຼັງ**ກວດສິດ — ບໍ່ດັ່ງນັ້ນຄົນທີ່ເປີດງານຂອງຄົນອື່ນບໍ່ໄດ້ ຍັງເຮັດໃຫ້ລະບົບ
   * ຂົນສົ່ງຖືກ query ຢູ່. metadata ຢ່າງດຽວ (ບໍ່ມີຮູບ) ⇒ ເບົາ.
   */
  const [delivery, timeline] = await Promise.all([
    deliveryFor(row.doc_ref_1),
    installTimeline(row.code),
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
          {canDelete && <InstallDeleteButton code={row.code} />}
        </div>
      </div>

      {row.cancel_date && (
        <div className="rounded-xl border border-brand-orange-400 bg-brand-orange-50 px-4 py-3">
          <p className="text-sm font-bold text-brand-orange-700">{t.jobCancelled} · {row.cancel_date}</p>
          {row.cancel_remark && <p className="mt-0.5 text-xs text-brand-orange-700">{t.reason} {row.cancel_remark}</p>}
        </div>
      )}

      <JobHeader head={row} />

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
        canRequest={canCancelRequest}
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
          canCancelRequest && !dispatched ? (
            <span className="flex items-center gap-2">
              <LinkButton href={`/installations/spare-requests/edit/${encodeURIComponent(docNo)}`} tone="info" size="sm">
                ແກ້ໄຂ
              </LinkButton>
              <CancelInstallSpareRequestButton docNo={docNo} code={row.code} />
            </span>
          ) : null
        }
      />

      <Chatter model="ods_tb_install" resId={row.code} />
    </div>
  );
}
