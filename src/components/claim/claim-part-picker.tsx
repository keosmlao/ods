"use client";
import { findInventory } from "@/app/actions/claim";
import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * **ເລືອກອາໄຫຼ່ທີ່ຂໍເຄມ ຈາກ ERP** — ບໍ່ພິມຊື່ເອງອີກ (31-07-2026 ຕາມຄຳສັ່ງ).
 *
 * ພິມຊື່ເອງ = ຊື່/ລະຫັດບໍ່ຕົງກັບ ERP ⇒ ໃບເຄມທີ່ສົ່ງໃຫ້ supplier ອ້າງອີງອາໄຫຼ່ບໍ່ໄດ້
 * ແລະ ຕອນປ່ຽນຈາກ stock ຫາຂອງບໍ່ພົບ. ດຽວນີ້ຄົ້ນຈາກ ic_inventory (actions/claim.findInventory)
 * ແລ້ວຕື່ມ **ລະຫັດ + ຊື່** ໃຫ້ພ້ອມກັນ.
 *
 * ⚠️ ຍັງເປີດໃຫ້ພິມເອງໄດ້ເມື່ອຫາບໍ່ພົບ (ອາໄຫຼ່ໃໝ່ທີ່ ERP ຍັງບໍ່ມີລະຫັດ) ແຕ່ຕ້ອງກົດເລືອກ
 * “ໃຊ້ຊື່ນີ້ (ບໍ່ມີໃນ ERP)” ຢ່າງຈົງໃຈ ⇒ ບໍ່ແມ່ນທາງລັດທີ່ເຮັດໂດຍບໍ່ຮູ້ຕົວ.
 */
type Item = { code: string; name: string; unit?: string | null; brand?: string | null };

export function ClaimPartPicker({
  field,
  defaultCode = "",
  defaultName = "",
}: {
  /** class ຂອງຊ່ອງ input ໃຫ້ຕົງກັບຟອມທີ່ຝັງມັນ */
  field: string;
  defaultCode?: string;
  defaultName?: string;
}) {
  const [code, setCode] = useState(defaultCode);
  const [name, setName] = useState(defaultName);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const keyword = q.trim();
    if (keyword.length < 2) return; // ລ້າງລາຍການຢູ່ onChange ແທນ (ຫ້າມ setState ໃນ effect)
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await findInventory(keyword);
      if (!alive) return;
      setRows(("items" in result ? result.items : undefined) ?? []);
      setLoading(false);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  const pick = (item: Item) => {
    setCode(item.code);
    setName(item.name);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="sm:col-span-2">
      {/* ຄ່າທີ່ສົ່ງໄປ server — ຕື່ມພ້ອມກັນຈາກ ERP */}
      <input type="hidden" name="claim_part_code" value={code} />
      <input type="hidden" name="claim_part_name" value={name} />

      {name ? (
        <div className={`${field} flex items-center justify-between gap-2`}>
          <span className="min-w-0 truncate">
            <b className="text-slate-800">{name}</b>
            {code && <span className="ml-2 text-xs text-slate-400">{code}</span>}
            {!code && <span className="ml-2 text-xs text-amber-600">(ບໍ່ມີໃນ ERP)</span>}
          </span>
          <button
            type="button"
            onClick={() => {
              setCode("");
              setName("");
              setOpen(true);
            }}
            className="shrink-0 text-slate-400 hover:text-red-600"
            aria-label="ປ່ຽນອາໄຫຼ່"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <label className={`${field} flex items-center gap-2`}>
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              value={q}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQ(event.target.value);
                if (event.target.value.trim().length < 2) setRows([]);
                setOpen(true);
              }}
              placeholder="ຄົ້ນອາໄຫຼ່ຈາກ ERP (ລະຫັດ ຫຼື ຊື່) *"
              /* ຍັງບໍ່ທັນເລືອກ ⇒ ບັນທຶກບໍ່ໄດ້ (ດ່ານຈິງຢູ່ actions/service ຄືເກົ່າ) */
              required
              className="w-full bg-transparent outline-none"
            />
            {loading && <LoaderCircle className="size-4 animate-spin text-slate-400" />}
          </label>

          {open && q.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {rows.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  onClick={() => pick(item)}
                  className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-violet-50"
                >
                  <b className="text-slate-800">{item.name}</b>
                  <span className="ml-2 text-xs text-slate-400">
                    {item.code}
                    {item.brand ? ` · ${item.brand}` : ""}
                    {item.unit ? ` · ${item.unit}` : ""}
                  </span>
                </button>
              ))}
              {!loading && rows.length === 0 && (
                <button
                  type="button"
                  onClick={() => pick({ code: "", name: q.trim(), unit: null, brand: null })}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"
                >
                  ບໍ່ພົບໃນ ERP — ໃຊ້ຊື່ “{q.trim()}” (ບໍ່ມີລະຫັດ)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
