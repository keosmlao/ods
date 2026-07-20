"use client";
import { scheduleRepairVisit } from "@/app/actions/repair";
import { useDict } from "@/lib/i18n/context";
import { CalendarPlus, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * IH ໄປສ້ອມບ້ານລູກຄ້າ — ນັດ "ໄປສ້ອມ ຮອບ 2" ຫຼັງລູກຄ້າຕົກລົງລາຄາ.
 * ຕັ້ງ repair_appoint_date (ແຍກຈາກ appoint_date ຮອບ 1 ໄປກວດ) ⇒ ບໍ່ທັບປະຫວັດວັນໄປກວດ.
 */
export function ScheduleRepairVisitButton({
  code,
  currentDate,
  location,
}: {
  code: string;
  currentDate: string | null;
  location: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(currentDate ?? "");
  const [place, setPlace] = useState(location ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useDict().scheduleRepairVisit;

  function submit() {
    setError("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("code", code);
      fd.set("appoint_date", date);
      fd.set("location_inst", place);
      const result = await scheduleRepairVisit({}, fd);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-white transition hover:bg-amber-600"
      >
        <CalendarPlus className="size-3.5" />
        {currentDate ? t.rescheduleLabel : t.scheduleLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-12 items-center bg-amber-500 px-5 text-sm font-bold text-white">{t.dialogTitle}</div>
            <div className="space-y-3 p-5 text-left">
              <p className="text-xs text-slate-500">{t.dialogHint}</p>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">{t.dateLabel}</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">{t.locationLabel}</span>
                <input
                  value={place}
                  onChange={(event) => setPlace(event.target.value)}
                  placeholder={t.locationPlaceholder}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500"
                />
              </label>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={submit}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {pending && <LoaderCircle className="size-4 animate-spin" />}
                  {t.save}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.exit}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
