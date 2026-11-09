import { sql } from "kysely";
import { db } from "../../auth";
import type { LocalOnlyField } from "../../plugins/db";
import { accessibleCalendars } from "./access";
import { rebuildOccurrences } from "./occurrences";
import {
  applySnapshotFields,
  buildSnapshot,
  changedFields,
  loadAttendees,
  loadReminders,
  sameValue,
  snapshotEvent,
  type EventSnapshot,
  type PushField,
} from "./snapshot";
import { CalendarAccessError, type EventRow } from "./types";

// Pending push: every local change to a provider calendar becomes one
// coalesced row per event (and recurrence scope) awaiting approval. Approve
// hands it to the exporter; reject keeps the edit in twodb only by pinning the
// changed fields (localOnlyFields) so imports never undo it.

export type ChangeOp = "create" | "update" | "delete" | "move" | "rsvp" | "cancel_instance";
export type RecurrenceScope = "this" | "following" | "all";

export const OPEN_STATUSES = ["awaiting_approval", "pending", "sending", "failed", "conflict"];

export interface QueueInput {
  event: EventRow;
  op: ChangeOp;
  /** Provider-side state before this edit (null for creates). */
  before: EventSnapshot | null;
  userId: string;
  scope?: RecurrenceScope;
  occurrenceStart?: Date | null;
  payload?: Record<string, unknown>;
}

type Broadcast = (accountId: string, event: Record<string, unknown>) => Promise<void>;
let broadcaster: Broadcast = async () => {};
export function setPendingBroadcaster(fn: Broadcast) {
  broadcaster = fn;
}

async function setPushState(eventId: string) {
  const open = await db.selectFrom("calendar_change").select("status").where("eventId", "=", eventId).where("status", "in", OPEN_STATUSES).execute();
  const order = ["conflict", "failed", "awaiting_approval", "sending", "pending"];
  const state = order.find((s) => open.some((o) => o.status === s)) ?? "none";
  await db
    .updateTable("calendar_event")
    .set({ pushState: state === "sending" ? "pending" : state })
    .where("id", "=", eventId)
    .execute();
}

function impactOf(op: ChangeOp, after: EventSnapshot | null, fields: PushField[]): Record<string, unknown> {
  const guests = (after?.attendees ?? []).filter((a) => a.role !== "resource").length;
  const notifies =
    op === "create" ||
    op === "delete" ||
    op === "cancel_instance" ||
    fields.some((f) => ["time", "title", "location", "attendees", "rrule", "status"].includes(f));
  return {
    emailsGuests: notifies && guests ? guests : 0,
    createsConference: !!(after?.conference && (after.conference as { create?: boolean }).create),
    respondsToOrganizer: op === "rsvp",
  };
}

function diffOf(before: EventSnapshot | null, after: EventSnapshot | null, fields: PushField[]) {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const f of fields) diff[f] = { before: before ? before[f] : null, after: after ? after[f] : null };
  return diff;
}

