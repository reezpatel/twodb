import { sql } from "kysely";
import { db } from "../../auth";
import { logger } from "../logger";
import { accountCredentials, saveAccountCredentials } from "../email/accounts";
import { learnFromEvent, replaceAttendees } from "./events";
import { rebuildOccurrences } from "./occurrences";
import { noteRemoteChanges, noteRemoteDeleted, protectedFields } from "./pending-push";
import { buildSnapshot, changedFields, columnsFor, loadAttendees, loadReminders, writeReminders, type PushField } from "./snapshot";
import { calendarConnectorFor } from "./connectors/registry";
import { SyncTokenExpiredError, type AccountRow, type CalendarCtx, type CalendarRow, type NormalizedCalendar, type NormalizedEvent } from "./types";

// Provider → local import. Imports never block on approval: they upsert
// events, but leave fields that are queued in Pending push or pinned local
// (rejected) untouched and record what the provider changed instead.

const FUTURE_YEARS = 10;
const PAGE_LIMIT = 40;

type Notify = (calendarId: string, payload: Record<string, unknown>) => Promise<void>;
let notify: Notify = async () => {};
export function setSyncNotifier(fn: Notify) {
  notify = fn;
}

export function calendarCtx(account: AccountRow): CalendarCtx {
  const ctx: CalendarCtx = {
    account,
    credentials: accountCredentials(account),
    saveCredentials: async (next) => {
      ctx.credentials = next;
      await saveAccountCredentials(account.id, next);
    },
  };
  return ctx;
}

export function importWindow(account: AccountRow) {
  const from = account.calendarImportFrom ? new Date(account.calendarImportFrom) : new Date(Date.now() - 2 * 366 * 86_400_000);
  const to = new Date();
  to.setUTCFullYear(to.getUTCFullYear() + FUTURE_YEARS);
  return { from, to };
}

// ── calendar list ────────────────────────────────────────────────────────────

export async function syncCalendarList(account: AccountRow): Promise<CalendarRow[]> {
  const ctx = calendarCtx(account);
  const remote = await calendarConnectorFor(account.kind).listCalendars(ctx);
  const existing = await db.selectFrom("calendar").selectAll().where("accountId", "=", account.id).execute();
  const now = new Date();
  const seen = new Set<string>();
  for (const c of remote) {
    seen.add(c.providerCalendarId);
    const prev = existing.find((e) => e.providerCalendarId === c.providerCalendarId);
    const values = calendarValues(c);
    if (prev) {
      await db
        .updateTable("calendar")
        .set({ ...values, ...(prev.deletedAt ? { deletedAt: null } : {}), updatedAt: now })
        .where("id", "=", prev.id)
        .execute();
    } else {
      await db
        .insertInto("calendar")
        .values({
          id: crypto.randomUUID(),
          organizationId: account.organizationId,
          accountId: account.id,
          ownerUserId: account.ownerUserId,
          providerCalendarId: c.providerCalendarId,
          subscriptionUrl: null,
          syncCursor: null,
          ctag: null,
          lastSyncedAt: null,
          lastError: null,
          feedTokenHash: null,
          // Read-only extras (holidays, birthdays, other people's) start unsynced; the user can enable them.
          syncEnabled: c.accessRole !== "free_busy",
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          ...values,
        })
        .execute();
    }
  }
  for (const e of existing) {
    if (!seen.has(e.providerCalendarId ?? "") && !e.deletedAt)
      await db.updateTable("calendar").set({ deletedAt: now, updatedAt: now }).where("id", "=", e.id).execute();
  }
  await db.updateTable("connected_account").set({ calendarListSyncedAt: now }).where("id", "=", account.id).execute();
  return db.selectFrom("calendar").selectAll().where("accountId", "=", account.id).where("deletedAt", "is", null).execute();
}

