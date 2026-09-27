import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import type { CodeSessionMode, CodeSessionType } from "../plugins/db";

export const codeRoutes = new Hono()
  .get("/directories", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db.selectFrom("code_directory").selectAll().where("organizationId", "=", s.organizationId).orderBy("createdAt", "asc").execute();
    return c.json(rows);
  })

  .post("/directories", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.runnerId !== "string" || !body.runnerId) return c.json({ error: "invalid_runner" }, 400);
    if (typeof body?.cwd !== "string" || !body.cwd.trim()) return c.json({ error: "invalid_cwd" }, 400);
    if (typeof body?.displayName !== "string" || !body.displayName.trim()) {
      return c.json({ error: "invalid_display_name" }, 400);
    }

    const runner = await db
      .selectFrom("runner")
      .select("id")
      .where("id", "=", body.runnerId)
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!runner) return c.json({ error: "runner_not_found" }, 404);

    const now = new Date();
    const row = await db
      .insertInto("code_directory")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        runnerId: runner.id,
        cwd: body.cwd.trim(),
        displayName: body.displayName.trim(),
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .get("/directories/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .selectFrom("code_directory")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!row) return c.json({ error: "directory_not_found" }, 404);
    return c.json(row);
  })

  .patch("/directories/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const existing = await db
      .selectFrom("code_directory")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "directory_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ runnerId: string; cwd: string; displayName: string }> = {};
    if (body?.runnerId !== undefined) {
      if (typeof body.runnerId !== "string" || !body.runnerId) return c.json({ error: "invalid_runner" }, 400);
      const runner = await db
        .selectFrom("runner")
        .select("id")
        .where("id", "=", body.runnerId)
        .where("organizationId", "=", s.organizationId)
        .where("deletedAt", "is", null)
        .executeTakeFirst();
      if (!runner) return c.json({ error: "runner_not_found" }, 404);
      patch.runnerId = runner.id;
    }
    if (body?.cwd !== undefined) {
      if (typeof body.cwd !== "string" || !body.cwd.trim()) return c.json({ error: "invalid_cwd" }, 400);
      patch.cwd = body.cwd.trim();
    }
    if (body?.displayName !== undefined) {
      if (typeof body.displayName !== "string" || !body.displayName.trim()) {
        return c.json({ error: "invalid_display_name" }, 400);
      }
      patch.displayName = body.displayName.trim();
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("code_directory")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  .delete("/directories/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.deleteFrom("code_directory").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "directory_not_found" }, 404);
    return c.json({ ok: true });
  })

  .get("/sessions", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("code_session").selectAll().where("organizationId", "=", s.organizationId);

    const type = c.req.query("type");
    if (type === "sub_agent") query = query.where("type", "=", "sub_agent");
    else if (type !== "all") query = query.where("type", "=", "main_agent");

    const parentSessionId = c.req.query("parentSessionId");
    if (parentSessionId) query = query.where("parentSessionId", "=", parentSessionId);

    const codeDirectoryId = c.req.query("codeDirectoryId");
    if (codeDirectoryId) query = query.where("codeDirectoryId", "=", codeDirectoryId);

    const rows = await query.orderBy("updatedAt", "desc").execute();
    return c.json(rows);
  })

  .post("/sessions", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);

    let type: CodeSessionType = "main_agent";
    if (body?.type !== undefined) {
      if (body.type !== "main_agent" && body.type !== "sub_agent") {
        return c.json({ error: "invalid_type" }, 400);
      }
      type = body.type;
    }

    let title = "New chat";
    if (body?.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return c.json({ error: "invalid_title" }, 400);
      }
      title = body.title.trim();
    }

    let parentSessionId: string | null = null;
    if (body?.parentSessionId !== undefined && body.parentSessionId !== null) {
      if (typeof body.parentSessionId !== "string") {
        return c.json({ error: "invalid_parent" }, 400);
      }
      const parent = await db
        .selectFrom("code_session")
        .select("id")
        .where("id", "=", body.parentSessionId)
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!parent) return c.json({ error: "parent_not_found" }, 404);
      parentSessionId = parent.id;
    }
    if (type === "sub_agent" && !parentSessionId) {
      return c.json({ error: "parent_required" }, 400);
    }
    if (type === "main_agent" && parentSessionId) {
      return c.json({ error: "parent_not_allowed" }, 400);
    }

    let codeDirectoryId: string | null = null;
    if (body?.codeDirectoryId !== undefined && body.codeDirectoryId !== null) {
      if (typeof body.codeDirectoryId !== "string") {
        return c.json({ error: "invalid_directory" }, 400);
      }
      const directory = await db
        .selectFrom("code_directory")
        .select("id")
        .where("id", "=", body.codeDirectoryId)
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!directory) return c.json({ error: "directory_not_found" }, 404);
      codeDirectoryId = directory.id;
    }

    let agentId: string | null = null;
    if (body?.agentId !== undefined && body.agentId !== null) {
      if (typeof body.agentId !== "string") {
        return c.json({ error: "invalid_agent" }, 400);
      }
      const agent = await db
        .selectFrom("agent")
        .select(["id", "codeDirectoryId"])
        .where("id", "=", body.agentId)
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!agent) return c.json({ error: "agent_not_found" }, 404);
      if (agent.codeDirectoryId && agent.codeDirectoryId !== codeDirectoryId) {
        return c.json({ error: "agent_scope_mismatch" }, 400);
      }
      agentId = agent.id;
    }

    let mode: CodeSessionMode | null = null;
    if (body?.mode !== undefined && body.mode !== null) {
      const m = body.mode;
      if (typeof m?.type !== "string" || !m.type.trim() || typeof m?.instruction !== "string") {
        return c.json({ error: "invalid_mode" }, 400);
      }
      const commands = m.commands === undefined ? [] : m.commands;
      if (!Array.isArray(commands) || commands.some((cmd) => typeof cmd !== "string")) {
        return c.json({ error: "invalid_mode" }, 400);
      }
      mode = { type: m.type.trim(), instruction: m.instruction, commands };
    }

    const now = new Date();
    const row = await db
      .insertInto("code_session")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        title,
        connectionId: null,
        model: null,
        codeDirectoryId,
        type,
        parentSessionId,
        agentId,
        mode: mode === null ? null : JSON.stringify(mode),
        runtimeState: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .get("/sessions/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const session = await db
      .selectFrom("code_session")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!session) return c.json({ error: "session_not_found" }, 404);

    const messages = await db.selectFrom("code_session_message").selectAll().where("sessionId", "=", session.id).orderBy("createdAt", "asc").execute();

    const subagents = await db
      .selectFrom("code_session")
      .select(["id", "title", "type", "mode", "createdAt", "updatedAt"])
      .where("parentSessionId", "=", session.id)
      .orderBy("createdAt", "asc")
      .execute();

    const usage = await db
      .selectFrom("code_session_usage_event")
      .select((eb) => [
        eb.fn.sum("inputTokens").as("inputTokens"),
        eb.fn.sum("outputTokens").as("outputTokens"),
        eb.fn.sum("cachedInputTokens").as("cachedTokens"),
      ])
      .where("sessionId", "=", session.id)
      .executeTakeFirst();
    const lastRound = await db
      .selectFrom("code_session_usage_event")
      .select(["inputTokens", "outputTokens"])
      .where("sessionId", "=", session.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst();

    return c.json({
      ...session,
      messages,
      subagents,
      usage: {
        inputTokens: Number(usage?.inputTokens ?? 0),
        outputTokens: Number(usage?.outputTokens ?? 0),
        cachedTokens: Number(usage?.cachedTokens ?? 0),
        contextTokens: lastRound ? lastRound.inputTokens + lastRound.outputTokens : 0,
      },
    });
  })

  .patch("/sessions/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const session = await db
      .selectFrom("code_session")
      .select(["id", "codeDirectoryId"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!session) return c.json({ error: "session_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{
      title: string;
      agentId: string | null;
      codeDirectoryId: string | null;
      mode: string | null;
      runtimeState: string | null;
    }> = {};

    if (body?.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return c.json({ error: "invalid_title" }, 400);
      }
      patch.title = body.title.trim();
    }
    if (body?.agentId !== undefined) {
      if (body.agentId === null) {
        patch.agentId = null;
      } else {
        if (typeof body.agentId !== "string") {
          return c.json({ error: "invalid_agent" }, 400);
        }
        const agent = await db
          .selectFrom("agent")
          .select(["id", "codeDirectoryId"])
          .where("id", "=", body.agentId)
          .where("organizationId", "=", s.organizationId)
          .executeTakeFirst();
        if (!agent) return c.json({ error: "agent_not_found" }, 404);
        const effectiveDirectoryId = patch.codeDirectoryId !== undefined ? patch.codeDirectoryId : session.codeDirectoryId;
        if (agent.codeDirectoryId && agent.codeDirectoryId !== effectiveDirectoryId) {
          return c.json({ error: "agent_scope_mismatch" }, 400);
        }
        patch.agentId = agent.id;
      }
    }
    if (body?.runtimeState !== undefined) {
      if (body.runtimeState === null) {
        patch.runtimeState = null;
      } else if (typeof body.runtimeState === "object" && !Array.isArray(body.runtimeState)) {
        patch.runtimeState = JSON.stringify(body.runtimeState);
      } else {
        return c.json({ error: "invalid_runtime_state" }, 400);
      }
    }
    if (body?.mode !== undefined) {
      if (body.mode === null) {
        patch.mode = null;
      } else {
        const m = body.mode;
        if (typeof m?.type !== "string" || !m.type.trim() || typeof m?.instruction !== "string") {
          return c.json({ error: "invalid_mode" }, 400);
        }
        const commands = m.commands === undefined ? [] : m.commands;
        if (!Array.isArray(commands) || commands.some((cmd) => typeof cmd !== "string")) {
          return c.json({ error: "invalid_mode" }, 400);
        }
        patch.mode = JSON.stringify({ type: m.type.trim(), instruction: m.instruction, commands });
      }
    }
    if (body?.codeDirectoryId !== undefined) {
      if (body.codeDirectoryId === null) {
        patch.codeDirectoryId = null;
      } else {
        if (typeof body.codeDirectoryId !== "string") {
          return c.json({ error: "invalid_directory" }, 400);
        }
        const directory = await db
          .selectFrom("code_directory")
          .select("id")
          .where("id", "=", body.codeDirectoryId)
          .where("organizationId", "=", s.organizationId)
          .executeTakeFirst();
        if (!directory) return c.json({ error: "directory_not_found" }, 404);
        patch.codeDirectoryId = directory.id;
      }
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: "empty_update" }, 400);
    }

    const row = await db
      .updateTable("code_session")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", session.id)
      .returningAll()
      .executeTakeFirst();
    return c.json(row);
  })

  .delete("/sessions/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .deleteFrom("code_session")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "session_not_found" }, 404);
    return c.json({ ok: true });
  });
