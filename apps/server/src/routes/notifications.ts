import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { registryPayload } from "../lib/notifications/registry";
import { publishState, viewOf } from "../lib/notifications/notify";
import type { ChannelSet } from "../lib/notifications/registry";

// Notification REST surface. All reads are recipient-joined (my feed, my
// unseen/unread counts); state changes echo to the user's sockets for
// cross-device sync. Ephemeral notifications never appear here.

interface FeedParams {
  state: "active" | "unread" | "archived";
  group?: string;
  before?: string;
  limit: number;
}

function notificationView(row: { seenAt: Date | null; readAt: Date | null; dismissedAt: Date | null } & Record<string, unknown>) {
  return viewOf(row as never, { seenAt: row.seenAt, readAt: row.readAt, dismissedAt: row.dismissedAt });
}

async function feedFor(organizationId: string, userId: string, p: FeedParams) {
  let q = db
    .selectFrom("notification")
    .innerJoin("notification_recipient", (join) => join.onRef("notification_recipient.notificationId", "=", "notification.id").onRef("notification_recipient.userId", "=", (eb) => eb.val(userId)))
    .selectAll("notification")
    .select(["notification_recipient.seenAt as seenAt", "notification_recipient.readAt as readAt", "notification_recipient.dismissedAt as dismissedAt"])
    .where("notification.organizationId", "=", organizationId)
    .where("notification.expiresAt", ">", new Date())
    .orderBy("notification.createdAt", "desc")
    .limit(Math.min(Math.max(p.limit, 1), 100));

  if (p.state === "archived") q = q.where("notification_recipient.dismissedAt", "is not", null as never);
  else {
    q = q.where("notification_recipient.dismissedAt", "is", null);
    if (p.state === "unread") q = q.where("notification_recipient.readAt", "is", null);
  }
  if (p.group) q = q.where("notification.origin", "=", p.group);
  if (p.before) q = q.where("notification.createdAt", "<", new Date(p.before));

  const rows = await q.execute();
  return rows.map((r) => notificationView(r as never));
}

async function countsFor(organizationId: string, userId: string) {
  const [unseen] = await db
    .selectFrom("notification")
    .innerJoin("notification_recipient", (join) => join.onRef("notification_recipient.notificationId", "=", "notification.id").onRef("notification_recipient.userId", "=", (eb) => eb.val(userId)))
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("notification.organizationId", "=", organizationId)
    .where("notification.expiresAt", ">", new Date())
    .where("notification_recipient.dismissedAt", "is", null)
    .where("notification_recipient.seenAt", "is", null)
    .execute();
  const [unread] = await db
    .selectFrom("notification")
    .innerJoin("notification_recipient", (join) => join.onRef("notification_recipient.notificationId", "=", "notification.id").onRef("notification_recipient.userId", "=", (eb) => eb.val(userId)))
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("notification.organizationId", "=", organizationId)
    .where("notification.expiresAt", ">", new Date())
    .where("notification_recipient.dismissedAt", "is", null)
    .where("notification_recipient.seenAt", "is", null)
    .where("notification_recipient.readAt", "is", null)
    .execute();
  return { unseen: Number(unseen?.n ?? 0), unread: Number(unread?.n ?? 0) };
}

async function loadOne(organizationId: string, userId: string, id: string) {
  return db
    .selectFrom("notification")
    .innerJoin("notification_recipient", (join) => join.onRef("notification_recipient.notificationId", "=", "notification.id").onRef("notification_recipient.userId", "=", (eb) => eb.val(userId)))
    .selectAll("notification")
    .select(["notification_recipient.seenAt as seenAt", "notification_recipient.readAt as readAt", "notification_recipient.dismissedAt as dismissedAt"])
    .where("notification.id", "=", id)
    .where("notification.organizationId", "=", organizationId)
    .executeTakeFirst();
}

