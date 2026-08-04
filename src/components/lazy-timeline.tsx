"use client";

import { fetchInstallTimeline } from "@/app/actions/install-timeline";
import { fetchRepairTimeline } from "@/app/actions/repair-timeline";
import { JobTimeline } from "@/components/repair/job-timeline";
import type { TimelineStep } from "@/lib/repair-timeline";
import { useEffect, useRef, useState } from "react";

type TimelineData = { steps: TimelineStep[]; cancelledAt: string | null };

/**
 * Timeline ແບບ **ໂຫຼດຕອນກາງອອກ** — ໜ້າລາຍການມີຫຼາຍແຖວ ແຕ່ຄົນກາງເບິ່ງພຽງບາງແຖວ:
 * ບໍ່ຄວນຖາມ STAGE_SQL (query ໜັກ) ລ່ວງໜ້າທຸກແຖວຕອນ render ໜ້າ.
 * ກົດກາງ "↳ Timeline" ເມື່ອໃດ ຈຶ່ງດຶງຂໍ້ມູນແຖວນັ້ນ ແລ້ວສະແດງ.
 */
function useTimeline(workflow: "repair" | "install", code: string, loadOnMount: boolean) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  const load = () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    const action = workflow === "repair" ? fetchRepairTimeline : fetchInstallTimeline;
    action(code)
      .then(setData)
      .catch(() => setData({ steps: [], cancelledAt: null }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (loadOnMount) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOnMount]);

  const current =
    data?.steps.find((step) => step.state === "current")
    ?? [...(data?.steps ?? [])].reverse().find((step) => step.state === "done");

  return { data, loading, load, current };
}

/** ແຖວຕາຕະລາງ (desktop) — ຫຼຸດລົງເປັນ <tr> ທີ່ມີ details ຢູ່ຂ້າງໃນ. */
export function LazyTimelineRow({
  workflow,
  code,
  colSpan = 20,
  openOnMount = false,
}: {
  workflow: "repair" | "install";
  code: string;
  colSpan?: number;
  /** ກາງອອກໄວ້ແລ້ວ (ໜ້າຕິດຕັ້ງເກົ່າ) ⇒ ໂຫຼດທັນທີຫຼັງ render ໜ້າ */
  openOnMount?: boolean;
}) {
  const { data, loading, load, current } = useTimeline(workflow, code, openOnMount);
  return (
    <tr className="border-b border-dashed border-brand-100 bg-brand-50/20">
      <td colSpan={colSpan} className="px-10 py-2">
        <details open={openOnMount || undefined} onToggle={load}>
          <summary className="cursor-pointer select-none text-[11px] font-semibold text-brand-700">
            ↳ Timeline
            {loading && <span className="ml-2 font-normal text-slate-400">ກຳລັງໂຫຼດ…</span>}
            {current && <span className="ml-2 font-normal text-slate-500">ຂັ້ນປັດຈຸບັນ: {current.label}</span>}
          </summary>
          <div className="mt-3 w-full rounded-xl border border-brand-100 bg-white p-4">
            {data && data.steps.length > 0 ? (
              <JobTimeline steps={data.steps} cancelledAt={data.cancelledAt} bare horizontal />
            ) : (
              <p className="text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ timeline</p>
            )}
          </div>
        </details>
      </td>
    </tr>
  );
}

/** ບລັອກ details ສຳລັບ card ມືຖື — ໂຫຼດເມື່ອກາງອອກຄືກັນ. */
export function LazyTimelineBlock({
  workflow,
  code,
  className = "mt-2 rounded-lg border border-brand-100 bg-brand-50/30 p-2",
}: {
  workflow: "repair" | "install";
  code: string;
  className?: string;
}) {
  const { data, loading, load, current } = useTimeline(workflow, code, false);
  return (
    <details className={className} onToggle={load}>
      <summary className="cursor-pointer select-none text-[11px] font-semibold text-brand-700">
        ↳ Timeline
        {loading && <span className="ml-1 font-normal text-slate-400">ກຳລັງໂຫຼດ…</span>}
        {current && <span className="ml-1 font-normal text-slate-500">· {current.label}</span>}
      </summary>
      <div className="mt-3 rounded-lg bg-white p-3">
        {data && data.steps.length > 0 ? (
          <JobTimeline steps={data.steps} cancelledAt={data.cancelledAt} bare horizontal />
        ) : (
          <p className="text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ timeline</p>
        )}
      </div>
    </details>
  );
}
