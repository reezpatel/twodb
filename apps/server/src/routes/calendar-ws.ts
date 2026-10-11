import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import { accountMemberIds } from "../lib/email/access";
import { logger } from "../lib/logger";
import { setCalendarNotifier } from "../lib/calendar/events";
import { setExportBroadcaster } from "../lib/calendar/export";
import { setPendingBroadcaster } from "../lib/calendar/pending-push";
import { setReminderDelivery } from "../lib/calendar/reminders";
import { setSyncNotifier } from "../lib/calendar/sync";

// Calendar realtime: event changes per calendar (fan out to everyone who can
// see it), Pending push updates per account, reminders per user.

interface CalendarSocket {
  ws: WSContext;
  userId: string;
  organizationId: string;
}

const sockets = new Set<CalendarSocket>();

function sendTo(userIds: Set<string>, payload: Record<string, unknown>) {
  const data = JSON.stringify(payload);
  for (const s of sockets) {
    if (!userIds.has(s.userId)) continue;
    try {
      s.ws.send(data);
    } catch {
      sockets.delete(s);
    }
  }
}

async function calendarAudience(calendarId: string): Promise<Set<string>> {
  const cal = await db.selectFrom("calendar").select(["accountId", "ownerUserId", "organizationId"]).where("id", "=", calendarId).executeTakeFirst();
  if (!cal) return new Set();
  if (cal.accountId) return new Set(await accountMemberIds(cal.accountId));
  const shares = await db.selectFrom("calendar_share").select(["principalType", "principal"]).where("calendarId", "=", calendarId).execute();
  const users = new Set([cal.ownerUserId, ...shares.filter((s) => s.principalType === "user").map((s) => s.principal)]);
  if (shares.some((s) => s.principalType === "org")) for (const s of sockets) if (s.organizationId === cal.organizationId) users.add(s.userId);
  return users;
}

export async function broadcastCalendar(calendarId: string, payload: Record<string, unknown>) {
  if (!sockets.size) return;
  sendTo(await calendarAudience(calendarId), payload);
}

export async function broadcastCalendarAccount(accountId: string, payload: Record<string, unknown>) {
  if (!sockets.size) return;
  sendTo(new Set(await accountMemberIds(accountId)), payload);
}

export function broadcastCalendarUser(userId: string, payload: Record<string, unknown>) {
  sendTo(new Set([userId]), payload);
}

setCalendarNotifier(broadcastCalendar);
setSyncNotifier(broadcastCalendar);
setPendingBroadcaster(broadcastCalendarAccount);
setExportBroadcaster(broadcastCalendarAccount);
setReminderDelivery(async (userId, payload) => broadcastCalendarUser(userId, payload));

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

export function registerCalendarWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  app.get(
    "/api/calendar/ws",
    upgradeWebSocket((c: Context) => {
      const ready = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => (s?.session.activeOrganizationId ? { userId: s.user.id, organizationId: s.session.activeOrganizationId } : null))
        .catch(() => null);
      let socket: CalendarSocket | null = null;
      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const who = await ready;
          if (!who) {
            ws.close(4401, "unauthorized");
            return;
          }
          socket = { ws, ...who };
          sockets.add(socket);
        },
        onClose() {
          if (socket) sockets.delete(socket);
        },
        onMessage(evt: { data: unknown }, ws: WSContext) {
          if (evt.data === '{"type":"ping"}') {
            try {
              ws.send('{"type":"pong"}');
            } catch (e) {
              logger.debug({ err: e }, "calendar ws pong failed");
            }
          }
        },
      };
    }),
  );
}
