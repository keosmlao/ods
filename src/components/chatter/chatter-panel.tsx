"use client";
import {
  cancelActivity,
  completeActivity,
  postMessage,
  scheduleActivity,
  toggleFollow,
} from "@/app/actions/chatter";
import { useConfirm } from "@/components/confirm-dialog";
import { SelectField } from "@/components/select-field";
import { ACTIVITY_KIND_LABEL, activityTone, type Activity, type ChatterMessage } from "@/lib/chatter";
import { useDict } from "@/lib/i18n/context";
import { Bell, BellOff, Check, Clock, LoaderCircle, MessageSquare, Plus, Send, Users, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

/** Chatter ແບບ Odoo — ຂໍ້ຄວາມ · ປະຫວັດ (log) · ກິດຈະກຳ · ຜູ້ຕິດຕາມ */

type Option = { value: string; label: string };
type Dict = ReturnType<typeof useDict>["chatterPanel"];

/** ຕົວອັກສອນຫຍໍ້ຂອງຜູ້ຂຽນ — ໃຊ້ແທນຮູບໂປຣໄຟລ໌ (ບໍ່ໂຫຼດຮູບ ຈຶ່ງບໍ່ຊ້າ) */
function Avatar({ name, system }: { name: string; system?: boolean }) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
        system ? "bg-slate-100 text-slate-500" : "bg-teal-600 text-white"
      }`}
    >
      {name.slice(0, 2)}
    </span>
  );
}

function ActivityRow({ activity, t }: { activity: Activity; t: Dict }) {
  const [pending, start] = useTransition();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const { ask, dialog } = useConfirm();
  const tone = activityTone(activity.days_left);

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {dialog}
      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800">{activity.summary}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
          <span>{ACTIVITY_KIND_LABEL[activity.kind]}</span>
          <span>· {t.assignedTo} {activity.assigned_to}</span>
          <span>· {t.due} {activity.due_date}</span>
          {activity.note && <span className="truncate">· {activity.note}</span>}
        </p>
      </div>

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
            className="inline-flex h-7 items-center gap-1 rounded bg-emerald-600 px-2 text-[11px] font-semibold text-white"
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

function ScheduleForm({
  model,
  resId,
  people,
  me,
  onDone,
  t,
}: {
  model: string;
  resId: string;
  people: Option[];
  me: string;
  onDone: () => void;
  t: Dict;
}) {
  const [state, action, pending] = useActionState(scheduleActivity, {});
  const [kind, setKind] = useState("todo");
  const [assignee, setAssignee] = useState(me);
  // ຄ່າເລີ່ມຕົ້ນ = ມື້ນີ້ (ຮູບແບບ YYYY-MM-DD ຂອງ input[type=date])
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <form action={action} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="model" value={model} />
      <input type="hidden" name="res_id" value={resId} />

      <div className="grid gap-2 sm:grid-cols-3">
        <SelectField
          name="kind"
          value={kind}
          onChange={(value) => setKind(value || "todo")}
          options={Object.entries(ACTIVITY_KIND_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          name="assigned_to"
          value={assignee}
          onChange={(value) => setAssignee(value || me)}
          options={people}
          placeholder={t.responsible}
        />
        <input
          type="date"
          name="due_date"
          defaultValue={today}
          className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-teal-500"
        />
      </div>

      <input
        name="summary"
        required
        placeholder={t.summaryPlaceholder}
        className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs outline-none focus:border-teal-500"
      />
      <textarea
        name="note"
        rows={2}
        placeholder={t.detailsPlaceholder}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs outline-none focus:border-teal-500"
      />

      {state.error && <p className="text-[11px] font-medium text-red-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
          {t.scheduleActivity}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600"
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

export function ChatterPanel({
  model,
  resId,
  messages,
  activities,
  followers,
  people,
  me,
}: {
  model: string;
  resId: string;
  messages: ChatterMessage[];
  activities: Activity[];
  followers: string[];
  people: Option[];
  me: string;
}) {
  const t = useDict().chatterPanel;
  const [state, action, pending] = useActionState(postMessage, {});
  const [scheduling, setScheduling] = useState(false);
  const [followPending, startFollow] = useTransition();
  const [showFollowers, setShowFollowers] = useState(false);
  const following = followers.includes(me);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ຫົວ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <MessageSquare className="size-4 text-slate-400" />
        <h2 className="text-sm font-bold text-slate-800">{t.title}</h2>

        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowFollowers((open) => !open)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <Users className="size-3.5" />
            {t.followers} {followers.length}
          </button>
          <button
            type="button"
            disabled={followPending}
            onClick={() => startFollow(() => void toggleFollow(model, resId))}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition ${
              following
                ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {followPending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : following ? (
              <Bell className="size-3.5" />
            ) : (
              <BellOff className="size-3.5" />
            )}
            {following ? t.following : t.follow}
          </button>
        </span>
      </div>

      {showFollowers && (
        <ul className="flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2">
          {followers.length === 0 ? (
            <li className="text-[11px] text-slate-400">{t.noFollowers}</li>
          ) : (
            followers.map((name) => (
              <li key={name} className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                {name}
              </li>
            ))
          )}
        </ul>
      )}

      <div className="space-y-4 p-4">
        {/* ກິດຈະກຳທີ່ວາງແຜນໄວ້ */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-600">{t.activitiesToDo}</h3>
            {!scheduling && (
              <button
                type="button"
                onClick={() => setScheduling(true)}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Plus className="size-3" />
                {t.scheduleActivity}
              </button>
            )}
          </div>

          {scheduling && (
            <ScheduleForm model={model} resId={resId} people={people} me={me} onDone={() => setScheduling(false)} t={t} />
          )}

          {activities.length === 0 ? (
            !scheduling && <p className="text-[11px] text-slate-400">{t.noPendingActivities}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {activities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} t={t} />
              ))}
            </ul>
          )}
        </div>

        {/* ກ່ອງພິມຂໍ້ຄວາມ */}
        <form action={action} className="flex items-start gap-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="model" value={model} />
          <input type="hidden" name="res_id" value={resId} />
          <Avatar name={me} />
          <textarea
            name="body"
            rows={2}
            required
            placeholder={t.messagePlaceholder}
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs outline-none focus:border-teal-500"
          />
          <button
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            {t.send}
          </button>
        </form>
        {state.error && <p className="text-[11px] font-medium text-red-600">{state.error}</p>}

        {/* ປະຫວັດ */}
        {messages.length === 0 ? (
          <p className="text-[11px] text-slate-400">{t.noMessages}</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li key={message.id} className="flex gap-2">
                <Avatar name={message.author} system={message.kind === "log"} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
                    <b className="text-slate-700">{message.author}</b>
                    <span className="text-slate-400">{message.created_at}</span>
                    {message.kind === "log" && (
                      <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">{t.system}</span>
                    )}
                  </p>
                  <p
                    className={`mt-0.5 whitespace-pre-wrap break-words text-xs ${
                      message.kind === "log" ? "text-slate-500" : "text-slate-800"
                    }`}
                  >
                    {message.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
