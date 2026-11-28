// Thin client over TwoChat's API — always through the gateway (dev proxy
// /twochat-api → /apps/twochat), so identity is the shared control-plane
// session resolved by TwoDB and forwarded as x-twodb-* headers.

import { notifyApi, type AppNotification } from "@twodb/twodb-shared-frontend";

export interface MessageBlock {
  type: string;
  [key: string]: unknown;
}

export interface Member {
  id: string;
  type: "user" | "bot";
  userId: string | null;
  botId: string | null;
  name: string;
  avatarEmoji: string | null;
  role: "member" | "admin";
}

export interface Channel {
  id: string;
  listId: string | null;
  kind: "channel" | "dm";
  name: string;
  topic: string | null;
  isReadOnly: boolean;
  sourceProvider: string | null;
  sourceExternalId: string | null;
  sourceUrl: string | null;
  avatarUrl: string | null;
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
  members: Member[];
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  authorType: "user" | "bot";
  userId: string | null;
  botId: string | null;
  authorName: string;
  authorEmoji: string | null;
  authorAvatarUrl: string | null;
  externalId: string | null;
  sourceUrl: string | null;
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
  /** Set on a collaborator's replies: which task/session produced it. */
  collab?: { taskId: string; runId: string; sessionId: string | null; outcome: "ok" | "failed" | "stopped" | string } | null;
}

/**
 * TwoChat's notification projection. Notifications live in the control plane
 * (see core/twodb-shared-frontend/notify) — this shape maps the control-plane
 * record to what the panel renders, deriving channelId from the deep link.
 */
export interface Notification {
  id: string;
  kind: "mention" | "dm" | "channel" | "bot-post" | "system";
  title: string;
  body: string;
  channelId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Bot {
  id: string;
  name: string;
  kind: string;
  avatarEmoji: string | null;
  description: string | null;
  createdAt: string;
  /** "artisan" for collaborators (agents that do work); null for plain bots. */
  runtimeApp?: string | null;
  /** False when a collaborator cannot run yet (no runner/directory). */
  enabled?: boolean;
}

export interface Asset {
  id: string;
  channelId: string | null;
  filename: string;
  contentType: string | null;
  size: number;
  createdAt: string;
}

export interface ConversationList {
  id: string;
  spaceId: string | null;
  name: string;
  position: number;
  isDefault: boolean;
  conversationCount: number;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  name: string;
}

const BASE = "/api";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const chatApi = {
  /** Stop whatever collaborators are working on in this channel. */
  stopCollab: (channelId: string) => call<{ stopped: number }>(`/channels/${channelId}/collab/stop`, { method: "POST", body: "{}" }),

  /** Roll the conversation back to just before `messageId` (later messages hidden, the collaborator's work undone). */
  rollbackTo: (messageId: string, restoreFiles: boolean) =>
    call<{ hidden: number; tasks: number }>(`/messages/${messageId}/rollback`, { method: "POST", body: JSON.stringify({ restoreFiles }) }),

  listChannels: () => call<Channel[]>("/channels"),

  createChannel: (input: { name: string; topic?: string; listId?: string; botIds?: string[] }) =>
    call<Channel>("/channels", { method: "POST", body: JSON.stringify(input) }),

  getChannel: (id: string) => call<Channel & { members: Member[] }>(`/channels/${id}`),

  updateChannel: (id: string, patch: { name?: string; topic?: string | null; archived?: boolean }) =>
    call<Channel>(`/channels/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteChannel: (id: string) => call<{ ok: boolean }>(`/channels/${id}`, { method: "DELETE" }),

  joinChannel: (id: string) => call<{ ok: boolean }>(`/channels/${id}/join`, { method: "POST" }),

  openDm: (input: { listId?: string; userIds?: string[]; botIds?: string[] }) =>
    call<Channel>("/dms", { method: "POST", body: JSON.stringify(input) }),

  listMessages: (channelId: string, before?: string | null) =>
    call<{ messages: Message[]; next: string | null }>(
      `/channels/${channelId}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    ),

  postMessage: (channelId: string, input: { text?: string; blocks?: MessageBlock[]; replyToId?: string }) =>
    call<Message>(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(input) }),