function calendarValues(c: NormalizedCalendar) {
  return {
    name: c.name,
    description: c.description ?? null,
    color: c.color ?? "#4f7cff",
    timezone: c.timezone || "UTC",
    kind: c.kind ?? "regular",
    accessRole: c.accessRole,
    isPrimary: !!c.isPrimary,
    defaultReminders: JSON.stringify(c.defaultReminders ?? []),
    allowedConference: c.allowedConference ?? [],
    providerData: JSON.stringify(c.providerData ?? {}),
  };
}

// ── events ───────────────────────────────────────────────────────────────────

interface ApplyResult {
  touched: Set<string>;
  inserted: number;
}

async function selfSet(account: AccountRow) {
  return new Set([account.address, ...account.aliases].map((a) => a.toLowerCase()));
}

function eventColumns(ne: NormalizedEvent) {
  return {
    uid: ne.uid,
    etag: ne.etag ?? null,
    sequence: ne.sequence ?? 0,
    status: ne.status,
    title: ne.title,
    descriptionHtml: ne.descriptionHtml ?? null,
    location: ne.location ?? null,
    isAllDay: ne.isAllDay,
    startAt: ne.isAllDay ? null : (ne.startAt ?? null),
    endAt: ne.isAllDay ? null : (ne.endAt ?? ne.startAt ?? null),
    startDate: ne.isAllDay ? (ne.startDate ?? null) : null,
    endDate: ne.isAllDay ? (ne.endDate ?? null) : null,
    startTz: ne.isAllDay ? null : (ne.startTz ?? null),
    endTz: ne.isAllDay ? null : (ne.endTz ?? ne.startTz ?? null),
    isFloating: !!ne.isFloating,
    rrule: ne.rrule ?? null,
    transparency: ne.transparency ?? "opaque",
    visibility: ne.visibility ?? "default",
    eventType: ne.eventType ?? "default",
    eventTypeProps: JSON.stringify(ne.eventTypeProps ?? {}),
    color: ne.color ?? null,
    organizer: JSON.stringify(ne.organizer ?? null),
    conference: JSON.stringify(ne.conference ?? null),
    guestsCanModify: ne.guestsCanModify ?? false,
    guestsCanInviteOthers: ne.guestsCanInviteOthers ?? true,
    guestsCanSeeOthers: ne.guestsCanSeeOthers ?? true,
    attendeesOmitted: !!ne.attendeesOmitted,
    providerData: JSON.stringify({
      ...(ne.providerData ?? {}),
      ...(ne.recurringProviderEventId ? { recurringProviderEventId: ne.recurringProviderEventId } : {}),
    }),
    providerUpdatedAt: ne.providerUpdatedAt ?? null,
    rawIcs: ne.rawIcs ?? null,
  };
}

