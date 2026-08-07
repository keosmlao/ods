"use client";
import { resetPushRecipients, sendTestPush, setPushRecipient } from "@/app/actions/push-recipient";
import type { PushKind, PushPerson } from "@/lib/push-recipient-shared";
import { PUSH_KINDS, PUSH_KIND_META } from "@/lib/push-recipient-shared";
import { BellRing, LoaderCircle, RotateCcw, Send, Smartphone, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ຄ່າທີ່ຜູ້ຈັດການເລືອກໄວ້: username(ໂຕນ້ອຍ) → ເປີດ/ປິດ. ບໍ່ມີ key = ຍັງບໍ່ໄດ້ເລືອກ (ຕາມ role) */
export type KindState = { byDefault: string[]; chosen: Record<string, boolean> };

export function PushRecipientManager({
  people,
  state,
}: {
  people: PushPerson[];
  state: Record<PushKind, KindState>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState("");

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr("");
      setMsg("");
      const result = await fn();
      if (result.error) {
        setErr(result.error);
        return;
      }
      router.refresh();
    });

  const test = (username: string) =>
    start(async () => {
      setErr("");
      setMsg("");
      setTesting(username);
      const result = await sendTestPush(username);
      setTesting("");
      if (result.error) setErr(result.error);
      else setMsg(`ສົ່ງໄປ ${result.sent} ເຄື່ອງຂອງ “${username}” ແລ້ວ — ໃຫ້ລາວເບິ່ງມືຖື`);
    });

  /** ຈະໄດ້ຮັບບໍ = ທີ່ເລືອກໄວ້ ຫຼື ຄ່າຕັ້ງຕົ້ນຕາມ role */
  const on = (kind: PushKind, username: string) => {
    const key = username.toLowerCase();
    return state[kind].chosen[key] ?? state[kind].byDefault.includes(key);
  };

  const configured = (kind: PushKind) => Object.keys(state[kind].chosen).length > 0;
  /**
   * ນັບສະເພາະ**ຄົນທີ່ໄດ້ຮັບຈິງ** = ຕິດຢູ່ ແລະ ມີເຄື່ອງ. ຄົນທີ່ຢູ່ໃນ role ແຕ່ບໍ່ເຄີຍລົງແອັບ
   * ນັບເຂົ້າ = ຕົວເລກຫຼອກຕາ ("ສົ່ງໃຫ້ 15 ຄົນ" ທັງທີ່ 1 ຄົນເທົ່ານັ້ນທີ່ມືຖືດັງ).
   */
  const total = (kind: PushKind) =>
    people.filter((person) => person.devices > 0 && on(kind, person.username)).length;

  return (
    <div className="w-full space-y-4">
      {/* ── ສະຖານະຂອງແຕ່ລະປະເພດ ── */}
      <div className="grid gap-3 lg:grid-cols-2">
        {PUSH_KINDS.map((kind) => (
          <div key={kind} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <BellRing className="size-4 text-brand-700" /> {PUSH_KIND_META[kind].label}
              </p>
              <span
                className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700"
                title="ນັບສະເພາະຄົນທີ່ມີເຄື່ອງລົງທະບຽນແລ້ວ — ຄົນທີ່ຍັງບໍ່ອະນຸຍາດແຈ້ງເຕືອນບໍ່ນັບ"
              >
                ໄດ້ຮັບຈິງ {total(kind)} ຄົນ
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{PUSH_KIND_META[kind].help}</p>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <p className="text-xs text-slate-500">
                {configured(kind) ? (
                  <>
                    <b className="text-slate-700">ກຳນົດເອງແລ້ວ</b> · ແກ້ໄດ້ໃນຕາຕະລາງລຸ່ມ
                  </>
                ) : (
                  <>
                    <b className="text-slate-700">ຕາມ role (ຄ່າຕັ້ງຕົ້ນ)</b> · {PUSH_KIND_META[kind].fallback}
                  </>
                )}
              </p>
              {configured(kind) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => resetPushRecipients(kind))}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <RotateCcw className="size-3.5" /> ກັບໄປຕາມ role
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}

      {/* ── ຕາຕະລາງຄົນ ── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">ຄົນ</th>
              <th className="px-3 py-2 text-left font-semibold">ບົດບາດ</th>
              <th className="px-3 py-2 text-left font-semibold">ເຄື່ອງ</th>
              <th className="px-3 py-2 text-left font-semibold">login ແອັບລ່າສຸດ</th>
              {PUSH_KINDS.map((kind) => (
                <th key={kind} className="px-3 py-2 text-center font-semibold">
                  {kind === "approval" ? "ລໍອະນຸມັດ" : "ສະຫຼຸບ 15 ນາທີ"}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {people.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                  ຍັງບໍ່ມີໃຜ login ແອັບເທື່ອ
                </td>
              </tr>
            )}
            {people.map((person) => (
              <tr key={person.username} className={person.devices ? "" : "bg-slate-50/60"}>
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-800">{person.name}</span>
                  {person.name.toLowerCase() !== person.username.toLowerCase() && (
                    <span className="ml-1 text-xs text-slate-400">{person.username}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{person.role || "—"}</td>
                <td className="px-3 py-2">
                  {person.devices ? (
                    <span className="flex items-center gap-1 text-slate-600">
                      <Smartphone className="size-3.5 text-slate-400" />
                      {person.devices}
                      {person.platform ? <span className="text-xs text-slate-400">{person.platform}</span> : null}
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1 text-xs text-amber-700"
                      title="ຍັງບໍ່ໄດ້ກົດອະນຸຍາດການແຈ້ງເຕືອນຢູ່ແອັບ ⇒ ເລືອກໄວ້ກໍ່ຍັງບໍ່ໄດ້ຮັບ"
                    >
                      <TriangleAlert className="size-3.5" /> ຍັງບໍ່ອະນຸຍາດ
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{person.last_login ?? "—"}</td>
                {PUSH_KINDS.map((kind) => (
                  <td key={kind} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-700"
                      disabled={pending}
                      checked={on(kind, person.username)}
                      onChange={(event) =>
                        act(() => setPushRecipient(kind, person.username, event.target.checked))
                      }
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={pending || !person.devices}
                    onClick={() => test(person.username)}
                    title="ຍິງທົດສອບໃສ່ເຄື່ອງຂອງຄົນນີ້"
                    className="text-slate-400 hover:text-brand-700 disabled:opacity-30"
                  >
                    {testing === person.username ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
