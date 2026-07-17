"use client";
import {
  addInvoiceItem,
  deleteAllInvoiceItems,
  deleteInvoiceItem,
  saveInvoice,
  updateInvoiceLine,
  type CartRow,
  type Rates,
} from "@/app/actions/return";
import { SelectField } from "@/components/select-field";
import { Button, ErrorBox, Empty, inputClass, labelClass, Table } from "@/components/ui";
import { LoaderCircle, Plus, Save, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState, useMemo, useState } from "react";

/** ຖອດແບບຈາກ ods: templates/returnProduct/showDetail.html */

export type BillHead = {
  code: string;
  cust_code: string;
  cust_name: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  model: string | null;
  brand: string | null;
  sn: string | null;
  warranty: string | null;
  issue: string | null;
  issue_2: string | null;
  emp_code: string | null;
  p_access: string | null;
  user_regis: string | null;
  product_url: string | null;
};

export type Bank = { book_number: string; name_1: string; currency: string | null; currency_code: string };
export type Service = { code: string; name_1: string; unit_code: string | null };

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ປ່ຽນເປັນບາດ — ຄື count_cash()/count_trans() ຂອງ ods */
function toBaht(value: number, currency: string, rates: Rates) {
  if (currency === "02") return rates["02"] ? value / rates["02"] : 0;
  if (currency === "03") return value * rates["03"];
  return value;
}

/** ແຖວອາໄຫຼ່ 1 ແຖວ — ຟອມຂອງໃຜຂອງມັນ (ຕ້ອງເປັນ component ແຍກ ຈຶ່ງໃຊ້ hook ໄດ້) */
function LineRow({ row, index, productCode }: { row: CartRow; index: number; productCode: string }) {
  const [updateState, update, updating] = useActionState(updateInvoiceLine, {});
  const [, remove, removing] = useActionState(deleteInvoiceItem, {});

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
      <td className="px-2 py-3 text-center">
        <form action={remove}>
          <input type="hidden" name="roworder" value={row.roworder} />
          <input type="hidden" name="product_code" value={productCode} />
          <button
            type="submit"
            disabled={removing}
            title="ລຶບ"
            className="grid size-7 place-items-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </form>
      </td>
      <td className="px-3 py-3">
        <span className="font-medium text-slate-800">{row.item_name}</span>
        <span className="mt-0.5 block text-[10px] text-slate-400">{index + 1}. {row.item_code}</span>
      </td>
      <td className="px-3 py-3 text-center">{row.unit_code}</td>
      <td className="px-3 py-3" colSpan={5}>
        <form action={update} className="grid grid-cols-[80px_120px_60px_130px_70px] items-center justify-end gap-2">
          <input type="hidden" name="roworder" value={row.roworder} />
          <input type="hidden" name="product_code" value={productCode} />
          <input
            name="qty"
            defaultValue={Number(row.qty)}
            aria-label="ຈຳນວນ"
            className="h-8 w-20 border-b border-slate-200 bg-transparent px-1 text-center outline-none focus:border-rose-300"
          />
          <input
            name="price"
            defaultValue={Number(row.price)}
            aria-label="ລາຄາ"
            className="h-8 w-28 border-b border-slate-200 bg-transparent px-1 text-right outline-none focus:border-rose-300"
          />
          <span className="text-center text-slate-400">0%</span>
          <span className="w-32 text-right font-semibold">{money(Number(row.sum_amount))}</span>
          <Button type="submit" disabled={updating} className="h-8 px-3 text-xs">
            {updating ? <LoaderCircle className="size-4 animate-spin" /> : "ບັນທຶກ"}
          </Button>
        </form>
        {updateState.error && <p className="mt-1 text-right text-xs text-red-600">{updateState.error}</p>}
      </td>
    </tr>
  );
}

