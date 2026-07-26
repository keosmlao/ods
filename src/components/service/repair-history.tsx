"use client";
import { repairHistoryBySn, type RepairHistoryItem } from "@/app/actions/repair-history";
import { History, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * ປະຫວັດການສ້ອມຂອງ SN ນີ້ — ດຶງອັດຕະໂນມັດເມື່ອຊ່າງ/CS ໃສ່ SN ຢູ່ຟອມເປີດງານໃໝ່.
 *
 * `currentCode` = ລະຫັດໃບປັດຈຸບັນ (ຕອນແກ້ໄຂ) — ຕັດອອກຈາກລາຍການ ບໍ່ໃຫ້ໂຊ້ໃບຕົນເອງເປັນປະຫວັດ.
 * debounce 500ms ⇒ ບໍ່ຍິງທຸກຕົວອັກສອນທີ່ພິມ.
 */
export function RepairHistory({ sn, currentCode }: { sn: string; currentCode?: string }) {
  const [items, setItems] = useState<RepairHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const value = sn.trim();
    // SN ສັ້ນເກີນ ⇒ ບໍ່ຕ້ອງ fetch. ບໍ່ຕ້ອງ setItems([]) ຢູ່ນີ້ (render ຄືນ null ຢູ່ແລ້ວ
    // ຕອນ <4) — setState ກາງ effect body ເປັນ anti-pattern (cascading render).
    if (value.length < 4) return;
    let alive = true;
    // ໂຊ້ spinner **ຕອນ fetch ເລີ່ມ** (ໃນ callback, ບໍ່ແມ່ນ effect body) — ຫຼີກ setState-in-effect
    // ແລະ ບໍ່ກະພິບຕອນພິມ (ລໍ debounce 500ms ກ່ອນ).
    const timer = setTimeout(async () => {
      if (alive) setLoading(true);
      try {
        const rows = await repairHistoryBySn(value);
        if (alive) setItems(rows.filter((r) => r.code !== currentCode));
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sn, currentCode]);

  if (sn.trim().length < 4) return null;
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Loader2 className="size-4 animate-spin" /> ກຳລັງກວດປະຫວັດການສ້ອມຂອງ SN ນີ້...
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800">
        <History className="size-4" />
        ເຄື່ອງໜ່ວຍນີ້ເຄີຍສ້ອມມາແລ້ວ {items.length} ຄັ້ງ
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.code}
            href={`/service/${item.code}`}
            target="_blank"
            className="block rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs transition hover:border-amber-400 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-bold text-[#0536a9]">#{item.code}</span>
              <span className="text-slate-400">ຮັບ {item.received ?? "-"}</span>
              {item.returned ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">ສົ່ງຄືນ {item.returned}</span>
              ) : (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">{item.stage ?? "ຍັງບໍ່ຈົບ"}</span>
              )}
              {item.warranty && <span className="text-slate-400">· {item.warranty}</span>}
              {item.tech && <span className="text-slate-400">· ຊ່າງ {item.tech}</span>}
            </div>
            {(item.symptom || item.diagnosis) && (
              <p className="mt-1 text-slate-600">
                {item.symptom && <span><b className="text-slate-500">ອາການ:</b> {item.symptom}</span>}
                {item.diagnosis && <span className="ml-2"><b className="text-slate-500">ວິເຄາະ:</b> {item.diagnosis}</span>}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
