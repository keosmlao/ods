"use client";
import { createPoOrder, issuePoOrder, previewPoNo, type PurchaseState } from "@/app/actions/purchase";
import { SparePicker } from "@/components/purchase/spare-picker";
import { useConfirm } from "@/components/confirm-dialog";
import { SelectField } from "@/components/select-field";
import { ErrorBox } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import type { Currency, Lookup } from "@/lib/erp-lookup";
import type { Supplier } from "@/lib/erp-supplier";
import { payTermLabel } from "@/lib/stock-constants";
import type { SpareItem } from "@/lib/tech-flow";
import { ChevronRight, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

/**
 * **ຟອມໃບສັ່ງຊື້ (PO) ແບບ Odoo Purchase** — ອອກໃບໂດຍກົງ ບໍ່ຜ່ານໃບຂໍຊື້.
 *
 * ຖອດໂຄງຈາກ `purchase.order` ຂອງ Odoo:
 *   breadcrumb + ບັນທຶກ/ຍົກເລີກ ເທິງຊ້າຍ · statusbar ຂັ້ນຕອນ ເທິງຂວາ
 *   ຫົວໃຫຍ່ "ໃໝ່" · ຟິວສອງຖັນ (label ຊ້າຍ · ຄ່າຂວາ) · notebook tab ລາຍການ
 *   ຕາຕະລາງແກ້ໃນແຖວ + "ເພີ່ມແຖວ" ລຸ່ມຕາຕະລາງ · ບລັອກຍອດລວມລຸ່ມຂວາ
 *
 * **ຜູ້ສະໜອງບັງຄັບ** — ນີ້ຄືໃບສັ່ງຊື້ແທ້ (ບໍ່ແມ່ນໃບຂໍຊື້): ບັນທຶກ = POT/POH ລົງ ERP
 * ແລ້ວລໍ **ອະນຸມັດ PO (WPOA)** ກ່ອນຮັບເຂົ້າສາງ.
 */

type Line = { item_code: string; item_name: string; unit_code: string; qty: number; price: number };

/** ໂໝດ VAT ທີ່ຄົນເລືອກ — ແປງເປັນ vat_type/vat_rate ຂອງ ERP ຕອນບັນທຶກ */
type VatMode = "none" | "exclude" | "include";

/** ຈ່າຍສົດ ຫຼື ຕິດໜີ້ — ແປງເປັນ credit_day ຂອງ ERP ຕອນບັນທຶກ (ສົດ = 0) */
type PayMode = "cash" | "credit";

/** ຈຳນວນວັນຕິດໜີ້ຕັ້ງຕົ້ນຕອນປ່ຽນມາເປັນ "ຕິດໜີ້" — 30 ວັນ ຄືທີ່ໃບຈິງໃຊ້ຫຼາຍສຸດ (1,353 ໃບ) */
const DEFAULT_CREDIT_DAY = 30;

/**
 * ບວກວັນໃສ່ YYYY-MM-DD — ຄິດແບບ UTC ເພື່ອບໍ່ໃຫ້ເຂດເວລາຂອງເຄື່ອງຜູ້ໃຊ້ ດຶງວັນເລື່ອນໄປມື້ອື່ນ
 * (ຜົນຕ້ອງຕົງກັບ `doc_date::date + credit_day` ທີ່ ERP ຄິດ).
 */
const addDays = (date: string, days: number) => {
  const base = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(base)) return date;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
};

const BRANCHES = [
  { value: "05", label: "ໂອດ່ຽນໄທ (05)" },
  { value: "00", label: "ສຳນັກງານໃຫ່ຍ (00)" },
];

/** ຂັ້ນຕອນຂອງໃບສັ່ງຊື້ທີ່ອອກໂດຍກົງ — ຮ່າງໃໝ່ຢູ່ຂັ້ນທຳອິດສະເໝີ */
const STEPS = ["ໃບສັ່ງຊື້", "ອະນຸມັດ PO", "ຮັບເຂົ້າສາງ"];

