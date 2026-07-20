"use client";
import { cancelActivity, completeActivity } from "@/app/actions/chatter";
import { useConfirm } from "@/components/confirm-dialog";
import { LinkPending } from "@/components/link-pending";
import {
  ACTIVITY_KIND_LABEL,
  activityTone,
  MODEL_LABEL,
  recordHref,
  type Activity,
  type ChatterModel,
} from "@/lib/chatter";
import { useDict } from "@/lib/i18n/context";
import { Check, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * ແຖວກິດຈະກຳໃນໜ້າ "ກິດຈະກຳຂອງຂ້ອຍ".
 * ຄືກັບແຖວໃນ Chatter ແຕ່ເພີ່ມລິ້ງກັບໄປຫາເອກະສານຕົ້ນທາງ (recordHref).
 */
export function ActivityRow({ activity, showOwner }: { activity: Activity; showOwner?: boolean }) {
  const t = useDict().activityRow;
  const [pending, start] = useTransition();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const { ask, dialog } = useConfirm();

  const tone = activityTone(activity.days_left);
  const href = recordHref(activity.model, activity.res_id);
  const label = MODEL_LABEL[activity.model as ChatterModel] ?? activity.model;

  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-slate-50">
      {dialog}
      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800">{activity.summary}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
          <span>{ACTIVITY_KIND_LABEL[activity.kind]}</span>
          {showOwner && <span>· {t.assignedTo} {activity.assigned_to}</span>}
          <span>· {t.due} {activity.due_date}</span>
          {activity.note && <span className="truncate">· {activity.note}</span>}
        </p>
      </div>

      {href === "#" ? (
        <span className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {label} {activity.res_id}
        </span>
      ) : (
        <Link
          href={href}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-[#0536a9] hover:bg-slate-200"
        >
          {label} {activity.res_id}
          <LinkPending className="size-2.5" />
        </Link>
      )}

      <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
        {activity.days_left < 0 ? `${t.overdue} ${-activity.days_left} ${t.days}` : tone.label}
      </span>

      {noting ? (
        <span className="flex w-full items-center gap-1.5 sm:w-auto">
          <input
            autoFocus
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t.resultPlaceholder}
            className="h-7 flex-1 rounded border border-slate-300 px-2 text-[11px] outline-none focus:border-teal-500 sm:w-44"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => void completeActivity(activity.id, note))}
            className="inline-flex h-7 items-center gap-1 rounded bg-emerald-600 px-2 text-[11px] font-semibold text-white disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}
            {t.done}
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <button
            type="button"
            title={t.markDone}
            disabled={pending}
            onClick={() => setNoting(true)}
            className="grid size-7 place-items-center rounded text-emerald-600 transition hover:bg-emerald-50"
          >
            <Check className="size-4" />
          </button>
          <button
            type="button"
            title={t.cancelActivity}
            disabled={pending}
            onClick={async () => {
              const ok = await ask({
                title: t.cancelActivityConfirm,
                message: <b className="text-slate-700">{activity.summary}</b>,
                confirmLabel: t.cancelActivity,
                cancelLabel: t.no,
                tone: "danger",
              });
              if (!ok) return;
              start(() => void cancelActivity(activity.id));
            }}
            className="grid size-7 place-items-center rounded text-[#DE3163] transition hover:bg-red-50"
          >
            <X className="size-4" />
          </button>
        </span>
      )}
    </li>
  );
}
