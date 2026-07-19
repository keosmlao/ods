"use client";
import { createInstall, type ActionState } from "@/app/actions/installation";
import { LocationPicker, type Point } from "@/components/installation/location-picker";
import { SelectField } from "@/components/select-field";
import { Button, Card, ErrorBox, LinkButton, inputClass, labelClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { CheckCircle2, LoaderCircle, MapPin, Package, Plus, Receipt, Save, Search, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

type InstallFormDict = ReturnType<typeof useDict>["installForm"];

/**
 * ເປີດງານຕິດຕັ້ງ — **ໜ້າດຽວ ບໍ່ມີໂໝດ**:
 *
 *   ① ຄົ້ນຫາ ແລະ ເລືອກ **ບິນຂາຍ** (ສະເພາະບິນທີ່ມີ "ບໍລິການຕິດຕັ້ງ" ຢູ່ໃນນັ້ນ)
 *   ② **modal ເລືອກລາຍການທີ່ຈະຕິດຕັ້ງ** — ຕິກໄດ້ຫຼາຍລາຍການພ້ອມກັນ (ເປີດເອງຫຼັງເລືອກບິນ
 *      ຖ້າບິນມີຫຼາຍລາຍການ · ບິນລາຍການດຽວ ໃສ່ໃຫ້ເລີຍ) ⇒ ລາຍການທີ່ເລືອກລົງມາເປັນກ່ອງ
 *   ③ ຕື່ມຂໍ້ມູນຢູ່ໃນກ່ອງ (ໜ່ວຍ · S/N ຕໍ່ໜ່ວຍ · Model · ປະເພດ · ຂະໜາດ — ດຶງຈາກ ERP ໃຫ້ແລ້ວ)
 *   ④ ສະຖານທີ່ (**ບັງຄັບ**) · ວັນນັດ · ໝາຍເຫດ — **ໃຊ້ຮ່ວມກັນທຸກລາຍການ** (ບ້ານດຽວກັນ)
 *   ⑤ ບັນທຶກເທື່ອດຽວ ⇒ ສ້າງທຸກງານ (1 ລາຍການ × 1 ໜ່ວຍ = 1 ງານ)
 *
 * ບິນ 1 ໃນ 4 ໃບຕິດຕັ້ງຫຼາຍລາຍການ (2 ລາຍການ 504 ບິນ · 3+ 123 ບິນ ໃນ 1 ປີ) ⇒ ການເລືອກ
 * ຕ້ອງເປັນ **ຊຸດ** ບໍ່ແມ່ນເທື່ອລະອັນ. ເລືອກຜິດ/ຢາກຕື່ມພາຍຫຼັງ ⇒ ກົດ "ເພີ່ມລາຍການ" ຫຼື ✕ ໄດ້ຕະຫຼອດ.
 */

type Category = { code: string; name_1: string };

type Serial = { isn: string; sn: string; part: string };

type BillItem = {
  item_code: string;
  item_name: string;
  qty: number;
  sv_type: string;
  item_brand: string | null;
  pro_type: string | null;
  pro_type_name: string | null;
  pro_size: string | null;
  serials: Serial[];
};

type BillService = { item_code: string; item_name: string; qty: number };

type Bill = {
  doc_date: string;
  doc_date_raw: string;
  doc_no: string;
  cust_code: string | null;
  cust_name: string | null;
  telephone: string | null;
  address: string | null;
  items: BillItem[];
  /** ບໍລິການຕິດຕັ້ງທີ່ພະນັກງານຂາຍເພີ່ມເຂົ້າບິນ — ຈຳນວນທີ່ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ */
  services: BillService[];
};

/**
 * ── ລະຫັດປະເພດເປັນຄົນລະຊຸດ (ນີ້ຄືເຫດຜົນທີ່ dropdown ເຄີຍຫວ່າງ) ──
 * ODS `tb_category` ("ແອ" = 03) ກັບ ERP `ic_category` ("ແອ" = 032) **ບໍ່ແມ່ນລະຫັດດຽວກັນ**
 * ⇒ ເອົາລະຫັດ ERP ໄປໃສ່ dropdown ຂອງ ODS ໂດຍກົງ = ຫາຄ່າບໍ່ພົບ ແລ້ວຂຶ້ນຫວ່າງ.
 * ຈຶ່ງຈັບຄູ່ດ້ວຍ **ຊື່ໝວດ** ແທນ (ຊື່ຢູ່ສອງຖານຂຽນຄືກັນ: ແອ · ໂທລະທັດ · ຕູ້ເຢັນ …).
 */
function matchCategory(categories: Category[], erpName: string | null): string {
  const name = (erpName ?? "").trim();
  if (!name) return "";
  const exact = categories.find((category) => category.name_1.trim() === name);
  if (exact) return exact.code;
  // ຊື່ບໍ່ຕົງເປັນຄຳຕໍ່ຄຳ (ເຊັ່ນ "ຈັກຊັກຜ້າ" ກັບ "ເຄື່ອງຊັກພ້າ…") ⇒ ຫາອັນທີ່ບັນຈຸກັນ
  const loose = categories.find(
    (category) => name.includes(category.name_1.trim()) || category.name_1.trim().includes(name),
  );
  return loose?.code ?? "";
}

/**
 * ເດົາ Model ຈາກຊື່ສິນຄ້າ — ERP **ບໍ່ມີ** item_model (ຫວ່າງ 24,156/24,281 ແຖວ)
 * ແຕ່ຊື່ສິນຄ້າມີລະຫັດຮຸ່ນຢູ່ (ເຊັ່ນ "AIR HISENSE WT 9,500BTU INVERTER **AS-10TRDB2T** 220V").
 * ⇒ ເອົາຄຳທີ່ມີທັງໂຕອັກສອນ ແລະ ໂຕເລກ ຍາວ ≥5 (ບໍ່ນັບ 220V, BTU, ຂະໜາດ) ມາເປັນ **ຂໍ້ສະເໜີ**
 * — ຄົນຮັບເຄື່ອງແກ້ໄດ້ສະເໝີ (ຊ່ອງນີ້ຍັງພິມໄດ້).
 */
function guessModel(itemName: string): string {
  const skip = /^(220V|BTU|WT|[0-9,.]+BTU|R32|R410A?|\d+V)$/i;
  const candidates = itemName
    .replace(/[[\]()]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5 && /[A-Za-z]/.test(word) && /\d/.test(word) && !skip.test(word));
  return candidates[0] ?? "";
}

/** ສະຖານະຂອງ 1 ລາຍການໃນບິນ — ຕິກ = ຈະສ້າງງານ */
type Draft = {
  on: boolean;
  units: number;
  /** S/N ຂອງແຕ່ລະໜ່ວຍ (ໜ່ວຍໃນ [C] ຖ້າເປັນແອ) — ຍາວເທົ່າ units ສະເໝີ */
  serials: string[];
  /** S/N ໜ່ວຍນອກ [H] — ສະເພາະແອ (ບໍ່ບັງຄັບ) */
  outdoor: string[];
  model: string;
  type: string;
  size: string;
  /** ISN ຈາກຄັງ — ໃຊ້ເມື່ອບິນບໍ່ໄດ້ລົງ ISN ໄວ້ */
  stock: Serial[];
  loading: boolean;
  /** ຫາ ISN ບໍ່ພົບໃນລາຍການ ⇒ ພິມເອງ */
  manual: boolean;
};

/** ຈຳນວນງານທີ່ຈ່າຍຄ່າຕິດຕັ້ງແລ້ວໃນບິນ (ລວມທຸກແຖວບໍລິການ) */
const paidUnits = (bill: Bill) => Math.round(bill.services.reduce((sum, service) => sum + (service.qty || 0), 0));

export function InstallForm({
  categories,
  username,
  technicians,
  bill: presetBill = "",
}: {
  categories: Category[];
  username: string;
  /** ລາຍຊື່ຊ່າງ (lib/technicians) — ຈັດຊ່າງໄດ້ຕັ້ງແຕ່ຕອນເປີດງານ */
  technicians: { code: string; name: string }[];
  /** ເລກບິນທີ່ສົ່ງມາຈາກໜ້າ "ບິນຄ້າງອອກໃບງານ" — ເປີດ modal ຄົ້ນໃຫ້ເລີຍ */
  bill?: string;
}) {
  const t = useDict().installForm;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createInstall, {});
  const [open, setOpen] = useState(Boolean(presetBill));
  /** modal ເລືອກລາຍການທີ່ຈະຕິດຕັ້ງ — ຕິກໄດ້ຫຼາຍລາຍການພ້ອມກັນ */
  const [picking, setPicking] = useState(false);
  const [bill, setBill] = useState<Bill | null>(null);
  /** ສະຖານະຂອງແຕ່ລະລາຍການ — key = item_code */
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  /** ພິກັດສະຖານທີ່ຕິດຕັ້ງ (ບໍ່ບັງຄັບ) — ຊ່າງກົດນຳທາງໄດ້ຈາກແອັບ */
  const [point, setPoint] = useState<Point | null>(null);
  /** ຊ່າງທີ່ຈັດໃຫ້ເລີຍ (ຫວ່າງ = ໄປຈັດພາຍຫຼັງ) */
  const [tech, setTech] = useState("");

  const patch = (code: string, change: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [code]: { ...current[code], ...change } }));

  /** ປ່ຽນຈຳນວນໜ່ວຍ — ຕັດ/ຕໍ່ແຖວ S/N ໃຫ້ຍາວເທົ່າກັນສະເໝີ */
  const setUnits = (code: string, value: number) => {
    const units = Math.min(20, Math.max(1, value || 1));
    setDrafts((current) => {
      const draft = current[code];
      const grow = (list: string[]) => Array.from({ length: units }, (_, index) => list[index] ?? "");
      return { ...current, [code]: { ...draft, units, serials: grow(draft.serials), outdoor: grow(draft.outdoor) } };
    });
  };

  const setSerial = (code: string, index: number, value: string, outdoor = false) =>
    setDrafts((current) => {
      const draft = current[code];
      const list = [...(outdoor ? draft.outdoor : draft.serials)];
      list[index] = value;
      return { ...current, [code]: { ...draft, [outdoor ? "outdoor" : "serials"]: list } };
    });

  /**
   * ເລືອກບິນແລ້ວ ⇒ ຕຽມຄ່າຕັ້ງຕົ້ນຂອງທຸກລາຍການໄວ້ ແລ້ວ **ເປີດ modal ໃຫ້ເລືອກລາຍການ**
   * (ບິນມີລາຍການດຽວ ⇒ ໃສ່ໃຫ້ເລີຍ ບໍ່ຕ້ອງເປີດ modal).
   *
   * · ຈຳນວນໜ່ວຍ: ບິນມີລາຍການດຽວ ⇒ ຕາມຈຳນວນ**ຄ່າຕິດຕັ້ງ** (41% ຂອງບິນຂາຍຫຼາຍກວ່າທີ່ຈ້າງຕິດ)
   *   ຫຼາຍລາຍການ ⇒ ຄ່າຕິດຕັ້ງແບ່ງກັນບໍ່ໄດ້ ⇒ ຕາມຈຳນວນທີ່ຂາຍ
   * · S/N: ຈັບຄູ່ ISN ຂອງບິນຕາມລຳດັບ (ແອ: ໜ່ວຍໃນ [C] ກັບ ໜ່ວຍນອກ [H] ຄົນລະເລກ)
   * · ບິນບໍ່ໄດ້ລົງ ISN ⇒ ດຶງ ISN ຂອງລາຍການນັ້ນຈາກຄັງມາໃຫ້ເລືອກ (ບໍ່ໃຫ້ພິມມື)
   */
  function loadBill(chosen: Bill) {
    const paid = paidUnits(chosen);
    const single = chosen.items.length === 1;

    const next: Record<string, Draft> = {};
    for (const item of chosen.items) {
      const sold = Math.max(1, Math.round(item.qty || 1));
      const units = Math.max(1, single && paid > 0 ? Math.min(paid, sold) : sold);
      const indoor = item.serials.filter((serial) => serial.part !== "ໜ່ວຍນອກ");
      const outer = item.serials.filter((serial) => serial.part === "ໜ່ວຍນອກ");
      const valueOf = (serial?: Serial) => (serial ? serial.sn || serial.isn : "");

      next[item.item_code] = {
        // ບິນລາຍການດຽວ = ບໍ່ມີຫຍັງໃຫ້ເລືອກ ⇒ ໃສ່ໃຫ້ເລີຍ · ຫຼາຍລາຍການ ⇒ ໃຫ້ເລືອກໃນ modal
        on: single,
        units,
        serials: Array.from({ length: units }, (_, index) => valueOf(indoor[index])),
        outdoor: Array.from({ length: units }, (_, index) => valueOf(outer[index])),
        model: guessModel(item.item_name),
        type: matchCategory(categories, item.pro_type_name),
        size: item.pro_size ?? "",
        stock: [],
        loading: indoor.length === 0,
        manual: false,
      };
    }
    setBill(chosen);
    setDrafts(next);
    setPoint(null);
    setPicking(!single);

    // ບິນບໍ່ໄດ້ລົງ ISN ⇒ ດຶງຈາກຄັງ (api/installations/serials)
    for (const item of chosen.items) {
      if (item.serials.some((serial) => serial.part !== "ໜ່ວຍນອກ")) continue;
      fetch(`/api/installations/serials?item_code=${encodeURIComponent(item.item_code)}`)
        .then((response) => response.json())
        .then((body: { data?: { isn: string; sn: string; in_stock: boolean }[] }) =>
          patch(item.item_code, {
            stock: (body.data ?? []).map((row) => ({
              isn: row.isn,
              sn: row.sn,
              part: row.in_stock ? "ໃນສາງ" : "",
            })),
            loading: false,
          }),
        )
        .catch(() => patch(item.item_code, { stock: [], loading: false }));
    }
  }

  /** ລາຍການທີ່ **ເລືອກແລ້ວ** (ຜ່ານ modal) ແລະ ລາຍການທີ່ຍັງເລືອກໄດ້ */
  const chosenItems = (bill?.items ?? []).filter((item) => drafts[item.item_code]?.on);
  const remaining = (bill?.items ?? []).filter((item) => !drafts[item.item_code]?.on);

  /** ລາຍການທີ່ຕິກ ແລະ ຂໍ້ມູນຄົບ ⇒ ຈະຖືກສ້າງ */
  const lines = (bill?.items ?? [])
    .map((item) => ({ item, draft: drafts[item.item_code] }))
    .filter(({ draft }) => draft?.on)
    .filter(
      ({ draft }) =>
        draft.model.trim() && draft.type && draft.size.trim() && draft.serials.every((serial) => serial.trim()),
    )
    .map(({ item, draft }) => ({
      item_code: item.item_code,
      item_name: item.item_name,
      sv_type: item.sv_type,
      pro_brand: item.item_brand ?? "",
      pro_model: draft.model.trim(),
      pro_type: draft.type,
      pro_size: draft.size.trim(),
      units: draft.units,
      serials: draft.serials.map((serial) => serial.trim()),
      outdoor: draft.outdoor.map((serial) => serial.trim()),
    }));

  /** ຕິກໄວ້ ແຕ່ຂໍ້ມູນຍັງບໍ່ຄົບ — ຕ້ອງບອກ ບໍ່ດັ່ງນັ້ນປຸ່ມບັນທຶກ "ບໍ່ຄົບ" ໂດຍບໍ່ຮູ້ວ່າຂາດຫຍັງ */
  const incomplete = (bill?.items ?? []).filter(
    (item) => drafts[item.item_code]?.on && !lines.some((line) => line.item_code === item.item_code),
  );

  const totalJobs = lines.reduce((sum, line) => sum + line.units, 0);
  const ready = Boolean(bill) && lines.length > 0 && incomplete.length === 0;

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      {/* ① ບິນຂາຍ */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <Receipt className="size-4 text-teal-600" />
            {t.billSale}
            {bill && <CheckCircle2 className="size-4 text-emerald-600" />}
          </span>
        }
        actions={
          <Button type="button" tone={bill ? "neutral" : "info"} onClick={() => setOpen(true)}>
            <Search className="size-4" /> {bill ? t.changeBill : t.searchBill}
          </Button>
        }
      >
        {bill ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label={t.billNo} value={bill.doc_no} />
            <Field label={t.billDate} value={bill.doc_date} />
            <Field label={t.customer} value={`${bill.cust_name ?? "-"} (${bill.cust_code ?? "-"})`} />
            <Field label={t.phone} value={bill.telephone ?? ""} />
            <Field label={t.customerAddress} value={bill.address ?? ""} />
            <div className="sm:col-span-2">
              <dt className="text-slate-500">{t.installServiceInBill}</dt>
              <dd className="mt-1 space-y-0.5">
                {bill.services.length === 0 ? (
                  <span className="text-xs text-slate-400">-</span>
                ) : (
                  bill.services.map((service) => (
                    <span key={service.item_code} className="block text-xs font-semibold text-teal-700">
                      🛠 {service.item_name} × {service.qty}
                    </span>
                  ))
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-slate-500 transition hover:border-teal-400 hover:bg-teal-50/40"
          >
            <Search className="size-6" />
            <span className="text-sm font-semibold">{t.startBySearchingBill}</span>
            <span className="text-xs">{t.customerAndItemsFromErp}</span>
          </button>
        )}
      </Card>

      {/* ② ລາຍການທີ່ຈະຕິດຕັ້ງ — ເພີ່ມຜ່ານ modal (ຕິກໄດ້ຫຼາຍລາຍການພ້ອມກັນ) */}
      {bill && (
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <Package className="size-4 text-teal-600" />
              {t.itemsToInstall}
              {chosenItems.length > 0 && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800">
                  {chosenItems.length} {t.itemsUnit} · {totalJobs} {t.jobsUnit}
                </span>
              )}
            </span>
          }
          actions={
            remaining.length > 0 ? (
              <Button type="button" tone="info" onClick={() => setPicking(true)}>
                <Plus className="size-4" /> {t.addItem}
              </Button>
            ) : undefined
          }
        >
          {chosenItems.length === 0 ? (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-slate-500 transition hover:border-teal-400 hover:bg-teal-50/40"
            >
              <Plus className="size-6" />
              <span className="text-sm font-semibold">{t.selectItemsToInstall}</span>
              <span className="text-xs">
                {t.billHasPrefix} {bill.items.length} {t.installableItemsSuffix}
              </span>
            </button>
          ) : (
            <p className="text-xs text-slate-500">{t.fillDetailsHint}</p>
          )}
        </Card>
      )}

      {/* ກ່ອງຂອງແຕ່ລະລາຍການທີ່ເລືອກແລ້ວ */}
      {bill &&
        chosenItems.map((item) => {
          const draft = drafts[item.item_code];

          const billIndoor = item.serials.filter((serial) => serial.part !== "ໜ່ວຍນອກ");
          const outdoorOptions = item.serials.filter((serial) => serial.part === "ໜ່ວຍນອກ");
          const fromStock = billIndoor.length === 0 && draft.stock.length > 0;
          const indoorOptions = billIndoor.length > 0 ? billIndoor : draft.stock;
          const isAc = outdoorOptions.length > 0 || (item.pro_type_name ?? "").includes("ແອ");
          const missing = !lines.some((line) => line.item_code === item.item_code);

          return (
            <div
              key={item.item_code}
              className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                missing ? "border-amber-300" : "border-teal-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{item.item_name}</span>
                  <span className="block text-xs text-slate-500">
                    {item.pro_type_name ?? "-"} · {item.pro_size ?? "-"} · {t.soldPrefix} {item.qty} {t.unitsWord}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800">
                  {draft.units} {t.jobsUnit}
                </span>
                <button
                  type="button"
                  title={t.removeItem}
                  onClick={() => patch(item.item_code, { on: false })}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </div>

              {(
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  {/* ຈຳນວນໜ່ວຍ — 1 ໜ່ວຍ = 1 ງານ */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={labelClass}>{t.willInstall}</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={draft.units}
                      onChange={(event) => setUnits(item.item_code, Number(event.target.value))}
                      className={`${inputClass} w-20`}
                    />
                    <span className="text-xs text-slate-500">
                      {t.unitsCreatePrefix} {draft.units} {t.jobsOneToOneSuffix}
                    </span>
                  </div>

                  {/* S/N ຕໍ່ໜ່ວຍ */}
                  <div className="space-y-2">
                    {draft.serials.map((serial, index) => (
                      <div key={index} className={`grid gap-2 ${isAc ? "md:grid-cols-2" : ""}`}>
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">
                            {t.unitNoLabel} {index + 1} {isAc ? t.snIndoorSuffix : t.snSuffix}
                          </label>
                          {indoorOptions.length > 0 && !draft.manual ? (
                            <select
                              value={serial}
                              onChange={(event) => setSerial(item.item_code, index, event.target.value)}
                              className={inputClass}
                            >
                              <option value="">{t.selectIsn}</option>
                              {indoorOptions.map((row) => (
                                <option key={row.isn} value={row.sn || row.isn}>
                                  {row.isn}
                                  {row.sn ? ` · S/N ${row.sn}` : ""}
                                  {row.part === "ໃນສາງ" ? ` · ${t.stillInStock}` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={serial}
                              onChange={(event) => setSerial(item.item_code, index, event.target.value)}
                              placeholder={draft.loading ? t.loadingIsn : t.readFromLabel}
                              className={inputClass}
                            />
                          )}
                        </div>

                        {/* ແອມີຄອມເພຣສເຊີຢູ່ນອກ — ຄົນລະ S/N ⇒ ຮັບປະກັນ/ສ້ອມພາຍຫຼັງອ້າງອີງໄດ້ */}
                        {isAc && (
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">{t.snOutdoor}</label>
                            {outdoorOptions.length > 0 && !draft.manual ? (
                              <select
                                value={draft.outdoor[index] ?? ""}
                                onChange={(event) => setSerial(item.item_code, index, event.target.value, true)}
                                className={inputClass}
                              >
                                <option value="">{t.selectIsn}</option>
                                {outdoorOptions.map((row) => (
                                  <option key={row.isn} value={row.sn || row.isn}>
                                    {row.isn}
                                    {row.sn ? ` · S/N ${row.sn}` : ""}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={draft.outdoor[index] ?? ""}
                                onChange={(event) => setSerial(item.item_code, index, event.target.value, true)}
                                placeholder={t.readFromCompressor}
                                className={inputClass}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* ບອກແຫຼ່ງທີ່ມາຂອງ ISN ແລະ ທາງອອກເມື່ອຫາບໍ່ພົບ */}
                    <p className="text-[11px] text-slate-400">
                      {draft.loading
                        ? t.loadingItemIsn
                        : indoorOptions.length === 0
                          ? t.isnNotFoundErp
                          : fromStock
                            ? t.isnFromStockWarn
                            : t.isnSoldInBill}
                      {indoorOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => patch(item.item_code, { manual: !draft.manual })}
                          className="ml-2 font-semibold text-teal-700 hover:underline"
                        >
                          {draft.manual ? t.backToList : t.notInListType}
                        </button>
                      )}
                    </p>
                  </div>

                  {/* ຂໍ້ມູນສິນຄ້າ — ດຶງມາຈາກ ERP ແລ້ວ ສ່ວນຫຼາຍບໍ່ຕ້ອງແຕະ */}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className={labelClass}>{t.modelLabel}</label>
                      <input
                        value={draft.model}
                        onChange={(event) => patch(item.item_code, { model: event.target.value })}
                        placeholder={t.readFromLabel}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t.typeLabel}</label>
                      <SelectField
                        name={`type_${item.item_code}`}
                        value={draft.type}
                        onChange={(value) => patch(item.item_code, { type: value })}
                        options={categories.map((category) => ({ value: category.code, label: category.name_1 }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t.sizeLabel}</label>
                      <input
                        value={draft.size}
                        onChange={(event) => patch(item.item_code, { size: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {missing && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      {t.stillMissing}
                      {!draft.serials.every((serial) => serial.trim()) && t.missingSomeSn}
                      {!draft.model.trim() && t.missingModel}
                      {!draft.type && t.missingType}
                      {!draft.size.trim() && t.missingSize}
                      {t.orPressXToRemove}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

      {/* ⚠️ ຈຳນວນງານບໍ່ຕົງກັບຄ່າຕິດຕັ້ງທີ່ຈ່າຍມາ — ບອກໄວ້ ບໍ່ໄດ້ຫ້າມ (41% ຂອງບິນຂາຍຫຼາຍກວ່າທີ່ຈ້າງຕິດ) */}
      {bill && bill.services.length > 0 && totalJobs > 0 && totalJobs !== paidUnits(bill) && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {t.paidMismatchPrefix} {paidUnits(bill)} {t.paidMismatchMid} {totalJobs} {t.paidMismatchSuffix}
        </p>
      )}

      {/* ③ ສະຖານທີ່ ແລະ ວັນນັດ — ໃຊ້ຮ່ວມກັນທຸກລາຍການ (ບ້ານດຽວກັນ) */}
      {bill && (
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-teal-600" />
              {t.locationAndAppointment}
            </span>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              {/* ບັງຄັບ — 146 ງານທີ່ຜ່ານມາບໍ່ມີສະຖານທີ່ ⇒ ຊ່າງບໍ່ຮູ້ວ່າໄປໃສ */}
              <label className={labelClass}>{t.installLocationLabel}</label>
              <input
                name="location_inst"
                required
                defaultValue={bill.address ?? ""}
                placeholder={t.locationPlaceholder}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">{t.locationHint}</p>

              {/* ພິກັດ (ບໍ່ບັງຄັບ) — ຊ່າງກົດນຳທາງໄດ້ ແລະ ທຽບກັບ check-in ໄດ້ */}
              <LocationPicker value={point} onChange={setPoint} />
              <input type="hidden" name="location_lat" value={point ? String(point.lat) : ""} />
              <input type="hidden" name="location_lng" value={point ? String(point.lng) : ""} />
            </div>
            <div>
              <label className={labelClass}>{t.appointDateLabel}</label>
              <input type="date" name="appoint_date" className={inputClass} />
              <p className="mt-1 text-xs text-slate-400">{t.dispatcherCanChange}</p>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>{t.remarkLabel}</label>
              <input name="remark" placeholder={t.remarkPlaceholder} className={inputClass} />
            </div>
          </div>
        </Card>
      )}

      {/* ຄ່າທີ່ ERP ໃຫ້ມາ — ສົ່ງໄປ server ໂດຍບໍ່ໃຫ້ຄົນແກ້ (ແກ້ໄດ້ = ຂໍ້ມູນຫຼົ້ນກັບ ERP) */}
      <input type="hidden" name="doc_no" value={bill?.doc_no ?? ""} />
      <input type="hidden" name="billdate" value={bill?.doc_date_raw ?? ""} />
      <input type="hidden" name="cust_code" value={bill?.cust_code ?? ""} />
      <input type="hidden" name="custname" value={bill?.cust_name ?? ""} />
      <input type="hidden" name="tel" value={bill?.telephone ?? ""} />
      <input type="hidden" name="address" value={bill?.address ?? ""} />
      {/* ລາຍການທີ່ຕິກ ແລະ ຂໍ້ມູນຄົບ — server ກວດຊ້ຳດ້ວຍ zod */}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      {/* ④ ບັນທຶກ */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="text-xs text-slate-500">
          {t.createdBy} <b className="text-slate-700">{username}</b>
          {totalJobs > 0 && (
            <>
              {` ${t.willCreate} `}
              <b className="text-slate-700">{totalJobs} {t.jobsUnit}</b>
              {lines.length > 1 && ` ${t.fromPrefix} ${lines.length} ${t.itemsUnit}`}
            </>
          )}
          {incomplete.length > 0 && (
            <span className="font-semibold text-amber-700">
              {" "}
              {t.incompletePrefix} {incomplete.length} {t.incompleteSuffix}
            </span>
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <LinkButton href="/installations" tone="neutral">
            {t.exit}
          </LinkButton>
          <Button type="submit" tone="success" disabled={pending || !ready}>
            <Save className="size-4" />
            {pending ? t.saving : `${t.save}${totalJobs > 1 ? ` ${totalJobs} ${t.jobsUnit}` : ""}`}
          </Button>
        </div>
      </div>

      {open && (
        <BillPicker
          t={t}
          preset={presetBill}
          onClose={() => setOpen(false)}
          onPick={(chosen) => {
            loadBill(chosen);
            setOpen(false);
          }}
        />
      )}

      {picking && bill && (
        <ItemPicker
          t={t}
          items={remaining}
          onClose={() => setPicking(false)}
          onAdd={(codes) => {
            setDrafts((current) => {
              const next = { ...current };
              for (const code of codes) next[code] = { ...next[code], on: true };
              return next;
            });
            setPicking(false);
          }}
        />
      )}
    </form>
  );
}

/**
 * ເລືອກ **ລາຍການທີ່ຈະຕິດຕັ້ງ** ຈາກບິນ — ຕິກໄດ້ຫຼາຍລາຍການພ້ອມກັນ ແລ້ວກົດເພີ່ມເທື່ອດຽວ.
 *
 * ບິນ 1 ໃນ 4 ໃບມີຫຼາຍລາຍການທີ່ຕິດຕັ້ງໄດ້ (2 ລາຍການ 504 ບິນ · 3+ 123 ບິນ ໃນ 1 ປີ)
 * ⇒ ໃຫ້ເລືອກເປັນຊຸດ ດີກວ່າກົດເພີ່ມທີ່ລະອັນ. ຕິກໃຫ້ໝົດໄວ້ກ່ອນ (ບິນຈ່າຍຄ່າຕິດຕັ້ງມາແລ້ວ
 * ⇒ ຄາດວ່າຕິດທັງໝົດ) — ອັນທີ່ບໍ່ຕິດ ຕິກອອກ.
 */
function ItemPicker({
  t,
  items,
  onClose,
  onAdd,
}: {
  t: InstallFormDict;
  items: BillItem[];
  onClose: () => void;
  onAdd: (codes: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(items.map((item) => item.item_code));

  const toggle = (code: string) =>
    setPicked((current) => (current.includes(code) ? current.filter((row) => row !== code) : [...current, code]));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-bold text-slate-800">{t.selectItemsToInstall}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.tickMultipleHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-2 overflow-auto p-4">
          {items.map((item) => {
            const on = picked.includes(item.item_code);
            return (
              <label
                key={item.item_code}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  on ? "border-teal-400 bg-teal-50/50" : "border-slate-200 hover:border-teal-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(item.item_code)}
                  className="mt-0.5 size-5 shrink-0 accent-teal-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{item.item_name}</span>
                  <span className="block text-xs text-slate-500">
                    {item.pro_type_name ?? "-"} · {item.pro_size ?? "-"}
                    {item.serials.length > 0 && ` · ${t.hasIsn} ${item.serials.length}`}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                  {t.soldPrefix} {item.qty} {t.unitsWord}
                </span>
              </label>
            );
          })}

          {items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">{t.allItemsSelected}</p>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-slate-100 p-3">
          <span className="text-xs text-slate-500">
            {t.selectedPrefix} {picked.length} {t.itemsUnit}
          </span>
          <div className="ml-auto flex gap-2">
            <Button type="button" tone="neutral" onClick={onClose} className="h-9 text-xs">
              {t.cancel}
            </Button>
            <Button
              type="button"
              tone="success"
              disabled={picked.length === 0}
              onClick={() => onAdd(picked)}
              className="h-9 text-xs"
            >
              <Plus className="size-4" />
              {t.addPrefix} {picked.length} {t.itemsUnit}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-700">{value.trim() ? value : "-"}</dd>
    </div>
  );
}

/**
 * ໜ້າຕ່າງຄົ້ນຫາບິນຂາຍ — **ບັດ ບໍ່ແມ່ນຕາຕະລາງ** (ຕາຕະລາງ 8 ຖັນ ຕ້ອງເລື່ອນຂວາ
 * ແລະ ປຸ່ມ "ເລືອກ" ຖືກຕັດອອກນອກຈໍ). **1 ບັດ = 1 ບິນ** ພ້ອມລາຍການທີ່ຈະຕິດຕັ້ງ
 * ⇒ ເຫັນກ່ອນວ່າບິນນັ້ນມີຫຍັງແດ່ ຈຶ່ງກົດເລືອກ.
 */
function BillPicker({
  t,
  onClose,
  onPick,
  preset = "",
}: {
  t: InstallFormDict;
  onClose: () => void;
  onPick: (bill: Bill) => void;
  preset?: string;
}) {
  const [q, setQ] = useState(preset);
  const [rows, setRows] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/installations/bills?q=${encodeURIComponent(q)}`);
        const json = await response.json();
        setRows(json.data ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-800">{t.selectBill}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t.searchBillPlaceholder}
              className="w-full text-sm outline-none"
            />
            {loading && <LoaderCircle className="size-4 shrink-0 animate-spin text-slate-400" />}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {t.showBillsWithPrefix}
            <b> {t.installServiceBold}</b> {t.showBillsWithSuffix}
          </p>
        </header>

        <div className="flex-1 space-y-2 overflow-auto p-4">
          {rows.map((bill) => (
            <button
              key={bill.doc_no}
              type="button"
              onClick={() => onPick(bill)}
              className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{bill.doc_no}</span>
                <span className="text-xs text-slate-500">{bill.doc_date}</span>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                  {t.installFeePrefix} {bill.services.reduce((sum, row) => sum + Math.round(row.qty || 0), 0)} {t.unitsWord}
                </span>
              </div>

              {/* ① ບໍລິການຕິດຕັ້ງທີ່ພະນັກງານຂາຍໃສ່ໄວ້ — ນີ້ຄືຈຳນວນງານທີ່ຈ່າຍເງິນແລ້ວ */}
              {bill.services.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {bill.services.map((service) => (
                    <li key={service.item_code} className="text-xs font-semibold text-teal-700">
                      🛠 {service.item_name} <span className="text-teal-600">× {service.qty}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* ② ເຄື່ອງທີ່ຈະຕິດ */}
              <ul className="mt-1 space-y-0.5">
                {bill.items.map((row) => (
                  <li key={row.item_code} className="text-sm font-semibold text-slate-800">
                    · {row.item_name}
                    <span className="ml-1 text-xs font-normal text-slate-500">× {row.qty}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <span>{bill.cust_name || "-"}</span>
                {bill.telephone && <span>{bill.telephone}</span>}
                {bill.address && <span className="text-slate-400">{bill.address}</span>}
              </div>
            </button>
          ))}

          {!loading && rows.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">{t.noBillsFound}</p>
          )}
        </div>
      </div>
    </div>
  );
}
