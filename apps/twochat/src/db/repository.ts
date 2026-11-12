import { ulid } from "ulid";
import type { Kysely } from "@twodb/core-data/db";
import type { TwoChatDb } from "./schema.js";
import type { MessageBlock } from "../blocks.js";

/**
 * Data access for TwoChat. All reads/writes go through here so route handlers
 * stay thin and the WS hub can hydrate events with the same payloads the REST
 * API returns (one wire shape everywhere).
 */

// --- Actor helpers -----------------------------------------------------------

export type Actor = { type: "user" | "bot"; id: string };

export const userActor = (id: string): Actor => ({ type: "user", id });
export const botActor = (id: string): Actor => ({ type: "bot", id });

/** Stable string form stored in reaction.actor_id / pin.pinned_by. */
export const actorKey = (a: Actor) => `${a.type}:${a.id}`;

export function parseActorKey(key: string): Actor {
  const [type, ...rest] = key.split(":");
  return { type: type === "bot" ? "bot" : "user", id: rest.join(":") };
}

export interface ActorInfo {
  key: string;
  type: "user" | "bot";
  id: string;
  name: string;
  avatarEmoji: string | null;
  isBot: boolean;
}

// --- Wire payloads ------------------------------------------------------------

export interface ChannelPayload {
  id: string;
  kind: "channel" | "dm";
  name: string;
  topic: string | null;
  dmKey: string | null;
  position: number;
  createdBy: string | null;
  createdByType: "user" | "bot";
  lastMessageAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  memberCount: number;
  members: MemberPayload[];
}

export interface MemberPayload {
  id: string;
  type: "user" | "bot";
  userId: string | null;
  botId: string | null;
  name: string;
  avatarEmoji: string | null;
  role: "member" | "admin";
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MessagePayload {
  id: string;
  channelId: string;
  authorType: "user" | "bot";
  userId: string | null;
  botId: string | null;
  authorName: string;
  authorEmoji: string | null;
  text: string;
  blocks: MessageBlock[] | null;
  replyToId: string | null;
  replyTo: { id: string; authorName: string; snippet: string } | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  reactions: ReactionSummary[];
  pinned: boolean;
  saved: boolean;
}

export interface NotificationPayload {
  id: string;
  kind: "mention" | "dm" | "channel" | "bot-post" | "system";
  title: string;
  body: string;
  channelId: string | null;
  messageId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface BotPayload {
  id: string;
  name: string;
  kind: string;
  avatarEmoji: string | null;
  description: string | null;
  createdAt: string;
}

export interface AssetPayload {
  id: string;
  channelId: string | null;
  filename: string;
  contentType: string | null;
  size: number;
  createdAt: string;
}

export interface MessageActionPayload {
  id: string;
  messageId: string;
  channelId: string;
  botId: string;
  actionId: string;
  value: string | null;
  userId: string;
  acknowledgedAt: string | null;
  createdAt: string;
}

// --- Repo ---------------------------------------------------------------------

export interface CreateChannelInput {
  workspaceId: string;
  kind: "channel" | "dm";
  name: string;
  topic?: string | null;
  dmKey?: string | null;
  creator: Actor;
  members: Actor[];
}

export interface PostMessageInput {
  workspaceId: string;
  channelId: string;
  author: Actor;
  text: string;
  blocks?: MessageBlock[] | null;
  replyToId?: string | null;
}

export interface PostMessageResult {
  message: MessagePayload;
  /** User actors that should get a notification (mentions + DM recipients). */
  notifyUserIds: string[];
  notification: { kind: "mention" | "dm" | "channel"; title: string; body: string };
}

export interface PostOpts {
  /** Pagination cursor: "<createdAtISO>~<id>". */
  before?: string | null;
  limit?: number;
}

export function createChatRepo(db: Kysely<TwoChatDb>) {
  // -- actors lookup (joins user names lazily; bots carry their own name) --

  async function actorInfos(workspaceId: string, actors: Actor[]): Promise<Map<string, ActorInfo>> {
    const wanted = new Map(actors.map((a) => [actorKey(a), a]));
    const userIds = [...new Set(actors.filter((a) => a.type === "user").map((a) => a.id))];
    const botIds = [...new Set(actors.filter((a) => a.type === "bot").map((a) => a.id))];
    const out = new Map<string, ActorInfo>();
    for (const [key, a] of wanted) {
      out.set(key, { key, type: a.type, id: a.id, name: a.type === "bot" ? "bot" : "user", avatarEmoji: null, isBot: a.type === "bot" });
    }
    if (botIds.length) {
      const rows = await db.selectFrom("bot").selectAll().where("workspace_id", "=", workspaceId).where("id", "in", botIds).execute();
      for (const b of rows) {
        const key = actorKey(botActor(b.id));
        const entry = out.get(key);
        if (entry) Object.assign(entry, { name: b.name, avatarEmoji: b.avatar_emoji });
      }
    }
    if (userIds.length) {
      // Human names come from the client (control plane owns them); the repo
      // leaves the placeholder and the client overlays its member directory.
      // Only display name fallback stays server-side.
    }
    return out;
  }

  const botMap = async (workspaceId: string) => {
    const rows = await db.selectFrom("bot").selectAll().where("workspace_id", "=", workspaceId).execute();
    return new Map(rows.map((b) => [b.id, b]));
  };

  // -- channels ---------------------------------------------------------------

  async function getChannel(workspaceId: string, id: string) {
    return db.selectFrom("channel").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
  }

  async function listChannels(workspaceId: string, userId: string): Promise<ChannelPayload[]> {
    const channels = await db
      .selectFrom("channel")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("archived_at", "is", null)
      .orderBy("position", "asc")
      .orderBy("created_at", "asc")
      .execute();
    // Group channels are discoverable; DMs are strictly private and only
    // listed for their members. Message/history routes enforce membership too.
    const dmMemberships = await db
      .selectFrom("channel_member")
      .select("channel_id")
      .where("workspace_id", "=", workspaceId)
      .where("member_type", "=", "user")
      .where("user_id", "=", userId)
      .execute();
    const dmIds = new Set(dmMemberships.map((m) => m.channel_id));
    const visible = channels.filter((ch) => ch.kind === "channel" || dmIds.has(ch.id));
    return Promise.all(visible.map((ch) => hydrateChannel(workspaceId, ch, userId)));
  }

  async function hydrateChannel(workspaceId: string, row: TwoChatDb["channel"], userId: string): Promise<ChannelPayload> {
    const members = await memberPayloads(workspaceId, row.id);
    const unread = await unreadCount(workspaceId, row.id, userId);
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      topic: row.topic,
      dmKey: row.dm_key,
      position: row.position,
      createdBy: row.created_by,
      createdByType: row.created_by_type,
      lastMessageAt: row.last_message_at,
      archivedAt: row.archived_at,
      createdAt: isoReq(row.created_at),
      updatedAt: isoReq(row.updated_at),
      unreadCount: unread,
      memberCount: members.length,
      members,
    };
  }

