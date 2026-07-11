"use client";
import { addDraftItem, deleteDraftItem, exitEditQuote, saveQuote, saveQuoteEdit, setDraftPrice, type QuoteState } from "@/app/actions/quotation";
import { Button, Card, ErrorBox, inputClass, labelClass, Table } from "@/components/ui";
import { LoaderCircle, LogOut, Save, Search, Trash2, X } from "lucide-react";
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
    <div className="w-full space-y-5">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="pro_code" value={head.productCode} />
        <input type="hidden" name="cust_code" value={head.custCode} />
        <input type="hidden" name="doc_no" value={docNo} />
        <input type="hidden" name="total_discount_baht" value={discount || "0"} />
        <input type="hidden" name="currency_rate" value={rate || "0"} />

        <Card
          title={mode === "create" ? "ໃບສະເໜີລາຄາ" : `ແກ້ໄຂໃບສະເໜີລາຄາ ${docNo}`}
          actions={
            <div className="flex items-center gap-2">
              <Button type="submit" tone="success" disabled={busy}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                ບັນທືກ
              </Button>
              {mode === "edit" ? (
                <Button
                  type="button"
                  tone="neutral"
                  disabled={busy}
                  onClick={() => startTransition(() => exitEditQuote(docNo))}
                >
                  <LogOut className="size-4" />
                  ອອກ
                </Button>
              ) : (
                <Button type="button" tone="neutral" disabled={busy} onClick={() => { window.location.href = "/quotations"; }}>
                  <LogOut className="size-4" />
                  ອອກ
                </Button>
              )}
            </div>
          }
        >
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-3 md:col-span-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="doc_date">ວັນທີ</label>
                  <input id="doc_date" type="date" name="doc_date" required defaultValue={docDate} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="doc_no_view">ເລກທີ</label>
                  <input
                    id="doc_no_view"
                    readOnly
                    value={docNo}
                    className={`${inputClass} font-bold`}
                    title={mode === "create" ? "ເລກທີຈະອອກຕອນບັນທຶກ" : undefined}
                  />
                </div>
              </div>

              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Field label="ລູກຄ້າ" value={head.customer} />
                <Field label="ຊື່ສິນຄ້າ" value={head.productName} />
                <Field label="Model" value={head.model} accent />
                <Field label="SN" value={head.sn} />
                <Field label="ຫຍີ່ຫໍ້" value={head.brand} accent />
                <Field label="ຮັບປະກັນ" value={head.warranty} />
                <Field label="ອາການ" value={head.issue} accent />
                <Field label="ອາການຊ່າງ" value={head.issue2} />
                <Field label="ຊ່າງ" value={head.technician} accent />
              </dl>

              <div>
                <label className={labelClass} htmlFor="remark">ໝາຍເຫດ</label>
                <input id="remark" name="remark" defaultValue={defaultRemark} className={inputClass} autoComplete="off" />
              </div>
            </div>

            <div className="grid place-items-start justify-center">
              {head.productUrl ? (
                <a href={`/api/uploads/${encodeURIComponent(head.productUrl)}`} target="_blank" rel="noreferrer">
                  <Image
                    src={`/api/uploads/${encodeURIComponent(head.productUrl)}`}
                    alt=""
                    width={200}
                    height={200}
                    unoptimized
                    className="size-48 rounded-lg object-cover"
                  />
                </a>
              ) : (
                <span className="grid size-48 place-items-center rounded-lg bg-slate-100 text-sm text-slate-400">ບໍ່ມີຮູບ</span>
              )}
            </div>
          </div>
        </Card>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
        {rowError && <ErrorBox>{rowError}</ErrorBox>}

        <Card
          title="ອາໄຫຼ່ທີ່ໃຊ້"
          actions={
            <Button type="button" tone="info" disabled={busy} onClick={() => setPicker(true)}>
              <Search className="size-4" />
              ເລືອກ
            </Button>
          }
        >
          <Table head={["", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ລາຄາ", "ລວມ"]} minWidth={800}>
            {lines.map((line) => (
              <tr key={line.roworder} className="border-b border-slate-100">
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    title="ລຶບລາຍການ"
                    disabled={busy}
                    onClick={() => run(() => deleteDraftItem(line.roworder))}
                    className="text-red-600 hover:opacity-70 disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{line.item_code}</td>
                <td className="px-3 py-2">{line.item_name}</td>
                <td className="px-3 py-2 text-center">{num(line.qty)}</td>
                <td className="px-3 py-2">{line.unit_code ?? "-"}</td>
                <td className="px-3 py-2">
                  <PriceInput
                    key={`${line.roworder}-${line.price}`}
                    defaultValue={num(line.price)}
                    disabled={busy}
                    onCommit={(price) => {
                      if (price === num(line.price)) return;
                      run(() => setDraftPrice(line.roworder, price));
                    }}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-bold">{money(num(line.sum_amount))}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-400">ຍັງບໍ່ມີລາຍການ</td>
              </tr>
            )}
          </Table>

          <div className="mt-4 ml-auto max-w-md space-y-2 text-sm">
            <Row label="ລວມ (ມູນຄ່າບາດ)">
              <span className="font-bold text-[#e75555]">{money(totalValue)}</span>
            </Row>
            <Row label="ສ່ວນຫຼຸດ (ມູນຄ່າບາດ)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                className="h-9 w-40 rounded-lg border border-slate-300 px-2 text-right text-sm font-bold text-emerald-700 outline-none focus:border-teal-500"
              />
            </Row>
            <Row label="ລວມທັງໝົດ (ມູນຄ່າບາດ)">
              <span className="font-bold text-[#e75555]">{money(totalAmount)}</span>
            </Row>
            <Row label="ອັດຕາເເລກປ່ຽນ (ກີບ)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                className="h-9 w-40 rounded-lg border border-slate-300 px-2 text-right text-sm font-bold text-emerald-700 outline-none focus:border-teal-500"
              />
            </Row>
            <Row label="ລວມ (ມູນຄ່າກີບ)">
              <span className="font-bold text-[#e75555]">{money(totalKip)}</span>
            </Row>
          </div>
        </Card>
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
