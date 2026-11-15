import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";
import { messageBlocks, blockMention, blockTextObject } from "./blocks.js";

// Wire schemas shared by several endpoints (kept in sync with db/repository.ts
// payload types — the repo returns these shapes directly).

const actorInfo = z.object({
  key: z.string(),
  type: z.enum(["user", "bot"]),
  id: z.string(),
  name: z.string(),
  avatarEmoji: z.string().nullable(),
  isBot: z.boolean(),
});

const member = z.object({
  id: z.string(),
  type: z.enum(["user", "bot"]),
  userId: z.string().nullable(),
  botId: z.string().nullable(),
  name: z.string(),
  avatarEmoji: z.string().nullable(),
  role: z.enum(["member", "admin"]),
});

const channel = z.object({
  id: z.string(),
  listId: z.string().nullable(),
  kind: z.enum(["channel", "dm"]),
  name: z.string(),
  topic: z.string().nullable(),
  isReadOnly: z.boolean(),
  sourceProvider: z.string().nullable(),
  sourceExternalId: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  dmKey: z.string().nullable(),
  position: z.number(),
  createdBy: z.string().nullable(),
  createdByType: z.enum(["user", "bot"]),
  lastMessageAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  unreadCount: z.number(),
  memberCount: z.number(),
  members: z.array(member),
});

const reactionSummary = z.object({ emoji: z.string(), count: z.number(), mine: z.boolean() });

const message = z.object({
  id: z.string(),
  channelId: z.string(),
  authorType: z.enum(["user", "bot"]),
  userId: z.string().nullable(),
  botId: z.string().nullable(),
  authorName: z.string(),
  authorEmoji: z.string().nullable(),
  authorAvatarUrl: z.string().nullable(),
  externalId: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  text: z.string(),
  blocks: messageBlocks.nullable(),
  replyToId: z.string().nullable(),
  replyTo: z.object({ id: z.string(), authorName: z.string(), snippet: z.string() }).nullable(),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  reactions: z.array(reactionSummary),
  pinned: z.boolean(),
  saved: z.boolean(),
});

