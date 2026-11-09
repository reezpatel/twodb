import { db } from "../../auth";
import { logger } from "../logger";
import { publish, publishToUser } from "../ws-gateway";
import { DEFAULT_CHANNELS, URGENCY_RANK, groupIdOfType, typeSpec, type ChannelSet, type NotificationActionSpec, type Urgency } from "./registry";

// Producer-facing pipeline: notify() (persist + eager recipient rows + room
// fan-out), notifyUpdate() (revision bump + notification.updated), and
// notifyEphemeral() (room fan-out only, never persisted, no replay).

export const EXPIRY_DAYS = 30;

export type Audience =
  | { kind: "user"; userId: string }
  | { kind: "users"; userIds: string[] }
  | { kind: "org" }
  | { kind: "role"; role: string };

export interface NotificationMedia {
  kind: "image" | "file" | "audio";
  /** Storage resolve path (/api/storage/resolve/<mediaId>) or absolute URL. */
  url: string;
  filename?: string;
  contentType?: string | null;
  size?: number | null;
}

export interface NotifyOptions {
  organizationId: string;
  type: string;
  audience: Audience;
  title: string;
  body?: string;
  urgency?: Urgency;
  /** Override the registry's type label for this instance. */
  icon?: string | null;
  accent?: string | null;
  actor?: { name: string; image?: string | null };
  media?: NotificationMedia[];
  actions?: NotificationActionSpec[];
  deepLink?: string | null;
  groupingKey?: string | null;
  /** Same key ⇒ update instead of insert (update-if-exists-else-create). */
  dedupeKey?: string | null;
  /** With dedupeKey: reset seen/read when an existing row is updated. */
  renotifyOnDedupe?: boolean;
  silent?: boolean;
  /** Days until expiry; capped at 30. Default from the type registry. */
  expiryDays?: number;
  data?: Record<string, unknown>;
}

type NotificationRow = Awaited<ReturnType<typeof fetchRow>>;
async function fetchRow(id: string) {
  return db.selectFrom("notification").selectAll().where("id", "=", id).executeTakeFirst();
}

