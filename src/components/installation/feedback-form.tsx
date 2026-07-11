"use client";
import { saveFeedback, type ActionState } from "@/app/actions/installation";
import { useActionState } from "react";

/** ຖອດແບບຈາກ ods: feedback2.html / feedback3.html + /save_cust_complain_new */

export type Topic = { line_number: number; name_1: string };

export function FeedbackForm({ code, topics }: { code: string; topics: Topic[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveFeedback, {});

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="code" value={code} />

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{state.error}</p>
      )}

      {topics.map((topic) => (
        <fieldset key={topic.line_number} className="border-b border-slate-100 pb-5">
          <legend className="mb-3 text-sm font-semibold text-slate-700">{topic.name_1}</legend>
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-xs text-slate-500">ງ່າຍຫຼາຍ</span>
            <div className="flex flex-1 items-center justify-center gap-5">
              {[1, 2, 3, 4].map((point) => (
                <label key={point} className="flex cursor-pointer flex-col items-center gap-1">
                  <span className="text-xs text-slate-400">{point}</span>
                  <input
                    type="radio"
                    required
                    name={`points_${topic.line_number}`}
                    value={point}
                    className="size-5 accent-teal-600"
                  />
                </label>
              ))}
            </div>
            <span className="shrink-0 text-xs text-slate-500">ຍາກຫຼາຍ</span>
          </div>
        </fieldset>
      ))}

      <div>
        <label htmlFor="cust_complain" className="mb-2 block text-sm font-semibold text-slate-700">
          ຄຳເຫັນອື່ນໆ
        </label>
        <textarea
          id="cust_complain"
          name="cust_complain"
          rows={3}
          placeholder="ຂໍ້ຄວາມຄຳຕອບແບບຍາວ..."
          className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-teal-500"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-[#0069D9] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທືກ"}
      </button>
    </form>
  );
}
