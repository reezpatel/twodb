import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { runnerManager } from "../lib/runner-manager";
import { startAccount, stopAccount } from "../lib/teams/manager";

/** Teams bridge accounts — one row per watched Teams tenant/account, hosted
 *  by a runner's Chromium. Settings → Teams drives these endpoints. */
export const teamsRoutes = new Hono()
  .get("/accounts", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db.selectFrom("teams_account").selectAll().where("organizationId", "=", s.organizationId).orderBy("createdAt", "asc").execute();
    const online = runnerManager.onlineIds();
    return c.json(rows.map((r) => ({ ...r, runnerOnline: online.has(r.runnerId) })));
  })

  .post("/accounts", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    if (!s.session) return c.json({ error: "session_required" }, 401);

    const body = await c.req.json().catch(() => null);
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    const runnerId = typeof body?.runnerId === "string" ? body.runnerId : "";
    const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
    if (!label || !runnerId) return c.json({ error: "label_and_runner_required" }, 400);

    const runner = await db
      .selectFrom("runner")
      .select("id")
      .where("id", "=", runnerId)
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!runner) return c.json({ error: "runner_not_found" }, 404);

    const now = new Date();
    const row = await db
      .insertInto("teams_account")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        userId: s.session.user.id,
        runnerId,
        label,
        email,
        enabled: true,
        status: "idle",
        lastError: null,
        lastEventAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    startAccount(row);
    return c.json(row, 201);
  })

  .patch("/accounts/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body?.label === "string" && body.label.trim()) updates.label = body.label.trim();
    if (typeof body?.email === "string") updates.email = body.email.trim() || null;
    if (typeof body?.enabled === "boolean") updates.enabled = body.enabled;
    if (typeof body?.runnerId === "string") {
      const runner = await db
        .selectFrom("runner")
        .select("id")
        .where("id", "=", body.runnerId)
        .where("organizationId", "=", s.organizationId)
        .where("deletedAt", "is", null)
        .executeTakeFirst();
      if (!runner) return c.json({ error: "runner_not_found" }, 404);
      updates.runnerId = body.runnerId;
    }

    const row = await db
      .updateTable("teams_account")
      .set(updates)
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returningAll()
      .executeTakeFirst();
    if (!row) return c.json({ error: "account_not_found" }, 404);

    if (row.enabled) startAccount(row);
    else stopAccount(row);
    return c.json(row);
  })

  .delete("/accounts/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .deleteFrom("teams_account")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returningAll()
      .executeTakeFirst();
    if (!row) return c.json({ error: "account_not_found" }, 404);

    stopAccount(row);
    return c.json({ ok: true });
  })

  .post("/accounts/:id/start", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.selectFrom("teams_account").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "account_not_found" }, 404);
    if (!startAccount(row)) return c.json({ ok: false, status: "runner_offline" }, 502);
    return c.json({ ok: true });
  })

  .post("/accounts/:id/stop", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.selectFrom("teams_account").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "account_not_found" }, 404);
    stopAccount(row);
    return c.json({ ok: true });
  });