/** ໜ້າຕ່າງເລືອກຄ່າບໍລິການ (ic_inventory ລະຫັດ 9900xxx) */
function ServicePicker({ services, productCode }: { services: Service[]; productCode: string }) {
  const [open, setOpen] = useState(false);
  const [, add, adding] = useActionState(addInvoiceItem, {});

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-500 hover:text-rose-600">
        <Search className="size-4" />
        ເພີ່ມລາຍການ
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-700">ລາຍການຄ່າບໍລິການ</h3>
              <Button type="button" tone="neutral" onClick={() => setOpen(false)} className="h-8 px-3 text-xs">
                ປິດ
              </Button>
            </div>
            {services.length === 0 ? (
              <Empty>ບໍ່ພົບລາຍການຄ່າບໍລິການ</Empty>
            ) : (
              <Table head={["ລະຫັດ", "ຊື່", "ຫົວໜ່ວຍ", ""]} minWidth={500}>
                {services.map((service) => (
                  <tr key={service.code} className="border-b border-slate-100">
                    <td className="px-3 py-2">{service.code}</td>
                    <td className="px-3 py-2">{service.name_1}</td>
                    <td className="px-3 py-2 text-center">{service.unit_code}</td>
                    <td className="px-3 py-2 text-center">
                      <form action={add} onSubmit={() => setOpen(false)}>
                        <input type="hidden" name="product_code" value={productCode} />
                        <input type="hidden" name="item_code" value={service.code} />
                        <input type="hidden" name="item_name" value={service.name_1} />
                        <input type="hidden" name="unit_code" value={service.unit_code ?? ""} />
                        <Button type="submit" disabled={adding} className="h-8 px-3 text-xs">
                          <Plus className="size-4" />
                          ເລືອກ
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function InvoiceEditor({
  head,
  cart,
  rates,
  banks,
  services,
  docNo,
  today,
}: {
  head: BillHead;
  cart: CartRow[];
  rates: Rates;
  banks: Bank[];
  services: Service[];
  docNo: string;
  today: string;
}) {
  const [state, save, saving] = useActionState(saveInvoice, {});

  const [cashType, setCashType] = useState("01");
  const [cashValue, setCashValue] = useState("0");
  const [bank, setBank] = useState<Bank | null>(null);
  const [bankValue, setBankValue] = useState("0");
  const [pickingBank, setPickingBank] = useState(false);
  const [activeTab, setActiveTab] = useState<"lines" | "payment" | "details">("lines");

  const total = useMemo(() => cart.reduce((sum, row) => sum + Number(row.sum_amount), 0), [cart]);

  const num = (value: string) => {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const exCash = rates[cashType as keyof Rates] ?? 1;
  const exBank = bank ? (rates[bank.currency_code as keyof Rates] ?? 1) : 0;
  const amountCash = toBaht(num(cashValue), cashType, rates);
  const bankAmount = bank ? toBaht(num(bankValue), bank.currency_code, rates) : 0;
  const paid = amountCash + bankAmount;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>ໃບສົ່ງເຄື່ອງ/ຮັບເງິນ</span><span>/</span><span>ໃໝ່</span>
      </div>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ຟອມຫົວບິນ/ຮັບເງິນ ແຍກຈາກຟອມແກ້ໄຂແຕ່ລະແຖວ */}
        {/* `action` ເປັນ server action ⇒ React ຕັ້ງ encType ໃຫ້ເອງ (ໃສ່ເອງຈະຖືກຂຽນທັບ + ເຕືອນ) */}
        <form action={save}>
          <input type="hidden" name="pro_code" value={head.code} />
          <input type="hidden" name="cust_code" value={head.cust_code} />
          <input type="hidden" name="cash_value" value={cashValue} />
          <input type="hidden" name="bexch" value={bank?.currency_code ?? ""} />
          <input type="hidden" name="account_name" value={bank?.name_1 ?? ""} />
          <input type="hidden" name="bank_value" value={bank ? bankValue : "0"} />
          <input type="hidden" name="product_code" value={head.code} />

          <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-rose-100 bg-[#fffafa] px-3 py-2">
            <Button type="submit" disabled={saving} className="h-8 rounded-md bg-[#e99a9a] px-4 text-xs text-white hover:bg-[#df8787]">
              {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              ບັນທຶກ
            </Button>
            <span className="text-xs italic text-slate-400">ບັນທຶກແລ້ວຈະອອກໃບຮັບເງິນ ແລະປິດການສົ່ງຄືນ</span>
            <span className="h-5 w-px bg-slate-200" />
            <button type="submit" formAction={deleteAllInvoiceItems} formNoValidate className="text-xs font-medium text-slate-600 hover:text-slate-900">ຍົກເລີກ</button>
          </div>

          <div className="px-5 pt-7 sm:px-8 lg:px-10">
            <p className="text-xs text-slate-500">ໃບສົ່ງເຄື່ອງ/ຮັບເງິນ</p>
            <h1 className="mt-1 text-3xl font-medium tracking-tight text-slate-900">{docNo}</h1>
            <p className="mt-1 text-xs text-slate-400">ເລກທີຕົວຈິງຈະຢືນຢັນເມື່ອບັນທຶກ</p>

            <div className="mt-8 grid gap-x-16 gap-y-6 lg:grid-cols-2">
              <div className="space-y-3">
                <InvoiceField label="ລູກຄ້າ" required value={head.cust_name} />
                <InvoiceField label="ເບີໂທ" value={head.tel} />
                <InvoiceField label="ທີ່ຢູ່" value={head.address} />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-[130px_1fr] items-center gap-3 text-sm">
                  <label htmlFor="doc_date" className="text-slate-500">ວັນທີອອກໃບ</label>
                  <input id="doc_date" type="date" name="doc_date" required defaultValue={today} className="h-8 border-b border-slate-200 bg-transparent px-1 text-sm outline-none focus:border-rose-300" />
                </div>
                <InvoiceField label="ລະຫັດເຄື່ອງ" value={head.code} />
                <InvoiceField label="ສິນຄ້າ" value={[head.product, head.brand, head.model].filter(Boolean).join(" · ")} />
                <InvoiceField label="Serial Number" value={head.sn} />
              </div>
            </div>

            <div className="mt-10 flex gap-5 border-b border-slate-200">
              <TabButton active={activeTab === "lines"} onClick={() => setActiveTab("lines")}>ລາຍການ</TabButton>
              <TabButton active={activeTab === "payment"} onClick={() => setActiveTab("payment")}>ການຮັບເງິນ</TabButton>
              <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")}>ຂໍ້ມູນອື່ນ</TabButton>
            </div>

            <div className={activeTab === "payment" ? "py-6" : "hidden"}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-slate-700">ເງິນສົດ</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelClass}>ສະກຸນ</label><SelectField name="cash_type" value={cashType} onChange={(value) => setCashType(value || "01")} options={[{ value: "01", label: "ບາດ" }, { value: "02", label: "ກີບ" }]} /></div>
                    <div><label className={labelClass} htmlFor="cash_ex">ອັດຕາ</label><input id="cash_ex" value={exCash} readOnly className={`${inputClass} text-center`} /></div>
                    <div><label className={labelClass} htmlFor="cash_input">ຈຳນວນເງິນ</label><input id="cash_input" value={cashValue} onChange={(event) => setCashValue(event.target.value)} autoComplete="off" className={`${inputClass} text-right`} /></div>
                  </div>
                  <p className="text-right text-sm text-slate-600">= {money(amountCash)} ບາດ</p>
                </div>

                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-slate-700">ໂອນຜ່ານທະນາຄານ</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3"><label className={labelClass}>ບັນຊີ</label><div className="flex gap-2"><input value={bank?.name_1 ?? ""} readOnly className={inputClass} aria-label="ຊື່ບັນຊີ" /><Button type="button" tone="info" onClick={() => setPickingBank(true)} className="shrink-0"><Search className="size-4" />ເລືອກບັນຊີ</Button></div></div>
                    <div><label className={labelClass} htmlFor="bank_ex">ອັດຕາ</label><input id="bank_ex" value={exBank} readOnly className={`${inputClass} text-center`} /></div>
                    <div><label className={labelClass} htmlFor="bank_input">ຈຳນວນເງິນ</label><input id="bank_input" value={bankValue} onChange={(event) => setBankValue(event.target.value)} readOnly={!bank} autoComplete="off" className={`${inputClass} text-right`} /></div>
                    <div><label className={labelClass} htmlFor="payment_image">ຮູບໃບໂອນ</label><input id="payment_image" type="file" name="payment_image" accept="image/*" className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-2" /></div>
                  </div>
                  <p className="text-right text-sm text-slate-600">= {money(bankAmount)} ບາດ</p>
                </div>
              </div>
              <p className="mt-4 text-right text-sm">ຮັບເງິນລວມ: <b>{money(paid)}</b> ບາດ / ຍອດບິນ: <b>{money(total)}</b> ບາດ{paid < total && <span className="ml-2 text-amber-600">(ຍັງຂາດ {money(total - paid)} ບາດ)</span>}</p>
            </div>

            <div className={activeTab === "details" ? "grid gap-8 py-6 md:grid-cols-[1fr_auto]" : "hidden"}>
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <Field label="ຮັບປະກັນ" value={head.warranty} />
                <Field label="ອາການເບື້ອງຕົ້ນ" value={head.issue} />
                <Field label="ອາການຊ່າງ" value={head.issue_2} />
                <Field label="ຊ່າງສ້ອມ" value={head.emp_code} />
                <Field label="ອຸປະກອນມາກັບເຄື່ອງ" value={head.p_access} />
                <Field label="ຜູ້ຮັບເຄື່ອງ" value={head.user_regis} />
              </dl>
              {head.product_url && <Image src={`/api/uploads/${encodeURIComponent(head.product_url)}`} alt="" width={160} height={160} unoptimized className="size-36 rounded-lg border border-slate-200 object-cover" />}
            </div>

            <div className="border-t border-slate-100 py-4">
              <label htmlFor="remark" className="text-xs text-slate-500">ເງື່ອນໄຂ ແລະ ໝາຍເຫດ</label>
              <textarea id="remark" name="remark" rows={3} placeholder="ກະລຸນາໃສ່ລາຍລະອຽດ..." className="mt-2 w-full resize-none border-b border-slate-200 bg-transparent px-1 py-2 text-sm outline-none focus:border-rose-300" />
            </div>
          </div>
        </form>

        <div className={activeTab === "lines" ? "px-5 pb-8 sm:px-8 lg:px-10" : "hidden"}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="w-9 px-2 py-3" /><th className="px-3 py-3 font-medium">ສິນຄ້າ / ບໍລິການ</th><th className="px-3 py-3 text-center font-medium">ໜ່ວຍ</th><th className="px-3 py-3 text-center font-medium">ຈຳນວນ</th><th className="px-3 py-3 text-right font-medium">ລາຄາ</th><th className="px-3 py-3 text-center font-medium">VAT</th><th className="px-3 py-3 text-right font-medium">ມູນຄ່າ</th><th className="px-3 py-3" /></tr></thead>
              <tbody>
                {cart.map((row, index) => <LineRow key={row.roworder} row={row} index={index} productCode={head.code} />)}
                {cart.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-400">ຍັງບໍ່ມີລາຍການ</td></tr>}
              </tbody>
            </table>
          </div>
          <ServicePicker services={services} productCode={head.code} />
          <div className="mt-7 ml-auto w-full max-w-sm space-y-3 text-sm">
            <SummaryRow label="ມູນຄ່າລວມ"><span>{money(total)} ບາດ</span></SummaryRow>
            <SummaryRow label="VAT 0%"><span>0.00 ບາດ</span></SummaryRow>
            <SummaryRow label="ອັດຕາເງິນກີບ"><span>{money(rates["02"])} LAK</span></SummaryRow>
            <div className="flex items-center justify-between gap-4 border-t border-slate-300 pt-3 font-bold text-slate-900"><span>ມູນຄ່າທັງໝົດ</span><span className="text-lg">{money(total * rates["02"])} ກີບ</span></div>
          </div>
        </div>
      </section>

      {pickingBank && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPickingBank(false)}>
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-700">ລາຍການບັນຊີ</h3>
              <Button type="button" tone="neutral" onClick={() => setPickingBank(false)} className="h-8 px-3 text-xs">
                ປິດ
              </Button>
            </div>
            <Table head={["ລະຫັດ", "ຊື່", "ສະກຸນເງິນ", ""]} minWidth={600}>
              {banks.map((row) => (
                <tr key={row.book_number} className="border-b border-slate-100">
                  <td className="px-3 py-2">{row.book_number}</td>
                  <td className="px-3 py-2">{row.name_1}</td>
                  <td className="px-3 py-2">{row.currency}</td>
                  <td className="px-3 py-2 text-center">
                    <Button
                      type="button"
                      onClick={() => {
                        setBank(row);
                        setPickingBank(false);
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      ເລືອກ
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceField({ label, value, required = false }: { label: string; value: string | null; required?: boolean }) {
  return <div className="grid grid-cols-[130px_1fr] items-center gap-3 text-sm"><span className="text-slate-500">{label}{required && <span className="ml-1 text-red-500">*</span>}</span><span className="min-h-8 border-b border-slate-200 px-1 py-1.5 text-slate-800">{value || "-"}</span></div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`border-b-2 px-2 pb-3 text-sm ${active ? "border-rose-400 text-rose-500" : "border-transparent text-slate-500"}`}>{children}</button>;
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2"><span className="font-semibold text-slate-600">{label}</span>{children}</div>;
}

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "-"}</dd>
    </div>
  );
}