export const notificationRoutes = new Hono()

  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const state = (c.req.query("state") ?? "active") as FeedParams["state"];
    if (!["active", "unread", "archived"].includes(state)) return c.json({ error: "invalid_state" }, 400);
    const items = await feedFor(s.organizationId, s.session.user.id, {
      state,
      group: c.req.query("group") ?? undefined,
      before: c.req.query("before") ?? undefined,
      limit: Number(c.req.query("limit") ?? 40),
    });
    const counts = await countsFor(s.organizationId, s.session.user.id);
    return c.json({ items, counts, nextCursor: items.length ? items[items.length - 1].createdAt : null });
  })

  .get("/counts", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    return c.json(await countsFor(s.organizationId, s.session.user.id));
  })

  .post("/seen", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json().catch(() => null)) as { ids?: string[] } | null;
    const ids = (body?.ids ?? []).filter((x): x is string => typeof x === "string").slice(0, 200);
    if (!ids.length) return c.json({ error: "invalid_ids" }, 400);
    const now = new Date();
    for (const id of ids) {
      await db
        .updateTable("notification_recipient")
        .set({ seenAt: now })
        .where("notificationId", "=", id)
        .where("userId", "=", s.session.user.id)
        .where("seenAt", "is", null)
        .execute();
      const row = await loadOne(s.organizationId, s.session.user.id, id);
      if (row) publishState(s.session.user.id, notificationView(row as never));
    }
    return c.json(await countsFor(s.organizationId, s.session.user.id));
  })

  .post("/read-all", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const now = new Date();
    await db
      .updateTable("notification_recipient")
      .set({ readAt: now, seenAt: now })
      .where("userId", "=", s.session.user.id)
      .where("organizationId", "=", s.organizationId)
      .where("readAt", "is", null)
      .execute();
    return c.json(await countsFor(s.organizationId, s.session.user.id));
  })

  .get("/settings", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const rows = await db
      .selectFrom("notification_preference")
      .selectAll()
      .where("organizationId", "=", s.organizationId)
      .where("userId", "=", s.session.user.id)
      .execute();
    return c.json({
      preferences: rows.map((r) => ({ groupId: r.groupId, typeId: r.typeId, channels: r.channels as ChannelSet, urgencyFloor: r.urgencyFloor })),
    });
  })

  .put("/settings", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json().catch(() => null)) as { groupId?: string; typeId?: string | null; channels?: ChannelSet; urgencyFloor?: string | null } | null;
    if (!body?.groupId) return c.json({ error: "invalid_body" }, 400);
    const channels = body.channels ?? {};
    const now = new Date();
    const existing = await db
      .selectFrom("notification_preference")
      .select("id")
      .where("organizationId", "=", s.organizationId)
      .where("userId", "=", s.session.user.id)
      .where("groupId", "=", body.groupId)
      .where((eb) => (body.typeId ? eb("typeId", "=", body.typeId) : eb("typeId", "is", null)))
      .executeTakeFirst();
    const values = {
      channels: JSON.stringify(channels) as never,
      urgencyFloor: body.urgencyFloor ?? null,
      updatedAt: now,
    };
    if (existing) {
      await db.updateTable("notification_preference").set(values).where("id", "=", existing.id).execute();
    } else {
      await db
        .insertInto("notification_preference")
        .values({ id: crypto.randomUUID(), organizationId: s.organizationId, userId: s.session.user.id, groupId: body.groupId, typeId: body.typeId ?? null, createdAt: now, ...values })
        .execute();
    }
    return c.json({ ok: true });
  })

  .delete("/settings", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const groupId = c.req.query("group");
    const typeId = c.req.query("type");
    if (!groupId) return c.json({ error: "invalid_group" }, 400);
    await db
      .deleteFrom("notification_preference")
      .where("organizationId", "=", s.organizationId)
      .where("userId", "=", s.session.user.id)
      .where("groupId", "=", groupId)
      .where((eb) => (typeId ? eb("typeId", "=", typeId) : eb("typeId", "is", null)))
      .execute();
    return c.json({ ok: true });
  })

  .get("/registry", (c) => c.json({ groups: registryPayload() }))

  .post("/:id/read", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const now = new Date();
    await db
      .updateTable("notification_recipient")
      .set({ readAt: now, seenAt: now })
      .where("notificationId", "=", c.req.param("id"))
      .where("userId", "=", s.session.user.id)
      .execute();
    const row = await loadOne(s.organizationId, s.session.user.id, c.req.param("id"));
    if (!row) return c.json({ error: "not_found" }, 404);
    publishState(s.session.user.id, notificationView(row as never));
    return c.json(notificationView(row as never));
  })

  .post("/:id/dismiss", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const now = new Date();
    await db
      .updateTable("notification_recipient")
      .set({ dismissedAt: now, readAt: now, seenAt: now })
      .where("notificationId", "=", c.req.param("id"))
      .where("userId", "=", s.session.user.id)
      .execute();
    const row = await loadOne(s.organizationId, s.session.user.id, c.req.param("id"));
    if (!row) return c.json({ error: "not_found" }, 404);
    publishState(s.session.user.id, notificationView(row as never));
    return c.json(notificationView(row as never));
  })

  .post("/:id/unarchive", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    await db
      .updateTable("notification_recipient")
      .set({ dismissedAt: null })
      .where("notificationId", "=", c.req.param("id"))
      .where("userId", "=", s.session.user.id)
      .execute();
    const row = await loadOne(s.organizationId, s.session.user.id, c.req.param("id"));
    if (!row) return c.json({ error: "not_found" }, 404);
    publishState(s.session.user.id, notificationView(row as never));
    return c.json(notificationView(row as never));
  })

  .post("/:id/actions/:actionId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);
    const row = await loadOne(s.organizationId, s.session.user.id, c.req.param("id"));
    if (!row) return c.json({ error: "not_found" }, 404);
    const actions = (row.actions ?? []) as { id: string; verb: string; endpoint?: string; deepLink?: string }[];
    const action = actions.find((a) => a.id === c.req.param("actionId"));
    if (!action) return c.json({ error: "unknown_action" }, 404);
    if (action.verb === "link" || action.verb === "dismiss") return c.json({ ok: true, verb: action.verb, deepLink: action.deepLink ?? null });
    if (action.verb !== "api" || !action.endpoint) return c.json({ error: "invalid_action" }, 400);
    // Registry-declared endpoints only — validate the declared endpoint is
    // still in the registry for this type, then hand back to the client to
    // invoke with its own auth context.
    const { typeSpec } = await import("../lib/notifications/registry");
    const declared = typeSpec(String(row.type))?.type.actions?.find((a) => a.id === action.id);
    if (!declared?.endpoint || declared.endpoint !== action.endpoint) return c.json({ error: "action_not_allowed" }, 403);
    return c.json({ ok: true, verb: "api", endpoint: declared.endpoint });
  });