/** Upserts one provider event, respecting queued and pinned local fields. */
async function upsertImported(
  calendar: CalendarRow,
  account: AccountRow,
  ne: NormalizedEvent,
  masterIds: Map<string, string>,
  self: Set<string>,
  opts: { learn: boolean },
): Promise<{ id: string; inserted: boolean } | null> {
  const attendees = ne.attendees.map((a) => ({ ...a, isSelf: a.isSelf || self.has(a.email.toLowerCase()) }));
  const ownCalendar = calendar.accessRole === "owner";
  let masterId: string | null = null;
  if (ne.recurringProviderEventId) {
    masterId = masterIds.get(ne.recurringProviderEventId) ?? null;
    if (!masterId) {
      const m = await db
        .selectFrom("calendar_event")
        .select("id")
        .where("calendarId", "=", calendar.id)
        .where("providerEventId", "=", ne.recurringProviderEventId)
        .executeTakeFirst();
      masterId = m?.id ?? null;
    }
  }

  let existing = await db
    .selectFrom("calendar_event")
    .selectAll()
    .where("calendarId", "=", calendar.id)
    .where("providerEventId", "=", ne.providerEventId)
    .executeTakeFirst();
  if (!existing && masterId && (ne.originalStartAt || ne.originalStartDate)) {
    // A locally-created override not yet linked to its provider instance.
    existing = await db
      .selectFrom("calendar_event")
      .selectAll()
      .where("recurringEventId", "=", masterId)
      .where("providerEventId", "is", null)
      .where((eb) => (ne.originalStartDate ? eb("originalStartDate", "=", ne.originalStartDate) : eb("originalStartAt", "=", ne.originalStartAt!)))
      .executeTakeFirst();
  }
  if (!existing && !ne.recurringProviderEventId) {
    existing = await db
      .selectFrom("calendar_event")
      .selectAll()
      .where("calendarId", "=", calendar.id)
      .where("uid", "=", ne.uid)
      .where("providerEventId", "is", null)
      .where("recurringEventId", "is", null)
      .executeTakeFirst();
  }

  const now = new Date();
  const cols = eventColumns(ne);

  if (!existing) {
    if (ne.status === "cancelled" && !ne.recurringProviderEventId) return null;
    const id = crypto.randomUUID();
    await db
      .insertInto("calendar_event")
      .values({
        id,
        organizationId: calendar.organizationId,
        calendarId: calendar.id,
        providerEventId: ne.providerEventId,
        recurringEventId: masterId,
        originalStartAt: ne.originalStartAt ?? null,
        originalStartDate: ne.originalStartDate ?? null,
        geo: JSON.stringify(null),
        meetingRecordingId: null,
        source: "provider",
        localOnlyFields: "{}",
        localDeletedAt: null,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deletedSource: null,
        ...cols,
      })
      .execute();
    await replaceAttendees(id, attendees);
    if (ownCalendar) await writeReminders(id, ne.reminders ?? null);
    if (opts.learn && !masterId)
      await learnFromEvent(
        calendar,
        { organizer: ne.organizer ?? null, startAt: ne.startAt ?? null, startDate: ne.startDate ?? null, attendeesOmitted: !!ne.attendeesOmitted },
        attendees,
        account.ownerUserId,
      );
    return { id, inserted: true };
  }

  if (existing.deletedSource === "purged") return { id: existing.id, inserted: false };
  const prot = await protectedFields(existing.id);
  if (existing.deletedAt && existing.deletedSource === "user") {
    // Locally trashed: a queued delete wins; otherwise keep it trashed but track provider data.
    await db.updateTable("calendar_event").set({ etag: cols.etag, providerEventId: ne.providerEventId }).where("id", "=", existing.id).execute();
    return { id: existing.id, inserted: false };
  }

  const local = buildSnapshot(existing, await loadAttendees(existing.id), await loadReminders(existing.id));
  const remote = buildSnapshot(
    { ...existing, ...cols, organizer: ne.organizer ?? null, conference: ne.conference ?? null } as never,
    attendees,
    ne.reminders ?? null,
  );
  const differing = changedFields(local, remote);
  const held = differing.filter((f) => prot.queued.has(f) || f in prot.pinned) as PushField[];
  const apply = differing.filter((f) => !held.includes(f) && (f !== "reminders" || ownCalendar)) as PushField[];
  if (held.length) await noteRemoteChanges(existing.id, remote, held);

  const update: Record<string, unknown> = {
    etag: cols.etag,
    sequence: cols.sequence,
    providerEventId: ne.providerEventId,
    providerUpdatedAt: cols.providerUpdatedAt,
    providerData: cols.providerData,
    organizer: cols.organizer,
    attendeesOmitted: cols.attendeesOmitted,
    eventTypeProps: cols.eventTypeProps,
    isFloating: cols.isFloating,
    rawIcs: cols.rawIcs,
    uid: cols.uid,
    updatedAt: now,
  };
  if (masterId && !existing.recurringEventId) update.recurringEventId = masterId;
  for (const f of apply) Object.assign(update, columnsFor(f, remote));
  if (existing.deletedAt && existing.deletedSource === "provider" && ne.status !== "cancelled") {
    update.deletedAt = null;
    update.deletedSource = null;
  }
  await db.updateTable("calendar_event").set(update).where("id", "=", existing.id).execute();
  if (apply.includes("attendees") || !prot.queued.has("rsvp")) {
    if (apply.includes("attendees")) await replaceAttendees(existing.id, attendees);
    if (!prot.queued.has("rsvp")) {
      for (const a of attendees) {
        await db
          .updateTable("calendar_event_attendee")
          .set({ status: a.status ?? "needs_action", comment: a.comment ?? null, isSelf: !!a.isSelf, isOrganizer: !!a.isOrganizer })
          .where("eventId", "=", existing.id)
          .where("email", "=", a.email)
          .where("localStatus", "is", null)
          .execute();
      }
    }
  }
  if (apply.includes("reminders")) await writeReminders(existing.id, ne.reminders ?? null);
  return { id: existing.id, inserted: false };
}

