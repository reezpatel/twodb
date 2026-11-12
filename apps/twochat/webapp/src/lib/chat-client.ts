// Thin client over TwoChat's API — always through the gateway (dev proxy
// /twochat-api → /apps/twochat), so identity is the shared control-plane
// session resolved by TwoDB and forwarded as x-twodb-* headers.

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

export interface Notification {
  id: string;
  kind: "mention" | "dm" | "channel" | "bot-post" | "system";
  title: string;
  body: string;
  channelId: string | null;
  messageId: string | null;
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
}

export interface Asset {
  id: string;
  channelId: string | null;
  filename: string;
  contentType: string | null;
  size: number;
  createdAt: string;
}

const BASE = "/twochat-api";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const chatApi = {
  listChannels: () => call<Channel[]>("/channels"),

  createChannel: (input: { name: string; topic?: string; botIds?: string[] }) =>
    call<Channel>("/channels", { method: "POST", body: JSON.stringify(input) }),

  getChannel: (id: string) => call<Channel & { members: Member[] }>(`/channels/${id}`),

  updateChannel: (id: string, patch: { name?: string; topic?: string | null; archived?: boolean }) =>
    call<Channel>(`/channels/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteChannel: (id: string) => call<{ ok: boolean }>(`/channels/${id}`, { method: "DELETE" }),

  joinChannel: (id: string) => call<{ ok: boolean }>(`/channels/${id}/join`, { method: "POST" }),

  openDm: (input: { userIds?: string[]; botIds?: string[] }) =>
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

  listNotifications: () => call<{ notifications: Notification[]; unread: number }>("/notifications"),

  markNotificationRead: (id: string) => call<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),

  markAllNotificationsRead: () => call<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
};

/** Direct message channels show the other members' names, not the raw dm_key. */
export function dmTitle(channel: Channel, myUserId: string | null): string {
  if (channel.kind !== "dm") return channel.name;
  const others = channel.members.filter((m) => !(m.type === "user" && m.userId === myUserId));
  return others.map((m) => m.name).join(", ") || "just you";
}
