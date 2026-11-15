import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import { createPgDb } from "@twodb/core-data/db";
import { createAsyncEngine } from "@twodb/core-async/engine";
import { createRelay } from "@twodb/core-async/relay";
import { createInboxHandler, serviceDeliver, type TwoDbRuntime } from "@twodb/twodb-core";
import { createCollabService } from "./collab/service.js";
import { messageFormat, composeAgentMessage } from "./collab/guide.js";
import { BOT_MSG, EDIT_MSG, REPLY_MSG, STATUS_MSG, type BotPayloadIn, type EditPayload, type ReplyPayload, type StatusPayload } from "./collab/types.js";

import { twochatManifest } from "./manifest.js";
import type { TwoChatConfig } from "./config.js";
import { applySchema, type TwoChatDb } from "./db/schema.js";
import { createChatRepo, userActor, botActor, type Actor } from "./db/repository.js";
import { readForwardedContext, type ForwardedContext } from "./gateway-context.js";
import { createChatStorage, type ChatStorage } from "./storage.js";
import { ChatHub } from "./ws/hub.js";
import { registerWs } from "./ws/chat-ws.js";
import { ulid } from "ulid";
import { collectAssetIds, collectMentions, blocksToText, messageBlocks, type MessageBlock } from "./blocks.js";

/**
 * TwoChat HTTP + WS server. All routes assume the Gateway fronted the
 * request (identity in x-twodb-* headers) — direct dialing still works with
 * the headers hand-set (tests/bots), but there is no local auth.
 *
 * Agent participation contract (the whole reason bots exist):
 *   1. Register a bot            POST /bots                    (name, avatar, kind)
 *   2. Bind a workspace API key  bots.api_key_id (set via POST /bots/:id/key or at create)
 *   3. Post messages as the bot  POST /bots/webhook  (auth: workspace API key, x-api-key forwarded by Gateway)
 *      — payload carries channel + blocks (the composed building-block message)
 *   4. Read channel history      GET /channels/:id/messages (same API key)
 * The bot posts land in the channel, fan out over WS, and notify mentioned
 * users exactly like human messages.
 */
/** What the server needs from the control-plane session to talk to other apps. */
export type ServiceCaller = Pick<TwoDbRuntime, "serviceFetch" | "verifyServiceToken" | "serviceToken">;

