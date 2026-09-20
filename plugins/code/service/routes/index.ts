import type { FastifyInstance, FastifyReply } from "fastify";
import type { Kysely } from "kysely";
import type { CodeTables } from "../db";
import { runtime } from "../runtime";
import { runSession } from "../harness";
import { hydrateSessionEvents } from "../history";
import type { CodeSession, CreateSessionRequest, RunRequest, StoredMessage } from "../../shared/api";
import type {} from "@twodb/workspace/shared/fn";
import type {} from "@twodb/llm/shared/fn";

type SessionRow = {
  id: string;
  workspace_id: string;
  node_id: string;
  title: string;
  folder: string;
  connection_id: string | null;
  model: string | null;
  created_at: Date;
  updated_at: Date;
};

type MsgRow = {
  id: string;
  run_id: string | null;
  role: string;
  content: string | null;
  tool_calls: unknown[] | null;
  tool_call_id: string | null;
  name: string | null;
  created_at: Date;
};

const toSession = (row: SessionRow): CodeSession => ({
  id: row.id,
  workspace_id: row.workspace_id,
  node_id: row.node_id,
  title: row.title,
  folder: row.folder,
  connection_id: row.connection_id,
  model: row.model,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

const toStored = (row: MsgRow): StoredMessage => ({
  id: row.id,
  run_id: row.run_id,
  role: row.role as StoredMessage["role"],
  content: row.content,
  tool_calls: (row.tool_calls ?? undefined) as StoredMessage["tool_calls"],
  tool_call_id: row.tool_call_id,
  name: row.name,
  created_at: row.created_at.toISOString(),
});

const loadSession = async (kysely: Kysely<CodeTables>, id: string, workspaceId: string): Promise<SessionRow | null> =>
  (await kysely.selectFrom("code_sessions").selectAll().where("id", "=", id).where("workspace_id", "=", workspaceId).limit(1).executeTakeFirst()) ?? null;

export async function registerSessionRoutes(
  kysely: Kysely<CodeTables>,
  invoke: <T>(name: string, ...args: unknown[]) => Promise<T>,
  app: FastifyInstance,
): Promise<void> {
  const requireWorkspace = async (request: { workspaceId: string | null }, reply: FastifyReply) => {
    if (!request.workspaceId) {
      reply.code(400).send({ error: "workspace_required" });
      return null;
    }
    return request.workspaceId;
  };

  app.get("/sessions", async (request, reply) => {
    const workspaceId = await requireWorkspace(request, reply);
    if (!workspaceId) return reply;
    const rows = await kysely.selectFrom("code_sessions").selectAll().where("workspace_id", "=", workspaceId).orderBy("updated_at", "desc").execute();
    return { sessions: rows.map((row) => toSession(row as SessionRow)) };
  });

  app.post<{ Body: CreateSessionRequest }>("/sessions", async (request, reply) => {
    const workspaceId = await requireWorkspace(request, reply);
    if (!workspaceId) return reply;
    const body = request.body;
    if (!body?.title?.trim() || !body?.node_id || !body?.folder?.trim()) {
      reply.code(400).send({ error: "invalid_request" });
      return reply;
    }
    const rows = await kysely
      .insertInto("code_sessions")
      .values({
        workspace_id: workspaceId,
        node_id: body.node_id,
        title: body.title.trim(),
        folder: body.folder.trim(),
        connection_id: body.connection_id ?? null,
        model: body.model ?? null,
      })
      .returningAll()
      .execute();
    return { session: toSession(rows[0] as SessionRow) };
  });

  app.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const workspaceId = await requireWorkspace(request, reply);
    if (!workspaceId) return reply;
    const session = await loadSession(kysely, request.params.id, workspaceId);
    if (!session) {
      reply.code(404).send({ error: "session_not_found" });
      return reply;
    }
    const messages = await kysely
      .selectFrom("code_session_messages")
      .selectAll()
      .where("session_id", "=", session.id)
      .orderBy("created_at")
      .limit(200)
      .execute();
    return { session: toSession(session), messages: messages.map((row) => toStored(row as MsgRow)) };
  });

  app.patch<{ Params: { id: string }; Body: { connection_id?: string | null } }>("/sessions/:id", async (request, reply) => {
    const workspaceId = await requireWorkspace(request, reply);
    if (!workspaceId) return reply;
    const session = await loadSession(kysely, request.params.id, workspaceId);
    if (!session) {
      reply.code(404).send({ error: "session_not_found" });
      return reply;
    }
    const body = request.body ?? {};
    if ("connection_id" in body && body.connection_id !== undefined) {
      await kysely
        .updateTable("code_sessions")
        .set({ connection_id: body.connection_id ?? null, updated_at: new Date() })
        .where("id", "=", session.id)
        .execute();
    }
    const updated = await loadSession(kysely, session.id, workspaceId);
    return { session: toSession(updated as SessionRow) };
  });

  app.delete<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const workspaceId = await requireWorkspace(request, reply);
    if (!workspaceId) return reply;
    const session = await loadSession(kysely, request.params.id, workspaceId);
    if (!session) {
      reply.code(404).send({ error: "session_not_found" });
      return reply;
    }
    await kysely.deleteFrom("code_sessions").where("id", "=", session.id).execute();
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: RunRequest }>("/sessions/:id/run", async (request, reply) => {
    const workspaceId = await requireWorkspace(request, reply);
    if (!workspaceId) return reply;
    const session = await loadSession(kysely, request.params.id, workspaceId);
    if (!session) {
      reply.code(404).send({ error: "session_not_found" });
      return reply;
    }
    const message = request.body?.message?.trim();
    if (!message) {
      reply.code(400).send({ error: "invalid_request" });
      return reply;
    }
    if (runtime.isRunning(session.id)) {
      reply.code(409).send({ error: "session_running" });
      return reply;
    }

    runSession({ kysely, invoke }, session, message);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/sessions/:id/stream", async (request, reply) => {
    const workspaceId = await requireWorkspace(request, reply);
    if (!workspaceId) return reply;
    const session = await loadSession(kysely, request.params.id, workspaceId);
    if (!session) {
      reply.code(404).send({ error: "session_not_found" });
      return reply;
    }
    if (runtime.events(session.id).length === 0) {
      runtime.seed(session.id, await hydrateSessionEvents(kysely, session.id));
    }
    runtime.subscribe(session.id, reply);
    return reply;
  });
}
