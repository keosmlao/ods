"use client";

import {
  AlertTriangle,
  Bot,
  LoaderCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";

import { useDict } from "@/lib/i18n/context";

/**
 * **AI ຜູ້ຊ່ວຍວຽກ — ໜ້າຈໍ.**
 *
 * ── ຄວາມຜິດພາດ ບໍ່ແມ່ນ ຄຳຕອບ ──
 * ແບບເກົ່າເອົາ error ("ໂຄຕ້າເຕັມ", "Session ໝົດອາຍຸ") ໄປໃສ່ **ຟອງຂອງ AI** ⇒ ຄົນອ່ານ
 * ແລ້ວເຂົ້າໃຈວ່າ AI ເປັນຄົນເວົ້າ ແລະ ແຍກບໍ່ອອກວ່າ "AI ຕອບແບບນີ້" ກັບ "ລະບົບພັງ".
 * ດຽວນີ້ error ເປັນ**ກ່ອງເຕືອນສີເຫຼືອງ**ຄົນລະຮູບແບບ — ເຫັນປຸບຮູ້ວ່າບໍ່ແມ່ນຄຳຕອບ.
 *
 * ── ຄຳຖາມແນະນຳຢູ່ຕະຫຼອດ ──
 * ແບບເກົ່າສະແດງສະເພາະຕອນຫວ່າງ ⇒ ພໍຖາມເທື່ອທຳອິດແລ້ວ ຄົນບໍ່ຮູ້ວ່າຖາມຫຍັງໄດ້ອີກ.
 */
type Message = {
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
};

export function AssistantChat({ configured }: { configured: boolean }) {
  const t = useDict().assistantChat;
  const starters = [
    t.starterJobStage,
    t.starterOverSla,
    t.starterSlaByStage,
    t.starterStockByCode,
  ];
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const canSend = configured && !pending && question.trim().length > 0;
  // ສົ່ງໄປ server ສະເພາະ 10 ຂໍ້ຄວາມຫຼ້າສຸດ ແລະ **ບໍ່ເອົາ error ໄປປົນ** (ບໍ່ແມ່ນບົດສົນທະນາ)
  const history = useMemo(
    () => messages.filter((message) => !message.failed).slice(-10),
    [messages],
  );

  async function ask(value: string) {
    const content = value.trim();
    if (!content || pending || !configured) return;
    const next: Message[] = [...history, { role: "user", content }];
    setMessages((old) => [...old, { role: "user", content }]);
    setQuestion("");
    setPending(true);
    requestAnimationFrame(() =>
      bottom.current?.scrollIntoView({ behavior: "smooth" }),
    );
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      setMessages((old) => [
        ...old,
        data.answer
          ? { role: "assistant", content: data.answer }
          : {
              role: "assistant",
              content: data.error ?? t.answerFailed,
              failed: true,
            },
      ]);
    } catch {
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: t.connectionFailed,
          failed: true,
        },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() =>
        bottom.current?.scrollIntoView({ behavior: "smooth" }),
      );
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ── ຫົວ ── */}
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#0536a9] text-white">
          <Bot className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-800">
            {t.title}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="size-3 text-emerald-600" />
            {t.readonlyNote}
          </span>
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="size-3.5" /> {t.restart}
          </button>
        )}
      </header>

      {/* ── ບົດສົນທະນາ ── */}
      {/**
       * ຈໍກວ້າງເຕັມ ແຕ່ **ບົດສົນທະນາຈຳກັດຄວາມກວ້າງ** (max-w-4xl ກາງຈໍ):
       * ແຖວຍາວເກີນ ~90 ຕົວອັກສອນ ຕາອ່ານແລ້ວຫຼົງແຖວ. ກວ້າງເຕັມຈໍມີປະໂຫຍດກັບ
       * **ຕາຕະລາງ** ບໍ່ແມ່ນກັບ **ຂໍ້ຄວາມ** — ບ່ອນນີ້ຈຶ່ງໃຫ້ກ່ອງເຕັມ ແຕ່ເນື້ອໃນຢູ່ກາງ.
       */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        <div className="mx-auto max-w-4xl space-y-3">
          {!configured && (
            <div className="mx-auto flex max-w-xl items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <b className="block">{t.notReadyTitle}</b>
                {t.notReadyBefore}{" "}
                <code className="rounded bg-white px-1">
                  LOCAL_AI_API_KEY
                </code>{" "}
                {t.notReadyAfter}
              </span>
            </div>
          )}

          {configured && messages.length === 0 && (
            <div className="mx-auto flex max-w-2xl flex-col items-center py-8 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-white text-[#0536a9] ring-1 ring-slate-200">
                <Bot className="size-7" />
              </span>
              <h2 className="mt-3 text-base font-bold text-slate-800">
                {t.emptyTitle}
              </h2>
              <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                {t.emptyDescription}
              </p>
              <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
                {starters.map((starter) => (
                  <button
                    type="button"
                    key={starter}
                    onClick={() => void ask(starter)}
                    disabled={!configured || pending}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-[#0536a9]/40 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Sparkles className="size-3.5 shrink-0 text-[#0536a9]" />
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) =>
            /* error = ກ່ອງເຕືອນ ບໍ່ແມ່ນຟອງຂອງ AI — ຢ່າໃຫ້ຄົນເຂົ້າໃຈວ່າ AI ເປັນຄົນເວົ້າ */
            message.failed ? (
              <div
                key={`error-${index}`}
                className="mx-auto flex max-w-xl items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <b className="block">{t.errorTitle}</b>
                  {message.content}
                </span>
              </div>
            ) : (
              <div
                key={`${message.role}-${index}`}
                className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#0536a9] text-white">
                    <Bot className="size-4" />
                  </span>
                )}
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 sm:max-w-[75%] ${
                    message.role === "user"
                      ? "rounded-br-sm bg-[#0536a9] text-white"
                      : "rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#0536a9] text-white">
                <Bot className="size-4" />
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-500 shadow-sm">
                <LoaderCircle className="size-3.5 animate-spin text-[#0536a9]" />
                {t.checking}
              </span>
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      {/* ── ຊ່ອງພິມ ── */}
      <form
        onSubmit={submit}
        className="border-t border-slate-200 bg-white p-3"
      >
        <div className="mx-auto max-w-4xl">
          {/* ຄຳຖາມແນະນຳຢູ່ຕິດຊ່ອງພິມຕະຫຼອດ — ຖາມເທື່ອທຳອິດແລ້ວກໍ່ຍັງຮູ້ວ່າຖາມຫຍັງໄດ້ອີກ */}
          {messages.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {starters.map((starter) => (
                <button
                  type="button"
                  key={starter}
                  onClick={() => void ask(starter)}
                  disabled={!configured || pending}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium text-slate-600 hover:border-[#0536a9]/40 hover:bg-slate-50 disabled:opacity-50"
                >
                  {starter}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-1.5 focus-within:border-[#0536a9] focus-within:ring-2 focus-within:ring-[#0536a9]/10">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) void ask(question);
                }
              }}
              disabled={!configured || pending}
              rows={1}
              maxLength={4000}
              placeholder={t.inputPlaceholder}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 disabled:bg-transparent"
            />
            <button
              disabled={!canSend}
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#0536a9] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label={t.sendQuestion}
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            {t.footerHint}
          </p>
        </div>
      </form>
    </section>
  );
}
