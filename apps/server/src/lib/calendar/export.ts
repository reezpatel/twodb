import { db } from "../../auth";
import { logger } from "../logger";
import { EmailAuthError } from "../email/types";
import { setCalendarState } from "../email/accounts";
import { accessibleCalendars } from "./access";
import { calendarConnectorFor } from "./connectors/registry";
import { rebuildOccurrences } from "./occurrences";
import { setPushState, type ChangeOp } from "./pending-push";
import { applySnapshotFields, buildSnapshot, changedFields, columnsFor, loadAttendees, loadReminders, type EventSnapshot, type PushField } from "./snapshot";
import { applyProviderEvent, calendarCtx } from "./sync";
import {
  CalendarAccessError,
  PreconditionFailedError,
  type AccountRow,
  type CalendarRow,
  type EventRow,
  type EventWrite,
  type NormalizedAttendee,
} from "./types";

// Sends approved Pending push rows to the provider, in order per event.
// 412 (someone changed the event at the provider) → refetch and field-merge:
// if the remote edit touched other fields we retry, otherwise it's a conflict
// the user resolves (keep mine / use theirs).

const BACKOFF_MIN = [1, 5, 30, 120, 360];
const MAX_ATTEMPTS = 6;
const STUCK_MS = 5 * 60_000;

type Broadcast = (accountId: string, payload: Record<string, unknown>) => Promise<void>;
let broadcast: Broadcast = async () => {};
export function setExportBroadcaster(fn: Broadcast) {
  broadcast = fn;
}

/** The event as the provider should see it: pinned local-only fields are replaced by their provider values. */
async function providerView(event: EventRow): Promise<{ event: EventRow; attendees: NormalizedAttendee[]; reminders: EventSnapshot["reminders"] }> {
  const attendees = await loadAttendees(event.id);
  const reminders = await loadReminders(event.id);
  const pinned = event.localOnlyFields ?? {};
  if (!Object.keys(pinned).length) return { event, attendees: attendees.map((a) => ({ ...a })), reminders };
  const snap = buildSnapshot(event, attendees, reminders) as Record<string, unknown>;
  for (const [f, v] of Object.entries(pinned)) snap[f] = v.providerValue;
  const s = snap as EventSnapshot;
  const row = { ...event } as Record<string, unknown>;
  for (const f of Object.keys(pinned) as PushField[]) {
    const cols = columnsFor(f, s);
    for (const [k, v] of Object.entries(cols)) row[k] = k === "conference" ? JSON.parse(String(v)) : v;
  }
  const pinnedAttendees = pinned.attendees
    ? (s.attendees.map((a) => ({ ...a, status: attendees.find((x) => x.email === a.email)?.status ?? "needs_action" })) as NormalizedAttendee[])
    : attendees;
  return { event: row as unknown as EventRow, attendees: pinnedAttendees, reminders: pinned.reminders ? s.reminders : reminders };
}

async function buildWrite(event: EventRow): Promise<EventWrite> {
  const view = await providerView(event);
  const masterRow = event.recurringEventId
    ? await db.selectFrom("calendar_event").selectAll().where("id", "=", event.recurringEventId).executeTakeFirst()
    : null;
  const seriesId = masterRow?.id ?? (event.rrule?.length ? event.id : null);
  const overrides = seriesId
    ? await Promise.all(
        (await db.selectFrom("calendar_event").selectAll().where("recurringEventId", "=", seriesId).where("deletedAt", "is", null).execute()).map(async (o) => {
          const v = await providerView(o);
          return { event: v.event, attendees: v.attendees };
        }),
      )
    : [];
  const master = masterRow ? (await providerView(masterRow)).event : null;
  return { event: view.event, attendees: view.attendees, reminders: view.reminders, master, overrides };
}

