import { Hono } from "hono";
import type { Selectable } from "kysely";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { readAssetBytesById, storeChatAsset } from "../lib/assets";
import { resolveResponders, triggerChatRuns } from "../lib/chat-agents";
import { broadcastChatEvent } from "./chat-ws";
import type { ChatChannelTable } from "../plugins/db";
import { logger } from "../lib/logger";

// Team chat REST: channels (tree), messages (single-level replies),
// reactions, pins, saved items, read state, drafts, inbox and collaborators.
// Agents are chat users: mentions and reply targets trigger agent runs whose
// answers land back as chat messages (lib/chat-agents).

interface MessagePayload {
  id: string;
  channelId: string;
  authorType: string;
  userId: string | null;
  agentId: string | null;
  body: string;
  meta: Record<string, unknown> | null;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  authorName: string;
  reactions: { emoji: string; count: number; mine: boolean }[];
  pinned: boolean;
  saved: boolean;
  replyTo: { id: string; authorName: string; snippet: string } | null;
}

async function loadActorNames(organizationId: string) {
  const agents = await db.selectFrom("agent").selectAll().where("organizationId", "=", organizationId).execute();
  const users = await db
    .selectFrom("member")
    .innerJoin("user", "user.id", "member.userId")
    .select(["member.userId", "user.name"])
    .where("member.organizationId", "=", organizationId)
    .execute();
  return {
    agents: new Map(agents.map((a) => [a.id, a])),
    names: new Map<string, string>([
      ...agents.map((a) => [a.id, a.name ?? a.description ?? a.type] as [string, string]),
      ...users.map((u) => [u.userId, u.name] as [string, string]),
    ]),
  };
}

async function hydrateMessages(
  organizationId: string,
  userId: string,
  rows: (Selectable<import("../plugins/db").ChatMessageTable> | { id: string; channelId: string; authorType: string; userId: string | null; agentId: string | null; body: string; meta: Record<string, unknown> | null; replyToId: string | null; editedAt: Date | null; deletedAt: Date | null; createdAt: Date })[],
): Promise<MessagePayload[]> {
  const { names } = await loadActorNames(organizationId);
  const ids = rows.map((r) => r.id);
  const reactions = ids.length
    ? await db.selectFrom("chat_reaction").select(["messageId", "userId", "emoji"]).where("messageId", "in", ids).execute()
    : [];
  const pins = ids.length ? await db.selectFrom("chat_pin").select("messageId").where("messageId", "in", ids).execute() : [];
  const saved = ids.length
    ? await db.selectFrom("chat_saved").select("messageId").where("messageId", "in", ids).where("userId", "=", userId).execute()
    : [];
  const replyIds = rows.map((r) => r.replyToId).filter((v): v is string => v !== null);
  const replyRows = replyIds.length
    ? await db
        .selectFrom("chat_message")
        .select(["id", "authorType", "userId", "agentId", "body"])
        .where("id", "in", replyIds)
        .execute()
    : [];

  const pinSet = new Set(pins.map((p) => p.messageId));
  const savedSet = new Set(saved.map((s) => s.messageId));
  const replyMap = new Map(
    replyRows.map((r) => [
      r.id,
      {
        id: r.id,
        authorName: r.authorType === "agent" ? (names.get(r.agentId ?? "") ?? "agent") : (names.get(r.userId ?? "") ?? "someone"),
        snippet: r.body.slice(0, 60),
      },
    ]),
  );

  return rows.map((r) => {
    const mine = reactions.filter((x) => x.messageId === r.id);
    const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const x of mine) {
      const entry = byEmoji.get(x.emoji) ?? { emoji: x.emoji, count: 0, mine: false };
      entry.count += 1;
      if (x.userId === userId) entry.mine = true;
      byEmoji.set(x.emoji, entry);
    }
    return {
      id: r.id,
      channelId: r.channelId,
      authorType: r.authorType,
      userId: r.userId,
      agentId: r.agentId,
      body: r.deletedAt ? "" : r.body,
      meta: r.meta,
      replyToId: r.replyToId,
      editedAt: r.editedAt?.toISOString() ?? null,
      deletedAt: r.deletedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      authorName: r.authorType === "agent" ? (names.get(r.agentId ?? "") ?? "agent") : (names.get(r.userId ?? "") ?? "someone"),
      reactions: [...byEmoji.values()],
      pinned: pinSet.has(r.id),
      saved: savedSet.has(r.id),
      replyTo: r.replyToId ? (replyMap.get(r.replyToId) ?? null) : null,
    };
  });
}