  async function memberPayloads(workspaceId: string, channelId: string): Promise<MemberPayload[]> {
    const rows = await db.selectFrom("channel_member").selectAll().where("channel_id", "=", channelId).execute();
    const bots = await botMap(workspaceId);
    const userIds = [...new Set(rows.filter((r) => r.member_type === "user").map((r) => r.user_id ?? ""))].filter(Boolean);
    const userNames = await userDisplayNameMap(userIds);
    return rows.map((m) => {
      const bot = m.member_type === "bot" ? bots.get(m.bot_id ?? "") : undefined;
      return {
        id: m.id,
        type: m.member_type,
        userId: m.user_id,
        botId: m.bot_id,
        name: m.member_type === "bot" ? (bot?.name ?? "bot") : (userNames.get(m.user_id ?? "") ?? m.user_id ?? "user"),
        avatarEmoji: bot?.avatar_emoji ?? null,
        role: m.role,
      };
    });
  }

  /** Control-plane display names: client passes x-twodb-user-name when known; server caches nothing. */
  const userNameCache = new Map<string, string>();
  function rememberUserNames(entries: Array<[string, string]>) {
    for (const [id, name] of entries) {
      if (id && name) userNameCache.set(id, name);
    }
  }
  async function userDisplayNameMap(userIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const id of userIds) {
      const cached = userNameCache.get(id);
      if (cached) out.set(id, cached);
    }
    return out;
  }

