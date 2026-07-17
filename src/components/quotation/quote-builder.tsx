"use client";
import { addDraftItem, deleteDraftItem, exitEditQuote, saveQuote, saveQuoteEdit, setDraftPrice, type QuoteState } from "@/app/actions/quotation";
import { Button, ErrorBox, Table } from "@/components/ui";
import { LoaderCircle, Save, Search, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useMemo, useState, useTransition } from "react";

/** ຖອດແບບຈາກ ods templates/Qutation/create_page.html + edit_page.html */

export type QuoteHead = {
  productCode: string;
  custCode: string;
  customer: string | null;
  productName: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  issue2: string | null;
  technician: string | null;
  productUrl: string | null;
};

export type DraftLine = {
  roworder: number;
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string | null;
  price: string;
  sum_amount: string;
};

/** ລາຍການບໍລິການຈາກ ERP (ic_inventory ລະຫັດຂຶ້ນຕົ້ນ 97) */
export type ServiceItem = {
  code: string;
  name_1: string;
  unit_cost: string | null;
  price_sv: string;
  unit_of_currency: string;
  from_date: string;
  to_date: string;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string | number | null) => {
  const n = Number(String(v ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function QuoteBuilder({
  mode,
  docNo,
  docDate,
  head,
  lines,
  items,
  defaultRate,
  defaultDiscount,
  defaultRemark,
}: {
  mode: "create" | "edit";
  docNo: string;
  docDate: string;
  head: QuoteHead;
  lines: DraftLine[];
  items: ServiceItem[];
  defaultRate: string;
  defaultDiscount: string;
  defaultRemark: string;
}) {
  const [state, formAction, saving] = useActionState<QuoteState, FormData>(
    mode === "create" ? saveQuote : saveQuoteEdit,
    {},
  );
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState("");
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [discount, setDiscount] = useState(defaultDiscount);
  const [rate, setRate] = useState(defaultRate);
  const [activeTab, setActiveTab] = useState<"lines" | "details">("lines");

  const totalValue = useMemo(() => lines.reduce((sum, line) => sum + num(line.sum_amount), 0), [lines]);
  const totalAmount = totalValue - num(discount);
  const totalKip = totalAmount * num(rate);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.code} ${item.name_1}`.toLowerCase().includes(needle));
  }, [items, q]);

  const run = (fn: () => Promise<QuoteState>) =>
    startTransition(async () => {
      const result = await fn();
      setRowError(result.error ?? "");
    });

  const busy = pending || saving;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>ໃບສະເໜີລາຄາ</span>
        <span>/</span>
        <span>{mode === "create" ? "ໃໝ່" : docNo}</span>
      </div>

      <form action={formAction} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <input type="hidden" name="pro_code" value={head.productCode} />
        <input type="hidden" name="cust_code" value={head.custCode} />
        <input type="hidden" name="doc_no" value={docNo} />
        <input type="hidden" name="total_discount_baht" value={discount || "0"} />
        <input type="hidden" name="currency_rate" value={rate || "0"} />

        <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-rose-100 bg-[#fffafa] px-3 py-2">
          <Button type="submit" disabled={busy} className="h-8 rounded-md bg-[#e99a9a] px-4 text-xs text-white hover:bg-[#df8787]">
            {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            ບັນທຶກ
          </Button>
          <span className="text-xs italic text-slate-400">ບັນທຶກແລ້ວຈະສົ່ງເຂົ້າຄິວອະນຸມັດ</span>
          <span className="h-5 w-px bg-slate-200" />
          <button
            type="button"
            disabled={busy}
            onClick={() => mode === "edit" ? startTransition(() => exitEditQuote(docNo)) : (window.location.href = "/quotations")}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            ຍົກເລີກ
          </button>
        </div>

        <div className="px-5 py-7 sm:px-8 lg:px-10">
          <p className="text-xs text-slate-500">ໃບສະເໜີລາຄາ</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight text-slate-900">{docNo}</h1>
          {mode === "create" && <p className="mt-1 text-xs text-slate-400">ເລກທີຕົວຈິງຈະຢືນຢັນເມື່ອບັນທຶກ</p>}

          {(state.error || rowError) && (
            <div className="mt-5 space-y-2">
              {state.error && <ErrorBox>{state.error}</ErrorBox>}
              {rowError && <ErrorBox>{rowError}</ErrorBox>}
            </div>
          )}

          <div className="mt-8 grid gap-x-16 gap-y-6 lg:grid-cols-2">
            <div className="space-y-3">
              <QuoteField label="ລູກຄ້າ" required value={head.customer} />
              <QuoteField label="ລະຫັດເຄື່ອງ" value={head.productCode} />
              <QuoteField label="ສິນຄ້າ" value={[head.productName, head.brand, head.model].filter(Boolean).join(" · ")} />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-[130px_1fr] items-center gap-3 text-sm">
                <label htmlFor="doc_date" className="text-slate-500">ວັນທີອອກໃບ</label>
                <input id="doc_date" type="date" name="doc_date" required defaultValue={docDate} className="h-8 border-b border-slate-200 bg-transparent px-1 text-sm outline-none focus:border-rose-300" />
              </div>
              <QuoteField label="ສະກຸນເງິນ" value="THB → LAK" />
              <div className="grid grid-cols-[130px_1fr] items-center gap-3 text-sm">
                <label htmlFor="rate" className="text-slate-500">ອັດຕາແລກປ່ຽນ</label>
                <div className="flex items-center border-b border-slate-200">
                  <input id="rate" type="number" min={0} step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} className="h-8 w-full bg-transparent px-1 text-sm outline-none" />
                  <span className="text-xs text-slate-400">LAK</span>
                </div>
              </div>
              <QuoteField label="VAT" value="0% · ບໍ່ຄິດ VAT" />
            </div>
          </div>

          <div className="mt-10 flex gap-5 border-b border-slate-200">
            <button type="button" onClick={() => setActiveTab("lines")} className={`border-b-2 px-2 pb-3 text-sm ${activeTab === "lines" ? "border-rose-400 text-rose-500" : "border-transparent text-slate-500"}`}>ລາຍການ</button>
            <button type="button" onClick={() => setActiveTab("details")} className={`border-b-2 px-2 pb-3 text-sm ${activeTab === "details" ? "border-rose-400 text-rose-500" : "border-transparent text-slate-500"}`}>ຂໍ້ມູນອື່ນ</button>
          </div>

          {activeTab === "lines" ? (
            <div className="pt-2">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="w-9 px-2 py-3" />
                      <th className="px-3 py-3 font-medium">ສິນຄ້າ / ບໍລິການ</th>
                      <th className="px-3 py-3 font-medium">ລາຍລະອຽດ</th>
                      <th className="px-3 py-3 text-center font-medium">ຈຳນວນ</th>
                      <th className="px-3 py-3 text-center font-medium">ໜ່ວຍ</th>
                      <th className="px-3 py-3 text-right font-medium">ລາຄາ</th>
                      <th className="px-3 py-3 text-center font-medium">VAT</th>
                      <th className="px-3 py-3 text-right font-medium">ມູນຄ່າ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.roworder} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-2 py-3 text-center">
                          <button type="button" title="ລຶບລາຍການ" disabled={busy} onClick={() => run(() => deleteDraftItem(line.roworder))} className="text-slate-300 hover:text-red-500 disabled:opacity-40"><Trash2 className="size-4" /></button>
                        </td>
                        <td className="px-3 py-3"><span className="font-medium text-slate-800">{line.item_name}</span><span className="mt-0.5 block text-[10px] text-slate-400">{line.item_code}</span></td>
                        <td className="px-3 py-3 text-slate-500">{head.issue2 || head.issue || "-"}</td>
                        <td className="px-3 py-3 text-center">{num(line.qty)}</td>
                        <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
                        <td className="px-3 py-3 text-right"><PriceInput key={`${line.roworder}-${line.price}`} defaultValue={num(line.price)} disabled={busy} onCommit={(price) => { if (price !== num(line.price)) run(() => setDraftPrice(line.roworder, price)); }} /></td>
                        <td className="px-3 py-3 text-center text-slate-400">0%</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{money(num(line.sum_amount))}</td>
                      </tr>
                    ))}
                    {lines.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-400">ຍັງບໍ່ມີລາຍການ</td></tr>}
                  </tbody>
                </table>
              </div>

              <button type="button" disabled={busy} onClick={() => setPicker(true)} className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-500 hover:text-rose-600 disabled:opacity-50"><Search className="size-3.5" />ເພີ່ມລາຍການ</button>

              <div className="mt-7 ml-auto w-full max-w-sm space-y-3 text-sm">
                <Row label="ມູນຄ່າລວມ"><span>{money(totalValue)} ບາດ</span></Row>
                <Row label="ສ່ວນຫຼຸດ">
                  <div className="flex items-center gap-2"><input type="number" min={0} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} className="h-8 w-32 border-b border-slate-300 bg-transparent px-1 text-right outline-none focus:border-rose-300" /><span className="text-xs text-slate-400">ບາດ</span></div>
                </Row>
                <Row label="ລວມຫຼັງສ່ວນຫຼຸດ"><span>{money(totalAmount)} ບາດ</span></Row>
                <Row label="VAT 0%"><span>0.00 ບາດ</span></Row>
                <div className="flex items-center justify-between gap-4 border-t border-slate-300 pt-3 font-bold text-slate-900"><span>ມູນຄ່າທັງໝົດ</span><span className="text-lg">{money(totalKip)} ກີບ</span></div>
              </div>
            </div>
          ) : (
            <div className="grid gap-8 py-6 md:grid-cols-[1fr_auto]">
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <Field label="Model" value={head.model} />
                <Field label="SN" value={head.sn} />
                <Field label="ຍີ່ຫໍ້" value={head.brand} />
                <Field label="ຮັບປະກັນ" value={head.warranty} />
                <Field label="ອາການ" value={head.issue} accent />
                <Field label="ຜົນກວດ" value={head.issue2} />
                <Field label="ຊ່າງ" value={head.technician} />
              </dl>
              {head.productUrl && <a href={`/api/uploads/${encodeURIComponent(head.productUrl)}`} target="_blank" rel="noreferrer"><Image src={`/api/uploads/${encodeURIComponent(head.productUrl)}`} alt="" width={160} height={160} unoptimized className="size-36 rounded-lg border border-slate-200 object-cover" /></a>}
            </div>
          )}

          <div className="mt-9 border-t border-slate-100 pt-4">
            <label htmlFor="remark" className="text-xs text-slate-500">ເງື່ອນໄຂ ແລະ ໝາຍເຫດ</label>
            <textarea id="remark" name="remark" defaultValue={defaultRemark} rows={3} placeholder="ກະລຸນາໃສ່ລາຍລະອຽດ..." className="mt-2 w-full resize-none border-b border-slate-200 bg-transparent px-1 py-2 text-sm outline-none focus:border-rose-300" />
          </div>
        </div>
      </form>

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-slate-200 p-4">
              <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3">
                <Search className="size-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="ຄົ້ນຫາ..."
                  className="w-full text-sm outline-none"
                />
              </div>
              <button type="button" onClick={() => setPicker(false)} className="text-slate-500 hover:text-slate-800" aria-label="ປິດ">
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-auto p-4">
              <Table head={["#", "ລະຫັດ", "ຊື່ບໍລິການ", "ຫົວໜ່ວຍ", "ລາຄາ", "ຊ່ວງວັນທີ", ""]} minWidth={800}>
                {filtered.map((item, index) => (
                  <tr key={item.code} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-center">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2">{item.code}</td>
                    <td className="px-3 py-2">{item.name_1}</td>
                    <td className="px-3 py-2 text-center">{item.unit_cost ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{item.price_sv} ({item.unit_of_currency})</td>
                    <td className="whitespace-nowrap px-3 py-2">{item.from_date} - {item.to_date}</td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        type="button"
                        tone="info"
                        disabled={busy}
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          setPicker(false);
                          run(() =>
                            addDraftItem({
                              productCode: head.productCode,
                              docNo: mode === "edit" ? docNo : null,
                              itemCode: item.code,
                              itemName: item.name_1,
                              unitCode: item.unit_cost ?? "",
                              price: num(item.price_sv),
                            }),
                          );
                        }}
                      >
                        ເລືອກ
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</td>
                  </tr>
                )}
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuoteField({ label, value, required = false }: { label: string; value: string | null; required?: boolean }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 text-sm">
      <span className="text-slate-500">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <span className="min-h-8 border-b border-slate-200 px-1 py-1.5 text-slate-800">{value || "-"}</span>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-500">{label}:</dt>
      <dd className={accent ? "font-medium text-[#b91c1c]" : "text-slate-800"}>{value || "-"}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
      <span className="font-semibold text-slate-600">{label}</span>
      {children}
    </div>
  );
}

/** ປ້ອນລາຄາແລ້ວອອກຈາກຊ່ອງ (blur) ຫຼື ກົດ Enter → ບັນທຶກລົງຮ່າງທັນທີ ຄື /addprice ຂອງ ods */
function PriceInput({
  defaultValue,
  disabled,
  onCommit,
}: {
  defaultValue: number;
  disabled: boolean;
  onCommit: (price: number) => void;
}) {
  const [value, setValue] = useState(String(defaultValue));
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={value}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(num(value))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className="h-9 w-32 rounded-lg border border-slate-300 px-2 text-right text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
    />
  );
}
