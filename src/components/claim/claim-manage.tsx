"use client";
import { advanceClaim, deleteClaimItem, linkCob, pullJobItems, resolveClaim, sendClaimEmail, setClaimJob, setClaimPaid, updateClaimRemark } from "@/app/actions/claim";
import { claimCanTransition, type ClaimItem, type ClaimType, type CobInfo, type JobDelivery, PAY_METHOD_LABEL } from "@/lib/claim-shared";
import { ArrowRight, BadgeCheck, DownloadCloud, Link2, LoaderCircle, Mail, Trash2, Truck, X } from "lucide-react";
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
  const [cobDoc, setCobDoc] = useState(erpDocNo ?? "");
  const [payM, setPayM] = useState(payMethod ?? "");
  const [jobInput, setJobInput] = useState(refJob ?? "");
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

  const inp = "h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-brand-600";

  return (
    <div className="space-y-5">
      {/* ── ຈັດການ status ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">ຈັດການສະຖານະ</p>
        <div className="flex flex-wrap items-center gap-2">
          {payNext ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={payM} onChange={(e) => setPayM(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-brand-600">
                <option value="">— ວິທີຊຳລະ —</option>
                {Object.entries(PAY_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" disabled={pending || !payM} onClick={() => act(() => setClaimPaid(claimNo, payM))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} ໝາຍ ຊຳລະແລ້ວ
              </button>
            </div>
          ) : type === "B" && nextStatus?.status === "done" ? (
            // ຂັ້ນ "ກວດ/ຕັດສິນ" ⇒ ເລືອກໄດ້ 2 ຢ່າງ: ປ່ຽນ ຫຼື ສ້ອມ (ບັນທຶກ resolution)
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">ຕັດສິນ:</span>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claimNo, "replace", "stock"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} ປ່ຽນຈາກ stock
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claimNo, "replace", "purchase"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-orange-500 px-3 text-sm font-semibold text-white hover:bg-brand-orange-700 disabled:opacity-60">
                <ArrowRight className="size-4" /> ສັ່ງຊື້ມາປ່ຽນ
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claimNo, "replace", "supplier"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-orange-600 px-3 text-sm font-semibold text-white hover:bg-brand-orange-700 disabled:opacity-60">
                <ArrowRight className="size-4" /> ເຄມ supplier
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
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} ສ້ອມ → ເປີດໃບງານ
              </button>
            </div>
          ) : type === "B" && status === "received" ? (
            // received → checking ຕ້ອງຜ່ານ ຊ່າງ QC (saveCheck) ບໍ່ແມ່ນປຸ່ມນີ້
            <span className="text-sm text-slate-500">⏳ ລໍຊ່າງ ກວດເຊັກ (QC) ກ່ອນ ຈຶ່ງຕັດສິນໄດ້</span>
          ) : nextStatus && claimCanTransition(type, status, nextStatus.status) && !(editable && (type === "A" || type === "C")) ? (
            <button type="button" disabled={pending} onClick={() => act(() => advanceClaim(claimNo, nextStatus.status))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} ໄປ: {nextStatus.label}
            </button>
          ) : payMethod ? (
            <span className="text-sm font-semibold text-brand-800">✓ ຊຳລະແລ້ວ · {PAY_METHOD_LABEL[payMethod] ?? payMethod}</span>
          ) : (
            <span className="text-sm text-slate-400">— ຈົບ pipeline —</span>
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
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Mail className="size-4 text-brand-700" /> ສ່ງຄຳຂໍອາໄຫຼ່ ຫາ supplier</p>
          <p className="mb-3 text-[12px] text-slate-600">
            ອາໄຫຼ່ທີ່ຂໍ: <b className="tabular-nums">{items.length}</b> ລາຍการ
            {items.length > 0 && <span className="text-slate-400"> · {items.map((i) => i.item_name).slice(0, 3).join(", ")}{items.length > 3 ? " …" : ""}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => sendClaimEmail(claimNo))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} ສ່ງ email ຫາ supplier
            </button>
            {emailSentAt && <span className="text-[12px] font-semibold text-brand-800">✓ ສ່ງແລ້ວ {emailSentAt}</span>}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">ສົ່ງໄປ email ຂອງ supplier ໃນ ERP, CC ຜູ້ຮັບລາຍງານ ແລະປ່ຽນສະຖານະອັດຕະໂນມັດ.</p>
        </div>
      )}

      {/* ── COB (ຜูกเอกสาร ERP — ສະເພาะ CLM-C) ── */}
      {type === "C" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-slate-500">ເອກະສານ COB (ERP · trans_flag 87)</p>
          <div className="flex flex-wrap items-end gap-2">
            <input value={cobDoc} onChange={(e) => setCobDoc(e.target.value)} placeholder="ເລກ COB (ເຊັ່ນ COB26060003)" className={`${inp} min-w-48 flex-1`} />
            <button type="button" disabled={pending} onClick={() => act(() => linkCob(claimNo, cobDoc))} className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"><Link2 className="size-4" /> ຜູກ COB</button>
          </div>
          {cob ? (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-[12px] text-brand-800">
              <b>{cob.doc_no}</b> · ຍอด <b className="tabular-nums">{cob.total_amount.toLocaleString()}</b> · supplier {cob.supplier_code ?? "-"} · {cob.doc_date ?? "-"} · status {cob.status === 0 ? "ยังไม่ดำเนินการ" : cob.status}
            </div>
          ) : erpDocNo ? (
            <p className="mt-2 text-[11px] text-brand-900">ຜูกไว้ {erpDocNo} ແຕ່ອ່ານจาก ERP ບໍ່ໄດ້ (ตรวจเลข).</p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">ບັນຊີສ້າງ COB ໃນ ERP ແລ້ວ ⇒ ໃສ່ເລກ COB ຢູ່ນີ້ (read-only, ບໍ່ສ້າง/ບໍ່ແก้ ERP).</p>
          )}
        </div>
      )}

      {/* ── ເອກະສານສົ່ງເຄື່ອງ + email (CLM-C) ── */}
      {type === "C" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Truck className="size-4 text-brand-700" /> ຂໍ້ມູນงาน + ສ່ງ email</p>
          {/* ຜูก/ปรับ เลขงาน + ดึงรายการซ่อม (อะไหล่) จาก job */}
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input value={jobInput} onChange={(e) => setJobInput(e.target.value)} placeholder="ເລກงาน (ສ້ອม)" className="h-9 w-36 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-brand-600" />
            <button type="button" disabled={pending} onClick={() => act(() => setClaimJob(claimNo, jobInput))} className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"><Link2 className="size-4" /> ຜູກงาน</button>
            {refJob && (
              <button type="button" disabled={pending} onClick={() => act(() => pullJobItems(claimNo))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60"><DownloadCloud className="size-4" /> ດຶງ ໃບເກັບເງิน</button>
            )}
          </div>
          {delivery ? (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[12px] text-slate-700">
              ງານ <b>{delivery.code}</b> · {delivery.product || "-"} · {delivery.brand || ""} · ລູກຄ້າ {delivery.customer || "-"} · ສ່ງคืน <b>{delivery.returned_at || "-"}</b>
            </div>
          ) : (
            <p className="mb-3 text-[11px] text-brand-900">ບໍ່ພົບ ເອກະສານສົ່ງເຄື່ອງ (ໃສ່ ເລກງານ ທີ່ສ່ງຄືນແລ້ວ).</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => sendClaimEmail(claimNo))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} ສ່ງ email ຫາຜູ້ຮັບ
            </button>
            {emailSentAt && <span className="text-[12px] font-semibold text-brand-800">✓ ສ່ງແລ້ວ {emailSentAt}</span>}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">ສົ່ງໄປ email ຂອງ supplier ໃນ ERP, CC ຜູ້ຮັບລາຍງານ ແລະປ່ຽນເປັນ “ແຈ້ງແລ້ວ” ອັດຕະໂນມັດ.</p>
        </div>
      )}

      {/* ── ລາຍการ ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">ອາໄຫຼ່ / ລາຍการ</p>
        {items.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[12px]">
              <thead><tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-400">
                <th className="px-2 py-1">ລະຫັດ</th><th className="px-2 py-1">ຊື່</th><th className="px-2 py-1 text-right">ຈຳນວນ</th><th className="px-2 py-1 text-right">ຍอด</th><th /></tr></thead>
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
        <p className="mb-2 text-xs font-semibold text-slate-500">ໝາຍເຫตุ</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600" />
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={pending} onClick={() => act(() => updateClaimRemark(claimNo, note))} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">ບັນທຶກໝາຍເຫตุ</button>
        </div>
      </div>
    </div>
  );
}