/** ອອກ PO ຈາກໃບຂໍຊື້ທີ່ອະນຸມັດແລ້ວ — ໜ້າດຽວກັນ ພຽງແຕ່ແຖວ/ສາຂາມາຈາກ WPRA */
export type IssueFrom = {
  wpraNo: string;
  sprNo: string | null;
  jobCode: string | null;
  branch: string;
  lines: Line[];
};

export function PoEditor({
  suppliers,
  transports,
  warehouses,
  currencies,
  today,
  from,
}: {
  suppliers: Supplier[];
  transports: Lookup[];
  warehouses: Lookup[];
  currencies: Currency[];
  /** ມື້ນີ້ຕາມ server (YYYY-MM-DD) — ບໍ່ໃຊ້ນາຯິກາຂອງເຄື່ອງຜູ້ໃຊ້ ທີ່ອາດຄົນລະເຂດເວລາ */
  today: string;
  /** ບໍ່ໃສ່ = ອອກ PO ລອຍ (New) · ໃສ່ = ອອກ PO ຈາກໃບອະນຸມັດ (ໃຊ້ action ຄົນລະອັນ) */
  from?: IssueFrom;
}) {
  const [state, action, saving] = useActionState<PurchaseState, FormData>(
    from ? issuePoOrder : createPoOrder,
    {},
  );
  const t = useDict().poEditor;
  const formRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  // ອອກຈາກ WPRA: ສາຂາ + ແຖວ ຖືກກຳນົດມາແລ້ວ (ຈັດຊື້ແກ້ໄດ້ແຕ່ຈຳນວນ/ລາຄາ)
  const [branch, setBranch] = useState(from?.branch ?? "05");
  const [supplier, setSupplier] = useState("");
  const [docDate, setDocDate] = useState(today);
  const [sendDate, setSendDate] = useState(today);
  const [transport, setTransport] = useState("");
  const [wh, setWh] = useState("");
  const [remark, setRemark] = useState("");
  const [lines, setLines] = useState<Line[]>(from?.lines ?? []);
  /**
   * ສະກຸນເງິນ + VAT — ຄ່າຕັ້ງຕົ້ນຕາມສາຂາ ຄືທີ່ໃບຈິງໃຊ້:
   * ສາຂາ 05 (ໄທ) = VAT ແຍກນອກ 7% (954 ໃບ) · ສາຂາ 00 (ລາວ) = ລວມ VAT ແລ້ວ 10% (739 ໃບ).
   * ສະກຸນເງິນຕັ້ງຕົ້ນ 01 = ບາດ (ໃບຈິງ 1,784/2,188 ໃຊ້ບາດ).
   */
  const [currency, setCurrency] = useState("01");
  const [rate, setRate] = useState(1);
  const [vatType, setVatType] = useState((from?.branch ?? "05") === "05" ? 0 : 2);
  const [vatRate, setVatRate] = useState((from?.branch ?? "05") === "05" ? 7 : 10);
  /**
   * **ສົດ ຫຼື ຕິດໜີ້** — ERP ເກັບເປັນ `credit_day` ດຽວ (0 = ສົດ · >0 = ຕິດໜີ້ N ວັນ),
   * ວັນຄົບກຳນົດ (`credit_date`) ERP ຄິດເອງຈາກ doc_date + credit_day.
   * ຕັ້ງຕົ້ນ **ສົດ** ຄືໃບຈິງສ່ວນຫຼາຍ (PO 3,383/5,398 = 63% ເປັນສົດ · ຕິດໜີ້ນິຍົມ 30 ວັນ).
   */
  const [creditDay, setCreditDay] = useState(0);
  /** ໂໝດຈ່າຍຄິດຈາກ creditDay ໂດຍກົງ — ບໍ່ເກັບ state ຊ້ຳ ຈຶ່ງບໍ່ມີທາງບໍ່ຕົງກັນ (ຄື vatMode) */
  const payMode: PayMode = creditDay > 0 ? "credit" : "cash";
  /** ວັນຄົບກຳນົດທີ່ຈະໄດ້ — ຄິດຕາມສູດຂອງ ERP ເພື່ອໃຫ້ຄົນເຫັນກ່ອນບັນທຶກ */
  const dueDate = addDays(docDate, creditDay);
  /** ໂໝດ VAT ຄິດຈາກ type+rate ໂດຍກົງ — ບໍ່ເກັບ state ຊ້ຳ ຈຶ່ງບໍ່ມີທາງບໍ່ຕົງກັນ */
  const vatMode: VatMode = vatRate === 0 ? "none" : vatType === 2 ? "include" : "exclude";

  /**
   * ເລກທີ່**ຈະ**ໄດ້ — ຖາມ ERP ຄືນທຸກເທື່ອທີ່ສາຂາ/ວັນທີປ່ຽນ (ຫົວເລກ = POT/POH + ປີເດືອນ).
   * ເປັນພຽງການສະແດງ: ເລກຈິງອອກຕອນບັນທຶກ ພາຍໃນ txn ທີ່ລັອກແລ້ວ.
   */
  const [docNo, setDocNo] = useState("");
  useEffect(() => {
    let alive = true;
    previewPoNo(branch, docDate).then((no) => {
      if (alive) setDocNo(no);
    });
    return () => {
      alive = false;
    };
  }, [branch, docDate]);

  /** ກ່ອງເລືອກອາໄຫຼ່ (modal) — ບໍ່ໃຊ້ dropdown ອີກ ເພາະຖືກກ່ອງເລື່ອນຂອງຕາຕະລາງຕັດ */
  const [picking, setPicking] = useState(false);

  /** ເພີ່ມລາຍການທີ່ເລືອກມາຈາກ modal (ຫຼາຍລາຍການພ້ອມກັນ) — ອັນທີ່ມີແລ້ວຂ້າມ */
  const addPicked = (items: SpareItem[]) =>
    setLines((prev) => [
      ...prev,
      ...items
        .filter((item) => !prev.some((line) => line.item_code === item.code))
        .map((item) => ({
          item_code: item.code,
          item_name: item.name_1,
          unit_code: item.unit_code ?? "",
          qty: 1,
          price: 0,
        })),
    ]);

  const patch = (code: string, field: "qty" | "price", value: number) =>
    setLines((prev) => prev.map((line) => (line.item_code === code ? { ...line, [field]: value } : line)));

  // ຄິດຍອດຄື ERP: ແຍກນອກ ⇒ ບວກ VAT ເທິງຍອດ · ລວມແລ້ວ ⇒ ຍອດຄືເກົ່າ
  const value = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const vatValue = vatType === 0 ? (value * vatRate) / 100 : 0;
  const total = value + vatValue;
  const valid =
    Boolean(supplier) && Boolean(transport) && Boolean(wh) && Boolean(currency) && rate > 0 &&
    sendDate >= docDate && lines.length > 0 && lines.every((line) => line.qty > 0) &&
    Number.isInteger(creditDay) && creditDay >= 0 && creditDay <= 365;
  // ອອກຈາກ WPRA ⇒ ມີແຖວມາແລ້ວ ⇒ ແຖບບັນທຶກຕ້ອງເຫັນແຕ່ຕົ້ນ
  const dirty = Boolean(from) || lines.length > 0 || remark.trim().length > 0 || Boolean(supplier);
  const vendorName = suppliers.find((s) => s.code === supplier)?.name ?? supplier;
  const payLabel = payTermLabel(creditDay);
  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol ?? "";
  /** ບອກສິ່ງທີ່ຍັງຂາດ ຢູ່ຂ້າງປຸ່ມບັນທຶກ — ຄື Odoo ທີ່ບອກເມື່ອບັນທຶກບໍ່ໄດ້ */
  const missing = !supplier
    ? t.missingSupplier
    : !transport
      ? t.missingTransport
      : !wh
        ? t.missingWarehouse
        : lines.length === 0
          ? t.missingLines
          : !Number.isInteger(creditDay) || creditDay < 0 || creditDay > 365
            ? t.missingCreditDay
            : "";

  const submit = async () => {
    const ok = await ask({
      title: t.confirmTitle,
      message: `${from ? `${t.confirmFrom} ${from.wpraNo} · ` : ""}${lines.length} ${t.confirmItems} · ${t.confirmSupplier} ${vendorName} · ${payLabel} · ${t.confirmEta} ${sendDate} · ${t.confirmToWarehouse} ${wh} — ${t.confirmTail}`,
      confirmLabel: t.confirmSubmit,
    });
    if (ok) formRef.current?.requestSubmit();
  };

  return (
    <div className="w-full">
      {dialog}
      <SparePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={addPicked}
        existing={lines.map((line) => line.item_code)}
      />

      {/* ── ແຖບຄວບຄຸມ (Odoo control panel): breadcrumb + ບັນທຶກ/ຍົກເລີກ · statusbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-400">
            <Link href="/purchase-orders" className="hover:text-slate-600 hover:underline">
              {t.breadcrumbPo}
            </Link>
            <ChevronRight className="mx-1 inline size-3.5" />
            <span className="font-semibold text-slate-700">{from ? `${t.issuedFrom} ${from.wpraNo}` : t.newDoc}</span>
          </p>
          {dirty && !valid && <span className="text-xs text-amber-600">{missing}</span>}
          {dirty && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                disabled={!valid || saving}
                title={t.titleSave}
                onClick={submit}
                className="grid size-7 place-items-center rounded-full text-teal-600 hover:bg-teal-50 disabled:opacity-40"
              >
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              </button>
              <button
                type="button"
                disabled={saving}
                title={t.titleCancel}
                onClick={() => {
                  setLines(from?.lines ?? []);
                  setRemark("");
                  setSupplier("");
                }}
                className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </span>
          )}
        </div>

        {/* statusbar — ຮ່າງໃໝ່ຢູ່ຂັ້ນ 1 (ຂັ້ນຕໍ່ໄປເປັນເທົາ ຄື Odoo) */}
        <ol className="flex overflow-hidden rounded-lg border border-slate-300 text-[11px] font-semibold">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-1 px-3 py-1 ${
                index === 0 ? "bg-[#0536a9] text-white" : "bg-white text-slate-400"
              }`}
            >
              {label}
              {index < STEPS.length - 1 && <ChevronRight className="size-3 opacity-40" />}
            </li>
          ))}
        </ol>
      </div>

      {/* ── form sheet — ກວ້າງເຕັມຈໍ (ບໍ່ຈຳກັດ max-width) ── */}
      <div className="bg-slate-50 p-4">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {state.error && (
            <div className="mb-4">
              <ErrorBox>{state.error}</ErrorBox>
            </div>
          )}

          {/* ຫົວ: ເລກທີ່ຈະໄດ້ຈາກ ERP (ຄື Odoo ທີ່ບອກເລກລ່ວງໜ້າ) */}
          <h1 className="font-mono text-3xl font-bold text-slate-700">{docNo || t.newDoc}</h1>
          <p className="mt-1 text-xs text-slate-400">
            {t.subtitlePo} {docNo ? `${t.subtitleConfirmNo} ` : ""}
            {from ? `${t.subtitleEditable} ` : ""}
            {t.subtitleNext}
          </p>
          {from && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              <span>{t.issuedFromApproval} <b className="font-mono text-slate-700">{from.wpraNo}</b></span>
              {from.sprNo && <span>· {t.prLabel} <b className="font-mono text-slate-700">{from.sprNo}</b></span>}
              {from.jobCode && (
                <span>
                  · {t.jobLabel}{" "}
                  <Link href={`/service/${from.jobCode}`} className="font-semibold text-[#0536a9] hover:underline">
                    {from.jobCode}
                  </Link>
                </span>
              )}
            </p>
          )}

          {/* ── ຟິວສອງຖັນ (label ຊ້າຍ · ຄ່າຂວາ) ຄື Odoo form ── */}
          <div className="mt-6 grid gap-x-12 gap-y-4 lg:grid-cols-2">
            <div className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">
                {t.labelSupplier} <span className="text-rose-500">*</span>
              </span>
              <div className="flex-1">
                <SelectField
                  name="_supplier_view"
                  options={suppliers.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }))}
                  value={supplier}
                  onChange={setSupplier}
                  placeholder={t.placeholderSupplier}
                />
              </div>
            </div>

            <label className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">{t.labelDate}</span>
              <input
                type="date"
                value={docDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setDocDate(value);
                  // ຄາດວ່າຮອດ ຫ້າມກ່ອນວັນທີໃບ — ດຶງຕາມໄປໃຫ້ ບໍ່ໃຫ້ຄົນຕ້ອງແກ້ສອງບ່ອນ
                  if (value && sendDate < value) setSendDate(value);
                }}
                className="h-8 flex-1 border-0 border-b border-dashed border-slate-300 bg-transparent text-sm text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">
                {t.labelEta} <span className="text-rose-500">*</span>
              </span>
              <input
                type="date"
                value={sendDate}
                min={docDate}
                onChange={(event) => setSendDate(event.target.value)}
                className="h-8 flex-1 border-0 border-b border-dashed border-slate-300 bg-transparent text-sm text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
              />
            </label>

            <div className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">
                {t.labelTransport} <span className="text-rose-500">*</span>
              </span>
              <div className="flex-1">
                <SelectField
                  name="_transport_view"
                  options={transports.map((tr) => ({ value: tr.code, label: tr.name }))}
                  value={transport}
                  onChange={setTransport}
                  placeholder={t.placeholderTransport}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">
                {t.labelWarehouse} <span className="text-rose-500">*</span>
              </span>
              <div className="flex-1">
                <SelectField
                  name="_wh_view"
                  options={warehouses.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }))}
                  value={wh}
                  onChange={setWh}
                  placeholder={t.placeholderWarehouse}
                />
              </div>
            </div>

            <label className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">{t.labelBranch}</span>
              <select
                value={branch}
                disabled={Boolean(from)}
                title={from ? t.branchLockedTitle : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setBranch(value);
                  // ຄ່າ VAT ຕັ້ງຕົ້ນຕ່າງກັນຕາມສາຂາ (ຕາມທີ່ໃບຈິງໃຊ້) — ຄົນແກ້ຕໍ່ໄດ້
                  if (value === "05") { setVatType(0); setVatRate(7); }
                  else { setVatType(2); setVatRate(10); }
                }}
                className="h-8 flex-1 border-0 border-b border-dashed border-slate-300 bg-transparent text-sm text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
              >
                {BRANCHES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">{t.labelCurrency}</span>
              <div className="flex flex-1 items-center gap-2">
                <select
                  value={currency}
                  onChange={(event) => {
                    const code = event.target.value;
                    setCurrency(code);
                    // ອັດຕາຕັ້ງຕົ້ນ = ອັດຕາປັດຈຸບັນຂອງ ERP (ຄົນແກ້ໄດ້ ຄືໃບຈິງທີ່ອັດຕາຕ່າງກັນຕາມມື້)
                    const found = currencies.find((c) => c.code === code);
                    if (found) setRate(found.rate);
                  }}
                  className="h-8 flex-1 border-0 border-b border-dashed border-slate-300 bg-transparent text-sm text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
                >
                  {currencies.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name} {option.symbol ? `(${option.symbol})` : ""}
                    </option>
                  ))}
                </select>
                <span className="shrink-0 text-xs text-slate-400">{t.labelRate}</span>
                <input
                  type="number"
                  step="0.0000001"
                  min={0}
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                  title={t.rateTitle}
                  className="h-8 w-28 border-0 border-b border-dashed border-slate-300 bg-transparent text-right text-sm tabular-nums text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">VAT</span>
              <div className="flex flex-1 items-center gap-2">
                <select
                  value={vatMode}
                  onChange={(event) => {
                    const mode = event.target.value as VatMode;
                    /**
                     * "ບໍ່ມີ VAT" = vat_type 0 + ອັດຕາ 0 ⇒ ຍອດລວມ = ຍອດສິນຄ້າ ບໍ່ບວກຫຍັງ
                     * (ບໍ່ໄດ້ຄິດ vat_type ໃໝ່ຂຶ້ນເອງ — ໃຊ້ຄ່າທີ່ ERP ຮູ້ຈັກຢູ່ແລ້ວ).
                     */
                    if (mode === "none") { setVatType(0); setVatRate(0); return; }
                    if (mode === "exclude") { setVatType(0); setVatRate(vatRate || (branch === "05" ? 7 : 10)); return; }
                    setVatType(2);
                    setVatRate(vatRate || 10);
                  }}
                  className="h-8 flex-1 border-0 border-b border-dashed border-slate-300 bg-transparent text-sm text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
                >
                  <option value="none">{t.vatNone}</option>
                  <option value="exclude">{t.vatExclude}</option>
                  <option value="include">{t.vatInclude}</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vatRate}
                  disabled={vatMode === "none"}
                  onChange={(event) => setVatRate(Number(event.target.value))}
                  className="h-8 w-16 border-0 border-b border-dashed border-slate-300 bg-transparent text-right text-sm tabular-nums text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none disabled:text-slate-300"
                />
                <span className="shrink-0 text-xs text-slate-400">%</span>
              </div>
            </div>

            {/* ສົດ/ຕິດໜີ້ — ບອກພ້ອມຕອນອອກໃບ (ERP ເກັບເປັນ credit_day: 0 = ສົດ) */}
            <div className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">
                {t.labelPayment} <span className="text-rose-500">*</span>
              </span>
              <div className="flex flex-1 items-center gap-2">
                <select
                  value={payMode}
                  onChange={(event) =>
                    setCreditDay(
                      (event.target.value as PayMode) === "cash" ? 0 : creditDay || DEFAULT_CREDIT_DAY,
                    )
                  }
                  className="h-8 flex-1 border-0 border-b border-dashed border-slate-300 bg-transparent text-sm text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
                >
                  <option value="cash">{t.payCash}</option>
                  <option value="credit">{t.payCredit}</option>
                </select>
                {payMode === "credit" && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      step={1}
                      value={creditDay}
                      onChange={(event) => setCreditDay(Math.trunc(Number(event.target.value)))}
                      className="h-8 w-16 border-0 border-b border-dashed border-slate-300 bg-transparent text-right text-sm tabular-nums text-slate-800 focus:border-solid focus:border-teal-500 focus:outline-none"
                    />
                    <span className="shrink-0 text-xs text-slate-400">{t.daysUnit} · {t.dueLabel} {dueDate}</span>
                  </>
                )}
              </div>
            </div>

            <label className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm font-semibold text-slate-500">{t.labelRemark}</span>
              <input
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                maxLength={200}
                placeholder={t.placeholderRemark}
                className="h-8 flex-1 border-0 border-b border-dashed border-slate-300 bg-transparent text-sm text-slate-800 placeholder:text-slate-300 focus:border-solid focus:border-teal-500 focus:outline-none"
              />
            </label>
          </div>

          {/* ── notebook tab ── */}
          <div className="mt-8 border-b border-slate-200">
            <span className="inline-block border-b-2 border-[#0536a9] px-1 pb-2 text-sm font-bold text-[#0536a9]">
              {t.tabSpares}
            </span>
          </div>

          {/* ── ຕາຕະລາງແກ້ໃນແຖວ ── */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-semibold">{t.colSpare}</th>
                  <th className="w-24 px-3 py-2 text-right font-semibold">{t.colQty}</th>
                  <th className="w-20 px-3 py-2 font-semibold">{t.colUnit}</th>
                  <th className="w-32 px-3 py-2 text-right font-semibold">{t.colPrice}</th>
                  <th className="w-32 px-3 py-2 text-right font-semibold">{t.colTotal}</th>
                  <th className="w-10 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.item_code} className="group border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <span className="block font-medium text-slate-800">{line.item_name}</span>
                      <span className="block font-mono text-[10px] text-slate-400">{line.item_code}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(event) => patch(line.item_code, "qty", Math.max(0, Number(event.target.value)))}
                        className="h-7 w-20 rounded border-0 bg-transparent px-1 text-right tabular-nums hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-500">{line.unit_code || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={line.price}
                        onChange={(event) => patch(line.item_code, "price", Math.max(0, Number(event.target.value)))}
                        className="h-7 w-28 rounded border-0 bg-transparent px-1 text-right tabular-nums hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700">
                      {(line.qty * line.price).toLocaleString()}
                    </td>
                    <td className="py-2 text-center">
                      <button
                        type="button"
                        hidden={Boolean(from)}
                        onClick={() => setLines((prev) => prev.filter((l) => l.item_code !== line.item_code))}
                        title={t.deleteRowTitle}
                        className="rounded p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>

          {/* ── "ເພີ່ມແຖວ" ຄື Odoo — ເປີດກ່ອງເລືອກອາໄຫຼ່ (modal) ── */}
          <div className="border-t border-slate-100 py-2">
            {from ? (
              // ອອກຈາກໃບອະນຸມັດ: ລາຍການຕ້ອງຕົງກັບໃບທີ່ຜູ້ອະນຸມັດເຫັນ ⇒ ເພີ່ມ item ໃໝ່ບໍ່ໄດ້
              <span className="text-xs text-slate-400">{t.linesFromApproval} {from.wpraNo} — {t.linesEditableNote}</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0536a9] hover:underline"
                >
                  <Plus className="size-3.5" />
                  {t.addRow}
                </button>
                {lines.length === 0 && <span className="ml-3 text-xs text-slate-300">{t.noLines}</span>}
              </>
            )}
          </div>

          {/* ── ຍອດລວມ ລຸ່ມຂວາ ຄື Odoo (ຍອດກ່ອນ VAT · VAT · ລວມ) ── */}
          <div className="mt-4 flex justify-end">
            <dl className="w-72 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <dt>{vatMode === "none" ? t.subtotalGoods : vatType === 0 ? t.subtotalBeforeVat : t.subtotalWithVat}</dt>
                <dd className="tabular-nums">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
              </div>
              <div className="flex justify-between text-slate-500">
                <dt>VAT {vatRate}%{vatMode === "none" ? ` ${t.vatSuffixNone}` : vatType === 2 ? ` ${t.vatSuffixIncluded}` : ""}</dt>
                <dd className="tabular-nums">{vatValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 text-base font-bold text-slate-800">
                <dt>{t.grandTotal}</dt>
                <dd className="tabular-nums">
                  {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                  <span className="text-xs font-normal text-slate-400">{currencySymbol}</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* ຟອມເຊື່ອງ — ຖືຄ່າຢ່າງດຽວ · ບັນທຶກກົດຈາກໄອຄອນຢູ່ຫົວ (ບໍ່ໃຫ້ມີສອງປຸ່ມຊ້ຳກັນ) */}
          <form ref={formRef} action={action} className="hidden">
            {from && <input type="hidden" name="wpra_no" value={from.wpraNo} />}
            {from && <input type="hidden" name="back" value={`/purchase-orders/${from.sprNo ?? from.wpraNo}`} />}
            <input type="hidden" name="branch_code" value={branch} />
            <input type="hidden" name="supplier" value={supplier} />
            <input type="hidden" name="doc_date" value={docDate} />
            <input type="hidden" name="send_date" value={sendDate} />
            <input type="hidden" name="transport_code" value={transport} />
            <input type="hidden" name="wh_code" value={wh} />
            <input type="hidden" name="remark" value={remark} />
            <input type="hidden" name="currency_code" value={currency} />
            <input type="hidden" name="exchange_rate" value={rate} />
            <input type="hidden" name="vat_type" value={vatType} />
            <input type="hidden" name="vat_rate" value={vatRate} />
            <input type="hidden" name="credit_day" value={creditDay} />
            <input
              type="hidden"
              name="lines"
              value={JSON.stringify(lines.map(({ item_code, qty, price }) => ({ item_code, qty, price })))}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