async function finish(changeId: string, eventId: string, accountId: string, values: Record<string, unknown> = {}) {
  const now = new Date();
  await db
    .updateTable("calendar_change")
    .set({ status: "done", doneAt: now, lastError: null, updatedAt: now, ...values })
    .where("id", "=", changeId)
    .execute();
  await setPushState(eventId);
  await broadcast(accountId, { type: "pending.updated", accountId, eventIds: [eventId] });
}

async function linkProvider(
  event: EventRow,
  res: { providerEventId: string; etag?: string | null; normalized?: { conference?: unknown; uid?: string } | null },
) {
  const set: Record<string, unknown> = { providerEventId: res.providerEventId, etag: res.etag ?? null, updatedAt: new Date() };
  const conf = res.normalized?.conference as EventRow["conference"] | undefined;
  if (conf?.url && (event.conference?.create || !event.conference?.url)) set.conference = JSON.stringify(conf);
  await db.updateTable("calendar_event").set(set).where("id", "=", event.id).execute();
}

async function handlePrecondition(
  change: { id: string; fields: string[]; baseSnapshot: unknown; payload: Record<string, unknown> },
  account: AccountRow,
  calendar: CalendarRow,
  event: EventRow,
) {
  const connector = calendarConnectorFor(account.kind);
  const ctx = calendarCtx(account);
  const id = event.providerEventId ?? (event.recurringEventId ? null : null);
  const fetched = id ? await connector.fetchEvent(ctx, calendar, id) : null;
  const remote = fetched?.find((e) => e.providerEventId === id) ?? fetched?.[0];
  const now = new Date();
  if (!remote) {
    await db
      .updateTable("calendar_change")
      .set({ status: "conflict", remoteDeleted: true, lastError: "Event was deleted at the provider", updatedAt: now })
      .where("id", "=", change.id)
      .execute();
    return;
  }
  const remoteSnap = buildSnapshot(
    { ...event, ...remote, organizer: remote.organizer ?? null, conference: remote.conference ?? null } as never,
    remote.attendees,
    remote.reminders ?? null,
  );
  const base = change.baseSnapshot as EventSnapshot | null;
  const remoteChanged = base ? changedFields(base, remoteSnap) : [];
  const overlap = remoteChanged.filter((f) => change.fields.includes(f));
  // Pull the provider version in (our own queued fields stay protected) — this also refreshes the etag.
  await applyProviderEvent(account, calendar, fetched!);
  if (!overlap.length) {
    await db.updateTable("calendar_change").set({ status: "pending", nextAttemptAt: now, updatedAt: now }).where("id", "=", change.id).execute();
    return;
  }
  const payload = { ...change.payload, remote: Object.fromEntries(overlap.map((f) => [f, remoteSnap[f]])) };
  await db
    .updateTable("calendar_change")
    .set({ status: "conflict", remoteChangedFields: overlap, payload: JSON.stringify(payload), lastError: "Changed at the provider too", updatedAt: now })
    .where("id", "=", change.id)
    .execute();
}

