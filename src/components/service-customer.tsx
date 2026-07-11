"use client";
import { createCustomer } from "@/app/actions/service";
import { Check, LoaderCircle, Search, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * code     = ລະຫັດຢູ່ ODS (ຫວ່າງ = ຍັງບໍ່ມີບັນຊີ ODS, ຈະສ້າງໃຫ້ຕອນບັນທຶກ)
 * ref_code = ລະຫັດດຽວກັນຢູ່ ERP
 * source   = ມາຈາກ ERP ຫຼື ODS
 */
export type Customer = {
  code: string;
  name_1: string;
  tel: string;
  address: string;
  ref_code: string;
  source?: "erp" | "ods";
};

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

/**
 * ເລືອກລູກຄ້າ — ຫຼືສ້າງໃໝ່ໄດ້ໃນບ່ອນນີ້ເລີຍ.
 * ods ບັງຄັບໃຫ້ລູກຄ້າມີໃນລະບົບກ່ອນ ພະນັກງານຈຶ່ງຕ້ອງອອກໄປສ້າງແລ້ວກັບມາເລີ່ມຟອມໃໝ່.
 *
 * ຟອມສ້າງລູກຄ້າວາງຢູ່ໃນ <form> ຂອງໃບຮັບເຄື່ອງ — HTML ຊ້ອນ form ບໍ່ໄດ້
 * ຈຶ່ງອ່ານຄ່າຜ່ານ ref ແລ້ວເອີ້ນ server action ເອງ ແທນທີ່ຈະ submit.
 */
/** ຜູ້ຊື້ເດີມຈາກບິນ — ເປັນຄຳແນະນຳ ບໍ່ແມ່ນຄຳຕອບ (ມີພຽງ ~26% ທີ່ເປັນຄົນດຽວກັນ) */
export type BuyerHint = { name: string; tel: string; ods: Customer | null };

export function ServiceCustomer({
  selected,
  onSelect,
  buyer = null,
}: {
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
  buyer?: BuyerHint | null;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const nameRef = useRef<HTMLInputElement>(null);
  const telRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  const searchable = !selected && q.trim().length >= 2;

  useEffect(() => {
    if (!searchable) return;
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/customers?q=${encodeURIComponent(q.trim())}`)
        .then((response) => response.json())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, searchable]);

  function pick(customer: Customer) {
    onSelect(customer);
    setResults([]);
    setQ("");
  }

  function saveNew() {
    const formData = new FormData();
    formData.set("name_1", nameRef.current?.value.trim() ?? "");
    formData.set("tel", telRef.current?.value.trim() ?? "");
    formData.set("address", addressRef.current?.value.trim() ?? "");

    startTransition(async () => {
      const result = await createCustomer({}, formData);
      if (result.error) {
        setError(result.error);
        // ເບີໂທຊ້ຳ → ເລືອກລູກຄ້າເກົ່າໃຫ້ເລີຍ ບໍ່ໃຫ້ສ້າງຊ້ຳ
        if (result.customer) { pick(result.customer); setCreating(false); setError(""); }
        return;
      }
      if (result.customer) { pick(result.customer); setCreating(false); setError(""); }
    });
  }

  if (selected) {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-slate-800">
              <Check className="size-4 shrink-0 text-teal-600" />
              {selected.name_1}
            </p>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-slate-400">ລະຫັດ</dt>
                <dd className="text-slate-700">{selected.ref_code || selected.code}</dd>
              </div>
              <div className="flex gap-2"><dt className="text-slate-400">ເບີໂທ</dt><dd className="text-slate-700">{selected.tel || "-"}</dd></div>
              <div className="flex gap-2 sm:col-span-2"><dt className="shrink-0 text-slate-400">ທີ່ຢູ່</dt><dd className="truncate text-slate-700">{selected.address || "-"}</dd></div>
            </dl>
          </div>
          <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-sm font-medium text-slate-500 hover:text-red-600">
            ປ່ຽນ
          </button>
        </div>
        <input type="hidden" name="cust_code" value={selected.code} />
        {/* ຖ້າຍັງບໍ່ມີບັນຊີ ODS ໃຫ້ສົ່ງຂໍ້ມູນ ERP ໄປ ເພື່ອ copy ເຂົ້າ ar_customer ຕອນບັນທຶກ */}
        <input type="hidden" name="cust_ref" value={selected.ref_code} />
        <input type="hidden" name="cust_name" value={selected.name_1} />
        <input type="hidden" name="cust_tel" value={selected.tel} />
        <input type="hidden" name="cust_address" value={selected.address} />
      </div>
    );
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">ລູກຄ້າໃໝ່</p>
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <input ref={nameRef} placeholder="ຊື່ລູກຄ້າ *" className={field} />
          <input ref={telRef} placeholder="ເບີໂທ *" inputMode="tel" className={field} />
          <input ref={addressRef} placeholder="ທີ່ຢູ່" className={field} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveNew}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            ບັນທຶກລູກຄ້າ
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setError(""); }}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="size-4" />
            ຍົກເລີກ
          </button>
        </div>
        <input type="hidden" name="cust_code" value="" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ຜູ້ຊື້ເດີມຈາກບິນ — ກົດຮັບໄດ້ເທື່ອດຽວ ຖ້າແມ່ນຄົນດຽວກັນ */}
      {buyer && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">ຜູ້ຊື້ເດີມ (ຈາກບິນ)</p>
            <p className="truncate text-sm font-medium text-slate-800">{buyer.name}</p>
            {buyer.tel && <p className="truncate text-xs text-slate-500">{buyer.tel}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              if (buyer.ods) { pick(buyer.ods); return; }
              // ຜູ້ຊື້ຍັງບໍ່ມີໃນລະບົບສ້ອມ → ເປີດຟອມສ້າງໃໝ່ ພ້ອມຕື່ມຊື່/ເບີໃຫ້
              setCreating(true);
              setTimeout(() => {
                if (nameRef.current) nameRef.current.value = buyer.name;
                if (telRef.current) telRef.current.value = buyer.tel.split(",")[0].trim();
              }, 0);
            }}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ແມ່ນຄົນນີ້
          </button>
        </div>
      )}

      <div className="relative">
      <div className="flex gap-2">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-teal-500">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="ຄົ້ນຫາລູກຄ້າ ດ້ວຍ ຊື່, ເບີໂທ ຫຼືລະຫັດ"
            className="w-full text-sm outline-none"
          />
          {searching && <LoaderCircle className="size-4 shrink-0 animate-spin text-slate-400" />}
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <UserPlus className="size-4" />
          ລູກຄ້າໃໝ່
        </button>
      </div>

      {searchable && !searching && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {results.length === 0 ? (
            <div className="p-3 text-center text-sm text-slate-500">
              ບໍ່ພົບລູກຄ້າ
              <button type="button" onClick={() => setCreating(true)} className="ml-2 font-semibold text-teal-600 hover:underline">
                ສ້າງໃໝ່
              </button>
            </div>
          ) : (
            results.map((customer) => (
              <button
                type="button"
                key={customer.code}
                onClick={() => pick(customer)}
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-teal-50"
              >
                <b className="text-slate-800">{customer.name_1}</b>
                <span className="block text-xs text-slate-400">
                  {customer.ref_code} · {customer.tel || "ບໍ່ມີເບີໂທ"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <input type="hidden" name="cust_code" value="" />
      </div>
    </div>
  );
}