async function channelRow(organizationId: string, id: string): Promise<Selectable<ChatChannelTable> | undefined> {
  return db.selectFrom("chat_channel").selectAll().where("id", "=", id).where("organizationId", "=", organizationId).executeTakeFirst();
}

async function channelMembersPayload(organizationId: string, channelId: string) {
  const rows = await db.selectFrom("chat_channel_member").selectAll().where("channelId", "=", channelId).execute();
  const { agents, names } = await loadActorNames(organizationId);
  return rows.map((m) => ({
    id: m.id,
    memberType: m.memberType,
    userId: m.userId,
    agentId: m.agentId,
    name: m.memberType === "agent" ? (names.get(m.agentId ?? "") ?? "agent") : (names.get(m.userId ?? "") ?? "user"),
    role: m.memberType === "agent" ? (agents.get(m.agentId ?? "")?.description ?? "") : "member",
    agentType: m.memberType === "agent" ? (agents.get(m.agentId ?? "")?.type ?? null) : null,
  }));
}

async function unreadCounts(organizationId: string, userId: string) {
  const channels = await db.selectFrom("chat_channel").select(["id"]).where("organizationId", "=", organizationId).execute();
  const states = await db.selectFrom("chat_read_state").selectAll().where("userId", "=", userId).execute();
  const lastRead = new Map(states.map((s) => [s.channelId, s.lastReadMessageId]));
  const counts: Record<string, number> = {};
  for (const ch of channels) {
    const marker = lastRead.get(ch.id);
    const query = db
      .selectFrom("chat_message")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("channelId", "=", ch.id)
      .where("deletedAt", "is", null);
    const filtered = marker ? query.where("id", "<>", marker).where((eb) =>
        eb.or([eb("createdAt", ">", eb.selectFrom("chat_message").select("createdAt").where("id", "=", marker))]),
      ) : query;
    const row = await filtered.executeTakeFirst();
    counts[ch.id] = Number(row?.count ?? 0);
  }
  return counts;
}

const parseMentions = (body: string, names: Map<string, { id: string; type: string }>): { type: string; id: string; name: string }[] => {
  const found: { type: string; id: string; name: string }[] = [];
  for (const match of body.matchAll(/@([\w.-]+)/g)) {
    const hit = names.get(match[1].toLowerCase());
    if (hit) found.push({ type: hit.type, id: hit.id, name: match[1] });
  }
  return found;
};

