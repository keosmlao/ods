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
import { Button, Card, ErrorBox, Empty, inputClass, labelClass, Table } from "@/components/ui";
import { LoaderCircle, LogOut, Plus, Save, Search, Trash2 } from "lucide-react";
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
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2 text-center">
        <form action={remove}>
          <input type="hidden" name="roworder" value={row.roworder} />
          <input type="hidden" name="product_code" value={productCode} />
          <button
            type="submit"
            disabled={removing}
            title="ລຶບ"
            className="grid size-7 place-items-center rounded text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </form>
      </td>
      <td className="px-3 py-2 text-center">{index + 1}</td>
      <td className="px-3 py-2">{row.item_code}</td>
      <td className="px-3 py-2">{row.item_name}</td>
      <td className="px-3 py-2 text-center">{row.unit_code}</td>
      <td className="px-3 py-2" colSpan={3}>
        <form action={update} className="flex items-center justify-end gap-2">
          <input type="hidden" name="roworder" value={row.roworder} />
          <input type="hidden" name="product_code" value={productCode} />
          <input
            name="qty"
            defaultValue={Number(row.qty)}
            aria-label="ຈຳນວນ"
            className={`${inputClass} h-8 w-20 text-center`}
          />
          <input
            name="price"
            defaultValue={Number(row.price)}
            aria-label="ລາຄາ"
            className={`${inputClass} h-8 w-28 text-right`}
          />
          <span className="w-28 text-right font-semibold">{money(Number(row.sum_amount))}</span>
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
      <Button type="button" tone="neutral" onClick={() => setOpen(true)} className="h-8 px-3 text-xs">
        <Search className="size-4" />
        ເລືອກ
      </Button>
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
    <div className="w-full space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      {/* ຟອມບັນທຶກ — ແຍກຈາກຟອມແກ້ໄຂແຖວ (ຟອມຊ້ອນກັນບໍ່ໄດ້) */}
      <form action={save} encType="multipart/form-data" className="space-y-5">
        <input type="hidden" name="pro_code" value={head.code} />
        <input type="hidden" name="cust_code" value={head.cust_code} />
        <input type="hidden" name="cash_value" value={cashValue} />
        <input type="hidden" name="bexch" value={bank?.currency_code ?? ""} />
        <input type="hidden" name="account_name" value={bank?.name_1 ?? ""} />
        <input type="hidden" name="bank_value" value={bank ? bankValue : "0"} />

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-2">
              <Button type="submit" tone="success" disabled={saving}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                ບັນທືກ
              </Button>
              {/* ອອກ = ລຶບຕະກ້າຖິ້ມ ຄື /deletealliteminvoice ຂອງ ods */}
              <Button type="submit" tone="neutral" formAction={deleteAllInvoiceItems} formNoValidate>
                <LogOut className="size-4" />
                ອອກ
              </Button>
              <input type="hidden" name="product_code" value={head.code} />
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className={labelClass} htmlFor="doc_date">ວັນທີ</label>
                <input id="doc_date" type="date" name="doc_date" required defaultValue={today} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="doc_no">ເລກທີ</label>
                <input id="doc_no" type="text" value={docNo} readOnly className={`${inputClass} font-bold`} />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="ຂໍ້ມູນລູກຄ້າ / ສິນຄ້າ">
            <div className="lg:col-span-2">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Field label="ລູກຄ້າ" value={head.cust_name} />
                <Field label="ເບີໂທ" value={head.tel} />
                <Field label="ທີ່ຢູ່" value={head.address} wide />
                <Field label="ຊື່ເຄື່ອງ" value={head.product} />
                <Field label="Model" value={head.model} />
                <Field label="ຫຍີ່ຫໍ້" value={head.brand} />
                <Field label="Serial Number" value={head.sn} />
                <Field label="ຮັບປະກັນ" value={head.warranty} />
                <Field label="ອາການເບື້ອງຕົ້ນ" value={head.issue} />
                <Field label="ອາການຊ່າງ" value={head.issue_2} />
                <Field label="ຊ່າງສ້ອມ" value={head.emp_code} />
                <Field label="ອຸປະກອນມາກັບເຄື່ອງ" value={head.p_access} />
                <Field label="ຜູ້ຮັບເຄື່ອງ" value={head.user_regis} />
              </dl>
              <div className="mt-4">
                <label className={labelClass} htmlFor="remark">ໝາຍເຫດ</label>
                <input id="remark" type="text" name="remark" className={inputClass} />
              </div>
            </div>
          </Card>

          <Card title="ຮູບ / ຍອດລວມ">
            <div className="mb-4 grid place-items-center">
              {head.product_url ? (
                <Image
                  src={`/api/uploads/${encodeURIComponent(head.product_url)}`}
                  alt=""
                  width={200}
                  height={200}
                  unoptimized
                  className="size-48 rounded-lg object-cover"
                />
              ) : (
                <div className="grid size-48 place-items-center rounded-lg bg-slate-50 text-sm text-slate-400">ບໍ່ມີຮູບ</div>
              )}
            </div>
            <dl className="space-y-2 text-sm">
              <TotalRow label="ລວມບາດ" rate="1" value={money(total)} />
              <TotalRow label="ລວມກິບ" rate={String(rates["02"])} value={money(total * rates["02"])} />
              <TotalRow
                label="ລວມໂດລາ"
                rate={String(rates["03"])}
                value={money(rates["03"] ? total / rates["03"] : 0)}
              />
            </dl>
          </Card>
        </div>

        <Card title="ລາຍລະອຽດການຮັບເງິນ">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <p className="font-semibold text-slate-700">ເງິນສົດ</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>ສະກຸນ</label>
                  {/* ຄ່ານີ້ຖືກສົ່ງອອກຜ່ານ hidden input ຂອງ SelectField (name="cash_type") */}
                  <SelectField
                    name="cash_type"
                    value={cashType}
                    onChange={(value) => setCashType(value || "01")}
                    options={[
                      { value: "01", label: "ບາດ" },
                      { value: "02", label: "ກີບ" },
                    ]}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="cash_ex">ອັດຕາ</label>
                  <input id="cash_ex" value={exCash} readOnly className={`${inputClass} text-center`} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="cash_input">ຈຳນວນເງິນ</label>
                  <input
                    id="cash_input"
                    value={cashValue}
                    onChange={(event) => setCashValue(event.target.value)}
                    autoComplete="off"
                    className={`${inputClass} text-right`}
                  />
                </div>
              </div>
              <p className="text-right text-sm text-slate-600">= {money(amountCash)} ບາດ</p>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <p className="font-semibold text-slate-700">ໂອນຜ່ານທະນາຄານ</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <label className={labelClass}>ບັນຊີ</label>
                  <div className="flex gap-2">
                    <input value={bank?.name_1 ?? ""} readOnly className={inputClass} aria-label="ຊື່ບັນຊີ" />
                    <Button type="button" tone="info" onClick={() => setPickingBank(true)} className="shrink-0">
                      <Search className="size-4" />
                      ເລືອກບັນຊີ
                    </Button>
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="bank_ex">ອັດຕາ</label>
                  <input id="bank_ex" value={exBank} readOnly className={`${inputClass} text-center`} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="bank_input">ຈຳນວນເງິນ</label>
                  <input
                    id="bank_input"
                    value={bankValue}
                    onChange={(event) => setBankValue(event.target.value)}
                    readOnly={!bank}
                    autoComplete="off"
                    className={`${inputClass} text-right`}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="payment_image">ຮູບໃບໂອນ</label>
                  <input
                    id="payment_image"
                    type="file"
                    name="payment_image"
                    accept="image/*"
                    className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-2"
                  />
                </div>
              </div>
              <p className="text-right text-sm text-slate-600">= {money(bankAmount)} ບາດ</p>
            </div>
          </div>

          <p className="mt-4 text-right text-sm">
            ຮັບເງິນລວມ: <b>{money(paid)}</b> ບາດ / ຍອດບິນ: <b>{money(total)}</b> ບາດ
            {paid < total && <span className="ml-2 text-amber-600">(ຍັງຂາດ {money(total - paid)} ບາດ)</span>}
          </p>
        </Card>
      </form>

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

      <Card
        title="ລາຍການອາໄຫຼ່/ຄ່າບໍລິການ"
        actions={<ServicePicker services={services} productCode={head.code} />}
      >
        {cart.length === 0 ? (
          <Empty>ຍັງບໍ່ມີລາຍການ</Empty>
        ) : (
          <Table
            head={["", "#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຫົວໜ່ວຍ", "ຈຳນວນ", "ລາຄາ", "ລວມ"]}
            minWidth={1000}
          >
            {cart.map((row, index) => (
              <LineRow key={row.roworder} row={row} index={index} productCode={head.code} />
            ))}
            <tr className="bg-slate-50 font-bold">
              <td colSpan={7} className="px-3 py-3 text-right">ລວມ</td>
              <td className="px-3 py-3 text-right">{money(total)}</td>
            </tr>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "-"}</dd>
    </div>
  );
}

function TotalRow({ label, rate, value }: { label: string; rate: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-600">{label}</dt>
      <span className="text-xs text-slate-400">{rate}</span>
      <dd className="w-32 rounded bg-slate-50 px-2 py-1 text-right font-bold text-slate-800">{value}</dd>
    </div>
  );
}
