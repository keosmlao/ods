"use client";
import { createInstall, type ActionState } from "@/app/actions/installation";
import { SelectField } from "@/components/select-field";
import { Button, Card, ErrorBox, LinkButton, inputClass, labelClass } from "@/components/ui";
import { CheckCircle2, LoaderCircle, MapPin, Receipt, Save, Search, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

/**
 * ເປີດງານຕິດຕັ້ງ — ຈັດລຳດັບຕາມ **ຂັ້ນຕອນຈິງ** ບໍ່ແມ່ນຕາມໂຄງຕາຕະລາງ.
 *
 * ── ບັນຫາຂອງຮູບແບບເກົ່າ ──
 * ① ທຸກຢ່າງ (ລູກຄ້າ · ບິນ · ສິນຄ້າ) **ມາຈາກບິນຂາຍ ERP ອັນດຽວ** ແຕ່ປຸ່ມ "ຄົ້ນຫາບິນຂາຍ"
 *    ຢູ່ກາງໜ້າ ⇒ ຄົນເປີດມາເຫັນຊ່ອງຫວ່າງ 8 ຊ່ອງທີ່ **ພິມບໍ່ໄດ້** (readOnly) ກ່ອນ.
 * ② ຊ່ອງ readOnly ຫຼາຍອັນເປັນ `required` ⇒ ຍັງບໍ່ເລືອກບິນແລ້ວກົດບັນທຶກ browser ຈະບອກ
 *    "ກະລຸນາຕື່ມຊ່ອງນີ້" ໃສ່ຊ່ອງທີ່ພິມບໍ່ໄດ້ — ຕັນ ບໍ່ມີທາງອອກ.
 * ③ ປຸ່ມ "ບັນທຶກ" ຢູ່ເທິງສຸດ ກ່ອນມີຫຍັງໃຫ້ບັນທຶກ.
 * ④ **ສະຖານທີ່ຕິດຕັ້ງ** ຢູ່ທ້າຍສຸດ ແລະ ບໍ່ບັງຄັບ — ຂໍ້ມູນຈິງ: **146 ງານບໍ່ມີສະຖານທີ່**
 *    ⇒ ຊ່າງຖືກສົ່ງອອກໜ້າງານໂດຍບໍ່ຮູ້ວ່າໄປໃສ.
 *
 * ── ລຳດັບໃໝ່ (ຕາມສິ່ງທີ່ຄົນຕ້ອງເຮັດ) ──
 *   ① ຄົ້ນຫາບິນຂາຍ  → ບໍ່ມີບິນ = ເປີດງານບໍ່ໄດ້ ⇒ ຢູ່ເທິງສຸດ ແລະ ເປັນອັນດຽວທີ່ເຫັນຕອນເລີ່ມ
 *   ② ຂໍ້ມູນທີ່ ERP ຕື່ມໃຫ້ (ລູກຄ້າ · ບິນ · ສິນຄ້າ) → ສະຫຼຸບອ່ານຢ່າງດຽວ ບໍ່ແມ່ນຊ່ອງພິມ
 *   ③ ຂໍ້ມູນທີ່ **ຕ້ອງພິມເອງ** (Model · ປະເພດ · ຂະໜາດ · S/N) → ເນັ້ນໄວ້ຊັດ
 *   ④ ສະຖານທີ່ຕິດຕັ້ງ (**ບັງຄັບ**) + ໝາຍເຫດ
 *   ⑤ ບັນທຶກ (ລຸ່ມສຸດ · ກົດບໍ່ໄດ້ຈົນກວ່າຈະເລືອກບິນ)
 */

type Category = { code: string; name_1: string };

type Bill = {
  doc_date: string;
  doc_no: string;
  item_code: string;
  item_name: string;
  qty: string;
  cust_code: string | null;
  cust_name: string | null;
  telephone: string | null;
  address: string | null;
  sv_type: string;
  item_brand: string | null;
  doc_date_raw: string;
  pro_type: string | null;
  pro_type_name: string | null;
  pro_size: string | null;
  serials: { isn: string; sn: string; part: string }[];
};

const empty = {
  doc_no: "",
  billdate: "",
  item_code: "",
  item_name: "",
  sv_type: "",
  cust_code: "",
  custname: "",
  tel: "",
  address: "",
  pro_brand: "",
  /** ດຶງມາຈາກ ERP — CS ບໍ່ຕ້ອງພິມ (ແກ້ໄດ້ຖ້າຜິດ) */
  pro_type: "",
  pro_size: "",
  serials: [] as { isn: string; sn: string; part: string }[],
};

export function InstallForm({ categories, username }: { categories: Category[]; username: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createInstall, {});
  const [picked, setPicked] = useState(empty);
  const [open, setOpen] = useState(false);

  const chosen = picked.doc_no !== "";

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      {/* ① ບິນຂາຍ — ຈຸດເລີ່ມຕົ້ນ. ບໍ່ມີບິນ = ເປີດງານບໍ່ໄດ້ */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <Receipt className="size-4 text-teal-600" />
            ບິນຂາຍ
            {chosen && <CheckCircle2 className="size-4 text-emerald-600" />}
          </span>
        }
        actions={
          <Button type="button" tone={chosen ? "neutral" : "info"} onClick={() => setOpen(true)}>
            <Search className="size-4" /> {chosen ? "ປ່ຽນບິນ" : "ຄົ້ນຫາບີນຂາຍ"}
          </Button>
        }
      >
        {chosen ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="ບິນເລກທີ" value={picked.doc_no} />
            <Field label="ວັນທີອອກບິນ" value={picked.billdate} />
            <Field label="ລູກຄ້າ" value={`${picked.custname} (${picked.cust_code})`} />
            <Field label="ເບີໂທ" value={picked.tel} />
            <Field label="ທີ່ຢູ່ລູກຄ້າ" value={picked.address} />
            <Field label="ສິນຄ້າ" value={`${picked.item_name}${picked.pro_brand ? ` · ${picked.pro_brand}` : ""}`} />
          </dl>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-slate-500 transition hover:border-teal-400 hover:bg-teal-50/40"
          >
            <Search className="size-6" />
            <span className="text-sm font-semibold">ເລີ່ມຈາກຄົ້ນຫາບິນຂາຍ</span>
            <span className="text-xs">ຂໍ້ມູນລູກຄ້າ ແລະ ສິນຄ້າ ຈະຖືກຕື່ມໃຫ້ອັດຕະໂນມັດຈາກ ERP</span>
          </button>
        )}

        {/* ຄ່າທີ່ ERP ຕື່ມໃຫ້ — ສົ່ງໄປ server ໂດຍບໍ່ໃຫ້ຄົນແກ້ (ແກ້ໄດ້ = ຂໍ້ມູນຫຼົ້ນກັບ ERP) */}
        <input type="hidden" name="doc_no" value={picked.doc_no} />
        <input type="hidden" name="billdate" value={picked.billdate} />
        <input type="hidden" name="cust_code" value={picked.cust_code} />
        <input type="hidden" name="custname" value={picked.custname} />
        <input type="hidden" name="tel" value={picked.tel} />
        <input type="hidden" name="address" value={picked.address} />
        <input type="hidden" name="item_code" value={picked.item_code} />
        <input type="hidden" name="item_name" value={picked.item_name} />
        <input type="hidden" name="sv_type" value={picked.sv_type} />
        <input type="hidden" name="pro_brand" value={picked.pro_brand} />
      </Card>

      {/* ②-③ ສ່ວນທີ່ເຫຼືອຂຶ້ນກໍ່ຕໍ່ເມື່ອມີບິນແລ້ວ — ບໍ່ໃຫ້ຄົນພິມລົງຊ່ອງທີ່ຈະຖືກຂຽນທັບ */}
      {chosen && (
        <>
          <Card title="ຂໍ້ມູນສິນຄ້າ">
            <p className="mb-3 text-xs text-slate-500">
              ປະເພດ ແລະ ຂະໜາດ <b>ດຶງມາຈາກ ERP ແລ້ວ</b> — ແກ້ໄດ້ຖ້າຜິດ ·
              Model ກັບ S/N ຢູ່ຕົວເຄື່ອງ (ERP ບໍ່ມີ) ຈຶ່ງຕ້ອງເບິ່ງແລ້ວພິມ
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>ລຸ້ນ/Model *</label>
                <input name="pro_model" required autoFocus className={inputClass} />
                <p className="mt-1 truncate text-xs text-slate-400" title={picked.item_name}>
                  ຈາກຊື່ສິນຄ້າ: {picked.item_name}
                </p>
              </div>

              <div>
                <label className={labelClass}>S/N *</label>
                {picked.serials.length > 0 ? (
                  /**
                   * ບິນນີ້ມີ **ISN** ຢູ່ ERP ແລ້ວ (sn_trans_detail) ⇒ ໃຫ້ເລືອກ ບໍ່ໃຫ້ພິມ
                   * (ພິມເອງ = ພິມຜິດ ແລ້ວຜູກເຄື່ອງຜິດໜ່ວຍ). ຄ່າທີ່ເກັບ = ເລກໂຮງງານ
                   * ຖ້າ ERP ຈັບຄູ່ໄວ້ ບໍ່ດັ່ງນັ້ນເກັບ ISN.
                   */
                  <select name="pro_sn" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      ເລືອກ ISN ທີ່ຂາຍໃນບິນນີ້ ({picked.serials.length})
                    </option>
                    {picked.serials.map((serial) => (
                      <option key={serial.isn} value={serial.sn || serial.isn}>
                        {serial.part ? `${serial.part} · ` : ""}
                        {serial.isn}
                        {serial.sn ? ` · S/N ${serial.sn}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input name="pro_sn" required placeholder="ອ່ານຈາກປ້າຍຕົວເຄື່ອງ" className={inputClass} />
                )}
              </div>

              <div>
                <label className={labelClass}>ປະເພດ *</label>
                <SelectField
                  name="pro_type"
                  defaultValue={picked.pro_type}
                  options={categories.map((category) => ({ value: category.code, label: category.name_1 }))}
                />
              </div>

              <div>
                <label className={labelClass}>ຂະໜາດ *</label>
                <input name="pro_size" required defaultValue={picked.pro_size} className={inputClass} />
              </div>
            </div>
          </Card>

          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-teal-600" />
                ສະຖານທີ່ຕິດຕັ້ງ
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
                  defaultValue={picked.address}
                  placeholder="ບ້ານ / ເມືອງ / ຈຸດສັງເກດ"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">ຕື່ມມາຈາກທີ່ຢູ່ລູກຄ້າ — ແກ້ໄດ້ຖ້າຕິດຕັ້ງບ່ອນອື່ນ</p>
              </div>
              <div>
                {/**
                 * ວັນຄາດວ່າຈະເຂົ້າຕິດຕັ້ງ — ແຕ່ກ່ອນຕັ້ງໄດ້ຕອນ **ຈັດຊ່າງ** ເທົ່ານັ້ນ
                 * ⇒ ລູກຄ້າຖາມ "ມາມື້ໃດ" ຕັ້ງແຕ່ຕອນຊື້ ແຕ່ລະບົບບໍ່ມີບ່ອນເກັບ.
                 * ຕັ້ງແຕ່ຕອນເປີດງານໄດ້ເລີຍ (ບໍ່ບັງຄັບ — ຜູ້ຈັດຊ່າງແກ້ໄດ້ພາຍຫຼັງ).
                 */}
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

      {/* ⑤ ບັນທຶກ — ລຸ່ມສຸດ ຫຼັງຂໍ້ມູນຄົບ (ຂອງເກົ່າຢູ່ເທິງສຸດ ກ່ອນມີຫຍັງໃຫ້ບັນທຶກ) */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="text-xs text-slate-500">
          ຜູ້ສ້າງ: <b className="text-slate-700">{username}</b>
        </span>
        <div className="ml-auto flex gap-2">
          <LinkButton href="/installations" tone="neutral">
            ອອກ
          </LinkButton>
          <Button type="submit" tone="success" disabled={pending || !chosen}>
            <Save className="size-4" />
            {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
          </Button>
        </div>
      </div>

      {open && (
        <BillPicker
          onClose={() => setOpen(false)}
          onPick={(bill) => {
            setPicked({
              doc_no: bill.doc_no,
              billdate: bill.doc_date_raw,
              item_code: bill.item_code,
              item_name: bill.item_name,
              sv_type: bill.sv_type,
              cust_code: bill.cust_code ?? "",
              custname: bill.cust_name ?? "",
              tel: bill.telephone ?? "",
              address: bill.address ?? "",
              pro_brand: bill.item_brand ?? "",
              pro_type: bill.pro_type ?? "",
              pro_size: bill.pro_size ?? "",
              serials: bill.serials ?? [],
            });
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
 * ໜ້າຕ່າງຄົ້ນຫາບິນຂາຍ — **ບັດ ບໍ່ແມ່ນຕາຕະລາງ**.
 *
 * ຂອງເກົ່າເປັນຕາຕະລາງ 8 ຖັນ (minWidth 900) ⇒ ຕ້ອງເລື່ອນຂວາ ແລະ **ປຸ່ມ "ເລືອກ" ຖືກຕັດ**
 * ອອກນອກຈໍ — ຄົນເຫັນຂໍ້ມູນແຕ່ກົດເລືອກບໍ່ໄດ້. ຊື່ສິນຄ້າ ERP ຍາວ 60+ ຕົວ ຈຶ່ງບີບເປັນຖັນບໍ່ໄດ້.
 * ບັດແກ້ໄດ້ໝົດ: ຂໍ້ມູນຄົບ, ບໍ່ເລື່ອນຂວາ, ກົດບ່ອນໃດກໍ່ເລືອກໄດ້ (ບໍ່ຕ້ອງເລັງປຸ່ມ).
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
            ສະແດງສະເພາະບິນທີ່ມີ<b> ສິນຄ້າຕ້ອງຕິດຕັ້ງ</b> · ແອຂຶ້ນເປັນ [SET] ບໍ່ແຍກໜ່ວຍໃນ/ນອກ
          </p>
        </header>

        <div className="flex-1 space-y-2 overflow-auto p-4">
          {rows.map((bill, index) => (
            <button
              key={`${bill.doc_no}-${bill.item_code}-${index}`}
              type="button"
              onClick={() => onPick(bill)}
              className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{bill.doc_no}</span>
                <span className="text-xs text-slate-500">{bill.doc_date}</span>
                {Number(bill.qty) > 1 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    {Number(bill.qty)} ໜ່ວຍ
                  </span>
                )}
              </div>

              <p className="mt-1.5 text-sm font-semibold text-slate-800">{bill.item_name}</p>

              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <span>{bill.cust_name || "-"}</span>
                {bill.telephone && <span>{bill.telephone}</span>}
                {bill.address && <span className="text-slate-400">{bill.address}</span>}
              </div>
            </button>
          ))}

          {!loading && rows.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-400">ບໍ່ພົບບິນຂາຍທີ່ມີລາຍການຕິດຕັ້ງ</p>
          )}
        </div>
      </div>
    </div>
  );
}