  async function unreadCount(workspaceId: string, channelId: string, userId: string): Promise<number> {
    const state = await db
      .selectFrom("read_state")
      .selectAll()
      .where("channel_id", "=", channelId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    let query = db
      .selectFrom("message")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("channel_id", "=", channelId)
      .where("deleted_at", "is", null)
      // don't count your own posts as unread
      .where((eb) => eb.or([eb("author_type", "<>", "user"), eb("user_id", "<>", userId)]));
    if (state?.last_read_message_id) {
      const marker = await db
        .selectFrom("message")
        .select(["created_at"])
        .where("id", "=", state.last_read_message_id)
        .executeTakeFirst();
      if (marker) query = query.where("created_at", ">", marker.created_at);
    }
    const row = await query.executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async function createChannel(input: CreateChannelInput): Promise<ChannelPayload> {
    const id = ulid();
    const ts = new Date().toISOString();
    await db
      .insertInto("channel")
      .values({
        id,
        workspace_id: input.workspaceId,
        kind: input.kind,
        name: input.name,
        topic: input.topic ?? null,
        dm_key: input.dmKey ?? null,
        created_by: input.creator.id,
        created_by_type: input.creator.type,
        position: 0,
        last_message_at: null,
        archived_at: null,
        created_at: ts,
        updated_at: ts,
      })
      .execute();
    const all = new Map<string, Actor>();
    all.set(actorKey(input.creator), input.creator);
    for (const m of input.members) all.set(actorKey(m), m);
    for (const actor of all.values()) {
      await db
        .insertInto("channel_member")
        .values({
          id: ulid(),
          workspace_id: input.workspaceId,
          channel_id: id,
          member_type: actor.type,
          user_id: actor.type === "user" ? actor.id : null,
          bot_id: actor.type === "bot" ? actor.id : null,
          role: actorKey(actor) === actorKey(input.creator) ? "admin" : "member",
          joined_at: ts,
        })
        .execute();
    }
    const row = await getChannel(input.workspaceId, id);
    return hydrateChannel(input.workspaceId, row!, input.creator.type === "user" ? input.creator.id : "");
  }

  /** Ensure a Slack-like #general exists and the current user is in it. */
  async function ensureDefaultChannel(workspaceId: string, actor: Actor): Promise<void> {
    let channel = await db
      .selectFrom("channel")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("kind", "=", "channel")
      .where("name", "=", "general")
      .executeTakeFirst();
    if (!channel) {
      await createChannel({
        workspaceId,
        kind: "channel",
        name: "general",
        topic: "Company-wide announcements and conversation",
        creator: actor,
        members: [],
      });
      return;
    }
    if (!(await isMember(workspaceId, channel.id, actor))) await joinChannel(workspaceId, channel.id, actor);
  }

  async function findOrCreateDm(workspaceId: string, a: Actor, b: Actor[]): Promise<ChannelPayload> {
    const ids = [...new Set([actorKey(a), ...b.map(actorKey)])].sort();
    const dmKey = ids.join("|");
    const existing = await db
      .selectFrom("channel")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("kind", "=", "dm")
      .where("dm_key", "=", dmKey)
      .executeTakeFirst();
    if (existing) return hydrateChannel(workspaceId, existing, a.type === "user" ? a.id : "");
    return createChannel({
      workspaceId,
      kind: "dm",
      name: dmKey,
      dmKey,
      creator: a,
      members: b,
    });
  }

  async function isMember(workspaceId: string, channelId: string, actor: Actor): Promise<boolean> {
    let query = db.selectFrom("channel_member").select("id").where("channel_id", "=", channelId);
    query = actor.type === "user" ? query.where("user_id", "=", actor.id) : query.where("bot_id", "=", actor.id);
    const row = await query.executeTakeFirst();
    return !!row;
  }

  async function updateChannel(
    workspaceId: string,
    id: string,
    patch: { name?: string; topic?: string | null; archived?: boolean; position?: number },
  ) {
    const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.topic !== undefined) set.topic = patch.topic;
    if (patch.archived !== undefined) set.archived_at = patch.archived ? new Date() : null;
    if (patch.position !== undefined) set.position = patch.position;
    const row = await db.updateTable("channel").set(set).where("workspace_id", "=", workspaceId).where("id", "=", id).returningAll().executeTakeFirst();
    return row;
  }

  async function deleteChannel(workspaceId: string, id: string) {
    // Application-level cascade keeps this safe on both fresh schemas and
    // schemas created before FK constraints were introduced.
    await db.transaction().execute(async (trx) => {
      const messageIds = await trx.selectFrom("message").select("id").where("channel_id", "=", id).execute();
      const ids = messageIds.map((m) => m.id);
      if (ids.length) {
        await trx.deleteFrom("reaction").where("message_id", "in", ids).execute();
        await trx.deleteFrom("saved").where("message_id", "in", ids).execute();
        await trx.deleteFrom("message_action").where("message_id", "in", ids).execute();
      }
      await trx.deleteFrom("pin").where("channel_id", "=", id).execute();
      await trx.deleteFrom("notification").where("channel_id", "=", id).execute();
      await trx.deleteFrom("draft").where("channel_id", "=", id).execute();
      await trx.deleteFrom("read_state").where("channel_id", "=", id).execute();
      await trx.deleteFrom("asset").where("channel_id", "=", id).execute();
      await trx.deleteFrom("message").where("channel_id", "=", id).execute();
      await trx.deleteFrom("channel_member").where("channel_id", "=", id).execute();
      await trx.deleteFrom("channel").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    });
  }

  async function joinChannel(workspaceId: string, channelId: string, actor: Actor) {
    await db
      .insertInto("channel_member")
      .values({
        id: ulid(),
        workspace_id: workspaceId,
        channel_id: channelId,
        member_type: actor.type,
        user_id: actor.type === "user" ? actor.id : null,
        bot_id: actor.type === "bot" ? actor.id : null,
        role: "member",
        joined_at: new Date().toISOString(),
      })
      .execute();
  }

  async function leaveChannel(workspaceId: string, channelId: string, actor: Actor) {
    let query = db.deleteFrom("channel_member").where("channel_id", "=", channelId);
    query = actor.type === "user" ? query.where("user_id", "=", actor.id) : query.where("bot_id", "=", actor.id);
    await query.execute();
  }

  // -- messages ---------------------------------------------------------------

  async function hydrateMessages(workspaceId: string, viewer: Actor, rows: TwoChatDb["message"][]): Promise<MessagePayload[]> {
    const ids = rows.map((r) => r.id);
    const bots = await botMap(workspaceId);
    const reactions = ids.length
      ? await db.selectFrom("reaction").select(["message_id", "actor_id", "emoji"]).where("message_id", "in", ids).execute()
      : [];
    const pins = ids.length ? await db.selectFrom("pin").select("message_id").where("message_id", "in", ids).execute() : [];
    const saved = ids.length
      ? await db.selectFrom("saved").select("message_id").where("message_id", "in", ids).where("user_id", "=", viewer.type === "user" ? viewer.id : "").execute()
      : [];
    const replyIds = rows.map((r) => r.reply_to_id).filter((v): v is string => v !== null);
    const replyRows = replyIds.length
      ? await db.selectFrom("message").select(["id", "author_type", "user_id", "bot_id", "text"]).where("id", "in", replyIds).execute()
      : [];
    const userIds = [...new Set([...rows, ...replyRows].filter((r) => r.author_type === "user").map((r) => r.user_id ?? "").filter(Boolean))];
    const userNames = await userDisplayNameMap(userIds);

    const nameOf = (r: { author_type: string; user_id: string | null; bot_id: string | null }) =>
      r.author_type === "bot" ? (bots.get(r.bot_id ?? "")?.name ?? "bot") : (userNames.get(r.user_id ?? "") ?? r.user_id ?? "user");

    const pinSet = new Set(pins.map((p) => p.message_id));
    const savedSet = new Set(saved.map((s) => s.message_id));
    const replyMap = new Map(
      replyRows.map((r) => [r.id, { id: r.id, authorName: nameOf(r), snippet: (r.text ?? "").slice(0, 80) }]),
    );

    return rows.map((r) => {
      const mine = reactions.filter((x) => x.message_id === r.id);
      const byEmoji = new Map<string, ReactionSummary>();
      const viewerKey = actorKey(viewer);
      for (const x of mine) {
        const entry = byEmoji.get(x.emoji) ?? { emoji: x.emoji, count: 0, mine: false };
        entry.count += 1;
        if (x.actor_id === viewerKey) entry.mine = true;
        byEmoji.set(x.emoji, entry);
      }
      return {
        id: r.id,
        channelId: r.channel_id,
        authorType: r.author_type,
        userId: r.user_id,
        botId: r.bot_id,
        authorName: nameOf(r),
        authorEmoji: r.author_type === "bot" ? (bots.get(r.bot_id ?? "")?.avatar_emoji ?? null) : null,
        text: r.deleted_at ? "" : r.text,
        blocks: r.deleted_at ? null : (parseBlocks(r.blocks) as MessageBlock[]),
        replyToId: r.reply_to_id,
        replyTo: r.reply_to_id ? (replyMap.get(r.reply_to_id) ?? null) : null,
        editedAt: iso(r.edited_at),
        deletedAt: iso(r.deleted_at),
        createdAt: isoReq(r.created_at),
        reactions: [...byEmoji.values()],
        pinned: pinSet.has(r.id),
        saved: savedSet.has(r.id),
      };
    });
  }

  function parseBlocks(raw: unknown): MessageBlock[] | null {
    if (!raw) return null;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? (parsed as MessageBlock[]) : null;
    } catch {
      return null;
    }
  }

