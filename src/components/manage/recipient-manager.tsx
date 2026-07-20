"use client";
import { addRecipient, removeRecipient, toggleRecipient } from "@/app/actions/report-recipient";
import type { Recipient } from "@/lib/report-recipient";
import { LoaderCircle, Mail, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RecipientManager({ initial }: { initial: Recipient[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channel, setChannel] = useState<"email" | "line">("email");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr("");
      const r = await fn();
      if (r.error) { setErr(r.error); return; }
      router.refresh();
    });

  const add = () => act(async () => {
    const r = await addRecipient(channel, target, name);
    if (!r.error) { setTarget(""); setName(""); }
    return r;
  });

  const inp = "h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500";
  const emails = initial.filter((r) => r.channel === "email");
  const lines = initial.filter((r) => r.channel === "line");

  const group = (title: string, Icon: typeof Mail, list: Recipient[]) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600"><Icon className="size-4 text-teal-600" /> {title} ({list.length})</p>
      {list.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">ຍັງບໍ່ມີ</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={r.active} onChange={(e) => act(() => toggleRecipient(r.id, e.target.checked))} className="size-4 accent-teal-600" />
              </label>
              <span className={`min-w-0 flex-1 truncate ${r.active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                {r.target}{r.name ? <span className="text-slate-400"> · {r.name}</span> : null}
              </span>
              <button type="button" onClick={() => act(() => removeRecipient(r.id))} className="text-slate-400 hover:text-rose-600"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">ເພີ່ມຜູ້ຮັບ</p>
        <div className="flex flex-wrap items-end gap-2">
          <select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "line")} className={inp}>
            <option value="email">Email</option>
            <option value="line">Line OA</option>
          </select>
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={channel === "email" ? "name@odienmall.com" : "Uxxxx / Cxxxx"} className={`${inp} min-w-48 flex-1`} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ຊື່ (ບໍ່ບັງຄັບ)" className={`${inp} w-32`} />
          <button type="button" disabled={pending} onClick={add} className="inline-flex h-9 items-center gap-1 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} ເພີ່ມ
          </button>
        </div>
        {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
      </div>
      {group("Email", Mail, emails)}
      {group("Line OA", MessageCircle, lines)}
      <p className="text-[11px] text-slate-400">ຕິກ = active (ໄດ້ຮັບ) · ຖ້າວ່າງທັງໝົດ ระบบ fallback ໄປ env (MAIL_TO / LINE_NOTIFY_TO).</p>
    </div>
  );
}
