import type { Member, Channel, ConversationList, Message, Notification, Bot, Space, Asset, MessageBlock } from "../lib/chat-client";

/**
 * Fixtures for every twochat story. Shapes mirror chat-client.ts exactly;
 * timestamps are fixed strings so snapshots stay deterministic.
 */

const iso = (minutesAgo: number) => new Date(Date.parse("2025-06-01T12:00:00Z") - minutesAgo * 60_000).toISOString();

export const ME = "user_me";

export const members: Record<"ada" | "bruno" | "cleo" | "scout" | "me", Member> = {
  me: { id: "m_me", type: "user", userId: ME, botId: null, name: "You", avatarEmoji: null, role: "admin" },
  ada: { id: "m_ada", type: "user", userId: "user_ada", botId: null, name: "Ada Lovelace", avatarEmoji: "👩‍💻", role: "member" },
  bruno: { id: "m_bruno", type: "user", userId: "user_bruno", botId: null, name: "Bruno Silva", avatarEmoji: null, role: "member" },
  cleo: { id: "m_cleo", type: "user", userId: "user_cleo", botId: null, name: "Cleo Park", avatarEmoji: "🎨", role: "member" },
  scout: { id: "m_scout", type: "bot", userId: null, botId: "bot_scout", name: "Scout", avatarEmoji: "🤖", role: "member" },
};

export const memberList = Object.values(members);

export const spaces: Space[] = [
  { id: "space_eng", name: "Engineering" },
  { id: "space_ops", name: "Operations" },
];

export const lists: ConversationList[] = [
  { id: "list_default", spaceId: null, name: "Messages", position: 0, isDefault: true, conversationCount: 6, unreadCount: 4, createdAt: iso(6000), updatedAt: iso(5) },
  { id: "list_support", spaceId: "space_eng", name: "Support", position: 1, isDefault: false, conversationCount: 3, unreadCount: 0, createdAt: iso(5000), updatedAt: iso(120) },
  { id: "list_personal", spaceId: null, name: "Personal", position: 2, isDefault: false, conversationCount: 2, unreadCount: 12, createdAt: iso(4000), updatedAt: iso(60) },
];

const baseChannel = {
  listId: null,
  dmKey: null,
  sourceProvider: null,
  sourceExternalId: null,
  sourceUrl: null,
  avatarUrl: null,
  createdBy: ME,
  createdByType: "user" as const,
  archivedAt: null,
};

export const channels: Channel[] = [
  {
    ...baseChannel,
    id: "ch_eng", kind: "channel", name: "engineering", topic: "Ship things, break nothing", isReadOnly: false,
    position: 0, lastMessageAt: iso(3), createdAt: iso(6000), updatedAt: iso(3), unreadCount: 4, memberCount: 4,
    members: [members.me, members.ada, members.bruno, members.cleo],
  },
  {
    ...baseChannel,
    id: "ch_design", kind: "channel", name: "design-review", topic: "Weekly crits — bring mocks", isReadOnly: false,
    avatarUrl: null, position: 1, lastMessageAt: iso(55), createdAt: iso(5900), updatedAt: iso(55), unreadCount: 0, memberCount: 3,
    members: [members.me, members.cleo, members.scout],
  },
  {
    ...baseChannel,
    id: "ch_status", kind: "channel", name: "deploys", topic: "Automated deploy log", isReadOnly: true,
    sourceProvider: "github", sourceExternalId: "gh_901", sourceUrl: "https://example.com/deploys",
    position: 2, lastMessageAt: iso(600), createdAt: iso(5800), updatedAt: iso(600), unreadCount: 99, memberCount: 2,
    members: [members.me, members.scout],
  },
  {
    ...baseChannel,
    id: "dm_ada", kind: "dm", name: "Ada Lovelace", topic: null, isReadOnly: false,
    dmKey: "user_me|user_ada", position: 3, lastMessageAt: iso(12), createdAt: iso(4000), updatedAt: iso(12), unreadCount: 2, memberCount: 2,
    members: [members.me, members.ada],
  },
  {
    ...baseChannel,
    id: "dm_scout", kind: "dm", name: "Scout", topic: null, isReadOnly: false,
    dmKey: "user_me|bot_scout", position: 4, lastMessageAt: iso(30), createdAt: iso(3900), updatedAt: iso(30), unreadCount: 0, memberCount: 2,
    members: [members.me, members.scout],
  },
  {
    ...baseChannel,
    id: "dm_bruno", kind: "dm", name: "Bruno Silva", topic: null, isReadOnly: true,
    dmKey: "user_me|user_bruno", sourceProvider: "slack", sourceExternalId: "sl_77", sourceUrl: "https://slack.example.com/archives/77",
    position: 5, lastMessageAt: iso(1440), createdAt: iso(3800), updatedAt: iso(1440), unreadCount: 0, memberCount: 2,
    members: [members.me, members.bruno],
  },
];

