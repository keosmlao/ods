"use client";
import { createMaintenance } from "@/app/actions/maintenance";
import type { MaintenanceCatalogItem } from "@/lib/maintenance";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Line = { service_code: string | null; name: string; qty: number; price: number };
type Tech = { code: string; name: string };

const field = "h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

/**
 * ຟອມເປີດງານສ້ອມບໍລຸງ — ລູກຄ້າ + ລາຍການບໍລິການ (ຈາກ catalog, ແກ້ລາຄາໄດ້).
 *
 * `onSuccess` ໃສ່ເມື່ອຢູ່ໃນ **modal** — ບັນທຶກສຳເລັດແລ້ວປິດ modal (ບໍ່ນຳທາງ).
 * ບໍ່ໃສ່ = ໂໝດໜ້າເຕັມ (ນຳທາງໄປໜ້າລາຍລະອຽດງານ).
 * `onCancel` ຄ້າຍກັນ: modal ໃຫ້ປິດ · ໜ້າເຕັມໃຫ້ກັບລາຍການ.
 */
export function MaintenanceForm({
  catalog,
  technicians,
  onSuccess,
  onCancel,
}: {
  catalog: MaintenanceCatalogItem[];
  technicians: Tech[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const addService = (code: string) => {
    if (!code) return;
    const item = catalog.find((c) => c.code === code);
    if (!item) return;
    setLines((prev) => [...prev, { service_code: item.code, name: item.name, qty: 1, price: item.default_price }]);
  };
  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const total = lines.reduce((s, l) => s + (l.price || 0) * (l.qty || 1), 0);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    if (lines.length === 0) { setErr("ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ບໍລິການ"); return; }
    const fd = new FormData(e.currentTarget);
    fd.set("services", JSON.stringify(lines));
    start(async () => {
      const r = await createMaintenance(fd);
      if (r.error) { setErr(r.error); return; }
      if (onSuccess) {
        // ໃນ modal: ປິດ + ໃຫ້ລາຍການໂຫຼດຄືນ (ຜູ້ເອີ້ນ router.refresh)
        onSuccess();
      } else {
        router.push(r.code ? `/maintenance/${r.code}` : "/maintenance");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* ── 2 ພາກເຕັມໜ້າຈໍ: ຊ້າຍ = ຂໍ້ມູນລູກຄ້າ · ຂວາ = ລາຍການບໍລິການ ── */}
      <div className="grid gap-4 xl:grid-cols-5">
        {/* ຂໍ້ມູນລູກຄ້າ / ນັດໝາຍ */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-sm font-bold text-slate-700">ຂໍ້ມູນລູກຄ້າ & ນັດໝາຍ</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>ຊື່ລູກຄ້າ *</label>
              <input name="cust_name" required className={field} />
            </div>
            <div>
              <label className={labelCls}>ເບີໂທ</label>
              <input name="cust_tel" inputMode="tel" className={field} />
            </div>
            <div>
              <label className={labelCls}>ວັນນັດ</label>
              <input name="appoint_date" type="date" className={field} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>ທີ່ຢູ່ໜ້າງານ</label>
              <input name="location" className={field} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>ຊ່າງ (ຈັດຕອນນີ້ ຫຼື ພາຍຫຼັງ)</label>
              <select name="emp_code" defaultValue="" className={field}>
                <option value="">— ຍັງບໍ່ຈັດ —</option>
                {technicians.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>ໝາຍເຫດ</label>
              <textarea name="remark" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
            </div>
          </div>
        </section>

        {/* ລາຍການບໍລິການ — ກ້ວາງກວ່າ (ໃສ່ໄດ້ຫຼາຍລາຍການ) */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-700">ລາຍການບໍລິການ *</h2>
            <select value="" onChange={(e) => addService(e.target.value)} className="h-9 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-700 outline-none focus:border-cyan-500">
              <option value="">+ ເພີ່ມບໍລິການ</option>
              {catalog.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>

          {lines.length === 0 ? (
            <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
              ຍັງບໍ່ມີບໍລິການ — ເລືອກຈາກ &quot;+ ເພີ່ມບໍລິການ&quot;
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="pb-2 font-medium">ບໍລິການ</th>
                    <th className="w-20 pb-2 text-center font-medium">ຈຳນວນ</th>
                    <th className="w-32 pb-2 text-right font-medium">ລາຄາ/ໜ່ວຍ</th>
                    <th className="w-32 pb-2 text-right font-medium">ລວມ</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-2 pr-2 font-medium text-slate-700">{l.name}</td>
                      <td className="py-2">
                        <input
                          type="number" min={1} value={l.qty}
                          onChange={(e) => update(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                          className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-center" title="ຈຳນວນ"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number" min={0} value={l.price}
                          onChange={(e) => update(i, { price: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-9 w-28 rounded-lg border border-slate-300 px-2 text-right tabular-nums" placeholder="ລາຄາ"
                        />
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-slate-700">{((l.price || 0) * (l.qty || 1)).toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => remove(i)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <p className="mt-4 border-t border-slate-100 pt-3 text-right text-base font-bold text-slate-700">
              ລວມ: <span className="tabular-nums text-cyan-700">{total.toLocaleString()}</span> ກີບ
            </p>
          )}
        </section>
      </div>

      {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}

      {/* ແຖບປຸ່ມ — ຕິດລຸ່ມ ເຕັມກ້ວາງ */}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => (onCancel ? onCancel() : router.push("/maintenance"))} className="h-11 rounded-lg border border-slate-200 px-6 text-sm font-semibold text-slate-600 hover:bg-slate-50">ຍົກເລີກ</button>
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-600 px-8 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} ເປີດງານ
        </button>
      </div>
    </form>
  );
}