  async function listMessages(workspaceId: string, channelId: string, viewer: Actor, opts: PostOpts = {}) {
    const limit = Math.min(opts.limit ?? 50, 100);
    let query = db.selectFrom("message").selectAll().where("channel_id", "=", channelId);
    if (opts.before) {
      const [isoTs, id] = opts.before.split("~");
      const at = new Date(isoTs);
      if (!Number.isNaN(at.getTime())) {
        query = query.where((eb) =>
          eb.or([eb("created_at", "<", at.toISOString()), eb.and([eb("created_at", "=", at.toISOString()), eb("id", "<", id ?? "")])]),
        );
      }
    }
    const rows = await query.orderBy("created_at", "desc").limit(limit).execute();
    rows.reverse();
    const messages = await hydrateMessages(workspaceId, viewer, rows);
    const next = rows.length === limit ? `${iso(rows[0].created_at)}~${rows[0].id}` : null;
    return { messages, next };
  }

  async function getMessage(workspaceId: string, id: string) {
    return db.selectFrom("message").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
  }

  async function postMessage(input: PostMessageInput, mentionUserIds: string[] = []): Promise<PostMessageResult | { error: string }> {
    const channel = await getChannel(input.workspaceId, input.channelId);
    if (!channel) return { error: "channel_not_found" };
    if (channel.archived_at) return { error: "channel_archived" };

    // Clamp replies to roots (single-level threads, like the legacy app).
    let replyToId: string | null = null;
    if (input.replyToId) {
      const target = await db.selectFrom("message").select(["id", "channel_id", "reply_to_id"]).where("id", "=", input.replyToId).executeTakeFirst();
      if (!target || target.channel_id !== input.channelId) return { error: "reply_target_not_found" };
      replyToId = target.reply_to_id ?? target.id;
    }

    const id = ulid();
    await db
      .insertInto("message")
      .values({
        id,
        workspace_id: input.workspaceId,
        channel_id: input.channelId,
        author_type: input.author.type,
        user_id: input.author.type === "user" ? input.author.id : null,
        bot_id: input.author.type === "bot" ? input.author.id : null,
        text: input.text,
        blocks: input.blocks ? JSON.stringify(input.blocks) : null,
        reply_to_id: replyToId,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
      })
      .execute();
    await db.updateTable("channel").set({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).where("id", "=", input.channelId).execute();

    const row = await getMessage(input.workspaceId, id);
    const message = (await hydrateMessages(input.workspaceId, input.author, [row!]))[0];

    // Notification targets: explicit mentions + everyone else in a DM.
    const notify = new Set(mentionUserIds);
    let kind: "mention" | "dm" | "channel" = "mention";
    let title = `New mention in ${channel.kind === "dm" ? "DM" : `#${channel.name}`}`;
    if (channel.kind === "dm") {
      kind = "dm";
      title = `Direct message from ${message.authorName}`;
      const others = await db
        .selectFrom("channel_member")
        .select("user_id")
        .where("channel_id", "=", input.channelId)
        .where("member_type", "=", "user")
        .execute();
      for (const m of others) if (m.user_id && m.user_id !== (input.author.type === "user" ? input.author.id : null)) notify.add(m.user_id);
    }
    return {
      message,
      notifyUserIds: [...notify],
      notification: { kind, title, body: message.text.slice(0, 200) },
    };
  }

  async function editMessage(workspaceId: string, id: string, patch: { text?: string; blocks?: MessageBlock[] | null }) {
    const set: Record<string, unknown> = { edited_at: new Date().toISOString() };
    if (patch.text !== undefined) set.text = patch.text;
    if (patch.blocks !== undefined) set.blocks = patch.blocks ? JSON.stringify(patch.blocks) : null;
    const row = await db.updateTable("message").set(set).where("workspace_id", "=", workspaceId).where("id", "=", id).returningAll().executeTakeFirst();
    return row;
  }

  async function deleteMessage(workspaceId: string, id: string) {
    await db.updateTable("message").set({ deleted_at: new Date().toISOString(), text: "", blocks: null }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
  }

  // -- reactions ----------------------------------------------------------------

  async function toggleReaction(workspaceId: string, messageId: string, actor: Actor, emoji: string) {
    const existing = await db
      .selectFrom("reaction")
      .selectAll()
      .where("message_id", "=", messageId)
      .where("actor_id", "=", actorKey(actor))
      .where("emoji", "=", emoji)
      .executeTakeFirst();
    if (existing) {
      await db.deleteFrom("reaction").where("id", "=", existing.id).execute();
    } else {
      await db
        .insertInto("reaction")
        .values({ id: ulid(), workspace_id: workspaceId, message_id: messageId, actor_id: actorKey(actor), emoji, created_at: new Date().toISOString() })
        .execute();
    }
    return summarizeReactions(messageId, actor);
  }

  async function summarizeReactions(messageId: string, viewer: Actor): Promise<ReactionSummary[]> {
    const rows = await db.selectFrom("reaction").select(["actor_id", "emoji"]).where("message_id", "=", messageId).execute();
    const viewerKey = actorKey(viewer);
    const byEmoji = new Map<string, ReactionSummary>();
    for (const r of rows) {
      const entry = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      entry.count += 1;
      if (r.actor_id === viewerKey) entry.mine = true;
      byEmoji.set(r.emoji, entry);
    }
    return [...byEmoji.values()];
  }

  // -- pins / saved / drafts / read state ---------------------------------------

  async function togglePin(workspaceId: string, channelId: string, messageId: string, actor: Actor) {
    const existing = await db.selectFrom("pin").selectAll().where("message_id", "=", messageId).executeTakeFirst();
    if (existing) {
      await db.deleteFrom("pin").where("id", "=", existing.id).execute();
      return false;
    }
    await db
      .insertInto("pin")
      .values({ id: ulid(), workspace_id: workspaceId, channel_id: channelId, message_id: messageId, pinned_by: actorKey(actor), created_at: new Date().toISOString() })
      .execute();
    return true;
  }

  async function listPins(workspaceId: string, channelId: string, viewer: Actor): Promise<MessagePayload[]> {
    const rows = await db
      .selectFrom("pin")
      .innerJoin("message", "message.id", "pin.message_id")
      .selectAll("message")
      .where("pin.channel_id", "=", channelId)
      .orderBy("pin.created_at", "desc")
      .execute();
    return hydrateMessages(workspaceId, viewer, rows as unknown as TwoChatDb["message"][]);
  }

  async function toggleSaved(workspaceId: string, messageId: string, userId: string) {
    const existing = await db.selectFrom("saved").selectAll().where("message_id", "=", messageId).where("user_id", "=", userId).executeTakeFirst();
    if (existing) {
      await db.deleteFrom("saved").where("id", "=", existing.id).execute();
      return false;
    }
    await db.insertInto("saved").values({ id: ulid(), workspace_id: workspaceId, message_id: messageId, user_id: userId, created_at: new Date().toISOString() }).execute();
    return true;
  }

  async function listSaved(workspaceId: string, viewer: Actor): Promise<MessagePayload[]> {
    const rows = await db
      .selectFrom("saved")
      .innerJoin("message", "message.id", "saved.message_id")
      .selectAll("message")
      .where("saved.user_id", "=", viewer.id)
      .orderBy("saved.created_at", "desc")
      .execute();
    return hydrateMessages(workspaceId, viewer, rows as unknown as TwoChatDb["message"][]);
  }

  async function getDraft(channelId: string, userId: string) {
    return db.selectFrom("draft").selectAll().where("channel_id", "=", channelId).where("user_id", "=", userId).executeTakeFirst();
  }

  async function saveDraft(workspaceId: string, channelId: string, userId: string, text: string) {
    const existing = await getDraft(channelId, userId);
    if (existing) {
      await db.updateTable("draft").set({ text, updated_at: new Date().toISOString() }).where("id", "=", existing.id).execute();
    } else {
      await db.insertInto("draft").values({ id: ulid(), workspace_id: workspaceId, channel_id: channelId, user_id: userId, text, updated_at: new Date().toISOString() }).execute();
    }
  }

  async function markRead(workspaceId: string, channelId: string, userId: string, messageId: string | null) {
    const existing = await db
      .selectFrom("read_state")
      .selectAll()
      .where("channel_id", "=", channelId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (existing) {
      await db.updateTable("read_state").set({ last_read_message_id: messageId, updated_at: new Date().toISOString() }).where("id", "=", existing.id).execute();
    } else {
      await db
        .insertInto("read_state")
        .values({ id: ulid(), workspace_id: workspaceId, channel_id: channelId, user_id: userId, last_read_message_id: messageId, updated_at: new Date().toISOString() })
        .execute();
    }
  }

  // -- search ---------------------------------------------------------------------

  async function searchMessages(workspaceId: string, q: string, viewer: Actor, limit = 50): Promise<MessagePayload[]> {
    const channels = await db.selectFrom("channel").select(["id", "kind"]).where("workspace_id", "=", workspaceId).execute();
    let membership = db.selectFrom("channel_member").select("channel_id").where("workspace_id", "=", workspaceId);
    membership = viewer.type === "user" ? membership.where("user_id", "=", viewer.id) : membership.where("bot_id", "=", viewer.id);
    const memberRows = await membership.execute();
    const memberIds = new Set(memberRows.map((m) => m.channel_id));
    const visibleIds = channels.filter((ch) => ch.kind === "channel" || memberIds.has(ch.id)).map((ch) => ch.id);
    if (!visibleIds.length) return [];
    const rows = await db
      .selectFrom("message")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("channel_id", "in", visibleIds)
      .where("deleted_at", "is", null)
      .where("text", "ilike", `%${q}%`)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();
    return hydrateMessages(workspaceId, viewer, rows);
  }

  // -- bots ------------------------------------------------------------------------

  async function listBots(workspaceId: string): Promise<BotPayload[]> {
    const rows = await db.selectFrom("bot").selectAll().where("workspace_id", "=", workspaceId).orderBy("created_at", "asc").execute();
    return rows.map((b) => ({ id: b.id, name: b.name, kind: b.kind, avatarEmoji: b.avatar_emoji, description: b.description, createdAt: isoReq(b.created_at) }));
  }

  async function createBot(workspaceId: string, input: { name: string; kind?: string; apiKeyId?: string | null; avatarEmoji?: string | null; description?: string | null }): Promise<BotPayload> {
    const id = ulid();
    const ts = new Date().toISOString();
    await db
      .insertInto("bot")
      .values({
        id,
        workspace_id: workspaceId,
        name: input.name,
        kind: input.kind ?? "generic",
        api_key_id: input.apiKeyId ?? null,
        avatar_emoji: input.avatarEmoji ?? null,
        description: input.description ?? null,
        created_at: new Date().toISOString(),
      })
      .execute();
    return { id, name: input.name, kind: input.kind ?? "generic", avatarEmoji: input.avatarEmoji ?? null, description: input.description ?? null, createdAt: ts };
  }

  async function findBotByApiKey(workspaceId: string, apiKeyId: string) {
    if (!apiKeyId) return undefined;
    return db.selectFrom("bot").selectAll().where("workspace_id", "=", workspaceId).where("api_key_id", "=", apiKeyId).executeTakeFirst();
  }

  async function findBotByName(workspaceId: string, name: string) {
    return db.selectFrom("bot").selectAll().where("workspace_id", "=", workspaceId).where("name", "=", name).executeTakeFirst();
  }

  // -- notifications ------------------------------------------------------------------

  async function createNotification(input: {
    workspaceId: string;
    userId: string;
    kind: NotificationPayload["kind"];
    title: string;
    body: string;
    channelId?: string | null;
    messageId?: string | null;
  }): Promise<NotificationPayload> {
    const id = ulid();
    const ts = new Date().toISOString();
    await db
      .insertInto("notification")
      .values({
        id,
        workspace_id: input.workspaceId,
        user_id: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        channel_id: input.channelId ?? null,
        message_id: input.messageId ?? null,
        read_at: null,
        created_at: ts,
      })
      .execute();
    return { id, kind: input.kind, title: input.title, body: input.body, channelId: input.channelId ?? null, messageId: input.messageId ?? null, readAt: null, createdAt: ts };
  }

  async function listNotifications(workspaceId: string, userId: string, limit = 50): Promise<NotificationPayload[]> {
    const rows = await db
      .selectFrom("notification")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      channelId: r.channel_id,
      messageId: r.message_id,
      readAt: iso(r.read_at),
      createdAt: isoReq(r.created_at),
    }));
  }