/** Records a local change for approval. No-op for twodb calendars and for events kept local only. */
export async function queueChange(input: QueueInput): Promise<void> {
  const calendar = await db.selectFrom("calendar").select(["id", "accountId", "organizationId"]).where("id", "=", input.event.calendarId).executeTakeFirst();
  if (!calendar?.accountId) return;
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", input.event.id).executeTakeFirstOrThrow();
  if (event.localOnly && input.op !== "create") return;

  const scope = input.scope ?? "all";
  const pinned = new Set(Object.keys(event.localOnlyFields ?? {}));
  const after = input.op === "delete" ? null : await snapshotEvent(event.id);
  const now = new Date();
  const open = await db
    .selectFrom("calendar_change")
    .selectAll()
    .where("eventId", "=", event.id)
    .where("recurrenceScope", "=", scope)
    .where(sql<boolean>`coalesce("occurrenceStart", 'epoch'::timestamptz) = coalesce(${input.occurrenceStart ?? null}::timestamptz, 'epoch'::timestamptz)`)
    .where("status", "=", "awaiting_approval")
    .executeTakeFirst();

  let op: ChangeOp = input.op;
  let base: EventSnapshot | null = input.before;
  let payload = input.payload ?? {};
  if (open) {
    base = (open.baseSnapshot as EventSnapshot | null) ?? input.before;
    const prev = open.op as ChangeOp;
    if (prev === "create" && op === "delete") {
      await db.updateTable("calendar_change").set({ status: "discarded", decidedAt: now, updatedAt: now }).where("id", "=", open.id).execute();
      await setPushState(event.id);
      await broadcaster(calendar.accountId, { type: "pending.updated", accountId: calendar.accountId });
      return;
    }
    if (prev === "create") op = "create";
    else if (prev === "delete" && op !== "delete") op = "update";
    else if (prev === "rsvp" && op === "rsvp") payload = { ...open.payload, ...payload };
    else if (prev === "rsvp" && op === "update") payload = { ...open.payload, ...payload, alsoRsvp: open.payload };
    else if (op === "update" && (prev === "cancel_instance" || prev === "move")) op = prev;
  }

  let fields: PushField[];
  if (op === "create") fields = changedFields(null, after!);
  else if (op === "delete" || op === "cancel_instance") fields = [];
  else if (op === "rsvp") fields = [];
  else fields = after ? changedFields(base, after).filter((f) => !pinned.has(f)) : [];

  if (op === "update" && !fields.length && !payload.alsoRsvp) {
    if (open) await db.updateTable("calendar_change").set({ status: "discarded", decidedAt: now, updatedAt: now }).where("id", "=", open.id).execute();
    await setPushState(event.id);
    await broadcaster(calendar.accountId, { type: "pending.updated", accountId: calendar.accountId });
    return;
  }

  const values = {
    op,
    fields,
    diff: JSON.stringify(op === "create" ? diffOf(null, after, fields) : diffOf(base, after, fields)),
    impact: JSON.stringify(impactOf(op, after ?? base, fields)),
    payload: JSON.stringify(payload),
    createdByUserId: input.userId,
    updatedAt: now,
  };
  if (open) {
    await db.updateTable("calendar_change").set(values).where("id", "=", open.id).execute();
  } else {
    await db
      .insertInto("calendar_change")
      .values({
        id: crypto.randomUUID(),
        organizationId: calendar.organizationId,
        accountId: calendar.accountId,
        calendarId: calendar.id,
        eventId: event.id,
        recurrenceScope: scope,
        occurrenceStart: input.occurrenceStart ?? null,
        baseSnapshot: JSON.stringify(base),
        baseEtag: event.etag,
        remoteChangedFields: [],
        status: "awaiting_approval",
        decidedByUserId: null,
        decidedAt: null,
        nextAttemptAt: null,
        lastError: null,
        doneAt: null,
        createdAt: now,
        ...values,
      })
      .execute();
  }
  await setPushState(event.id);
  await broadcaster(calendar.accountId, { type: "pending.updated", accountId: calendar.accountId });
}

/** Fields the importer must not overwrite: queued/in-flight changes plus pinned local-only fields. */
export async function protectedFields(eventId: string): Promise<{ queued: Set<string>; pinned: Record<string, LocalOnlyField>; deleteQueued: boolean }> {
  const [rows, event] = await Promise.all([
    db.selectFrom("calendar_change").select(["op", "fields"]).where("eventId", "=", eventId).where("status", "in", OPEN_STATUSES).execute(),
    db.selectFrom("calendar_event").select("localOnlyFields").where("id", "=", eventId).executeTakeFirst(),
  ]);
  const queued = new Set<string>();
  let deleteQueued = false;
  for (const r of rows) {
    if (r.op === "create" || r.op === "delete" || r.op === "cancel_instance") deleteQueued ||= r.op !== "create";
    for (const f of r.fields) queued.add(f);
    if (r.op === "rsvp") queued.add("rsvp");
  }
  return { queued, pinned: event?.localOnlyFields ?? {}, deleteQueued };
}

