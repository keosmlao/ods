import { Chatter } from "@/components/chatter/chatter";
import { ClaimEditDelete } from "@/components/claim/claim-edit-delete";
import { ClaimManage } from "@/components/claim/claim-manage";
import { getErpBrands } from "@/lib/erp-master";
import { searchSuppliers } from "@/lib/erp-supplier";
import { getSession } from "@/lib/auth";
import { CLAIM_FLOW, CLAIM_REJECTED, CLAIM_TYPE_LABEL, claimByNo, claimItems, claimNextStatus, claimPagePath, claimPhotos, cobInfo, isClaimOpen, jobDelivery, PAY_METHOD_LABEL, relatedClaims, RESOLUTION_LABEL, WARRANTY_LABEL } from "@/lib/claim";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { ChevronLeft, Plus } from "lucide-react";
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
  const related = await relatedClaims(claim.ref_job, claim.claim_no);
  // ປະເພດທີ່ມີແລ້ວ (ໃບນີ້ + ໃບກ່ຽວ) — ບໍ່ໃຫ້ແຕກໃບຊ້ຳ
  const haveTypes = new Set([claim.claim_type, ...related.map((r) => r.claim_type)]);
  // ຄາຣີ context ສິນຄ້າ/SN ໄປໃບ A/C ນຳ (ຈາກໃບເຄມເອງ ຫຼື ດຶງຈາກงานสอม) — A ຕ້ອງຮູ້ສິນຄ້າ/SN ຂໍ supplier
  const spawnProduct = claim.product ?? "";
  const spawnModel = claim.model ?? "";
  const spawnSn = claim.sn ?? "";
  const spawnQs = (t: string) =>
    `/claims/new?${new URLSearchParams({ type: t, ref_job: claim.ref_job ?? "", ...(claim.brand_code ? { brand: claim.brand_code } : {}), ...(claim.supplier_code ? { supplier: claim.supplier_code } : {}), ...(spawnProduct ? { product: spawnProduct } : {}), ...(spawnModel ? { model: spawnModel } : {}), ...(spawnSn ? { sn: spawnSn } : {}) })}`;
  const next = claimNextStatus(claim.claim_type, claim.status);
  const cob = claim.claim_type === "C" && claim.erp_doc_no ? await cobInfo(claim.erp_doc_no).catch(() => null) : null;
  const delivery = claim.claim_type === "C" && claim.ref_job ? await jobDelivery(claim.ref_job).catch(() => null) : null;
  // ຕົວເລືອກ ສຳລັບ ແກ້ໄຂ (supplier/brand) — ໂຫຼດເມື່ອໃບຍັງເປີດ (ປິດແລ້ວ ບໍ່ໃຫ້ແກ້)
  const [supList, brandList] = isClaimOpen(claim.status)
    ? await Promise.all([searchSuppliers("", 1000).catch(() => []), getErpBrands().catch(() => [])])
    : [[], []];
  const supplierOptions = supList.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` }));
  const brandOptions = brandList.map((b) => ({ value: b.code, label: b.name_1 }));

  const info = (k: string, v: string | null) =>
    v ? (
      <div className="flex gap-2 text-sm">
        <span className="w-24 shrink-0 text-slate-500">{k}</span>
        <span className="font-semibold text-slate-800">{v}</span>
      </div>
    ) : null;

  return (
    <div className="w-full space-y-4">
      <Link href={claimPagePath(claim.claim_type)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> ກັບລາຍการเคลม
      </Link>

      {/* ── Odoo-style sheet header: ຊື່ເອກະສານ + statusbar chevron ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#0536a9]">{claim.claim_no}</h1>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">CLM-{claim.claim_type}</span>
            <span className="text-xs text-slate-500">{CLAIM_TYPE_LABEL[claim.claim_type]}</span>
          </div>
          {/* statusbar — chevron ຕໍ່ກັນ ຄື Odoo (ຂັ້ນຜ່ານ=ຂຽວ · ຂັ້ນປັດຈຸບັນ=ເຂັ້ມ · ຂ້າງໜ້າ=ຈາງ) */}
          <div className="flex flex-wrap items-center gap-0.5">
            {CLAIM_FLOW[claim.claim_type].map((s, i) => {
              const idx = CLAIM_FLOW[claim.claim_type].findIndex((x) => x.status === claim.status);
              const active = s.status === claim.status;
              const done = idx > i;
              return (
                <span
                  key={s.status}
                  className={`relative px-3 py-1 text-[11px] font-semibold ${i === 0 ? "rounded-l-lg" : ""} ${i === CLAIM_FLOW[claim.claim_type].length - 1 ? "rounded-r-lg" : ""} ${active ? "bg-teal-600 text-white" : done ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-400"}`}
                >
                  {s.label}
                </span>
              );
            })}
            {claim.status === CLAIM_REJECTED.status && <span className="ml-1 rounded-lg bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-600">{CLAIM_REJECTED.label}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {info("ເລກທີ", claim.claim_no)}
            {info("ວັນທີ", claim.created_at)}
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
            {info("ວັນຊື້", claim.purchase_date)}
            {delivery && info("ອາການສ້ອມ", delivery.fault)}
            {info("ຄ່າແຮງງານ", claim.amount ? claim.amount.toLocaleString() : null)}
            {claim.pay_method && info("ວິທີຊຳລະ", PAY_METHOD_LABEL[claim.pay_method] ?? claim.pay_method)}
            {info("ເປີດໂດຍ", claim.created_by)}
          </div>

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

          {/* ── ໃບເຄມທີ່ກ່ຽວ (B/A/C ຂອງເລື່ອງດຽວກັນ · ຜູກຜ່ານເລກສ້ອມ) + ແຕກໃບ ── */}
          {claim.ref_job && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold text-slate-600">ໃບເຄມທີ່ກ່ຽວ · ເລກສ້ອມ {claim.ref_job}</p>
              {related.length === 0 ? (
                <p className="text-xs text-slate-400">ຍັງບໍ່ມີໃບອື່ນຂອງເລື່ອງນີ້</p>
              ) : (
                <div className="space-y-1.5">
                  {related.map((r) => (
                    <Link key={r.claim_no} href={`/claims/${r.claim_no}`} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-[12px] hover:bg-slate-50">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">CLM-{r.claim_type}</span>
                      <b className="text-[#0536a9]">{r.claim_no}</b>
                      <span className="truncate text-slate-500">{CLAIM_TYPE_LABEL[r.claim_type]}</span>
                      <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isClaimOpen(r.status) ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>{r.status_label}</span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {!haveTypes.has("A") && (
                  <Link href={spawnQs("A")} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">
                    <Plus className="size-3.5" /> ຂໍອາໄຫຼ່ supplier (CLM-A)
                  </Link>
                )}
                {!haveTypes.has("C") && (
                  <Link href={spawnQs("C")} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100">
                    <Plus className="size-3.5" /> ເກັບຄ່າສ້ອມ supplier (CLM-C)
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ແກ້ໄຂ / ລບ (ພັບໄວ້) — ສະເພາະໃບທີ່ຍັງເປີດ */}
          {isClaimOpen(claim.status) && (
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
        </div>

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
        />
      </div>
    </div>
  );
}