export async function buildServer(config: TwoChatConfig, opts: { twodb?: ServiceCaller } = {}) {
  const app = Fastify({ logger: true });
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  await app.register(websocket);
  await app.register(multipart, {
    limits: { fileSize: config.TWOCHAT_MAX_ATTACHMENT_BYTES, files: 10 },
  });

  const db = createPgDb<TwoChatDb>({ connectionString: config.DATABASE_URL, schema: "twochat" });
  await applySchema(db);
  const repo = createChatRepo(db);
  const asyncEngine = createAsyncEngine({ connectionString: config.DATABASE_URL, schema: "twochat" });
  await asyncEngine.init();
  const hub = new ChatHub();
  // Late-bound: the collab service needs publishMessage/publishToChannel, which are defined further down.
  let collab: ReturnType<typeof createCollabService> | null = null;
  const storage: ChatStorage = createChatStorage({
    backend: config.TWOCHAT_STORAGE_BACKEND,
    dir: config.TWOCHAT_STORAGE_DIR,
    twoDriveUrl: config.TWOCHAT_TWODRIVE_URL,
  });

  // --- identity helpers -----------------------------------------------------

  const canAccessSpace = (ctx: ForwardedContext, spaceId: string | null): boolean =>
    spaceId === null || ctx.spaceIds.length === 0 || ctx.spaceIds.includes(spaceId);

  const requireCtx = (req: FastifyRequest, reply: FastifyReply): ForwardedContext | null => {
    const ctx = readForwardedContext(req);
    if (!ctx) {
      void reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    return ctx;
  };

  /** Session users act as themselves; workspace API keys act as their bound bot (or are rejected). */
  const requireActor = async (req: FastifyRequest, reply: FastifyReply): Promise<{ ctx: ForwardedContext; actor: Actor } | null> => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return null;
    // Service tokens act for an app, never as a participant: only users and bound API keys are chat actors.
    if ((ctx.kind as string) === "service") {
      void reply.code(403).send({ error: "service_tokens_cannot_chat" });
      return null;
    }
    if (ctx.kind === "session") {
      if (!ctx.userId) {
        void reply.code(401).send({ error: "unauthorized" });
        return null;
      }
      return { ctx, actor: userActor(ctx.userId) };
    }
    // API key: resolve to its bot. If the key isn't bound to a bot yet, we
    // auto-provision a generic bot named "bot-<key8>" so agents can bootstrap.
    const bot = (await repo.findBotByApiKey(ctx.workspaceId, ctx.apiKeyId ?? "")) ??
      (await repo.createBot(ctx.workspaceId, {
        name: `bot-${(ctx.apiKeyId ?? "anon").slice(0, 8)}`,
        apiKeyId: ctx.apiKeyId,
        kind: "agent",
      }), await repo.findBotByApiKey(ctx.workspaceId, ctx.apiKeyId ?? ""));
    if (!bot) {
      void reply.code(403).send({ error: "no_bot_for_api_key" });
      return null;
    }
    return { ctx, actor: botActor(bot.id) };
  };

  const json = (raw: unknown): Record<string, unknown> => {
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

  const parseBlocksOrText = (body: Record<string, unknown>): { text: string; blocks: MessageBlock[] | null } | { error: string } => {
    const rawBlocks = body.blocks;
    if (rawBlocks !== undefined && rawBlocks !== null) {
      const parsed = messageBlocks.safeParse(rawBlocks);
      if (!parsed.success) return { error: `invalid_blocks: ${parsed.error.issues[0]?.message ?? "bad shape"}` };
      return { text: typeof body.text === "string" && body.text.trim() ? body.text.trim() : blocksToText(parsed.data), blocks: parsed.data };
    }
    if (typeof body.text === "string" && body.text.trim()) return { text: body.text.trim(), blocks: null };
    return { error: "invalid_body" };
  };

  const publishMessage = (ctx: ForwardedContext, result: Awaited<ReturnType<typeof repo.postMessage>>) => {
    if ("error" in result) return;
    void publishToChannel(ctx.workspaceId, result.message.channelId, {
      type: "message",
      channelId: result.message.channelId,
      message: result.message,
    });
    void collab?.onMessagePosted(ctx.workspaceId, result.message).catch((err) => app.log.warn({ err }, "collab trigger failed"));
    void asyncEngine.broadcast.publish("twochat.message.posted", {
      messageId: result.message.id,
      channelId: result.message.channelId,
      authorType: result.message.authorType,
      authorId: result.message.userId ?? result.message.botId,
      createdAt: result.message.createdAt,
    });
    for (const userId of result.notifyUserIds) {
      void (async () => {
        const notification = await repo.createNotification({
          workspaceId: ctx.workspaceId,
          userId,
          kind: result.notification.kind,
          title: result.notification.title,
          body: result.notification.body,
          channelId: result.message.channelId,
          messageId: result.message.id,
        });
        hub.publishToUsers(ctx.workspaceId, [userId], { type: "notification", notification });
        await asyncEngine.broadcast.publish("twochat.notification.created", {
          notificationId: notification.id,
          userId,
          kind: notification.kind,
          channelId: notification.channelId,
          createdAt: notification.createdAt,
        });
      })();
    }
  };

  const requireChannelAccess = async (ctx: ForwardedContext, actor: Actor, channelId: string, reply: FastifyReply) => {
    const channel = await repo.getChannel(ctx.workspaceId, channelId);
    if (!channel) {
      void reply.code(404).send({ error: "channel_not_found" });
      return null;
    }
    if (channel.list_id) {
      const list = await repo.getConversationList(ctx.workspaceId, channel.list_id);
      if (!list || !canAccessSpace(ctx, list.space_id)) {
        void reply.code(403).send({ error: "space_not_accessible" });
        return null;
      }
    }
    const member = await repo.isMember(ctx.workspaceId, channelId, actor);
    if (channel.kind === "dm" && !member) {
      void reply.code(403).send({ error: "not_a_member" });
      return null;
    }
    return channel;
  };

  const requireMessageAccess = async (ctx: ForwardedContext, actor: Actor, messageId: string, reply: FastifyReply) => {
    const message = await repo.getMessage(ctx.workspaceId, messageId);
    if (!message) {
      void reply.code(404).send({ error: "message_not_found" });
      return null;
    }
    if (!(await repo.isMember(ctx.workspaceId, message.channel_id, actor))) {
      void reply.code(403).send({ error: "not_a_member" });
      return null;
    }
    return message;
  };

  const requireWritableConversation = (channel: TwoChatDb["channel"], reply: FastifyReply): boolean => {
    if (!channel.is_read_only) return true;
    void reply.code(409).send({ error: "conversation_read_only" });
    return false;
  };

  const channelUserIds = async (workspaceId: string, channelId: string): Promise<string[]> => {
    const members = await repo.memberPayloads(workspaceId, channelId);
    return members.flatMap((member) => (member.type === "user" && member.userId ? [member.userId] : []));
  };

  const publishToChannel = async (workspaceId: string, channelId: string, frame: Parameters<ChatHub["publish"]>[1]) => {
    hub.publishToUsers(workspaceId, await channelUserIds(workspaceId, channelId), frame);
  };

  // --- collaborators: durable messaging with Artisan --------------------------------------------
  if (opts.twodb) {
    const twodb = opts.twodb;
    const relay = createRelay({ engine: asyncEngine, deliver: serviceDeliver(twodb), concurrency: 4 });
    collab = createCollabService({
      db, repo, relay, hub,
      log: { info: (o, m) => app.log.info(o as object, m), warn: (o, m) => app.log.warn(o as object, m) },
      publishPosted: (workspaceId, message, notifyUserIds, notification) =>
        publishMessage({ workspaceId } as ForwardedContext, { message, notifyUserIds, notification }),
      publishToChannel,
    });
    const svc = collab;
    const inbox = createInboxHandler({
      caller: twodb,
      receive: relay.receive,
      accepts: { [REPLY_MSG]: { maxAttempts: 5 }, [EDIT_MSG]: { maxAttempts: 5 }, [STATUS_MSG]: { maxAttempts: 2 }, [BOT_MSG]: { maxAttempts: 5 } },
    });
    app.post("/_svc/inbox", { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
      const r = await inbox(req.headers as { authorization?: string }, req.body);
      return reply.code(r.status).send(r.body);
    });

    /** Synchronous service calls (reads/validation): authenticated by a scoped service token, nothing else. */
    const verifySvc = async (req: FastifyRequest, reply: FastifyReply, scope: string): Promise<string | null> => {
      const bearer = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (!bearer) { void reply.code(401).send({ error: "missing service token" }); return null; }
      try {
        return (await twodb.verifyServiceToken(bearer, { scope })).wid;
      } catch (err) {
        void reply.code(401).send({ error: (err as Error).message });
        return null;
      }
    };
    app.get("/_svc/messages/schema", async (req, reply) => {
      if (!(await verifySvc(req, reply, "twochat.messages.schema"))) return reply;
      return messageFormat();
    });
    app.post("/_svc/messages/validate", async (req, reply) => {
      if (!(await verifySvc(req, reply, "twochat.messages.validate"))) return reply;
      const m = (json(req.body).message ?? {}) as { text?: unknown; blocks?: unknown };
      const r = composeAgentMessage({ text: m.text, blocks: m.blocks });
      return "error" in r ? { ok: false, error: r.error } : { ok: true };
    });

    relay.start();
    const handlers: Array<[string, (payload: never) => Promise<void>]> = [
      [REPLY_MSG, (p: ReplyPayload) => svc.handleReply(p)],
      [EDIT_MSG, (p: EditPayload) => svc.handleEdit(p)],
      [STATUS_MSG, (p: StatusPayload) => svc.handleStatus(p)],
      [BOT_MSG, (p: BotPayloadIn) => svc.handleBot(p)],
    ];
    const worker = asyncEngine.queue.worker(handlers.map(([t]) => t), async (job) => {
      const h = handlers.find(([t]) => t === job.type);
      if (h) await h[1](job.payload as never);
    }, { concurrency: 4, pollIntervalMs: 300 });
    const sweep = setInterval(() => void svc.sweep().catch((err) => app.log.warn({ err }, "collab sweep failed")), 60_000);
    sweep.unref();
    app.addHook("onClose", async () => { clearInterval(sweep); await relay.stop(); await worker.stop(); });
  }

  // --- pull-registration ------------------------------------------------------


  app.get("/healthz", async () => ({ ok: true, app: "twochat", storage: storage.backend, version: twochatManifest.version }));

  // --- channels ------------------------------------------------------------------

  app.get("/channels", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    await repo.ensureDefaultChannel(auth.ctx.workspaceId, auth.actor);
    const defaultList = await repo.ensureDefaultList(auth.ctx.workspaceId, auth.ctx.userId!);
    return repo.listChannels(auth.ctx.workspaceId, auth.ctx.userId!, defaultList.id);
  });

  app.post("/channels", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const body = json(req.body);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return reply.code(400).send({ error: "invalid_name" });
    const defaultList = await repo.ensureDefaultList(auth.ctx.workspaceId, auth.ctx.userId!);
    const listId = typeof body.listId === "string" ? body.listId : defaultList.id;
    const list = await repo.getConversationList(auth.ctx.workspaceId, listId);
    if (!list) return reply.code(404).send({ error: "list_not_found" });
    if (!canAccessSpace(auth.ctx, list.space_id)) return reply.code(403).send({ error: "space_not_accessible" });

    const existing = await db
      .selectFrom("channel")
      .select("id")
      .where("workspace_id", "=", auth.ctx.workspaceId)
      .where("list_id", "=", listId)
      .where("kind", "=", "channel")
      .where("name", "=", name)
      .executeTakeFirst();
    if (existing) return reply.code(409).send({ error: "channel_exists" });

    // Optional bot members (agents joining the channel from day one).
    const botIds = Array.isArray(body.botIds) ? (body.botIds as unknown[]).filter((v): v is string => typeof v === "string") : [];
    const bots = await repo.botMap(auth.ctx.workspaceId);
    const members: Actor[] = botIds.filter((id) => bots.has(id)).map((id) => botActor(id));

    const channel = await repo.createChannel({
      workspaceId: auth.ctx.workspaceId,
      listId,
      kind: "channel",
      name,
      topic: typeof body.topic === "string" ? body.topic : null,
      creator: auth.actor,
      members,
    });
    hub.publish(auth.ctx.workspaceId, { type: "channel_created", channel });
    return reply.code(201).send(channel);
  });

  app.get("/channels/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const channel = await requireChannelAccess(auth.ctx, auth.actor, id, reply);
    if (!channel) return reply;
    const members = await repo.memberPayloads(auth.ctx.workspaceId, id);
    return { ...channel, members };
  });

  app.patch("/channels/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || auth.actor.type !== "user") return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const channel = await requireChannelAccess(auth.ctx, auth.actor, id, reply);
    if (!channel) return reply;
    const members = await repo.memberPayloads(auth.ctx.workspaceId, id);
    if (!members.some((m) => m.userId === auth.actor.id && m.role === "admin")) return reply.code(403).send({ error: "admin_required" });
    const body = json(req.body);
    const patch: { name?: string; topic?: string | null; archived?: boolean; position?: number; listId?: string; isReadOnly?: boolean; sourceUrl?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
    if (body.topic !== undefined) patch.topic = typeof body.topic === "string" ? body.topic : null;
    if (body.archived !== undefined) patch.archived = !!body.archived;
    if (typeof body.position === "number") patch.position = body.position;
    if (typeof body.listId === "string") {
      const target = await repo.getConversationList(auth.ctx.workspaceId, body.listId);
      if (!target) return reply.code(404).send({ error: "list_not_found" });
      if (!canAccessSpace(auth.ctx, target.space_id)) return reply.code(403).send({ error: "space_not_accessible" });
      patch.listId = body.listId;
    }
    if (typeof body.isReadOnly === "boolean") patch.isReadOnly = body.isReadOnly;
    if (body.sourceUrl !== undefined) patch.sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : null;
    if (!Object.keys(patch).length) return reply.code(400).send({ error: "empty_update" });
    const row = await repo.updateChannel(auth.ctx.workspaceId, id, patch);
    const hydrated = row ? await repo.hydrateChannel(auth.ctx.workspaceId, row, auth.ctx.userId ?? "") : null;
    void publishToChannel(auth.ctx.workspaceId, id, { type: "channel_updated", channel: hydrated });
    return hydrated;
  });

  app.delete("/channels/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || auth.actor.type !== "user") return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const channel = await requireChannelAccess(auth.ctx, auth.actor, id, reply);
    if (!channel) return reply;
    const members = await repo.memberPayloads(auth.ctx.workspaceId, id);
    if (!members.some((m) => m.userId === auth.actor.id && m.role === "admin")) return reply.code(403).send({ error: "admin_required" });
    const recipientIds = members.flatMap((m) => (m.type === "user" && m.userId ? [m.userId] : []));
    await repo.deleteChannel(auth.ctx.workspaceId, id);
    hub.publishToUsers(auth.ctx.workspaceId, recipientIds, { type: "channel_deleted", id });
    return { ok: true };
  });

  app.post("/channels/:id/join", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const channel = await repo.getChannel(auth.ctx.workspaceId, id);
    if (!channel) return reply.code(404).send({ error: "channel_not_found" });
    if (channel.kind === "dm") return reply.code(403).send({ error: "dm_invite_required" });
    if (!(await repo.isMember(auth.ctx.workspaceId, id, auth.actor))) await repo.joinChannel(auth.ctx.workspaceId, id, auth.actor);
    return { ok: true };
  });

  app.post("/channels/:id/leave", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    await repo.leaveChannel(auth.ctx.workspaceId, id, auth.actor);
    return { ok: true };
  });

  // --- DMs -------------------------------------------------------------------------

  app.post("/dms", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const body = json(req.body);
    const defaultList = await repo.ensureDefaultList(auth.ctx.workspaceId, auth.ctx.userId!);
    const listId = typeof body.listId === "string" ? body.listId : defaultList.id;
    const list = await repo.getConversationList(auth.ctx.workspaceId, listId);
    if (!list) return reply.code(404).send({ error: "list_not_found" });
    if (!canAccessSpace(auth.ctx, list.space_id)) return reply.code(403).send({ error: "space_not_accessible" });
    const others = Array.isArray(body.userIds) ? (body.userIds as unknown[]).filter((v): v is string => typeof v === "string") : [];
    const botIds = Array.isArray(body.botIds) ? (body.botIds as unknown[]).filter((v): v is string => typeof v === "string") : [];
    if (!others.length && !botIds.length) return reply.code(400).send({ error: "no_recipients" });
    const targets: Actor[] = others.map(userActor);
    const bots = await repo.botMap(auth.ctx.workspaceId);
    for (const id of botIds) if (bots.has(id)) targets.push(botActor(id));
    const channel = await repo.findOrCreateDm(auth.ctx.workspaceId, listId, auth.actor, targets);
    hub.publishToUsers(auth.ctx.workspaceId, await channelUserIds(auth.ctx.workspaceId, channel.id), { type: "channel_created", channel });
    return reply.code(201).send(channel);
  });

  // --- messages ----------------------------------------------------------------------

  app.get("/channels/:id/messages", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const channel = await requireChannelAccess(auth.ctx, auth.actor, id, reply);
    if (!channel) return reply;
    const q = req.query as { before?: string; limit?: string };
    return repo.listMessages(auth.ctx.workspaceId, id, auth.actor, { before: q.before ?? null, limit: q.limit ? Number(q.limit) : undefined });
  });

  app.post("/channels/:id/messages", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const channel = await requireChannelAccess(auth.ctx, auth.actor, id, reply);
    if (!channel) return reply;
    if (!requireWritableConversation(channel, reply)) return reply;
    if (!(await repo.isMember(auth.ctx.workspaceId, id, auth.actor))) return reply.code(403).send({ error: "not_a_member" });
    const parsed = parseBlocksOrText(json(req.body));
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });

    const replyToId = typeof (json(req.body).replyToId) === "string" ? (json(req.body).replyToId as string) : null;

    // Validate attachment references exist and belong to this channel's workspace.
    if (parsed.blocks) {
      const assetIds = collectAssetIds(parsed.blocks);
      for (const assetId of assetIds) {
        const asset = await repo.getAsset(auth.ctx.workspaceId, assetId);
        if (!asset) return reply.code(400).send({ error: "attachment_not_found", detail: assetId });
      }
    }

    // Mention resolution: context-block mentions + @name matches against members.
    const mentionUserIds = new Set<string>();
    if (parsed.blocks) {
      for (const m of collectMentions(parsed.blocks)) if (m.kind === "user") mentionUserIds.add(m.id);
    }
    const members = await repo.memberPayloads(auth.ctx.workspaceId, id);
    const textMentions = [...parsed.text.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
    for (const m of members) {
      if (m.type === "user" && m.userId && textMentions.includes(m.name.toLowerCase())) mentionUserIds.add(m.userId);
    }
    mentionUserIds.delete(auth.actor.type === "user" ? auth.actor.id : "");

    const result = await repo.postMessage(
      { workspaceId: auth.ctx.workspaceId, channelId: id, author: auth.actor, text: parsed.text, blocks: parsed.blocks, replyToId },
      [...mentionUserIds],
    );
    if ("error" in result) return reply.code(result.error === "channel_not_found" ? 404 : result.error === "channel_archived" ? 409 : 400).send({ error: result.error });
    publishMessage(auth.ctx, result);
    // author read their own message
    if (auth.actor.type === "user") await repo.markRead(auth.ctx.workspaceId, id, auth.actor.id, result.message.id);
    return reply.code(201).send(result.message);
  });

  app.patch("/messages/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const row = await requireMessageAccess(auth.ctx, auth.actor, id, reply);
    if (!row) return reply;
    const conversation = await repo.getChannel(auth.ctx.workspaceId, row.channel_id);
    if (!conversation || !requireWritableConversation(conversation, reply)) return reply;
    const mine = auth.actor.type === "user" ? row.user_id === auth.actor.id : row.bot_id === auth.actor.id;
    if (!mine) return reply.code(403).send({ error: "not_author" });
    const parsed = parseBlocksOrText(json(req.body));
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
    await repo.editMessage(auth.ctx.workspaceId, id, parsed);
    const fresh = await repo.getMessage(auth.ctx.workspaceId, id);
    const message = (await repo.hydrateMessages(auth.ctx.workspaceId, auth.actor, [fresh!]))[0];
    void publishToChannel(auth.ctx.workspaceId, message.channelId, { type: "message_edited", channelId: message.channelId, message });
    return message;
  });

  app.delete("/messages/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const row = await requireMessageAccess(auth.ctx, auth.actor, id, reply);
    if (!row) return reply;
    const conversation = await repo.getChannel(auth.ctx.workspaceId, row.channel_id);
    if (!conversation || !requireWritableConversation(conversation, reply)) return reply;
    const mine = auth.actor.type === "user" ? row.user_id === auth.actor.id : row.bot_id === auth.actor.id;
    if (!mine) return reply.code(403).send({ error: "not_author" });
    await repo.deleteMessage(auth.ctx.workspaceId, id);
    void publishToChannel(auth.ctx.workspaceId, row.channel_id, { type: "message_deleted", channelId: row.channel_id, messageId: id });
    return { ok: true };
  });

  app.post("/messages/:id/reactions", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const row = await requireMessageAccess(auth.ctx, auth.actor, id, reply);
    if (!row) return reply;
    const conversation = await repo.getChannel(auth.ctx.workspaceId, row.channel_id);
    if (!conversation || !requireWritableConversation(conversation, reply)) return reply;
    const emoji = json(req.body).emoji;
    if (typeof emoji !== "string" || !emoji.trim()) return reply.code(400).send({ error: "invalid_emoji" });
    const reactions = await repo.toggleReaction(auth.ctx.workspaceId, id, auth.actor, emoji.trim());
    // `mine` is viewer-specific; publish a separately hydrated summary to each
    // human member instead of leaking the toggler's perspective to everyone.
    const members = await repo.memberPayloads(auth.ctx.workspaceId, row.channel_id);
    for (const member of members) {
      if (member.type !== "user" || !member.userId) continue;
      const viewerReactions = await repo.summarizeReactions(id, userActor(member.userId));
      hub.publishToUsers(auth.ctx.workspaceId, [member.userId], {
        type: "reaction",
        channelId: row.channel_id,
        messageId: id,
        reactions: viewerReactions,
      });
    }
    return { reactions };
  });

  /**
   * Click an interactive button from a bot-authored message. The click is
   * persisted in the bot's durable action inbox, then broadcast so online
   * agent workers can react immediately. Offline agents fetch it later via
   * GET /bots/actions.
   */
  app.post("/messages/:id/actions/:actionId", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || auth.actor.type !== "user") return reply.code(403).send({ error: "session_required" });
    const { id, actionId } = req.params as { id: string; actionId: string };
    const message = await requireMessageAccess(auth.ctx, auth.actor, id, reply);
    if (!message) return reply;
    if (message.author_type !== "bot" || !message.bot_id) return reply.code(400).send({ error: "message_is_not_interactive" });

    let blocks: MessageBlock[] = [];
    try {
      const raw = typeof message.blocks === "string" ? JSON.parse(message.blocks) : message.blocks;
      blocks = Array.isArray(raw) ? (raw as MessageBlock[]) : [];
    } catch {
      blocks = [];
    }
    const button = blocks
      .filter((b) => b.type === "actions")
      .flatMap((b) => (b.type === "actions" ? b.elements : []))
      .find((b) => b.actionId === actionId);
    if (!button) return reply.code(404).send({ error: "action_not_found" });
    if (button.style?.disabled) return reply.code(409).send({ error: "action_disabled" });

    const body = json(req.body);
    const action = await repo.createMessageAction({
      workspaceId: auth.ctx.workspaceId,
      messageId: message.id,
      channelId: message.channel_id,
      botId: message.bot_id,
      actionId,
      value: typeof body.value === "string" ? body.value : button.value ?? null,
      userId: auth.actor.id,
    });
    await asyncEngine.broadcast.publish("twochat.message.action", action);
    void collab?.onAction(auth.ctx.workspaceId, message, actionId, action.value ?? null).catch((err) => app.log.warn({ err }, "collab action failed"));
    return reply.code(202).send(action);
  });

  app.post("/messages/:id/pin", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const row = await requireMessageAccess(auth.ctx, auth.actor, id, reply);
    if (!row) return reply;
    const pinned = await repo.togglePin(auth.ctx.workspaceId, row.channel_id, id, auth.actor);
    void publishToChannel(auth.ctx.workspaceId, row.channel_id, { type: "pin", channelId: row.channel_id, messageId: id, pinned });
    return { pinned };
  });

  app.post("/messages/:id/save", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const row = await requireMessageAccess(auth.ctx, auth.actor, id, reply);
    if (!row) return reply;
    const saved = await repo.toggleSaved(auth.ctx.workspaceId, id, auth.ctx.userId!);
    return { saved };
  });

  app.get("/channels/:id/pins", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    if (!(await requireChannelAccess(auth.ctx, auth.actor, id, reply))) return reply;
    return repo.listPins(auth.ctx.workspaceId, id, auth.actor);
  });

  app.get("/saved", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    return repo.listSaved(auth.ctx.workspaceId, auth.actor);
  });

  // --- drafts / read state ----------------------------------------------------------

  app.get("/drafts/:channelId", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const { channelId } = req.params as { channelId: string };
    if (!(await requireChannelAccess(auth.ctx, auth.actor, channelId, reply))) return reply;
    const draft = await repo.getDraft(channelId, auth.ctx.userId!);
    return { text: draft?.text ?? "" };
  });

  app.put("/drafts/:channelId", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const { channelId } = req.params as { channelId: string };
    const conversation = await requireChannelAccess(auth.ctx, auth.actor, channelId, reply);
    if (!conversation) return reply;
    if (!requireWritableConversation(conversation, reply)) return reply;
    const text = typeof json(req.body).text === "string" ? (json(req.body).text as string) : "";
    await repo.saveDraft(auth.ctx.workspaceId, channelId, auth.ctx.userId!, text);
    return { ok: true };
  });

  app.post("/channels/:id/read", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    if (!(await requireChannelAccess(auth.ctx, auth.actor, id, reply))) return reply;
    const messageId = typeof json(req.body).messageId === "string" ? (json(req.body).messageId as string) : null;
    await repo.markRead(auth.ctx.workspaceId, id, auth.ctx.userId!, messageId);
    void publishToChannel(auth.ctx.workspaceId, id, { type: "read", channelId: id, userId: auth.ctx.userId!, messageId });
    return { ok: true };
  });

  // --- attachments --------------------------------------------------------------------

  app.post("/channels/:id/assets", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const channel = await requireChannelAccess(auth.ctx, auth.actor, id, reply);
    if (!channel) return reply;
    if (!requireWritableConversation(channel, reply)) return reply;

    const parts = req.parts({ limits: { fileSize: config.TWOCHAT_MAX_ATTACHMENT_BYTES } });
    const created = [];
    try {
      for await (const part of parts) {
        if (part.type !== "file") continue;
        const buffer = await part.toBuffer();
        const assetId = ulid();
        const key = `${auth.ctx.workspaceId}/${id}/${assetId}-${sanitize(part.filename ?? "file")}`;
        await storage.put(key, buffer, { contentType: part.mimetype });
        const asset = await repo.createAsset({
          workspaceId: auth.ctx.workspaceId,
          channelId: id,
          uploader: `${auth.actor.type}:${auth.actor.id}`,
          filename: part.filename ?? "file",
          contentType: part.mimetype ?? null,
          size: buffer.length,
          storageKey: key,
        });
        created.push(asset);
      }
    } catch (err) {
      req.log.warn({ err }, "asset upload failed");
      return reply.code(400).send({ error: "upload_failed", detail: (err as Error).message });
    }
    return reply.code(201).send({ assets: created });
  });

  app.get("/assets/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const asset = await repo.getAsset(auth.ctx.workspaceId, id);
    if (!asset) return reply.code(404).send({ error: "asset_not_found" });
    if (asset.channel_id && !(await repo.isMember(auth.ctx.workspaceId, asset.channel_id, auth.actor))) {
      return reply.code(403).send({ error: "not_a_member" });
    }
    try {
      const data = await storage.get(asset.storage_key);
      reply.header("content-type", asset.content_type ?? "application/octet-stream");
      reply.header("content-disposition", `inline; filename="${asset.filename.replace(/"/g, "")}"`);
      return reply.send(data);
    } catch (err) {
      return reply.code(503).send({ error: "storage_unavailable", detail: (err as Error).message });
    }
  });

  app.get("/channels/:id/assets", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    if (!(await requireChannelAccess(auth.ctx, auth.actor, id, reply))) return reply;
    return repo.listAssets(auth.ctx.workspaceId, id);
  });

  // --- bots (agent participation) -------------------------------------------------------

  app.get("/bots", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    return repo.listBots(auth.ctx.workspaceId);
  });

  app.post("/bots", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const body = json(req.body);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return reply.code(400).send({ error: "invalid_name" });
    const existing = await repo.findBotByName(auth.ctx.workspaceId, name);
    if (existing) return reply.code(409).send({ error: "bot_exists" });
    const bot = await repo.createBot(auth.ctx.workspaceId, {
      name,
      kind: typeof body.kind === "string" ? body.kind : "generic",
      apiKeyId: typeof body.apiKeyId === "string" ? body.apiKeyId : null,
      avatarEmoji: typeof body.avatarEmoji === "string" ? body.avatarEmoji : null,
      description: typeof body.description === "string" ? body.description : null,
    });
    return reply.code(201).send(bot);
  });

  /**
   * The agent posting endpoint — bots/agents call this with a workspace API
   * key (Gateway forwards it, requireActor resolves the bound bot). Payload
   * is `blocks` (composed building-block message) or plain `text`, plus
   * `channelId` (or `channelName` for convenience) and optional `replyToId`.
   */
  app.post("/bots/webhook", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "apiKey" || auth.actor.type !== "bot") return reply.code(403).send({ error: "bot_api_key_required" });

    const body = json(req.body);
    let channelId = typeof body.channelId === "string" ? body.channelId : null;
    if (!channelId && typeof body.channelName === "string") {
      const ch = await db
        .selectFrom("channel")
        .select("id")
        .where("workspace_id", "=", auth.ctx.workspaceId)
        .where("name", "=", body.channelName)
        .executeTakeFirst();
      channelId = ch?.id ?? null;
    }
    if (!channelId) return reply.code(400).send({ error: "channel_required" });
    const channel = await repo.getChannel(auth.ctx.workspaceId, channelId);
    if (!channel) return reply.code(404).send({ error: "channel_not_found" });
    if (!requireWritableConversation(channel, reply)) return reply;

    // Auto-join the bot to the channel on first post (agents self-invite).
    if (!(await repo.isMember(auth.ctx.workspaceId, channelId, auth.actor))) {
      await repo.joinChannel(auth.ctx.workspaceId, channelId, auth.actor);
    }

    const parsed = parseBlocksOrText(body);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });

    const mentionUserIds = new Set<string>();
    if (parsed.blocks) for (const m of collectMentions(parsed.blocks)) if (m.kind === "user") mentionUserIds.add(m.id);
    const members = await repo.memberPayloads(auth.ctx.workspaceId, channelId);
    const textMentions = [...parsed.text.matchAll(/@([\w.-]+)/g)].map((m) => m[1].toLowerCase());
    for (const m of members) {
      if (m.type === "user" && m.userId && textMentions.includes(m.name.toLowerCase())) mentionUserIds.add(m.userId);
    }

    const result = await repo.postMessage(
      {
        workspaceId: auth.ctx.workspaceId,
        channelId,
        author: auth.actor,
        text: parsed.text,
        blocks: parsed.blocks,
        replyToId: typeof body.replyToId === "string" ? body.replyToId : null,
      },
      [...mentionUserIds],
    );
    if ("error" in result) return reply.code(400).send({ error: result.error });
    publishMessage(auth.ctx, result);
    return reply.code(201).send(result.message);
  });

  /** Agent action inbox: unacknowledged button clicks for the calling bot. */
  app.get("/bots/actions", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "apiKey" || auth.actor.type !== "bot") return reply.code(403).send({ error: "bot_api_key_required" });
    const q = req.query as { includeAcknowledged?: string };
    const actions = await repo.listMessageActions(auth.ctx.workspaceId, auth.actor.id, q.includeAcknowledged === "true");
    return { actions };
  });

  app.post("/bots/actions/:id/ack", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "apiKey" || auth.actor.type !== "bot") return reply.code(403).send({ error: "bot_api_key_required" });
    const { id } = req.params as { id: string };
    const ok = await repo.acknowledgeMessageAction(auth.ctx.workspaceId, auth.actor.id, id);
    if (!ok) return reply.code(404).send({ error: "action_not_found" });
    return { ok: true };
  });

  // --- conversation lists ------------------------------------------------------------

  app.get("/lists", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || !auth.ctx.userId) return reply.code(403).send({ error: "session_required" });
    return repo.listConversationLists(auth.ctx.workspaceId, auth.ctx.spaceIds, auth.ctx.userId);
  });

  app.post("/lists", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || !auth.ctx.userId) return reply.code(403).send({ error: "session_required" });
    const body = json(req.body);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const spaceId = typeof body.spaceId === "string" && body.spaceId ? body.spaceId : null;
    if (!name) return reply.code(400).send({ error: "name_required" });
    if (!canAccessSpace(auth.ctx, spaceId)) return reply.code(403).send({ error: "space_not_accessible" });
    return reply.code(201).send(await repo.createConversationList({ workspaceId: auth.ctx.workspaceId, spaceId, name, createdBy: auth.ctx.userId }));
  });

  app.patch("/lists/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || !auth.ctx.userId) return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const current = await repo.getConversationList(auth.ctx.workspaceId, id);
    if (!current) return reply.code(404).send({ error: "list_not_found" });
    if (!canAccessSpace(auth.ctx, current.space_id)) return reply.code(403).send({ error: "space_not_accessible" });
    const body = json(req.body);
    const spaceId = body.spaceId === null ? null : typeof body.spaceId === "string" ? body.spaceId : undefined;
    if (spaceId !== undefined && !canAccessSpace(auth.ctx, spaceId)) return reply.code(403).send({ error: "space_not_accessible" });
    await repo.updateConversationList(auth.ctx.workspaceId, id, {
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
      spaceId,
      position: typeof body.position === "number" ? body.position : undefined,
    });
    return { ok: true };
  });

  app.delete("/lists/:id", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const result = await repo.deleteConversationList(auth.ctx.workspaceId, id);
    if (result === "not_found") return reply.code(404).send({ error: "list_not_found" });
    if (result === "default") return reply.code(409).send({ error: "default_list_cannot_be_deleted" });
    if (result === "not_empty") return reply.code(409).send({ error: "list_not_empty", detail: "Move or delete its conversations first." });
    return { ok: true };
  });

  app.get("/lists/:id/conversations", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || !auth.ctx.userId) return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const list = await repo.getConversationList(auth.ctx.workspaceId, id);
    if (!list) return reply.code(404).send({ error: "list_not_found" });
    if (!canAccessSpace(auth.ctx, list.space_id)) return reply.code(403).send({ error: "space_not_accessible" });
    return repo.listChannels(auth.ctx.workspaceId, auth.ctx.userId, id);
  });

  app.post("/lists/:id/conversations", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || !auth.ctx.userId) return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const list = await repo.getConversationList(auth.ctx.workspaceId, id);
    if (!list) return reply.code(404).send({ error: "list_not_found" });
    if (!canAccessSpace(auth.ctx, list.space_id)) return reply.code(403).send({ error: "space_not_accessible" });
    const body = json(req.body);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return reply.code(400).send({ error: "name_required" });
    const conversation = await repo.createChannel({
      workspaceId: auth.ctx.workspaceId,
      listId: id,
      kind: body.kind === "dm" ? "dm" : "channel",
      name,
      topic: typeof body.topic === "string" ? body.topic : null,
      isReadOnly: body.isReadOnly === true,
      sourceProvider: typeof body.sourceProvider === "string" ? body.sourceProvider : null,
      sourceExternalId: typeof body.sourceExternalId === "string" ? body.sourceExternalId : null,
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null,
      creator: auth.actor,
      members: [],
    });
    return reply.code(201).send(conversation);
  });

  /** Idempotently imports immutable source messages into a read-only conversation. */
  app.post("/conversations/:id/import", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const conversation = await repo.getChannel(auth.ctx.workspaceId, id);
    if (!conversation) return reply.code(404).send({ error: "conversation_not_found" });
    if (!conversation.is_read_only) return reply.code(409).send({ error: "conversation_is_writable" });
    const list = conversation.list_id ? await repo.getConversationList(auth.ctx.workspaceId, conversation.list_id) : null;
    if (list && !canAccessSpace(auth.ctx, list.space_id)) return reply.code(403).send({ error: "space_not_accessible" });
    const body = json(req.body);
    if (!Array.isArray(body.messages)) return reply.code(400).send({ error: "messages_required" });
    const messages = (body.messages as unknown[]).map((value) => {
      const message = value as Record<string, unknown>;
      return {
        externalId: String(message.externalId ?? ""),
        senderName: String(message.senderName ?? "Unknown"),
        senderAvatarUrl: typeof message.senderAvatarUrl === "string" ? message.senderAvatarUrl : null,
        text: String(message.text ?? ""),
        sourceUrl: typeof message.sourceUrl === "string" ? message.sourceUrl : null,
        sentAt: typeof message.sentAt === "string" ? message.sentAt : new Date().toISOString(),
      };
    }).filter((message) => message.externalId);
    const result = await repo.importConversationMessages({ workspaceId: auth.ctx.workspaceId, channelId: id, messages });
    const importedAt = new Date().toISOString();
    await asyncEngine.broadcast.publish("twochat.conversation.imported", { conversationId: id, ...result, importedAt });
    void publishToChannel(auth.ctx.workspaceId, id, { type: "channel_updated", channel: await repo.hydrateChannel(auth.ctx.workspaceId, (await repo.getChannel(auth.ctx.workspaceId, id))!, auth.ctx.userId ?? "") });
    return reply.code(202).send(result);
  });

  // --- notifications -------------------------------------------------------------------------

  app.get("/notifications", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const items = await repo.listNotifications(auth.ctx.workspaceId, auth.ctx.userId!);
    const unread = await repo.unreadNotificationCount(auth.ctx.workspaceId, auth.ctx.userId!);
    return { notifications: items, unread };
  });

  app.post("/notifications/:id/read", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    await repo.markNotificationRead(auth.ctx.workspaceId, auth.ctx.userId!, id);
    return { ok: true };
  });

  app.post("/notifications/read-all", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session") return reply.code(403).send({ error: "session_required" });
    await repo.markAllNotificationsRead(auth.ctx.workspaceId, auth.ctx.userId!);
    return { ok: true };
  });

  // --- search (Gateway federated search fan-out) ------------------------------------------------

  app.get("/search", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const q = (req.query as { q?: string }).q ?? "";
    if (!q.trim()) return { results: [] };
    const messages = await repo.searchMessages(auth.ctx.workspaceId, q.trim(), auth.actor, auth.ctx.spaceIds, 25);
    return {
      results: messages.map((m) => ({
        id: m.id,
        title: m.authorName,
        snippet: m.text.slice(0, 200),
        url: `/apps/twochat/channel/${m.channelId}?message=${m.id}`,
        channelId: m.channelId,
        createdAt: m.createdAt,
      })),
    };
  });

  // --- WS ----------------------------------------------------------------------------------------

  registerWs(app, hub, repo);

  // --- chat collaborators (Artisan agents as bots) ----------------------------------------------
  // Controls the user has over a collaborator that is working, or that worked: stop, and roll back to before a message.
  app.post("/channels/:id/collab/stop", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    const { id } = req.params as { id: string };
    const channel = await requireChannelAccess(auth.ctx, auth.actor, id, reply);
    if (!channel) return reply;
    if (!collab) return reply.code(503).send({ error: "collaborators_unavailable" });
    return { stopped: await collab.stop(auth.ctx.workspaceId, id) };
  });

  app.post("/messages/:id/rollback", async (req, reply) => {
    const auth = await requireActor(req, reply);
    if (!auth) return reply;
    if (auth.ctx.kind !== "session" || auth.actor.type !== "user") return reply.code(403).send({ error: "session_required" });
    const { id } = req.params as { id: string };
    const message = await requireMessageAccess(auth.ctx, auth.actor, id, reply);
    if (!message) return reply;
    if (!collab) return reply.code(503).send({ error: "collaborators_unavailable" });
    const body = json(req.body);
    return collab.rollbackToBefore(auth.ctx.workspaceId, message.channel_id, message.id, body.restoreFiles === true);
  });

  return app;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
