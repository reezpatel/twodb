import { z } from "zod";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { createPgDb } from "@twodb/core-data/db";
import { createAsyncEngine } from "@twodb/core-async/engine";
import { INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER, handleManifestRequest } from "@twodb/core-platform/manifest";
import { twodooManifest } from "./manifest.js";
import type { TwoDooConfig } from "./config.js";
import { applySchema, type TwoDooDb } from "./db/schema.js";
import { createTwoDooRepo, type SpaceScope, type SmartList } from "./db/repository.js";
import { readForwardedContext, type ForwardedContext } from "./gateway-context.js";

/**
 * TwoDoo HTTP server. All routes assume the Gateway fronted the request
 * (identity in x-twodb-* headers) — the read-side pattern from twochat.
 * Space scoping comes from x-twodb-space-ids (empty = all spaces).
 */
export async function buildServer(config: TwoDooConfig) {
  const app = Fastify({ logger: true });
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  const db = createPgDb<TwoDooDb>({ connectionString: config.DATABASE_URL, schema: "twodoo" });
  await applySchema(db);
  const repo = createTwoDooRepo(db);
  const asyncEngine = createAsyncEngine({ connectionString: config.DATABASE_URL, schema: "twodoo" });
  await asyncEngine.init();

  // --- identity ---------------------------------------------------------------

  const requireCtx = (req: FastifyRequest, reply: FastifyReply): ForwardedContext | null => {
    const ctx = readForwardedContext(req);
    if (!ctx) {
      void reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    return ctx;
  };

  const scopeOf = (ctx: ForwardedContext): SpaceScope => ({ workspaceId: ctx.workspaceId, spaceIds: ctx.spaceIds });

  const body = (raw: unknown): Record<string, unknown> => {
    if (!raw || typeof raw !== "object") return {};
    if (Buffer.isBuffer(raw)) {
      try {
        return JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return raw as Record<string, unknown>;
  };

  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  const nullableStr = (v: unknown): string | null | undefined => (v === null ? null : typeof v === "string" ? v : undefined);
  const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
  const strArr = (v: unknown): string[] | undefined => (Array.isArray(v) && v.every((x) => typeof x === "string") ? v : undefined);
  const numArr = (v: unknown): number[] | null | undefined =>
    v === null ? null : Array.isArray(v) && v.every((x) => typeof x === "number") ? v : undefined;

  // --- boards / lists -----------------------------------------------------------

  app.get("/boards", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    return repo.listBoards(scopeOf(ctx));
  });

  app.post("/boards", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const spaceId = str(input.spaceId);
    const name = str(input.name);
    if (!spaceId || !name) return reply.code(400).send({ error: "spaceId and name required" });
    const created = await repo.createBoard(scopeOf(ctx), {
      spaceId,
      parentId: nullableStr(input.parentId) ?? null,
      name,
      color: nullableStr(input.color) ?? null,
      icon: nullableStr(input.icon) ?? null,
    });
    if (!created) return reply.code(400).send({ error: "invalid_parent_or_space" });
    return created;
  });

  app.patch("/boards/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    try {
      const updated = await repo.updateBoard(scopeOf(ctx), (req.params as { id: string }).id, {
        name: str(input.name),
        color: nullableStr(input.color),
        icon: nullableStr(input.icon),
        parentId: nullableStr(input.parentId),
        position: num(input.position),
        collapsed: bool(input.collapsed),
      });
      if (!updated) return reply.code(404).send({ error: "not_found" });
      return updated;
    } catch (err) {
      if ((err as Error).message === "cycle") return reply.code(400).send({ error: "would_create_cycle" });
      throw err;
    }
  });

  app.delete("/boards/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    await repo.deleteBoard(scopeOf(ctx), (req.params as { id: string }).id);
    return { ok: true };
  });

  app.post("/lists", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const boardId = str(input.boardId);
    const name = str(input.name);
    if (!boardId || !name) return reply.code(400).send({ error: "boardId and name required" });
    const created = await repo.createList(scopeOf(ctx), { boardId, name, color: nullableStr(input.color) ?? null, icon: nullableStr(input.icon) ?? null });
    if (!created) return reply.code(404).send({ error: "board_not_found" });
    return created;
  });

  app.patch("/lists/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const updated = await repo.updateList(scopeOf(ctx), (req.params as { id: string }).id, {
      name: str(input.name),
      color: nullableStr(input.color),
      icon: nullableStr(input.icon),
      boardId: str(input.boardId),
      position: num(input.position),
    });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return updated;
  });

  app.delete("/lists/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    await repo.deleteList(scopeOf(ctx), (req.params as { id: string }).id);
    return { ok: true };
  });

  // --- tasks ----------------------------------------------------------------------

  app.get("/tasks", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const q = req.query as Record<string, string | undefined>;
    return repo.listTasks(scopeOf(ctx), {
      listId: q.listId,
      boardId: q.boardId,
      smart: (q.smart as SmartList | undefined) ?? undefined,
      status: (q.status as "open" | "done" | "trashed" | "any" | undefined) ?? undefined,
      tagId: q.tagId,
      q: q.q,
      from: q.from,
      to: q.to,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  });

  app.post("/tasks", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const listId = str(input.listId);
    const title = str(input.title);
    if (!listId || !title) return reply.code(400).send({ error: "listId and title required" });
    const created = await repo.createTask(scopeOf(ctx), {
      listId,
      parentId: nullableStr(input.parentId) ?? null,
      title,
      descriptionHtml: nullableStr(input.descriptionHtml) ?? null,
      priority: (str(input.priority) as "none" | "low" | "medium" | "high" | "urgent" | undefined) ?? "none",
      startAt: nullableStr(input.startAt) ?? null,
      endAt: nullableStr(input.endAt) ?? null,
      allDay: bool(input.allDay) ?? false,
      recurrenceRule: nullableStr(input.recurrenceRule) ?? null,
      habitId: nullableStr(input.habitId) ?? null,
      assigneeUserId: nullableStr(input.assigneeUserId) ?? null,
      tagIds: strArr(input.tagIds),
      tagNames: strArr(input.tagNames),
    });
    if (!created) return reply.code(404).send({ error: "list_not_found" });
    return created;
  });

  app.get("/tasks/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const task = await repo.getTask(scopeOf(ctx), (req.params as { id: string }).id);
    if (!task) return reply.code(404).send({ error: "not_found" });
    return task;
  });

  app.patch("/tasks/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const updated = await repo.updateTask(scopeOf(ctx), (req.params as { id: string }).id, {
      listId: str(input.listId),
      parentId: nullableStr(input.parentId),
      title: str(input.title),
      descriptionHtml: nullableStr(input.descriptionHtml),
      status: str(input.status) as "open" | "done" | "trashed" | undefined,
      priority: str(input.priority) as "none" | "low" | "medium" | "high" | "urgent" | undefined,
      startAt: nullableStr(input.startAt),
      endAt: nullableStr(input.endAt),
      allDay: bool(input.allDay),
      recurrenceRule: nullableStr(input.recurrenceRule),
      habitId: nullableStr(input.habitId),
      assigneeUserId: nullableStr(input.assigneeUserId),
      position: num(input.position),
      tagIds: strArr(input.tagIds),
    });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return updated;
  });

  app.delete("/tasks/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    await repo.deleteTask(scopeOf(ctx), (req.params as { id: string }).id);
    return { ok: true };
  });

  app.post("/tasks/:id/complete", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const done = bool(input.done) ?? true;
    try {
      return await repo.completeTask(scopeOf(ctx), (req.params as { id: string }).id, done);
    } catch (err) {
      if ((err as Error).message === "not_found") return reply.code(404).send({ error: "not_found" });
      throw err;
    }
  });

  app.post("/tasks/reorder", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const taskId = str(input.taskId);
    if (!taskId) return reply.code(400).send({ error: "taskId required" });
    await repo.reorderTasks(scopeOf(ctx), taskId, nullableStr(input.beforeId) ?? null, nullableStr(input.afterId) ?? null, str(input.listId));
    return { ok: true };
  });

  // --- checklist --------------------------------------------------------------------

  app.post("/tasks/:id/checklist", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const content = str(input.content);
    if (!content) return reply.code(400).send({ error: "content required" });
    const item = await repo.addChecklistItem(scopeOf(ctx), (req.params as { id: string }).id, content);
    if (!item) return reply.code(404).send({ error: "task_not_found" });
    return item;
  });

  app.patch("/checklist/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const updated = await repo.updateChecklistItem(scopeOf(ctx), (req.params as { id: string }).id, {
      content: str(input.content),
      checked: bool(input.checked),
      position: num(input.position),
    });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return updated;
  });

  app.delete("/checklist/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const ok = await repo.deleteChecklistItem(scopeOf(ctx), (req.params as { id: string }).id);
    return { ok };
  });

  // --- tags ---------------------------------------------------------------------------

  app.get("/tags", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    return repo.listTags(scopeOf(ctx));
  });

  app.post("/tags", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const spaceId = str(input.spaceId);
    const name = str(input.name);
    if (!spaceId || !name) return reply.code(400).send({ error: "spaceId and name required" });
    return repo.ensureTag(scopeOf(ctx), spaceId, name);
  });

  app.patch("/tags/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const updated = await repo.updateTag(scopeOf(ctx), (req.params as { id: string }).id, { name: str(input.name), color: nullableStr(input.color) });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return updated;
  });

  app.delete("/tags/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const ok = await repo.deleteTag(scopeOf(ctx), (req.params as { id: string }).id);
    return { ok };
  });

  // --- overview --------------------------------------------------------------------------

  app.get("/overview", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const scope = scopeOf(ctx);
    // First use in a space with nothing: seed a default board + Inbox list so
    // the home page never renders an empty world with no affordance.
    const seedSpace = ctx.spaceIds.length === 1 ? ctx.spaceIds[0] : null;
    if (seedSpace) await repo.ensureDefaultStructure(scope, seedSpace);
    return repo.overview(scope);
  });

  // --- habits ---------------------------------------------------------------------------

  app.get("/habits", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const q = req.query as Record<string, string | undefined>;
    return repo.listHabits(scopeOf(ctx), q.from, q.to);
  });

  app.post("/habits", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const spaceId = str(input.spaceId);
    const name = str(input.name);
    if (!spaceId || !name) return reply.code(400).send({ error: "spaceId and name required" });
    return repo.createHabit(scopeOf(ctx), {
      spaceId,
      name,
      color: nullableStr(input.color) ?? null,
      icon: nullableStr(input.icon) ?? null,
      schedule: (str(input.schedule) as "daily" | "weekly" | "interval" | "monthly" | undefined) ?? "daily",
      intervalDays: num(input.intervalDays) ?? null,
      byWeekday: numArr(input.byWeekday),
      targetCount: num(input.targetCount) ?? 1,
      goalStreak: num(input.goalStreak) ?? null,
      direction: (str(input.direction) as "build" | "quit" | undefined) ?? "build",
    });
  });

  app.patch("/habits/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const updated = await repo.updateHabit(scopeOf(ctx), (req.params as { id: string }).id, {
      name: str(input.name),
      color: nullableStr(input.color),
      icon: nullableStr(input.icon),
      schedule: str(input.schedule) as "daily" | "weekly" | "interval" | "monthly" | undefined,
      intervalDays: num(input.intervalDays),
      byWeekday: numArr(input.byWeekday),
      targetCount: num(input.targetCount),
      goalStreak: num(input.goalStreak),
      direction: str(input.direction) as "build" | "quit" | undefined,
      archived: bool(input.archived),
    });
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return updated;
  });

  app.delete("/habits/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const ok = await repo.deleteHabit(scopeOf(ctx), (req.params as { id: string }).id);
    return { ok };
  });

  app.post("/habits/:id/logs", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return;
    const input = body(req.body);
    const date = str(input.date);
    const delta = num(input.delta) ?? 1;
    if (!date) return reply.code(400).send({ error: "date required" });
    const log = await repo.logHabit(scopeOf(ctx), (req.params as { id: string }).id, date, delta);
    return log;
  });

  // --- infra -------------------------------------------------------------------------------

  app.get("/healthz", async () => ({ ok: true, app: "twodoo" }));

  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    if (!config.TWODB_PROVISION_TOKEN) return reply.code(404).send({ error: "not_configured" });
    const res = handleManifestRequest(twodooManifest, {
      registrationToken: config.TWODB_PROVISION_TOKEN,
      httpUrl: config.HTTP_URL,
    }, (req.headers[REGISTRATION_TOKEN_HEADER] as string | undefined) ?? undefined);
    return reply.code(res.status).send(res.body);
  });

  return app;
}