/** Called by the importer when the provider changed fields we're holding back. */
export async function noteRemoteChanges(eventId: string, remote: EventSnapshot, fields: PushField[]): Promise<void> {
  if (!fields.length) return;
  const rows = await db.selectFrom("calendar_change").selectAll().where("eventId", "=", eventId).where("status", "in", OPEN_STATUSES).execute();
  for (const r of rows) {
    const base = r.baseSnapshot as EventSnapshot | null;
    const changed = fields.filter((f) => r.fields.includes(f) && (!base || !sameValue(base[f], remote[f])));
    if (!changed.length) continue;
    const payload = {
      ...r.payload,
      remote: { ...((r.payload.remote as Record<string, unknown>) ?? {}), ...Object.fromEntries(changed.map((f) => [f, remote[f]])) },
    };
    await db
      .updateTable("calendar_change")
      .set({ remoteChangedFields: [...new Set([...r.remoteChangedFields, ...changed])], payload: JSON.stringify(payload), updatedAt: new Date() })
      .where("id", "=", r.id)
      .execute();
  }
  const event = await db.selectFrom("calendar_event").select("localOnlyFields").where("id", "=", eventId).executeTakeFirst();
  const pinned = { ...(event?.localOnlyFields ?? {}) };
  let touched = false;
  for (const f of fields) {
    if (pinned[f] && !sameValue(pinned[f].providerValue, remote[f])) {
      pinned[f] = { ...pinned[f], remoteValue: remote[f] };
      touched = true;
    }
  }
  if (touched)
    await db
      .updateTable("calendar_event")
      .set({ localOnlyFields: JSON.stringify(pinned) })
      .where("id", "=", eventId)
      .execute();
}

export async function noteRemoteDeleted(eventId: string): Promise<boolean> {
  const res = await db
    .updateTable("calendar_change")
    .set({ remoteDeleted: true, updatedAt: new Date() })
    .where("eventId", "=", eventId)
    .where("status", "in", ["awaiting_approval", "failed", "conflict"])
    .where("op", "not in", ["delete", "cancel_instance"])
    .executeTakeFirst();
  return Number(res.numUpdatedRows) > 0;
}

// ── approve / reject ─────────────────────────────────────────────────────────

async function approverAccounts(organizationId: string, userId: string): Promise<Set<string>> {
  const access = await accessibleCalendars(organizationId, userId);
  return new Set(access.filter((a) => a.canApprove && a.calendar.accountId).map((a) => a.calendar.accountId!));
}

export interface PendingFilter {
  accountId?: string | null;
  calendarId?: string | null;
  op?: string | null;
}

async function selectForDecision(organizationId: string, userId: string, ids: string[] | null, filter: PendingFilter) {
  const allowed = await approverAccounts(organizationId, userId);
  if (!allowed.size) throw new CalendarAccessError(403, "forbidden");
  let q = db
    .selectFrom("calendar_change")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("status", "=", "awaiting_approval")
    .where("accountId", "in", [...allowed]);
  if (ids) q = q.where("id", "in", ids.length ? ids : ["__none__"]);
  if (filter.accountId) q = q.where("accountId", "=", filter.accountId);
  if (filter.calendarId) q = q.where("calendarId", "=", filter.calendarId);
  if (filter.op) q = q.where("op", "=", filter.op);
  const rows = await q.execute();
  if (ids && rows.length !== new Set(ids).size) {
    const found = new Set(rows.map((r) => r.id));
    if (ids.some((id) => !found.has(id))) throw new CalendarAccessError(404, "change_not_found");
  }
  return rows;
}

export async function approveChanges(organizationId: string, userId: string, ids: string[] | null, filter: PendingFilter = {}): Promise<number> {
  const rows = await selectForDecision(organizationId, userId, ids, filter);
  const now = new Date();
  for (const r of rows) {
    await db
      .updateTable("calendar_change")
      .set({ status: "pending", decidedByUserId: userId, decidedAt: now, nextAttemptAt: now, updatedAt: now })
      .where("id", "=", r.id)
      .execute();
    await setPushState(r.eventId);
  }
  for (const accountId of new Set(rows.map((r) => r.accountId))) await broadcaster(accountId, { type: "pending.updated", accountId });
  return rows.length;
}

export async function rejectChanges(organizationId: string, userId: string, ids: string[] | null, filter: PendingFilter = {}): Promise<number> {
  const rows = await selectForDecision(organizationId, userId, ids, filter);
  const now = new Date();
  for (const r of rows) {
    await keepLocal(r.eventId, r.op as ChangeOp, r.fields as PushField[], r.baseSnapshot as EventSnapshot | null, r.payload);
    await db
      .updateTable("calendar_change")
      .set({ status: "rejected", decidedByUserId: userId, decidedAt: now, updatedAt: now })
      .where("id", "=", r.id)
      .execute();
    await setPushState(r.eventId);
    await rebuildOccurrences(r.eventId);
  }
  for (const accountId of new Set(rows.map((r) => r.accountId))) await broadcaster(accountId, { type: "pending.updated", accountId });
  return rows.length;
}

