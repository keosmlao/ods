import { getSession } from "@/lib/auth";
import { notificationEvents } from "@/lib/notification-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

/** Realtime signal ສຳລັບກະດິ່ງ; ຂໍ້ມູນຈິງຍັງດຶງຈາກ /api/notifications ຕາມ session. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const events = await notificationEvents();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let onNotification: ((payload: string) => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (onNotification) events.off("notification", onNotification);
      };

      onNotification = (payload) => send(`event: notification\ndata: ${payload}\n\n`);
      events.on("notification", onNotification);
      send("retry: 2000\nevent: ready\ndata: {}\n\n");
      heartbeat = setInterval(() => send(": keepalive\n\n"), 20_000);
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (onNotification) events.off("notification", onNotification);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

