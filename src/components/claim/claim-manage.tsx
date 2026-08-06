"use client";
import { advanceClaim, deleteClaimItem, resolveClaim, sendClaimEmail, setClaimPaid, updateClaimRemark } from "@/app/actions/claim";
import { claimCanTransition, type ClaimItem, type ClaimType, type CobInfo, type JobDelivery } from "@/lib/claim-shared";
import { useDict } from "@/lib/i18n/context";
import { ArrowRight, BadgeCheck, CircleCheck, FileText, ListChecks, LoaderCircle, Mail, Package, Trash2, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ClaimManage({
  claimNo,
  type,
  status,
  nextStatus,
  canReject,
  initialItems,
  remark,
  erpDocNo,
  cob,
  emailSentAt,
  delivery,
  payMethod,
  refJob,
  repairPrefill,
  editable,
}: {
  claimNo: string;
  type: ClaimType;
  status: string;
  nextStatus: { status: string; label: string } | null;
  canReject: boolean;
  initialItems: ClaimItem[];
  remark: string | null;
  erpDocNo: string | null;
  cob: CobInfo | null;
  emailSentAt: string | null;
  delivery: JobDelivery | null;
  payMethod: string | null;
  refJob: string | null;
  editable: boolean;
  /** ຂໍ້ມູນ prefill ໃບງານສ້ອມ — ຖ້າເລືອກ "ສ້ອມ" ຈະພາໄປ /service/new ຕື່ມໃຫ້ */
  repairPrefill?: { proname?: string; sn?: string; billon?: string; billdate?: string; cust?: string; custname?: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [note, setNote] = useState(remark ?? "");
  const t = useDict().claimManage;
  /** ຕື່ມຄ່າໃສ່ຄຳແປ — {label} · {method} · {at} · {doc} */
  const fill = (text: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), text);
  /** ວິທີຊຳລະ — ຄຳຈາກ dictionary (ຄ່າຄົງ PAY_METHOD_LABEL ໃຊ້ຝັ່ງ server/email ຄືເກົ່າ) */
  const payLabel: Record<string, string> = {
    cash: t.payCash, transfer: t.payTransfer, replace: t.payReplace, discount: t.payDiscount,
  };
  const [payM, setPayM] = useState(payMethod ?? "");
  const [err, setErr] = useState("");
  const payNext = type === "C" && nextStatus?.status === "paid";

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr("");
      const r = await fn();
      if (r.error) { setErr(r.error); return; }
      router.refresh();
    });

  const del = (id: number) => {
    setItems((p) => p.filter((i) => i.id !== id));
    act(() => deleteClaimItem(claimNo, id));
  };

  return (
    <main className="min-w-0 space-y-5">
      <div className="flex items-end justify-between gap-3 px-1">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">Workflow</p><h2 className="mt-1 text-lg font-bold text-slate-900">{t.manageTitle}</h2></div>
        {emailSentAt && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700"><CircleCheck className="size-3.5" /> {t.emailSent}</span>}
      </div>
      {/* ── ຈັດການ status ── */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-brand-700 text-white"><ListChecks className="size-4.5" /></span><div><p className="text-sm font-bold text-slate-800">{t.nextStep}</p><p className="text-[11px] text-slate-500">{t.workflowHint}</p></div></div>
        <div className="flex flex-wrap items-center gap-2">
          {payNext ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={payM} onChange={(e) => setPayM(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-brand-600">
                <option value="">{t.payMethodPick}</option>
                {Object.entries(payLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" disabled={pending || !payM} onClick={() => act(() => setClaimPaid(claimNo, payM))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} {t.markPaid}
              </button>
            </div>
          ) : type === "B" && nextStatus?.status === "done" ? (
            // ຂັ້ນ "ກວດ/ຕັດສິນ" ⇒ ເລືອກໄດ້ 2 ຢ່າງ: ປ່ຽນ ຫຼື ສ້ອມ (ບັນທຶກ resolution)
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{t.decide}</span>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claimNo, "replace", "stock"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} {t.replaceFromStock}
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claimNo, "replace", "purchase"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-orange-500 px-3 text-sm font-semibold text-white hover:bg-brand-orange-700 disabled:opacity-60">
                <ArrowRight className="size-4" /> {t.buyToReplace}
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claimNo, "replace", "supplier"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-orange-600 px-3 text-sm font-semibold text-white hover:bg-brand-orange-700 disabled:opacity-60">
                <ArrowRight className="size-4" /> {t.claimSupplier}
              </button>
              <button type="button" disabled={pending} onClick={() => act(async () => {
                // ສ້ອມ ⇒ ບັນທຶກ resolution ແລ້ວ **ເຊື່ອມໄປເປີດໃບງານສ້ອມ** (ຕື່ມ ສິນຄ້າ/SN/ບິນ ໃຫ້)
                const r = await resolveClaim(claimNo, "repair");
                if (!r.error) {
                  if (refJob) {
                    router.push(`/service/${refJob}`);
                  } else {
                    const qs = new URLSearchParams(Object.entries(repairPrefill ?? {}).filter(([, v]) => v) as [string, string][]);
                    qs.set("claim", claimNo);
                    router.push(`/service/new?${qs.toString()}`);
                  }
                }
                return r;
              })} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} {t.repairOpenJob}
              </button>
            </div>
          ) : type === "B" && status === "received" ? (
            // received → checking ຕ້ອງຜ່ານ ຊ່າງ QC (saveCheck) ບໍ່ແມ່ນປຸ່ມນີ້
            <span className="text-sm text-slate-500">{t.waitQc}</span>
          ) : nextStatus && claimCanTransition(type, status, nextStatus.status) && !(editable && (type === "A" || type === "C")) ? (
            <button type="button" disabled={pending} onClick={() => act(() => advanceClaim(claimNo, nextStatus.status))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} {fill(t.goTo, { label: nextStatus.label })}
            </button>
          ) : payMethod ? (
            <span className="text-sm font-semibold text-brand-800">{fill(t.paidWith, { method: payLabel[payMethod] ?? payMethod })}</span>
          ) : (
            <span className="text-sm text-slate-400">{t.pipelineEnd}</span>
          )}
          {canReject && ["sent", "review"].includes(status) && (
            <button type="button" disabled={pending} onClick={() => act(() => advanceClaim(claimNo, "rejected"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-orange-400 bg-brand-orange-50 px-3 text-sm font-semibold text-brand-orange-700 hover:bg-brand-orange-100 disabled:opacity-60">
              <X className="size-4" /> supplier ปฏิเสธ
            </button>
          )}
        </div>
        {err && <p className="mt-2 text-xs font-semibold text-brand-orange-700">{err}</p>}
      </div>

      {/* ── ສ່ງຄຳຂໍ ຫາ supplier (CLM-A) — flow ມີຂັ້ນ "ສົ່ງ supplier" ── */}
      {type === "A" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Mail className="size-4 text-brand-700" /> {t.sendPartsRequest}</p>
          <p className="mb-3 text-[12px] text-slate-600">
            {t.itemsAsked} <b className="tabular-nums">{items.length}</b> {t.itemsUnit}
            {items.length > 0 && <span className="text-slate-400"> · {items.map((i) => i.item_name).slice(0, 3).join(", ")}{items.length > 3 ? " …" : ""}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => sendClaimEmail(claimNo))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} {t.sendEmailSupplier}
            </button>
            {emailSentAt && <span className="text-[12px] font-semibold text-brand-800">{fill(t.sentAt, { at: emailSentAt })}</span>}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{t.emailHintA}</p>
        </div>
      )}

      {/**
        * ── COB (ເອກະສານບັນຊີ ERP · trans_flag 87 — ສະເພາະ CLM-C) ──
        * ⚠️ **ບໍ່ມີຊ່ອງພິມເລກ/ປຸ່ມ "ຜູກ COB" ອີກ** (ຖອດ 05-08-2026): ລະບົບ**ສ້າງ COB ໃຫ້ເອງ**
        * ຕອນອອກໃບເຄມ ແລະ ໃຊ້ **ລະຫັດໃບເຄມເປັນເລກເອກະສານ** (ເບິ່ງ lib/erp-cob) ⇒ ບໍ່ມີ
        * ຫຍັງໃຫ້ຄົນພິມອີກ. ຢູ່ນີ້ເຫຼືອແຕ່ **ສະແດງຜົນ** ວ່າ ERP ຮັບແລ້ວບໍ.
        */}
      {type === "C" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><FileText className="size-4.5" /></span><div><p className="text-sm font-bold text-slate-800">1. {t.cobTitle}</p><p className="text-[11px] text-slate-400">{t.cobSub}</p></div></div>
          {cob ? (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-[12px] text-brand-800">
              <b>{cob.doc_no}</b> · {t.cobAmount} <b className="tabular-nums">{cob.total_amount.toLocaleString()}</b> · supplier {cob.supplier_code ?? "-"} · {cob.doc_date ?? "-"} · status {cob.status === 0 ? t.cobNotProcessed : cob.status}
            </div>
          ) : erpDocNo ? (
            <p className="text-[11px] text-brand-900">{fill(t.cobUnreadable, { doc: erpDocNo ?? "" })}</p>
          ) : (
            <p className="text-[11px] text-slate-400">{t.cobNone}</p>
          )}
        </div>
      )}


      {/* ── ເອກະສານສົ່ງເຄື່ອງ + email (CLM-C) ── */}
      {type === "C" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Truck className="size-4.5" /></span><div><p className="text-sm font-bold text-slate-800">2. {t.deliveryTitle}</p><p className="text-[11px] text-slate-400">{t.deliverySub}</p></div></div>
          {/**
            * ⚠️ **ບໍ່ມີ "ຜູກງານ" / "ດຶງ ໃບເກັບເງິນ" ອີກ** (ຖອດ 05-08-2026): ໃບ CLM-C ດຽວນີ້
            * ເກີດພ້ອມ **ເລກງານ ແລະ ລາຍການ**ຢູ່ແລ້ວ — ຈາກຟອມເປີດໃບ (ເລືອກງານ ⇒ ດຶງລາຍການໃຫ້)
            * ຫຼື ຈາກໃບຮັບເງິນ (ຕິກ "ເກັບເງິນນຳ supplier") ⇒ ບໍ່ມີຫຍັງໃຫ້ພິມ/ກົດຊ້ຳຢູ່ນີ້.
            */}
          {delivery ? (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[12px] text-slate-700">
              {t.deliveryJob} <b>{delivery.code}</b> · {delivery.product || "-"} · {delivery.brand || ""} · {t.deliveryCustomer} {delivery.customer || "-"} · {t.deliveryReturned} <b>{delivery.returned_at || "-"}</b>
            </div>
          ) : (
            <p className="mb-3 text-[11px] text-brand-900">{t.deliveryNone}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => sendClaimEmail(claimNo))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} {t.sendEmailRecipients}
            </button>
            {emailSentAt && <span className="text-[12px] font-semibold text-brand-800">{fill(t.sentAt, { at: emailSentAt })}</span>}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{t.emailHintC}</p>
        </div>
      )}

      {/* ── ລາຍการ ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><Package className="size-4.5" /></span><div><p className="text-sm font-bold text-slate-800">{t.partsItems}</p><p className="text-[11px] text-slate-400">{items.length} ລາຍການໃນໃບເຄມ</p></div></div>
        {items.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[12px]">
              <thead><tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-400">
                <th className="px-2 py-1">{t.colCode}</th><th className="px-2 py-1">{t.colName}</th><th className="px-2 py-1 text-right">{t.colQty}</th><th className="px-2 py-1 text-right">{t.colAmount}</th><th /></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="px-2 py-1 font-mono text-slate-500">{it.item_code || "-"}</td>
                    <td className="px-2 py-1">{it.item_name}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{it.qty}{it.unit ? ` ${it.unit}` : ""}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{it.amount ? it.amount.toLocaleString() : "-"}</td>
                    <td className="px-2 py-1 text-right">{editable && <button type="button" onClick={() => del(it.id)} className="text-slate-400 hover:text-brand-orange-700"><Trash2 className="size-3.5" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ໝາຍເຫตุ ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">{t.remark}</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600" />
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={pending} onClick={() => act(() => updateClaimRemark(claimNo, note))} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">{t.saveRemark}</button>
        </div>
      </div>
    </main>
  );
}
