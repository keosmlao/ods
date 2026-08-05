import { Chatter } from "@/components/chatter/chatter";
import { ClaimEditDelete } from "@/components/claim/claim-edit-delete";
import { ClaimManage } from "@/components/claim/claim-manage";
import { getErpBrands } from "@/lib/erp-master";
import { searchSuppliers } from "@/lib/erp-supplier";
import { getSession } from "@/lib/auth";
import { CLAIM_FLOW, CLAIM_REJECTED, CLAIM_SCOPE_LABEL, CLAIM_TYPE_LABEL, claimByNo, claimItems, claimNextStatus, claimPagePath, claimPhotos, cobInfo, FULFILLMENT_LABEL, isClaimEditable, isClaimOpen, jobDelivery, PAY_METHOD_LABEL, RESOLUTION_LABEL, WARRANTY_LABEL } from "@/lib/claim";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { CalendarDays, ChevronLeft, CircleCheck, Package, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ claimNo: string }> };

export default async function ClaimDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const { claimNo } = await params;
  const claim = await claimByNo(claimNo);
  if (!claim) notFound();
  const items = await claimItems(claimNo);
  const photos = await claimPhotos(claimNo);
  // (ຖອດຕົວຊ່ວຍ "ແຕກໃບ A/C" ອອກແລ້ວ 05-08-2026 — ບໍ່ມີປຸ່ມນັ້ນຢູ່ໜ້ານີ້ອີກ)
  const next = claimNextStatus(claim.claim_type, claim.status);
  const cob = claim.claim_type === "C" && claim.erp_doc_no ? await cobInfo(claim.erp_doc_no).catch(() => null) : null;
  const delivery = claim.claim_type === "C" && claim.ref_job ? await jobDelivery(claim.ref_job).catch(() => null) : null;
  // ຕົວເລືອກ ສຳລັບ ແກ້ໄຂ (supplier/brand) — ໂຫຼດເມື່ອໃບຍັງເປີດ (ປິດແລ້ວ ບໍ່ໃຫ້ແກ້)
  const [supList, brandList] = isClaimOpen(claim.status)
    ? await Promise.all([searchSuppliers("", 1000).catch(() => []), getErpBrands().catch(() => [])])
    : [[], []];
  const supplierOptions = supList.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` }));
  const brandOptions = brandList.map((b) => ({ value: b.code, label: b.name_1 }));

  const info = (k: string, v: string | null, prominent = false) =>
    v ? (
      <div className="min-w-0 border-b border-slate-100 py-2.5 last:border-0 sm:grid sm:grid-cols-[8rem_1fr] sm:gap-3">
        <span className="block text-xs font-medium text-slate-400">{k}</span>
        <span className={`${prominent ? "text-base text-brand-900" : "text-sm text-slate-700"} mt-0.5 block break-words font-semibold sm:mt-0`}>{v}</span>
      </div>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-10">
      <Link href={claimPagePath(claim.claim_type)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> ກັບລາຍการเคลม
      </Link>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,71,125,0.07)]">
        <div className="flex flex-col gap-5 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide text-brand-800">CLM-{claim.claim_type}</span>
              <span className="text-sm font-medium text-slate-500">{CLAIM_TYPE_LABEL[claim.claim_type]}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{claim.claim_no}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-brand-600" /> {claim.created_at}</span>
              {(claim.customer_name || claim.customer_code) && <span className="inline-flex items-center gap-1.5"><UserRound className="size-4 text-brand-600" /> {claim.customer_name || claim.customer_code}</span>}
              {claim.supplier_code && <span className="inline-flex items-center gap-1.5"><Store className="size-4 text-brand-600" /> Supplier {claim.supplier_code}</span>}
            </div>
          </div>
          <div className="flex min-w-0 items-start overflow-x-auto pb-1 lg:max-w-[58%]">
            {CLAIM_FLOW[claim.claim_type].map((s, i) => {
              const idx = CLAIM_FLOW[claim.claim_type].findIndex((x) => x.status === claim.status);
              const active = s.status === claim.status;
              const done = idx > i;
              return (
                <div key={s.status} className="flex min-w-[108px] flex-1 items-start last:min-w-[86px]">
                  <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <span className={`grid size-8 place-items-center rounded-full border-2 text-xs font-bold ${active ? "border-brand-700 bg-brand-700 text-white shadow-[0_0_0_4px_rgba(44,111,182,0.12)]" : done ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-400"}`}>
                      {done ? <CircleCheck className="size-4" /> : i + 1}
                    </span>
                    <span className={`mt-2 whitespace-nowrap text-[11px] font-semibold ${active ? "text-brand-800" : done ? "text-slate-600" : "text-slate-400"}`}>{s.label}</span>
                  </div>
                  {i < CLAIM_FLOW[claim.claim_type].length - 1 && <span className={`mt-4 h-0.5 min-w-6 flex-1 ${done ? "bg-brand-500" : "bg-slate-200"}`} />}
                </div>
              );
            })}
          </div>
        </div>
        {claim.status === CLAIM_REJECTED.status && <div className="border-t border-brand-orange-100 bg-brand-orange-50 px-7 py-2.5 text-sm font-semibold text-brand-orange-700">{CLAIM_REJECTED.label}</div>}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(330px,0.82fr)_minmax(560px,1.38fr)]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Package className="size-4.5" /></span>
              <div><h2 className="text-sm font-bold text-slate-800">ຂໍ້ມູນໃບເຄມ</h2><p className="text-[11px] text-slate-400">ລາຍລະອຽດອ້າງອີງ ແລະ ສິນຄ້າ</p></div>
            </div>
            <div className="px-5 py-1">
            {info("Supplier", claim.supplier_code)}
            {info("ຮ້ານ/ລູກຄ້າ", claim.customer_name || claim.customer_code)}
            {info("ຫຍີ່ຫໍ້", claim.brand_code)}
            {info("ຜູ້ຕິດຕໍ່", claim.contact)}
            {info("ເລກບິນຂາຍ", claim.bill_no)}
            {info("ເລກສ້ອມ", claim.ref_job)}
            {/* ຂໍ້ມູນສິນຄ້າ: ຈາກໃບເຄມເອງ (B) ຫຼື ດຶງຈາກงานสอม (C=delivery) */}
            {info("ສິນຄ້າ", claim.product ?? delivery?.product ?? null)}
            {info("Model", claim.model ?? delivery?.model ?? null)}
            {info("SN", claim.sn ?? delivery?.sn ?? null)}
            {claim.warranty && info("ຮັບປະກັນ", WARRANTY_LABEL[claim.warranty] ?? claim.warranty)}
            {claim.resolution && info("ຜົນຕັດສິນ", RESOLUTION_LABEL[claim.resolution] ?? claim.resolution)}
            {claim.claim_scope && info("ຂອບເຂດເຄມ", CLAIM_SCOPE_LABEL[claim.claim_scope] ?? claim.claim_scope)}
            {claim.fulfillment_source && info("ວິທີດຳເນີນການ", FULFILLMENT_LABEL[claim.fulfillment_source] ?? claim.fulfillment_source)}
            {info("ວັນຊື້", claim.purchase_date)}
            {delivery && info("ອາການສ້ອມ", delivery.fault)}
            {/* ຍອດເຄມເປັນ **ບາດ** — ຕົງກັບ COB ທີ່ອອກໃຫ້ ERP (lib/erp-cob: amountThb) */}
            {info("ຄ່າແຮງງານ", claim.amount ? `${claim.amount.toLocaleString()} ບາດ` : null, true)}
            {claim.pay_method && info("ວິທີຊຳລະ", PAY_METHOD_LABEL[claim.pay_method] ?? claim.pay_method)}
            {info("ເປີດໂດຍ", claim.created_by)}
            </div>
          </section>

          {/* ── ຮູບຫຼັກฐาน ── */}
          {photos.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold text-slate-600">ຮູບຫຼັກຖານ ({photos.length})</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p) => (
                  <a key={p.id} href={`/api/uploads/${encodeURIComponent(p.path)}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${encodeURIComponent(p.path)}`} alt="ຫຼັກຖານ" className="aspect-square w-full bg-slate-50 object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/**
            * ⚠️ **ບໍ່ມີກ່ອງ "ໃບເຄມທີ່ກ່ຽວ" ອີກ** (ຖອດ 05-08-2026 ຕາມຄຳສັ່ງ) — ພ້ອມກັບປຸ່ມ
            * ແຕກໃບ "ຂໍອາໄຫຼ່ supplier (CLM-A)" / "ເກັບຄ່າສ້ອມ supplier (CLM-C)".
            * ຢາກເບິ່ງໃບອື່ນຂອງເລື່ອງດຽວກັນ ⇒ ຄົ້ນດ້ວຍ **ເລກງານ** ຢູ່ໜ້າລາຍການເຄມ
            * (ຊ່ອງຄົ້ນຮັບເລກງານຢູ່ແລ້ວ — ເບິ່ງ listClaims). ເລກງານຂອງໃບນີ້ຢູ່ບລັອກ
            * "ຂໍ້ມູນໃບເຄມ" ຂ້າງເທິງ.
            */}

          {/* ແກ້ໄຂ / ລບ (ພັບໄວ້) — ສະເພາະໃບທີ່ຍັງເປີດ */}
          {isClaimEditable(claim.claim_type, claim.status) && (
            <ClaimEditDelete
              claimNo={claim.claim_no}
              supplierCode={claim.supplier_code}
              brandCode={claim.brand_code}
              reason={claim.reason}
              supplierOptions={supplierOptions}
              brandOptions={brandOptions}
            />
          )}

          {/* chatter + activities ຄືເອກະສານอื่น */}
          <Chatter model="ods_claim" resId={claim.claim_no} />
        </aside>

        <ClaimManage
          claimNo={claim.claim_no}
          type={claim.claim_type}
          status={claim.status}
          nextStatus={next}
          canReject={claim.claim_type === "A"}
          initialItems={items}
          remark={claim.remark}
          erpDocNo={claim.erp_doc_no}
          cob={cob}
          emailSentAt={claim.email_sent_at}
          delivery={delivery}
          payMethod={claim.pay_method}
          refJob={claim.ref_job}
          repairPrefill={{ proname: claim.product ?? undefined, sn: claim.sn ?? undefined, billon: claim.bill_no ?? undefined, billdate: claim.purchase_date ?? undefined, cust: claim.customer_code ?? undefined, custname: claim.customer_name ?? undefined }}
          editable={isClaimEditable(claim.claim_type, claim.status)}
        />
      </div>
    </div>
  );
}