export const channel = (id: string): Channel => {
  const found = channels.find((c) => c.id === id);
  if (!found) throw new Error(`no fixture channel ${id}`);
  return found;
};

const baseMessage = {
  channelId: "ch_eng",
  externalId: null,
  sourceUrl: null,
  replyToId: null,
  replyTo: null,
  editedAt: null,
  deletedAt: null,
  pinned: false,
  saved: false,
  reactions: [],
  collab: null,
};

/** One message per authored shape — see the MessageRow stories for the full spread. */
export const messages: Message[] = [
  { ...baseMessage, id: "msg_text", authorType: "user", userId: ME, botId: null, authorName: "You", authorEmoji: null, authorAvatarUrl: null, text: "Plain user text — nothing fancy.", blocks: null, createdAt: iso(50) },
  { ...baseMessage, id: "msg_grouped", authorType: "user", userId: ME, botId: null, authorName: "You", authorEmoji: null, authorAvatarUrl: null, text: "Second in a row — header collapses.", blocks: null, createdAt: iso(49) },
  { ...baseMessage, id: "msg_edited", authorType: "user", userId: "user_ada", botId: null, authorName: "Ada Lovelace", authorEmoji: "👩‍💻", authorAvatarUrl: null, text: "Edited after the fact.", blocks: null, editedAt: iso(40), createdAt: iso(45) },
  {
    ...baseMessage, id: "msg_reply", authorType: "user", userId: "user_bruno", botId: null, authorName: "Bruno Silva", authorEmoji: null, authorAvatarUrl: null,
    text: "Replying to your earlier point.", blocks: null, replyToId: "msg_text", replyTo: { id: "msg_text", authorName: "You", snippet: "Plain user text — nothing fancy." }, createdAt: iso(44),
  },
  {
    ...baseMessage, id: "msg_reactions", authorType: "user", userId: "user_cleo", botId: null, authorName: "Cleo Park", authorEmoji: "🎨", authorAvatarUrl: null,
    text: "Reactions of every flavour.", blocks: null,
    reactions: [
      { emoji: "🎉", count: 3, mine: true },
      { emoji: "👍", count: 1, mine: false },
      { emoji: "🚀", count: 12, mine: false },
    ],
    createdAt: iso(43),
  },
  { ...baseMessage, id: "msg_pinned", authorType: "user", userId: "user_ada", botId: null, authorName: "Ada Lovelace", authorEmoji: "👩‍💻", authorAvatarUrl: null, text: "Pinned: standup is 09:30.", blocks: null, pinned: true, createdAt: iso(300) },
  { ...baseMessage, id: "msg_deleted", authorType: "user", userId: "user_bruno", botId: null, authorName: "Bruno Silva", authorEmoji: null, authorAvatarUrl: null, text: "(gone)", blocks: null, deletedAt: iso(41), createdAt: iso(42) },
  {
    ...baseMessage, id: "msg_bot", authorType: "bot", userId: null, botId: "bot_scout", authorName: "Scout", authorEmoji: "🤖", authorAvatarUrl: null,
    text: "Weekly digest is out — three highlights below.", blocks: null, createdAt: iso(35),
  },
  {
    ...baseMessage, id: "msg_collab", authorType: "bot", userId: null, botId: "bot_artisan", authorName: "Atlas", authorEmoji: "🛠️", authorAvatarUrl: null,
    text: "Done — fixed the flaky test and opened a PR.", blocks: null,
    collab: { taskId: "task_1", runId: "run_9", sessionId: "sess_42", outcome: "ok" },
    createdAt: iso(20),
  },
  {
    ...baseMessage, id: "msg_collab_failed", authorType: "bot", userId: null, botId: "bot_artisan", authorName: "Atlas", authorEmoji: "🛠️", authorAvatarUrl: null,
    text: "Couldn't finish: the runner went away mid-task.", blocks: null,
    collab: { taskId: "task_2", runId: "run_10", sessionId: "sess_43", outcome: "failed" },
    createdAt: iso(19),
  },
];

export const message = (id: string): Message => {
  const found = messages.find((m) => m.id === id);
  if (!found) throw new Error(`no fixture message ${id}`);
  return found;
};

export const notifications: Notification[] = [
  { id: "n_mention", kind: "mention", title: "Ada mentioned you", body: "…can you take a look at the auth flow @you before EOD?", channelId: "ch_eng", messageId: "msg_9", readAt: null, createdAt: iso(5) },
  { id: "n_dm", kind: "dm", title: "New message from Ada", body: "quick q about the sidebar tabs", channelId: "dm_ada", messageId: "msg_10", readAt: null, createdAt: iso(12) },
  { id: "n_bot", kind: "bot-post", title: "Scout posted in deploys", body: "Deploy #482 succeeded — 4 files changed", channelId: "ch_status", messageId: "msg_11", readAt: iso(20), createdAt: iso(25) },
  { id: "n_system", kind: "system", title: "Workspace", body: "Two new members joined Engineering", channelId: null, messageId: null, readAt: iso(40), createdAt: iso(45) },
];

