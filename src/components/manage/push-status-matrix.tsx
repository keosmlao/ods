"use client";
import { resetPushStatus, setPushStatus } from "@/app/actions/push-recipient";
import {
  PUSH_STATUS_DEFAULT,
  PUSH_STATUS_ROLES,
  PUSH_WORKFLOWS,
  pushStatusKey,
  pushStatusOn,
} from "@/lib/push-status-shared";
import { Info, ListChecks, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ສະຖານະໃດ ຄວນແຈ້ງໃຜ** — ຕາຕະລາງ ຂັ້ນ × ສິດ ແຍກຕາມສາຍງານ.
 * ຄ່າຕັ້ງຕົ້ນມາຈາກໂຄ້ດ (PUSH_STATUS_DEFAULT) ⇒ ແຖວທີ່ຍັງບໍ່ເຄີຍແຕະກໍ່ມີຄ່າຢູ່ແລ້ວ.
 */
export function PushStatusMatrix({ overrides }: { overrides: Record<string, boolean> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const map = new Map(Object.entries(overrides));

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr("");
      const result = await fn();
      if (result.error) {
        setErr(result.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
        <ListChecks className="size-4 text-brand-700" /> ສະຖານະໃດ ຄວນແຈ້ງໃຜ
      </p>
      <p className="mt-1.5 flex gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        <span>
          ເມື່ອໃບງານຍ້າຍເຂົ້າຂັ້ນນຶ່ງ ຈະຍິງໃສ່ສະເພາະສິດທີ່ຕິດໄວ້ໃນແຖວນັ້ນ.{" "}
          <b className="text-slate-700">ຊ່າງເຈົ້າຂອງໃບ ແລະ ຄົນທີ່ຕິດຕາມໃບ ໄດ້ຮັບສະເໝີ</b> ບໍ່ຂຶ້ນກັບຕາຕະລາງນີ້
          ⇒ ຖັນ “ຊ່າງ” ໝາຍເຖິງ <b className="text-brand-orange-700">ຊ່າງທຸກຄົນ (26 ຄົນ)</b> —
          ຕິດເມື່ອຢາກໃຫ້ໝົດທີມຮູ້ພ້ອມກັນ. ຂັ້ນ “ກຳລັງເຮັດຢູ່” ຕັ້ງຕົ້ນບໍ່ແຈ້ງໃຜ ເພາະເປັນວຽກຂອງຊ່າງທີ່ຮັບໄປແລ້ວ ·
          ກ່ອງແຈ້ງເຕືອນຢູ່ເວັບ/ໃນແອັບຍັງເຫັນຄົບທຸກແຖວ.
        </span>
      </p>

      {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}

      <div className="mt-3 space-y-4">
        {PUSH_WORKFLOWS.map((flow) => {
          const touched = flow.stages.some((row) =>
            PUSH_STATUS_ROLES.some((column) => map.has(pushStatusKey(flow.workflow, row.stage, column.role))),
          );
          return (
            <div key={flow.workflow}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600">{flow.label}</p>
                {touched && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => resetPushStatus(flow.workflow))}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <RotateCcw className="size-3" /> ຄືນຄ່າຕັ້ງຕົ້ນ
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">ຂັ້ນ</th>
                      {PUSH_STATUS_ROLES.map((column) => (
                        <th key={column.role} className="px-3 py-2 text-center font-semibold">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {flow.stages.map((row) => (
                      <tr key={row.stage} className={row.stage < 0 ? "bg-brand-orange-50/40" : ""}>
                        <td className="px-3 py-2 text-slate-800">{row.label}</td>
                        {PUSH_STATUS_ROLES.map((column) => {
                          const key = pushStatusKey(flow.workflow, row.stage, column.role);
                          const on = pushStatusOn(map, flow.workflow, row.stage, column.role);
                          /* ຕ່າງຈາກຄ່າຕັ້ງຕົ້ນ ⇒ ໝາຍໄວ້ ໃຫ້ຮູ້ວ່າອັນນີ້ຄົນຕັ້ງເອງ */
                          const changed = map.has(key) && on !== PUSH_STATUS_DEFAULT.has(key);
                          return (
                            <td key={key} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                className={`size-4 accent-brand-700 ${changed ? "ring-2 ring-brand-orange-400 ring-offset-1" : ""}`}
                                disabled={pending}
                                checked={on}
                                onChange={(event) =>
                                  act(() =>
                                    setPushStatus(flow.workflow, row.stage, column.role, event.target.checked),
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