/** Reject semantics: the edit stays visible in twodb and is pinned against imports. */
async function keepLocal(eventId: string, op: ChangeOp, fields: PushField[], base: EventSnapshot | null, payload: Record<string, unknown>) {
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirst();
  if (!event) return;
  if (op === "create") {
    await db.updateTable("calendar_event").set({ localOnly: true }).where("id", "=", eventId).execute();
    return;
  }
  if (op === "delete" || op === "cancel_instance") {
    await db
      .updateTable("calendar_event")
      .set({
        deletedAt: null,
        deletedSource: null,
        localDeletedAt: new Date(),
        ...(op === "cancel_instance" ? { status: (base?.status as string) ?? "confirmed" } : {}),
      })
      .where("id", "=", eventId)
      .execute();
    return;
  }
  if (op === "rsvp" || payload.alsoRsvp) {
    const rsvp = (op === "rsvp" ? payload : payload.alsoRsvp) as { status?: string; previous?: string; email?: string };
    if (rsvp?.email) {
      await db
        .updateTable("calendar_event_attendee")
        .set({ localStatus: rsvp.status ?? null, status: rsvp.previous ?? "needs_action" })
        .where("eventId", "=", eventId)
        .where("email", "=", rsvp.email)
        .execute();
    }
  }
  if (fields.length && base) {
    const pinned = { ...(event.localOnlyFields ?? {}) };
    for (const f of fields) pinned[f] = { providerValue: base[f] };
    await db
      .updateTable("calendar_event")
      .set({ localOnlyFields: JSON.stringify(pinned) })
      .where("id", "=", eventId)
      .execute();
  }
}

/** "Push now": re-queues everything kept local on this event, for approval. */
export async function pushNow(organizationId: string, userId: string, eventId: string) {
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!event) throw new CalendarAccessError(404, "event_not_found");
  if (event.localOnly) {
    await db.updateTable("calendar_event").set({ localOnly: false }).where("id", "=", eventId).execute();
    await queueChange({ event, op: "create", before: null, userId });
  }
  const pinned = event.localOnlyFields ?? {};
  if (Object.keys(pinned).length) {
    const current = buildSnapshot(event, await loadAttendees(eventId), await loadReminders(eventId));
    const base = { ...current } as Record<string, unknown>;
    for (const [f, v] of Object.entries(pinned)) base[f] = v.remoteValue ?? v.providerValue;
    await db.updateTable("calendar_event").set({ localOnlyFields: "{}" }).where("id", "=", eventId).execute();
    await queueChange({ event, op: "update", before: base as EventSnapshot, userId });
  }
  if (event.localDeletedAt) {
    await db.updateTable("calendar_event").set({ localDeletedAt: null, deletedAt: new Date(), deletedSource: "user" }).where("id", "=", eventId).execute();
    await queueChange({ event, op: "delete", before: buildSnapshot(event, await loadAttendees(eventId), await loadReminders(eventId)), userId });
  }
  const local = await db
    .selectFrom("calendar_event_attendee")
    .select(["email", "localStatus", "status"])
    .where("eventId", "=", eventId)
    .where("localStatus", "is not", null)
    .execute();
  for (const a of local) {
    await db
      .updateTable("calendar_event_attendee")
      .set({ status: a.localStatus!, localStatus: null })
      .where("eventId", "=", eventId)
      .where("email", "=", a.email)
      .execute();
    await queueChange({ event, op: "rsvp", before: null, userId, payload: { status: a.localStatus, previous: a.status, email: a.email } });
  }
  await rebuildOccurrences(eventId);
}

/** "Discard local changes": the provider version wins again. */
export async function discardLocal(organizationId: string, eventId: string) {
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!event) throw new CalendarAccessError(404, "event_not_found");
  if (event.localOnly) {
    await db.updateTable("calendar_event").set({ deletedAt: new Date(), deletedSource: "user", localOnly: false }).where("id", "=", eventId).execute();
  }
  const pinned = event.localOnlyFields ?? {};
  if (Object.keys(pinned).length) {
    const snap = buildSnapshot(event, await loadAttendees(eventId), await loadReminders(eventId)) as Record<string, unknown>;
    for (const [f, v] of Object.entries(pinned)) snap[f] = v.remoteValue ?? v.providerValue;
    await applySnapshotFields(eventId, snap as EventSnapshot, Object.keys(pinned) as PushField[]);
    await db.updateTable("calendar_event").set({ localOnlyFields: "{}" }).where("id", "=", eventId).execute();
  }
  if (event.localDeletedAt) await db.updateTable("calendar_event").set({ localDeletedAt: null }).where("id", "=", eventId).execute();
  await db.updateTable("calendar_event_attendee").set({ localStatus: null }).where("eventId", "=", eventId).execute();
  await rebuildOccurrences(eventId);
}

