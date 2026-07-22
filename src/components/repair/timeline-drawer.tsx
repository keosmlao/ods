"use client";
import { fetchRepairTimeline } from "@/app/actions/repair-timeline";
import { JobTimeline } from "@/components/repair/job-timeline";
import type { TimelineStep } from "@/lib/repair-timeline";
import { Clock, LoaderCircle, X } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມ 🕐 ຕໍ່ແຖວ list ງານສ້ອມ → ເປີດ drawer ສະແດງ **timeline** ຂອງງານນັ້ນ (lazy-load)
 * ໂດຍບໍ່ອອກຈາກໜ້າ list. ຢູ່ໃນ RowLink ⇒ stopPropagation ກັນບໍ່ໃຫ້ເດັ້ງໄປໜ້າ detail.
 */
export function TimelineDrawerButton({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ steps: TimelineStep[]; cancelledAt: string | null } | null>(null);
  const [pending, start] = useTransition();

  const openDrawer = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
    if (!data) start(async () => setData(await fetchRepairTimeline(code)));
  };
  const close = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); setOpen(false); };

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        title="ເສັ້ນເວລາ (timeline)"
        className="ml-1.5 inline-flex size-6 items-center justify-center rounded align-middle text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <Clock className="size-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={close}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-slate-50 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">ເສັ້ນເວລາ · {code}</h2>
              <button type="button" onClick={close} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200">
                <X className="size-4" />
              </button>
            </div>
            {pending || !data ? (
              <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <LoaderCircle className="size-4 animate-spin" /> ກຳລັງໂຫຼດ...
              </p>
            ) : (
              <JobTimeline steps={data.steps} cancelledAt={data.cancelledAt} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