export const chatRoutes = new Hono()

  .get("/channels", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const userId = s.session?.user.id;

    const channels = await db.selectFrom("chat_channel").selectAll().where("organizationId", "=", s.organizationId).orderBy("position", "asc").orderBy("createdAt", "asc").execute();
    const counts = userId ? await unreadCounts(s.organizationId, userId) : {};
    const members = await db.selectFrom("chat_channel_member").selectAll().where("organizationId", "=", s.organizationId).execute();

    const rows = channels.map((ch) => ({
      ...ch,
      unread: counts[ch.id] ?? 0,
      memberCount: members.filter((m) => m.channelId === ch.id).length,
    }));
    return c.json(rows);
  })

  .post("/channels", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.name !== "string" || !body.name.trim()) return c.json({ error: "invalid_name" }, 400);
    if (body?.parentId !== undefined && body.parentId !== null && typeof body.parentId !== "string") return c.json({ error: "invalid_parent" }, 400);
    if (body?.kind !== undefined && !["channel", "assistant"].includes(body.kind)) return c.json({ error: "invalid_kind" }, 400);
    const agentIds = Array.isArray(body?.memberAgentIds) ? (body.memberAgentIds as unknown[]).filter((v): v is string => typeof v === "string") : [];

    const now = new Date();
    const channel = await db
      .insertInto("chat_channel")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        codeDirectoryId: null,
        parentId: typeof body?.parentId === "string" && body.parentId ? body.parentId : null,
        kind: body?.kind === "assistant" ? "assistant" : "channel",
        name: body.name.trim(),
        description: typeof body?.description === "string" && body.description ? body.description : null,
        position: 0,
        createdById: s.session?.user.id ?? null,
        lastMessageAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const memberRows = [] as { memberType: string; userId: string | null; agentId: string | null }[];
    if (s.session?.user.id) memberRows.push({ memberType: "user", userId: s.session.user.id, agentId: null });
    for (const agentId of agentIds) memberRows.push({ memberType: "agent", userId: null, agentId });
    for (const m of memberRows) {
      await db
        .insertInto("chat_channel_member")
        .values({
          id: crypto.randomUUID(),
          organizationId: s.organizationId,
          channelId: channel.id,
          memberType: m.memberType,
          userId: m.userId,
          agentId: m.agentId,
          createdAt: now,
        })
        .execute();
    }

    broadcastChatEvent(s.organizationId, { type: "channel_created", channel });
    return c.json(channel, 201);
  })

  .patch("/channels/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ name: string; description: string | null; archivedAt: Date | null; position: number; parentId: string | null }> = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) return c.json({ error: "invalid_name" }, 400);
      patch.name = body.name.trim();
    }
    if (body?.description !== undefined) patch.description = typeof body.description === "string" && body.description ? body.description : null;
    if (body?.archived !== undefined) patch.archivedAt = body.archived ? new Date() : null;
    if (body?.position !== undefined && typeof body.position === "number") patch.position = body.position;
    if (body?.parentId !== undefined) patch.parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db.updateTable("chat_channel").set({ ...patch, updatedAt: new Date() }).where("id", "=", channel.id).returningAll().executeTakeFirstOrThrow();
    broadcastChatEvent(s.organizationId, { type: "channel_updated", channel: row });
    return c.json(row);
  })

  .delete("/channels/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);
    await db.deleteFrom("chat_channel").where("id", "=", channel.id).execute();
    broadcastChatEvent(s.organizationId, { type: "channel_deleted", id: channel.id });
    return c.json({ ok: true });
  })

  .get("/channels/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);

    const { names } = await loadActorNames(s.organizationId);
    const messageCount = Number(
      (await db.selectFrom("chat_message").select((eb) => eb.fn.countAll<number>().as("count")).where("channelId", "=", channel.id).where("deletedAt", "is", null).executeTakeFirst())?.count ?? 0,
    );
    const children = await db.selectFrom("chat_channel").select(["id", "name"]).where("parentId", "=", channel.id).execute();
    const buckets = await db
      .selectFrom("chat_message")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("channelId", "=", channel.id)
      .where("deletedAt", "is", null)
      .executeTakeFirst();

    return c.json({
      ...channel,
      creatorName: channel.createdById ? (names.get(channel.createdById) ?? null) : null,
      messageCount,
      activityTotal: Number(buckets?.count ?? 0),
      children: children.map((ch) => ({ id: ch.id, name: ch.name })),
      members: await channelMembersPayload(s.organizationId, channel.id),
    });
  })

  .get("/channels/:id/messages", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);
    if (!s.session) return c.json({ error: "unauthorized" }, 401);

    const before = c.req.query("before");
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
    let query = db.selectFrom("chat_message").selectAll().where("channelId", "=", channel.id);
    if (before) {
      const [iso, id] = before.split("~");
      const at = new Date(iso);
      if (Number.isNaN(at.getTime())) return c.json({ error: "invalid_before" }, 400);
      query = query.where((eb) => eb.or([eb("createdAt", "<", at), eb.and([eb("createdAt", "=", at), eb("id", "<", id ?? "")])]));
    }
    const rows = await query.orderBy("createdAt", "desc").limit(limit).execute();
    rows.reverse();
    const messages = await hydrateMessages(s.organizationId, s.session.user.id, rows);
    const next = rows.length === limit ? `${rows[0].createdAt.toISOString()}~${rows[0].id}` : null;
    return c.json({ messages, next });
  })

  .post("/channels/:id/messages", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);
    if (!s.session) return c.json({ error: "unauthorized" }, 401);
    const userId = s.session.user.id;

    const body = await c.req.json().catch(() => null);
    if (typeof body?.body !== "string" || !body.body.trim()) return c.json({ error: "invalid_body" }, 400);
    if (channel.archivedAt) return c.json({ error: "channel_archived" }, 409);

    // Clamp replies to roots — single level, never a sub-thread.
    let replyToId: string | null = null;
    if (typeof body?.replyToId === "string" && body.replyToId) {
      const target = await db.selectFrom("chat_message").select(["id", "channelId", "replyToId"]).where("id", "=", body.replyToId).where("organizationId", "=", s.organizationId).executeTakeFirst();
      if (!target || target.channelId !== channel.id) return c.json({ error: "reply_target_not_found" }, 400);
      replyToId = target.replyToId ?? target.id;
    }

    const attachments = Array.isArray(body?.attachments)
      ? (body.attachments as unknown[]).filter(
          (a): a is { mediaId: string; filename: string; contentType: string | null } =>
            typeof a === "object" && a !== null && typeof (a as { mediaId?: unknown }).mediaId === "string",
        )
      : [];
    if (attachments.length > 10) return c.json({ error: "too_many_attachments" }, 400);
    for (const a of attachments) {
      const asset = await db.selectFrom("media_asset").select("id").where("id", "=", a.mediaId).where("organizationId", "=", s.organizationId).executeTakeFirst();
      if (!asset) return c.json({ error: "attachment_not_found", detail: a.mediaId }, 400);
    }

    // Mentions: @name matched against channel + org actors.
    const members = await channelMembersPayload(s.organizationId, channel.id);
    const byName = new Map<string, { id: string; type: string }>();
    for (const m of members) if (m.name) byName.set(m.name.toLowerCase().replace(/\s+/g, ""), m.memberType === "agent" ? { id: m.agentId ?? "", type: "agent" } : { id: m.userId ?? "", type: "user" });
    const bodyMentions = [...body.body.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
    const mentions = [...byName.entries()].filter(([name]) => bodyMentions.some((b) => name === b || name.startsWith(b))).map(([name, v]) => ({ type: v.type, id: v.id, name }));

    const linkMatch = /(https?:\/\/[^\s]+)/.exec(body.body);
    const meta: Record<string, unknown> = {};
    if (mentions.length) meta.mentions = mentions;
    if (attachments.length) meta.attachments = attachments;
    if (linkMatch) meta.linkCard = { title: linkMatch[1], url: linkMatch[1] };

    const now = new Date();
    const row = await db
      .insertInto("chat_message")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        channelId: channel.id,
        authorType: "user",
        userId,
        agentId: null,
        body: body.body.trim(),
        meta: Object.keys(meta).length ? meta : null,
        replyToId,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await db.updateTable("chat_channel").set({ lastMessageAt: now, updatedAt: now }).where("id", "=", channel.id).execute();
    await db
      .insertInto("chat_read_state")
      .values({ id: crypto.randomUUID(), organizationId: s.organizationId, channelId: channel.id, userId, lastReadMessageId: row.id, updatedAt: now })
      .onConflict((oc) => oc.columns(["channelId", "userId"]).doUpdateSet({ lastReadMessageId: row.id, updatedAt: now }))
      .execute();

    const [payload] = await hydrateMessages(s.organizationId, userId, [row]);
    broadcastChatEvent(s.organizationId, { type: "message", channelId: channel.id, message: payload });

    const replyTarget = replyToId ? ((await db.selectFrom("chat_message").select(["id", "authorType", "userId", "agentId", "body", "meta", "replyToId"]).where("id", "=", replyToId).executeTakeFirst()) ?? null) : null;
    const responders = await resolveResponders(s.organizationId, channel, mentions, replyTarget as never);
    void triggerChatRuns({
      organizationId: s.organizationId,
      channel,
      responders,
      userMessageId: row.id,
      attachments: attachments.map((a) => ({ mediaId: a.mediaId, filename: a.filename, contentType: a.contentType })),
    });

    return c.json({ message: payload, triggered: responders.map((r) => ({ agentId: r.agent.id, reason: r.reason })) }, 201);
  })

  .delete("/messages/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const message = await db.selectFrom("chat_message").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!message) return c.json({ error: "message_not_found" }, 404);
    if (message.userId !== s.session?.user.id) return c.json({ error: "not_author" }, 403);

    await db.updateTable("chat_message").set({ deletedAt: new Date(), body: "" }).where("id", "=", message.id).execute();
    broadcastChatEvent(s.organizationId, { type: "message_deleted", channelId: message.channelId, messageId: message.id });
    return c.json({ ok: true });
  })

  .post("/messages/:id/reactions", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const message = await db.selectFrom("chat_message").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!message) return c.json({ error: "message_not_found" }, 404);
    if (!s.session) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.emoji !== "string" || !body.emoji.trim() || body.emoji.length > 16) return c.json({ error: "invalid_emoji" }, 400);
    const emoji = body.emoji.trim();
    const userId = s.session.user.id;

    const existing = await db.selectFrom("chat_reaction").select("id").where("messageId", "=", message.id).where("userId", "=", userId).where("emoji", "=", emoji).executeTakeFirst();
    if (existing) await db.deleteFrom("chat_reaction").where("id", "=", existing.id).execute();
    else
      await db
        .insertInto("chat_reaction")
        .values({ id: crypto.randomUUID(), organizationId: s.organizationId, messageId: message.id, authorType: "user", userId, emoji, createdAt: new Date() })
        .execute();

    const rows = await db.selectFrom("chat_reaction").select(["userId", "emoji"]).where("messageId", "=", message.id).execute();
    const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const r of rows) {
      const entry = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      entry.count += 1;
      if (r.userId === userId) entry.mine = true;
      byEmoji.set(r.emoji, entry);
    }
    const reactions = [...byEmoji.values()];
    broadcastChatEvent(s.organizationId, { type: "reaction", channelId: message.channelId, messageId: message.id, reactions });
    return c.json({ reactions });
  })

  .post("/messages/:id/pin", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const message = await db.selectFrom("chat_message").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!message) return c.json({ error: "message_not_found" }, 404);
    if (!s.session) return c.json({ error: "unauthorized" }, 401);

    const existing = await db.selectFrom("chat_pin").select("id").where("messageId", "=", message.id).executeTakeFirst();
    if (!existing)
      await db
        .insertInto("chat_pin")
        .values({ id: crypto.randomUUID(), organizationId: s.organizationId, channelId: message.channelId, messageId: message.id, createdById: s.session.user.id, createdAt: new Date() })
        .execute();
    return c.json({ pinned: true });
  })

  .delete("/messages/:id/pin", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    await db.deleteFrom("chat_pin").where("messageId", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).execute();
    return c.json({ pinned: false });
  })

  .post("/messages/:id/save", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const message = await db.selectFrom("chat_message").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!message) return c.json({ error: "message_not_found" }, 404);
    if (!s.session) return c.json({ error: "unauthorized" }, 401);

    await db
      .insertInto("chat_saved")
      .values({ id: crypto.randomUUID(), organizationId: s.organizationId, messageId: message.id, userId: s.session.user.id, createdAt: new Date() })
      .onConflict((oc) => oc.columns(["messageId", "userId"]).doUpdateSet({ createdAt: new Date() })
      )
      .execute();
    return c.json({ saved: true });
  })

  .delete("/messages/:id/save", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    if (!s.session) return c.json({ error: "unauthorized" }, 401);
    await db.deleteFrom("chat_saved").where("messageId", "=", c.req.param("id")).where("userId", "=", s.session.user.id).execute();
    return c.json({ saved: false });
  })

  .put("/channels/:id/read", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);
    if (!s.session) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const messageId = typeof body?.messageId === "string" ? body.messageId : null;
    await db
      .insertInto("chat_read_state")
      .values({ id: crypto.randomUUID(), organizationId: s.organizationId, channelId: channel.id, userId: s.session.user.id, lastReadMessageId: messageId, updatedAt: new Date() })
      .onConflict((oc) => oc.columns(["channelId", "userId"]).doUpdateSet({ lastReadMessageId: messageId, updatedAt: new Date() }))
      .execute();
    return c.json({ ok: true });
  })

  .get("/drafts", async (c) => {
    const s = await requireOrgSession(c);
    if (!s || !s.session) return c.json({ error: "unauthorized" }, 401);
    const rows = await db.selectFrom("chat_draft").selectAll().where("userId", "=", s.session.user.id).execute();
    return c.json(rows);
  })

  .put("/channels/:id/draft", async (c) => {
    const s = await requireOrgSession(c);
    if (!s || !s.session) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.body !== "string") return c.json({ error: "invalid_body" }, 400);
    const now = new Date();
    await db
      .insertInto("chat_draft")
      .values({ id: crypto.randomUUID(), organizationId: s.organizationId, channelId: channel.id, userId: s.session.user.id, body: body.body, updatedAt: now })
      .onConflict((oc) => oc.columns(["channelId", "userId"]).doUpdateSet({ body: body.body, updatedAt: now }))
      .execute();
    return c.json({ ok: true });
  })

  .get("/inbox", async (c) => {
    const s = await requireOrgSession(c);
    if (!s || !s.session) return c.json({ error: "unauthorized" }, 401);
    const userId = s.session.user.id;

    const rows = await db
      .selectFrom("chat_message")
      .selectAll()
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .orderBy("createdAt", "desc")
      .limit(200)
      .execute();
    const mentioning = rows.filter((r) => {
      const mentions = (r.meta?.mentions ?? []) as { type: string; id: string }[];
      return mentions.some((m) => m.type === "user" && m.id === userId);
    });
    const messages = await hydrateMessages(s.organizationId, userId, mentioning.slice(0, 50));
    return c.json(messages);
  })

  .get("/collaborators", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const agents = await db.selectFrom("agent").selectAll().where("organizationId", "=", s.organizationId).where("type", "in", ["collaborator", "sentinel"]).execute();
    const connections = await db.selectFrom("llm_connection").select(["provider", "enabled"]).where("organizationId", "=", s.organizationId).execute();
    const enabled = new Set(connections.filter((c2) => c2.enabled).map((c2) => c2.provider));

    const chatSessions = await db.selectFrom("code_session").select(["id", "agentId", "chatChannelId"]).where("organizationId", "=", s.organizationId).where("type", "=", "chat").execute();
    const { isSessionRunning } = await import("./code-ws");
    const runningAgents = new Set(chatSessions.filter((sess) => isSessionRunning(sess.id)).map((sess) => sess.agentId ?? ""));

    return c.json(
      agents.map((a) => ({
        id: a.id,
        name: a.name ?? a.description ?? a.type,
        description: a.description,
        type: a.type,
        model: a.model,
        provider: a.provider,
        available: enabled.has(a.provider),
        active: runningAgents.has(a.id),
        chatChannelCount: new Set(chatSessions.filter((sess) => sess.agentId === a.id).map((sess) => sess.chatChannelId)).size,
      })),
    );
  })

  .post("/channels/:id/assets", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);

    const form = await c.req.parseBody().catch(() => null);
    const file = form?.["file"];
    if (!file || typeof file === "string") return c.json({ error: "invalid_file" }, 400);
    if (file.size === 0) return c.json({ error: "empty_file" }, 400);
    if (file.size > 25 * 1024 * 1024) return c.json({ error: "file_too_large" }, 413);

    try {
      const asset = await storeChatAsset({
        organizationId: s.organizationId,
        chatChannelId: channel.id,
        filename: file.name || "asset",
        contentType: file.type || null,
        data: Buffer.from(await file.arrayBuffer()),
      });
      return c.json({ ...asset, previewUrl: `/api/chat/assets/${asset.id}` }, 201);
    } catch (e) {
      const message = (e as Error).message;
      if (message === "chat_assets_not_configured") return c.json({ error: message }, 409);
      logger.error({ err: e }, "chat: asset upload failed");
      return c.json({ error: message || "upload_failed" }, 500);
    }
  })

  .get("/assets/:mediaId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    try {
      const asset = await readAssetBytesById(s.organizationId, c.req.param("mediaId") ?? "");
      return c.body(new Uint8Array(asset.body), 200, {
        "content-type": asset.contentType,
        "content-disposition": `inline; filename="${asset.filename.replace(/"/g, "")}"`,
      });
    } catch (e) {
      const message = (e as Error).message;
      if (message === "asset_not_found") return c.json({ error: message }, 404);
      return c.json({ error: message || "read_failed" }, 500);
    }
  })

  .get("/channels/:id/files", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);

    const rows = await db
      .selectFrom("media_asset")
      .select(["id", "filename", "extension", "contentType", "size", "createdAt"])
      .where("organizationId", "=", s.organizationId)
      .where("chatChannelId", "=", channel.id)
      .orderBy("createdAt", "desc")
      .execute();
    return c.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), previewUrl: `/api/chat/assets/${r.id}` })));
  })

  .get("/channels/:id/pins", async (c) => {
    const s = await requireOrgSession(c);
    if (!s || !s.session) return c.json({ error: "unauthorized" }, 401);
    const channel = await channelRow(s.organizationId, c.req.param("id"));
    if (!channel) return c.json({ error: "channel_not_found" }, 404);

    const pins = await db.selectFrom("chat_pin").selectAll().where("channelId", "=", channel.id).orderBy("createdAt", "desc").execute();
    if (!pins.length) return c.json([]);
    const rows = await db.selectFrom("chat_message").selectAll().where("id", "in", pins.map((p) => p.messageId)).execute();
    const messages = await hydrateMessages(s.organizationId, s.session.user.id, rows);
    const pinnedAt = new Map(pins.map((p) => [p.messageId, p.createdAt.toISOString()]));
    return c.json(messages.map((m) => ({ ...m, pinnedAt: pinnedAt.get(m.id) ?? m.createdAt })));
  });
