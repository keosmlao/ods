"use client";
import { loadRoom, pollChat, sendChatMessage, type ChatState } from "@/app/actions/chat";
import type { ChatMessage } from "@/lib/chat";
import { LoaderCircle, Send } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

/**
 * **ຫ້ອງສົນທະນາ** — ຮັບຂໍ້ຄວາມໃໝ່ດ້ວຍ polling ທຸກ 3 ວິນາທີ.
 *
 * ── ເປັນຫຍັງ polling ບໍ່ແມ່ນ WebSocket ──
 * ລະບົບແລ່ນເປັນ Next server ດຽວ (ບໍ່ມີ socket server) ແລະ ຄົນໃຊ້ 42 ຄົນ ⇒ ຖາມ
 * "ມີຫຍັງໃໝ່ຫຼັງ id ນີ້ບໍ" ທຸກ 3 ວິ ແມ່ນ index scan ນ້ອຍໆ ແລະ ຄືນ array ຫວ່າງ
 * ເມື່ອບໍ່ມີຫຍັງໃໝ່. ແລກກັບຄວາມຊັບຊ້ອນຂອງການເພີ່ມບໍລິການໃໝ່ — ບໍ່ຄຸ້ມຕອນນີ້.
 *
 * ── ຢຸດ poll ຕອນບໍ່ໄດ້ເບິ່ງ ──
 * ແທັບຖືກເຊື່ອງ (`visibilitychange`) ⇒ ຢຸດ ⇒ ບໍ່ຍິງ query ໃຫ້ຄົນທີ່ບໍ່ໄດ້ເບິ່ງ
 * (30 ຄົນເປີດແທັບຄ້າງໄວ້ = 10 query/ວິນາທີ ໂດຍບໍ່ມີໃຜອ່ານ).
 */
export function ChatRoom({
  room,
  me,
  title,
  compact = false,
}: {
  room: string;
  me: string;
  title: string;
  /** ຢູ່ໃນປຸ່ມແຊັດລອຍ — ຫົວ ແລະ ຂອບ ເປັນຂອງກ່ອງນັ້ນແລ້ວ ⇒ ບໍ່ຕ້ອງມີຊ້ຳ */
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // id ຫຼ້າສຸດທີ່ມີແລ້ວ — poll ຖາມສະເພາະທີ່ໃໝ່ກວ່ານີ້
  const sinceRef = useRef("0");

  const [state, submit, sending] = useActionState<ChatState, FormData>(async (prev, formData) => {
    const result = await sendChatMessage(prev, formData);
    if (!result.error) {
      setText("");
      // ດຶງທັນທີ ບໍ່ຕ້ອງລໍຮອບ poll — ຄົນສົ່ງຄວນເຫັນຂໍ້ຄວາມຕົນເອງທັນທີ
      const fresh = await pollChat(room, sinceRef.current);
      if (fresh.length) {
        sinceRef.current = fresh[fresh.length - 1].id;
        setMessages((old) => [...old, ...fresh]);
      }
    }
    return result;
  }, {});

  /**
   * ໂຫຼດຂໍ້ຄວາມຂອງຫ້ອງ.
   * **ບໍ່ຕ້ອງລ້າງ state ຕອນປ່ຽນຫ້ອງ** — ໜ້າ /chat ໃສ່ `key={room}` ໃຫ້ ⇒ React
   * ສ້າງ component ໃໝ່ທັງກ້ອນເມື່ອປ່ຽນຫ້ອງ (ວິທີຂອງ React ແທ້ · ບໍ່ມີ setState
   * ໃນ effect ທີ່ພາໃຫ້ render ຊ້ອນ). ຄ່າຕັ້ງຕົ້ນຢູ່ useState ຂ້າງເທິງແລ້ວ.
   */
  useEffect(() => {
    let alive = true;
    loadRoom(room).then((rows) => {
      if (!alive) return;
      setMessages(rows);
      if (rows.length) sinceRef.current = rows[rows.length - 1].id;
      setLoading(false);
      inputRef.current?.focus();
    });
    return () => {
      alive = false;
    };
  }, [room]);

  // polling — ຢຸດເມື່ອແທັບຖືກເຊື່ອງ
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === "visible") {
        try {
          const fresh = await pollChat(room, sinceRef.current);
          if (alive && fresh.length) {
            sinceRef.current = fresh[fresh.length - 1].id;
            setMessages((old) => [...old, ...fresh]);
          }
        } catch {
          // ເນັດຂາດຊົ່ວຄາວ ⇒ ຮອບໜ້າລອງໃໝ່ (ບໍ່ຕ້ອງບອກຄົນ)
        }
      }
      timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 3000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [room]);

  // ມີຂໍ້ຄວາມໃໝ່ ⇒ ເລື່ອນລົງລຸ່ມສຸດ
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <section
      className={
        compact
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
          : "flex h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      }
    >
      {!compact && (
        <header className="border-b border-slate-200 px-4 py-2.5">
          <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        </header>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
        {loading ? (
          <p className="py-10 text-center text-xs text-slate-400">
            <LoaderCircle className="mx-auto mb-2 size-5 animate-spin text-slate-300" />
            ກຳລັງໂຫຼດ...
          </p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">ຍັງບໍ່ມີຂໍ້ຄວາມ — ພິມທັກທາຍໄດ້ເລີຍ</p>
        ) : (
          messages.map((message, index) => {
            const mine = message.author === me;
            // ຄົນດຽວກັນສົ່ງຕິດກັນ ⇒ ສະແດງຊື່ແຕ່ເທື່ອທຳອິດ (ອ່ານງ່າຍກວ່າ)
            const showName = !mine && messages[index - 1]?.author !== message.author;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"}`}>
                  {showName && (
                    <span className="mb-0.5 block px-1 text-[10px] font-semibold text-slate-500">
                      {message.author_name ?? message.author}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      mine ? "rounded-br-sm bg-[#0536a9] text-white" : "rounded-bl-sm bg-white text-slate-800 shadow-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                  <span className={`mt-0.5 block px-1 text-[9px] text-slate-400 ${mine ? "text-right" : ""}`}>
                    {message.created_at}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {state.error && <p className="bg-rose-50 px-4 py-1.5 text-xs font-semibold text-rose-600">{state.error}</p>}

      <form ref={formRef} action={submit} className="flex items-center gap-2 border-t border-slate-200 p-2.5">
        <input type="hidden" name="room" value={room} />
        <input
          ref={inputRef}
          name="body"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          autoComplete="off"
          placeholder="ພິມຂໍ້ຄວາມ..."
          className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0536a9] text-white hover:opacity-90 disabled:opacity-40"
        >
          {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </section>
  );
}
