import "server-only";

import { db } from "@/lib/db";
import { EventEmitter } from "node:events";
import type { PoolClient } from "pg";

const CHANNEL = "ods_notification_events";

type NotificationEventState = {
  emitter: EventEmitter;
  client: PoolClient | null;
  starting: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

declare global {
  var odsNotificationEventState: NotificationEventState | undefined;
}

const state = (global.odsNotificationEventState ??= {
  emitter: new EventEmitter(),
  client: null,
  starting: null,
  reconnectTimer: null,
});
state.emitter.setMaxListeners(0);

function reconnect() {
  if (state.reconnectTimer) return;
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    void ensureNotificationListener();
  }, 1_000);
}

/** 1 PostgreSQL LISTEN connection ຕໍ່ Node process; browser ທຸກ tab ໃຊ້ emitter ຮ່ວມກັນ. */
async function ensureNotificationListener() {
  if (!db || state.client) return;
  if (state.starting) return state.starting;

  state.starting = (async () => {
    let client: PoolClient | null = null;
    try {
      client = await db.connect();
      await client.query(`listen ${CHANNEL}`);
      state.client = client;
      client.on("notification", (message) => {
        if (message.channel === CHANNEL) state.emitter.emit("notification", message.payload ?? "{}");
      });
      client.on("error", (error) => {
        console.error("notification LISTEN connection failed", error);
        if (state.client === client) {
          state.client = null;
          client?.release(true);
          reconnect();
        }
      });
    } catch (error) {
      console.error("notification LISTEN setup failed", error);
      state.client = null;
      client?.release(true);
      reconnect();
    } finally {
      state.starting = null;
    }
  })();

  return state.starting;
}

export async function notificationEvents() {
  await ensureNotificationListener();
  return state.emitter;
}
