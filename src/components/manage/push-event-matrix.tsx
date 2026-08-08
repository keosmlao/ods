"use client";
import { setPushEvent } from "@/app/actions/push-recipient";
import { PUSH_EVENT_KINDS, PUSH_MODELS, pushEventKey, pushEventOn } from "@/lib/push-event-shared";
import { Info, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ຍິງອັນໃດເຂົ້າແອັບ** — ຕາຕະລາງ ປະເພດງານ × ປະເພດເຫດການ.
 * ຕິດ = ມືຖືສັ່ນ · ບໍ່ຕິດ = ມືຖືງຽບ ແຕ່ **ກ່ອງແຈ້ງເຕືອນຍັງເຫັນຄົບ** (ອະທິບາຍໄວ້ໃນບັດ).
 */
export function PushEventMatrix({ disabled }: { disabled: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const off = new Set(disabled);

  const toggle = (model: string, kind: string, on: boolean) =>
    start(async () => {
      setErr("");
      const result = await setPushEvent(model, kind, on);
      if (result.error) {
        setErr(result.error);
        return;
      }
      router.refresh();
    });

  const boxes = PUSH_MODELS.length * PUSH_EVENT_KINDS.length;
  const openCount = boxes - off.size;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <Smartphone className="size-4 text-brand-700" /> ຍິງອັນໃດເຂົ້າແອັບ
        </p>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
          ເປີດ {openCount}/{boxes}
        </span>
      </div>

      <p className="mt-1.5 flex gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        <span>
          ຕິດ = ມືຖືສັ່ນເມື່ອມີການເຄື່ອນໄຫວນັ້ນ. ບໍ່ຕິດ = ມືຖືງຽບ ແຕ່{" "}
          <b className="text-slate-700">ກ່ອງແຈ້ງເຕືອນຢູ່ເວັບ ແລະ ໃນແອັບຍັງເຫັນຄົບທຸກແຖວ</b> —
          ປິດແຕ່ສຽງເອີ້ນ ບໍ່ໄດ້ປິດປະຫວັດ.
        </span>
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">ປະເພດງານ</th>
              {PUSH_EVENT_KINDS.map((column) => (
                <th key={column.kind} className="px-2 py-2 text-center font-semibold" title={column.help}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PUSH_MODELS.map((row) => (
              <tr key={row.model}>
                <td className="px-2 py-2 font-medium text-slate-800">{row.label}</td>
                {PUSH_EVENT_KINDS.map((column) => {
                  const on = pushEventOn(off, row.model, column.kind);
                  return (
                    <td key={pushEventKey(row.model, column.kind)} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-700"
                        disabled={pending}
                        checked={on}
                        onChange={(event) => toggle(row.model, column.kind, event.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
    </div>
  );
}
