"use client";
import { addClaimItem, advanceClaim, deleteClaimItem, linkCob, pullJobItems, sendClaimEmail, setClaimJob, setClaimPaid, updateClaimRemark } from "@/app/actions/claim";
import { type ClaimItem, type ClaimType, type CobInfo, type JobDelivery, PAY_METHOD_LABEL } from "@/lib/claim-shared";
import { ArrowRight, BadgeCheck, DownloadCloud, Link2, LoaderCircle, Mail, Plus, Trash2, Truck, X } from "lucide-react";
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
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState({ item_code: "", item_name: "", qty: "1", unit: "", amount: "0" });
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

  const add = () => {
    if (!form.item_name.trim()) { setErr("ໃສ່ຊື່ລາຍການ"); return; }
    act(async () => {
      const r = await addClaimItem(claimNo, { item_code: form.item_code, item_name: form.item_name, qty: Number(form.qty) || 1, unit: form.unit, amount: Number(form.amount) || 0 });
      if (!r.error) { setItems((p) => [...p, { id: Date.now(), item_code: form.item_code || null, item_name: form.item_name, qty: Number(form.qty) || 1, unit: form.unit || null, amount: Number(form.amount) || 0, note: null }]); setForm({ item_code: "", item_name: "", qty: "1", unit: "", amount: "0" }); }
      return r;
    });
  };

  const del = (id: number) => {
    setItems((p) => p.filter((i) => i.id !== id));
    act(() => deleteClaimItem(claimNo, id));
  };

  const inp = "h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500";

  return (
    <div className="space-y-5">
      {/* ── ຈັດການ status ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">ຈັດການສະຖານະ</p>
        <div className="flex flex-wrap items-center gap-2">
          {payNext ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={payM} onChange={(e) => setPayM(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500">
                <option value="">— ວິທີຊຳລະ —</option>
                {Object.entries(PAY_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button type="button" disabled={pending || !payM} onClick={() => act(() => setClaimPaid(claimNo, payM))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} ໝາຍ ຊຳລະແລ້ວ
              </button>
            </div>
          ) : nextStatus ? (
            <button type="button" disabled={pending} onClick={() => act(() => advanceClaim(claimNo, nextStatus.status))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} ໄປ: {nextStatus.label}
            </button>
          ) : payMethod ? (
            <span className="text-sm font-semibold text-emerald-600">✓ ຊຳລະແລ້ວ · {PAY_METHOD_LABEL[payMethod] ?? payMethod}</span>
          ) : (
            <span className="text-sm text-slate-400">— ຈົບ pipeline —</span>
          )}
          {canReject && status !== "rejected" && (
            <button type="button" disabled={pending} onClick={() => act(() => advanceClaim(claimNo, "rejected"))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60">
              <X className="size-4" /> supplier ปฏิเสธ
            </button>
          )}
        </div>
        {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
      </div>

      {/* ── COB (ຜูกเอกสาร ERP — ສະເພาะ CLM-C) ── */}
      {type === "C" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-slate-500">ເອກະສານ COB (ERP · trans_flag 87)</p>
          <div className="flex flex-wrap items-end gap-2">
            <input value={cobDoc} onChange={(e) => setCobDoc(e.target.value)} placeholder="ເລກ COB (ເຊັ່ນ COB26060003)" className={`${inp} min-w-48 flex-1`} />
            <button type="button" disabled={pending} onClick={() => act(() => linkCob(claimNo, cobDoc))} className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Link2 className="size-4" /> ຜູກ COB</button>
          </div>
          {cob ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[12px] text-emerald-800">
              <b>{cob.doc_no}</b> · ຍอด <b className="tabular-nums">{cob.total_amount.toLocaleString()}</b> · supplier {cob.supplier_code ?? "-"} · {cob.doc_date ?? "-"} · status {cob.status === 0 ? "ยังไม่ดำเนินการ" : cob.status}
            </div>
          ) : erpDocNo ? (
            <p className="mt-2 text-[11px] text-amber-600">ຜูกไว้ {erpDocNo} ແຕ່ອ່ານจาก ERP ບໍ່ໄດ້ (ตรวจเลข).</p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">ບັນຊີສ້າງ COB ໃນ ERP ແລ້ວ ⇒ ໃສ່ເລກ COB ຢູ່ນີ້ (read-only, ບໍ່ສ້າง/ບໍ່ແก้ ERP).</p>
          )}
        </div>
      )}

      {/* ── ເອກະສານສົ່ງເຄື່ອງ + email (CLM-C) ── */}
      {type === "C" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Truck className="size-4 text-teal-600" /> ຂໍ້ມູນงาน + ສ່ງ email</p>
          {/* ຜูก/ปรับ เลขงาน + ดึงรายการซ่อม (อะไหล่) จาก job */}
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input value={jobInput} onChange={(e) => setJobInput(e.target.value)} placeholder="ເລກงาน (ສ້ອม)" className="h-9 w-36 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500" />
            <button type="button" disabled={pending} onClick={() => act(() => setClaimJob(claimNo, jobInput))} className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Link2 className="size-4" /> ຜູກงาน</button>
            {refJob && (
              <button type="button" disabled={pending} onClick={() => act(() => pullJobItems(claimNo))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-60"><DownloadCloud className="size-4" /> ດຶງ ໃບເກັບເງิน</button>
            )}
          </div>
          {delivery ? (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[12px] text-slate-700">
              ງານ <b>{delivery.code}</b> · {delivery.product || "-"} · {delivery.brand || ""} · ລູກຄ້າ {delivery.customer || "-"} · ສ່ງคืน <b>{delivery.returned_at || "-"}</b>
            </div>
          ) : (
            <p className="mb-3 text-[11px] text-amber-600">ບໍ່ພົບ ເອກະສານສົ່ງເຄື່ອງ (ໃສ່ ເລກງານ ທີ່ສ່ງຄືນແລ້ວ).</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => sendClaimEmail(claimNo))} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} ສ່ງ email ຫາຜູ້ຮັບ
            </button>
            {emailSentAt && <span className="text-[12px] font-semibold text-emerald-600">✓ ສ່ງແລ້ວ {emailSentAt}</span>}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">ຜູ້ຮັບ ຕັ້ງທີ່ ຜູ້ໃຊ້ → ຜູ້ຮັບລາຍງານອັດຕະໂນມັດ.</p>
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
                    <td className="px-2 py-1 text-right"><button type="button" onClick={() => del(it.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="size-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <input value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} placeholder="ລະຫັດ" className={`${inp} w-24`} />
          <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="ຊື່ອາໄຫຼ່/ລາຍการ" className={`${inp} min-w-40 flex-1`} />
          <input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} inputMode="decimal" className={`${inp} w-16`} />
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ໜ່ວຍ" className={`${inp} w-20`} />
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal" placeholder="ຍอด" className={`${inp} w-24`} />
          <button type="button" disabled={pending} onClick={add} className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Plus className="size-4" /> ເພີ່ม</button>
        </div>
      </div>

      {/* ── ໝາຍເຫตุ ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">ໝາຍເຫตุ</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={pending} onClick={() => act(() => updateClaimRemark(claimNo, note))} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">ບັນທຶກໝາຍເຫตุ</button>
        </div>
      </div>
    </div>
  );
}