async function markRemoved(calendar: CalendarRow, providerIds: string[], touched: Set<string>) {
  if (!providerIds.length) return;
  const rows = await db
    .selectFrom("calendar_event")
    .select(["id", "recurringEventId", "deletedAt"])
    .where("calendarId", "=", calendar.id)
    .where("providerEventId", "in", providerIds)
    .execute();
  const now = new Date();
  for (const r of rows) {
    if (r.deletedAt) continue;
    if (await noteRemoteDeleted(r.id)) {
      touched.add(r.id);
      continue;
    }
    await db
      .updateTable("calendar_event")
      .set({ deletedAt: now, deletedSource: "provider", updatedAt: now })
      .where((eb) => eb.or([eb("id", "=", r.id), eb("recurringEventId", "=", r.id)]))
      .where("deletedAt", "is", null)
      .execute();
    touched.add(r.recurringEventId ?? r.id);
  }
}

async function applyPage(
  calendar: CalendarRow,
  account: AccountRow,
  events: NormalizedEvent[],
  opts: { learn: boolean },
  seen?: Set<string>,
): Promise<ApplyResult> {
  const touched = new Set<string>();
  let inserted = 0;
  const self = await selfSet(account);
  const masterIds = new Map<string, string>();
  // Masters first so overrides in the same page can link to them.
  const ordered = [...events].sort((a, b) => Number(!!a.recurringProviderEventId) - Number(!!b.recurringProviderEventId));
  for (const ne of ordered) {
    seen?.add(ne.providerEventId);
    try {
      const res = await upsertImported(calendar, account, ne, masterIds, self, opts);
      if (!res) continue;
      if (!ne.recurringProviderEventId) masterIds.set(ne.providerEventId, res.id);
      if (res.inserted) inserted++;
      touched.add(res.id);
    } catch (e) {
      logger.warn({ err: e, calendarId: calendar.id, providerEventId: ne.providerEventId }, "calendar: import failed for event");
    }
  }
  // Overrides that arrived before their master: link them now.
  for (const [providerId, id] of masterIds) {
    await db
      .updateTable("calendar_event")
      .set({ recurringEventId: id })
      .where("calendarId", "=", calendar.id)
      .where("recurringEventId", "is", null)
      .where(sql<boolean>`"providerData"->>'recurringProviderEventId' = ${providerId}`)
      .execute();
  }
  return { touched, inserted };
}

async function rebuildTouched(touched: Set<string>) {
  const ids = [...touched];
  const rows = ids.length ? await db.selectFrom("calendar_event").select(["id", "recurringEventId"]).where("id", "in", ids).execute() : [];
  const roots = new Set(rows.map((r) => r.recurringEventId ?? r.id));
  for (const id of roots) await rebuildOccurrences(id);
}