  editMessage: (id: string, input: { text?: string; blocks?: MessageBlock[] }) =>
    call<Message>(`/messages/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  deleteMessage: (id: string) => call<{ ok: boolean }>(`/messages/${id}`, { method: "DELETE" }),

  toggleReaction: (id: string, emoji: string) =>
    call<{ reactions: ReactionSummary[] }>(`/messages/${id}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }),

  invokeAction: (messageId: string, actionId: string, value?: string) =>
    call<{ id: string; actionId: string; createdAt: string }>(`/messages/${messageId}/actions/${encodeURIComponent(actionId)}`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),

  togglePin: (id: string) => call<{ pinned: boolean }>(`/messages/${id}/pin`, { method: "POST" }),

  toggleSaved: (id: string) => call<{ saved: boolean }>(`/messages/${id}/save`, { method: "POST" }),

  listPins: (channelId: string) => call<Message[]>(`/channels/${channelId}/pins`),

  listSaved: () => call<Message[]>("/saved"),

  getDraft: (channelId: string) => call<{ text: string }>(`/drafts/${channelId}`),

  saveDraft: (channelId: string, text: string) =>
    call<{ ok: boolean }>(`/drafts/${channelId}`, { method: "PUT", body: JSON.stringify({ text }) }),

  markRead: (channelId: string, messageId: string | null) =>
    call<{ ok: boolean }>(`/channels/${channelId}/read`, { method: "POST", body: JSON.stringify({ messageId }) }),

  uploadAssets: async (channelId: string, files: File[]): Promise<Asset[]> => {
    const body = new FormData();
    for (const f of files) body.append("files", f, f.name);
    const res = await fetch(`${BASE}/channels/${channelId}/assets`, { method: "POST", body, credentials: "include" });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    const json = (await res.json()) as { assets: Asset[] };
    return json.assets;
  },

  assetUrl: (assetId: string) => `${BASE}/assets/${assetId}`,

  listBots: () => call<Bot[]>("/bots"),

  listLists: () => call<ConversationList[]>("/lists"),

  createList: (input: { name: string; spaceId?: string | null }) =>
    call<ConversationList>("/lists", { method: "POST", body: JSON.stringify(input) }),

  updateList: (id: string, patch: { name?: string; spaceId?: string | null; position?: number }) =>
    call<{ ok: boolean }>(`/lists/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteList: (id: string) => call<{ ok: boolean }>(`/lists/${id}`, { method: "DELETE" }),

  listListConversations: (listId: string) => call<Channel[]>(`/lists/${listId}/conversations`),

  createListConversation: (listId: string, input: {
    name: string;
    kind?: "channel" | "dm";
    topic?: string;
    isReadOnly?: boolean;
    sourceProvider?: string;
    sourceExternalId?: string;
    sourceUrl?: string;
    avatarUrl?: string;
  }) => call<Channel>(`/lists/${listId}/conversations`, { method: "POST", body: JSON.stringify(input) }),

  importConversationMessages: (conversationId: string, messages: Array<{
    externalId: string;
    senderName: string;
    senderAvatarUrl?: string;
    text: string;
    sourceUrl?: string;
    sentAt: string;
  }>) => call<{ inserted: number; duplicate: number }>(`/conversations/${conversationId}/import`, { method: "POST", body: JSON.stringify({ messages }) }),
};

/** Derive the channel id from the notification's deep link (/chat?channel=<id>&message=<id>). */
function channelIdFrom(deepLink: string | null): string | null {
  if (!deepLink) return null;
  try {
    return new URL(deepLink, window.location.origin).searchParams.get("channel");
  } catch {
    return null;
  }
}

function toNotification(n: AppNotification): Notification {
  return {
    id: n.id,
    kind: (["mention", "dm", "channel", "bot-post", "system"].includes(n.kind) ? n.kind : "system") as Notification["kind"],
    title: n.title,
    body: n.body,
    channelId: channelIdFrom(n.deepLink),
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

/** Notifications come from the control plane (cross-app inbox), scoped to TwoChat. */
export const notificationsApi = {
  listNotifications: async () => {
    const res = await notifyApi.list("twochat");
    return { notifications: res.notifications.map(toNotification), unread: res.unread };
  },
  markNotificationRead: (id: string) => notifyApi.markRead(id),
  markAllNotificationsRead: () => notifyApi.markAllRead(),
};

export const controlPlaneClient = {
  listSpaces: async (): Promise<{ spaces: Space[] }> => {
    const response = await fetch("/registry/spaces", { credentials: "include" });
    if (!response.ok) throw new Error(`${response.status}: unable to load spaces`);
    return response.json() as Promise<{ spaces: Space[] }>;
  },
};

/** Direct message channels show the other members' names, not the raw dm_key. */
export function dmTitle(channel: Channel, myUserId: string | null): string {
  if (channel.kind !== "dm") return channel.name;
  const others = channel.members.filter((m) => !(m.type === "user" && m.userId === myUserId));
  return others.map((m) => m.name).join(", ") || "just you";
}