  async function markNotificationRead(workspaceId: string, userId: string, id: string) {
    await db.updateTable("notification").set({ read_at: new Date().toISOString() }).where("workspace_id", "=", workspaceId).where("id", "=", id).where("user_id", "=", userId).execute();
  }

  async function markAllNotificationsRead(workspaceId: string, userId: string) {
    await db.updateTable("notification").set({ read_at: new Date().toISOString() }).where("workspace_id", "=", workspaceId).where("user_id", "=", userId).where("read_at", "is", null).execute();
  }

  async function unreadNotificationCount(workspaceId: string, userId: string): Promise<number> {
    const row = await db
      .selectFrom("notification")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .where("read_at", "is", null)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  // -- interactive bot message actions ----------------------------------------------

  async function createMessageAction(input: {
    workspaceId: string;
    messageId: string;
    channelId: string;
    botId: string;
    actionId: string;
    value?: string | null;
    userId: string;
  }): Promise<MessageActionPayload> {
    const id = ulid();
    const createdAt = new Date().toISOString();
    await db
      .insertInto("message_action")
      .values({
        id,
        workspace_id: input.workspaceId,
        message_id: input.messageId,
        channel_id: input.channelId,
        bot_id: input.botId,
        action_id: input.actionId,
        value: input.value ?? null,
        user_id: input.userId,
        acknowledged_at: null,
        created_at: createdAt,
      })
      .execute();
    return {
      id,
      messageId: input.messageId,
      channelId: input.channelId,
      botId: input.botId,
      actionId: input.actionId,
      value: input.value ?? null,
      userId: input.userId,
      acknowledgedAt: null,
      createdAt,
    };
  }

  async function listMessageActions(workspaceId: string, botId: string, includeAcknowledged = false): Promise<MessageActionPayload[]> {
    let query = db
      .selectFrom("message_action")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("bot_id", "=", botId);
    if (!includeAcknowledged) query = query.where("acknowledged_at", "is", null);
    const rows = await query.orderBy("created_at", "asc").limit(100).execute();
    return rows.map((r) => ({
      id: r.id,
      messageId: r.message_id,
      channelId: r.channel_id,
      botId: r.bot_id,
      actionId: r.action_id,
      value: r.value,
      userId: r.user_id,
      acknowledgedAt: iso(r.acknowledged_at),
      createdAt: isoReq(r.created_at),
    }));
  }

  async function acknowledgeMessageAction(workspaceId: string, botId: string, id: string): Promise<boolean> {
    const row = await db
      .updateTable("message_action")
      .set({ acknowledged_at: new Date().toISOString() })
      .where("workspace_id", "=", workspaceId)
      .where("bot_id", "=", botId)
      .where("id", "=", id)
      .returning("id")
      .executeTakeFirst();
    return !!row;
  }

  // -- assets --------------------------------------------------------------------------

  async function createAsset(input: { workspaceId: string; channelId: string | null; uploader: string; filename: string; contentType: string | null; size: number; storageKey: string }): Promise<AssetPayload> {
    const id = ulid();
    const ts = new Date().toISOString();
    await db
      .insertInto("asset")
      .values({ id, workspace_id: input.workspaceId, channel_id: input.channelId, uploader_actor_id: input.uploader, filename: input.filename, content_type: input.contentType, size: input.size, storage_key: input.storageKey, created_at: new Date().toISOString() })
      .execute();
    return { id, channelId: input.channelId, filename: input.filename, contentType: input.contentType, size: input.size, createdAt: ts };
  }

  async function getAsset(workspaceId: string, id: string) {
    return db.selectFrom("asset").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
  }

  async function listAssets(workspaceId: string, channelId: string): Promise<AssetPayload[]> {
    const rows = await db.selectFrom("asset").selectAll().where("workspace_id", "=", workspaceId).where("channel_id", "=", channelId).orderBy("created_at", "desc").execute();
    return rows.map((a) => ({ id: a.id, channelId: a.channel_id, filename: a.filename, contentType: a.content_type, size: a.size, createdAt: isoReq(a.created_at) }));
  }

  return {
    actorInfos,
    botMap,
    getChannel,
    listChannels,
    hydrateChannel,
    memberPayloads,
    rememberUserNames,
    createChannel,
    ensureDefaultChannel,
    findOrCreateDm,
    isMember,
    updateChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
    hydrateMessages,
    listMessages,
    getMessage,
    postMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    summarizeReactions,
    togglePin,
    listPins,
    toggleSaved,
    listSaved,
    getDraft,
    saveDraft,
    markRead,
    searchMessages,
    listBots,
    createBot,
    findBotByApiKey,
    findBotByName,
    createNotification,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    unreadNotificationCount,
    createMessageAction,
    listMessageActions,
    acknowledgeMessageAction,
    createAsset,
    getAsset,
    listAssets,
  };
}

export type ChatRepo = ReturnType<typeof createChatRepo>;

function iso(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

function isoReq(value: string): string {
  return new Date(value).toISOString();
}
