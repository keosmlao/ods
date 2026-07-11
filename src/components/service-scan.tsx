"use client";
import type { Customer } from "@/components/service-customer";
import { AlertTriangle, Check, LoaderCircle, PencilLine, ScanLine, Search, X } from "lucide-react";
import { useRef, useState } from "react";

/** ຜົນຂອງການຍິງບາໂຄດ — ຄ່າທີ່ຈະຕື່ມໃສ່ຟອມ */
export type ScanResult = {
  sn: string;
  product: string;
  brand: string;
  model: string;
  /** ລະຫັດ tb_type ທີ່ແປງມາຈາກໝວດ ERP */
  productType: string;
  billNo: string;
  billDate: string;
  /** ຜູ້ຊື້ເດີມຈາກບິນ — ເປັນຄຳແນະນຳເທົ່ານັ້ນ, ສ່ວນຫຼາຍເປັນຮ້ານຄ້າ ບໍ່ແມ່ນຄົນທີ່ເອົາເຄື່ອງມາ */
  buyer: { erpCode: string; name: string; tel: string; ods: Customer | null } | null;
};

type Api = { found: false } | ({ found: true } & ScanResult);

const WARRANTY_MONTHS = 12;

function monthsSince(date: string) {
  if (!date) return null;
  const bought = new Date(date);
  if (Number.isNaN(bought.getTime())) return null;
  const months = (Date.now() - bought.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return months < 0 ? null : Math.floor(months);
}

/** ຂໍ້ມູນນຶ່ງຊ່ອງໃນບັດຜົນການຍິງ */
function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[10px] text-slate-400">{label}</dt>
      <dd className={`mt-0.5 truncate text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`} title={value ?? ""}>
        {value || "-"}
      </dd>
    </div>
  );
}

/**
 * ຂັ້ນທຳອິດຂອງການຮັບເຄື່ອງ: ຍິງບາໂຄດ.
 * ຍິງເທື່ອດຽວໄດ້ ສິນຄ້າ / ຍີ່ຫໍ້ / Model / ບິນ / ວັນທີ → ຄຳນວນການຮັບປະກັນໄດ້ເລີຍ.
 * ຍິງບໍ່ໄດ້ ຫຼືບໍ່ພົບ → ກົດ "ປ້ອນເອງ" ໄປໃຊ້ຟອມເຕັມ.
 */
