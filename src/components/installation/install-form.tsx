"use client";
import { createInstall, type ActionState } from "@/app/actions/installation";
import { SelectField } from "@/components/select-field";
import { Button, Card, ErrorBox, LinkButton, inputClass, labelClass } from "@/components/ui";
import { CheckCircle2, LoaderCircle, MapPin, Package, Receipt, Save, Search, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

/**
 * ເປີດງານຕິດຕັ້ງ — ຈັດລຳດັບຕາມ **ຂັ້ນຕອນຈິງ**:
 *
 *   ① ຄົ້ນຫາ ແລະ ເລືອກ **ບິນຂາຍ** (ສະເພາະບິນທີ່ມີ "ບໍລິການຕິດຕັ້ງ" ຢູ່ໃນນັ້ນ)
 *   ② ເລືອກວ່າ **ຈະຕິດຕັ້ງລາຍການໃດ ໃນບິນນັ້ນ** (ບິນນຶ່ງອາດຂາຍຫຼາຍລາຍການ)
 *   ③ **ຈັກໜ່ວຍ** — 1 ໜ່ວຍ = 1 ງານ (ຊ່າງໄປຕິດຄົນລະໜ່ວຍ) ພ້ອມ S/N ຂອງແຕ່ລະໜ່ວຍ
 *   ④ Model · ປະເພດ · ຂະໜາດ (ປະເພດ/ຂະໜາດ ດຶງມາຈາກ ERP ແລ້ວ)
 *   ⑤ ສະຖານທີ່ຕິດຕັ້ງ (**ບັງຄັບ**) ແລະ ວັນຄາດວ່າຈະເຂົ້າຕິດຕັ້ງ
 *   ⑥ ບັນທຶກ (ລຸ່ມສຸດ — ກົດບໍ່ໄດ້ຈົນກວ່າຂໍ້ມູນຄົບ)
 *
 * ── ບັນຫາຂອງຮູບແບບເກົ່າ ──
 * · ຄົນເປີດມາເຫັນຊ່ອງຫວ່າງ 8 ຊ່ອງທີ່ພິມບໍ່ໄດ້ (readOnly + required) ⇒ ກົດບັນທຶກແລ້ວ
 *   browser ຮ້ອງໃສ່ຊ່ອງທີ່ພິມບໍ່ໄດ້ — ຕັນ ບໍ່ມີທາງອອກ.
 * · ບິນທີ່ຂາຍແອ 2 ຊຸດ **ເປີດໄດ້ງານດຽວ** ⇒ CS ຕ້ອງເປີດຊ້ຳເອງ ແລະ ງານທີ 2 ມັກຖືກລືມ.
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

export function InstallForm({ categories, username }: { categories: Category[]; username: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createInstall, {});
  const [open, setOpen] = useState(false);
  const [bill, setBill] = useState<Bill | null>(null);
  const [item, setItem] = useState<BillItem | null>(null);
  const [units, setUnits] = useState(1);

  /** S/N ຂອງແຕ່ລະໜ່ວຍ — ຍາວເທົ່າ units ສະເໝີ */
  const [serials, setSerials] = useState<string[]>([""]);

  function pickItem(chosen: BillItem) {
    const count = Math.max(1, Math.round(chosen.qty || 1));
    setItem(chosen);
    setUnits(count);
    // ມີ ISN ຈາກ ERP ⇒ ຕື່ມໃຫ້ຕາມລຳດັບ (ໜ່ວຍໃນຂຶ້ນກ່ອນ)
    setSerials(
      Array.from({ length: count }, (_, index) => {
        const serial = chosen.serials[index];
        return serial ? serial.sn || serial.isn : "";
      }),
    );
  }

  function changeUnits(count: number) {
    const safe = Math.min(20, Math.max(1, count || 1));
    setUnits(safe);
    setSerials((current) =>
      Array.from({ length: safe }, (_, index) => {
        if (current[index] !== undefined) return current[index];
        const serial = item?.serials[index];
        return serial ? serial.sn || serial.isn : "";
      }),
    );
  }

  const setSerial = (index: number, value: string) =>
    setSerials((current) => current.map((old, position) => (position === index ? value : old)));

  const ready = Boolean(bill && item && serials.length === units && serials.every((serial) => serial.trim()));

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      {/* ① ບິນຂາຍ */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <Receipt className="size-4 text-teal-600" />
            ບິນຂາຍ
            {bill && <CheckCircle2 className="size-4 text-emerald-600" />}
          </span>
        }
        actions={
          <Button type="button" tone={bill ? "neutral" : "info"} onClick={() => setOpen(true)}>
            <Search className="size-4" /> {bill ? "ປ່ຽນບິນ" : "ຄົ້ນຫາບີນຂາຍ"}
          </Button>
        }
      >
        {bill ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="ບິນເລກທີ" value={bill.doc_no} />
            <Field label="ວັນທີອອກບິນ" value={bill.doc_date} />
            <Field label="ລູກຄ້າ" value={`${bill.cust_name ?? "-"} (${bill.cust_code ?? "-"})`} />
            <Field label="ເບີໂທ" value={bill.telephone ?? ""} />
            <Field label="ທີ່ຢູ່ລູກຄ້າ" value={bill.address ?? ""} />
            <div className="sm:col-span-2">
              <dt className="text-slate-500">ບໍລິການຕິດຕັ້ງໃນບິນ</dt>
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
            <span className="text-sm font-semibold">ເລີ່ມຈາກຄົ້ນຫາບິນຂາຍ</span>
            <span className="text-xs">ຂໍ້ມູນລູກຄ້າ ແລະ ລາຍການສິນຄ້າ ຈະຖືກດຶງມາຈາກ ERP</span>
          </button>
        )}
      </Card>

      {/* ② ລາຍການໃນບິນ — ເລືອກວ່າຈະຕິດຕັ້ງອັນໃດ */}
      {bill && (
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <Package className="size-4 text-teal-600" />
              ລາຍການທີ່ຈະຕິດຕັ້ງ ({bill.items.length} ລາຍການໃນບິນ)
            </span>
          }
        >
          <div className="space-y-2">
            {bill.items.map((row) => {
              const active = item?.item_code === row.item_code;
              return (
                <button
                  key={row.item_code}
                  type="button"
                  onClick={() => pickItem(row)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active ? "border-teal-500 bg-teal-50/60" : "border-slate-200 hover:border-teal-300"
                  }`}
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                      active ? "border-teal-600" : "border-slate-300"
                    }`}
                  >
                    {active && <span className="size-2.5 rounded-full bg-teal-600" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{row.item_name}</span>
                    <span className="block text-xs text-slate-500">
                      {row.pro_type_name ?? "-"} · {row.pro_size ?? "-"}
                      {row.serials.length > 0 && ` · ມີ ISN ${row.serials.length}`}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    ຂາຍ {row.qty} ໜ່ວຍ
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ③ ຈຳນວນໜ່ວຍ + S/N ຕໍ່ໜ່ວຍ */}
      {bill && item && (
        <>
          <Card title="ຈຳນວນ ແລະ S/N ຂອງແຕ່ລະໜ່ວຍ">
            <p className="mb-3 text-xs text-slate-500">
              <b>1 ໜ່ວຍ = 1 ງານ</b> (ຊ່າງໄປຕິດຄົນລະໜ່ວຍ) — ບິນນີ້ຂາຍ {item.qty} ໜ່ວຍ
            </p>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className={labelClass}>ຈະຕິດຕັ້ງ</label>
              <input
                name="units"
                type="number"
                min={1}
                max={20}
                value={units}
                onChange={(event) => changeUnits(Number(event.target.value))}
                className={`${inputClass} w-24`}
              />
              <span className="text-sm text-slate-500">ໜ່ວຍ ⇒ ຈະສ້າງ {units} ງານ</span>
            </div>

            <div className="space-y-2">
              {serials.map((serial, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">ໜ່ວຍທີ {index + 1}</span>
                  {item.serials.length > 0 ? (
                    // ERP ມີ ISN ຂອງບິນນີ້ ⇒ ເລືອກ (ພິມເອງ = ຜູກເຄື່ອງຜິດໜ່ວຍ)
                    <select
                      value={serial}
                      onChange={(event) => setSerial(index, event.target.value)}
                      className={inputClass}
                    >
                      <option value="">— ເລືອກ ISN —</option>
                      {item.serials.map((row) => (
                        <option key={row.isn} value={row.sn || row.isn}>
                          {row.part ? `${row.part} · ` : ""}
                          {row.isn}
                          {row.sn ? ` · S/N ${row.sn}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={serial}
                      onChange={(event) => setSerial(index, event.target.value)}
                      placeholder="ອ່ານ S/N ຈາກປ້າຍຕົວເຄື່ອງ"
                      className={inputClass}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* server ຮັບເປັນສາຍດຽວ ຄັ່ນດ້ວຍ | — ຈຳນວນຕ້ອງເທົ່າ units (ກວດຢູ່ server ອີກຊັ້ນ) */}
            <input type="hidden" name="pro_sn" value={serials.join("|")} />
          </Card>

          {/* ④ ຂໍ້ມູນສິນຄ້າ */}
          <Card title="ຂໍ້ມູນສິນຄ້າ">
            <p className="mb-3 text-xs text-slate-500">
              ປະເພດ ແລະ ຂະໜາດ <b>ດຶງມາຈາກ ERP ແລ້ວ</b> · Model ຢູ່ຕົວເຄື່ອງ (ERP ບໍ່ມີ) ຈຶ່ງຕ້ອງພິມ
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelClass}>ລຸ້ນ/Model *</label>
                <input name="pro_model" required className={inputClass} />
                <p className="mt-1 truncate text-xs text-slate-400" title={item.item_name}>
                  ຈາກຊື່: {item.item_name}
                </p>
              </div>
              <div>
                <label className={labelClass}>ປະເພດ *</label>
                <SelectField
                  key={item.item_code}
                  name="pro_type"
                  defaultValue={item.pro_type ?? ""}
                  options={categories.map((category) => ({ value: category.code, label: category.name_1 }))}
                />
              </div>
              <div>
                <label className={labelClass}>ຂະໜາດ *</label>
                <input
                  key={item.item_code}
                  name="pro_size"
                  required
                  defaultValue={item.pro_size ?? ""}
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* ⑤ ສະຖານທີ່ ແລະ ວັນນັດ */}
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-teal-600" />
                ສະຖານທີ່ ແລະ ວັນນັດ
              </span>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                {/* ບັງຄັບ — 146 ງານທີ່ຜ່ານມາບໍ່ມີສະຖານທີ່ ⇒ ຊ່າງບໍ່ຮູ້ວ່າໄປໃສ */}
                <label className={labelClass}>ສະຖານທີ່ຕິດຕັ້ງ *</label>
                <input
                  name="location_inst"
                  required
                  defaultValue={bill.address ?? ""}
                  placeholder="ບ້ານ / ເມືອງ / ຈຸດສັງເກດ"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">ຕື່ມມາຈາກທີ່ຢູ່ລູກຄ້າ — ແກ້ໄດ້ຖ້າຕິດຕັ້ງບ່ອນອື່ນ</p>
              </div>
              <div>
                <label className={labelClass}>ວັນຄາດວ່າຈະເຂົ້າຕິດຕັ້ງ</label>
                <input type="date" name="appoint_date" className={inputClass} />
                <p className="mt-1 text-xs text-slate-400">ຜູ້ຈັດຊ່າງປ່ຽນໄດ້ພາຍຫຼັງ</p>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>ໝາຍເຫດ</label>
                <input name="remark" placeholder="ຊັ້ນ, ທາງເຂົ້າ, ນັດເວລາ..." className={inputClass} />
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ຄ່າທີ່ ERP ໃຫ້ມາ — ສົ່ງໄປ server ໂດຍບໍ່ໃຫ້ຄົນແກ້ (ແກ້ໄດ້ = ຂໍ້ມູນຫຼົ້ນກັບ ERP) */}
      <input type="hidden" name="doc_no" value={bill?.doc_no ?? ""} />
      <input type="hidden" name="billdate" value={bill?.doc_date_raw ?? ""} />
      <input type="hidden" name="cust_code" value={bill?.cust_code ?? ""} />
      <input type="hidden" name="custname" value={bill?.cust_name ?? ""} />
      <input type="hidden" name="tel" value={bill?.telephone ?? ""} />
      <input type="hidden" name="address" value={bill?.address ?? ""} />
      <input type="hidden" name="item_code" value={item?.item_code ?? ""} />
      <input type="hidden" name="item_name" value={item?.item_name ?? ""} />
      <input type="hidden" name="sv_type" value={item?.sv_type ?? ""} />
      <input type="hidden" name="pro_brand" value={item?.item_brand ?? ""} />

      {/* ⑥ ບັນທຶກ */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="text-xs text-slate-500">
          ຜູ້ສ້າງ: <b className="text-slate-700">{username}</b>
          {item && (
            <>
              {" · ຈະສ້າງ "}
              <b className="text-slate-700">{units} ງານ</b>
            </>
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <LinkButton href="/installations" tone="neutral">
            ອອກ
          </LinkButton>
          <Button type="submit" tone="success" disabled={pending || !ready}>
            <Save className="size-4" />
            {pending ? "ກຳລັງບັນທຶກ..." : `ບັນທຶກ${units > 1 ? ` ${units} ງານ` : ""}`}
          </Button>
        </div>
      </div>

      {open && (
        <BillPicker
          onClose={() => setOpen(false)}
          onPick={(chosen) => {
            setBill(chosen);
            setItem(null);
            setUnits(1);
            setSerials([""]);
            // ບິນມີລາຍການດຽວ ⇒ ເລືອກໃຫ້ເລີຍ (ບໍ່ໃຫ້ກົດຊ້ຳໂດຍບໍ່ຈຳເປັນ)
            if (chosen.items.length === 1) pickItem(chosen.items[0]);
            setOpen(false);
          }}
        />
      )}
    </form>
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
function BillPicker({ onClose, onPick }: { onClose: () => void; onPick: (bill: Bill) => void }) {
  const [q, setQ] = useState("");
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
            <h2 className="font-bold text-slate-800">ເລືອກບິນຂາຍ</h2>
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
              placeholder="ຄົ້ນຫາ ເລກບິນ, ຊື່ລູກຄ້າ, ເບີໂທ..."
              className="w-full text-sm outline-none"
            />
            {loading && <LoaderCircle className="size-4 shrink-0 animate-spin text-slate-400" />}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            ສະແດງສະເພາະບິນທີ່ມີ<b> ບໍລິການຕິດຕັ້ງ</b> ຢູ່ໃນບິນ · ແອຂຶ້ນເປັນ [SET] ບໍ່ແຍກໜ່ວຍໃນ/ນອກ
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
                  ຄ່າຕິດຕັ້ງ {bill.services.reduce((sum, row) => sum + Math.round(row.qty || 0), 0)} ໜ່ວຍ
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
            <p className="py-12 text-center text-sm text-slate-400">ບໍ່ພົບບິນຂາຍທີ່ມີບໍລິການຕິດຕັ້ງ</p>
          )}
        </div>
      </div>
    </div>
  );
}