function viewOf(row: NonNullable<NotificationRow>, recipient: { seenAt: Date | null; readAt: Date | null; dismissedAt: Date | null } | null) {
  return {
    ...row,
    media: (row.media ?? []) as unknown as NotificationMedia[],
    actions: (row.actions ?? []) as unknown as NotificationActionSpec[],
    seen: recipient?.seenAt != null,
    read: recipient?.readAt != null,
    archived: recipient?.dismissedAt != null,
    seenAt: recipient?.seenAt?.toISOString() ?? null,
    readAt: recipient?.readAt?.toISOString() ?? null,
    dismissedAt: recipient?.dismissedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}
export type NotificationView = ReturnType<typeof viewOf>;

async function orgMemberIds(organizationId: string): Promise<string[]> {
  const rows = await db.selectFrom("member").select("userId").where("organizationId", "=", organizationId).execute();
  return rows.map((r) => r.userId);
}

async function resolveAudience(organizationId: string, audience: Audience): Promise<string[]> {
  if (audience.kind === "user") return [audience.userId];
  if (audience.kind === "users") return [...new Set(audience.userIds)];
  if (audience.kind === "role") {
    const rows = await db.selectFrom("member").select("userId").where("organizationId", "=", organizationId).where("role", "=", audience.role).execute();
    return rows.map((r) => r.userId);
  }
  return orgMemberIds(organizationId);
}

function validateActions(type: string, actions: NotificationActionSpec[] | undefined): NotificationActionSpec[] {
  if (!actions?.length) return [];
  const spec = typeSpec(type);
  const allowed = new Map((spec?.type.actions ?? []).map((a) => [a.id, a]));
  const out: NotificationActionSpec[] = [];
  for (const a of actions.slice(0, 3)) {
    const declared = allowed.get(a.id);
    if (!declared) continue; // only registry-declared actions survive
    out.push({ ...declared, ...a, verb: declared.verb, endpoint: declared.endpoint });
  }
  return out;
}

function expiryFrom(type: string, expiryDays?: number): Date {
  const days = Math.min(expiryDays ?? typeSpec(type)?.type.expiryDays ?? EXPIRY_DAYS, EXPIRY_DAYS);
  return new Date(Date.now() + days * 86_400_000);
}

/** Send a persisted notification: envelope row + eager recipient rows + room fan-out. */
export async function notify(opts: NotifyOptions): Promise<NotificationView> {
  const spec = typeSpec(opts.type);
  const urgency = opts.urgency ?? spec?.type.defaultUrgency ?? "normal";
  const userIds = await resolveAudience(opts.organizationId, opts.audience);
  const actions = validateActions(opts.type, opts.actions);
  const now = new Date();
  const id = crypto.randomUUID();
  const audience = opts.audience.kind === "user" ? "user" : opts.audience.kind === "users" ? "users" : opts.audience.kind === "role" ? `role:${opts.audience.role}` : "org";

  if (opts.dedupeKey) {
    const existing = await db
      .selectFrom("notification")
      .select("id")
      .where("organizationId", "=", opts.organizationId)
      .where("dedupeKey", "=", opts.dedupeKey)
      .executeTakeFirst();
    if (existing) return notifyUpdate(existing.id, { title: opts.title, body: opts.body, media: opts.media, actions: opts.actions, urgency, data: opts.data, renotify: opts.renotifyOnDedupe });
  }

  await db
    .insertInto("notification")
    .values({
      id,
      organizationId: opts.organizationId,
      userId: userIds[0] ?? "",
      title: opts.title,
      body: opts.body ?? "",
      origin: spec?.group.id ?? groupIdOfType(opts.type),
      type: opts.type,
      urgency,
      icon: opts.icon ?? null,
      accent: opts.accent ?? null,
      audience,
      actorName: opts.actor?.name ?? null,
      actorImage: opts.actor?.image ?? null,
      media: (opts.media ?? []) as never,
      actions: actions as never,
      deepLink: opts.deepLink ?? null,
      groupingKey: opts.groupingKey ?? null,
      dedupeKey: opts.dedupeKey ?? null,
      silent: opts.silent ?? false,
      revision: 1,
      data: (opts.data ?? {}) as never,
      readAt: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiryFrom(opts.type, opts.expiryDays),
    })
    .execute();

  if (userIds.length) {
    await db
      .insertInto("notification_recipient")
      .values(
        userIds.map((userId) => ({
          id: crypto.randomUUID(),
          notificationId: id,
          organizationId: opts.organizationId,
          userId,
          seenAt: null,
          readAt: null,
          dismissedAt: null,
          createdAt: now,
        })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  const row = await fetchRow(id);
  if (!row) throw new Error("notification row vanished after insert");
  fanOutNew(userIds, viewOf(row, null));
  return viewOf(row, null);
}

function fanOutNew(userIds: string[], view: NotificationView) {
  for (const userId of userIds) publishToUser(userId, "notification.new", view);
}

export interface NotifyUpdatePatch {
  title?: string;
  body?: string;
  media?: NotificationMedia[];
  actions?: NotificationActionSpec[];
  urgency?: Urgency;
  deepLink?: string | null;
  data?: Record<string, unknown>;
  /** Reset seen/read state so the update badges + re-toasts. */
  renotify?: boolean;
  expiryDays?: number;
}

/** Update an existing notification in place and push notification.updated. */
export async function notifyUpdate(idOrDedupeKey: string, patch: NotifyUpdatePatch): Promise<NotificationView> {
  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrDedupeKey)
    ? await db.selectFrom("notification").selectAll().where("id", "=", idOrDedupeKey).executeTakeFirst()
    : await db.selectFrom("notification").selectAll().where("dedupeKey", "=", idOrDedupeKey).limit(1).executeTakeFirst();
  if (!byId) throw new Error(`notification not found: ${idOrDedupeKey}`);
  const row = byId;

  const next: Record<string, unknown> = { revision: row.revision + 1, updatedAt: new Date() };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.body !== undefined) next.body = patch.body;
  if (patch.media !== undefined) next.media = patch.media;
  if (patch.actions !== undefined) next.actions = validateActions(row.type, patch.actions);
  if (patch.urgency !== undefined) next.urgency = patch.urgency;
  if (patch.deepLink !== undefined) next.deepLink = patch.deepLink;
  if (patch.data !== undefined) next.data = patch.data;
  if (patch.expiryDays !== undefined) next.expiresAt = expiryFrom(row.type, patch.expiryDays);

  const updated = await db.updateTable("notification").set(next).where("id", "=", row.id).returningAll().executeTakeFirstOrThrow();

  if (patch.renotify) {
    await db
      .updateTable("notification_recipient")
      .set({ seenAt: null, readAt: null })
      .where("notificationId", "=", row.id)
      .execute();
  }

  const recipients = await db.selectFrom("notification_recipient").select(["userId", "seenAt", "readAt", "dismissedAt"]).where("notificationId", "=", row.id).execute();
  const view = viewOf(updated, null);
  for (const r of recipients) {
    publishToUser(r.userId, "notification.updated", { ...view, seen: r.seenAt != null, read: r.readAt != null, archived: r.dismissedAt != null, seenAt: r.seenAt?.toISOString() ?? null, readAt: r.readAt?.toISOString() ?? null, dismissedAt: r.dismissedAt?.toISOString() ?? null });
  }
  return view;
}

export interface EphemeralOptions {
  organizationId: string;
  type: string;
  audience: Audience;
  title: string;
  body?: string;
  urgency?: Urgency;
  icon?: string | null;
  accent?: string | null;
  actor?: { name: string; image?: string | null };
  ttlMs?: number;
  deepLink?: string | null;
  data?: Record<string, unknown>;
}

/** WS-only notification: no rows, no badge, toast with ttl, never replayed. */
export async function notifyEphemeral(opts: EphemeralOptions): Promise<void> {
  const spec = typeSpec(opts.type);
  const urgency = opts.urgency ?? spec?.type.defaultUrgency ?? "normal";
  const userIds = await resolveAudience(opts.organizationId, opts.audience);
  const payload = {
    ephemeral: true as const,
    id: crypto.randomUUID(),
    organizationId: opts.organizationId,
    title: opts.title,
    body: opts.body ?? "",
    origin: spec?.group.id ?? groupIdOfType(opts.type),
    type: opts.type,
    urgency,
    icon: opts.icon ?? null,
    accent: opts.accent ?? null,
    actorName: opts.actor?.name ?? null,
    actorImage: opts.actor?.image ?? null,
    ttlMs: opts.ttlMs ?? 8000,
    deepLink: opts.deepLink ?? null,
    data: opts.data ?? {},
    createdAt: new Date().toISOString(),
  };
  for (const userId of userIds) publishToUser(userId, "notification.ephemeral", payload);
}

/** Publish a per-recipient lifecycle change (seen/read/dismissed) to all of
 *  the user's sockets for cross-device sync. */
export function publishState(userId: string, view: NotificationView) {
  publishToUser(userId, "notification.state", { id: view.id, seen: view.seen, read: view.read, archived: view.archived, seenAt: view.seenAt, readAt: view.readAt, dismissedAt: view.dismissedAt });
}

export { viewOf };
export { DEFAULT_CHANNELS };
export type { ChannelSet };
export { URGENCY_RANK };
