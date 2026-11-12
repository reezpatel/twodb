// GET /boards/:id/ws — live events out, human edits in.
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { ZodError } from "zod";
import { Op, type ClientMsg, type ServerMsg } from "./shared/model.js";
import { HttpError, rowToBoard, type Store } from "./store.js";
import type { Hub, Subscriber } from "./hub.js";
import { readForwardedContext } from "./gateway-context.js";

const REPLAY_LIMIT = 1000;

export function registerBoardSocket(app: FastifyInstance, store: Store, hub: Hub): void {
  app.get<{ Params: { id: string } }>("/boards/:id/ws", { websocket: true }, (socket: WebSocket, req) => {
    const ctx = readForwardedContext(req);
    if (!ctx) {
      socket.close(4401, "unauthorized");
      return;
    }
    const boardId = req.params.id;
    const send = (msg: ServerMsg) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    };
    let sub: Subscriber | null = null;
    let unsubscribe: (() => void) | null = null;

    const fail = (e: unknown, opId?: string) => {
      if (e instanceof HttpError) send({ t: "error", opId, code: e.code, message: e.message });
      else if (e instanceof ZodError) send({ t: "error", opId, code: "invalid_request", message: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      else {
        req.log.error({ err: e }, "ws handler failed");
        send({ t: "error", opId, code: "internal_error", message: "internal error" });
      }
    };

    async function hello(msg: Extract<ClientMsg, { t: "hello" }>) {
      const board = rowToBoard(await store.getBoardRow(boardId, ctx!.workspaceId));
      unsubscribe?.();
      let seq = board.lastSeq;
      let replay = msg.since !== undefined && msg.since >= 0;
      if (replay) {
        const events = await store.eventsSince(boardId, msg.since!, REPLAY_LIMIT);
        if (events.length >= REPLAY_LIMIT) replay = false; // too far behind: resync from a snapshot
        else {
          seq = events.length ? events[events.length - 1]!.seq : msg.since!;
          if (events.length) send({ t: "events", events });
        }
      }
      if (!replay) {
        const row = await store.getBoardRow(boardId, ctx!.workspaceId);
        const b = rowToBoard(row);
        seq = b.lastSeq;
        const items = b.kind === "diagram" ? await store.listItems(boardId) : [];
        send({ t: "snapshot", seq, board: b, items, doc: b.kind === "doc" ? { markdown: row.doc_markdown, version: b.docVersion } : null });
      }
      sub = { actor: ctx!.actor, clientId: msg.clientId, seq, send };
      unsubscribe = hub.subscribe(boardId, sub);
      void hub.flush(boardId); // anything committed between reading and subscribing
    }

    async function handle(msg: ClientMsg) {
      switch (msg.t) {
        case "ping":
          send({ t: "pong" });
          return;
        case "hello":
          await hello(msg);
          return;
        case "ops": {
          const ops = Op.array().min(1).max(2000).parse(msg.ops);
          const result = await store.applyBatch(boardId, ctx!.workspaceId, ctx!.actor, { ops, label: msg.label, clientId: sub?.clientId });
          send({ t: "ack", opId: msg.opId, result });
          return;
        }
        case "doc": {
          const r = await store.applyDoc(boardId, ctx!.workspaceId, ctx!.actor, sub?.clientId ?? null, msg.markdown, msg.ifVersion);
          send({ t: "docAck", opId: msg.opId, ...r });
          return;
        }
      }
    }

    // Messages are handled strictly in order, even though handlers are async.
    let chain: Promise<void> = Promise.resolve();
    socket.on("message", (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString()) as ClientMsg;
      } catch {
        send({ t: "error", code: "bad_json", message: "messages must be JSON" });
        return;
      }
      chain = chain.then(() => handle(msg)).catch((e) => fail(e, (msg as { opId?: string }).opId));
    });
    socket.on("close", () => unsubscribe?.());
    socket.on("error", () => unsubscribe?.());
  });
}