export function ServiceScan({
  types,
  onResolved,
  onManual,
}: {
  types: { code: string; name_1: string }[];
  onResolved: (result: ScanResult) => void;
  onManual: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [notFound, setNotFound] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function scan() {
    const value = code.trim();
    if (value.length < 3) return;
    setBusy(true);
    setNotFound("");
    try {
      const response = await fetch(`/api/scan?code=${encodeURIComponent(value)}`);
      const data: Api = await response.json();
      if (!data.found) {
        setNotFound(value);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setNotFound(value);
    } finally {
      setBusy(false);
      inputRef.current?.select();
    }
  }

  const months = result ? monthsSince(result.billDate) : null;
  const inWarranty = months !== null && months <= WARRANTY_MONTHS;

  return (
    <div className="w-full space-y-4">
      {/* ຍິງບາໂຄດ (ຊ້າຍ) + ຄຳແນະນຳ (ຂວາ) — ໃຊ້ພື້ນທີ່ຈໍເຕັມ ບໍ່ບີບໃຫ້ແຄບ */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-teal-600">
              <ScanLine className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">ຍິງບາໂຄດຂອງເຄື່ອງ</h2>
              <p className="text-xs text-slate-500">ຍິງປ້າຍ ISN ຫຼື Serial Number — ຫຼືພິມໃສ່ກໍໄດ້</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  scan();
                }
              }}
              placeholder="ຍິງ ຫຼືພິມເລກເຄື່ອງ..."
              className="h-14 flex-1 rounded-xl border-2 border-slate-300 px-4 font-mono text-lg tracking-wider outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={scan}
              disabled={busy || code.trim().length < 3}
              className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-8 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
              ຄົ້ນຫາ
            </button>
          </div>

          {notFound && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-start gap-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  ບໍ່ພົບເລກ <b className="font-mono">{notFound}</b> ໃນລະບົບ — ອາດເປັນເຄື່ອງທີ່ບໍ່ໄດ້ຊື້ຈາກໂອດ້ຽນ
                </span>
              </p>
              <button
                type="button"
                onClick={onManual}
                className="mt-2.5 inline-flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <PencilLine className="size-3.5" />
                ປ້ອນຂໍ້ມູນເອງ
              </button>
            </div>
          )}
        </section>

        {/* ຄຳແນະນຳ + ທາງລັດປ້ອນເອງ */}
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-600">ຂັ້ນຕອນການຮັບເຄື່ອງ</h3>
            <ol className="mt-3 space-y-2.5">
              {[
                "ຍິງບາໂຄດ — ລະບົບດຶງ ສິນຄ້າ, ຫຍີ່ຫໍ້, Model, ບິນ ໃຫ້ເອງ ແລະ ຄິດການຮັບປະກັນໃຫ້",
                "ເລືອກລູກຄ້າທີ່ເອົາເຄື່ອງມາ (ສ້າງໃໝ່ໄດ້ທັນທີ)",
                "ປ້ອນອາການເສຍ, ຖ່າຍຮູບ, ມອບໝາຍຊ່າງ ແລ້ວບັນທຶກ + ພິມໃບຮັບເຄື່ອງ",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5 text-xs text-slate-600">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-700">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={onManual}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <PencilLine className="size-4" />
            ບໍ່ມີບາໂຄດ / ບໍ່ໄດ້ຊື້ຈາກໂອດ້ຽນ — ປ້ອນເອງ
          </button>
        </section>
      </div>

      {/* ຜົນການຍິງ — ກວ້າງເຕັມແຖວ */}
      {result && (
        <section className="overflow-hidden rounded-xl border-2 border-teal-500 bg-white shadow-sm">
          <header className="flex flex-wrap items-center gap-2 bg-teal-600 px-5 py-2.5 text-white">
            <Check className="size-4" />
            <h3 className="text-sm font-bold">ພົບເຄື່ອງແລ້ວ</h3>
            <span className="ml-auto font-mono text-xs opacity-90">{result.sn}</span>
          </header>

          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-lg font-bold text-slate-800">{result.product}</p>

              {months !== null ? (
                <p
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    inWarranty ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {inWarranty ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
                  ຊື້ມາແລ້ວ {months} ເດືອນ · {inWarranty ? "ຢູ່ໃນປະກັນ" : "ໝົດປະກັນ"}
                </p>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                  ບໍ່ພົບບິນຂາຍ — ຕ້ອງເລືອກການຮັບປະກັນເອງ
                </p>
              )}
            </div>

            <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Field label="ຫຍີ່ຫໍ້" value={result.brand} />
              <Field label="Model" value={result.model} />
              <Field label="ປະເພດ" value={types.find((type) => type.code === result.productType)?.name_1 ?? null} />
              <Field label="ເລກບິນ" value={result.billNo} mono />
              <Field label="ວັນທີບິນ" value={result.billDate} />
            </dl>

            {result.buyer && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-semibold text-slate-500">ຜູ້ຊື້ເດີມ (ຈາກບິນ)</span>
                <span className="text-xs font-medium text-slate-800">{result.buyer.name || result.buyer.erpCode}</span>
                {result.buyer.tel && <span className="text-xs text-slate-500">{result.buyer.tel}</span>}
                <span className="text-[10px] text-slate-400">
                  {result.buyer.ods
                    ? "ຖ້າຄົນທີ່ເອົາເຄື່ອງມາແມ່ນຄົນນີ້ ຈະເລືອກໃຫ້ໃນຂັ້ນຕໍ່ໄປ"
                    : "ຜູ້ຊື້ນີ້ຍັງບໍ່ມີໃນລະບົບສ້ອມ — ຈະໃຫ້ເລືອກ ຫຼືສ້າງລູກຄ້າໃນຂັ້ນຕໍ່ໄປ"}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => onResolved(result)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-semibold text-white transition hover:bg-emerald-700"
              >
                <Check className="size-5" />
                ຖືກຕ້ອງ — ດຳເນີນຕໍ່
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setCode("");
                  inputRef.current?.focus();
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-medium text-slate-600 hover:bg-slate-50"
              >
                <X className="size-4" />
                ຍິງໃໝ່
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