/** Incremental (or full) event sync for one provider calendar. Returns how many events were imported. */
export async function syncCalendarEvents(
  account: AccountRow,
  calendar: CalendarRow,
  opts: { onProgress?: (n: number) => Promise<void> } = {},
): Promise<number> {
  const connector = calendarConnectorFor(account.kind);
  const ctx = calendarCtx(account);
  const { from, to } = importWindow(account);
  let cursor = calendar.syncCursor;
  let pageCursor: string | null = null;
  let full = !cursor;
  const seen = new Set<string>();
  const touched = new Set<string>();
  let imported = 0;
  let pages = 0;

  const known =
    account.kind === "imap"
      ? new Map(
          (
            await db
              .selectFrom("calendar_event")
              .select(["providerEventId", "etag"])
              .where("calendarId", "=", calendar.id)
              .where("recurringEventId", "is", null)
              .where("providerEventId", "is not", null)
              .where((eb) => eb.or([eb("deletedAt", "is", null), eb("deletedSource", "=", "user")]))
              .execute()
          ).map((r) => [r.providerEventId!, r.etag] as [string, string | null]),
        )
      : undefined;

  for (;;) {
    let page;
    try {
      page = await connector.syncEvents(ctx, calendar, { cursor, pageCursor, from, to, known });
    } catch (e) {
      if (e instanceof SyncTokenExpiredError && cursor) {
        cursor = null;
        pageCursor = null;
        full = true;
        continue;
      }
      throw e;
    }
    const result = await applyPage(calendar, account, page.events, { learn: true }, seen);
    for (const id of result.touched) touched.add(id);
    imported += page.events.length;

    for (const masterId of page.seriesToRefresh ?? []) {
      if (!connector.fetchSeries) break;
      const series = await connector.fetchSeries(ctx, calendar, masterId, from, to);
      const r = await applyPage(calendar, account, series, { learn: true }, seen);
      for (const id of r.touched) touched.add(id);
    }
    if (page.replacedResources?.length) {
      for (const href of page.replacedResources) {
        const present = new Set(
          page.events.filter((e) => e.providerEventId === href || e.providerEventId.startsWith(`${href}#`)).map((e) => e.providerEventId),
        );
        const stale = await db
          .selectFrom("calendar_event")
          .select("providerEventId")
          .where("calendarId", "=", calendar.id)
          .where("providerEventId", "like", `${href.replace(/[%_\\]/g, "\\$&")}#%`)
          .where("deletedAt", "is", null)
          .execute();
        await markRemoved(
          calendar,
          stale.map((s) => s.providerEventId!).filter((id) => !present.has(id)),
          touched,
        );
      }
    }
    await markRemoved(calendar, page.deleted, touched);
    if (opts.onProgress) await opts.onProgress(imported);

    if (page.more && ++pages < PAGE_LIMIT * 50) {
      pageCursor = page.pageCursor ?? null;
      if (pageCursor) continue;
    }
    cursor = page.cursor ?? cursor;
    full = full || page.full;
    break;
  }

  if (full && account.kind !== "imap") {
    // Full resync: anything we hold from this provider that wasn't listed is gone.
    const stale = await db
      .selectFrom("calendar_event")
      .select("providerEventId")
      .where("calendarId", "=", calendar.id)
      .where("providerEventId", "is not", null)
      .where("deletedAt", "is", null)
      .where("recurringEventId", "is", null)
      .where((eb) => eb.or([eb("endAt", ">=", from), eb("rrule", "is not", null), eb("endDate", ">=", from.toISOString().slice(0, 10))]))
      .execute();
    const gone = stale.map((s) => s.providerEventId!).filter((id) => !seen.has(id));
    await markRemoved(calendar, gone, touched);
  }

  await rebuildTouched(touched);
  await db.updateTable("calendar").set({ syncCursor: cursor, lastSyncedAt: new Date(), lastError: null }).where("id", "=", calendar.id).execute();
  if (touched.size) await notify(calendar.id, { type: "event.changed", calendarId: calendar.id, eventIds: [...touched].slice(0, 200) });
  return imported;
}

/** Applies a provider version of one event (after a push or a conflict refetch). */
export async function applyProviderEvent(account: AccountRow, calendar: CalendarRow, events: NormalizedEvent[]) {
  const result = await applyPage(calendar, account, events, { learn: false });
  await rebuildTouched(result.touched);
}
