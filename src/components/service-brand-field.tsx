"use client";
import { LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";

type Option = { code: string; name_1: string };

const field =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

/**
 * ຊ່ອງຫຍີ່ຫໍ້ + ປຸ່ມເພີ່ມຫຍີ່ຫໍ້ໃໝ່ — ຄື /showbrand + /save_newbrand ຂອງ ods
 * (tb_brand: code = name_1)
 */
export function BrandField({ brands, value, onChange }: { brands: Option[]; value: string; onChange: (value: string) => void }) {
  const [list, setList] = useState(brands);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const bname = name.trim();
    if (!bname) return;
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_1: bname }),
      });
      if (!res.ok) throw new Error("failed");
      const brand = (await res.json()) as { code: string };
      setList((old) => (old.some((x) => x.code === brand.code) ? old : [...old, { code: brand.code, name_1: brand.code }]));
      onChange(brand.code);
      setAdding(false);
      setName("");
    } catch {
      setError("ເພີ່ມຫຍີ່ຫໍ້ບໍ່ສຳເລັດ");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          name="pro_brand"
          required
          list="brand-list"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={field}
          placeholder="ເລືອກ ຫຼືພິມ"
        />
        <datalist id="brand-list">
          {list.map((x) => (
            <option key={x.code} value={x.code}>
              {x.name_1}
            </option>
          ))}
        </datalist>
        <button
          type="button"
          title="ເພີ່ມຫຍີ່ຫໍ້ໃໝ່"
          onClick={() => { setAdding((open) => !open); setName(value); }}
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-500 text-white transition hover:bg-sky-600"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {adding && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(); } }}
              placeholder="ຊື່ຫຍີ່ຫໍ້ໃໝ່"
              className={field}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => void save()}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              ບັນທຶກ
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
