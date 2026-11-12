// Live fan-out. Every committed batch NOTIFYs `paintress_board` with
// "<boardId>:<seq>"; each process LISTENs and pushes new events to the sockets
// subscribed to that board. Works across multiple Paintress processes and keeps
// to the Postgres-only messaging rule.
import pg from "pg";
import { actorKind, type ServerMsg } from "./shared/model.js";
import { NOTIFY_CHANNEL, type Store } from "./store.js";

export interface Subscriber {
  actor: string;
  clientId: string;
  /** Highest seq already delivered to this socket. */
  seq: number;
  send(msg: ServerMsg): void;
}

export interface Hub {
  subscribe(boardId: string, sub: Subscriber): () => void;
  /** Deliver anything newer than each subscriber's seq (also called directly after local writes). */
  flush(boardId: string): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createHub(store: Store, connectionString: string, schema: string, log: { warn: (o: unknown, m?: string) => void }): Hub {
  const boards = new Map<string, Set<Subscriber>>();
  let client: pg.Client | null = null;
  let stopped = false;
  const flushing = new Map<string, Promise<void>>();

  const presence = (boardId: string) => {
    const subs = boards.get(boardId);
    if (!subs) return;
    const seen = new Map<string, "human" | "agent">();
    for (const s of subs) seen.set(s.actor, actorKind(s.actor));
    const msg: ServerMsg = { t: "presence", actors: [...seen].map(([actor, kind]) => ({ actor, kind })) };
    for (const s of subs) s.send(msg);
  };

  async function doFlush(boardId: string) {
    const subs = boards.get(boardId);
    if (!subs?.size) return;
    const min = Math.min(...[...subs].map((s) => s.seq));
    const events = await store.eventsSince(boardId, min);
    if (!events.length) return;
    for (const s of subs) {
      const fresh = events.filter((e) => e.seq > s.seq);
      if (!fresh.length) continue;
      s.seq = fresh[fresh.length - 1]!.seq;
      s.send({ t: "events", events: fresh });
    }
  }

  function flush(boardId: string): Promise<void> {
    // Serialise per board so overlapping notifications don't double-send.
    const prev = flushing.get(boardId) ?? Promise.resolve();
    const next = prev.then(() => doFlush(boardId)).catch((err) => log.warn({ err }, "hub flush failed"));
    flushing.set(boardId, next);
    void next.finally(() => {
      if (flushing.get(boardId) === next) flushing.delete(boardId);
    });
    return next;
  }

  async function connect() {
    if (stopped) return;
    const c = new pg.Client({ connectionString, options: `-c search_path=${schema}` });
    c.on("notification", (m) => {
      const boardId = m.payload?.split(":")[0];
      if (boardId && boards.has(boardId)) void flush(boardId);
    });
    const retry = () => {
      if (stopped || client !== c) return;
      client = null;
      setTimeout(() => void connect().catch(() => retry()), 1500);
    };
    c.on("error", (err) => {
      log.warn({ err }, "hub listener error");
      retry();
    });
    c.on("end", retry);
    await c.connect();
    client = c;
    await c.query(`LISTEN ${NOTIFY_CHANNEL}`);
    // Anything missed while disconnected: catch every active board up.
    for (const id of boards.keys()) void flush(id);
  }

  return {
    subscribe(boardId, sub) {
      let set = boards.get(boardId);
      if (!set) boards.set(boardId, (set = new Set()));
      set.add(sub);
      presence(boardId);
      return () => {
        set!.delete(sub);
        if (!set!.size) boards.delete(boardId);
        else presence(boardId);
      };
    },
    flush,
    async start() {
      await connect();
    },
    async stop() {
      stopped = true;
      const c = client;
      client = null;
      await c?.end().catch(() => undefined);
    },
  };
}