const notification = z.object({
  id: z.string(),
  kind: z.enum(["mention", "dm", "channel", "bot-post", "system"]),
  title: z.string(),
  body: z.string(),
  channelId: z.string().nullable(),
  messageId: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

const bot = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  avatarEmoji: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

const asset = z.object({
  id: z.string(),
  channelId: z.string().nullable(),
  filename: z.string(),
  contentType: z.string().nullable(),
  size: z.number(),
  createdAt: z.string(),
});

const messageAction = z.object({
  id: z.string(),
  messageId: z.string(),
  channelId: z.string(),
  botId: z.string(),
  actionId: z.string(),
  value: z.string().nullable(),
  userId: z.string(),
  acknowledgedAt: z.string().nullable(),
  createdAt: z.string(),
});

const conversationList = z.object({
  id: z.string(),
  spaceId: z.string().nullable(),
  name: z.string(),
  position: z.number(),
  isDefault: z.boolean(),
  conversationCount: z.number(),
  unreadCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// --- Endpoints -----------------------------------------------------------------

const listChannels = defineEndpoint({
  name: "listChannels",
  method: "GET",
  path: "/channels",
  auth: "session",
  description: "Every visible channel + DM for the caller, each with unread count, member list and last-activity. The sidebar's single bootstrap call.",
  response: z.array(channel),
});

const createChannel = defineEndpoint({
  name: "createChannel",
  method: "POST",
  path: "/channels",
  auth: "session",
  description: "Creates a group channel. `botIds` optionally adds agent participants at create time. Names are unique per workspace among kind=channel.",
  request: z.object({
    name: z.string().min(1),
    topic: z.string().optional(),
    listId: z.string().optional(),
    botIds: z.array(z.string()).optional(),
  }),
  response: channel,
});

const getChannel = defineEndpoint({
  name: "getChannel",
  method: "GET",
  path: "/channels/:id",
  auth: "session-or-apiKey",
  description: "One channel with members. Members (incl. bots) can read; membership is checked. Agents use this with their workspace API key.",
  request: z.object({ id: z.string() }),
  response: channel,
});

const updateChannel = defineEndpoint({
  name: "updateChannel",
  method: "PATCH",
  path: "/channels/:id",
  auth: "session",
  description: "Rename / re-topic / (un)archive / reorder a channel.",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    topic: z.string().nullable().optional(),
    archived: z.boolean().optional(),
    position: z.number().optional(),
    listId: z.string().optional(),
    isReadOnly: z.boolean().optional(),
    sourceUrl: z.string().nullable().optional(),
  }),
  response: channel,
});

const deleteChannel = defineEndpoint({
  name: "deleteChannel",
  method: "DELETE",
  path: "/channels/:id",
  auth: "session",
  description: "Deletes a channel and (via FK cascade) its messages, members, pins and drafts.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const joinChannel = defineEndpoint({
  name: "joinChannel",
  method: "POST",
  path: "/channels/:id/join",
  auth: "session-or-apiKey",
  description: "Adds the caller (user or bot) to a channel. Bots use this to enter channels they participate in.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const leaveChannel = defineEndpoint({
  name: "leaveChannel",
  method: "POST",
  path: "/channels/:id/leave",
  auth: "session-or-apiKey",
  description: "Removes the caller from a channel.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const openDm = defineEndpoint({
  name: "openDm",
  method: "POST",
  path: "/dms",
  auth: "session",
  description: "Opens (or returns the existing) direct-message channel between the caller and the given users/bots. dm_key is the stable sorted actor set.",
  request: z.object({
    listId: z.string().optional(),
    userIds: z.array(z.string()).optional(),
    botIds: z.array(z.string()).optional(),
  }),
  response: channel,
});

const listMessages = defineEndpoint({
  name: "listMessages",
  method: "GET",
  path: "/channels/:id/messages",
  auth: "session-or-apiKey",
  description: "Channel history, newest-last, keyset-paginated with `before` = \"<createdAtISO>~<messageId>\". Agents poll this to catch up.",
  request: z.object({ id: z.string(), before: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }),
  response: z.object({ messages: z.array(message), next: z.string().nullable() }),
});

const postMessage = defineEndpoint({
  name: "postMessage",
  method: "POST",
  path: "/channels/:id/messages",
  auth: "session-or-apiKey",
  description:
    "Posts a message. Body is plain `text` and/or composed `blocks` (markdown, image, button rows, fields, code, task-lists… — src/blocks.ts). " +
    "Mentions in context blocks and @name text notify those users. Single-level replies via `replyToId` (clamped to thread roots).",
  request: z.object({
    id: z.string(),
    text: z.string().optional(),
    blocks: messageBlocks.optional(),
    replyToId: z.string().optional(),
  }),
  response: message,
});

const editMessage = defineEndpoint({
  name: "editMessage",
  method: "PATCH",
  path: "/messages/:id",
  auth: "session-or-apiKey",
  description: "Edits your own message (text and/or blocks). Sets editedAt.",
  request: z.object({
    id: z.string(),
    text: z.string().optional(),
    blocks: messageBlocks.optional(),
  }),
  response: message,
});

const deleteMessage = defineEndpoint({
  name: "deleteMessage",
  method: "DELETE",
  path: "/messages/:id",
  auth: "session-or-apiKey",
  description: "Soft-deletes your own message (text/blocks cleared, tombstone kept for reply integrity).",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const toggleReaction = defineEndpoint({
  name: "toggleReaction",
  method: "POST",
  path: "/messages/:id/reactions",
  auth: "session-or-apiKey",
  description: "Toggles the caller's emoji reaction on a message; returns the full reaction summary.",
  request: z.object({ id: z.string(), emoji: z.string().min(1) }),
  response: z.object({ reactions: z.array(reactionSummary) }),
});

const invokeMessageAction = defineEndpoint({
  name: "invokeMessageAction",
  method: "POST",
  path: "/messages/:id/actions/:actionId",
  auth: "session",
  description:
    "Invokes a button on a bot-authored composed message. The click is persisted to that bot's durable action inbox and broadcast as twochat.message.action, so agents can process it online or later.",
  request: z.object({ id: z.string(), actionId: z.string(), value: z.string().optional() }),
  response: messageAction,
});

const collabStop = defineEndpoint({
  name: "stopCollaborator",
  method: "POST",
  path: "/channels/:id/collab/stop",
  auth: "session",
  description: "Stops whatever collaborators (agent bots) are working on in this channel. Queued runs never start; a running one is aborted, files it already changed stay changed, and the bot posts what it did with roll-back buttons.",
  request: z.object({ id: z.string() }),
  response: z.object({ stopped: z.number() }),
});

const collabRollback = defineEndpoint({
  name: "rollbackToMessage",
  method: "POST",
  path: "/messages/:id/rollback",
  auth: "session",
  description:
    "Rolls the conversation back to just before this message: it and everything after are hidden (kept, flagged), the collaborator's runs from there on are undone (its session is rewound and, with restoreFiles, its git-checkpointed files restored), and replies from cancelled runs are dropped. The client puts the message text back in the composer to edit and resend.",
  request: z.object({ id: z.string(), restoreFiles: z.boolean().optional() }),
  response: z.object({ hidden: z.number(), tasks: z.number() }),
});

const svcInbox = defineEndpoint({
  name: "serviceInbox",
  method: "POST",
  path: "/_svc/inbox",
  auth: "public",
  description:
    "App-to-app message inbox (core-async relay). Authenticated by a control-plane-signed service token whose scope names the message type; the workspace comes from the token, never the body. Accepts twochat.collab.reply | edit | status | bot, dedupes on dedupeKey and enqueues into TwoChat's own queue.",
  request: z.object({ type: z.string(), payload: z.unknown(), dedupeKey: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const svcMessageSchema = defineEndpoint({
  name: "serviceMessageSchema",
  method: "GET",
  path: "/_svc/messages/schema",
  auth: "public",
  description: "Service token (scope twochat.messages.schema). The message-component JSON Schema plus the agent composing guide, with a version hash — what collaborators load via describe_message_format.",
  request: z.object({}),
  response: z.object({ version: z.string(), guide: z.string(), schema: z.unknown() }),
});

const svcMessageValidate = defineEndpoint({
  name: "serviceMessageValidate",
  method: "POST",
  path: "/_svc/messages/validate",
  auth: "public",
  description: "Service token (scope twochat.messages.validate). Checks an agent's {text, blocks} against the live message schema before it is relayed.",
  request: z.object({ message: z.object({ text: z.string().optional(), blocks: z.array(z.unknown()).optional() }) }),
  response: z.object({ ok: z.boolean(), error: z.string().optional() }),
});

const togglePin = defineEndpoint({
  name: "togglePin",
  method: "POST",
  path: "/messages/:id/pin",
  auth: "session-or-apiKey",
  description: "Pins/unpins a message in its channel.",
  request: z.object({ id: z.string() }),
  response: z.object({ pinned: z.boolean() }),
});

const toggleSaved = defineEndpoint({
  name: "toggleSaved",
  method: "POST",
  path: "/messages/:id/save",
  auth: "session",
  description: "Adds/removes a message from the caller's saved-for-later list.",
  request: z.object({ id: z.string() }),
  response: z.object({ saved: z.boolean() }),
});

const listPins = defineEndpoint({
  name: "listPins",
  method: "GET",
  path: "/channels/:id/pins",
  auth: "session-or-apiKey",
  description: "Pinned messages of a channel, newest pin first.",
  request: z.object({ id: z.string() }),
  response: z.array(message),
});

const listSaved = defineEndpoint({
  name: "listSaved",
  method: "GET",
  path: "/saved",
  auth: "session",
  description: "Everything the caller saved, across channels.",
  response: z.array(message),
});

const getDraft = defineEndpoint({
  name: "getDraft",
  method: "GET",
  path: "/drafts/:channelId",
  auth: "session",
  description: "The caller's unsent draft text for a channel (empty string when none).",
  request: z.object({ channelId: z.string() }),
  response: z.object({ text: z.string() }),
});

const saveDraft = defineEndpoint({
  name: "saveDraft",
  method: "PUT",
  path: "/drafts/:channelId",
  auth: "session",
  description: "Persists the caller's draft for a channel (survives reloads/tab switches).",
  request: z.object({ channelId: z.string(), text: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const markRead = defineEndpoint({
  name: "markRead",
  method: "POST",
  path: "/channels/:id/read",
  auth: "session",
  description: "Advances the caller's read cursor for a channel (also arrives over WS as a `read` frame).",
  request: z.object({ id: z.string(), messageId: z.string().nullable().optional() }),
  response: z.object({ ok: z.boolean() }),
});

const uploadAssets = defineEndpoint({
  name: "uploadAssets",
  method: "POST",
  path: "/channels/:id/assets",
  auth: "session-or-apiKey",
  description:
    "Multipart upload of one or more files into a channel. Stored via the storage adapter (TwoDrive S3 stub / local fs today). Returns asset payloads to embed as attachment blocks.",
  request: z.object({ id: z.string() }),
  response: z.object({ assets: z.array(asset) }),
});

const getAsset = defineEndpoint({
  name: "getAsset",
  method: "GET",
  path: "/assets/:id",
  auth: "session-or-apiKey",
  description: "Streams an attachment's bytes (auth-checked; blobs are never publicly addressed).",
  request: z.object({ id: z.string() }),
  response: z.any(),
});

const listAssets = defineEndpoint({
  name: "listAssets",
  method: "GET",
  path: "/channels/:id/assets",
  auth: "session-or-apiKey",
  description: "Files shared in a channel.",
  request: z.object({ id: z.string() }),
  response: z.array(asset),
});

const listBots = defineEndpoint({
  name: "listBots",
  method: "GET",
  path: "/bots",
  auth: "session-or-apiKey",
  description: "Agent/bot participants of the workspace (name, avatar emoji, kind).",
  response: z.array(bot),
});

const createBot = defineEndpoint({
  name: "createBot",
  method: "POST",
  path: "/bots",
  auth: "session",
  description:
    "Registers a bot participant. `apiKeyId` binds a workspace API key (from TwoDB control plane) so the agent can post via /bots/webhook.",
  request: z.object({
    name: z.string().min(1),
    kind: z.string().optional(),
    apiKeyId: z.string().optional(),
    avatarEmoji: z.string().optional(),
    description: z.string().optional(),
  }),
  response: bot,
});

const botWebhook = defineEndpoint({
  name: "botWebhook",
  method: "POST",
  path: "/bots/webhook",
  auth: "apiKey",
  description:
    "THE agent participation endpoint. Auth = workspace API key bound to a bot. Posts a composed message (blocks or text) into `channelId`/`channelName`, " +
    "auto-joins the bot to the channel, fans out over WS and notifies mentioned users — identical treatment to human messages. " +
    "This is how agents become chat citizens: they read via listMessages and reply via this.",
  request: z.object({
    channelId: z.string().optional(),
    channelName: z.string().optional(),
    text: z.string().optional(),
    blocks: messageBlocks.optional(),
    replyToId: z.string().optional(),
  }),
  response: message,
});

const listBotActions = defineEndpoint({
  name: "listBotActions",
  method: "GET",
  path: "/bots/actions",
  auth: "apiKey",
  description: "Durable inbox of interactive message button clicks addressed to the calling bot. Unacknowledged only by default.",
  request: z.object({ includeAcknowledged: z.coerce.boolean().optional() }),
  response: z.object({ actions: z.array(messageAction) }),
});

const acknowledgeBotAction = defineEndpoint({
  name: "acknowledgeBotAction",
  method: "POST",
  path: "/bots/actions/:id/ack",
  auth: "apiKey",
  description: "Marks one interactive-message action processed by the calling bot.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const listConversationLists = defineEndpoint({
  name: "listConversationLists",
  method: "GET",
  path: "/lists",
  auth: "session",
  description: "Lists the dynamic top-level conversation lists visible to the caller. Lists may be workspace-wide or scoped to one accessible space. Messages is created automatically as the default list.",
  response: z.array(conversationList),
});

const createConversationList = defineEndpoint({
  name: "createConversationList",
  method: "POST",
  path: "/lists",
  auth: "session",
  description: "Creates an isolated conversation list/tab, optionally scoped to a space.",
  request: z.object({ name: z.string().min(1), spaceId: z.string().nullable().optional() }),
  response: conversationList,
});

const updateConversationList = defineEndpoint({
  name: "updateConversationList",
  method: "PATCH",
  path: "/lists/:id",
  auth: "session",
  description: "Renames, reorders, or changes the space scope of a conversation list.",
  request: z.object({ id: z.string(), name: z.string().optional(), spaceId: z.string().nullable().optional(), position: z.number().optional() }),
  response: z.object({ ok: z.boolean() }),
});

const deleteConversationList = defineEndpoint({
  name: "deleteConversationList",
  method: "DELETE",
  path: "/lists/:id",
  auth: "session",
  description: "Deletes a non-default empty list. Move or delete its conversations first.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const listListConversations = defineEndpoint({
  name: "listListConversations",
  method: "GET",
  path: "/lists/:id/conversations",
  auth: "session",
  description: "Lists only the conversations isolated inside one visible list.",
  request: z.object({ id: z.string() }),
  response: z.array(channel),
});

const createListConversation = defineEndpoint({
  name: "createListConversation",
  method: "POST",
  path: "/lists/:id/conversations",
  auth: "session",
  description: "Creates a conversation in a list. Each conversation independently chooses isReadOnly; optional source metadata supports local copies from Slack, Teams, WhatsApp, or any external system.",
  request: z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["channel", "dm"]).optional(),
    topic: z.string().optional(),
    isReadOnly: z.boolean().optional(),
    sourceProvider: z.string().optional(),
    sourceExternalId: z.string().optional(),
    sourceUrl: z.string().optional(),
    avatarUrl: z.string().optional(),
  }),
  response: channel,
});

const importConversationMessages = defineEndpoint({
  name: "importConversationMessages",
  method: "POST",
  path: "/conversations/:id/import",
  auth: "session-or-apiKey",
  description: "Idempotently stores immutable local message copies in a read-only conversation. Source-specific collectors normalize into this provider-neutral envelope.",
  request: z.object({
    id: z.string(),
    messages: z.array(z.object({
      externalId: z.string(),
      senderName: z.string(),
      senderAvatarUrl: z.string().optional(),
      text: z.string(),
      sourceUrl: z.string().optional(),
      sentAt: z.string(),
    })),
  }),
  response: z.object({ inserted: z.number(), duplicate: z.number() }),
});

const listNotifications = defineEndpoint({
  name: "listNotifications",
  method: "GET",
  path: "/notifications",
  auth: "session",
  description: "The caller's notification inbox (mentions, DMs, bot posts) with unread count.",
  response: z.object({ notifications: z.array(notification), unread: z.number() }),
});

const markNotificationRead = defineEndpoint({
  name: "markNotificationRead",
  method: "POST",
  path: "/notifications/:id/read",
  auth: "session",
  description: "Marks one notification read.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const markAllNotificationsRead = defineEndpoint({
  name: "markAllNotificationsRead",
  method: "POST",
  path: "/notifications/read-all",
  auth: "session",
  description: "Marks the whole inbox read.",
  response: z.object({ ok: z.boolean() }),
});

const search = defineEndpoint({
  name: "search",
  method: "GET",
  path: "/search",
  auth: "session-or-apiKey",
  capability: "search",
  description: "Full-text-ish message search (ILIKE over the text projection) feeding the Gateway's federated search fan-out.",
  request: z.object({ q: z.string() }),
  response: z.object({
    results: z.array(z.object({ id: z.string(), title: z.string(), snippet: z.string(), url: z.string(), channelId: z.string(), createdAt: z.string() })),
  }),
});

export const twochatManifest = defineAppManifest({
  name: "TwoChat",
  slug: "twochat",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Workspace chat (Slack-style): public channels, DMs, threads, reactions, pins, saved items, drafts, read state, attachments, " +
    "notifications, and composed block messages (buttons, images, fields, task lists…) authored by humans AND agent bots — " +
    "bots participate as first-class members via workspace API keys.",
  capabilities: ["search", "ws"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twochat/api",
  websocketPaths: ["/ws"],
  endpoints: [
    collabStop,
    collabRollback,
    svcInbox,
    svcMessageSchema,
    svcMessageValidate,
    listChannels,
    createChannel,
    getChannel,
    updateChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
    openDm,
    listMessages,
    postMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    invokeMessageAction,
    togglePin,
    toggleSaved,
    listPins,
    listSaved,
    getDraft,
    saveDraft,
    markRead,
    uploadAssets,
    getAsset,
    listAssets,
    listBots,
    createBot,
    botWebhook,
    listBotActions,
    acknowledgeBotAction,
    listConversationLists,
    createConversationList,
    updateConversationList,
    deleteConversationList,
    listListConversations,
    createListConversation,
    importConversationMessages,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    search,
  ],
});

export default twochatManifest;

// Re-exported for consumers (webapp types via endpoint.json, tests).
export { message, channel, notification, bot, asset, member, reactionSummary, actorInfo, blockTextObject, blockMention };
