import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth } from "../auth";
import { logger } from "./logger";

// Room-based realtime gateway on one socket (/api/ws). Auth happens once at
// upgrade; every socket is implicitly joined to its notification rooms
// (`notif:user:<userId>` + `notif:org:<orgId>`). App traffic can register
// guarded rooms later (join enforces the guard) — per-app sockets stay on
// their own endpoints until they migrate here.
//
// Frame (both directions): { v: 1, room, event, data } — client ops use
// { v: 1, op: "join"|"leave"|"ping", room? }.

export interface GatewaySocket {
  ws: WSContext;
  userId: string;
  organizationId: string;
  rooms: Set<string>;
}

export const V = 1;

const sockets = new Set<GatewaySocket>();
const rooms = new Map<string, Set<GatewaySocket>>();

type RoomGuard = (socket: GatewaySocket, room: string) => Promise<boolean>;
const guards = new Map<string, RoomGuard>();

/** Prefix-guarded rooms: joins under `prefix:` pass only when the guard
 *  allows the socket (org membership, object ACL, …). Unregistered prefixes
 *  are open to org members only via the org check embedded in the room id. */
export function registerRoomGuard(prefix: string, guard: RoomGuard) {
  guards.set(prefix, guard);
}

function join(socket: GatewaySocket, room: string) {
  let set = rooms.get(room);
  if (!set) {
    set = new Set();
    rooms.set(room, set);
  }
  set.add(socket);
  socket.rooms.add(room);
}

function leave(socket: GatewaySocket, room: string) {
  rooms.get(room)?.delete(socket);
  socket.rooms.delete(room);
}

function drop(socket: GatewaySocket) {
  sockets.delete(socket);
  for (const room of socket.rooms) {
    const set = rooms.get(room);
    if (!set) continue;
    set.delete(socket);
    if (!set.size) rooms.delete(room);
  }
}

function orgRoom(organizationId: string) {
  return `notif:org:${organizationId}`;
}

function userRoom(userId: string) {
  return `notif:user:${userId}`;
}

function frame(room: string, event: string, data: unknown) {
  return JSON.stringify({ v: V, room, event, data });
}

function send(socket: GatewaySocket, payload: string) {
  try {
    socket.ws.send(payload);
  } catch {
    drop(socket);
  }
}

/** Publish an event to every socket in a room key. The room field in the
 *  frame is the room key; clients dispatch on the event name (`notification.*`
 *  regardless of which implicit room delivered it). */
export function publish(room: string, event: string, data: unknown) {
  const set = rooms.get(room);
  if (!set?.size) return;
  const payload = frame(room, event, data);
  for (const s of set) send(s, payload);
}

/** Publish to every connected socket of one user (all their devices/tabs). */
export function publishToUser(userId: string, event: string, data: unknown) {
  publish(userRoom(userId), event, data);
}

/** Publish to every connected member of an org. */
export function publishToOrg(organizationId: string, event: string, data: unknown) {
  publish(orgRoom(organizationId), event, data);
}

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

export function registerGatewayWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  app.get(
    "/api/ws",
    upgradeWebSocket((c: Context) => {
      const ready = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => (s?.session.activeOrganizationId ? { userId: s.user.id, organizationId: s.session.activeOrganizationId } : null))
        .catch(() => null);
      let socket: GatewaySocket | null = null;
      // Messages can arrive while onOpen's async auth is still resolving —
      // buffer them so early pings/joins aren't dropped.
      const earlyMessages: { data: unknown }[] = [];
      const handleMessage = (evt: { data: unknown }) => {
        if (!socket) {
          earlyMessages.push(evt);
          return;
        }
        let msg: { v?: number; op?: string; room?: string };
        try {
          msg = JSON.parse(String(evt.data)) as typeof msg;
        } catch {
          return;
        }
        if (msg.op === "ping") {
          send(socket, JSON.stringify({ v: V, op: "pong" }));
          return;
        }
        if (msg.op === "join" && typeof msg.room === "string" && msg.room) {
          if (socket.rooms.has(msg.room)) return;
          void (async () => {
            let allowed = msg.room!.startsWith(`org:${socket.organizationId}:`);
            if (!allowed) {
              const prefix = msg.room!.split(":")[0];
              const guard = guards.get(prefix);
              allowed = guard ? await guard(socket, msg.room!) : false;
            }
            if (allowed) join(socket, msg.room!);
            else send(socket, frame(msg.room!, "error", { error: "forbidden" }));
          })();
          return;
        }
        if (msg.op === "leave" && typeof msg.room === "string") {
          leave(socket, msg.room);
        }
      };

      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const who = await ready;
          if (!who) {
            ws.close(4401, "unauthorized");
            return;
          }
          socket = { ws, ...who, rooms: new Set() };
          sockets.add(socket);
          // Notification rooms are implicit — the bell works on connect.
          join(socket, userRoom(who.userId));
          join(socket, orgRoom(who.organizationId));
          for (const evt of earlyMessages.splice(0)) handleMessage(evt);
        },
        onClose() {
          if (socket) drop(socket);
        },
        onMessage(evt: { data: unknown }) {
          handleMessage(evt);
        },
      };
    }),
  );
  logger.info("ws gateway registered at /api/ws");
}
