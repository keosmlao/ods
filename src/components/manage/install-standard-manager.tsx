"use client";
import { addStandardLine, removeStandardLine, type StandardState } from "@/app/actions/install-standard";
import type { SpareRow } from "@/app/api/installations/spares/route";
import { LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

/**
 * ຕັ້ງ **ອາໄຫຼ່ມາດຕະຖານ** ຕໍ່ໝວດສິນຄ້າ (+ຂະໜາດ).
 *
 * ຂະໜາດຫວ່າງ = ໃຊ້ກັບທຸກຂະໜາດຂອງໝວດ · ໃສ່ຂະໜາດ = override ສະເພາະຂະໜາດນັ້ນ
 * (lib/install-standard ເລືອກແຖວທີ່ຂະໜາດຕົງກ່ອນສະເໝີ).
 */
export type StandardLine = {
  id: number;
  pro_type_code: string;
  pro_type_name: string | null;
  pro_size: string;
  item_code: string;
  item_name: string;
  unit_code: string | null;
  qty: number;
  updated_by: string | null;
  updated_at: string | null;
};

const inp = "h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500";

export function InstallStandardManager({
  categories,
  sizes,
  lines,
}: {
  categories: { code: string; name_1: string }[];
  /** ຂະໜາດທີ່ **ເຄີຍໃຊ້ຈິງ** ໃນໃບງານ (ods_tb_install.pro_size) — ບໍ່ແມ່ນລາຍການສົມມຸດ */
  sizes: string[];
  lines: StandardLine[];
}) {
  const router = useRouter();
  const [state, action, saving] = useActionState<StandardState, FormData>(addStandardLine, {});
  const [removing, startRemove] = useTransition();

  const [type, setType] = useState(categories[0]?.code ?? "");
  const [size, setSize] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SpareRow[]>([]);
  const [picked, setPicked] = useState<SpareRow | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const keyword = q.trim();
    if (keyword.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        // scope=standard ⇒ ບໍ່ຂຶ້ນກັບສະວິດ "ເບີກນອກມາດຕະຖານ" (ນີ້ຄືບ່ອນນິຍາມມາດຕະຖານເອງ)
        const body = await (
          await fetch(`/api/installations/spares?scope=standard&q=${encodeURIComponent(keyword)}`, {
            signal: controller.signal,
          })
        ).json();
        setRows(body.data ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setRows([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  /** ຈັດກຸ່ມຕາມ ໝວດ+ຂະໜາດ ⇒ ຄົນເບິ່ງເຫັນ "ຊຸດຂອງແອ 9000BTU" ເປັນກ້ອນ */
  const groups = new Map<string, StandardLine[]>();
  for (const line of lines) {
    const key = `${line.pro_type_code}|${line.pro_size}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  return (
    <div className="space-y-4">
      <form action={action} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">ເພີ່ມອາໄຫຼ່ເຂົ້າມາດຕະຖານ</p>
        <div className="grid gap-2 md:grid-cols-4">
          <select name="pro_type_code" value={type} onChange={(event) => setType(event.target.value)} className={inp}>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.name_1}
              </option>
            ))}
          </select>
          <input
            name="pro_size"
            list="install-standard-sizes"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            placeholder="ຂະໜາດ (ຫວ່າງ = ທຸກຂະໜາດ)"
            className={inp}
          />
          <datalist id="install-standard-sizes">
            {sizes.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <input name="qty" type="number" min="0.01" step="0.01" defaultValue="1" className={inp} placeholder="ຈຳນວນ" />
          <button
            disabled={saving || !picked}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            ເພີ່ມ
          </button>
        </div>

        <input type="hidden" name="item_code" value={picked?.code ?? ""} />
        <div className="mt-3">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              value={picked ? `${picked.code} · ${picked.name_1}` : q}
              onChange={(event) => {
                setPicked(null);
                setQ(event.target.value);
              }}
              placeholder="ຄົ້ນຫາອາໄຫຼ່ຈາກ ERP (ລະຫັດ ຫຼື ຊື່)..."
              className="w-full bg-transparent text-sm outline-none"
            />
            {searching && <LoaderCircle className="size-4 animate-spin text-slate-400" />}
          </label>
          {!picked && rows.length > 0 && (
            <div className="mt-1 max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {rows.map((row) => (
                <button
                  type="button"
                  key={row.code}
                  onClick={() => {
                    setPicked(row);
                    setRows([]);
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-teal-50"
                >
                  <b>{row.name_1}</b>
                  <span className="ml-2 text-xs text-slate-400">
                    {row.code} · {row.unit_code || "-"} · stock {row.balance_qty}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {state.error && <p className="mt-2 text-xs font-semibold text-rose-600">{state.error}</p>}
        {state.ok && <p className="mt-2 text-xs font-semibold text-emerald-600">{state.ok}</p>}
      </form>

      {groups.size === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
          ຍັງບໍ່ໄດ້ນິຍາມມາດຕະຖານ — ລະບົບຈະຕົກໄປໃຊ້ຊຸດສິນຄ້າຂອງ ERP ຄືເກົ່າ
        </p>
      ) : (
        [...groups.entries()].map(([key, group]) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-bold text-slate-700">
              {group[0].pro_type_name ?? group[0].pro_type_code}
              {group[0].pro_size ? (
                <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
                  ຂະໜາດ {group[0].pro_size}
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">ທຸກຂະໜາດ</span>
              )}
              <span className="ml-2 text-xs font-normal text-slate-400">{group.length} ລາຍການ</span>
            </p>
            <ul className="divide-y divide-slate-100">
              {group.map((line) => (
                <li key={line.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <b className="text-slate-800">{line.item_name}</b>
                    <span className="ml-2 text-xs text-slate-400">{line.item_code}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-600">
                    {line.qty.toLocaleString()} {line.unit_code || ""}
                  </span>
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() =>
                      startRemove(async () => {
                        await removeStandardLine(line.id);
                        router.refresh();
                      })
                    }
                    className="shrink-0 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
