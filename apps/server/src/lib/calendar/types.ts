import type { Selectable } from "kysely";
import type { CalendarConference, CalendarEventTable, CalendarPerson, CalendarReminderSpec, CalendarTable, ConnectedAccountTable } from "../../plugins/db";
import type { TokenCtx } from "../accounts/provider-http";

export type CalendarRow = Selectable<CalendarTable>;
export type EventRow = Selectable<CalendarEventTable>;
export type AccountRow = Selectable<ConnectedAccountTable>;

export interface NormalizedAttendee {
  email: string;
  name?: string | null;
  role?: string;
  status?: string;
  comment?: string | null;
  isOrganizer?: boolean;
  isSelf?: boolean;
  additionalGuests?: number;
}

/** Provider-neutral event, close to an iCalendar VEVENT. */
export interface NormalizedEvent {
  providerEventId: string;
  etag?: string | null;
  uid: string;
  sequence?: number;
  /** Override instance: the master's provider id + original start. */
  recurringProviderEventId?: string | null;
  originalStartAt?: Date | null;
  originalStartDate?: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  title: string;
  descriptionHtml?: string | null;
  location?: string | null;
  isAllDay: boolean;
  startAt?: Date | null;
  endAt?: Date | null;
  startDate?: string | null;
  endDate?: string | null;
  startTz?: string | null;
  endTz?: string | null;
  isFloating?: boolean;
  rrule?: string[] | null;
  transparency?: "opaque" | "transparent";
  visibility?: string;
  eventType?: string;
  eventTypeProps?: Record<string, unknown>;
  color?: string | null;
  organizer?: CalendarPerson | null;
  attendees: NormalizedAttendee[];
  attendeesOmitted?: boolean;
  conference?: CalendarConference | null;
  /** null = calendar defaults. */
  reminders?: CalendarReminderSpec[] | null;
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOthers?: boolean;
  providerData?: Record<string, unknown>;
  providerUpdatedAt?: Date | null;
  rawIcs?: string | null;
}

export interface NormalizedCalendar {
  providerCalendarId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  timezone?: string | null;
  accessRole: "owner" | "writer" | "reader" | "free_busy";
  isPrimary?: boolean;
  kind?: string;
  defaultReminders?: CalendarReminderSpec[];
  allowedConference?: string[];
  ctag?: string | null;
  providerData?: Record<string, unknown>;
}

export interface SyncPage {
  events: NormalizedEvent[];
  /** Provider ids removed at the provider. */
  deleted: string[];
  /** Cursor to store once `more` is false. */
  cursor: string | null;
  /** Another page follows (pass `pageCursor` back). */
  more: boolean;
  pageCursor?: string | null;
  /** True when the provider forced a full resync (reconcile everything not seen). */
  full: boolean;
  /** Series masters to (re)fetch after this page — Graph returns instances only. */
  seriesToRefresh?: string[];
  /** CalDAV hrefs whose whole content is in this page — stored items under them that are missing get removed. */
  replacedResources?: string[];
}

export interface SyncOptions {
  cursor: string | null;
  pageCursor?: string | null;
  from: Date;
  to: Date;
  /** CalDAV: stored resource href → etag, to diff against the server listing. */
  known?: Map<string, string | null>;
}

export interface CalendarCtx extends TokenCtx {
  account: AccountRow;
}

/** Event as written to a provider — the local row plus its attendees and reminders. */
export interface EventWrite {
  event: EventRow;
  attendees: NormalizedAttendee[];
  reminders: CalendarReminderSpec[] | null;
  /** For override pushes: the master's row. */
  master?: EventRow | null;
  /** Overrides of a master (CalDAV writes the whole resource). */
  overrides?: { event: EventRow; attendees: NormalizedAttendee[] }[];
}

export interface WriteResult {
  providerEventId: string;
  etag?: string | null;
  normalized?: NormalizedEvent | null;
}

export interface CalendarConnector {
  listCalendars(ctx: CalendarCtx): Promise<NormalizedCalendar[]>;
  syncEvents(ctx: CalendarCtx, calendar: CalendarRow, opts: SyncOptions): Promise<SyncPage>;
  fetchEvent(ctx: CalendarCtx, calendar: CalendarRow, providerEventId: string): Promise<NormalizedEvent[] | null>;
  /** Series master + its overrides inside the window (Graph). */
  fetchSeries?(ctx: CalendarCtx, calendar: CalendarRow, masterProviderId: string, from: Date, to: Date): Promise<NormalizedEvent[]>;
  create(ctx: CalendarCtx, calendar: CalendarRow, write: EventWrite): Promise<WriteResult>;
  update(ctx: CalendarCtx, calendar: CalendarRow, write: EventWrite, etag: string | null): Promise<WriteResult>;
  /** Changes one instance of a series (override). */
  updateInstance(ctx: CalendarCtx, calendar: CalendarRow, write: EventWrite, etag: string | null): Promise<WriteResult>;
  remove(ctx: CalendarCtx, calendar: CalendarRow, providerEventId: string, etag: string | null, write?: EventWrite): Promise<void>;
  /** Sets the account owner's response. */
  respond(ctx: CalendarCtx, calendar: CalendarRow, write: EventWrite, status: string, comment: string | null): Promise<WriteResult>;
  move?(ctx: CalendarCtx, from: CalendarRow, to: CalendarRow, providerEventId: string): Promise<WriteResult>;
  freeBusy?(ctx: CalendarCtx, emails: string[], from: Date, to: Date): Promise<Record<string, { start: Date; end: Date }[]>>;
  watch?(ctx: CalendarCtx, calendar: CalendarRow, address: string, channelId: string, token: string): Promise<{ resourceId: string | null; expiresAt: Date }>;
  unwatch?(ctx: CalendarCtx, channelId: string, resourceId: string | null): Promise<void>;
}

export class SyncTokenExpiredError extends Error {
  constructor() {
    super("sync_token_expired");
  }
}

export class PreconditionFailedError extends Error {
  constructor() {
    super("precondition_failed");
  }
}

export class CalendarAccessError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