// ── listing ──────────────────────────────────────────────────────────────────

export async function listPending(organizationId: string, userId: string, filter: PendingFilter & { history?: boolean } = {}) {
  const access = await accessibleCalendars(organizationId, userId);
  const accountIds = [...new Set(access.filter((a) => a.calendar.accountId).map((a) => a.calendar.accountId!))];
  if (!accountIds.length) return [];
  const approver = new Set(access.filter((a) => a.canApprove).map((a) => a.calendar.accountId));
  let q = db
    .selectFrom("calendar_change")
    .innerJoin("calendar_event", "calendar_event.id", "calendar_change.eventId")
    .innerJoin("calendar", "calendar.id", "calendar_change.calendarId")
    .innerJoin("connected_account", "connected_account.id", "calendar_change.accountId")
    .leftJoin("user as editor", "editor.id", "calendar_change.createdByUserId")
    .leftJoin("user as decider", "decider.id", "calendar_change.decidedByUserId")
    .select([
      "calendar_change.id",
      "calendar_change.op",
      "calendar_change.status",
      "calendar_change.fields",
      "calendar_change.diff",
      "calendar_change.impact",
      "calendar_change.payload",
      "calendar_change.recurrenceScope",
      "calendar_change.occurrenceStart",
      "calendar_change.remoteChangedFields",
      "calendar_change.remoteDeleted",
      "calendar_change.lastError",
      "calendar_change.attempts",
      "calendar_change.createdAt",
      "calendar_change.updatedAt",
      "calendar_change.decidedAt",
      "calendar_change.accountId",
      "calendar_change.calendarId",
      "calendar_change.eventId",
      "calendar_event.title",
      "calendar_event.isAllDay",
      "calendar_event.startAt",
      "calendar_event.endAt",
      "calendar_event.startDate",
      "calendar_event.endDate",
      "calendar_event.startTz",
      "calendar.name as calendarName",
      "calendar.color as calendarColor",
      "connected_account.address as accountAddress",
      "editor.name as editorName",
      "decider.name as deciderName",
    ])
    .where("calendar_change.organizationId", "=", organizationId)
    .where("calendar_change.accountId", "in", accountIds);
  q = filter.history
    ? q
        .where("calendar_change.status", "in", ["pending", "sending", "done", "failed", "conflict", "rejected"])
        .where("calendar_change.updatedAt", ">", new Date(Date.now() - 14 * 86_400_000))
    : q.where("calendar_change.status", "=", "awaiting_approval");
  if (filter.accountId) q = q.where("calendar_change.accountId", "=", filter.accountId);
  if (filter.calendarId) q = q.where("calendar_change.calendarId", "=", filter.calendarId);
  if (filter.op) q = q.where("calendar_change.op", "=", filter.op);
  const rows = await q.orderBy("calendar_change.updatedAt", "desc").limit(500).execute();
  return rows.map((r) => ({ ...r, canApprove: approver.has(r.accountId) }));
}

export async function pendingCount(organizationId: string, userId: string): Promise<{ awaiting: number; failed: number }> {
  const access = await accessibleCalendars(organizationId, userId);
  const accountIds = [...new Set(access.filter((a) => a.calendar.accountId).map((a) => a.calendar.accountId!))];
  if (!accountIds.length) return { awaiting: 0, failed: 0 };
  const rows = await db
    .selectFrom("calendar_change")
    .select(({ fn }) => ["status", fn.countAll<string>().as("n")])
    .where("accountId", "in", accountIds)
    .where("status", "in", ["awaiting_approval", "failed", "conflict"])
    .groupBy("status")
    .execute();
  const n = (s: string) => Number(rows.find((r) => r.status === s)?.n ?? 0);
  return { awaiting: n("awaiting_approval"), failed: n("failed") + n("conflict") };
}

export { setPushState };
