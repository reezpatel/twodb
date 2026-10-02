import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";

export const assistantRoutes = new Hono()
  .get("/threads", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const rows = await db.selectFrom("assistant_thread").selectAll().where("organizationId", "=", s.organizationId).orderBy("updatedAt", "desc").execute();
    return c.json(rows);
  })

  .post("/threads", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const now = new Date();
    const row = await db
      .insertInto("assistant_thread")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        title: "New chat",
        connectionId: null,
        model: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .get("/threads/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const thread = await db
      .selectFrom("assistant_thread")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!thread) return c.json({ error: "thread_not_found" }, 404);

    const [messages, artifacts, usage] = await Promise.all([
      db.selectFrom("assistant_message").selectAll().where("threadId", "=", thread.id).orderBy("createdAt", "asc").execute(),
      db.selectFrom("assistant_artifact").selectAll().where("threadId", "=", thread.id).orderBy("updatedAt", "desc").execute(),
      db
        .selectFrom("llm_usage_event")
        .select((eb) => [
          eb.fn.sum("inputTokens").as("inputTokens"),
          eb.fn.sum("outputTokens").as("outputTokens"),
          eb.fn.sum("cachedInputTokens").as("cachedTokens"),
        ])
        .where("correlationId", "=", thread.id)
        .executeTakeFirst(),
    ]);

    return c.json({
      ...thread,
      messages,
      artifacts: artifacts.map((a) => ({ ...a, updatedAt: a.updatedAt.toISOString() })),
      usage: {
        inputTokens: Number(usage?.inputTokens ?? 0),
        outputTokens: Number(usage?.outputTokens ?? 0),
        cachedTokens: Number(usage?.cachedTokens ?? 0),
        contextTokens: 0,
      },
    });
  })

  .patch("/threads/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const thread = await db
      .selectFrom("assistant_thread")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!thread) return c.json({ error: "thread_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ title: string; connectionId: string | null; model: string | null; thinkingLevel: string }> = {};
    if (body?.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) return c.json({ error: "invalid_title" }, 400);
      patch.title = body.title.trim();
    }
    if (body?.connectionId !== undefined) {
      if (body.connectionId === null) {
        patch.connectionId = null;
      } else if (typeof body.connectionId === "string" && body.connectionId) {
        const conn = await db
          .selectFrom("llm_connection")
          .select("id")
          .where("id", "=", body.connectionId)
          .where("organizationId", "=", s.organizationId)
          .executeTakeFirst();
        if (!conn) return c.json({ error: "connection_not_found" }, 404);
        patch.connectionId = body.connectionId;
      }
    }
    if (body?.model !== undefined) {
      patch.model = typeof body.model === "string" && body.model.trim() ? body.model.trim().slice(0, 200) : null;
    }
    if (body?.thinkingLevel !== undefined) {
      if (typeof body.thinkingLevel !== "string" || !["off", "low", "medium", "high"].includes(body.thinkingLevel)) {
        return c.json({ error: "invalid_thinking_level" }, 400);
      }
      patch.thinkingLevel = body.thinkingLevel;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("assistant_thread")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", thread.id)
      .returningAll()
      .executeTakeFirst();
    return c.json(row);
  })

  .delete("/threads/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const row = await db
      .deleteFrom("assistant_thread")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "thread_not_found" }, 404);
    await db.deleteFrom("assistant_message").where("threadId", "=", row.id).execute();
    await db.deleteFrom("assistant_artifact").where("threadId", "=", row.id).execute();
    return c.json({ ok: true });
  });