export async function exportChange(changeId: string): Promise<void> {
  const change = await db.selectFrom("calendar_change").selectAll().where("id", "=", changeId).executeTakeFirst();
  if (!change || change.status !== "pending") return;
  const now = new Date();
  await db
    .updateTable("calendar_change")
    .set({ status: "sending", attempts: change.attempts + 1, updatedAt: now })
    .where("id", "=", change.id)
    .execute();

  const account = await db.selectFrom("connected_account").selectAll().where("id", "=", change.accountId).executeTakeFirst();
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", change.eventId).executeTakeFirst();
  const calendar = event ? await db.selectFrom("calendar").selectAll().where("id", "=", event.calendarId).executeTakeFirst() : null;
  if (!account || account.deletedAt || !event || !calendar) {
    await db
      .updateTable("calendar_change")
      .set({ status: "failed", lastError: "Account, calendar or event no longer exists", updatedAt: now })
      .where("id", "=", change.id)
      .execute();
    return;
  }
  const connector = calendarConnectorFor(account.kind);
  const ctx = calendarCtx(account);
  const op = change.op as ChangeOp;

  try {
    const write = await buildWrite(event);
    const isInstance = !!event.recurringEventId;
    switch (op) {
      case "create": {
        const res = isInstance ? await connector.updateInstance(ctx, calendar, write, null) : await connector.create(ctx, calendar, write);
        await linkProvider(event, res);
        break;
      }
      case "update": {
        if (!event.providerEventId && !isInstance) {
          const res = await connector.create(ctx, calendar, write);
          await linkProvider(event, res);
          break;
        }
        if (change.remoteDeleted && !isInstance) {
          const res = await connector.create(ctx, calendar, { ...write, event: { ...write.event, providerEventId: null } });
          await linkProvider(event, res);
          break;
        }
        const res = isInstance
          ? await connector.updateInstance(ctx, calendar, write, event.etag)
          : await connector.update(ctx, calendar, write, event.etag ?? change.baseEtag);
        await linkProvider(event, res);
        break;
      }
      case "delete": {
        if (event.providerEventId) await connector.remove(ctx, calendar, event.providerEventId, event.etag, write);
        break;
      }
      case "cancel_instance": {
        const res = await connector.updateInstance(ctx, calendar, { ...write, event: { ...write.event, status: "cancelled" } }, event.etag);
        if (res.providerEventId)
          await db
            .updateTable("calendar_event")
            .set({ providerEventId: res.providerEventId, etag: res.etag ?? null })
            .where("id", "=", event.id)
            .execute();
        break;
      }
      case "rsvp": {
        const p = change.payload as { status?: string; comment?: string | null };
        const res = await connector.respond(ctx, calendar, write, p.status ?? "accepted", p.comment ?? null);
        await db
          .updateTable("calendar_event")
          .set({ etag: res.etag ?? null })
          .where("id", "=", event.id)
          .execute();
        break;
      }
      case "move": {
        const fromId = String(change.payload.fromCalendarId ?? "");
        const from = await db.selectFrom("calendar").selectAll().where("id", "=", fromId).executeTakeFirst();
        if (!event.providerEventId || !from) {
          const res = await connector.create(ctx, calendar, write);
          await linkProvider(event, res);
        } else if (connector.move) {
          const res = await connector.move(ctx, from, calendar, event.providerEventId);
          await linkProvider(event, res);
        } else {
          const res = await connector.create(ctx, calendar, { ...write, event: { ...write.event, providerEventId: null } });
          await connector.remove(ctx, from, event.providerEventId, event.etag);
          await linkProvider(event, res);
        }
        break;
      }
    }
    await finish(change.id, event.id, account.id);
    await rebuildOccurrences(event.id);
  } catch (e) {
    const err = e as Error;
    if (e instanceof PreconditionFailedError) {
      await handlePrecondition(change, account, calendar, event).catch(async (inner) => {
        await db
          .updateTable("calendar_change")
          .set({ status: "failed", lastError: (inner as Error).message, updatedAt: new Date() })
          .where("id", "=", change.id)
          .execute();
      });
    } else if (e instanceof EmailAuthError) {
      await setCalendarState(account.id, "reauth_required", err.message);
      await db
        .updateTable("calendar_change")
        .set({ status: "pending", attempts: change.attempts, nextAttemptAt: new Date(Date.now() + 10 * 60_000), lastError: err.message, updatedAt: new Date() })
        .where("id", "=", change.id)
        .execute();
    } else {
      const attempts = change.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      logger.warn({ err, changeId: change.id, op }, "calendar: push failed");
      await db
        .updateTable("calendar_change")
        .set({
          status: failed ? "failed" : "pending",
          lastError: err.message.slice(0, 500),
          nextAttemptAt: failed ? null : new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000),
          updatedAt: new Date(),
        })
        .where("id", "=", change.id)
        .execute();
    }
    await setPushState(event.id);
    await broadcast(account.id, { type: "pending.updated", accountId: account.id, eventIds: [event.id] });
  }
}