export const bots: Bot[] = [
  { id: "bot_scout", name: "Scout", kind: "digest", avatarEmoji: "🤖", description: "Summarizes channels every Monday", createdAt: iso(6000), runtimeApp: null, enabled: true },
  { id: "bot_atlas", name: "Atlas", kind: "collaborator", avatarEmoji: "🛠️", description: "Codes, tests and opens PRs on a runner", createdAt: iso(5000), runtimeApp: "artisan", enabled: true },
  { id: "bot_vest", name: "Vest", kind: "collaborator", avatarEmoji: "🦺", description: "Awaiting a runner + directory", createdAt: iso(900), runtimeApp: "artisan", enabled: false },
];

export const assets: Asset[] = [
  { id: "asset_pdf", channelId: "ch_eng", filename: "architecture.pdf", contentType: "application/pdf", size: 248_320, createdAt: iso(30) },
  { id: "asset_png", channelId: "ch_eng", filename: "mockup.png", contentType: "image/png", size: 1_204_800, createdAt: iso(29) },
];

/** A message carrying every block type twochat defines (see src/blocks.ts). */
export const allBlocksMessage: Message = {
  ...baseMessage,
  id: "msg_all_blocks",
  authorType: "bot",
  userId: null,
  botId: "bot_scout",
  authorName: "Scout",
  authorEmoji: "🤖",
  authorAvatarUrl: null,
  text: "",
  blocks: [
    { type: "markdown", text: "**All block types** in one message — the storybook kitchen sink." },
    { type: "rich-text", elements: [
      { type: "text", text: "Rich text with a " },
      { type: "mention", kind: "user", id: "user_ada", label: "Ada Lovelace" },
      { type: "text", text: " mention inline." },
    ] },
    { type: "status", state: "success", text: "All checks passed" },
    { type: "status", state: "loading", text: "Indexing channels…" },
    { type: "divider" },
    { type: "image", url: "https://picsum.photos/seed/twochat/480/260", alt: "Random placeholder", title: "Q3 velocity chart" },
    { type: "actions", elements: [
      { type: "button", text: "Approve", actionId: "approve", style: "primary" },
      { type: "button", text: "Reject", actionId: "reject", style: "secondary" },
    ] },
    { type: "link-button", text: "Open dashboard", url: "https://example.com/dashboard", style: { tone: "primary" } },
    { type: "field", label: "Environment", value: "production", short: true },
    { type: "field", label: "Notes", value: "Migration window is Friday 02:00–04:00 UTC. Watch the queue depth.", short: false },
    { type: "context", elements: [
      { text: "Triggered by " },
      { mention: { kind: "bot", id: "bot_scout", label: "Scout" } },
      { text: " · just now" },
    ] },
    { type: "attachment", assetId: "asset_pdf", filename: "architecture.pdf" },
    { type: "link-card", url: "https://example.com/blog/post", title: "How we ship", description: "Notes on the review pipeline" },
    { type: "quote", text: "Make it work, make it right, make it fast.", cite: "Kent Beck" },
    { type: "code", code: "const run = async () => {\n  const rows = await db.select().from(channels);\n  return rows.length;\n};", language: "ts", filename: "seed.ts" },
    { type: "task-list", title: "Launch checklist", tasks: [
      { text: "Freeze schema", done: true },
      { text: "Run smoke suite", done: true },
      { text: "Flip the flag", done: false },
    ] },
    { type: "callout", tone: "info", title: "Heads up", text: "The gateway restarts at 02:00 UTC." },
    { type: "callout", tone: "success", title: "Shipped", text: "Sidebar tabs match artisan now." },
    { type: "callout", tone: "warning", title: "Careful", text: "Rollback also undoes file changes." },
    { type: "callout", tone: "danger", title: "Broken", text: "The resize handle renders off-screen." },
  ],
  createdAt: iso(10),
};

/** A block alone, for the per-type BlockView stories. */
export const block = (partial: MessageBlock): MessageBlock => partial;

export const previews: Record<string, string> = {
  ch_eng: "Ada: fixed it — see the PR",
  ch_design: "Cleo: new mocks in Figma",
  ch_status: "deploy #482 ok",
  dm_ada: "quick q about the sidebar tabs",
  dm_scout: "digest ready",
  dm_bruno: "(read-only mirror)",
};

export const online = new Set<string>(["user_ada", "user_bruno"]);
