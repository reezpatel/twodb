// Declarative notification registry — one entry per origin (core or app),
// mirroring llm-providers.ts: groups + types, default urgency/channels, and
// the only api-endpoints actions may invoke. The settings UI (and a future
// Android client bootstrapping its NotificationChannels) renders straight
// from this shape.

export interface NotificationActionSpec {
  id: string;
  label: string;
  style?: "default" | "primary" | "destructive";
  /** link | api | dismiss. */
  verb: "link" | "api" | "dismiss";
  /** For verb=api: registry-declared endpoint the action POSTs to. */
  endpoint?: string;
  /** For verb=link: deep link opened when the action is clicked. */
  deepLink?: string;
}

export interface NotificationTypeSpec {
  /** Dotted type id — its group id must be the prefix before the dot. */
  id: string;
  label: string;
  description?: string;
  defaultUrgency: Urgency;
  /** Shorter-than-default expiry for transient types, in days. */
  expiryDays?: number;
  defaultChannels: ChannelSet;
  /** Actions this type may attach (max 3 per send). */
  actions?: NotificationActionSpec[];
}

export interface NotificationGroupSpec {
  /** "core" or an app id — also the preference groupId. */
  id: string;
  label: string;
  description?: string;
  types: NotificationTypeSpec[];
}

export type Urgency = "low" | "normal" | "high" | "critical";
export type ChannelId = "inApp" | "toast" | "osPush" | "emailDigest";
export type ChannelSet = Partial<Record<ChannelId, boolean>>;

export const DEFAULT_CHANNELS: ChannelSet = { inApp: true, toast: true, osPush: false, emailDigest: false };

export const URGENCY_RANK: Record<Urgency, number> = { low: 0, normal: 1, high: 2, critical: 3 };

export const NOTIFICATION_REGISTRY: NotificationGroupSpec[] = [
  {
    id: "core",
    label: "twodb",
    description: "System notifications from the twodb server",
    types: [
      {
        id: "core.runner",
        label: "Runner status",
        description: "Runners going offline or reconnecting",
        defaultUrgency: "high",
        defaultChannels: { ...DEFAULT_CHANNELS, osPush: true },
      },
      {
        id: "core.job",
        label: "Background jobs",
        description: "Long-running job completions and failures",
        defaultUrgency: "normal",
        expiryDays: 7,
        defaultChannels: DEFAULT_CHANNELS,
      },
      {
        id: "core.agent",
        label: "Agent questions",
        description: "Agents waiting for your answer (ask_user)",
        defaultUrgency: "high",
        defaultChannels: { ...DEFAULT_CHANNELS, osPush: true },
      },
      {
        id: "core.system",
        label: "System",
        description: "Server-level notices",
        defaultUrgency: "normal",
        defaultChannels: DEFAULT_CHANNELS,
      },
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    types: [
      {
        id: "calendar.reminder",
        label: "Reminders",
        description: "Event reminders before meetings start",
        defaultUrgency: "high",
        defaultChannels: { ...DEFAULT_CHANNELS, osPush: true },
      },
    ],
  },
  {
    id: "chat",
    label: "Chat",
    types: [
      {
        id: "chat.mention",
        label: "Mentions",
        description: "Someone @mentioned you in a channel",
        defaultUrgency: "high",
        defaultChannels: DEFAULT_CHANNELS,
      },
    ],
  },
  {
    id: "code",
    label: "Code",
    types: [
      {
        id: "code.job",
        label: "Session jobs",
        description: "Background jobs in code sessions finishing or failing",
        defaultUrgency: "normal",
        expiryDays: 7,
        defaultChannels: DEFAULT_CHANNELS,
      },
    ],
  },
  {
    id: "teams",
    label: "Teams",
    description: "Microsoft Teams accounts watched by a runner",
    types: [
      {
        id: "teams.message",
        label: "Messages",
        description: "Chat and channel messages from watched Teams accounts",
        defaultUrgency: "normal",
        expiryDays: 7,
        defaultChannels: DEFAULT_CHANNELS,
        actions: [{ id: "open", label: "Open in Teams", style: "primary", verb: "link" }],
      },
      {
        id: "teams.mention",
        label: "Mentions",
        description: "@mentions and replies in watched Teams accounts",
        defaultUrgency: "high",
        expiryDays: 7,
        defaultChannels: { ...DEFAULT_CHANNELS, osPush: true },
        actions: [{ id: "open", label: "Open in Teams", style: "primary", verb: "link" }],
      },
      {
        id: "teams.call",
        label: "Calls",
        description: "Incoming and missed calls",
        defaultUrgency: "critical",
        expiryDays: 3,
        defaultChannels: { ...DEFAULT_CHANNELS, osPush: true },
        actions: [{ id: "open", label: "Open in Teams", style: "primary", verb: "link" }],
      },
      {
        id: "teams.auth",
        label: "Sign-in required",
        description: "A Teams session needs you to sign in again (2FA, expired session)",
        defaultUrgency: "high",
        defaultChannels: { ...DEFAULT_CHANNELS, osPush: true },
        actions: [{ id: "connect", label: "Open connect screen", style: "primary", verb: "link" }],
      },
    ],
  },
];

const byType = new Map<string, { group: NotificationGroupSpec; type: NotificationTypeSpec }>();
for (const group of NOTIFICATION_REGISTRY) for (const type of group.types) byType.set(type.id, { group, type });

export function typeSpec(typeId: string) {
  return byType.get(typeId);
}

/** Resolve a type to its registry group id ("calendar.reminder" → "calendar"). */
export function groupIdOfType(typeId: string): string {
  return byType.get(typeId)?.group.id ?? typeId.split(".")[0] ?? "core";
}

/** Registry view for the client (settings UI / Android channel bootstrap). */
export function registryPayload() {
  return NOTIFICATION_REGISTRY.map((g) => ({
    id: g.id,
    label: g.label,
    description: g.description ?? null,
    types: g.types.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description ?? null,
      defaultUrgency: t.defaultUrgency,
      expiryDays: t.expiryDays ?? null,
      defaultChannels: t.defaultChannels,
    })),
  }));
}