/** A push interrupted mid-flight is never resent blindly. */
export async function recoverStuckChanges() {
  await db
    .updateTable("calendar_change")
    .set({ status: "failed", lastError: "Interrupted while sending — check the event at the provider, then retry", updatedAt: new Date() })
    .where("status", "=", "sending")
    .where("updatedAt", "<", new Date(Date.now() - STUCK_MS))
    .execute();
}

/** Due changes for one account, oldest first. */
export async function dueChanges(accountId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("calendar_change")
    .select("id")
    .where("accountId", "=", accountId)
    .where("status", "=", "pending")
    .where((eb) => eb.or([eb("nextAttemptAt", "is", null), eb("nextAttemptAt", "<=", new Date())]))
    .orderBy("createdAt")
    .limit(50)
    .execute();
  return rows.map((r) => r.id);
}

export async function accountsWithDueChanges(): Promise<string[]> {
  const rows = await db
    .selectFrom("calendar_change")
    .select("accountId")
    .distinct()
    .where("status", "=", "pending")
    .where((eb) => eb.or([eb("nextAttemptAt", "is", null), eb("nextAttemptAt", "<=", new Date())]))
    .limit(20)
    .execute();
  return rows.map((r) => r.accountId);
}

async function requireApprover(organizationId: string, userId: string, changeId: string) {
  const change = await db.selectFrom("calendar_change").selectAll().where("id", "=", changeId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!change) throw new CalendarAccessError(404, "change_not_found");
  const access = await accessibleCalendars(organizationId, userId);
  if (!access.some((a) => a.calendar.accountId === change.accountId && a.canApprove)) throw new CalendarAccessError(403, "forbidden");
  return change;
}

export async function retryChange(organizationId: string, userId: string, changeId: string) {
  const change = await requireApprover(organizationId, userId, changeId);
  if (!["failed", "conflict"].includes(change.status)) throw new CalendarAccessError(409, "not_retryable");
  await db
    .updateTable("calendar_change")
    .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() })
    .where("id", "=", change.id)
    .execute();
  await setPushState(change.eventId);
}

/** Conflict resolution: "mine" pushes the local values over the provider's; "theirs" takes the provider's values locally. */
export async function resolveConflict(organizationId: string, userId: string, changeId: string, resolution: "mine" | "theirs") {
  const change = await requireApprover(organizationId, userId, changeId);
  if (change.status !== "conflict") throw new CalendarAccessError(409, "not_in_conflict");
  const now = new Date();
  if (resolution === "mine") {
    const remote = (change.payload.remote as Record<string, unknown>) ?? {};
    const base = { ...((change.baseSnapshot as Record<string, unknown>) ?? {}), ...remote };
    await db
      .updateTable("calendar_change")
      .set({
        status: "pending",
        baseSnapshot: JSON.stringify(base),
        remoteChangedFields: [],
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        decidedByUserId: userId,
        decidedAt: now,
        updatedAt: now,
      })
      .where("id", "=", change.id)
      .execute();
  } else {
    const remote = (change.payload.remote as Record<string, unknown>) ?? {};
    const current = (await db.selectFrom("calendar_event").selectAll().where("id", "=", change.eventId).executeTakeFirst())!;
    const snap = { ...buildSnapshot(current, await loadAttendees(current.id), await loadReminders(current.id)), ...remote } as EventSnapshot;
    await applySnapshotFields(change.eventId, snap, Object.keys(remote) as PushField[]);
    const leftover = change.fields.filter((f) => !(f in remote));
    await db
      .updateTable("calendar_change")
      .set(
        leftover.length
          ? { status: "pending", fields: leftover, nextAttemptAt: now, attempts: 0, updatedAt: now }
          : { status: "discarded", decidedByUserId: userId, decidedAt: now, updatedAt: now },
      )
      .where("id", "=", change.id)
      .execute();
    await rebuildOccurrences(change.eventId);
  }
  await setPushState(change.eventId);
  await broadcast(change.accountId, { type: "pending.updated", accountId: change.accountId });
}
